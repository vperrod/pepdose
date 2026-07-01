# pepdose

A peptide dose-tracking PWA. Plan protocols, log injections, track vials, and reason about
half-lives, reconstitution, and stacking — all stored locally on your device.

**Live:** https://vperrod.github.io/pepdose/

## Features

- **Protocols** — create from templates or any peptide, then fully edit a running protocol:
  per-peptide dose, length, frequency, time of day, and start date. Pause/resume/delete.
- **Smart scheduling** — the engine auto-generates every injection. Supports:
  - **Auto-titration** — GLP-1s step the dose up on a week ladder automatically (e.g.
    retatrutide `2→4→6→9→12mg`).
  - **Phased schedules + protocol variants** — peptides like GLOW carry several selectable
    cycle protocols (e.g. *daily → 5×/week → off*); pick one and the calendar reproduces the
    exact taper, including weekday-only (`5×/week`) cadence.
- **Editing regenerates safely** — changing a protocol rebuilds its upcoming doses while
  preserving everything already logged/skipped/missed.
- **Protocol journey** — tap a protocol (from the Protocols list or a Dashboard card) to see
  its full timeline: every dose grouped by week, status (done/upcoming/missed/skipped),
  injection site, and titration step-ups. Tap any dose to log or edit it; logged doses stay
  editable (dose, time, site, notes). "Manage" holds edit/pause/delete.
- **Dose logging** — log actual quantity, time, injection site, and notes; reschedule or skip.
  Logged rows show the *actual* recorded site, not the auto-rotation suggestion.
- **Calendar** — tap any scheduled dose to log, reschedule, or skip
- **Body map** — pick and track injection sites
- **Peptide library** — peptide database with dosing data, plus stacking rules
- **Calculators** — reconstitution calculator and half-life decay charts
- **Vial inventory** — track stock on hand
- **Insights & health markers** — trends and self-reported markers over time
- **Experience guides** — week-by-week timelines, side effects, and red flags (community + clinical sourced)
- **Export / import** — back up and restore all data
- **Offline-first PWA** — installable, works without a connection

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router 7 · Recharts · IndexedDB (via `idb`) · date-fns · lucide-react

All data lives in IndexedDB in the browser — nothing is sent to a server.

## How scheduling works

- `src/data/peptides.ts` — the peptide database. A peptide's `dosing` can carry a `titration`
  ladder (auto dose step-ups) and/or `protocolVariants` (named phased cycles, each a list of
  `SchedulePhase` week-ranges + cadence).
- `src/utils/scheduleEngine.ts` — `generateSchedule()` turns a config into dated doses. Fixed
  cadences (`daily`/`eod`/`weekly`/`biweekly`/`custom`) use per-cadence loops; peptides with
  `schedulePhases` use a day-by-day phased generator (`5x_week` = weekdays). `summarizePhases()`
  / `phasesTotalWeeks()` are shared helpers for the UI.
- `src/pages/NewProtocol.tsx` / `src/pages/Protocols.tsx` — create and edit flows. Editing
  regenerates upcoming doses (`deleteUpcomingDosesFrom` + `saveScheduledDoses` in
  `src/db/operations.ts`) and preserves logged history. `Protocols.tsx` also renders the
  journey timeline, joining `getScheduledDosesForProtocol` with `getDoseLogsForProtocol` so
  logged rows show the real `injectionSite`. Per-dose logging/editing reuses
  `src/components/DoseActionSheet.tsx` (`logDose` for new, `updateDoseLog` for edits).

## Develop

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview the build
npm run lint
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes to
GitHub Pages. The Vite `base` is set to `/pepdose/` to match the Pages path.

## Disclaimer

For personal tracking only. Not medical advice. Peptide data and experience guides are
community- and literature-sourced and may be incomplete or inaccurate — verify independently.
