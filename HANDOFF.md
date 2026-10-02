# pepdose — Handoff

Snapshot for continuing this work on your laptop. Everything below is current as of
the merge of PR #1 (features) and PR #3 (docs) into `main`.

## Status: what's done and live

**Latest (2026-08-05):** pen clicks per dose (protocol-level vial mix + `Pen Click
Volume` setting), day views hide upcoming doses of paused/finished protocols, a
duplicate-protocol cleanup card, and the fix for the duplicated calendar entries —
sync was resurrecting deleted doses because `rowTs` timed them by their injection
date. `repairDuplicateScheduledDoses()` clears schedules already duplicated. 500
tests pass; confirmed fixed by Victor on his own data.

All of the following is merged to `main` and deployed at
**https://claude-dev-vperrod.westeurope.cloudapp.azure.com/pepdose/** (via `scripts/deploy.sh`):

- **Protocol variants** — each peptide can declare multiple named, phased
  cycling presets in `data/peptides.ts` (`DosingProtocol.protocolVariants`):
  Retatrutide (clinical-trial, community 8-on/8-off, microdose maintenance),
  NAD+ (ramp-up, steady-100), MT2 (loading-standard, gentle-start),
  GHK-Cu (daily-30d, eod-4wk), MOTS-c (6-on/6-off, weekly-single). Selecting a
  variant auto-sets phases, dose override, and duration.
- **Protocol library + breaks** — `data/protocols.ts` defines
  `PROTOCOL_TEMPLATES` with named protocols for single peptides and stacks
  (Wolverine Healing, GH Boost, Retatrutide Clinical/Community, NAD+ Ramp/Steady,
  MT2 Loading, GHK-Cu Daily/EOD, GLOW Blend, MOTS-c, Cognitive, etc.). Templates
  can declare `breaks` (explicit off-week ranges) that the schedule engine
  respects — no dose generation during break weeks across all frequency paths.
  Calendar month grid shows a purple diagonal hatch on break days with a
  tooltip; the Protocol Timeline Gantt distinguishes break weeks (purple) from
  regular off-weeks (gray).
- **Dose-save bug fixed** — the reported "changing the quantity doesn't save" issue.
  Root cause + fix: string-backed `src/components/DecimalInput.tsx` (see Gotchas).
- **Dose reminders** — opt-in, fired via the service worker while the app is open/
  backgrounded (Settings → Push Notifications, with a test button).
- **Active Levels chart** (Insights → Active Levels) — in-system level from logged
  doses, projected forward through upcoming scheduled doses.
- **Per-dose symptom logging + trends** (Insights → Symptoms) — rate symptoms 1–10
  when logging a dose; charted with titration step-up markers.
- **Reconstitution calculator overhaul** — forward + **reverse-BAC**, **blend
  breakdown** (GLOW), live **U-100/U-40** setting, guide deep-link.
- **Reconstitution-aware inventory** — auto doses-per-vial, **beyond-use-date**
  countdown, decrement-on-log / restore-on-delete.
- **Adherence streak** on the Dashboard.
- **Deep GLOW + retatrutide content** and **6 new peptide guides** (KPV, CJC-1295
  DAC, Sermorelin, Tesamorelin, Semax, Selank).
- **Ad-hoc dose logging**, plus assorted review fixes.

Tests: `500 passing`. Build + typecheck clean.

## Run it locally

Prereqs: Node 20+ and npm.

```bash
git clone https://github.com/vperrod/pepdose.git
cd pepdose
npm install
npm run dev      # http://localhost:5173  (note: dev serves at "/", Pages serves at "/pepdose/")
```

Other commands:

```bash
npm test         # vitest — must pass before pushing
npm run build    # tsc -b && vite build → dist/   (this is exactly what CI gates on)
npm run preview  # serve the production build at /pepdose/ (matches prod base path)
npm run lint     # eslint — repo has pre-existing errors; just don't add new ones
```

Data lives in the browser's IndexedDB (`pepdose` DB). To reset while developing:
DevTools → Application → IndexedDB → delete `pepdose`, or Settings/Export-Import →
Clear all data.

## Deploying

**Merging to `main` does NOT deploy.** `.github/workflows/deploy.yml` is dead
(GitHub Actions disabled account-wide, ticket 4583559). Deploy is manual:

1. Merge/pull the PR into `main`.
2. Run `scripts/deploy.sh` (builds, tests, rsyncs `dist/` to the claude-dev VM's
   Caddy root). It appends a row to `docs/DEPLOY_LOG.md` automatically.
3. Verify the change live at
   https://claude-dev-vperrod.westeurope.cloudapp.azure.com/pepdose/ — a merged
   PR is not live until this step is done.

The Vite `base` stays `/pepdose/` so moving back to GitHub Pages (once the
account is unblocked) needs no rebuild.

## Remaining roadmap (with pointers)

Ordered by value ÷ effort. Each is local-first unless flagged.

