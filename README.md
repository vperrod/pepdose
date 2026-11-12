# pepdose

A peptide dose-tracking PWA. Plan protocols, log injections, track vials, and reason about
half-lives, reconstitution, and stacking — stored locally on your device, with optional
cloud sync across devices.

**Live:** https://claude-dev-vperrod.westeurope.cloudapp.azure.com/pepdose/

## Features

- **Protocols** — create from templates or any peptide, then fully edit a running
  protocol: per-peptide dose, length, frequency, time of day, and start date.
  Pause/resume/finish/delete lifecycle — pausing or finishing a protocol takes its *upcoming*
  doses off the day views (history stays), and resuming brings them back.
- **Smart scheduling** — the engine auto-generates every injection. Supports:
  - **Auto-titration** — GLP-1s step the dose up on a week ladder automatically (e.g.
    retatrutide `2→4→6→9→12mg`).
  - **Phased schedules + protocol variants** — peptides like GLOW carry several selectable
    cycle protocols (e.g. *daily → 5×/week → off*); pick one and the calendar reproduces the
    exact taper, including weekday-only (`5×/week`) cadence.
  - **Scheduled breaks** — protocol templates can declare off-week ranges (e.g. Reta
    8-on/8-off, NAD+ 4-on/2-off). During break weeks no doses are generated; break weeks
    show as a purple hatch on the calendar and timeline.
- **Editing regenerates safely** — changing a protocol rebuilds its upcoming doses while
  preserving everything already logged/skipped/missed.
- **Pen clicks per dose** — record how the vial was mixed (peptide amount + BAC water) on each
  peptide in a protocol, pre-filled from that peptide's own reconstitution data. The Dashboard,
  Calendar day list and dose sheet then show the day's dose as pen clicks (`10 clicks · 0.10 ml`),
  live-updating as you edit the dose you actually injected. Click volume is a Setting — 0.005 /
  0.01 (1 insulin unit, default) / 0.02 ml — because pens differ.
- **Protocol journey** — tap a protocol (from the Protocols list or a Dashboard card) to see
  its full timeline: every dose grouped by week, status (done/upcoming/missed/skipped),
  injection site, and titration step-ups. Tap any dose to log or edit it; logged doses stay
  editable (dose, time, site, notes). "Manage" holds edit/pause/delete. Each week shows the
  **expected experience guide** for that week inline (what to expect, tips), and an **outcome
  overlay** charts a health marker (weight/sleep/energy/mood) across the protocol so you can
  see if it's working.
- **Find a protocol** — pick a goal (healing, weight loss, growth hormone, etc.) and get the
  matching peptides + documented **synergy stacks**, one tap to a prefilled new protocol.
