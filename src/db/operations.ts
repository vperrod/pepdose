import { getDB, type UserProtocol, type ScheduledDose, type DoseLog, type Vial, type HealthMarker, type DeletionRecord } from './schema';
import type { UserName } from '../data/users';
import { USERS } from '../data/users';
import { format } from 'date-fns';
import { planDoseDedupe } from '../utils/dedupeDoses';
import { suspendSync } from './sync';

function genId(): string {
  return crypto.randomUUID();
}

/** Ledger entry for a just-deleted record so cloud sync pushes an explicit
 *  tombstone (see db/sync.ts). Must run inside the same tx as the delete. */
function ledgerEntry(kind: DeletionRecord['kind'], id: string): DeletionRecord {
  return { id, kind, deletedAt: new Date().toISOString() };
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
  // One transaction across both stores so a protocol can never be removed
  // while its scheduled doses survive as orphans (or vice versa).
  const tx = db.transaction(['protocols', 'scheduledDoses', 'deletions'], 'readwrite');
  const ledger = tx.objectStore('deletions');
  void tx.objectStore('protocols').delete(id);
  void ledger.put(ledgerEntry('protocols', id));
  const doseStore = tx.objectStore('scheduledDoses');
  const keys = await doseStore.index('by-protocol').getAllKeys(id);
  for (const key of keys) {
    void doseStore.delete(key);
    void ledger.put(ledgerEntry('scheduledDoses', key));
  }
  await tx.done;
}

// --- Scheduled Doses ---

export async function saveScheduledDoses(doses: Omit<ScheduledDose, 'owner'>[], owner: UserName): Promise<void> {
  const db = await getDB();
  // Stamp when the row was written. Without it sync had nothing to date a dose
  // by except `date` — the injection day, which for an upcoming dose is in the
  // future and outranked the delete that replaced it (see db/sync.ts rowTs).
  const createdAt = new Date().toISOString();
  const tx = db.transaction('scheduledDoses', 'readwrite');
  for (const dose of doses) {
    await tx.store.put({ createdAt, updatedAt: createdAt, ...dose, owner });
  }
  await tx.done;
}

/** One-shot cleanup for schedules the old sync bug duplicated. Returns how many
 *  spare rows went; deletes go through the ledger so the cloud drops them too.
 *  Bounded to the last 90 days (+ all upcoming, via the open-ended lowerBound) —
 *  duplicates only ever form around a protocol's active window, and this runs
 *  on every app boot, so scanning the full history every time doesn't pay off. */
export async function repairDuplicateScheduledDoses(): Promise<number> {
  const db = await getDB();
  const startDate = format(new Date(Date.now() - 90 * 86_400_000), 'yyyy-MM-dd');
  const [doses, protocols] = await Promise.all([
    db.getAllFromIndex('scheduledDoses', 'by-date', IDBKeyRange.lowerBound(startDate)),
    db.getAll('protocols'),
  ]);
  const spare = planDoseDedupe(doses, protocols);
  if (spare.length === 0) return 0;

  const tx = db.transaction(['scheduledDoses', 'deletions'], 'readwrite');
  const store = tx.objectStore('scheduledDoses');
  const ledger = tx.objectStore('deletions');
  for (const id of spare) {
    await store.delete(id);
    await ledger.put(ledgerEntry('scheduledDoses', id));
  }
  await tx.done;
  return spare.length;
}

export async function getScheduledDosesForDate(date: string): Promise<ScheduledDose[]> {
  const db = await getDB();
  return db.getAllFromIndex('scheduledDoses', 'by-date', date);
}

export async function getScheduledDosesForProtocol(protocolId: string): Promise<ScheduledDose[]> {
  const db = await getDB();
  return db.getAllFromIndex('scheduledDoses', 'by-protocol', protocolId);
}

// One store read instead of one indexed query per protocol (N+1 on Dashboard/Calendar).
export async function getScheduledDosesForProtocols(protocolIds: string[]): Promise<ScheduledDose[]> {
  if (protocolIds.length === 0) return [];
  const db = await getDB();
  const wanted = new Set(protocolIds);
  return (await db.getAll('scheduledDoses')).filter(d => wanted.has(d.protocolId));
}

export async function getScheduledDosesInRange(startDate: string, endDate: string): Promise<ScheduledDose[]> {
  const db = await getDB();
  return db.getAllFromIndex('scheduledDoses', 'by-date', IDBKeyRange.bound(startDate, endDate));
}

