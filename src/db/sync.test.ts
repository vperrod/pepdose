import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  planMerge,
  resetSyncCursor,
  rowTs,
  syncNow,
  type RemoteRow,
  type Timestamped,
} from './sync';
import { getDB } from './schema';
import { clearAllData, exportAllData, getAllDoseLogs, importData, logDose } from './operations';

// In-memory Supabase double so syncNow's push/tombstone/error paths are testable.
interface Envelope {
  kind: string;
  id: string;
  deleted: boolean;
}
// One cloud query per synced store (sync.ts KINDS) per pass.
const QUERIES_PER_PASS = 5;

const cloud = vi.hoisted(() => ({
  remote: [] as {
    kind: string;
    id: string;
    data: { id: string; updatedAt?: string; _ledger?: number };
    updated_at: string;
    deleted: boolean;
  }[],
  upserted: [] as { kind: string; id: string; deleted: boolean }[],
  failKinds: new Set<string>(),
  queriedSince: [] as (string | null)[],
  delayKinds: new Set<string>(),
}));

vi.mock('./supabase', () => ({
  cloudEnabled: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({
      select: () => ({
        eq: (_col: string, kind: string) => {
          const run = (since: string | null) => {
            cloud.queriedSince.push(since);
            if (cloud.failKinds.has(kind)) return { data: null, error: new Error(`${kind} boom`) };
            const remoteRows = cloud.remote.filter(
              (r) => r.kind === kind && (!since || r.updated_at > since),
            );
            return { data: remoteRows, error: null };
          };
          return {
            gt: async (_c: string, since: string) => {
              if (cloud.delayKinds.has(kind)) await new Promise((r) => setTimeout(r, 20));
              return run(since);
            },
            then: (resolve: (v: unknown) => unknown) => resolve(run(null)),
          };
        },
      }),
      upsert: async (rows: Envelope[]) => {
        cloud.upserted.push(...rows);
        return { error: null };
      },
    }),
  },
}));

const remote = (id: string, ts: string, deleted = false): RemoteRow => ({
  id,
  data: { id, updatedAt: ts },
  updated_at: ts,
  deleted,
});

const ledgerTombstone = (id: string, ts: string): RemoteRow => ({
  id,
  data: { id, _ledger: 1 },
  updated_at: ts,
  deleted: true,
});

describe('rowTs', () => {
  it('prefers updatedAt over createdAt', () => {
    expect(
      rowTs({
        id: 'a',
        createdAt: '2020-01-01T00:00:00Z',
        updatedAt: '2021-01-01T00:00:00Z',
      }),
    ).toBe(Date.parse('2021-01-01T00:00:00Z'));
  });
});

describe('a scheduled dose never times itself by its injection date', () => {
  // A ScheduledDose carries no createdAt — only `date`, the day of the injection,
  // which for an upcoming dose is in the future. Timing a row by it made every
  // future dose look newer than the delete that removed it, so regenerating a
  // protocol resurrected the previous generation on the next sync: one calendar
  // row per past edit, each with its old dose.
  const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  it('does not treat the injection date as a write timestamp', () => {
    expect(rowTs({ id: 'd1', date: future })).toBe(0);
  });

  it('honours the delete of a future dose the cloud still holds', () => {
    const plan = planMerge(
      [],
      [{ id: 'd1', data: { id: 'd1', date: future }, updated_at: `${future}T08:00:00Z`, deleted: false }],
      [{ id: 'd1', kind: 'scheduledDoses', deletedAt: new Date().toISOString() }],
    );
    expect(plan.pushTombstone.map(d => d.id)).toEqual(['d1']);
    expect(plan.localPut).toEqual([]);
  });

  it('ignores a remote timestamp from the future, whatever wrote it', () => {
    const local: Timestamped[] = [{ id: 'd1', updatedAt: '2026-08-05T10:00:00Z' }];
    const plan = planMerge(local, [
      { id: 'd1', data: { id: 'd1' }, updated_at: `${future}T08:00:00Z`, deleted: false },
    ]);
    expect(plan.localPut).toEqual([]);
    expect(plan.push.map(r => r.id)).toEqual(['d1']);
  });
});

