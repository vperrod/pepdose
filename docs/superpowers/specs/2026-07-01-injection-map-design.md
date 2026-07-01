# Injection Map + Tracking Upgrades — Design

**Date:** 2026-07-01
**Status:** Approved

## Problem

pepdose logs an `injectionSite` (text label) on every dose, and a `BodyMapSVG`
component already exists — but the component is **rendered nowhere** (dead code),
and nothing aggregates per-zone volume. Users can't see where doses went or which
zones are overused (lipohypertrophy risk). Site rotation is round-robin by dose
index, ignoring actual recency.

## Goals

1. **Injection map as picker** — tap a body zone to log the site; see recency colors live.
2. **Zone-volume stats** — a view showing per-zone injection counts + recency.
3. **Smarter rotation** — default the log picker to the most-rested zone.
4. Four adjacent, independently-scoped upgrades surfaced by market research (items 2–5 below).

Non-goals: vial-label OCR scanner (deferred), cloud sync, new dependencies beyond `vitest` (dev-only).

## Existing state (verified)

- `DoseLog.injectionSite?: string` stores a label e.g. `"Left abdomen"`.
- `BodyMapSVG.tsx` renders 8 subq zones (abdomen/thigh/deltoid/glute L+R), front/back
  toggle, color by days-since (`>7` green, `3–7` amber, `<3` red). **Unused.**
- Site label list is **duplicated** in `DoseActionSheet.tsx`, `scheduleEngine.ts`,
  and `BodyMapSVG.tsx`.
- `Insights.tsx` is a card hub → sub-pages; adding a card + route is the established pattern.
- No test runner. `date-fns`, `recharts`, `lucide-react` available.
- idb v1 store has no field-level schema → adding optional `DoseLog` fields needs **no migration**.

## Design

### Foundation: single source of truth

New `src/data/injectionSites.ts` — the only place site geometry/labels live.

```ts
export type BodyView = 'front' | 'back';
export interface InjectionSite { id: string; label: string; view: BodyView; cx: number; cy: number; r: number; }
export const INJECTION_SITES: InjectionSite[];      // the 8 zones (coords from current BodyMapSVG)
export const SITE_LABELS: string[];                 // INJECTION_SITES.map(s => s.label)
export const ABDOMEN_CLOCK: InjectionSite[];        // 12 clock sub-sites (item 5), dial-rendered
```

`DoseActionSheet`, `scheduleEngine`, `BodyMapSVG` all import from it. Duplication removed.
Storage stays the **label string** (no migration); aggregation groups by label.

### Core 1 — map as log picker (`DoseActionSheet`)

Replace the 8-button text grid with `<BodyMapSVG>`. Selecting a zone sets the stored
label. Feed the map a `daysSinceMap` computed from recent logs so hot zones show red
while logging. Default selection = **most-rested zone** (oldest/never-used), not the
pre-baked `suggestedSite`.

### Core 2 — recency stats (`src/utils/injectionStats.ts`, pure)

```ts
export interface ZoneStat { label: string; count: number; lastUsed?: string; daysSince?: number; }
export function zoneStats(logs: Pick<DoseLog,'injectionSite'|'date'>[], windowDays: number, today: Date): ZoneStat[];
export function daysSinceByLabel(logs: Pick<DoseLog,'injectionSite'|'date'>[], today: Date): Record<string, number>;
export function mostRestedLabel(labels: string[], daysSince: Record<string, number>): string; // never-used wins, else max days
```

### Core 3 — Injection Map page

New `src/pages/InjectionMap.tsx`, route `/injection-map`, Insights card. Shows:
`BodyMapSVG` colored by recency, a 30/90-day window toggle, and a per-zone table
(count bar + last-used relative) sorted hottest-first. Overused zones (used `<3` days
ago or count in top tier) flagged. Reaction flags from item 2 shown per zone.

### Item 2 — site-reaction logging

Add optional `DoseLog.siteReaction?: 'redness'|'lump'|'pain'|'bruise'`. Chip row in the
log sheet (default none). InjectionMap surfaces zones with any logged reaction.

### Item 3 — vial run-out date (`src/utils/vialForecast.ts`, pure)

```ts
export function predictEmptyDate(dosesRemaining: number, logDates: string[], today: Date): string | null;
// avg interval of last ≤10 logs → today + dosesRemaining*interval; null if <2 logs or dosesRemaining<=0
```

Badge in `VialInventory` per active vial.

### Item 4 — IU↔mg converter (`src/utils/iuConvert.ts`, pure)

```ts
export function mgToIu(mg: number, mgPerIu: number): number; // iu = mg / mgPerIu
export function iuToMg(iu: number, mgPerIu: number): number; // mg = iu * mgPerIu
```

Toggle block added to `ReconCalculator`. Prefilled defaults: HGH `mgPerIu=1/3`, HCG editable.

### Item 5 — clock-method dial

12 sub-sites around the navel exceed the 44px touch-target rule if drawn on the 240px
body silhouette. Instead: picking **Abdomen** opens an **enlarged 12-position dial**
(opt-in). Stores labels `"Abdomen (12 o'clock)"` … `"(11 o'clock)"`. New small
`AbdomenClockDial.tsx`. Clock sub-labels aggregate under abdomen in stats.

## Testing

`vitest` (added, dev-only) covers the three pure modules: `injectionStats`,
`vialForecast`, `iuConvert`. UI wiring verified by `npm run build` (tsc) + `npm run lint`
+ manual `npm run dev` walkthrough. Per repo convention there are no component tests.

## Risks

- Label/id drift: legacy logs use labels; new picks store labels too → consistent. Aggregation keyed by label.
- Clock sub-labels must sort/group under abdomen in stats — handled by prefix match.