### 1. `.ics` calendar export — **S, local-first**
Generate an iCalendar file of upcoming scheduled doses so they land in Apple/Google
Calendar (a serverless hedge for the reminder limitation, esp. iOS).
- New `src/utils/icsExport.ts` (pure, testable): take `ScheduledDose[]` → an ICS
  string (one `VEVENT` per dose; `DTSTART` from `date`+`time`, `SUMMARY` = peptide +
  dose). Trigger a Blob download like `ExportImport.tsx` already does for JSON.
- Surface a button in `ExportImport.tsx` or the Calendar page.

### 2. Doctor-ready PDF report — **M, local-first**
One-tap printable report: active protocols, dose history, adherence %, symptoms with
severities, health-marker trends, labs.
- Simplest path: a print stylesheet + a dedicated `/report` route with
  `window.print()` (no dependency). Or add `jspdf` for a real PDF.
- Pull data from `src/db/operations.ts` (getProtocols, getAllDoseLogs,
  getHealthMarkers) and reuse `utils/adherence.ts` + `utils/symptomTrends.ts`.
- Respect the two-user filter (per-user report).

### 3. Wire or remove the remaining dead settings — **S**
`src/pages/Settings.tsx` persists `unitSystem` (metric/imperial) and `darkMode` but
nothing reads them. Either wire `unitSystem` into `HealthMarkers` weight/measurement
display (kg↔lb, cm↔in) or remove the toggles so they don't imply functionality.
(`syringeType` is already wired into the calculator; `defaultInjectionTime` and
`reminderMinutesBefore` are used.)

### 4. NewProtocol "custom interval" total-dose estimate — **S**
`src/pages/NewProtocol.tsx` shows "~X total injections"; for a custom "every N days"
frequency it counts every day. Compute `daysInCycle / customFrequencyDays` instead.

### 5. Reliable push-when-closed reminders — **needs a backend (out of local-first scope)**
The current reminders can't wake a fully-closed app (no push server). True background
delivery (esp. installed iOS PWA, 16.4+) needs Web Push + a small push server. This is
the one item that breaks the no-backend constraint — decide deliberately before doing it.

Larger ideas from the competitor research, if you want them later: multi-compound
blend *vials* (not just the calculator), cost tracking, progress photos (IndexedDB
blobs), lab/bloodwork tracking with reference ranges, cycle/washout planner.

## Gotchas & conventions (read before editing)

- **Numeric inputs:** use `src/components/DecimalInput.tsx`, not a raw `type="number"`
  bound to numeric state — the raw version snaps decimals and clears to `0` (that was
  the original dose-save bug). See also `utils` that parse strings at save time.
- **Local-first is a hard constraint:** no backend, no external APIs, no accounts.
- **Never merge on a domain date.** Cloud sync times a row by `createdAt`/`updatedAt`
  only. `ScheduledDose.date` is when the injection is *due* — in the future for any
  upcoming dose — and using it as a write time made deleted doses outlive their own
  tombstone and return on the next sync (one calendar row per protocol edit). See
  `rowTs`/`remoteTs` in `src/db/sync.ts` and the regression tests in `sync.test.ts`.
- **Analytics logic** goes in a pure `src/utils/*.ts` helper with a matching
  `.test.ts` (see `activeLevels`, `symptomTrends`, `adherence`), kept out of the
  component.
- **Schema additions:** IndexedDB is per-record schemaless, so *optional* fields on a
  record (e.g. `DoseLog.symptoms`, `UserProtocol.breaks`) need no migration. A
  store/index change does — bump the version in `src/db/schema.ts` and add an
  `upgrade` block (see the v1→v2 owner backfill).
- **CI runs `npm run build` only.** Lint has ~12 pre-existing errors on `main`; keep
  your diff from adding new ones, but don't expect a clean lint.
- **Reminders limitation** is intentional and documented — don't "fix" it without a
  backend (see roadmap #5).
- **Verifying UI changes headlessly:** the pattern used here is to drive the
  `npm run preview` build with Playwright, seeding IndexedDB via `page.evaluate`
  (open `indexedDB.open('pepdose', 2)` and `put` records) then asserting on render.
  Handy for charts/forms that need data.
- **Git workflow:** work on a branch, open a PR, merge to `main`, then run
  `scripts/deploy.sh` — merging alone does not deploy (see Deploying above).
  Commit or push only what you intend to ship.

## Key files map

- Scheduling: `src/utils/scheduleEngine.ts`
- Storage: `src/db/schema.ts`, `src/db/operations.ts`
- Analytics helpers (pure + tested): `src/utils/{activeLevels,symptomTrends,adherence,injectionStats,titrationCoach}.ts`
- Reminders: `src/utils/notifications.ts` + `public/sw.js`
- Calculator: `src/pages/ReconCalculator.tsx`
- Peptide data/content: `src/data/peptides.ts`, `src/data/protocols.ts`, `src/data/experienceTimelines.ts`, `src/data/symptoms.ts`
- Dose logging UI: `src/components/DoseActionSheet.tsx`, `src/pages/QuickLog.tsx`
- Project conventions: `CLAUDE.md`; user-facing feature list: `README.md`
