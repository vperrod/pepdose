# Cloud sync (Supabase)

pepdose syncs protocols, doses, vials, and health markers across devices via a free
Supabase project. Without the two env vars below the app stays 100% local (no login) —
exactly as before. Nothing breaks if sync is off.

**Status: configured and live (2026-07-08).** Project ref `zqoehancrvcrkzuyrtrn`. The
`records` table + Row-Level Security exist, repo secrets are set, the live build carries
the config, and email auto-confirm is on. End-to-end write/read/isolation was verified.

**Your existing data is never at risk.** Sync is a *union-merge* (`planMerge` in
`src/db/sync.ts`): it only ever copies rows between devices, never wipes a side. The first
device you sign in on pushes its data up; other devices pull it down. Newer edit wins on
conflict. Belt-and-suspenders before first sync: **More → Export/Import → Export Backup**.

## Using it (the only step left)

1. **On the device that has your data first** (e.g. your phone) → open the live site →
   **Create account** with an email + password you share → you're signed in immediately →
   it syncs your local data up.
2. On any other device → same URL → **Sign in** → your data pulls down.

Sync runs on login, on window focus, every 30s while open, and on close. Manual **Sync
now** + **Sign out** live on the Export/Import page.

## Behaviour & limits
- One shared account holds both people's data; the in-app Victor/Nadia filter separates it.
- Newer `updatedAt` wins on conflict (every in-place mutation stamps it).
- **Deletes do not propagate** across devices yet (a row deleted on one device can reappear
  from another). Deliberately-safe direction: resurrection beats data loss. Tombstones are a
  future fast-follow — the `deleted` column already exists.

## Re-provisioning from scratch (reference)

Only needed if you ever recreate the Supabase project.

1. **Create project** at https://supabase.com (free tier).
2. **Run the migrations in order**: SQL Editor → paste each file in
   `supabase/migrations/` (`0001_init.sql`, then `0002_reject_extra_signups.sql`) → Run.
   0002 enforces the single-shared-account model server-side: the first account created
   is allowed, every later signup is rejected even if the dashboard signup toggle is on.
   (Or via Management API with a personal access token:
   `POST https://api.supabase.com/v1/projects/<ref>/database/query`.)
3. **Keys**: Project Settings → API. Use the **publishable** key (`sb_publishable_…`) or the
   legacy `anon` JWT for the frontend — **never the `sb_secret_` / service-role key** (it
   bypasses RLS and would ship in the public bundle).
   The publishable/anon key is inlined into `dist/` at build time, so treat it as public: it is
   safe only because the sole table (`records`) has RLS with `auth.uid() = user_id` policies, so
   a caller without the shared login sees nothing. Keep RLS enabled on every table you add to
   `public`, and don't expose more tables/columns to the API than sync needs.
4. **Local dev**: create `.env.local` (gitignored):
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```
5. **Live site**: add the same two as GitHub repo secrets (Settings → Secrets → Actions).
   The deploy workflow already injects them at build time.
6. **Auth**: to skip the email-confirmation step, Authentication → Providers → Email → turn
   off "Confirm email" (or set `mailer_autoconfirm: true` via the Management API).

## Architecture
- `src/db/supabase.ts` — client; `cloudEnabled` is false when env vars are unset (→ local-only).
- `src/db/sync.ts` — `planMerge` (pure, unit-tested in `sync.test.ts`) + `syncNow`.
- `src/components/AuthGate.tsx` — login gate + sync triggers; wraps the app in `App.tsx`.
- `supabase/migrations/0001_init.sql` — generic `records` table (jsonb payload) + RLS policies.
- `supabase/migrations/0002_reject_extra_signups.sql` — `auth.users` trigger rejecting every
  signup after the first account (server-side enforcement of the single shared account).

**Known limitation:** security rests on one shared password, not two accounts — if it leaks,
both people's data is exposed with no per-user recovery path. Rotate the shared password
periodically; moving to per-user auth is a future option, not currently planned.
