import { getDB, type UserProtocol, type ScheduledDose, type DoseLog, type Vial, type HealthMarker, type EditHistory } from './schema';
import { format } from 'date-fns';

function genId(): string {
  return crypto.randomUUID();
}

// --- Protocols ---

export async function saveProtocol(protocol: Omit<UserProtocol, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProtocol> {
  const db = await getDB();
  const full: UserProtocol = {
    ...protocol,
    id: genId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.put('protocols', full);
  return full;
}

export async function updateProtocol(id: string, updates: Partial<UserProtocol>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('protocols', id);
  if (!existing) return;
  await db.put('protocols', { ...existing, ...updates, updatedAt: new Date().toISOString() });
}

export async function getProtocols(status?: string): Promise<UserProtocol[]> {
  const db = await getDB();
  if (status) return db.getAllFromIndex('protocols', 'by-status', status);
  return db.getAll('protocols');
}

export async function getProtocol(id: string): Promise<UserProtocol | undefined> {
  const db = await getDB();
  return db.get('protocols', id);
}

export async function deleteProtocol(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('protocols', id);
  const doses = await db.getAllFromIndex('scheduledDoses', 'by-protocol', id);
  const tx = db.transaction('scheduledDoses', 'readwrite');
  for (const dose of doses) {
    await tx.store.delete(dose.id);
  }
  await tx.done;
}

// --- Scheduled Doses ---

export async function saveScheduledDoses(doses: ScheduledDose[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('scheduledDoses', 'readwrite');
  for (const dose of doses) {
    await tx.store.put(dose);
  }
  await tx.done;
}

export async function getScheduledDosesForDate(date: string): Promise<ScheduledDose[]> {
  const db = await getDB();
  return db.getAllFromIndex('scheduledDoses', 'by-date', date);
}

export async function getScheduledDosesForProtocol(protocolId: string): Promise<ScheduledDose[]> {
  const db = await getDB();
  return db.getAllFromIndex('scheduledDoses', 'by-protocol', protocolId);
}

export async function getScheduledDosesInRange(startDate: string, endDate: string): Promise<ScheduledDose[]> {
  const db = await getDB();
  const all = await db.getAll('scheduledDoses');
  return all.filter(d => d.date >= startDate && d.date <= endDate);
}

export async function updateScheduledDose(id: string, updates: Partial<ScheduledDose>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('scheduledDoses', id);
  if (!existing) return;
  await db.put('scheduledDoses', { ...existing, ...updates });
}

export async function updateFutureScheduledDoses(
  protocolId: string,
  fromDate: string,
  updates: Partial<Pick<ScheduledDose, 'dose' | 'unit' | 'time'>>,
  editField: string,
  oldValue: string,
  newValue: string,
): Promise<number> {
  const db = await getDB();
  const doses = await db.getAllFromIndex('scheduledDoses', 'by-protocol', protocolId);
  const future = doses.filter(d => d.status === 'upcoming' && d.date >= fromDate);

  const tx = db.transaction('scheduledDoses', 'readwrite');
  for (const dose of future) {
    await tx.store.put({
      ...dose,
      ...updates,
      editNote: `${editField} changed on ${format(new Date(), 'yyyy-MM-dd')}`,
    });
  }
  await tx.done;

  const editDb = await getDB();
  await editDb.put('editHistory', {
    id: genId(),
    protocolId,
    field: editField,
    oldValue,
    newValue,
    affectedDoses: future.length,
    date: new Date().toISOString(),
  });

  return future.length;
}

export async function deleteUpcomingDosesFrom(protocolId: string, fromDate: string): Promise<void> {
  const db = await getDB();
  const doses = await db.getAllFromIndex('scheduledDoses', 'by-protocol', protocolId);
  const tx = db.transaction('scheduledDoses', 'readwrite');
  for (const dose of doses) {
    if (dose.status === 'upcoming' && dose.date >= fromDate) {
      await tx.store.delete(dose.id);
    }
  }
  await tx.done;
}

export async function deleteScheduledDosesForProtocol(protocolId: string): Promise<void> {
  const db = await getDB();
  const doses = await db.getAllFromIndex('scheduledDoses', 'by-protocol', protocolId);
  const tx = db.transaction('scheduledDoses', 'readwrite');
  for (const dose of doses) {
    await tx.store.delete(dose.id);
  }
  await tx.done;
}

// --- Dose Logs ---

export async function logDose(log: Omit<DoseLog, 'id' | 'createdAt'>): Promise<DoseLog> {
  const db = await getDB();
  const full: DoseLog = { ...log, id: genId(), createdAt: new Date().toISOString() };
  await db.put('doseLogs', full);

  if (log.scheduledDoseId) {
    await updateScheduledDose(log.scheduledDoseId, { status: 'logged' });
  }

  return full;
}

export async function getDoseLogsForDate(date: string): Promise<DoseLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('doseLogs', 'by-date', date);
}

export async function getDoseLogsForPeptide(peptideId: string): Promise<DoseLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('doseLogs', 'by-peptide', peptideId);
}

export async function getDoseLogsForProtocol(protocolId: string): Promise<DoseLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('doseLogs', 'by-protocol', protocolId);
}

