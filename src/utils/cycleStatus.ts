import { parseISO, differenceInCalendarDays, addDays, format } from 'date-fns';
import { type Cycle, cycleToBreaks, breaksToCycle } from './cycle';
import type { ProtocolBreak } from '../data/protocols';
import type { UserProtocol } from '../db/schema';

export type CycleState = 'on' | 'off' | 'upcoming' | 'done';

export interface CycleStatus {
  state: CycleState;
  weekNum: number;          // 1-based week of the protocol today (may be <1 or > total)
  totalWeeks: number;
  weekInPhase: number;      // 1-based week within the current on/off phase (0 when upcoming/done)
  phaseWeeks: number;       // length of the current phase in weeks (0 when upcoming/done)
  nextChange: { date: string; to: 'on' | 'off' | 'end' | 'start'; daysUntil: number } | null; // date yyyy-MM-dd
  strip: boolean[];         // true=ON per week for weeks 1..min(totalWeeks, 24)
}

export function cycleStatus(args: {
  startDate: string;
  durationWeeks: number;
  cycle?: Cycle | null;
  breaks?: ProtocolBreak[];
  today: string;
}): CycleStatus {
  const { startDate, durationWeeks, cycle, breaks, today } = args;
  const start = parseISO(startDate);
  const current = parseISO(today);
  
  // Calculate weekNum using the same logic as scheduleEngine.ts
  const weekNum = Math.floor(differenceInCalendarDays(current, start) / 7) + 1;
  
  // Determine effective off ranges
  let effectiveBreaks: ProtocolBreak[] = [];
  if (cycle) {
    effectiveBreaks = cycleToBreaks(cycle, durationWeeks);
  } else if (breaks && breaks.length > 0) {
    effectiveBreaks = breaks;
  }
  
  // Handle states based on week comparison
  if (weekNum < 1) {
    // upcoming - before start
    const nextChange = {
      date: startDate,
      to: 'start' as const,
      daysUntil: differenceInCalendarDays(start, current)
    };
    return {
      state: 'upcoming',
      weekNum,
      totalWeeks: durationWeeks,
      weekInPhase: 0,
      phaseWeeks: 0,
      nextChange,
      strip: getStripState(durationWeeks, effectiveBreaks)
    };
  } else if (weekNum > durationWeeks) {
    // done - after duration
    return {
      state: 'done',
      weekNum,
      totalWeeks: durationWeeks,
      weekInPhase: 0,
      phaseWeeks: 0,
      nextChange: null,
      strip: getStripState(durationWeeks, effectiveBreaks)
    };
  }
  
  // Determine if current week is in break/off range
  const isOff = isInBreak(weekNum, effectiveBreaks);
  const state: CycleState = isOff ? 'off' : 'on';
  
  // Find the current phase (contiguous run of same state)
  const phaseInfo = findPhaseInfo(weekNum, durationWeeks, effectiveBreaks, state);
  
  // Find next change week
  const nextChangeWeek = findNextChangeWeek(weekNum, durationWeeks, effectiveBreaks);
  const nextChange = nextChangeWeek
    ? {
        date: formatDate(startDate, nextChangeWeek),
        to: nextChangeWeek > durationWeeks ? 'end' as const : (isInBreak(nextChangeWeek, effectiveBreaks) ? 'off' as const : 'on' as const),
        daysUntil: differenceInCalendarDays(parseISO(formatDate(startDate, nextChangeWeek)), current)
      }
    : null;
  
  return {
    state,
    weekNum,
    totalWeeks: durationWeeks,
    weekInPhase: phaseInfo.weekInPhase,
    phaseWeeks: phaseInfo.phaseWeeks,
    nextChange,
    strip: getStripState(durationWeeks, effectiveBreaks)
  };
}

export function protocolCycle(
  p: Pick<UserProtocol, 'doses' | 'breaks' | 'durationWeeks'>,
  peptideId: string
): { cycle: Cycle | null; durationWeeks: number } {
  const dose = p.doses.find(d => d.peptideId === peptideId);
  const doseDuration = dose?.durationWeeks ?? p.durationWeeks;
  
  const cycle = dose?.cycle ?? breaksToCycle(p.breaks, doseDuration) ?? null;
  
  return {
    cycle,
    durationWeeks: doseDuration
  };
}

// Helper functions
function formatDate(startDate: string, weekNum: number): string {
  return format(addDays(parseISO(startDate), (weekNum - 1) * 7), 'yyyy-MM-dd');
}

function isInBreak(weekNum: number, breaks?: ProtocolBreak[]): boolean {
  if (!breaks || breaks.length === 0) return false;
  return breaks.some(b => weekNum >= b.weekStart && weekNum <= b.weekEnd);
}

function findPhaseInfo(
  weekNum: number,
  durationWeeks: number,
  breaks: ProtocolBreak[],
  currentState: 'on' | 'off'
): { weekInPhase: number; phaseWeeks: number } {
  // Find the contiguous run of weeks with the same state as weekNum
  let phaseStart = weekNum;
  let phaseEnd = weekNum;
  
  // Find the start of the current phase
  for (let w = weekNum; w >= 1; w--) {
    const wState = isInBreak(w, breaks) ? 'off' : 'on';
    if (wState === currentState) {
      phaseStart = w;
    } else {
      break;
    }
  }
  
  // Find the end of the current phase (clamp to durationWeeks)
  for (let w = weekNum; w <= durationWeeks; w++) {
    const wState = isInBreak(w, breaks) ? 'off' : 'on';
    if (wState === currentState) {
      phaseEnd = w;
    } else {
      break;
    }
  }
  
  const phaseWeeks = phaseEnd - phaseStart + 1;
  const weekInPhase = weekNum - phaseStart + 1; // 1-based position within phase
  
  return { weekInPhase, phaseWeeks };
}

function findNextChangeWeek(
  weekNum: number,
  durationWeeks: number,
  breaks: ProtocolBreak[]
): number | null {
  // Find the first week w > weekNum (w <= durationWeeks) whose state differs from today's
  const currentState = isInBreak(weekNum, breaks) ? 'off' : 'on';
  
  for (let w = weekNum + 1; w <= durationWeeks; w++) {
    const wState = isInBreak(w, breaks) ? 'off' : 'on';
    if (wState !== currentState) {
      return w;
    }
  }
  
  // If no change within duration, the course ends after the last week
  return durationWeeks + 1;
}

function getStripState(
  durationWeeks: number,
  breaks: ProtocolBreak[]
): boolean[] {
  const stripWeeks = Math.min(durationWeeks, 24);
  const strip: boolean[] = [];
  
  for (let w = 1; w <= stripWeeks; w++) {
    const isOff = isInBreak(w, breaks);
    strip.push(!isOff); // true = ON
  }
  
  return strip;
}