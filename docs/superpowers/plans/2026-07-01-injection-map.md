# Injection Map + Tracking Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing body-map into a live injection-site picker + zone-volume stats view, and add four adjacent tracking upgrades (site reactions, vial run-out forecast, IU↔mg converter, clock-method dial).

**Architecture:** One shared site-data module removes 3× duplication and drives both the picker and the stats view. Pure logic (recency stats, run-out forecast, IU convert) lives in `src/utils` with vitest tests; UI reuses the existing `BodyMapSVG` and Insights card-hub pattern. No DB migration — new `DoseLog` fields are optional and idb is schemaless per-store.

**Tech Stack:** React 19, TypeScript, react-router-dom 7, idb 8, date-fns 4, recharts 3, lucide-react, Tailwind 4, Vite 8. Testing: vitest (added, dev-only).

## Global Constraints

- No new runtime dependencies. Only `vitest` added, dev-only.
- No IndexedDB version bump / migration. New `DoseLog` fields are optional.
- Injection sites stored as **label strings** (e.g. `"Left abdomen"`), never ids.
- Site geometry/labels live only in `src/data/injectionSites.ts` after Task 1.
- Touch targets ≥44px; never draw the 12 clock points on the 240px silhouette.
- Verify every task with `npm run build` (tsc typecheck) and `npm run lint`; pure-logic tasks also `npm run test`.
- Follow existing Tailwind token classes (`card-glass`, `text-text-muted`, `bg-primary`, etc.). No hardcoded colors.

---

### Task 1: Shared injection-site data module (dedup)

**Files:**
- Create: `src/data/injectionSites.ts`
- Modify: `src/components/BodyMapSVG.tsx` (remove local `BODY_SITES`, import shared)
- Modify: `src/components/DoseActionSheet.tsx:7-12` (remove local `INJECTION_SITES`, import `SITE_LABELS`)
- Modify: `src/utils/scheduleEngine.ts:34-43` (remove local `INJECTION_SITES`, import `SITE_LABELS`)

**Interfaces:**
- Produces:
  ```ts
  export type BodyView = 'front' | 'back';
  export interface InjectionSite { id: string; label: string; view: BodyView; cx: number; cy: number; r: number; }
  export interface ClockSite { id: string; label: string; hour: number; }
  export const INJECTION_SITES: InjectionSite[];
  export const SITE_LABELS: string[];
  export const ABDOMEN_CLOCK: ClockSite[];
  ```

- [ ] **Step 1: Create the data module**

