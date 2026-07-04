# pepdose

Peptide dose-tracking PWA: protocols, smart injection scheduling (auto-titration,
phased variants), vial tracking, body-map site logging, insights — all stored
locally (IndexedDB). React 19 + Vite + TypeScript + Tailwind v4 + idb + Recharts.
Live: https://vperrod.github.io/pepdose/

## Commands

```bash
npm install
npm run lint         # eslint (must pass before commit)
npm test             # vitest (must pass before push)
npm run dev          # http://localhost:5173
npm run build        # tsc -b && vite build → dist/
```

## Architecture

- **`src/`** — React app; scheduling engine generates every injection from a
  protocol (titration ladders, phased schedules, weekday-only cadence) and
  regenerates safely on edit (preserves logged/skipped/missed doses).
- Storage: IndexedDB via `idb` — no backend, no accounts; data never leaves the
  device. Supports two users/profiles.
- Charts/insights: Recharts (outcome overlays, zone-volume tables); dates via
  date-fns.
- Deploy: GitHub Pages (build → gh-pages).

## Conventions

- Local-first is a hard constraint: no backend, no external APIs.
- Schedule-engine edits must preserve already-logged history — test regeneration
  paths when touching protocol editing.

## Agentic OS

- Registry entry: `pepdose` in `claude-config/os/registry.yaml` (autonomy: `report-only`)
- Cross-project backlog: `claude-config/os/backlog.md` under `## pepdose`
- Working tasks: `tasks/todo.md` · Lessons after corrections: `tasks/lessons.md`
- At session start, check the registry entry and this project's backlog section.
