# Protocol Guidance Features — Design

**Date:** 2026-07-01
**Status:** Approved

## Problem

pepdose logs and schedules well, but the protocol experience is a bare timeline. Users can't
see *what to expect* each week, get *guided to a protocol* from a goal, tell whether a protocol
*is working*, or get a heads-up on an upcoming *titration step-up*. All the underlying data
already exists (experience guides, peptide categories, stacking rules, health markers, engine
titration flags) but isn't surfaced as guidance.

## Goals

1. **Expected timeline in journey** — weave the existing week-by-week experience guide into the protocol journey.
2. **Goal-based protocol picker** — pick a goal → recommended peptides + synergy stacks → prefilled new protocol.
3. **Outcome overlay** — a health-marker trend chart across a protocol's span, in the journey.
4. **Titration coach** — a Dashboard card announcing the next upcoming dose step-up (rule-based, no AI).

Non-goals: any LLM/AI (rejected — static no-server PWA, key exposure + dose-safety). New deps. DB migration.

## Existing state (verified)

- `src/data/experienceTimelines.ts` — `getExperienceForPeptide(id)`, `getCurrentWeekGuide(id, week)` returning `{weekStart, weekEnd, title, description, tips}`; also `sideEffects`, `redFlags`.
- Journey view (`Protocols.tsx:311-398`) already groups doses by `d.weekNumber` and renders a `weeks.map(week => ...)` block; `nowWeek` computed; `getPeptideById` in scope.
- `src/data/peptides.ts` — `PeptideCategory` (7 values), `CATEGORY_LABELS: Record<PeptideCategory,string>` (friendly labels), `PEPTIDES`, `getPeptideById`. `ScheduledDose.isTitrationStepUp` is set by the engine.
- `src/data/stackingRules.ts` — `STACKING_RULES: StackRule[]` (`relation: 'synergy'|...`), `getStackWarnings(ids)`.
- `NewProtocol.tsx` — `selectPeptide(peptide)` adds a config + jumps to `configure`; nav-state pattern already used elsewhere (`Protocols.tsx:68` reads `location.state.openId`).
- `HealthMarkers.tsx` — recharts `LineChart` pattern; `getHealthMarkers(startDate?, endDate?)` in operations. `HealthMarker` has `date`, `weight`, `mood`, `energy`, `sleepQuality`.
- `Dashboard.tsx` — `card-glass` cards; already shows a same-day step-up note on `nextDose`.
- vitest installed (dev-only).

## Design

### A. Expected timeline in journey (`Protocols.tsx`)
In the `weeks.map(week => ...)` block, after the "Week N" header, render a compact guide card:
for each unique `peptideId` scheduled that week, call `getCurrentWeekGuide(peptideId, week)` and
show `title` + `description` + `tips` (and any `redFlags` for that peptide once, at its first
week). Read-only, collapsible not required. Skips peptides with no experience data.

### B. Titration coach (`src/utils/titrationCoach.ts` pure + `Dashboard.tsx`)
```ts
export interface NextStep { peptideId: string; weekNumber: number; dose: number; unit: 'mcg'|'mg'; date: string; }
export function nextTitrationStep(doses: ScheduledDose[], today: Date): NextStep | null;
// earliest upcoming (date >= today, status 'upcoming') dose with isTitrationStepUp; null if none
```
Dashboard loads active protocols' upcoming scheduled doses, calls `nextTitrationStep`, and if
non-null shows a coach card: "Week N — <peptide>: step up to <dose><unit> on <EEE MMM d>".
Rule-based, offline, cannot hallucinate.

### C. Goal-based picker (`src/utils/goalPicker.ts` pure + `GoalPicker.tsx` page + entries)
```ts
export function peptidesForGoal(category: PeptideCategory): Peptide[]; // PEPTIDES.filter
export function synergyStacksFor(category: PeptideCategory): StackRule[]; // synergy rules where both peptides are in category
```
New `/find` page: a goal grid (from `CATEGORY_LABELS`) → on pick, list that category's peptides
(name, mechanismShort, standard dose) + any synergy stacks. "Start protocol" navigates to
`/protocols/new` with `state: { preselectPeptideIds: string[] }`. `NewProtocol` reads that state
on mount and calls `selectPeptide` for each. Entry: a card on the Protocols page header area.

### D. Outcome overlay (`Protocols.tsx` journey)
Above the week list in the journey sheet, a recharts `LineChart` (mirroring `HealthMarkers.tsx`)
of one health marker across `[startDate, today]`, with a metric toggle (weight default; sleep /
energy / mood). Data via `getHealthMarkers(startDate, today)`. Empty state when no markers in
range. Reuses the existing chart styling.

## Testing

vitest covers the two pure modules (`titrationCoach`, `goalPicker`). UI verified by `npm run
build` + `npm run lint` + manual `npm run dev`.

## Risks

- Multi-peptide protocols in the journey guide: render one guide block per peptide; keep compact to avoid noise.
- Goal picker recommending contraindicated combos: only *synergy* stacks are surfaced; the existing `getStackWarnings` still guards at build time in `NewProtocol`.
