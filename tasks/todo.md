# pepdose — working tasks

> Plans for in-flight work live here as checkable items (see Task Management in claude-config/CLAUDE.md).
> Cross-project backlog: claude-config/os/backlog.md
> Full context for continuing on a laptop: see `HANDOFF.md` at the repo root.

## Done — pen clicks + duplicate-dose root cause (2026-08-05)

- [x] `ReconMix` on each protocol dose (vial amount + BAC water), pre-filled from the
  peptide's own reconstitution data, edited via `components/ReconMixFields.tsx` on both
  the create and edit protocol screens
- [x] `utils/penClicks.ts` — clicks per dose from the mix; shown on Dashboard, Calendar
  day list and the dose sheet (live against the dose you type)
- [x] Pen Click Volume setting (0.005 / 0.01 / 0.02 ml) — pens differ
- [x] `utils/doseVisibility.ts` — paused/finished protocols no longer put upcoming doses
  on the day views (history still shows)
- [x] Calendar names every dose row by its protocol; Settings shows the build timestamp
- [x] `utils/duplicateProtocols.ts` + Protocols cleanup card for genuinely duplicated runs
- [x] **Root cause of the triplicated calendar entries**: `sync.ts rowTs` fell back to
  `date` (the injection day), so an upcoming dose outranked the delete that removed it
  and every regeneration pulled the old doses back from the cloud. Fixed in `rowTs`,
  new `remoteTs` (future cloud stamps count as 0), push clamps `updated_at` to now,
  `saveScheduledDoses` stamps `createdAt`
- [x] `repairDuplicateScheduledDoses()` at app start clears already-duplicated schedules
  (`utils/dedupeDoses.ts`) — upcoming rows only, keeps the copy matching the current dose
- [x] Tests: 317 passing, incl. 3 that fail against the old `rowTs` + a regression test
  for the 2.5/2.5/5 stack; verified live by Victor ("the triple is gone")
- [x] Docs: README, CLAUDE.md, docs/USER-TESTING.md (P7–P10, C7–C8), tasks/lessons.md

## Done — protocol library + breaks (2026-08-02)

- [x] Protocol variants on peptides: Retatrutide (clinical-trial, community-cycle,
  microdose-maintenance), NAD+ (ramp-up, steady-100), MT2 (loading-standard,
  gentle-start), GHK-Cu (daily-30d, eod-4wk), MOTS-c (standard-6on-6off, weekly-single)
- [x] Protocol templates with breaks: Retatrutide Community Cycle (8-on/8-off),
  NAD+ Ramp/Steady (4-on/2-off), MT2 Loading (2-on/4-off), GHK-Cu Daily/EOD (4-on/4-off),
  GHK-Cu/MOTS-c stack, GLOW Blend (8-on/4-off), MOTS-c 6-on/6-off, Retatrutide+GLOW combo
- [x] `ProtocolBreak` interface + `breaks` field on `ProtocolTemplate` and `UserProtocol`
- [x] Schedule engine break-skipping logic (all frequency paths: daily, EOD, weekly,
  biweekly, custom, phased)
- [x] Calendar month grid break visualization (purple diagonal hatch + tooltip)
- [x] Protocol Timeline Gantt break visualization (purple hatch, distinct from gray off-weeks)
- [x] Tests: 3 new scheduleEngine tests for break behavior
- [x] Documentation updated (CLAUDE.md, HANDOFF.md)
- [x] Finish Protocol button — marks active/paused protocol as completed

## Done — base path fix + build clean (2026-08-02)

- [x] Fix vite.config.ts base (`/` → `/pepdose/`) — was causing blank page behind Caddy
- [x] Fix public/sw.js BASE path to `/pepdose/`
- [x] Remove broken untracked sync.bench.test.ts
- [x] Fix pre-existing tsc errors in AuthGate.test.tsx + notifications.test.ts
- [x] Clean build: `npm run build` passes, `npm test` 286/286 pass

## Done (shipped to `main`, live)

- [x] Fix dose-quantity save bug (string-backed `DecimalInput`)
- [x] Dose reminders (service-worker notifications; open/backgrounded only)
- [x] Active Levels chart (logged doses + forward projection)
- [x] Per-dose symptom logging + trends view
- [x] Reconstitution calculator: reverse-BAC, blend breakdown, live U-100/U-40
- [x] Reconstitution-aware inventory: auto doses-per-vial, beyond-use-date countdown
- [x] Adherence streak on the Dashboard
- [x] Deep GLOW + retatrutide content; 6 new peptide guides
- [x] Ad-hoc dose logging + assorted review fixes
- [x] Docs updated (README, CLAUDE.md, HANDOFF.md)

## Done — backlog repair 2026-07-17

- [x] 1. Deletion ledger: `deletions` store (schema v3), operations record deletes, sync.ts ledger-driven tombstones + remote-delete propagation; delta cursor left as `ponytail:` comment (push side needs a dirty set); tests
- [x] 2. AuthGate tests (jsdom + @testing-library/react, 6 tests)
- [x] 3. Auto-sync errors surfaced via fixed status pill in AuthGate (aria-live, auto-clears on next clean sync)
- [x] 4. importData: `validateImport` rejects malformed backups before any write
- [x] Verify: 124/124 tests, clean build, lint clean on touched files

Conservative choices (data safety): legacy unmarked cloud tombstones (from the old
absence heuristic) never delete local data — the local row is pushed back to repair
the cloud. `clearAllData` wipes the device only (no ledger entries), so it can't
delete the cloud copy.

## Remaining (see HANDOFF.md § Remaining roadmap for pointers)

- [ ] `.ics` calendar export of upcoming doses (S, local-first)
- [ ] Doctor-ready PDF / printable report (M, local-first)
- [x] Wire or remove the remaining dead settings: `unitSystem`, `darkMode` (S)
- [ ] NewProtocol "custom interval" total-dose estimate (use `daysInCycle / customFrequencyDays`) (S)
- [ ] Reliable push-when-closed reminders — **needs a backend / Web Push** (deliberate decision)
