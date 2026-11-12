import type { ProtocolBreak } from '../data/protocols';

export interface Cycle {
  onWeeks: number;
  offWeeks: number;
}

/** Convert a Cycle to ProtocolBreak[] for a given total weeks. Weeks are 1-based.
 *  Off weeks of each cycle are onWeeks+1 .. onWeeks+offWeeks, repeating every (onWeeks+offWeeks) weeks,
 *  while the break start <= totalWeeks; clamp weekEnd to totalWeeks. Return [] when offWeeks < 1, onWeeks < 1,
 *  or non-integer/NaN input.
 */
export function cycleToBreaks(cycle: Cycle, totalWeeks: number): ProtocolBreak[] {
  const { onWeeks, offWeeks } = cycle;
  
  if (!Number.isInteger(onWeeks) || !Number.isInteger(offWeeks) || onWeeks < 1 || offWeeks < 1) {
    return [];
  }
  
  const breaks: ProtocolBreak[] = [];
  let currentWeek = onWeeks + 1;
  const cycleLength = onWeeks + offWeeks;
  
  while (currentWeek <= totalWeeks) {
    const breakStart = currentWeek;
    const breakEnd = Math.min(currentWeek + offWeeks - 1, totalWeeks);
    
    if (breakStart <= totalWeeks) {
      breaks.push({
        weekStart: breakStart,
        weekEnd: breakEnd,
        reason: 'Off week',
      });
    }
    
    currentWeek += cycleLength;
  }
  
  return breaks;
}

/** Convert ProtocolBreak[] to a Cycle, returning null when breaks are not perfectly regular.
 *  A perfect cycle requires:
 *  - breaks are non-empty
 *  - the first break starts at week S, so onWeeks = S-1
 *  - spacing between break starts = onWeeks + L (i.e., each break repeats every onWeeks+L weeks)
 *  - last break possibly clamped to totalWeeks
 *  Otherwise returns null (also for empty/undefined input).
 */
export function breaksToCycle(breaks: ProtocolBreak[] | undefined, totalWeeks: number): Cycle | null {
  if (!breaks || breaks.length === 0) return null;
  
  // Candidate from the first break; the last break may be clamped, so verify by regenerating.
  const cycle: Cycle = {
    onWeeks: breaks[0].weekStart - 1,
    offWeeks: breaks[0].weekEnd - breaks[0].weekStart + 1,
  };
  const computedBreaks = cycleToBreaks(cycle, totalWeeks);
  
  // Deep equality comparison (only weekStart/weekEnd matters for breaks)
  if (computedBreaks.length !== breaks.length) return null;
  
  for (let i = 0; i < breaks.length; i++) {
    if (computedBreaks[i].weekStart !== breaks[i].weekStart || 
        computedBreaks[i].weekEnd !== breaks[i].weekEnd) {
      return null;
    }
  }
  
  return cycle;
}