export async function updateScheduledDose(id: string, updates: Partial<ScheduledDose>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('scheduledDoses', id);
  if (!existing) return;
  await db.put('scheduledDoses', { ...existing, ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteUpcomingDosesFrom(protocolId: string, fromDate: string): Promise<void> {
  const db = await getDB();
  const doses = await db.getAllFromIndex('scheduledDoses', 'by-protocol', protocolId);
  const tx = db.transaction(['scheduledDoses', 'deletions'], 'readwrite');
  const store = tx.objectStore('scheduledDoses');
  const ledger = tx.objectStore('deletions');
  for (const dose of doses) {
    if (dose.status === 'upcoming' && dose.date >= fromDate) {
      await store.delete(dose.id);
      await ledger.put(ledgerEntry('scheduledDoses', dose.id));
    }
  }
  await tx.done;
}

export async function deleteScheduledDosesForProtocol(protocolId: string): Promise<void> {
  const db = await getDB();
  const doses = await db.getAllFromIndex('scheduledDoses', 'by-protocol', protocolId);
  const tx = db.transaction(['scheduledDoses', 'deletions'], 'readwrite');
  const store = tx.objectStore('scheduledDoses');
  const ledger = tx.objectStore('deletions');
  for (const dose of doses) {
    await store.delete(dose.id);
    await ledger.put(ledgerEntry('scheduledDoses', dose.id));
  }
  await tx.done;
}

// --- Dose Logs ---

export async function logDose(log: Omit<DoseLog, 'id' | 'createdAt'>): Promise<DoseLog> {
  const db = await getDB();
  const now = new Date().toISOString();
  const full: DoseLog = { ...log, id: genId(), createdAt: now, updatedAt: now };

  // One transaction across all three stores so a thrown error can never leave
  // vial inventory desynced from logged history (a partial log with no draw-down).
  const tx = db.transaction(['doseLogs', 'scheduledDoses', 'vials'], 'readwrite');
  void tx.objectStore('doseLogs').put(full);

  if (log.scheduledDoseId) {
    const doseStore = tx.objectStore('scheduledDoses');
    const existing = await doseStore.get(log.scheduledDoseId);
    if (existing) void doseStore.put({ ...existing, status: 'logged', updatedAt: now });
  }

  // Draw down inventory for the peptide's active vial so "doses remaining"
  // and the run-out forecast actually track logged injections.
  const vialStore = tx.objectStore('vials');
  const vials = await vialStore.index('by-peptide').getAll(log.peptideId);
  const active = vials.find(
    v => v.status === 'active' && v.dosesRemaining > 0 && (!log.owner || v.owner === log.owner),
  );
  if (active) {
    const remaining = active.dosesRemaining - 1;
    void vialStore.put({
      ...active,
      dosesRemaining: remaining,
      status: remaining <= 0 ? 'empty' : 'active',
      updatedAt: now,
    });
  }

  await tx.done;
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
  await db.put('doseLogs', { ...existing, ...updates, updatedAt: new Date().toISOString() });
}

export async function getAllDoseLogs(): Promise<DoseLog[]> {
  const db = await getDB();
  return db.getAll('doseLogs');
}

export async function getDoseLogsInRange(startDate: string, endDate: string): Promise<DoseLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('doseLogs', 'by-date', IDBKeyRange.bound(startDate, endDate));
}

export async function getDoseLogsSince(days: number): Promise<DoseLog[]> {
  const db = await getDB();
  const startDate = format(new Date(Date.now() - days * 86_400_000), 'yyyy-MM-dd');
  return db.getAllFromIndex('doseLogs', 'by-date', IDBKeyRange.lowerBound(startDate));
}

export async function deleteDoseLog(id: string): Promise<void> {
  const db = await getDB();
  const log = await db.get('doseLogs', id);
  if (log?.scheduledDoseId) {
    await updateScheduledDose(log.scheduledDoseId, { status: 'upcoming' });
  }
  const tx = db.transaction(['doseLogs', 'deletions'], 'readwrite');
  void tx.objectStore('doseLogs').delete(id);
  if (log) void tx.objectStore('deletions').put(ledgerEntry('doseLogs', id));
  await tx.done;
  // Return the drawn-down dose to inventory so deleting a log is fully reversible.
  if (log) await incrementVialDose(log.peptideId, log.owner);
}

// --- Vials ---

export async function saveVial(vial: Omit<Vial, 'id' | 'createdAt'>): Promise<Vial> {
  const db = await getDB();
  const now = new Date().toISOString();
  const full: Vial = { ...vial, id: genId(), createdAt: now, updatedAt: now };
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
  await db.put('vials', { ...existing, ...updates, updatedAt: new Date().toISOString() });
}

export async function decrementVialDose(peptideId: string, owner?: UserName): Promise<void> {
  const db = await getDB();
  // Read + write inside one readwrite transaction so two concurrent logs can't
  // both read the same dosesRemaining and lose a draw-down.
  const tx = db.transaction('vials', 'readwrite');
  const vials = await tx.store.index('by-peptide').getAll(peptideId);
  const active = vials.find(
    v => v.status === 'active' && v.dosesRemaining > 0 && (!owner || v.owner === owner),
  );
  if (active) {
    const remaining = active.dosesRemaining - 1;
    void tx.store.put({
      ...active,
      dosesRemaining: remaining,
      status: remaining <= 0 ? 'empty' : 'active',
      updatedAt: new Date().toISOString(),
    });
  }
  await tx.done;
}

export async function incrementVialDose(peptideId: string, owner?: UserName): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('vials', 'readwrite');
  const vials = await tx.store.index('by-peptide').getAll(peptideId);
  // Prefer an active vial with headroom; fall back to the most recent one that
  // was emptied (so undoing a log that emptied a vial restores it).
  const candidates = vials
    .filter(v => (!owner || v.owner === owner) && v.status !== 'expired')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const target = candidates.find(v => v.status === 'active' && v.dosesRemaining < v.totalDoses)
    ?? candidates.find(v => v.status === 'empty');
  if (target) {
    void tx.store.put({
      ...target,
      dosesRemaining: target.dosesRemaining + 1,
      status: 'active',
      updatedAt: new Date().toISOString(),
    });
  }
  await tx.done;
}

// --- Health Markers ---

export async function saveHealthMarker(marker: Omit<HealthMarker, 'id' | 'createdAt'>): Promise<HealthMarker> {
  const db = await getDB();
  const now = new Date().toISOString();
  const full: HealthMarker = { ...marker, id: genId(), createdAt: now, updatedAt: now };
  await db.put('healthMarkers', full);
  return full;
}

export async function getHealthMarkers(startDate?: string, endDate?: string): Promise<HealthMarker[]> {
  const db = await getDB();
  if (startDate && endDate) {
    return db.getAllFromIndex('healthMarkers', 'by-date', IDBKeyRange.bound(startDate, endDate));
  }
  return db.getAllFromIndex('healthMarkers', 'by-date');
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
    exportDate: new Date().toISOString(),
    version: 1,
  };
  return JSON.stringify(data, null, 2);
}