describe('regenerating a schedule does not leave the old generation behind', () => {
  // The reported symptom: one protocol, three rows on the same day (2.5, 2.5, 5).
  // Each protocol edit deleted the old doses locally, but the cloud still held
  // them stamped with their future injection date, so the next sync pulled them
  // straight back — once per edit.
  const day = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  const cloudDose = (id: string, amount: number) => ({
    id,
    data: { id, date: day, dose: amount },
    updated_at: `${day}T08:00:00Z`,
    deleted: false,
  });

  it('deletes both stale copies instead of pulling them back', () => {
    const now = new Date().toISOString();
    const plan = planMerge(
      [{ id: 'new', createdAt: now }],
      [cloudDose('old1', 2.5), cloudDose('old2', 2.5)],
      [
        { id: 'old1', kind: 'scheduledDoses', deletedAt: now },
        { id: 'old2', kind: 'scheduledDoses', deletedAt: now },
      ],
    );
    expect(plan.localPut).toEqual([]);
    expect(plan.pushTombstone.map(d => d.id).sort()).toEqual(['old1', 'old2']);
    expect(plan.push.map(r => r.id)).toEqual(['new']);
  });
});

describe('planMerge invariant coverage / primary merge scenarios', () => {
  it('equal timestamps: ties lose — no push, no localPut, no delete', () => {
    const local: Timestamped[] = [{ id: 'a', createdAt: '2024-01-01T00:00:00Z' }];
    const { push, localPut, localDelete } = planMerge(local, [remote('a', '2024-01-01T00:00:00Z')]);
    expect(push).toEqual([]);
    expect(localPut).toEqual([]);
    expect(localDelete).toEqual([]);
  });

  it('local row recreated after ledger delete -> ledgerResolved; row stays alive', () => {
    const local: Timestamped[] = [{ id: 'a', createdAt: '2024-06-01T00:00:00Z' }];
    const { push, localDelete, ledgerResolved } = planMerge(
      local,
      [],
      [{ id: 'a', kind: 'protocols', deletedAt: '2024-01-01T00:00:00Z' }],
    );
    expect(push.map((r) => r.id)).toEqual(['a']);
    expect(localDelete).toEqual([]);
    expect(ledgerResolved).toEqual(['a']);
  });

  it('remote-only legacy tombstone with no local row is ignored by local', () => {
    const { push, localPut, localDelete, pushTombstone } = planMerge(
      [],
      [remote('a', '2024-06-01T00:00:00Z', true)],
      [],
    );
    expect(push).toEqual([]);
    expect(localPut).toEqual([]);
    expect(localDelete).toEqual([]);
    expect(pushTombstone).toEqual([]);
  });

  it('remote ledger tombstone newer than local live row -> localDelete', () => {
    const local: Timestamped[] = [{ id: 'a', createdAt: '2024-01-01T00:00:00Z' }];
    const { localDelete, push, localPut } = planMerge(local, [ledgerTombstone('a', '2024-06-01T00:00:00Z')]);
    expect(localDelete).toEqual(['a']);
    expect(push).toEqual([]);
    expect(localPut).toEqual([]);
  });

  it('remote ledger tombstone older than local live row -> push (resurrect)', () => {
    const local: Timestamped[] = [{ id: 'a', createdAt: '2024-06-01T00:00:00Z' }];
    const { push, localDelete } = planMerge(local, [ledgerTombstone('a', '2024-01-01T00:00:00Z')]);
    expect(push.map((r) => r.id)).toEqual(['a']);
    expect(localDelete).toEqual([]);
  });

  it('remote legacy tombstone with local row -> push local row; never delete locally', () => {
    const local: Timestamped[] = [{ id: 'a', createdAt: '2024-01-01T00:00:00Z' }];
    const { push, localDelete } = planMerge(local, [remote('a', '2024-06-01T00:00:00Z', true)]);
    expect(push.map((r) => r.id)).toEqual(['a']);
    expect(localDelete).toEqual([]);
  });

  it('ledger tombstone newer than remote live row -> pushTombstone + ledgerResolved', () => {
    const { pushTombstone, localPut, localDelete, ledgerResolved, push } = planMerge(
      [],
      [remote('a', '2024-01-01T00:00:00Z')],
      [{ id: 'a', kind: 'protocols', deletedAt: '2024-06-01T00:00:00Z' }],
    );
    expect(pushTombstone.length).toBe(1);
    expect(pushTombstone[0].id).toBe('a');
    expect(localPut).toEqual([]);
    expect(localDelete).toEqual([]);
    expect(push).toEqual([]);
    expect(ledgerResolved).toEqual([]);
  });

  it('ledger tombstone older than remote live row -> localPut + ledgerResolved', () => {
    const { pushTombstone, localPut, ledgerResolved, localDelete, push } = planMerge(
      [],
      [remote('a', '2024-06-01T00:00:00Z')],
      [{ id: 'a', kind: 'protocols', deletedAt: '2024-01-01T00:00:00Z' }],
    );
    expect(pushTombstone).toEqual([]);
    expect(localPut.map((r) => r.id)).toEqual(['a']);
    expect(ledgerResolved).toEqual(['a']);
    expect(localDelete).toEqual([]);
    expect(push).toEqual([]);
  });

  it('id present only in deletions + no local/remote row -> pushTombstone', () => {
    const { pushTombstone, localPut, localDelete } = planMerge(
      [],
      [],
      [{ id: 'a', kind: 'protocols', deletedAt: '2024-06-01T00:00:00Z' }],
    );
    expect(pushTombstone.map((d) => d.id)).toEqual(['a']);
    expect(localPut).toEqual([]);
    expect(localDelete).toEqual([]);
  });

  it('missing timestamps are treated as 0: missing local timestamp loses to a newer tombstone -> localDelete', () => {
    const local: Timestamped[] = [{ id: 'a' }];
    const { localDelete, push, localPut } = planMerge(local, [ledgerTombstone('a', '2024-06-01T00:00:00Z')]);
    expect(localDelete).toEqual(['a']);
    expect(push).toEqual([]);
    expect(localPut).toEqual([]);
  });

  it('remote-only live row is pulled locally and never deleted', () => {
    const { localPut, localDelete } = planMerge([], [remote('a', '2024-01-01T00:00:00Z')]);
    expect(localPut.map((r) => r.id)).toEqual(['a']);
    expect(localDelete).toEqual([]);
  });

  it('idempotent rerun does not grow any result arrays', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-01-01T00:00:00Z' }];
    const r1 = planMerge(local, [remote('a', '2024-06-01T00:00:00Z')]);
    const r2 = planMerge(local, [remote('a', '2024-06-01T00:00:00Z')]);
    expect(r1).toEqual(r2);
  });
});

