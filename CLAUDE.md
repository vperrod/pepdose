# pepdose

Peptide dose-tracking PWA: protocols, smart injection scheduling (auto-titration,
phased variants), vial tracking, body-map site logging, dose reminders, and
insights (active-levels curve, symptom trends, adherence) — stored locally
(IndexedDB) with an **optional Supabase cloud mirror** for cross-device sync.
React 19 + Vite + TypeScript + Tailwind v4 + idb + Recharts.
Live: https://claude-dev-vperrod.westeurope.cloudapp.azure.com/pepdose/ (Caddy on this VM; deploy with `scripts/deploy.sh`)

Cloud sync (optional): active only when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
are set — else fully local, no login. `src/db/supabase.ts` (client), `src/db/sync.ts`
(bidirectional union-merge, LWW, never destructive — see `planMerge`),
`src/components/AuthGate.tsx` (shared-account login gate + sync triggers). Schema +
setup: `supabase/migrations/0001_init.sql`, `docs/CLOUD_SYNC_SETUP.md`. Deletes are
explicit: every local delete writes a `deletions` ledger entry (IndexedDB store,
schema v3), which sync pushes as a `deleted: true` tombstone (marked `data._ledger`)
and prunes; marked remote tombstones delete the local row when newer (a newer
re-edit still wins). Legacy unmarked tombstones never delete local data — the
surviving row is pushed back to repair the cloud.

**RLS is not the boundary between Victor and Nadia.** Both profiles share one
Supabase login, so `auth.uid()` is identical for both and the policies only
separate this account from other accounts. Profile isolation is the client-side
`owner` field — `src/context/ownerFilter.ts`, enforced across screens by
`src/db/ownerFilterWiring.test.ts`, which fails if a screen reads an
owner-bearing collection without filtering. Two real leaks came from exactly
that omission. A DB-level fix means one login per profile plus a `user_id`
backfill from `data->>'owner'`; that is a data-model decision, not a patch.

## Commands

```bash
npm install
npm run build        # tsc -b && vite build → dist/  (this is what CI gates on)
npm test             # vitest — must pass before push
npm run test:e2e     # headless-Chromium smoke of core user journeys (scripts/e2e-smoke.mjs);
                     # full manual scenario catalog: docs/USER-TESTING.md
npm run dev          # http://localhost:5173
npm run lint         # eslint — repo has pre-existing errors; don't add new ones
```

## Architecture

- **`src/`** — React app; scheduling engine (`utils/scheduleEngine.ts`) generates
  every injection from a protocol (titration ladders, phased schedules,
  weekday-only cadence, scheduled off-week "breaks") and regenerates safely on
  edit (preserves logged/skipped/missed doses). A titration ladder is **scaled
  to the user's chosen start dose** — the dose field defaults to the ladder's
  first step, and typing a different value shifts the whole ladder
  proportionally (see `getTitrationDose`), so a user can start e.g.
  Retatrutide at 0.5mg.
  - **`weekly_days` frequency** (`FrequencyType` in `data/peptides.ts`): explicit
    weekday selection (`daysOfWeek: number[]`, 0=Sun..6=Sat) for both flat dose
    configs and phased-protocol phases (`SchedulePhase.daysOfWeek`). Calendar-
    aligned by construction — picking Mon+Thu always yields exactly 2 doses every
    week, no drift. Added after a user-reported bug: the only prior way to
    approximate "N times a week" was the `custom` every-N-days interval, which
    drifts against calendar weeks whenever N doesn't evenly divide 7 (every 3
    days gives a repeating 3/2/2-per-week pattern, not a steady 2). UI:
    `components/WeekdayPicker.tsx`, wired into both `NewProtocol.tsx` and the
    `Protocols.tsx` edit sheet next to the Frequency dropdown.
  - **Protocol variants** (`data/peptides.ts` → `DosingProtocol.protocolVariants`):
    each peptide can declare multiple named, phased protocol variants (e.g.
    Retatrutide: clinical-trial ladder vs community 8-on/8-off vs microdose
    maintenance). `selectTemplate` honors the template's declared `variantId`
    (fixed a bug where it always applied `protocolVariants[0]` regardless —
    picking the "NAD+ Steady 100mg" template silently loaded "Start Low & Slow"
    instead); `applyVariant`/`applyVariantEdit` set the chosen variant's phases
    as the dose config's `schedulePhases` and override the dose. The schedule
    engine reads `schedulePhases` to emit the correct cadence per week.
    The "Protocol" dropdown on both screens also offers **"Custom (set your own
    schedule)"** — since `isPhased` (does this peptide have variants at all) is
    peptide-level, without this escape hatch any peptide with canned variants
    (NAD+, MOTS-c, Retatrutide, GHK-Cu, GLOW-blend, Melanotan-2) could never
    reach the flat Frequency/day-picker controls. Picking it clears
    `schedulePhases`/`variantId` and defaults to `weekly_days`; gating in the
    JSX uses a per-config `usingVariant = !!schedulePhases?.length` check, not
    the peptide-level `isPhased` flag, so users can freely switch back and forth.
  - **Breaks** (`data/protocols.ts` → `ProtocolTemplate.breaks`, `db/schema.ts` →
    `UserProtocol.breaks`): explicit off-week ranges (`{ weekStart, weekEnd,
    reason }`) where no doses are generated. Templates with break-aware cycling
    (e.g. Retatrutide 8-on/8-off, NAD+ 4-on/2-off, MT2 2-on/4-off) pre-fill these.
    The schedule engine (`utils/scheduleEngine.ts`) skips dose generation during
    break weeks across all frequency paths (daily, EOD, weekly, biweekly, custom,
    and phased). The calendar month grid renders a purple diagonal hatch on
    break-week days with a tooltip; the Protocol Timeline Gantt distinguishes
    break weeks (purple hatch) from regular off-week days (gray hatch).
