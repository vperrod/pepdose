import { getDB, type DeletionRecord } from './schema';
import { supabase, cloudEnabled } from './supabase';

// Cloud sync: bidirectional union-merge between local IndexedDB and Supabase.
//
// Safety invariant (Victor's #1 requirement): sync NEVER destructively wipes a
// side. A row present on only one side is copied to the other — never deleted.
// When both sides have a row, the newer `updatedAt`/`createdAt` wins (LWW).
// So logging in on an empty device can never erase the device that has the data.
//
// Deletes are explicit, never inferred from absence: every local delete writes a
// `deletions` ledger entry (db/schema.ts DeletionRecord), which syncNow pushes as
// a `deleted: true` tombstone and then prunes. Remote tombstones written by
// ledger-aware clients (marked `data._ledger`) delete the local row when newer
// (a later local re-edit still wins, LWW). Legacy tombstones — created by the old
// absence heuristic, which wrongly tombstoned the whole cloud on a fresh device's
// first pull — carry no marker and are never allowed to delete local data;
// instead the surviving local row is pushed back, repairing the cloud.

const KINDS = ['protocols', 'scheduledDoses', 'doseLogs', 'vials', 'healthMarkers'] as const;

export interface Timestamped {
  id: string;
  updatedAt?: string;
  createdAt?: string;
  /** The day an injection happens — carried by scheduled doses. NOT a write
   *  time: for an upcoming dose it lies in the future. Never merge on it. */
  date?: string;
}

export interface RemoteRow {
  id: string;
  data: Timestamped & { _ledger?: number };
  updated_at: string;
  deleted: boolean;
}

export function rowTs(row: Timestamped): number {
  const raw = row.updatedAt ?? row.createdAt;
  const n = raw ? Date.parse(raw) : 0;
  return Number.isNaN(n) ? 0 : n;
}

/** When the cloud says a row was written. A stamp in the future can only come
 *  from the old bug that timed scheduled doses by their injection date, and it
 *  would outrank every real edit and every delete — so it counts for nothing. */
export function remoteTs(row: RemoteRow): number {
  const n = Date.parse(row.updated_at);
  return Number.isNaN(n) || n > Date.now() ? 0 : n;
}

/** Pure union-merge decision for one record kind. Never drops a live row from
 *  either side on its own authority — local deletes only happen for a remote
 *  tombstone written by a ledger-aware client (`data._ledger`) that is newer
 *  than the local row. `push` = local rows the cloud should take; `localPut` =
 *  cloud rows the device should take; `localDelete` = local ids a newer remote
 *  tombstone removes; `pushTombstone` = ledger entries to publish as tombstones;
 *  `ledgerResolved` = ledger ids settled without a push (remote re-edit won or
 *  tombstone already in cloud). */
export function planMerge(
  localRows: Timestamped[],
  remoteRows: RemoteRow[],
  localDeletions: DeletionRecord[] = [],
): {
  push: Timestamped[];
  localPut: Timestamped[];
  localDelete: string[];
  pushTombstone: DeletionRecord[];
  ledgerResolved: string[];
} {
  const local = new Map(localRows.map((r) => [r.id, r]));
  const remote = new Map(remoteRows.map((r) => [r.id, r]));
  const ledger = new Map(localDeletions.map((d) => [d.id, d]));
  const ids = new Set<string>([...local.keys(), ...remote.keys(), ...ledger.keys()]);

  const push: Timestamped[] = [];
  const localPut: Timestamped[] = [];
  const localDelete: string[] = [];
  const pushTombstone: DeletionRecord[] = [];
  const ledgerResolved: string[] = [];

  for (const id of ids) {
    const l = local.get(id);
    const r = remote.get(id);
    const d = ledger.get(id);
    const lts = l ? rowTs(l) : -1;
    const rts = r ? remoteTs(r) : -1;

    if (l && d) {
      // Row re-created locally after a delete — it's alive; drop the stale entry.
      ledgerResolved.push(id);
    }

    if (l && !r) {
      push.push(l);
    } else if (r && !l) {
      if (r.deleted) {
        if (d) ledgerResolved.push(id); // tombstone already in the cloud
      } else if (d) {
        if (Date.parse(d.deletedAt) > rts) pushTombstone.push(d);
        else { localPut.push(r.data); ledgerResolved.push(id); } // remote re-edit wins
      } else {
        localPut.push(r.data);
      }
    } else if (l && r) {
      if (r.deleted) {
        if (!r.data?._ledger) push.push(l); // legacy tombstone: never delete local — repair cloud
        else if (rts > lts) localDelete.push(id);
        else push.push(l); // local re-edit newer than the delete: resurrect
      } else if (lts > rts) {
        push.push(l);
      } else if (rts > lts) {
        localPut.push(r.data);
      }
    } else if (d) {
      // Deleted here, cloud never saw the row — publish the intent anyway.
      pushTombstone.push(d);
    }
  }

  return { push, localPut, localDelete, pushTombstone, ledgerResolved };
}