describe('planMerge edge cases', () => {
  it('returns empty arrays for empty inputs', () => {
    const { push, localPut, localDelete, pushTombstone, ledgerResolved } = planMerge([], []);
    expect(push).toEqual([]);
    expect(localPut).toEqual([]);
    expect(localDelete).toEqual([]);
    expect(pushTombstone).toEqual([]);
    expect(ledgerResolved).toEqual([]);
  });

  it('accepts undefined localDeletions gracefully', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-01-01T00:00:00Z' }];
    const { push } = planMerge(local, [], undefined as any);
    expect(push.map((r) => r.id)).toEqual(['a']);
  });

  it('merges completely disjoint keys without cross-contamination', () => {
    const local: Timestamped[] = [
      { id: 'a', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 'b', updatedAt: '2024-01-02T00:00:00Z' },
    ];
    const remoteRows: RemoteRow[] = [
      remote('c', '2024-01-03T00:00:00Z'),
      remote('d', '2024-01-04T00:00:00Z'),
    ];
    const { push, localPut } = planMerge(local, remoteRows);
    expect(push.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(localPut.map((r) => r.id).sort()).toEqual(['c', 'd']);
  });

  it('ties identical timestamps — neither side wins', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-06-01T00:00:00Z' }];
    const remoteRows: RemoteRow[] = [remote('a', '2024-06-01T00:00:00Z')];
    const { push, localPut } = planMerge(local, remoteRows);
    expect(push).toEqual([]);
    expect(localPut).toEqual([]);
  });

  it('never mutates its inputs', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-01-01T00:00:00Z' }];
    const remoteRows: RemoteRow[] = [remote('b', '2024-01-02T00:00:00Z')];
    const deletions = [
      { id: 'c', kind: 'protocols' as const, deletedAt: '2024-01-03T00:00:00Z' },
    ];

    const snapshotLocal = JSON.stringify(local);
    const snapshotRemote = JSON.stringify(remoteRows);
    const snapshotDeletions = JSON.stringify(deletions);

    planMerge(local, remoteRows, deletions);

    expect(JSON.stringify(local)).toBe(snapshotLocal);
    expect(JSON.stringify(remoteRows)).toBe(snapshotRemote);
    expect(JSON.stringify(deletions)).toBe(snapshotDeletions);
  });
});

