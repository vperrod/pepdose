import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, it, expect, beforeAll } from 'vitest';
import { getDB } from './schema';

const OWNED_STORES = ['protocols', 'scheduledDoses', 'doseLogs', 'vials', 'healthMarkers'] as const;

// Seeds the database exactly as a pre-profiles (v1) install left it: rows without
// `owner`, plus the since-removed `editHistory` store real v1 installs still carry.
async function seedV1Database() {
  const v1 = await openDB('pepdose', 1, {
    upgrade(db) {
      const protocolStore = db.createObjectStore('protocols', { keyPath: 'id' });
      protocolStore.createIndex('by-status', 'status');

      const doseStore = db.createObjectStore('scheduledDoses', { keyPath: 'id' });
      doseStore.createIndex('by-date', 'date');
      doseStore.createIndex('by-protocol', 'protocolId');
      doseStore.createIndex('by-status', 'status');
      doseStore.createIndex('by-peptide-date', ['peptideId', 'date']);

      const logStore = db.createObjectStore('doseLogs', { keyPath: 'id' });
      logStore.createIndex('by-date', 'date');
      logStore.createIndex('by-protocol', 'protocolId');
      logStore.createIndex('by-peptide', 'peptideId');

      const vialStore = db.createObjectStore('vials', { keyPath: 'id' });
      vialStore.createIndex('by-peptide', 'peptideId');
      vialStore.createIndex('by-status', 'status');

      const healthStore = db.createObjectStore('healthMarkers', { keyPath: 'id' });
      healthStore.createIndex('by-date', 'date');

      const editStore = db.createObjectStore('editHistory', { keyPath: 'id' });
      editStore.createIndex('by-protocol', 'protocolId');
    },
  });

  for (const storeName of OWNED_STORES) {
    await v1.put(storeName, { id: `${storeName}-legacy`, status: 'active', date: '2026-01-01', protocolId: 'p1', peptideId: 'bpc-157' });
  }
  // A row that already carries an owner must survive the backfill untouched.
  await v1.put('doseLogs', { id: 'doseLogs-nadia', owner: 'Nadia', date: '2026-01-02', protocolId: 'p1', peptideId: 'bpc-157' });
  v1.close();
}

describe('v1 → v2 owner backfill migration', () => {
  beforeAll(async () => {
    await seedV1Database();
    await getDB(); // opens at the latest version, running the upgrade chain
  });

  it.each(OWNED_STORES)('backfills ownerless %s rows to Victor', async (storeName) => {
    const db = await getDB();
    const row = await db.get(storeName, `${storeName}-legacy`);
    expect(row?.owner).toBe('Victor');
  });

  it('leaves rows that already have an owner untouched', async () => {
    const db = await getDB();
    const row = await db.get('doseLogs', 'doseLogs-nadia');
    expect(row?.owner).toBe('Nadia');
  });
});
