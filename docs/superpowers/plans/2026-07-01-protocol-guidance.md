# Protocol Guidance Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface four pieces of protocol guidance from data pepdose already holds — expected week-by-week timeline in the journey, a goal→protocol picker, a health-marker outcome overlay, and a rule-based titration coach on the dashboard.

**Architecture:** Two new pure helpers (`titrationCoach`, `goalPicker`) with vitest tests; the rest is wiring existing lookup helpers (`getCurrentWeekGuide`, `getStackWarnings`, `getHealthMarkers`) and the recharts/`card-glass`/nav-state patterns already in the app. No AI, no new deps, no DB migration.

**Tech Stack:** React 19, TypeScript, react-router-dom 7, idb 8, date-fns 4, recharts 3, lucide-react, Tailwind 4, vitest (dev-only).

## Global Constraints

- No AI/LLM anywhere. Titration coach is deterministic (reads engine `isTitrationStepUp` flags).
- No new dependencies. No IndexedDB version bump.
- Reuse existing helpers: `getCurrentWeekGuide`/`getExperienceForPeptide` (experienceTimelines), `getStackWarnings` (stackingRules), `getHealthMarkers` (operations), `CATEGORY_LABELS` (peptides).
- Existing Tailwind tokens only (`card-glass`, `text-text-muted`, `bg-primary-dim`, `text-secondary`, `bg-warning-dim`, `text-warning`, `border-border`, etc.). No hardcoded colors except where the codebase already uses SVG/inline hex (charts, category colors).
- Verify every task with `npm run build` and `npm run lint`; pure-logic tasks also `npm run test`.
- Goal picker surfaces only `synergy` stacks; never auto-adds contraindicated combos.

---

### Task 1: Expected timeline in the journey

**Files:**
- Modify: `src/pages/Protocols.tsx` (inside the `sheetMode === 'journey'` `weeks.map` block, ~line 344-395)

**Interfaces:**
- Consumes: `getCurrentWeekGuide(peptideId, week)` and `getExperienceForPeptide(peptideId)` from `../data/experienceTimelines`; `getPeptideById` (already imported).

- [ ] **Step 1: Import the guide helpers**

At the top of `Protocols.tsx`, add to the existing imports:

```ts
import { getCurrentWeekGuide } from '../data/experienceTimelines';
```

- [ ] **Step 2: Render a per-week guide block**

Inside the `weeks.map(week => (` block, immediately after the closing `</div>` of the week header (the `<div className="flex items-center gap-2 mb-2">…</div>` that renders "Week N" + the "now" badge), insert a guide block. Compute the unique peptide ids scheduled that week and render each one's guide:

```tsx
{(() => {
  const weekPeptideIds = [...new Set(sorted.filter(d => d.weekNumber === week).map(d => d.peptideId))];
  const guides = weekPeptideIds
    .map(pid => ({ pid, guide: getCurrentWeekGuide(pid, week) }))
    .filter(g => g.guide);
  if (guides.length === 0) return null;
  return (
    <div className="space-y-2 mb-2">
      {guides.map(({ pid, guide }) => (
        <div key={pid} className="rounded-xl bg-card border border-border px-3 py-2.5">
          <p className="text-xs font-semibold text-secondary mb-1">
            {getPeptideById(pid)?.name}: {guide!.title}
          </p>
          <p className="text-[11px] text-text-muted leading-relaxed">{guide!.description}</p>
          {guide!.tips.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {guide!.tips.map((tip, i) => (
                <li key={i} className="text-[11px] text-text-secondary flex gap-1.5">
                  <span className="text-secondary">•</span>{tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
})()}
```

- [ ] **Step 3: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`: open a protocol journey for a peptide with experience data (e.g. BPC-157) → each week shows its guide title/description/tips above the doses; a peptide with no guide shows nothing extra.
Expected: PASS + behavior as described.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Protocols.tsx
git commit -m "feat: weave expected week-by-week guide into protocol journey"
```

---

### Task 2: Titration coach helper (pure)

**Files:**
- Create: `src/utils/titrationCoach.ts`
- Test: `src/utils/titrationCoach.test.ts`