- Storage: IndexedDB via `idb` (`db/schema.ts` + `db/operations.ts`) — no backend,
  no accounts; data never leaves the device. Supports two users/profiles. Logging
  a dose decrements the peptide's active vial; deleting a log restores it.
- Charts/insights (Recharts, date-fns), each driven by a **pure, unit-tested**
  helper:
  - `utils/activeLevels.ts` → "Active Levels" (`HalfLife.tsx`): estimated
    in-system level from logged doses, projected forward through upcoming
    scheduled doses.
  - `utils/symptomTrends.ts` + `data/symptoms.ts` → "Symptoms" (`Symptoms.tsx`):
    per-dose symptoms (`DoseLog.symptoms`, 1–10 severity) charted with titration
    step-up markers.
  - `utils/adherence.ts` → Dashboard streak + weekly ratio.
  - `utils/injectionStats.ts` → injection-map zone volume; `utils/titrationCoach.ts`
    → next step-up hint.
- Reminders (`utils/notifications.ts`): timezone-aware (via pure `utils/tz.ts` +
  `settings.timezone`, DST-correct). Where the Notification Triggers API is available
  (`TimestampTrigger`), reminders are armed to fire even when the app is fully closed;
  otherwise they fall back to in-page timers fired through the service worker
  (`public/sw.js` `showNotification`), deduped per day. `triggeredNotificationsSupported()`
  gates the capability.
- Calendar (`pages/Calendar.tsx`): month grid (per-peptide color strip, colored by
  pen colour — see below) with a Month/Timeline toggle. No category legend; each
  dose's dot/strip is the pen colour assigned to that peptide in its protocol, via
  `penColorHex()`, falling back to neutral gray when unset or unrecognized. Break
  weeks render as a purple diagonal hatch on affected days with a tooltip showing
  the break reason. The Gantt **Protocol Timeline**
  (`components/ProtocolTimeline.tsx`) is driven by pure
  `utils/protocolTimeline.ts` (`buildTimeline`, unit-tested), which marks break
  weeks via the `isBreak` flag on each `WeekSegment`.
- PWA "Next Dose" widget: `public/widgets/next-dose.html` + `widgets` member in
  `public/manifest.json` (self-contained, reads IndexedDB directly; Android/Chromium only).