let running = false;
// A trigger landing mid-sync (focus + interval firing together) must not be
// dropped — changes made while the pass was in flight would wait for the next
// tick. Remember exactly one follow-up pass; concurrent triggers coalesce.
let queuedFollowUp = false;

// Resolves once no pass (nor its queued follow-up) is in flight. A caller that
// wipes local data has to await this: a background pass that started before the
// wipe still writes pulled rows afterwards, silently resurrecting the data.
let idlePromise: Promise<void> | null = null;
let resolveIdle: (() => void) | null = null;

let suspended = false;

/** Block new sync passes and wait for any in-flight one to finish writing.
 *  Returns the resume function. Used by clearAllData(): awaiting the current
 *  pass is not enough on its own — a background trigger firing during the wipe
 *  would pull the same rows straight back. */
export async function suspendSync(): Promise<() => void> {
  suspended = true;
  while (idlePromise) await idlePromise;
  return () => { suspended = false; };
}

// Delta cursor: after a successful pass, later ticks fetch only remote rows with
// updated_at newer than the last sync (minus a clock-skew margin, since
// updated_at is stamped by whichever client pushed the row) and only consider
// local rows edited since then — plus any ids the remote delta mentions, so a
// remote edit/tombstone still meets its local counterpart in planMerge. An
// offline peer can upload rows stamped older than the cursor; a periodic full
// pass (FULL_SYNC_EVERY_MS) bounds how long such rows stay unseen.
const CLOCK_SKEW_MS = 5 * 60_000;
const FULL_SYNC_EVERY_MS = 60 * 60_000;
let cursor: { userId: string; since: number; lastFull: number } | null = null;

/** Force the next syncNow to do a full pass (manual sync button; tests). */
export function resetSyncCursor() {
  cursor = null;
}

/** Merge local <-> cloud. Returns counts (plus per-kind errors, if any), or
 *  null if cloud disabled / not signed in. */