- **Titration coach** — the Dashboard flags your next upcoming dose step-up ("Week 4 — step up
  to 4mg on Mon"), computed from the titration ladder. Rule-based, works offline.
- **Adherence streak** — the Dashboard shows your consecutive fully-logged-day streak plus a
  logged/due ratio for the week (skipped doses are neutral; a missed dose breaks the streak).
- **Dose logging** — log actual quantity, time, injection site, and notes; reschedule or skip.
  Pick the site by tapping a **body map** (recency-colored so overused zones show red); a
  fresh log defaults to the *most-rested* zone. Optionally flag a **site reaction**
  (redness/lump/pain/bruise) and **rate systemic symptoms** (nausea, heart rate, dysesthesia,
  fatigue, …) on a 1–10 scale. Logged rows show the *actual* recorded site.
- **Symptom trends** — an Insights view charting logged symptom severity over time, with
  **titration step-ups marked** so you can see whether a dose increase spiked side effects
  (e.g. nausea after the 4→6mg step). Per-symptom summary of frequency + average/max severity.
- **Injection map & zone volume** — an Insights view showing where doses landed: the body map
  colored by recency plus a per-zone table of injection count + last-used over a 30/90-day
  window, hottest zones first. Surfaces overuse (lipohypertrophy risk) and flags zones with
  logged reactions. For daily abdomen dosers, an opt-in **clock-method dial** logs precise
  12-position sites around the navel.
- **Calendar** — a month grid where each day shows a per-peptide color strip (up to 8 doses,
  overflow as "+N") with a category legend; tap any scheduled dose to log, reschedule, or skip,
  and each dose in the day list names its owning protocol. A **Month / Timeline** toggle switches
  to a **Protocol Timeline** — a Gantt-style view with one horizontal lane per active protocol on
  a shared week axis, a vertical "today" line across all lanes, dose-density shading, off-week
  hatching, titration step-up arrows, and a per-protocol **dose-ramp sparkline**. Tap a lane or
  week for a summary sheet. A **Today** button jumps back to the current month (grid) or scrolls
  the today line into view (timeline).
- **Peptide library** — a database of 70 peptides across 8 categories (healing, GLP-1,
  GH secretagogues, fat loss, cosmetic, sexual health, nootropic, longevity), including multi-component
  blends (GLOW, KLOW, Tri-Heal, CagriSema, …), plus stacking rules. Doses are carried in
  `mcg`, `mg`, or `IU` (e.g. HCG is dosed natively in IU).
- **Reconstitution calculator** — forward (water → units) **and reverse-BAC** ("I want my dose
  on a clean 10-unit mark — how much water?"); a **blend breakdown** for GLOW-style vials
  (per-component mg from one draw); a **visual syringe** that honors your U-100/U-40 setting;
  IU-aware vial/concentration labels for IU-dosed compounds; plus a standalone **IU↔mg**
  converter (e.g. for HGH). Reachable directly from each peptide's experience guide.
- **Active Levels** — an Insights chart estimating how much of each compound is *in your system*
  from your actual logged doses, **projected forward through upcoming scheduled doses** past a
  "now" line (so you see the weekly trough and the next shot climb back to peak). Per-peptide
  status: % of recent peak, last-dose-ago, next-dose-in.
- **Vial inventory** — track stock on hand with a **run-out date forecast**; the add form
  prefills from the peptide's reconstitution data and **auto-computes doses-per-vial**. Each
  reconstituted vial shows a **beyond-use-date countdown** ("use by MMM d", "Expires in 3d").
  Doses decrement as you log and are restored if you delete a log.
- **Insights & health markers** — trends and self-reported markers over time, including
  **body measurements** (waist, chest, arms, thighs, etc. in cm) logged alongside weight/body-fat
  and plotted on the same trend chart to track physical progress
- **Experience guides** — week-by-week timelines, side effects, and red flags (community + clinical sourced)
- **Two users (Victor / Nadia)** — a shared-device model. Every protocol, dose, vial, and
  health marker belongs to a user; creation forms carry a Victor/Nadia picker (remembering your
  last choice). All screens show both users at once, each item badged with its owner, plus a
  **Both / Victor / Nadia** filter chip in the header to narrow the view (charts respect it).
  Onboarding and settings are shared.
- **Dose reminders** — opt-in local notifications nudge you before each scheduled dose (lead time
  configurable in Settings). Reminders are **timezone-aware**: dose times are anchored to a
  configurable home timezone (defaults to the device's), so traveling doesn't shift them, and DST
  is handled correctly. On browsers that support the **Notification Triggers API** (e.g. Chrome/Edge
  on Android) reminders can fire **even when the app is fully closed**; elsewhere they fire via the
  service worker while the app is open or backgrounded (deduped per day, re-armed on focus).
- **Home-screen widget** — a "Next Dose" PWA widget (Android/Chromium widget hosts) shows your next
  upcoming dose straight on the home screen, reading local data directly. iOS doesn't support web
  widgets and ignores it.
- **Ad-hoc logging** — log an unscheduled injection (peptide, owner, dose, time) straight from the
  Log tab, no protocol required.
- **Export / import** — back up and restore all data (reloads the app after restore/clear)
- **Cloud sync (optional)** — sign in with a shared account to sync protocols, doses, vials, and
  health markers across phone and desktop. Offline-first: IndexedDB stays primary; the cloud is a
  mirror. Merge is union/last-write-wins and never destructive — an empty device can't wipe the one
  holding your data. **Deletes propagate** via `deleted: true` tombstones (a row removed on one
  device is removed on the others; a newer re-edit still wins over an older tombstone). Disabled by
  default; enable by setting the two Supabase env vars. See
  [docs/CLOUD_SYNC_SETUP.md](docs/CLOUD_SYNC_SETUP.md).
- **Offline-first PWA** — installable, works without a connection

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router 7 · Recharts · IndexedDB (via `idb`) · date-fns · lucide-react · Supabase (optional cloud sync)

Data lives in IndexedDB in the browser. With cloud sync off (no Supabase env vars), nothing is sent
to a server. With it on, data is also mirrored to a private, per-account Supabase table (Row-Level
Security isolates each account); see [docs/CLOUD_SYNC_SETUP.md](docs/CLOUD_SYNC_SETUP.md).

## How scheduling works

- `src/data/peptides.ts` — the peptide database. A peptide's `dosing` has a `unit`
  (`mcg | mg | IU`) and can carry a `titration` ladder (auto dose step-ups) and/or
  `protocolVariants` (named phased cycles, each a list of `SchedulePhase` week-ranges + cadence).
  IU is treated as a whole unit (no ×1000 mass conversion) throughout the dose/vial/recon math.
- `src/utils/scheduleEngine.ts` — `generateSchedule()` turns a config into dated doses. Fixed
  cadences (`daily`/`eod`/`weekly`/`biweekly`/`custom`) use per-cadence loops; peptides with
  `schedulePhases` use a day-by-day phased generator (`5x_week` = weekdays). `summarizePhases()`
  / `phasesTotalWeeks()` are shared helpers for the UI.
- `src/pages/AddPeptides.tsx` (one screen, `components/PeptideCycleCard.tsx`) / `src/pages/Protocols.tsx` — create and edit flows. Editing
  regenerates upcoming doses (`deleteUpcomingDosesFrom` + `saveScheduledDoses` in
  `src/db/operations.ts`) and preserves logged history. `Protocols.tsx` also renders the
  journey timeline, joining `getScheduledDosesForProtocol` with `getDoseLogsForProtocol` so
  logged rows show the real `injectionSite`. Per-dose logging/editing reuses
  `src/components/DoseActionSheet.tsx` (`logDose` for new, `updateDoseLog` for edits).

## How injection tracking works

- `src/data/injectionSites.ts` — the single source of truth for injection sites (8 subq zones
  with SVG coordinates + 12 abdomen clock positions). `BodyMapSVG`, `DoseActionSheet`, and
  `scheduleEngine` all read from it.
- `src/utils/injectionStats.ts` — pure recency/volume helpers. `zoneStats()` aggregates logs
  into per-zone counts + last-used; `daysSinceByLabel()` drives the map colors and folds
  clock-method picks back into the abdomen zones; `mostRestedLabel()` picks the default log
  site. `src/pages/InjectionMap.tsx` renders the stats view.
- Sites are stored as label strings on each `DoseLog` (no schema migration); the map bridges
  label↔id for coloring.

## How protocol guidance works

- **Protocol lifecycle** — protocols are `active`, `paused`, or `completed`. The actions
  sheet (Protocols.tsx) provides Pause/Resume, Finish, and Delete. Finishing a
  protocol marks it `completed` (future doses are skipped, not deleted); the
  protocol stays in the list as a gray badge for history.
- **Scheduled breaks** — template `breaks` (e.g. Reta 8-on/8-off) are stored on
  `UserProtocol.breaks` and respected by the schedule engine; break weeks are
  rendered as a purple hatch on the Calendar month grid and Protocol Timeline.
- `src/data/experienceTimelines.ts` — `getCurrentWeekGuide(peptideId, week)` feeds the inline
  week-by-week guide in the journey.
- `src/utils/titrationCoach.ts` — `nextTitrationStep(doses, today)` finds the next upcoming
  `isTitrationStepUp` dose (flagged by the schedule engine) for the Dashboard coach. Pure, no AI.
- `src/utils/goalPicker.ts` — `peptidesForGoal(category)` + `synergyStacksFor(category)` power the
  `/find` picker (only `synergy` stacks surface). Picks navigate to `AddPeptides` with
  `preselectPeptideIds` in router state.
- The outcome overlay reuses the `HealthMarkers` recharts pattern with `getHealthMarkers(start, end)`.
- `PeptideExperience` (in `experienceTimelines.ts`) carries optional rich sections — `evidenceLevel`,
  a `dosing` guide (protocol + reconstitution bullets), `communityTips`, `commonMistakes`, `stacking` —
  rendered by `ExperienceGuide.tsx`. The dosing section deep-links to `/calculator?peptide=<id>`.

## How the analytics views work

- `src/utils/activeLevels.ts` — pure decay math (`decayAt`/`levelAt`/`currentStatus`/`sampleLevels`).
  `HalfLife.tsx` ("Active Levels") sums each peptide's logged doses into a level curve and projects
  forward through upcoming scheduled doses past a "now" reference line.
- `src/utils/symptomTrends.ts` — aggregates `DoseLog.symptoms` (name + 1–10 severity, captured in
  `DoseActionSheet`) into per-symptom trends; `Symptoms.tsx` charts them with titration step-up
  reference lines. Symptom catalog + category ordering live in `src/data/symptoms.ts`.
- `src/utils/adherence.ts` — `adherenceStats(scheduled, today)` computes the Dashboard streak +
  weekly logged/due ratio. All three helpers are unit-tested.
- `src/utils/protocolTimeline.ts` — `buildTimeline(protocols, dosesByProtocol)` buckets actual
  scheduled doses into per-week lane segments (count, representative dose, step-up flag) and computes
  the global week span + today index for the Calendar's Gantt **Protocol Timeline**
  (`src/components/ProtocolTimeline.tsx`). Pure and unit-tested.

## How reminders, timezones & sync work

- `src/utils/notifications.ts` — opt-in dose reminders. Reads settings from localStorage, dedupes
  fired reminders per day, and re-arms on focus/visibility. Where the **Notification Triggers API**
  is available it schedules a `TimestampTrigger` so the reminder fires even if the app is closed;
  otherwise it falls back to in-page `setTimeout` timers fired through the service worker
  (`public/sw.js`). `triggeredNotificationsSupported()` gates the capability and the Settings copy.
- `src/utils/tz.ts` — pure, unit-tested timezone math. `zonedTimeToUtc(date, time, ianaZone)` turns a
  stored date + wall-clock time in a chosen timezone into a UTC epoch (DST-correct via
  `Intl.DateTimeFormat` `shortOffset`), so reminders don't drift when you travel. The active zone is
  stored in Settings (`timezone`, defaulting to the device zone).
- `src/db/sync.ts` — bidirectional union-merge (`planMerge`, LWW, never destructive). Local deletes
  are pushed as `deleted: true` tombstones and remote tombstones are applied on pull, so deletions
  propagate across devices while a newer re-edit still wins. **A row is timed by `createdAt` /
  `updatedAt`, never by `date`** — `date` is when an injection is *due*, which for an upcoming dose
  is in the future. `rowTs` used to fall back to it, so a future dose outranked the delete that
  removed it and every protocol regeneration got its old doses pulled back from the cloud (the
  visible symptom: one calendar row per past edit, each with its old dose). `remoteTs` now also
  discards any cloud timestamp in the future, and pushes clamp `updated_at` to now.
- `src/db/operations.ts` `repairDuplicateScheduledDoses()` — runs once at app start and clears
  schedules the above bug already duplicated (planner: `src/utils/dedupeDoses.ts`). It drops only
  *upcoming* rows, keeps the copy matching the protocol's current dose, and writes ledger entries
  so the cloud drops them too. Logged/skipped/missed doses are never touched.
- `public/widgets/next-dose.html` + the `widgets` member in `public/manifest.json` — a self-contained
  PWA home-screen widget that reads the `pepdose` IndexedDB store directly to show the next dose
  (Android/Chromium widget hosts; ignored on iOS).

## How the two-user model works

- `src/data/users.ts` — the two fixed users (`Victor`, `Nadia`), their badge colors, and the
  `getLastOwner`/`setLastOwner` preference (localStorage `pepdose-last-owner`).
- Every owned record (`UserProtocol`, `ScheduledDose`, `DoseLog`, `Vial`, `HealthMarker`) carries
  an `owner`. A DB **v1→v2** migration in `src/db/schema.ts` backfills all pre-existing data to
  `Victor`; `importData(json, owner)` takes the owner explicitly — the Export/Import screen passes
  `getLastOwner()`, so a legacy owner-less backup lands on whoever is using the device.
- `saveScheduledDoses(doses, owner)` stamps owner at the save boundary, keeping `scheduleEngine`
  owner-free (it returns `DraftDose` = owner-less doses). Logged doses inherit their scheduled
  dose's owner.
- `src/context/ViewFilterContext.tsx` holds the `Both / Victor / Nadia` view filter (persisted,
  default *Both*); `useOwnerFilter()` / `filterByOwner()` filter any owned list. `UserFilterChip`
  (header) sets it; `UserPicker` (forms) assigns owner; `UserBadge` labels each item.

## Develop

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview the build
npm run test     # run unit tests (vitest)
npm run lint
```

## Deploy

Deploy: run `scripts/deploy.sh` — builds and rsyncs `dist/` to `/srv/pepdose`
on this VM, served by **Caddy** at `/pepdose*` (see `/etc/caddy/Caddyfile`).
Pushing to `main` does NOT auto-deploy (GitHub Actions are blocked by an
account flag). Live: https://claude-dev-vperrod.westeurope.cloudapp.azure.com/pepdose/

## Disclaimer

For personal tracking only. Not medical advice. Peptide data and experience guides are
community- and literature-sourced and may be incomplete or inaccurate — verify independently.
