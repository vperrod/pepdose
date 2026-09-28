import type { UserName } from '../data/users';

// This is the entire boundary between Victor's and Nadia's data. Supabase RLS
// only isolates this account from other accounts (both profiles share one
// login, so `auth.uid()` is identical) — nothing server-side stops a screen
// or a raw IndexedDB read from skipping this filter and leaking the other
// profile's rows, which has already happened twice. The wiring test
// (src/db/ownerFilterWiring.test.ts) enforces that every owner-bearing read
// calls this, but that is a scan, not a guarantee. A real fix needs separate
// logins per profile plus a `user_id` backfill (see CLAUDE.md) — a data-model
// change, not a patch to this file.
export type ViewFilter = 'all' | UserName;

export function filterByOwner<T extends { owner: UserName }>(items: T[], filter: ViewFilter): T[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.owner === filter);
}