export async function syncNow(): Promise<{ pushed: number; pulled: number; errors: string[] } | null> {
  if (!cloudEnabled || !supabase || suspended) return null;
  if (running) {
    queuedFollowUp = true;
    return null;
  }

  running = true; // before the first await, so overlapping triggers queue instead of double-running
  idlePromise = new Promise<void>((resolve) => { resolveIdle = resolve; });
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return null;

    const userId = session.user.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await getDB()) as any;
    let pushed = 0;
    let pulled = 0;
    const errors: string[] = [];
    // Read in full on every pass, delta cursor or not: an entry is removed only
    // once its tombstone has actually been pushed, so a pass that errored leaves
    // entries stamped older than the cursor which still have to be retried.
    // Filtering this by the cursor would strand them forever.
    const allDeletions: DeletionRecord[] = await db.getAll('deletions');
    const started = Date.now();
    const delta =
      cursor && cursor.userId === userId && started - cursor.lastFull < FULL_SYNC_EVERY_MS
        ? cursor.since - CLOCK_SKEW_MS
        : null;

    // --- Phase 1: compute every kind's merge plan without mutating local/remote ---
    const plans = new Map<
      string,
      {
        push: Timestamped[];
        localPut: Timestamped[];
        localDelete: string[];
        pushTombstone: DeletionRecord[];
        ledgerResolved: string[];
        localTs: Map<string, number>;
      }
    >();

    // The per-kind plans are independent, so they go out together — one round
    // trip's latency instead of six, on every sync tick. Bound here because the
    // callback loses the enclosing non-null narrowing of `supabase`.
    const sb = supabase;
    await Promise.all(
      KINDS.map(async (kind) => {
        try {
          let query = sb
            .from('records')
            .select('id,data,updated_at,deleted')
            .eq('kind', kind);
          if (delta !== null) query = query.gt('updated_at', new Date(delta).toISOString());
          const { data: remoteRows, error } = await query;
          if (error) throw error;

          const remote = (remoteRows ?? []) as RemoteRow[];
          const remoteIds = new Set(remote.map((r) => r.id));

          let localRows: Timestamped[];
          if (delta === null) {
            localRows = await db.getAll(kind);
          } else {
            // Indexed range read instead of a full-table scan: only rows
            // touched since the cursor. A remote id the range doesn't cover
            // (e.g. an old, locally-untouched row a tombstone now targets)
            // still needs its local counterpart for planMerge, so those are
            // fetched by id instead of dropped.
            const recent: Timestamped[] = await db.getAllFromIndex(
              kind,
              'by-updatedAt',
              IDBKeyRange.lowerBound(new Date(delta).toISOString()),
            );
            const seen = new Set(recent.map((r) => r.id));
            const missingIds = [...remoteIds].filter((id) => !seen.has(id));
            const extra = missingIds.length
              ? (await Promise.all(missingIds.map((id) => db.get(kind, id)))).filter(
                  (r: Timestamped | undefined): r is Timestamped => r != null,
                )
              : [];
            localRows = [...recent, ...extra];
          }
          const deletions = allDeletions.filter((d) => d.kind === kind);
          plans.set(kind, {
            ...planMerge(localRows, remote, deletions),
            localTs: new Map(localRows.map((r) => [r.id, rowTs(r)])),
          });
        } catch (e) {
          const msg = `${kind}: ${e instanceof Error ? e.message : String(e)}`;
          console.error('[sync] ' + msg);
          errors.push(msg);
        }
      }),
    );

    if (errors.length) {
      return { pushed, pulled, errors };
    }

    // --- Phase 2: remote writes (pushes + tombstones). Abort the sync on first failure. ---
    for (const kind of KINDS) {
      try {
      const plan = plans.get(kind)!;
      if (plan.push.length) {
        const envelopes = plan.push.map((row) => ({
          user_id: userId,
          kind,
          id: row.id,
          data: row,
          // Never stamp the cloud with a future time — it would outrank later edits.
          updated_at: new Date(Math.min(rowTs(row) || Date.now(), Date.now())).toISOString(),
          deleted: false,
        }));
        const { error: upErr } = await supabase.from('records').upsert(envelopes);
        if (upErr) throw upErr;
        pushed += plan.push.length;
      }
      const ledgerDone = [...plan.ledgerResolved];
      if (plan.pushTombstone.length) {
        const tombstones = plan.pushTombstone.map((d) => ({
          user_id: userId,
          kind,
          id: d.id,
          data: { id: d.id, _ledger: 1 },
          updated_at: d.deletedAt,
          deleted: true,
        }));
        const { error: delErr } = await supabase.from('records').upsert(tombstones);
        if (delErr) throw delErr;
        pushed += plan.pushTombstone.length;
        ledgerDone.push(...plan.pushTombstone.map((d) => d.id));
      }
      } catch (e) {
        const msg = `${kind}: ${e instanceof Error ? e.message : String(e)}`;
        console.error('[sync] ' + msg);
        errors.push(msg);
        break;
      }
    }

    if (errors.length) {
      return { pushed, pulled, errors };
    }

    // --- Phase 3: single multi-store IDB transaction for all local mutations. ---
    const tx = db.transaction([...KINDS, 'deletions'], 'readwrite');
    const ledgerStore = tx.objectStore('deletions');
    for (const kind of KINDS) {
      const plan = plans.get(kind)!;
      const store = tx.objectStore(kind);
      // Phase 2's network round trip can take seconds; a local edit landing in
      // that window is newer than the snapshot Phase 1 planned against, so it
      // must not be overwritten. The next pass re-diffs it.
      const editedSince = async (id: string) => {
        const current = await store.get(id);
        return current != null && rowTs(current) > (plan.localTs.get(id) ?? -1);
      };
      for (const row of plan.localPut) {
        if (await editedSince(row.id)) continue;
        await store.put(row);
        pulled++;
      }
      for (const id of plan.localDelete) {
        if (await editedSince(id)) continue;
        await store.delete(id);
        pulled++;
      }
      const ledgerDone = [...plan.ledgerResolved];
      if (plan.pushTombstone.length) {
        ledgerDone.push(...plan.pushTombstone.map((d) => d.id));
      }
      for (const id of ledgerDone) {
        await ledgerStore.delete(id);
      }
    }
    await tx.done;

    if (!errors.length) {
      cursor = { userId, since: started, lastFull: delta !== null ? cursor!.lastFull : started };
    }
    return { pushed, pulled, errors };
  } finally {
    running = false;
    const done = resolveIdle;
    if (queuedFollowUp) {
      queuedFollowUp = false;
      // Installs its own idlePromise synchronously, before `done()` releases the
      // waiters, so waitForSyncIdle() spans the follow-up pass too.
      void syncNow();
    } else {
      idlePromise = null;
      resolveIdle = null;
    }
    done?.();
  }
}