- Pen clicks per dose: a protocol's dose entry carries an optional `recon`
  (`ReconMix` in `db/schema.ts` — `vialAmount` + `bacWaterMl`, pre-filled from the
  peptide's `reconstitution` and editable via `components/ReconMixFields.tsx` on
  both protocol screens). `utils/penClicks.ts` turns that mix plus the day's dose
  into clicks (`clicksForDose`/`formatClicks`), which the Dashboard, Calendar day
  list and `DoseActionSheet` render under the mg line. Click volume is a setting
  (`penMlPerClick`, default 0.01 ml = 1 insulin unit) since pens differ.
  `vialAmount` follows the IU rule above: mg for mcg/mg peptides, IU for IU ones.
- Pen colour: a dose config also carries an optional `penColor?: string`
  (free-typed or picked from a preset list — `components/PenColorField.tsx`,
  a native `<input list>`/`<datalist>` combo, no custom dropdown needed) so a
  stacked protocol can say which physical pen goes with which peptide. Wired
  the same way as `recon`: set on `NewProtocol.tsx`/`Protocols.tsx` edit sheet,
  read back out via the protocol's dose config in `DoseActionSheet.tsx`,
  `Dashboard.tsx`, and `Calendar.tsx` (both the dot colour and a "Pen: <colour>"
  label). `penColorHex()` in `PenColorField.tsx` maps the preset names to CSS
  colours for dots/strips, defaulting to neutral gray for custom/unrecognized text.
- Reconstitution calculator (`ReconCalculator.tsx`): forward + reverse-BAC solve,
  blend per-component breakdown (`Peptide.reconstitution.components`), honors the
  U-100/U-40 setting, IU-aware vial/concentration labels. Deep-linkable via `/calculator?peptide=<id>`.
- Dose units: `dosing.unit` is `'mcg' | 'mg' | 'IU'`. mcg↔mg convert by ×1000; **IU is a whole
  unit** — all quantity math (`unit === 'mcg' ? x/1000 : x` branches in recon/vial/inventory)
  routes IU through the else, so an IU vial field holds an IU count (e.g. HCG = 5000 IU). Don't
  add ×1000 conversions for IU.
- Peptide content: `data/peptides.ts` (70 peptides, 8 categories; dosing/reconstitution/titration) and
  `data/experienceTimelines.ts` (`PeptideExperience` — weekly guide + optional
  evidence/dosing/tips/mistakes/stacking sections rendered by `ExperienceGuide.tsx`).
  42 compounds, each with an entry in BOTH files plus any relevant
  `data/stackingRules.ts` pairs — `data/dataIntegrity.test.ts` enforces that
  cross-referencing, so run `npm test` after touching any of them.
  Optional `Peptide` fields carry what marketing copy usually omits:
  `halfLifeNote` (most of these compounds have no human PK at all — say so rather
  than presenting a vendor number as fact), `regulatoryStatus` (approval and FDA
  compounding status, which moves — date it), and `safetyFlags` (boxed warnings,
  trial deaths, hard contraindications). `dosing.protocolVariants` holds named,
  phased cycling presets per peptide (e.g. clinical trial ladder vs community
  cycle for Retatrutide) — each with `phases`, `doseOverride`, and a `source` URL.
  Keep the honesty when editing: state what is trial-derived versus community
  consensus, and never invent a cycling rationale or a mechanism the literature
  does not support.
- GLP-1 stacking: `stackingRules.ts` generates a contraindication for every pair
  among `GLP1_RECEPTOR_ACTIVE`. Add any new GLP-1-receptor-active compound to
  that list, not just to `PEPTIDES`.
- Protocol library: `data/protocols.ts` defines `PROTOCOL_TEMPLATES` — curated
  named protocols spanning single peptides and stacks (Wolverine Healing, GH
  Boost, Retatrutide Clinical, Retatrutide Community Cycle, NAD+ Ramp/Steady,
  MT2 Loading, GHK-Cu Daily/EOD, GLOW Blend, MOTS-c 6-on/6-off, etc.). Each
  template can declare `breaks` (off-week ranges) that the schedule engine
  respects on creation and regeneration. NewProtocol.tsx and Protocols.tsx both
  surface template selection with one-click setup. Protocols have a lifecycle:
  active → paused / completed / archived — the actions sheet in Protocols.tsx
  provides Pause/Resume, Finish (marks completed) and Delete. Status changes do
  **not** rewrite scheduled doses — the day views instead hide *upcoming* doses
  whose protocol is no longer active (`utils/doseVisibility.ts`, applied in
  Dashboard/Calendar/QuickLog). Before that filter, pausing or finishing a
  protocol left its future injections on the calendar, so restarting a peptide
  showed one row per past run. Logged/skipped/missed doses always stay visible,
  and resuming a protocol brings its upcoming doses straight back.
