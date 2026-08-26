import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveVial,
  getVials,
  decrementVialDose,
  incrementVialDose,
  logDose,
  deleteDoseLog,
  getAllDoseLogs,
  saveProtocol,
  getProtocol,
  saveScheduledDoses,
  getScheduledDosesForProtocol,
  getScheduledDosesInRange,
  getScheduledDosesForDate,
  getDoseLogsForDate,
  getDoseLogsInRange,
  deleteProtocol,
  deleteUpcomingDosesFrom,
  deleteScheduledDosesForProtocol,
  clearAllData,
  importData,
  validateImport,
  exportAllData,
} from './operations';
import { filterByOwner } from '../context/ownerFilter';
import { predictEmptyDate } from '../utils/vialForecast';
import { getDB } from './schema';
import type { Vial } from './schema';

const baseVial: Omit<Vial, 'id' | 'createdAt'> = {
  owner: 'Victor',
  peptideId: 'bpc-157',
  amountMg: 5,
  bacWaterMl: 2,
  dosesRemaining: 3,
  totalDoses: 20,
  status: 'active',
};

const baseLog = {
  owner: 'Victor' as const,
  protocolId: 'p1',
  peptideId: 'bpc-157',
  date: '2026-07-15',
  time: '08:00',
  dose: 250,
  unit: 'mcg' as const,
  route: 'subq',
};

beforeEach(async () => {
  await clearAllData();
});

describe('decrementVialDose', () => {
  it('draws one dose from the active vial', async () => {
    await saveVial(baseVial);
    await decrementVialDose('bpc-157', 'Victor');
    const [vial] = await getVials('bpc-157');
    expect(vial.dosesRemaining).toBe(2);
  });

  it('marks the vial empty when the last dose is drawn', async () => {
    await saveVial({ ...baseVial, dosesRemaining: 1 });
    await decrementVialDose('bpc-157', 'Victor');
    const [vial] = await getVials('bpc-157');
    expect(vial.status).toBe('empty');
  });

  it('does nothing when no active vial matches', async () => {
    await saveVial({ ...baseVial, status: 'empty', dosesRemaining: 0 });
    await decrementVialDose('bpc-157', 'Victor');
    const [vial] = await getVials('bpc-157');
    expect(vial.dosesRemaining).toBe(0);
  });

  it('keeps the run-out forecast in step with the draw-down', async () => {
    await saveVial(baseVial);
    await decrementVialDose('bpc-157', 'Victor');
    const [vial] = await getVials('bpc-157');
    // Daily cadence: 2 doses left -> empty in 2 days.
    const forecast = predictEmptyDate(vial.dosesRemaining, ['2026-07-13', '2026-07-14', '2026-07-15'], new Date('2026-07-15T12:00:00Z'));
    expect(forecast).toBe('2026-07-17');
  });
});

describe('incrementVialDose', () => {
  it('returns a dose to the active vial', async () => {
    await saveVial(baseVial);
    await incrementVialDose('bpc-157', 'Victor');
    const [vial] = await getVials('bpc-157');
    expect(vial.dosesRemaining).toBe(4);
  });

  it('reactivates an emptied vial', async () => {
    await saveVial({ ...baseVial, status: 'empty', dosesRemaining: 0 });
    await incrementVialDose('bpc-157', 'Victor');
    const [vial] = await getVials('bpc-157');
    expect(vial).toMatchObject({ status: 'active', dosesRemaining: 1 });
  });
});

describe('logDose / deleteDoseLog inventory round trip', () => {
  it('logging then deleting a dose leaves dosesRemaining unchanged', async () => {
    await saveVial(baseVial);
    const log = await logDose(baseLog);
    await deleteDoseLog(log.id);
    const [vial] = await getVials('bpc-157');
    expect(vial.dosesRemaining).toBe(baseVial.dosesRemaining);
  });

  it('logging a dose draws down the vial', async () => {
    await saveVial(baseVial);
    await logDose(baseLog);
    const [vial] = await getVials('bpc-157');
    expect(vial.dosesRemaining).toBe(2);
  });

  it('deleting the log actually removes it', async () => {
    await saveVial(baseVial);
    const log = await logDose(baseLog);
    await deleteDoseLog(log.id);
    expect(await getAllDoseLogs()).toEqual([]);
  });
});