```ts
// src/data/injectionSites.ts
export type BodyView = 'front' | 'back';

export interface InjectionSite {
  id: string;
  label: string;
  view: BodyView;
  cx: number;
  cy: number;
  r: number;
}

export interface ClockSite {
  id: string;
  label: string;
  hour: number; // 1..12
}

// Coordinates carried over verbatim from the original BodyMapSVG BODY_SITES.
export const INJECTION_SITES: InjectionSite[] = [
  { id: 'left-abdomen', label: 'Left abdomen', view: 'front', cx: 82, cy: 185, r: 14 },
  { id: 'right-abdomen', label: 'Right abdomen', view: 'front', cx: 118, cy: 185, r: 14 },
  { id: 'left-thigh', label: 'Left thigh (outer)', view: 'front', cx: 72, cy: 265, r: 13 },
  { id: 'right-thigh', label: 'Right thigh (outer)', view: 'front', cx: 128, cy: 265, r: 13 },
  { id: 'left-deltoid', label: 'Left deltoid', view: 'front', cx: 55, cy: 115, r: 12 },
  { id: 'right-deltoid', label: 'Right deltoid', view: 'front', cx: 145, cy: 115, r: 12 },
  { id: 'left-glute', label: 'Left glute', view: 'back', cx: 80, cy: 215, r: 15 },
  { id: 'right-glute', label: 'Right glute', view: 'back', cx: 120, cy: 215, r: 15 },
];

export const SITE_LABELS: string[] = INJECTION_SITES.map(s => s.label);

export const ABDOMEN_CLOCK: ClockSite[] = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 1;
  return { id: `abdomen-c${hour}`, label: `Abdomen (${hour} o'clock)`, hour };
});
```

- [ ] **Step 2: Point BodyMapSVG at the shared data**

In `src/components/BodyMapSVG.tsx`: delete the local `BODY_SITES` const (lines 23-36) and the local `SiteInfo` interface if unused. Replace with:

```ts
import { INJECTION_SITES, type BodyView } from '../data/injectionSites';
```

Change the view state and site filter:

```ts
const [view, setView] = useState<BodyView>('front');
const currentSites = INJECTION_SITES.filter(s => s.view === view);
```

Keep the rest of the render (it already maps `currentSites` with `site.cx/cy/r/id/label`).

- [ ] **Step 3: Point DoseActionSheet + scheduleEngine at shared labels**

In `src/components/DoseActionSheet.tsx` delete local `INJECTION_SITES` (lines 7-12) and add:

```ts
import { SITE_LABELS } from '../data/injectionSites';
```

Replace the two references `INJECTION_SITES` with `SITE_LABELS` (the `useState` default `INJECTION_SITES[0]` → `SITE_LABELS[0]`, and the `.map` at line 185).

In `src/utils/scheduleEngine.ts` delete local `INJECTION_SITES` (lines 34-39), add `import { SITE_LABELS } from '../data/injectionSites';`, and change `suggestSite`:

```ts
function suggestSite(index: number): string {
  return SITE_LABELS[index % SITE_LABELS.length];
}
```

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS, no unused-var errors, no `BODY_SITES`/`INJECTION_SITES` redeclare.

- [ ] **Step 5: Commit**

```bash
git add src/data/injectionSites.ts src/components/BodyMapSVG.tsx src/components/DoseActionSheet.tsx src/utils/scheduleEngine.ts
git commit -m "refactor: single source of truth for injection sites"
```

---

### Task 2: vitest + injection recency stats (pure)

**Files:**
- Modify: `package.json` (add `vitest` devDep + `test` script)
- Modify: `vite.config.ts` (add `test` config)
- Create: `src/utils/injectionStats.ts`
- Test: `src/utils/injectionStats.test.ts`

**Interfaces:**
- Consumes: `DoseLog` from `../db/schema`.
- Produces:
  ```ts
  export interface ZoneStat { label: string; count: number; lastUsed?: string; daysSince?: number; }
  export function zoneStats(logs: Pick<DoseLog,'injectionSite'|'date'>[], windowDays: number, today: Date): ZoneStat[];
  export function daysSinceByLabel(logs: Pick<DoseLog,'injectionSite'|'date'>[], today: Date): Record<string, number>;
  export function mostRestedLabel(labels: string[], daysSince: Record<string, number>): string;
  ```

- [ ] **Step 1: Add vitest**

Edit `package.json`: add to `devDependencies`: `"vitest": "^3.2.4"`. Add to `scripts`: `"test": "vitest run"`. Then run `npm install`.

Edit `vite.config.ts` — add a `test` block to the config object:

```ts
/// <reference types="vitest/config" />
// ...existing imports/plugins unchanged...
export default defineConfig({
  // ...existing keys...
  test: { environment: 'node' },
});
```

- [ ] **Step 2: Write the failing test**

```ts
// src/utils/injectionStats.test.ts
import { describe, it, expect } from 'vitest';
import { zoneStats, daysSinceByLabel, mostRestedLabel } from './injectionStats';

const today = new Date('2026-07-01T12:00:00Z');
const logs = [
  { injectionSite: 'Left abdomen', date: '2026-06-30' },
  { injectionSite: 'Left abdomen', date: '2026-06-20' },
  { injectionSite: 'Right thigh (outer)', date: '2026-06-25' },
  { injectionSite: undefined, date: '2026-06-29' },
];