**Interfaces:**
- Consumes: `ScheduledDose` from `../db/schema`.
- Produces:
  ```ts
  export interface NextStep { peptideId: string; weekNumber: number; dose: number; unit: 'mcg' | 'mg'; date: string; }
  export function nextTitrationStep(doses: ScheduledDose[], today: Date): NextStep | null;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/titrationCoach.test.ts
import { describe, it, expect } from 'vitest';
import { nextTitrationStep } from './titrationCoach';
import type { ScheduledDose } from '../db/schema';

const today = new Date('2026-07-01T00:00:00Z');

function dose(partial: Partial<ScheduledDose>): ScheduledDose {
  return {
    id: 'x', protocolId: 'p', peptideId: 'reta', date: '2026-07-05', time: '09:00',
    dose: 4, unit: 'mg', route: 'subq', status: 'upcoming', weekNumber: 4,
    isTitrationStepUp: true, ...partial,
  };
}

describe('nextTitrationStep', () => {
  it('returns the earliest upcoming step-up on/after today', () => {
    const doses = [
      dose({ id: 'a', date: '2026-07-12', weekNumber: 5, dose: 6 }),
      dose({ id: 'b', date: '2026-07-05', weekNumber: 4, dose: 4 }),
    ];
    const r = nextTitrationStep(doses, today);
    expect(r).toEqual({ peptideId: 'reta', weekNumber: 4, dose: 4, unit: 'mg', date: '2026-07-05' });
  });
  it('ignores past step-ups', () => {
    const doses = [dose({ id: 'a', date: '2026-06-01', weekNumber: 1 })];
    expect(nextTitrationStep(doses, today)).toBeNull();
  });
  it('ignores non-step-up and non-upcoming doses', () => {
    const doses = [
      dose({ id: 'a', isTitrationStepUp: false }),
      dose({ id: 'b', status: 'logged' }),
    ];
    expect(nextTitrationStep(doses, today)).toBeNull();
  });
  it('returns null when there are no doses', () => {
    expect(nextTitrationStep([], today)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — cannot resolve `./titrationCoach`.

- [ ] **Step 3: Implement**

```ts
// src/utils/titrationCoach.ts
import { parseISO, differenceInCalendarDays } from 'date-fns';
import type { ScheduledDose } from '../db/schema';

export interface NextStep {
  peptideId: string;
  weekNumber: number;
  dose: number;
  unit: 'mcg' | 'mg';
  date: string;
}