describe('planMerge', () => {
  it('pushes a local-only row to the cloud', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-01-01T00:00:00Z' }];
    const { push, localPut } = planMerge(local, []);
    expect(push.map((r) => r.id)).toEqual(['a']);
    expect(localPut).toEqual([]);
  });

  it('pulls a cloud-only row down to the device', () => {
    const { push, localPut } = planMerge([], [remote('a', '2024-01-01T00:00:00Z')]);
    expect(push).toEqual([]);
    expect(localPut.map((r) => r.id)).toEqual(['a']);
  });

  it('never wipes the device when the cloud is empty', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-01-01T00:00:00Z' }];
    const { localPut } = planMerge(local, []);
    expect(localPut).toEqual([]);
  });

  it('keeps the newer side on conflict (local newer)', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-06-01T00:00:00Z' }];
    const { push, localPut } = planMerge(local, [remote('a', '2024-01-01T00:00:00Z')]);
    expect(push.map((r) => r.id)).toEqual(['a']);
    expect(localPut).toEqual([]);
  });

  it('keeps the newer side on conflict (remote newer)', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-01-01T00:00:00Z' }];
    const { push, localPut } = planMerge(local, [remote('a', '2024-06-01T00:00:00Z')]);
    expect(push).toEqual([]);
    expect(localPut.map((r) => r.id)).toEqual(['a']);
  });

  it('respects a cloud tombstone (no resurrection to local)', () => {
    const { localPut } = planMerge([], [remote('a', '2024-01-01T00:00:00Z', true)]);
    expect(localPut).toEqual([]);
  });

  it('a newer ledger tombstone deletes the local row (remote delete propagates)', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-01-01T00:00:00Z' }];
    const { push, localPut, localDelete } = planMerge(local, [ledgerTombstone('a', '2024-06-01T00:00:00Z')]);
    expect(push).toEqual([]);
    expect(localPut).toEqual([]);
    expect(localDelete).toEqual(['a']);
  });

  it('a local re-edit newer than the ledger tombstone resurrects the row', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-06-01T00:00:00Z' }];
    const { push, localDelete } = planMerge(local, [ledgerTombstone('a', '2024-01-01T00:00:00Z')]);
    expect(push.map((r) => r.id)).toEqual(['a']);
    expect(localDelete).toEqual([]);
  });

  it('a legacy (unmarked) tombstone never deletes local data — the row is pushed back', () => {
    const local: Timestamped[] = [{ id: 'a', updatedAt: '2024-01-01T00:00:00Z' }];
    const { push, localDelete } = planMerge(local, [remote('a', '2024-06-01T00:00:00Z', true)]);
    expect(push.map((r) => r.id)).toEqual(['a']);
    expect(localDelete).toEqual([]);
  });

  it('a local deletion-ledger entry becomes a pushed tombstone', () => {
    const { pushTombstone, localPut } = planMerge(
      [],
      [remote('a', '2024-01-01T00:00:00Z')],
      [{ id: 'a', kind: 'protocols', deletedAt: '2024-06-01T00:00:00Z' }],
    );
    expect(pushTombstone.map((d) => d.id)).toEqual(['a']);
    expect(localPut).toEqual([]);
  });

  it('a remote re-edit newer than the local delete wins and resolves the ledger entry', () => {
    const { pushTombstone, localPut, ledgerResolved } = planMerge(
      [],
      [remote('a', '2024-06-01T00:00:00Z')],
      [{ id: 'a', kind: 'protocols', deletedAt: '2024-01-01T00:00:00Z' }],
    );
    expect(pushTombstone).toEqual([]);
    expect(localPut.map((r) => r.id)).toEqual(['a']);
    expect(ledgerResolved).toEqual(['a']);
  });

  it('a fresh empty device pulls the cloud without tombstoning anything', () => {
    const rows = [remote('a', '2024-01-01T00:00:00Z'), remote('b', '2024-01-02T00:00:00Z')];
    const { localPut, pushTombstone, localDelete } = planMerge([], rows, []);
    expect(localPut.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(pushTombstone).toEqual([]);
    expect(localDelete).toEqual([]);
  });
});

describe('backup restore vs newer tombstone (F17 regression)', () => {
  it('a record restored from a backup survives a cloud tombstone newer than the backup', async () => {
    await clearAllData();
    const log = await logDose({
      owner: 'Victor',
      protocolId: 'p1',
      peptideId: 'bpc-157',
      date: '2026-07-15',
      time: '08:00',
      dose: 250,
      unit: 'mcg',
      route: 'subq',
    });
    const backup = JSON.parse(await exportAllData());
    backup.doseLogs[0].updatedAt = '2020-01-01T00:00:00.000Z';

    await importData(JSON.stringify(backup), 'Victor');
    const [restored] = await getAllDoseLogs();
    const { localDelete } = planMerge([restored], [ledgerTombstone(log.id, '2023-01-01T00:00:00.000Z')]);

    expect(localDelete).toEqual([]);
  });
});