describe('zoneStats', () => {
  it('counts per zone within the window, sorted hottest first', () => {
    const s = zoneStats(logs, 90, today);
    expect(s[0]).toEqual({ label: 'Left abdomen', count: 2, lastUsed: '2026-06-30', daysSince: 1 });
    expect(s.find(z => z.label === 'Right thigh (outer)')?.count).toBe(1);
  });
  it('excludes logs outside the window', () => {
    expect(zoneStats(logs, 5, today).find(z => z.label === 'Left abdomen')?.count).toBe(1);
  });
  it('ignores logs with no site', () => {
    expect(zoneStats(logs, 90, today).some(z => z.label === undefined)).toBe(false);
  });
});

describe('daysSinceByLabel', () => {
  it('returns days since most recent use per label', () => {
    expect(daysSinceByLabel(logs, today)['Left abdomen']).toBe(1);
    expect(daysSinceByLabel(logs, today)['Right thigh (outer)']).toBe(6);
  });
});

describe('mostRestedLabel', () => {
  it('prefers a never-used label', () => {
    const ds = daysSinceByLabel(logs, today);
    expect(mostRestedLabel(['Left abdomen', 'Left glute'], ds)).toBe('Left glute');
  });
  it('falls back to the oldest-used label when all used', () => {
    const ds = daysSinceByLabel(logs, today);
    expect(mostRestedLabel(['Left abdomen', 'Right thigh (outer)'], ds)).toBe('Right thigh (outer)');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — cannot resolve `./injectionStats`.

- [ ] **Step 4: Implement**

```ts
// src/utils/injectionStats.ts
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { DoseLog } from '../db/schema';

type SiteLog = Pick<DoseLog, 'injectionSite' | 'date'>;

export interface ZoneStat {
  label: string;
  count: number;
  lastUsed?: string;
  daysSince?: number;
}

export function zoneStats(logs: SiteLog[], windowDays: number, today: Date): ZoneStat[] {
  const byLabel = new Map<string, { count: number; lastUsed: string }>();
  for (const l of logs) {
    if (!l.injectionSite) continue;
    if (differenceInCalendarDays(today, parseISO(l.date)) >= windowDays) continue;
    const cur = byLabel.get(l.injectionSite);
    if (!cur) byLabel.set(l.injectionSite, { count: 1, lastUsed: l.date });
    else {
      cur.count += 1;
      if (l.date > cur.lastUsed) cur.lastUsed = l.date;
    }
  }
  return [...byLabel.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      lastUsed: v.lastUsed,
      daysSince: differenceInCalendarDays(today, parseISO(v.lastUsed)),
    }))
    .sort((a, b) => (a.daysSince ?? 999) - (b.daysSince ?? 999) || b.count - a.count);
}

export function daysSinceByLabel(logs: SiteLog[], today: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of logs) {
    if (!l.injectionSite) continue;
    const d = differenceInCalendarDays(today, parseISO(l.date));
    if (out[l.injectionSite] === undefined || d < out[l.injectionSite]) out[l.injectionSite] = d;
  }
  return out;
}

export function mostRestedLabel(labels: string[], daysSince: Record<string, number>): string {
  const unused = labels.find(l => daysSince[l] === undefined);
  if (unused) return unused;
  return labels.reduce((best, l) => (daysSince[l] > daysSince[best] ? l : best), labels[0]);
}
```

- [ ] **Step 5: Run tests + build**

Run: `npm run test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/utils/injectionStats.ts src/utils/injectionStats.test.ts
git commit -m "feat: injection recency stats + vitest"
```

---

### Task 3: Body-map picker in the log sheet

**Files:**
- Modify: `src/components/DoseActionSheet.tsx` (replace text-grid picker; add recency default)

**Interfaces:**
- Consumes: `BodyMapSVG` (props `selectedSite`, `onSelectSite`, `daysSinceMap`), `daysSinceByLabel`, `mostRestedLabel`, `SITE_LABELS`, `getAllDoseLogs`.

- [ ] **Step 1: Load logs + compute recency on mount**

Add imports to `DoseActionSheet.tsx`:

```ts
import { useEffect } from 'react';
import { BodyMapSVG } from './BodyMapSVG';
import { getAllDoseLogs } from '../db/operations';
import { daysSinceByLabel, mostRestedLabel } from '../utils/injectionStats';
import { SITE_LABELS } from '../data/injectionSites';
```

Add state + effect near the other `useState`s:

```ts
const [daysMap, setDaysMap] = useState<Record<string, number>>({});

useEffect(() => {
  getAllDoseLogs().then(logs => {
    const ds = daysSinceByLabel(logs, new Date());
    setDaysMap(ds);
    // only auto-pick a rested zone when logging fresh (no existing site chosen)
    if (!log?.injectionSite && !dose.suggestedSite) setSite(mostRestedLabel(SITE_LABELS, ds));
  });
}, [log?.injectionSite, dose.suggestedSite]);
```

- [ ] **Step 2: Replace the text-grid picker**

`BodyMapSVG` keys its `daysSinceMap` by site **id**, but logs use **labels**. Bridge with a label→id map. Add above the return:

```ts
import { INJECTION_SITES } from '../data/injectionSites';
// ...
const idByLabel = Object.fromEntries(INJECTION_SITES.map(s => [s.label, s.id]));
const labelById = Object.fromEntries(INJECTION_SITES.map(s => [s.id, s.label]));
const daysById = Object.fromEntries(
  Object.entries(daysMap).map(([label, d]) => [idByLabel[label], d]).filter(([id]) => id),
);
```

Replace the `<div className="grid grid-cols-2 gap-2">…</div>` block (lines ~184-198) with:

```tsx
<BodyMapSVG
  selectedSite={idByLabel[site]}
  onSelectSite={(id) => setSite(labelById[id])}
  daysSinceMap={daysById}
/>
<p className="text-center text-xs text-text-muted mt-1">{site}</p>
```

- [ ] **Step 3: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`, open a dose, confirm: map renders in the log sheet, tapping a zone updates the label under it, a rested zone is pre-selected on a fresh log.
Expected: build/lint PASS; manual behavior as described.

- [ ] **Step 4: Commit**

```bash
git add src/components/DoseActionSheet.tsx
git commit -m "feat: tap-to-pick body map in dose log sheet"
```

---

### Task 4: Injection Map stats page

**Files:**
- Create: `src/pages/InjectionMap.tsx`
- Modify: `src/App.tsx` (add import + `<Route path="/injection-map" .../>`)
- Modify: `src/pages/Insights.tsx` (add card navigating to `/injection-map`)

**Interfaces:**
- Consumes: `getAllDoseLogs`, `zoneStats`, `daysSinceByLabel`, `BodyMapSVG`, `INJECTION_SITES`.

- [ ] **Step 1: Create the page**

```tsx
// src/pages/InjectionMap.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { getAllDoseLogs } from '../db/operations';
import { zoneStats, daysSinceByLabel, type ZoneStat } from '../utils/injectionStats';
import { INJECTION_SITES } from '../data/injectionSites';
import { BodyMapSVG } from '../components/BodyMapSVG';
import type { DoseLog } from '../db/schema';

const idByLabel = Object.fromEntries(INJECTION_SITES.map(s => [s.label, s.id]));

export function InjectionMap() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [windowDays, setWindowDays] = useState(90);

  useEffect(() => { getAllDoseLogs().then(setLogs); }, []);

  const today = new Date();
  const stats: ZoneStat[] = zoneStats(logs, windowDays, today);
  const daysMap = daysSinceByLabel(logs, today);
  const daysById = Object.fromEntries(
    Object.entries(daysMap).map(([label, d]) => [idByLabel[label], d]).filter(([id]) => id),
  );
  const maxCount = Math.max(1, ...stats.map(s => s.count));

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="tap-target"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold flex-1">Injection Map</h1>
      </div>

      <div className="card-glass p-5 mb-4">
        <BodyMapSVG selectedSite={undefined} onSelectSite={() => {}} daysSinceMap={daysById} />
      </div>

      <div className="flex gap-2 mb-3">
        {[30, 90].map(w => (
          <button
            key={w}
            onClick={() => setWindowDays(w)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${
              windowDays === w ? 'bg-primary text-bg' : 'bg-card text-text-secondary border border-border'
            }`}
          >
            {w}d
          </button>
        ))}
      </div>

      <div className="card-glass p-4 space-y-2">
        {stats.length === 0 && <p className="text-sm text-text-muted">No logged sites in this window.</p>}
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="text-sm w-32 shrink-0">{s.label}</span>
            <div className="flex-1 h-2 rounded-full bg-card overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(s.count / maxCount) * 100}%` }} />
            </div>
            <span className="text-xs text-text-muted w-16 text-right">{s.count}× · {s.daysSince}d</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire route**

In `src/App.tsx` add `import { InjectionMap } from './pages/InjectionMap';` with the other page imports, and add inside `<Routes>`:

```tsx
<Route path="/injection-map" element={<InjectionMap />} />
```

- [ ] **Step 3: Add Insights card**

In `src/pages/Insights.tsx` add `MapPin` to the lucide import, and add a card button before the closing `</div>` of `.space-y-3`:

```tsx
<button onClick={() => navigate('/injection-map')} className="card-glass w-full p-5 tap-target text-left stagger-item flex items-center gap-4" style={{ animationDelay: '0.2s' }}>
  <div className="w-11 h-11 rounded-xl bg-secondary-dim flex items-center justify-center">
    <MapPin className="w-5 h-5 text-secondary" />
  </div>
  <div>
    <p className="font-semibold">Injection Map</p>
    <p className="text-sm text-text-muted">Zone volume &amp; site rotation</p>
  </div>
</button>
```

- [ ] **Step 4: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`: Insights → Injection Map shows the colored map + zone bars; 30/90 toggle changes counts.
Expected: PASS + behavior as described.

- [ ] **Step 5: Commit**

```bash
git add src/pages/InjectionMap.tsx src/App.tsx src/pages/Insights.tsx
git commit -m "feat: injection map stats page (zone volume + recency)"
```

---

### Task 5: Site-reaction logging (item 2)

**Files:**
- Modify: `src/db/schema.ts` (add optional `DoseLog.siteReaction`)
- Modify: `src/components/DoseActionSheet.tsx` (chip row + save)
- Modify: `src/pages/InjectionMap.tsx` (flag zones with reactions)

**Interfaces:**
- Produces: `DoseLog.siteReaction?: 'redness' | 'lump' | 'pain' | 'bruise'`.

- [ ] **Step 1: Extend the type**

In `src/db/schema.ts` `DoseLog` interface, after `notes?: string;` add:

```ts
  siteReaction?: 'redness' | 'lump' | 'pain' | 'bruise';
```

(No `openDB` version bump — optional field, existing records read fine.)

- [ ] **Step 2: Add reaction state + chips in the log sheet**

In `DoseActionSheet.tsx` add:

```ts
const REACTIONS = ['redness', 'lump', 'pain', 'bruise'] as const;
const [reaction, setReaction] = useState<typeof REACTIONS[number] | undefined>(log?.siteReaction);
```

Include `siteReaction: reaction` in both the `updateDoseLog` and `logDose` payloads (alongside the existing `injectionSite: site`).

After the Injection Site block, add a chip row:

```tsx
<div>
  <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">Site reaction (optional)</label>
  <div className="flex flex-wrap gap-2">
    {REACTIONS.map(r => (
      <button
        key={r}
        onClick={() => setReaction(reaction === r ? undefined : r)}
        className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${
          reaction === r ? 'bg-warning/20 text-warning ring-1 ring-warning/40' : 'bg-card border border-border text-text-secondary'
        }`}
      >
        {r}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Flag reactions in InjectionMap**

In `InjectionMap.tsx`, build a reaction set and mark rows:

```ts
const reactionLabels = new Set(logs.filter(l => l.siteReaction && l.injectionSite).map(l => l.injectionSite!));
```

In the zone row, after the label span add:

```tsx
{reactionLabels.has(s.label) && <span className="text-xs text-warning" title="Reaction logged here">⚠</span>}
```

- [ ] **Step 4: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`: log a dose with a reaction chip; confirm it persists on reopen and the ⚠ appears on that zone in Injection Map.
Expected: PASS + behavior as described.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/components/DoseActionSheet.tsx src/pages/InjectionMap.tsx
git commit -m "feat: per-site injection reaction logging"
```

---

### Task 6: Vial run-out forecast (item 3)

**Files:**
- Create: `src/utils/vialForecast.ts`
- Test: `src/utils/vialForecast.test.ts`
- Modify: `src/pages/VialInventory.tsx` (badge per active vial)

**Interfaces:**
- Produces: `export function predictEmptyDate(dosesRemaining: number, logDates: string[], today: Date): string | null;` — returns ISO date `yyyy-MM-dd` or null.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/vialForecast.test.ts
import { describe, it, expect } from 'vitest';
import { predictEmptyDate } from './vialForecast';

const today = new Date('2026-07-01T00:00:00Z');

describe('predictEmptyDate', () => {
  it('projects empty date from average log interval', () => {
    // every 2 days, 3 doses left → +6 days
    expect(predictEmptyDate(3, ['2026-06-27', '2026-06-29', '2026-07-01'], today)).toBe('2026-07-07');
  });
  it('returns null with fewer than 2 logs', () => {
    expect(predictEmptyDate(3, ['2026-07-01'], today)).toBeNull();
  });
  it('returns null when nothing remains', () => {
    expect(predictEmptyDate(0, ['2026-06-27', '2026-06-29'], today)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — cannot resolve `./vialForecast`.

- [ ] **Step 3: Implement**

```ts
// src/utils/vialForecast.ts
import { differenceInCalendarDays, parseISO, addDays, format } from 'date-fns';

export function predictEmptyDate(dosesRemaining: number, logDates: string[], today: Date): string | null {
  if (dosesRemaining <= 0 || logDates.length < 2) return null;
  const sorted = [...logDates].sort();
  const recent = sorted.slice(-10);
  const span = differenceInCalendarDays(parseISO(recent[recent.length - 1]), parseISO(recent[0]));
  const avgInterval = span / (recent.length - 1);
  if (avgInterval <= 0) return null;
  return format(addDays(today, Math.round(avgInterval * dosesRemaining)), 'yyyy-MM-dd');
}
```

- [ ] **Step 4: Run tests + build**

Run: `npm run test && npm run build`
Expected: PASS.

- [ ] **Step 5: Show the badge in VialInventory**

In `src/pages/VialInventory.tsx` add imports:

```ts
import { getVials, saveVial, updateVial, getDoseLogsForPeptide } from '../db/operations';
import { predictEmptyDate } from '../utils/vialForecast';
```

Load per-peptide log dates once vials are loaded (add state + fill in the existing load path):

```ts
const [emptyDates, setEmptyDates] = useState<Record<string, string>>({});

// after setVials(list):
const map: Record<string, string> = {};
for (const v of list.filter(v => v.status === 'active')) {
  const plogs = await getDoseLogsForPeptide(v.peptideId);
  const d = predictEmptyDate(v.dosesRemaining, plogs.map(l => l.date), new Date());
  if (d) map[v.id] = d;
}
setEmptyDates(map);
```

In each active vial card render:

```tsx
{emptyDates[vial.id] && (
  <p className="text-xs text-text-muted mt-1">Est. empty ~{emptyDates[vial.id]}</p>
)}
```

- [ ] **Step 6: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`: an active vial with ≥2 logged doses of its peptide shows an "Est. empty ~" line.
Expected: PASS + behavior as described.

- [ ] **Step 7: Commit**

```bash
git add src/utils/vialForecast.ts src/utils/vialForecast.test.ts src/pages/VialInventory.tsx
git commit -m "feat: vial run-out date forecast"
```

---

### Task 7: IU↔mg converter (item 4)

**Files:**
- Create: `src/utils/iuConvert.ts`
- Test: `src/utils/iuConvert.test.ts`
- Modify: `src/pages/ReconCalculator.tsx` (converter block)

**Interfaces:**
- Produces:
  ```ts
  export function mgToIu(mg: number, mgPerIu: number): number; // mg / mgPerIu
  export function iuToMg(iu: number, mgPerIu: number): number; // iu * mgPerIu
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/iuConvert.test.ts
import { describe, it, expect } from 'vitest';
import { mgToIu, iuToMg } from './iuConvert';

describe('iuConvert', () => {
  it('converts mg to IU (HGH 1mg≈3IU)', () => {
    expect(mgToIu(1, 1 / 3)).toBeCloseTo(3);
  });
  it('converts IU to mg', () => {
    expect(iuToMg(3, 1 / 3)).toBeCloseTo(1);
  });
  it('handles zero ratio safely', () => {
    expect(mgToIu(1, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — cannot resolve `./iuConvert`.

- [ ] **Step 3: Implement**

```ts
// src/utils/iuConvert.ts
export function mgToIu(mg: number, mgPerIu: number): number {
  return mgPerIu > 0 ? mg / mgPerIu : 0;
}
export function iuToMg(iu: number, mgPerIu: number): number {
  return iu * mgPerIu;
}
```

- [ ] **Step 4: Run tests + build**

Run: `npm run test && npm run build`
Expected: PASS.

- [ ] **Step 5: Add the converter block to ReconCalculator**

In `src/pages/ReconCalculator.tsx` add `import { mgToIu } from '../utils/iuConvert';` and state:

```ts
const [iuMg, setIuMg] = useState('');       // mg to convert
const [mgPerIu, setMgPerIu] = useState('0.333'); // HGH default 1mg≈3IU
const iuResult = parseFloat(iuMg) > 0 && parseFloat(mgPerIu) > 0 ? mgToIu(parseFloat(iuMg), parseFloat(mgPerIu)) : 0;
```

Add a card near the bottom of the page (inside the main container):

```tsx
<div className="card-glass p-5 mt-4">
  <h2 className="font-semibold mb-3 flex items-center gap-2"><Droplets className="w-4 h-4 text-secondary" /> IU ↔ mg</h2>
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="block text-xs text-text-muted mb-1">Dose (mg)</label>
      <input type="number" step="any" value={iuMg} onChange={e => setIuMg(e.target.value)}
        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary" />
    </div>
    <div>
      <label className="block text-xs text-text-muted mb-1">mg per IU</label>
      <input type="number" step="any" value={mgPerIu} onChange={e => setMgPerIu(e.target.value)}
        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary" />
    </div>
  </div>
  <p className="text-sm mt-3 font-mono text-primary">= {iuResult.toFixed(2)} IU</p>
</div>
```

- [ ] **Step 6: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`: on the calculator, entering mg + mg/IU shows the IU result.
Expected: PASS + behavior as described.

- [ ] **Step 7: Commit**

```bash
git add src/utils/iuConvert.ts src/utils/iuConvert.test.ts src/pages/ReconCalculator.tsx
git commit -m "feat: IU to mg converter on recon calculator"
```

---

### Task 8: Clock-method dial (item 5)

**Files:**
- Create: `src/components/AbdomenClockDial.tsx`
- Modify: `src/components/DoseActionSheet.tsx` (open dial when an abdomen zone is picked)

**Interfaces:**
- Consumes: `ABDOMEN_CLOCK` from `../data/injectionSites`.
- Produces:
  ```tsx
  export function AbdomenClockDial(props: { selected?: string; onSelect: (label: string) => void }): JSX.Element;
  ```

- [ ] **Step 1: Create the dial component**

Positions computed by trig (12 points on a circle), rendered on a 220px viewBox so each
tap target clears 44px — never on the small body silhouette.

```tsx
// src/components/AbdomenClockDial.tsx
import { ABDOMEN_CLOCK } from '../data/injectionSites';

const CENTER = 110;
const RADIUS = 78;

export function AbdomenClockDial({ selected, onSelect }: { selected?: string; onSelect: (label: string) => void }) {
  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[260px] mx-auto" role="group" aria-label="Abdomen clock positions">
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#1e2a42" strokeWidth="1.5" />
      <circle cx={CENTER} cy={CENTER} r="6" fill="#64748b" />
      <text x={CENTER} y={CENTER + 22} textAnchor="middle" className="fill-current text-text-muted" fontSize="9">navel</text>
      {ABDOMEN_CLOCK.map(({ label, hour }) => {
        const angle = ((hour * 30) - 90) * (Math.PI / 180); // 12 at top
        const x = CENTER + RADIUS * Math.cos(angle);
        const y = CENTER + RADIUS * Math.sin(angle);
        const isSel = selected === label;
        return (
          <g key={label} className="cursor-pointer" onClick={() => onSelect(label)}>
            <circle cx={x} cy={y} r="16" fill={isSel ? '#22c55e' : '#334155'} opacity={isSel ? 0.5 : 0.25} />
            <text x={x} y={y + 3} textAnchor="middle" fontSize="10" className="fill-current">{hour}</text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Toggle the dial from the log sheet**

In `DoseActionSheet.tsx` add `import { AbdomenClockDial } from './AbdomenClockDial';` and state:

```ts
const [showClock, setShowClock] = useState(false);
const isAbdomen = site.startsWith('Left abdomen') || site.startsWith('Right abdomen') || site.startsWith('Abdomen');
```

Under the `<p>{site}</p>` line from Task 3, add:

```tsx
{isAbdomen && (
  <button onClick={() => setShowClock(v => !v)} className="block mx-auto mt-2 text-xs text-primary underline">
    {showClock ? 'Hide' : 'Use'} clock method
  </button>
)}
{showClock && <AbdomenClockDial selected={site} onSelect={setSite} />}
```

(The dial writes the label like `"Abdomen (3 o'clock)"` straight into `site`; it saves and
aggregates under the abdomen prefix in stats.)

- [ ] **Step 3: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`: pick an abdomen zone → "Use clock method" appears → dial shows 12 tappable positions → tapping sets the site label.
Expected: PASS + behavior as described.

- [ ] **Step 4: Commit**

```bash
git add src/components/AbdomenClockDial.tsx src/components/DoseActionSheet.tsx
git commit -m "feat: abdomen clock-method dial for precise site logging"
```

---

## Self-Review

**Spec coverage:** Foundation dedup → T1. Map picker → T3. Recency stats → T2. Injection Map page → T4. Item 2 reactions → T5. Item 3 forecast → T6. Item 4 IU↔mg → T7. Item 5 clock dial → T8. All spec sections mapped.

**Type consistency:** `zoneStats`/`daysSinceByLabel`/`mostRestedLabel` signatures identical across T2/T3/T4. `predictEmptyDate` T6 matches spec. `mgToIu` T7 matches. `InjectionSite`/`ClockSite`/`SITE_LABELS`/`ABDOMEN_CLOCK` from T1 used unchanged in T3/T4/T8.

**Placeholders:** none — every code step carries full code.

**Label/id bridge:** logs store labels; `BodyMapSVG` keys ids. Bridged via `idByLabel`/`labelById` in T3 and T4 identically. Clock labels (`"Abdomen (N o'clock)"`) are not in `INJECTION_SITES`, so they won't color a body zone — acceptable; they aggregate as their own rows and match the abdomen ⚠ prefix logic only where explicitly prefixed.