export async function updateDoseLog(id: string, updates: Partial<DoseLog>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('doseLogs', id);
  if (!existing) return;
  await db.put('doseLogs', { ...existing, ...updates });
}

export async function getAllDoseLogs(): Promise<DoseLog[]> {
  const db = await getDB();
  return db.getAll('doseLogs');
}

export async function deleteDoseLog(id: string): Promise<void> {
  const db = await getDB();
  const log = await db.get('doseLogs', id);
  if (log?.scheduledDoseId) {
    await updateScheduledDose(log.scheduledDoseId, { status: 'upcoming' });
  }
  await db.delete('doseLogs', id);
}

// --- Vials ---

export async function saveVial(vial: Omit<Vial, 'id' | 'createdAt'>): Promise<Vial> {
  const db = await getDB();
  const full: Vial = { ...vial, id: genId(), createdAt: new Date().toISOString() };
  await db.put('vials', full);
  return full;
}

export async function getVials(peptideId?: string): Promise<Vial[]> {
  const db = await getDB();
  if (peptideId) return db.getAllFromIndex('vials', 'by-peptide', peptideId);
  return db.getAll('vials');
}

export async function updateVial(id: string, updates: Partial<Vial>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('vials', id);
  if (!existing) return;
  await db.put('vials', { ...existing, ...updates });
}

export async function decrementVialDose(peptideId: string): Promise<void> {
  const db = await getDB();
  const vials = await db.getAllFromIndex('vials', 'by-peptide', peptideId);
  const active = vials.find(v => v.status === 'active' && v.dosesRemaining > 0);
  if (!active) return;

  const remaining = active.dosesRemaining - 1;
  await db.put('vials', {
    ...active,
    dosesRemaining: remaining,
    status: remaining <= 0 ? 'empty' : 'active',
  });
}

// --- Health Markers ---

export async function saveHealthMarker(marker: Omit<HealthMarker, 'id' | 'createdAt'>): Promise<HealthMarker> {
  const db = await getDB();
  const full: HealthMarker = { ...marker, id: genId(), createdAt: new Date().toISOString() };
  await db.put('healthMarkers', full);
  return full;
}

export async function getHealthMarkers(startDate?: string, endDate?: string): Promise<HealthMarker[]> {
  const db = await getDB();
  const all = await db.getAll('healthMarkers');
  if (startDate && endDate) {
    return all.filter(m => m.date >= startDate && m.date <= endDate);
  }
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

// --- Edit History ---

export async function getEditHistory(protocolId: string): Promise<EditHistory[]> {
  const db = await getDB();
  return db.getAllFromIndex('editHistory', 'by-protocol', protocolId);
}

// --- Export / Import ---

export async function exportAllData(): Promise<string> {
  const db = await getDB();
  const data = {
    protocols: await db.getAll('protocols'),
    scheduledDoses: await db.getAll('scheduledDoses'),
    doseLogs: await db.getAll('doseLogs'),
    vials: await db.getAll('vials'),
    healthMarkers: await db.getAll('healthMarkers'),
    editHistory: await db.getAll('editHistory'),
    exportDate: new Date().toISOString(),
    version: 1,
  };
  return JSON.stringify(data, null, 2);
}

export async function importData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  const db = await getDB();

  const stores = ['protocols', 'scheduledDoses', 'doseLogs', 'vials', 'healthMarkers', 'editHistory'] as const;
  for (const storeName of stores) {
    if (data[storeName]) {
      const tx = db.transaction(storeName, 'readwrite');
      for (const item of data[storeName]) {
        await tx.store.put(item);
      }
      await tx.done;
    }
  }
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const stores = ['protocols', 'scheduledDoses', 'doseLogs', 'vials', 'healthMarkers', 'editHistory'] as const;
  for (const storeName of stores) {
    await db.clear(storeName);
  }
}