const IMPORT_STORES = ['protocols', 'scheduledDoses', 'doseLogs', 'vials', 'healthMarkers'] as const;

// Minimal per-store required string fields — enough to catch a wrong/garbled
// file before anything touches IndexedDB (every store also requires string id).
const IMPORT_REQUIRED: Record<(typeof IMPORT_STORES)[number], string[]> = {
  protocols: ['name', 'startDate'],
  scheduledDoses: ['protocolId', 'peptideId', 'date'],
  doseLogs: ['peptideId', 'date'],
  vials: ['peptideId'],
  healthMarkers: ['date'],
};

// Numeric fields per store (from schema.ts) — absent stays legal, but a present
// value must be a finite number, or NaN/strings poison vial decrement, charts
// and pen-click math downstream.
const IMPORT_NUMERIC: Record<(typeof IMPORT_STORES)[number], string[]> = {
  protocols: ['durationWeeks'],
  scheduledDoses: ['dose', 'weekNumber'],
  doseLogs: ['dose'],
  vials: ['amountMg', 'bacWaterMl', 'dosesRemaining', 'totalDoses'],
  healthMarkers: ['weight', 'bodyFatPct', 'bloodPressureSys', 'bloodPressureDia', 'restingHR', 'fastingGlucose', 'mood', 'energy', 'sleepQuality'],
};

function assertNumericFields(rec: Record<string, unknown>, fields: string[], label: string): void {
  for (const field of fields) {
    if (rec[field] !== undefined && !Number.isFinite(rec[field])) {
      throw new Error(`${label} entry has non-numeric field: ${field}`);
    }
  }
}

/** Validates a parsed backup's shape. Throws (before any write) on anything
 *  that isn't a pepdose export, so a bad file can't corrupt existing state. */