- **A scheduled dose is timed by `createdAt`, never by `date`.** `date` is the day
  the injection is due; for an upcoming dose that is in the future. `sync.ts rowTs`
  used to fall back to it, so every future dose outranked the delete that removed
  it: regenerating a protocol tombstoned the old doses locally, then the next sync
  pulled them back from the cloud. One protocol ended up drawing a calendar row
  per past edit, each with its old dose (2.5 / 2.5 / 5 on the same day). Fixed in
  three places — `rowTs` drops the `date` fallback, `remoteTs` treats any
  future cloud stamp as untrustworthy (0) so pre-fix rows can't outrank a delete,
  and pushes clamp `updated_at` to now. `saveScheduledDoses` stamps `createdAt`.
  `repairDuplicateScheduledDoses()` (called once from App, pure planner in
  `utils/dedupeDoses.ts`) clears schedules already duplicated; it only ever drops
  *upcoming* rows, keeping the copy that matches the protocol's current dose.
- Duplicate protocols: nothing stops the same peptide being started twice, and
  each run schedules its own injections — the symptom is one calendar row per
  past run on every dose day. `utils/duplicateProtocols.ts` groups the runs
  (keeper = most recently logged, then newest start date) and the Protocols page
  shows a cleanup card that deletes the extras through `deleteProtocol`, so the
  deletion ledger and cloud sync stay correct. Logged doses survive the delete.
- Deploy: **`scripts/deploy.sh`** — builds and rsyncs `dist/` to `/srv/pepdose`
  on this VM, served by **Caddy** at `/pepdose*` (see `/etc/caddy/Caddyfile`).
  Live: https://claude-dev-vperrod.westeurope.cloudapp.azure.com/pepdose/ .
  Pushing to `main` does NOT deploy — you must run the script. The old GitHub
  Pages path (`.github/workflows/deploy.yml`) is DEAD while the account block
  holds (Actions disabled account-wide, ticket 4583559); Vite `base` stays
  `/pepdose/` so moving back needs no rebuild.
  **After merging/pushing to `main`, run `scripts/deploy.sh` in the same sitting.**
  Each deploy appends a row (UTC time, commit) to `docs/DEPLOY_LOG.md`; to see
  whether `main` is live, compare its last row with `git log --oneline -1`
  (`git log <deployed-sha>..HEAD` lists what is still undeployed).

## Conventions

- Local-first is a hard constraint: no backend, no external APIs.
- Schedule-engine edits must preserve already-logged history — test regeneration
  paths when touching protocol editing. Break-week logic has dedicated tests in
  `scheduleEngine.test.ts` (`protocolBreaks` suppresses dose generation for daily,
  weekly, and phased schedules).
- Prefer `weekly_days` (explicit weekdays) over the `custom` every-N-days interval
  whenever a cadence should be "N times per week" — `custom` drifts against
  calendar weeks unless N evenly divides 7 (see `scheduleEngine.test.ts`'s
  `weekly_days`/NAD+ regression tests for the drift this caused in practice).
- New analytics logic goes in a **pure `utils/*.ts` helper with a `.test.ts`**, kept
  out of the component (see activeLevels/symptomTrends/adherence).
- Numeric inputs use the string-backed `components/DecimalInput.tsx` (a raw
  `type="number"` bound to numeric state snaps decimals/clears to 0).
- Peptide educational content is community/clinical-sourced and flags anecdotal vs
  clinical — keep the honesty (it's not medical advice).

## Agentic OS

- Registry entry: `pepdose` in `claude-config/os/registry.yaml` (autonomy: `report-only`)
- Cross-project backlog: `claude-config/os/backlog.md` under `## pepdose`
- Working tasks: `tasks/todo.md` · Lessons after corrections: `tasks/lessons.md`
- At session start, check the registry entry and this project's backlog section.
