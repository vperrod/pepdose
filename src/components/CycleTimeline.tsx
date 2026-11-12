import { useEffect, useRef } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { CycleMap } from '../utils/cycleMap';

const MAX_WEEKS = 60;
const MIN_WEEK_PX = 16;

/** One row per peptide on a shared week grid: green = ON, amber = OFF, the line is today. */
export function CycleTimeline({ maps, today, pausedIds, onOpen }: {
  maps: CycleMap[]; today: string; pausedIds?: Set<string>; onOpen: (m: CycleMap) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const empty = maps.length === 0;

  let gridStart = empty ? today : maps.map(m => m.startDate).sort()[0];
  const gridEnd = empty ? today : maps.map(m => m.endDate).sort().reverse()[0];
  let weeks = Math.floor(differenceInCalendarDays(parseISO(gridEnd), parseISO(gridStart)) / 7) + 1;
  if (weeks > MAX_WEEKS) {
    // A very long plan: show the stretch around today instead of squeezing everything.
    gridStart = format(addDays(parseISO(today), -56), 'yyyy-MM-dd');
    weeks = MAX_WEEKS;
  }

  const colOf = (date: string) => Math.floor(differenceInCalendarDays(parseISO(date), parseISO(gridStart)) / 7) + 1;
  const todayCol = colOf(today);
  const todayInRange = todayCol >= 1 && todayCol <= weeks;

  // Open scrolled to today so the current window is in view on a narrow screen.
  useEffect(() => {
    const el = scroller.current;
    if (el && todayInRange) el.scrollLeft = Math.max(0, (todayCol - 1) * MIN_WEEK_PX - el.clientWidth / 3);
  }, [todayCol, todayInRange, weeks]);

  if (empty) return null;

  const months: { col: number; label: string }[] = [];
  for (let c = 1; c <= weeks; c++) {
    const d = addDays(parseISO(gridStart), (c - 1) * 7);
    const label = format(d, 'MMM');
    if (c === 1 || label !== months[months.length - 1].label) months.push({ col: c, label });
  }

  return (
    <div ref={scroller} className="overflow-x-auto -mx-1 px-1">
      <div style={{ minWidth: weeks * MIN_WEEK_PX }}>
        <div className="grid text-[10px] text-text-muted mb-1" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }} aria-hidden="true">
          {months.map((m, i) => (
            <span key={m.col} style={{ gridColumn: `${m.col} / ${i + 1 < months.length ? months[i + 1].col : weeks + 1}` }}>{m.label}</span>
          ))}
        </div>
        <div className="space-y-3">
          {maps.map(m => (
            <div key={`${m.protocolId}-${m.peptideId}`} className={pausedIds?.has(m.protocolId) ? 'opacity-50' : undefined}>
              <button onClick={() => onOpen(m)} className="w-full text-left flex items-baseline gap-2 mb-1">
                <span className="font-semibold text-sm">{m.name}</span>
                <span className="text-xs text-text-muted truncate">
                  {pausedIds?.has(m.protocolId) ? 'paused · ' : ''}{m.regular && m.regular.offWeeks >= 1 ? `${m.regular.onWeeks} on / ${m.regular.offWeeks} off` : m.source === 'course' ? `${m.totalWeeks}-week course` : 'custom windows'}
                </span>
              </button>
              <div className="relative grid h-6" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
                {m.windows.map(w => {
                  const from = Math.max(1, colOf(w.startDate));
                  const to = Math.min(weeks, colOf(w.endDate));
                  if (to < from) return null;
                  return (
                    <div
                      key={w.weekStart}
                      title={`${w.kind === 'on' ? 'ON' : 'OFF'} · weeks ${w.weekStart}–${w.weekEnd} · ${format(parseISO(w.startDate), 'd MMM')} to ${format(parseISO(w.endDate), 'd MMM yyyy')}`}
                      className={`text-[10px] leading-6 px-1 overflow-hidden whitespace-nowrap border-r border-bg ${w.kind === 'on' ? 'bg-green-500/80 text-bg' : 'bg-amber-500/40 text-amber-200'}`}
                      style={{ gridColumn: `${from} / ${to + 1}` }}
                    >
                      {w.kind === 'on' ? 'ON' : 'OFF'} {w.weekStart}–{w.weekEnd}
                    </div>
                  );
                })}
                {todayInRange && (
                  <div
                    data-testid="today-line"
                    className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-text pointer-events-none"
                    style={{ left: `${((todayCol - 1) / weeks) * 100}%` }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