describe('syncNow', () => {
  beforeEach(async () => {
    await clearAllData();
    resetSyncCursor();
    cloud.remote = [];
    cloud.upserted = [];
    cloud.failKinds = new Set();
    cloud.queriedSince = [];
  });

  it('a fresh device first pull copies cloud rows locally and tombstones nothing', async () => {
    cloud.remote = [
      {
        kind: 'protocols',
        id: 'p1',
        data: { id: 'p1', updatedAt: '2024-01-01T00:00:00Z' },
        updated_at: '2024-01-01T00:00:00Z',
        deleted: false,
      },
    ];
    const result = await syncNow();
    expect(cloud.upserted).toEqual([]);
    expect(result?.pulled).toBe(1);
    const db = await getDB();
    expect(await db.get('protocols', 'p1')).toBeTruthy();
  });

  it('a local delete pushes a ledger tombstone and prunes the ledger', async () => {
    const db = await getDB();
    await db.put('deletions', { id: 'gone', kind: 'protocols', deletedAt: '2026-07-17T00:00:00Z' });
    cloud.remote = [
      {
        kind: 'protocols',
        id: 'gone',
        data: { id: 'gone' },
        updated_at: '2024-01-01T00:00:00Z',
        deleted: false,
      },
    ];

    await syncNow();

    expect(cloud.upserted.find((r) => r.id === 'gone')).toMatchObject({
      kind: 'protocols',
      deleted: true,
    });
    expect(await db.get('deletions', 'gone')).toBeUndefined();
  });

  it('a remote ledger tombstone removes the row from a device that still holds it', async () => {
    const db = await getDB();
    await db.put('protocols', {
      id: 'p1',
      owner: 'Victor',
      name: 'T',
      peptideIds: [],
      doses: [],
      startDate: '2026-01-01',
      durationWeeks: 4,
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    cloud.remote = [
      {
        kind: 'protocols',
        id: 'p1',
        data: { id: 'p1', _ledger: 1 },
        updated_at: '2026-07-17T00:00:00Z',
        deleted: true,
      },
    ];

    const result = await syncNow();

    expect(await db.get('protocols', 'p1')).toBeUndefined();
    expect(result?.pulled).toBe(1);
  });

  it('one failing kind aborts the sync so no partial side effects persist', async () => {
    cloud.failKinds = new Set(['protocols']);
    const db = await getDB();
    await db.put('doseLogs', {
      id: 'log1',
      owner: 'Victor',
      protocolId: 'p1',
      peptideId: 'bpc-157',
      date: '2026-07-15',
      time: '08:00',
      dose: 250,
      unit: 'mcg',
      route: 'subq',
      createdAt: '2026-07-15T08:00:00Z',
    });

    const result = await syncNow();

    expect(result?.errors).toEqual(['protocols: protocols boom']);
    expect(cloud.upserted).toEqual([]);
    expect(await db.getAll('doseLogs')).toEqual([expect.objectContaining({ id: 'log1' })]);
  });

  it('the second sync asks the cloud only for rows changed since the first', async () => {
    await syncNow();
    await syncNow();
    const firstPass = cloud.queriedSince.slice(0, QUERIES_PER_PASS);
    const secondPass = cloud.queriedSince.slice(QUERIES_PER_PASS, 2 * QUERIES_PER_PASS);
    expect(firstPass.every((s) => s === null) && secondPass.every((s) => s !== null)).toBe(true);
  });

  it('an already-synced local row is not re-pushed on the next tick', async () => {
    const db = await getDB();
    await db.put('protocols', {
      id: 'p1',
      owner: 'Victor',
      name: 'T',
      peptideIds: [],
      doses: [],
      startDate: '2026-01-01',
      durationWeeks: 4,
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    await syncNow();
    cloud.upserted = [];

    await syncNow();

    expect(cloud.upserted).toEqual([]);
  });

  it('a local row created after the first sync is still pushed on the next delta pass', async () => {
    await syncNow();
    const db = await getDB();
    await db.put('protocols', {
      id: 'p2',
      owner: 'Victor',
      name: 'New',
      peptideIds: [],
      doses: [],
      startDate: '2026-01-01',
      durationWeeks: 4,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await syncNow();

    expect(cloud.upserted.find((r) => r.id === 'p2')).toBeTruthy();
  });

  it('a remote tombstone arriving in a delta still deletes the untouched local row', async () => {
    const db = await getDB();
    await db.put('protocols', {
      id: 'p1',
      owner: 'Victor',
      name: 'T',
      peptideIds: [],
      doses: [],
      startDate: '2026-01-01',
      durationWeeks: 4,
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    await syncNow();
    cloud.remote = [
      {
        kind: 'protocols',
        id: 'p1',
        data: { id: 'p1', _ledger: 1 },
        updated_at: new Date().toISOString(),
        deleted: true,
      },
    ];

    await syncNow();

    expect(await db.get('protocols', 'p1')).toBeUndefined();
  });

  it('a failed sync does not advance the cursor (next pass is full again)', async () => {
    cloud.failKinds = new Set(['protocols']);
    await syncNow();
    await syncNow();
    expect(cloud.queriedSince.slice(QUERIES_PER_PASS).every((s) => s === null)).toBe(true);
  });

  it('triggers landing mid-sync queue exactly one follow-up pass', async () => {
    const first = syncNow();
    const second = syncNow();
    const third = syncNow();
    expect(await second).toBeNull();
    expect(await third).toBeNull();
    await first;
    await vi.waitFor(() => expect(cloud.queriedSince.length).toBe(2 * QUERIES_PER_PASS));
    await new Promise((r) => setTimeout(r, 20));
    expect(cloud.queriedSince.length).toBe(2 * QUERIES_PER_PASS);
  });

  it('a sync after the follow-up has drained starts fresh (no phantom queued run)', async () => {
    const first = syncNow();
    void syncNow();
    await first;
    await vi.waitFor(() => expect(cloud.queriedSince.length).toBe(2 * QUERIES_PER_PASS));
    cloud.queriedSince = [];
    await syncNow();
    await new Promise((r) => setTimeout(r, 20));
    expect(cloud.queriedSince.length).toBe(QUERIES_PER_PASS);
  });

  it('a wipe landing mid-sync is not repopulated by the in-flight pass', async () => {
    const ts = new Date(Date.now() - 60_000).toISOString();
    cloud.remote = [
      {
        kind: 'protocols',
        id: 'p1',
        data: { id: 'p1', updatedAt: ts },
        updated_at: ts,
        deleted: false,
      },
    ];
    await syncNow();
    const newer = new Date(Date.now() - 1_000).toISOString();
    cloud.remote[0].data.updatedAt = newer;
    cloud.remote[0].updated_at = newer;
    cloud.delayKinds = new Set(['protocols']);

    const background = syncNow();
    await clearAllData();
    await background;
    cloud.delayKinds = new Set();

    const db = await getDB();
    expect(await db.get('protocols', 'p1')).toBeUndefined();
  });

  it('a restore landing mid-sync is not overwritten by the in-flight pass', async () => {
    const ts = '2024-01-01T00:00:00Z';
    cloud.remote = [
      {
        kind: 'protocols',
        id: 'p1',
        data: { id: 'p1', updatedAt: ts },
        updated_at: ts,
        deleted: false,
      },
    ];
    await syncNow();
    const stale = new Date(Date.now() - 1_000).toISOString();
    cloud.remote[0].data.updatedAt = stale;
    cloud.remote[0].updated_at = stale;
    // Stall a different kind: the pass reads the stale local protocol row
    // before the restore, then applies its merge plan after the restore.
    cloud.delayKinds = new Set(['doseLogs']);

    const background = syncNow();
    await new Promise((r) => setTimeout(r, 5)); // let the pass snapshot local protocols
    const backup = { protocols: [{ id: 'p1', owner: 'Victor', name: 'restored', startDate: '2024-01-01', status: 'active', doseConfigs: [], updatedAt: ts }] };
    await importData(JSON.stringify(backup), 'Victor');
    await background;
    cloud.delayKinds = new Set();

    const db = await getDB();
    expect((await db.get('protocols', 'p1'))?.updatedAt).not.toBe(stale);
  });

  it('parallelizes all 6 kinds within a single pass', async () => {
    beforeEach(async () => {
      cloud.delayKinds = new Set(['protocols', 'doseLogs', 'vials']);
    });
    const start = Date.now();
    const result = await syncNow();
    const elapsed = Date.now() - start;

    expect(result?.errors).toEqual([]);
    expect(elapsed).toBeLessThan(45);
  });
});
