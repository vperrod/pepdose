// Two devices, each with its own IndexedDB and its own copy of the db modules,
// running the real syncNow against one shared cloud that remembers what it was sent.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface Row {
  kind: string;
  id: string;
  data: { id: string };
  updated_at: string;
  deleted: boolean;
}

const cloud = vi.hoisted(() => ({ rows: new Map<string, unknown>(), online: true }));

// Mirrors supabase/migrations: one row per (kind, id), updated_at clamped to the server clock.
vi.mock('./supabase', () => ({
  cloudEnabled: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({
      select: () => ({
        eq: (_col: string, kind: string) => {
          const query = (since: string | null) => ({
            order: () => ({
              range: async (from: number, to: number) => {
                if (!cloud.online) return { data: null, error: new Error('offline') };
                const data = ([...cloud.rows.values()] as Row[])
                  .filter((r) => r.kind === kind && (!since || Date.parse(r.updated_at) > Date.parse(since)))
                  .sort((a, b) => a.id.localeCompare(b.id))
                  .slice(from, to + 1);
                return { data: structuredClone(data), error: null };
              },
            }),
          });
          return { ...query(null), gt: (_c: string, since: string) => query(since) };
        },
      }),
      upsert: async (rows: Row[]) => {
        if (!cloud.online) return { error: new Error('offline') };
        for (const r of rows) {
          const updated_at = new Date(Math.min(Date.parse(r.updated_at), Date.now())).toISOString();
          cloud.rows.set(`${r.kind}/${r.id}`, structuredClone({ ...r, updated_at }));
        }
        return { error: null };
      },
    }),
  },
}));

async function createDevice() {
  vi.resetModules(); // fresh module instances: own DB handle, own sync cursor
  const factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
  const schema = await import('./schema');
  const ops = await import('./operations');
  const { syncNow } = await import('./sync');
  const db = await schema.getDB(); // opened while this device's factory is global
  return { db, ops, syncNow };
}

type Device = Awaited<ReturnType<typeof createDevice>>;

let phone: Device;
let laptop: Device;

const tick = () => vi.setSystemTime(Date.now() + 60_000);

const addProtocol = (device: Device) =>
  device.ops.saveProtocol({
    owner: 'Victor',
    name: 'original',
    peptideIds: [],
    doses: [],
    startDate: '2026-07-01',
    durationWeeks: 4,
    status: 'active',
  } as never);

describe('two devices syncing through one cloud', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
    cloud.rows.clear();
    cloud.online = true;
    phone = await createDevice();
    laptop = await createDevice();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('a record created on one device reaches the other', async () => {
    const { id } = await addProtocol(phone);

    await phone.syncNow();
    await laptop.syncNow();

    expect(await laptop.ops.getProtocol(id)).toEqual(await phone.ops.getProtocol(id));
  });

  it('conflicting edits converge on the later one, whichever device syncs first', async () => {
    const { id } = await addProtocol(phone);
    await phone.syncNow();
    await laptop.syncNow();

    tick();
    await phone.ops.updateProtocol(id, { name: 'earlier' });
    tick();
    await laptop.ops.updateProtocol(id, { name: 'later' });
    await laptop.syncNow();
    await phone.syncNow();
    await laptop.syncNow();

    expect([
      (await phone.ops.getProtocol(id))?.name,
      (await laptop.ops.getProtocol(id))?.name,
    ]).toEqual(['later', 'later']);
  });

  it('a delete propagates to the other device and is not resurrected by it', async () => {
    const { id } = await addProtocol(phone);
    await phone.syncNow();
    await laptop.syncNow();

    tick();
    await phone.ops.deleteProtocol(id);
    await phone.syncNow();
    await laptop.syncNow();
    await phone.syncNow();

    expect([await phone.ops.getProtocol(id), await laptop.ops.getProtocol(id)]).toEqual([undefined, undefined]);
  });

  it('a delete and a new record made offline both arrive after reconnecting', async () => {
    const old = await addProtocol(phone);
    await phone.syncNow();
    await laptop.syncNow();

    cloud.online = false;
    tick();
    await phone.ops.deleteProtocol(old.id);
    const added = await addProtocol(phone);
    await phone.syncNow();
    tick();
    cloud.online = true;
    await phone.syncNow();
    await laptop.syncNow();

    expect((await laptop.db.getAll('protocols')).map((p) => p.id)).toEqual([added.id]);
  });
});