describe('getScheduledDosesInRange', () => {
  it('returns only doses within the inclusive date range', async () => {
    await saveScheduledDoses([
      { id: 'd1', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-14', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
      { id: 'd2', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-15', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
      { id: 'd3', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-16', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
      { id: 'd4', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-17', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
    ], 'Victor');

    const inRange = await getScheduledDosesInRange('2026-07-15', '2026-07-16');

    expect(inRange.map((d) => d.id)).toEqual(['d2', 'd3']);
  });
});

describe('getDoseLogsInRange', () => {
  it('returns only logs within the inclusive date range', async () => {
    await saveVial({ ...baseVial, dosesRemaining: 10 });
    for (const date of ['2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17']) {
      await logDose({ ...baseLog, date });
    }

    const inRange = await getDoseLogsInRange('2026-07-15', '2026-07-16');

    expect(inRange.map((l) => l.date).sort()).toEqual(['2026-07-15', '2026-07-16']);
  });
});

// Pins the shared-device isolation contract behind the reminder fix (ffe0ddf):
// the per-date reads return every owner's rows, so every consumer MUST pass
// them through filterByOwner — otherwise one profile's doses leak into the
// other's UI or OS notifications.
describe('per-owner isolation of per-date reads', () => {
  it("owner-filtered scheduled doses exclude the other profile's rows", async () => {
    await saveScheduledDoses([
      { id: 'v-1', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-15', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
    ], 'Victor');
    await saveScheduledDoses([
      { id: 'n-1', protocolId: 'p2', peptideId: 'tesamorelin', date: '2026-07-15', time: '21:00', dose: 1, unit: 'mg', route: 'subq', status: 'upcoming', weekNumber: 1 },
    ], 'Nadia');

    const visible = filterByOwner(await getScheduledDosesForDate('2026-07-15'), 'Victor');

    expect(visible.map((d) => d.id)).toEqual(['v-1']);
  });

  it("owner-filtered dose logs exclude the other profile's rows", async () => {
    await logDose(baseLog);
    await logDose({ ...baseLog, owner: 'Nadia' as const, peptideId: 'tesamorelin' });

    const visible = filterByOwner(await getDoseLogsForDate('2026-07-15'), 'Victor');

    expect(visible.map((l) => l.owner)).toEqual(['Victor']);
  });
});

describe('deleteProtocol', () => {
  it('removes the protocol and all of its scheduled doses together', async () => {
    const protocol = await saveProtocol({
      owner: 'Victor',
      name: 'Test',
      peptideIds: ['bpc-157'],
      doses: [],
      startDate: '2026-07-15',
      durationWeeks: 4,
      status: 'active',
    });
    await saveScheduledDoses([
      { id: 'd1', protocolId: protocol.id, peptideId: 'bpc-157', date: '2026-07-15', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
      { id: 'd2', protocolId: protocol.id, peptideId: 'bpc-157', date: '2026-07-16', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
    ], 'Victor');

    await deleteProtocol(protocol.id);

    expect(await getProtocol(protocol.id)).toBeUndefined();
    expect(await getScheduledDosesForProtocol(protocol.id)).toEqual([]);
  });

  it('records the protocol and its doses in the deletion ledger', async () => {
    const protocol = await saveProtocol({
      owner: 'Victor', name: 'Test', peptideIds: ['bpc-157'], doses: [],
      startDate: '2026-07-15', durationWeeks: 4, status: 'active',
    });
    await saveScheduledDoses([
      { id: 'd1', protocolId: protocol.id, peptideId: 'bpc-157', date: '2026-07-15', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
    ], 'Victor');

    await deleteProtocol(protocol.id);

    const db = await getDB();
    const ledger = await db.getAll('deletions');
    expect(ledger.map((d) => `${d.kind}:${d.id}`).sort())
      .toEqual([`protocols:${protocol.id}`, 'scheduledDoses:d1'].sort());
  });
});

describe('protocol schedule regeneration', () => {
  const mixedDoses = [
    { id: 'past-logged', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-10', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'logged', weekNumber: 1 },
    { id: 'future-logged', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-20', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'logged', weekNumber: 2 },
    { id: 'past-upcoming', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-14', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
    { id: 'on-boundary', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-15', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 1 },
    { id: 'future-upcoming', protocolId: 'p1', peptideId: 'bpc-157', date: '2026-07-20', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 2 },
    { id: 'other-protocol', protocolId: 'p2', peptideId: 'bpc-157', date: '2026-07-20', time: '08:00', dose: 250, unit: 'mcg', route: 'subq', status: 'upcoming', weekNumber: 2 },
  ] as const;

  describe('deleteUpcomingDosesFrom', () => {
    it('deletes only upcoming doses on/after fromDate, leaving logged and earlier rows untouched', async () => {
      await saveScheduledDoses([...mixedDoses], 'Victor');

      await deleteUpcomingDosesFrom('p1', '2026-07-15');

      const remaining = (await getScheduledDosesForProtocol('p1')).map((d) => d.id).sort();
      expect(remaining).toEqual(['future-logged', 'past-logged', 'past-upcoming'].sort());
      expect(await getScheduledDosesForProtocol('p2')).toHaveLength(1);
    });

    it('writes a deletion-ledger entry for each row it removes, and only those rows', async () => {
      await saveScheduledDoses([...mixedDoses], 'Victor');

      await deleteUpcomingDosesFrom('p1', '2026-07-15');

      const db = await getDB();
      const ledgerIds = (await db.getAll('deletions')).map((d) => d.id).sort();
      expect(ledgerIds).toEqual(['future-upcoming', 'on-boundary'].sort());
    });
  });

  describe('deleteScheduledDosesForProtocol', () => {
    it('deletes every dose for the protocol regardless of status, leaving other protocols untouched', async () => {
      await saveScheduledDoses([...mixedDoses], 'Victor');

      await deleteScheduledDosesForProtocol('p1');

      expect(await getScheduledDosesForProtocol('p1')).toEqual([]);
      expect(await getScheduledDosesForProtocol('p2')).toHaveLength(1);
    });

    it('writes a deletion-ledger entry for every deleted dose', async () => {
      await saveScheduledDoses([...mixedDoses], 'Victor');

      await deleteScheduledDosesForProtocol('p1');

      const db = await getDB();
      const ledgerIds = (await db.getAll('deletions')).map((d) => d.id).sort();
      expect(ledgerIds).toEqual(['future-logged', 'future-upcoming', 'on-boundary', 'past-logged', 'past-upcoming'].sort());
    });
  });
});

describe('deleteDoseLog deletion ledger', () => {
  it('records the deleted log so sync can tombstone it', async () => {
    await saveVial(baseVial);
    const log = await logDose(baseLog);
    await deleteDoseLog(log.id);
    const db = await getDB();
    expect(await db.get('deletions', log.id)).toMatchObject({ kind: 'doseLogs' });
  });
});

describe('validateImport', () => {
  it('rejects a non-object payload', () => {
    expect(() => validateImport([1, 2, 3])).toThrow('Backup must be a JSON object');
  });

  it('rejects a store that is not an array', () => {
    expect(() => validateImport({ protocols: 'nope' })).toThrow('protocols must be an array');
  });

  it('rejects an entry without an id', () => {
    expect(() => validateImport({ doseLogs: [{ peptideId: 'bpc-157', date: '2026-07-15' }] }))
      .toThrow('doseLogs entry missing required field: id');
  });

  it('rejects an entry missing a required field', () => {
    expect(() => validateImport({ protocols: [{ id: 'p1', name: 'T' }] }))
      .toThrow('protocols entry missing required field: startDate');
  });

  it('rejects a numeric field holding a string, naming the field', () => {
    expect(() => validateImport({ doseLogs: [{ id: 'l1', peptideId: 'bpc-157', date: '2026-07-15', dose: 'abc' }] }))
      .toThrow('doseLogs entry has non-numeric field: dose');
  });

  it('rejects a NaN vial count', () => {
    expect(() => validateImport({ vials: [{ id: 'v1', peptideId: 'bpc-157', dosesRemaining: NaN }] }))
      .toThrow('vials entry has non-numeric field: dosesRemaining');
  });

  it('rejects a non-numeric symptom severity', () => {
    expect(() => validateImport({ doseLogs: [{ id: 'l1', peptideId: 'bpc-157', date: '2026-07-15', symptoms: [{ name: 'nausea', severity: 'bad' }] }] }))
      .toThrow('doseLogs symptoms entry has non-numeric field: severity');
  });

  it('rejects a non-numeric dose inside a protocol dose config', () => {
    expect(() => validateImport({ protocols: [{ id: 'p1', name: 'T', startDate: '2026-07-01', doses: [{ peptideId: 'bpc-157', dose: '250' }] }] }))
      .toThrow('protocols doses entry has non-numeric field: dose');
  });

  it('accepts valid numbers in numeric fields', () => {
    expect(() => validateImport({ vials: [{ id: 'v1', peptideId: 'bpc-157', amountMg: 10, bacWaterMl: 2, dosesRemaining: 20, totalDoses: 20 }] }))
      .not.toThrow();
  });

  it('accepts an entry with optional numeric fields absent', () => {
    expect(() => validateImport({ healthMarkers: [{ id: 'h1', date: '2026-07-15' }] }))
      .not.toThrow();
  });

  it('accepts a real export round trip', async () => {
    await saveVial(baseVial);
    const json = await exportAllData();
    expect(() => validateImport(JSON.parse(json))).not.toThrow();
  });
});

describe('importData', () => {
  it('rejects malformed input without touching existing state', async () => {
    await saveVial(baseVial);
    await expect(importData(JSON.stringify({ vials: [{ notEvenClose: true }] }), 'Victor')).rejects.toThrow();
    const vials = await getVials('bpc-157');
    expect(vials).toHaveLength(1);
  });

  it('stamps imported rows with a fresh updatedAt so a newer remote tombstone cannot re-delete them', async () => {
    const log = await logDose(baseLog);
    const exported = await exportAllData();
    const stale = JSON.parse(exported);
    stale.doseLogs[0].updatedAt = '2020-01-01T00:00:00.000Z';
    const before = Date.now();

    await importData(JSON.stringify(stale), 'Victor');

    const [restored] = await getAllDoseLogs();
    expect(restored.id).toBe(log.id);
    expect(Date.parse(restored.updatedAt ?? '')).toBeGreaterThanOrEqual(before);
  });

  it('assigns owner-less legacy-backup rows to the importing profile', async () => {
    const legacy = { version: 1, vials: [{ ...baseVial, id: 'v-legacy', owner: undefined, createdAt: '2026-01-01T00:00:00.000Z' }] };

    await importData(JSON.stringify(legacy), 'Nadia');

    expect((await getVials('bpc-157'))[0].owner).toBe('Nadia');
  });

  it('clears a pending deletion for a re-imported record', async () => {
    await saveVial(baseVial);
    const log = await logDose(baseLog);
    const exported = await exportAllData();
    await deleteDoseLog(log.id);

    await importData(exported, 'Victor');

    const db = await getDB();
    expect(await db.get('deletions', log.id)).toBeUndefined();
    expect((await getAllDoseLogs()).map((l) => l.id)).toEqual([log.id]);
  });

  it('rolls back every store when a later store fails mid-restore', async () => {
    const backup = {
      version: 1,
      vials: [{ ...baseVial, id: 'v-atomic', createdAt: '2026-01-01T00:00:00.000Z' }],
      healthMarkers: [{ id: 'hm-1', date: '2026-01-01', type: 'weight', value: 80, owner: 'Victor' }],
    };
    const realPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'healthMarkers') throw new Error('quota exceeded');
      return realPut.apply(this, args);
    });

    await expect(importData(JSON.stringify(backup), 'Victor')).rejects.toThrow('quota exceeded');

    vi.restoreAllMocks();
    expect(await getVials('bpc-157')).toHaveLength(0);
  });
});