export function nextTitrationStep(doses: ScheduledDose[], today: Date): NextStep | null {
  const upcoming = doses
    .filter(d => d.isTitrationStepUp && d.status === 'upcoming' && differenceInCalendarDays(parseISO(d.date), today) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  if (!next) return null;
  return { peptideId: next.peptideId, weekNumber: next.weekNumber, dose: next.dose, unit: next.unit, date: next.date };
}
```

- [ ] **Step 4: Run tests + build**

Run: `npm run test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/titrationCoach.ts src/utils/titrationCoach.test.ts
git commit -m "feat: nextTitrationStep helper for dashboard coach"
```

---

### Task 3: Titration coach card on Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `nextTitrationStep`, `NextStep` (Task 2); `getProtocols`, `getScheduledDosesForProtocol` (operations); `getPeptideById` (peptides).

- [ ] **Step 1: Load the next step-up**

In `Dashboard.tsx` add imports:

```ts
import { nextTitrationStep, type NextStep } from '../utils/titrationCoach';
import { getProtocols, getScheduledDosesForProtocol } from '../db/operations';
import { getPeptideById } from '../data/peptides';
```

(If `getProtocols`/`getScheduledDosesForProtocol`/`getPeptideById` are already imported, don't duplicate.)

Add state + a load effect near the existing dashboard data loading:

```ts
const [coach, setCoach] = useState<NextStep | null>(null);

useEffect(() => {
  (async () => {
    const active = await getProtocols('active');
    const allDoses = (await Promise.all(active.map(p => getScheduledDosesForProtocol(p.id)))).flat();
    setCoach(nextTitrationStep(allDoses, new Date()));
  })();
}, []);
```

- [ ] **Step 2: Render the coach card**

After the `nextDose` card block (the `{nextDose ? (...) : ...}` expression) and before the protocols list, add:

```tsx
{coach && (
  <div className="card-glass p-4 mb-5 stagger-item" style={{ animationDelay: '0.08s' }}>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-warning-dim flex items-center justify-center shrink-0">
        <TrendingUp className="w-5 h-5 text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Titration coach</p>
        <p className="text-sm font-medium">
          Week {coach.weekNumber} — {getPeptideById(coach.peptideId)?.name ?? coach.peptideId}: step up to {coach.dose} {coach.unit}
        </p>
      </div>
      <p className="text-xs text-text-muted shrink-0">{format(parseISO(coach.date), 'EEE MMM d')}</p>
    </div>
  </div>
)}
```

(`TrendingUp`, `format`, `parseISO`, `useState`, `useEffect` are already imported in Dashboard — confirm and only add what's missing.)

- [ ] **Step 3: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`: with an active GLP-1 protocol that titrates, the dashboard shows a "Titration coach" card naming the next step-up dose + date; a protocol with no upcoming step-up shows no card.
Expected: PASS + behavior as described.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: titration coach card on dashboard"
```

---

### Task 4: Goal-picker helpers (pure)

**Files:**
- Create: `src/utils/goalPicker.ts`
- Test: `src/utils/goalPicker.test.ts`

**Interfaces:**
- Consumes: `PEPTIDES`, `type Peptide`, `type PeptideCategory` (peptides); `STACKING_RULES`, `type StackRule` (stackingRules).
- Produces:
  ```ts
  export function peptidesForGoal(category: PeptideCategory): Peptide[];
  export function synergyStacksFor(category: PeptideCategory): StackRule[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/goalPicker.test.ts
import { describe, it, expect } from 'vitest';
import { peptidesForGoal, synergyStacksFor } from './goalPicker';

describe('peptidesForGoal', () => {
  it('returns only peptides in the given category', () => {
    const healing = peptidesForGoal('healing');
    expect(healing.length).toBeGreaterThan(0);
    expect(healing.every(p => p.category === 'healing')).toBe(true);
  });
});

describe('synergyStacksFor', () => {
  it('returns synergy stacks where both peptides are in the category', () => {
    const stacks = synergyStacksFor('healing');
    expect(stacks.every(s => s.relation === 'synergy')).toBe(true);
    // BPC-157 + TB-500 are both healing peptides and a documented synergy
    expect(stacks.some(s =>
      [s.peptideA, s.peptideB].sort().join('+') === ['bpc-157', 'tb-500'].sort().join('+')
    )).toBe(true);
  });
  it('excludes synergies whose peptides are outside the category', () => {
    const stacks = synergyStacksFor('nootropic');
    expect(stacks.every(s => s.relation === 'synergy')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — cannot resolve `./goalPicker`.

- [ ] **Step 3: Implement**

```ts
// src/utils/goalPicker.ts
import { PEPTIDES, getPeptideById, type Peptide, type PeptideCategory } from '../data/peptides';
import { STACKING_RULES, type StackRule } from '../data/stackingRules';

export function peptidesForGoal(category: PeptideCategory): Peptide[] {
  return PEPTIDES.filter(p => p.category === category);
}

export function synergyStacksFor(category: PeptideCategory): StackRule[] {
  return STACKING_RULES.filter(r => {
    if (r.relation !== 'synergy') return false;
    const a = getPeptideById(r.peptideA);
    const b = getPeptideById(r.peptideB);
    return a?.category === category && b?.category === category;
  });
}
```

- [ ] **Step 4: Run tests + build**

Run: `npm run test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/goalPicker.ts src/utils/goalPicker.test.ts
git commit -m "feat: goal-picker helpers (peptides + synergy stacks by category)"
```

---

### Task 5: Goal-picker page + entry + NewProtocol preselect

**Files:**
- Create: `src/pages/GoalPicker.tsx`
- Modify: `src/App.tsx` (import + `<Route path="/find" .../>`)
- Modify: `src/pages/Protocols.tsx` (entry card/button to `/find`)
- Modify: `src/pages/NewProtocol.tsx` (read `location.state.preselectPeptideIds` on mount)

**Interfaces:**
- Consumes: `peptidesForGoal`, `synergyStacksFor` (Task 4); `CATEGORY_LABELS`, `type PeptideCategory`, `getPeptideById` (peptides).

- [ ] **Step 1: Create the page**

```tsx
// src/pages/GoalPicker.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles, ArrowRight } from 'lucide-react';
import { CATEGORY_LABELS, getPeptideById, type PeptideCategory } from '../data/peptides';
import { peptidesForGoal, synergyStacksFor } from '../utils/goalPicker';

const GOALS = Object.entries(CATEGORY_LABELS) as [PeptideCategory, string][];

export function GoalPicker() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState<PeptideCategory | null>(null);

  const peptides = goal ? peptidesForGoal(goal) : [];
  const stacks = goal ? synergyStacksFor(goal) : [];

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => (goal ? setGoal(null) : navigate(-1))} className="tap-target" aria-label="Back">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">Find a protocol</h1>
      </div>

      {!goal ? (
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map(([cat, label]) => (
            <button key={cat} onClick={() => setGoal(cat)}
              className="card-glass p-4 tap-target text-left flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-secondary shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">{CATEGORY_LABELS[goal]} peptides</p>
          <div className="space-y-2">
            {peptides.map(p => (
              <button key={p.id}
                onClick={() => navigate('/protocols/new', { state: { preselectPeptideIds: [p.id] } })}
                className="card-glass w-full p-4 tap-target text-left flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-text-muted">{p.mechanismShort}</p>
                  <p className="text-[11px] text-text-secondary font-mono mt-0.5">
                    {p.dosing.standard} {p.dosing.unit} · {p.route}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
              </button>
            ))}
          </div>

          {stacks.length > 0 && (
            <div>
              <p className="text-sm text-text-muted mb-2">Synergy stacks</p>
              <div className="space-y-2">
                {stacks.map((s, i) => (
                  <button key={i}
                    onClick={() => navigate('/protocols/new', { state: { preselectPeptideIds: [s.peptideA, s.peptideB] } })}
                    className="card-glass w-full p-4 tap-target text-left">
                    <p className="text-sm font-semibold">
                      {getPeptideById(s.peptideA)?.name} + {getPeptideById(s.peptideB)?.name}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{s.note}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the route**

In `src/App.tsx` add `import { GoalPicker } from './pages/GoalPicker';` with the other page imports, and inside `<Routes>` (before the catch-all):

```tsx
<Route path="/find" element={<GoalPicker />} />
```

- [ ] **Step 3: Add an entry on the Protocols page**

In `src/pages/Protocols.tsx`, near the existing "new protocol" affordance in the header, add a button navigating to `/find`. Find the header row that renders the page title / the "+"/new action and add alongside it:

```tsx
<button onClick={() => navigate('/find')} className="tap-target flex items-center gap-1.5 text-xs font-medium text-secondary bg-card px-3 py-2 rounded-lg">
  <Sparkles className="w-4 h-4" /> Find
</button>
```

Add `Sparkles` to the existing `lucide-react` import in `Protocols.tsx` if not present. `navigate` is already available (`useNavigate`).

- [ ] **Step 4: NewProtocol reads the preselection**

In `src/pages/NewProtocol.tsx`:
- Add `useEffect` to the react import and `useLocation` to the router import:
  ```ts
  import { useState, useMemo, useEffect } from 'react';
  import { useNavigate, useLocation } from 'react-router-dom';
  ```
- After the state declarations and the `selectPeptide` function are defined, add:
  ```ts
  const location = useLocation();
  useEffect(() => {
    const ids = (location.state as { preselectPeptideIds?: string[] } | null)?.preselectPeptideIds;
    if (!ids?.length) return;
    ids.forEach(id => {
      const pep = getPeptideById(id);
      if (pep) selectPeptide(pep);
    });
    navigate('.', { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  ```
  (`getPeptideById` is already imported in `NewProtocol.tsx`.)

- [ ] **Step 5: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`: Protocols → "Find" → pick a goal → peptides + synergy stacks listed → tapping one lands on New Protocol with that peptide (or stack) already selected on the configure step.
Expected: PASS + behavior as described.

- [ ] **Step 6: Commit**

```bash
git add src/pages/GoalPicker.tsx src/App.tsx src/pages/Protocols.tsx src/pages/NewProtocol.tsx
git commit -m "feat: goal-based protocol picker with prefilled new protocol"
```

---

### Task 6: Outcome overlay in the journey

**Files:**
- Modify: `src/pages/Protocols.tsx` (journey sheet, above the week list)

**Interfaces:**
- Consumes: `getHealthMarkers(startDate, endDate)` (operations); recharts primitives; `format`/`parseISO` (already imported in Protocols).

- [ ] **Step 1: Imports + marker state**

In `Protocols.tsx` add:

```ts
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getHealthMarkers } from '../db/operations';
import type { HealthMarker } from '../db/schema';
```

Add state near the other journey state (`journeyDoses`, `journeyLogs`):

```ts
const [journeyMarkers, setJourneyMarkers] = useState<HealthMarker[]>([]);
const [metric, setMetric] = useState<'weight' | 'sleepQuality' | 'energy' | 'mood'>('weight');
```

In `loadJourney(protocolId)`, after loading doses/logs, also load markers for the protocol span. Fetch the protocol to get `startDate`:

```ts
const proto = await getProtocol(protocolId);
if (proto) {
  const markers = await getHealthMarkers(proto.startDate, format(new Date(), 'yyyy-MM-dd'));
  setJourneyMarkers(markers);
}
```

(`getProtocol` is already imported/available in `Protocols.tsx`; if not, add it to the operations import.)

- [ ] **Step 2: Render the overlay above the week list**

Inside the `sheetMode === 'journey'` return, right after the header `<div className="flex items-center justify-between gap-3">…</div>` (the "N of M doses logged · Week x/y" row) and before the `{sorted.length === 0 ? ... : weeks.map(...)}`, insert:

```tsx
{(() => {
  const METRICS: { key: typeof metric; label: string; color: string }[] = [
    { key: 'weight', label: 'Weight', color: '#00d4aa' },
    { key: 'sleepQuality', label: 'Sleep', color: '#6366f1' },
    { key: 'energy', label: 'Energy', color: '#f59e0b' },
    { key: 'mood', label: 'Mood', color: '#ec4899' },
  ];
  const active = METRICS.find(m => m.key === metric)!;
  const data = journeyMarkers
    .filter(m => m[metric] != null)
    .map(m => ({ date: format(parseISO(m.date), 'MMM d'), value: m[metric] as number }));
  return (
    <div className="card-glass p-3">
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
              metric === m.key ? 'bg-primary text-bg' : 'bg-card text-text-secondary border border-border'
            }`}>
            {m.label}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-6">No {active.label.toLowerCase()} logged in this range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a42" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={28} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#0f1729', border: '1px solid #1e2a42', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="value" stroke={active.color} strokeWidth={2} dot={{ r: 2 }} name={active.label} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
})()}
```

- [ ] **Step 3: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Then `npm run dev`: open a protocol journey → a metric toggle + trend chart appears above the weeks, plotting logged health markers over the protocol span; switching metric re-plots; empty state shows when a metric has no data in range.
Expected: PASS + behavior as described.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Protocols.tsx
git commit -m "feat: outcome overlay chart in protocol journey"
```

---

## Self-Review

**Spec coverage:** A (timeline in journey) → T1. D (titration coach) → T2 (helper) + T3 (card). B (goal picker) → T4 (helpers) + T5 (page/route/entry/preselect). C (outcome overlay) → T6. All spec sections mapped.

**Type consistency:** `NextStep`/`nextTitrationStep` defined T2, consumed T3 with identical signature. `peptidesForGoal`/`synergyStacksFor` defined T4, consumed T5. `metric` union in T6 matches the `HealthMarker` keys (`weight`/`sleepQuality`/`energy`/`mood`) in schema.ts. `getCurrentWeekGuide` return shape (`title`/`description`/`tips`) used in T1 matches experienceTimelines.

**Placeholders:** none — all steps carry full code.

**Constraints:** No AI (coach reads engine flags). No new deps (recharts/date-fns/lucide already present). No idb bump. Goal picker surfaces only `relation === 'synergy'`. Nav-state preselect mirrors the existing `openId` pattern; `navigate('.', {replace:true, state:null})` clears it to avoid re-adding on remount.
