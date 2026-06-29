# pepdose

A peptide dose-tracking PWA. Plan protocols, log injections, track vials, and reason about
half-lives, reconstitution, and stacking — all stored locally on your device.

**Live:** https://vperrod.github.io/pepdose/

## Features

- **Dose logging** — log actual quantity, time, injection site, and notes; reschedule or skip doses
- **Protocols** — create/edit/pause/delete protocols; schedule engine auto-generates future injections
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