export function validateImport(data: unknown): asserts data is Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Backup must be a JSON object');
  }
  const obj = data as Record<string, unknown>;
  for (const storeName of IMPORT_STORES) {
    const rows = obj[storeName];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new Error(`${storeName} must be an array`);
    for (const item of rows) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new Error(`${storeName} contains a non-object entry`);
      }
      const rec = item as Record<string, unknown>;
      for (const field of ['id', ...IMPORT_REQUIRED[storeName]]) {
        if (typeof rec[field] !== 'string' || rec[field] === '') {
          throw new Error(`${storeName} entry missing required field: ${field}`);
        }
      }
      assertNumericFields(rec, IMPORT_NUMERIC[storeName], storeName);
      if (rec.owner !== undefined && !USERS.includes(rec.owner as UserName)) {
        throw new Error(`${storeName} entry has unknown owner: ${rec.owner}`);
      }
      // Nested numeric fields the top-level table can't reach: a protocol's
      // per-peptide dose configs (feed pen clicks / schedule math) and a dose
      // log's symptom severities (feed the symptom-trend charts).
      if (storeName === 'protocols' && Array.isArray(rec.doses)) {
        for (const d of rec.doses) {
          if (typeof d !== 'object' || d === null) continue;
          const cfg = d as Record<string, unknown>;
          assertNumericFields(cfg, ['dose', 'timesPerDay', 'durationWeeks', 'customFrequencyDays'], 'protocols doses');
          if (typeof cfg.recon === 'object' && cfg.recon !== null) {
            assertNumericFields(cfg.recon as Record<string, unknown>, ['vialAmount', 'bacWaterMl'], 'protocols doses recon');
          }
        }
      }
      if (storeName === 'doseLogs' && Array.isArray(rec.symptoms)) {
        for (const s of rec.symptoms) {
          if (typeof s !== 'object' || s === null) continue;
          assertNumericFields(s as Record<string, unknown>, ['severity'], 'doseLogs symptoms');
        }
      }
    }
  }
}

/** `owner` claims records from pre-two-user backups, which carry no owner field.
 *  The caller passes the profile active on this device — a hardcoded name would
 *  silently mis-own the other user's restore and hide it behind owner filtering. */
export async function importData(jsonString: string, owner: UserName): Promise<void> {
  const data = JSON.parse(jsonString);
  validateImport(data);
  // Same race as clearAllData: a background sync pass interleaving with the
  // per-store writes would push a half-restored snapshot or pull stale rows
  // over the restore, so hold it off until every store is written.
  const resumeSync = await suspendSync();
  try {
    const db = await getDB();

    const ownedStores = new Set(['protocols', 'scheduledDoses', 'doseLogs', 'vials', 'healthMarkers']);
    const now = new Date().toISOString();
    // One transaction across every store so a mid-restore failure (quota,
    // tab close) rolls back instead of leaving a half-restored device.
    const tx = db.transaction([...IMPORT_STORES, 'deletions'], 'readwrite');
    const ledger = tx.objectStore('deletions');
    try {
      for (const storeName of IMPORT_STORES) {
        if (data[storeName]) {
          const store = tx.objectStore(storeName);
          for (const item of data[storeName] as Record<string, unknown>[]) {
            if (ownedStores.has(storeName) && !item.owner) item.owner = owner;
            // Restore is an explicit resurrection: without a fresh stamp, a remote
            // tombstone newer than the backup would LWW-delete the row on next sync.
            item.updatedAt = now;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await store.put(item as any);
            // Restoring a record cancels any pending delete of it.
            await ledger.delete(item.id as string);
          }
        }
      }
    } catch (err) {
      // A failed request already aborts the transaction; a thrown error would
      // otherwise let the partial writes auto-commit.
      try { tx.abort(); } catch { /* already aborted */ }
      await tx.done.catch(() => {});
      throw err;
    }
    await tx.done;
  } finally {
    resumeSync();
  }
}

export async function clearAllData(): Promise<void> {
  // A background sync pass writing pulled rows after the wipe would silently
  // repopulate the device, so hold it off for the duration of the clear.
  const resumeSync = await suspendSync();
  try {
    const db = await getDB();
    // NOTE: deliberately does NOT write deletion-ledger entries — "clear all data"
    // means wipe this device, not delete the cloud copy; sync re-pulls afterwards.
    // One transaction across every store: a per-store loop can abort partway
    // (e.g. a concurrent tab holding a lock) and leave the device half-wiped.
    const stores = ['protocols', 'scheduledDoses', 'doseLogs', 'vials', 'healthMarkers', 'deletions'] as const;
    const tx = db.transaction(stores, 'readwrite');
    await Promise.all(stores.map((storeName) => tx.objectStore(storeName).clear()));
    await tx.done;
  } finally {
    resumeSync();
  }
}
