import { addDays, format, parseISO } from 'date-fns';
import { getPeptideById, type Peptide } from '../data/peptides';
import type { ProtocolBreak } from '../data/protocols';
import type { ScheduledDose, UserProtocol } from '../db/schema';
import { breaksToCycle, cycleToBreaks, type Cycle } from './cycle';
import { cardSummary, doseConfigToCard } from './cycleForm';
import { cycleStatus, type CycleStatus } from './cycleStatus';
import { phasesTotalWeeks } from './scheduleEngine';

export interface CycleWindow {
  kind: 'on' | 'off';
  weekStart: number;
  weekEnd: number;
  weeks: number;
  startDate: string;
  endDate: string; // last day of the window
  planned: number; // doses scheduled in the window, any status
  done: number; // doses logged in the window
  isNow: boolean;
}

export interface CycleMap {
  protocolId: string;
  peptideId: string;
  name: string;
  source: 'cycle' | 'breaks' | 'phases' | 'course';
  totalWeeks: number;
  startDate: string;
  endDate: string;
  windows: CycleWindow[];
  regular: Cycle | null;
  status: CycleStatus;
  setup: string;
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const weekStartDate = (start: string, week: number) => addDays(parseISO(start), (week - 1) * 7);

/** Every ON and OFF window of one peptide in one protocol, with dates and dose counts. */
export function buildCycleMap(args: {
  protocol: UserProtocol; peptideId: string; doses: ScheduledDose[]; today: string;
}): CycleMap {
  const { protocol, peptideId, doses, today } = args;
  const dose = protocol.doses.find(d => d.peptideId === peptideId);
  if (!dose) throw new Error(`Protocol ${protocol.id} has no dose for ${peptideId}`);

  const phases = dose.schedulePhases?.length ? dose.schedulePhases : undefined;
  const totalWeeks = phases ? phasesTotalWeeks(phases) : (dose.durationWeeks ?? protocol.durationWeeks);
  const offRanges: ProtocolBreak[] = dose.cycle ? cycleToBreaks(dose.cycle, totalWeeks) : (protocol.breaks ?? []);

  const isOn = (w: number) =>
    !offRanges.some(b => w >= b.weekStart && w <= b.weekEnd) &&
    (!phases || phases.some(p => w >= p.weekStart && w <= p.weekEnd));

  const runs: { kind: 'on' | 'off'; weekStart: number; weekEnd: number }[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const kind = isOn(w) ? 'on' : 'off';
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.weekEnd = w;
    else runs.push({ kind, weekStart: w, weekEnd: w });
  }

  const mine = doses.filter(d => d.protocolId === protocol.id && d.peptideId === peptideId);
  const windows: CycleWindow[] = runs.map(r => {
    const startDate = fmt(weekStartDate(protocol.startDate, r.weekStart));
    const endDate = fmt(addDays(weekStartDate(protocol.startDate, r.weekEnd + 1), -1));
    const inside = mine.filter(d => d.weekNumber >= r.weekStart && d.weekNumber <= r.weekEnd);
    return {
      ...r,
      weeks: r.weekEnd - r.weekStart + 1,
      startDate,
      endDate,
      planned: inside.length,
      done: inside.filter(d => d.status === 'logged').length,
      isNow: today >= startDate && today <= endDate,
    };
  });

  const source: CycleMap['source'] = dose.cycle ? 'cycle'
    : protocol.breaks?.length ? 'breaks'
    : phases ? 'phases' : 'course';
  const regular = phases ? null : (dose.cycle ?? breaksToCycle(protocol.breaks, totalWeeks) ?? null);
  const offWindows = windows.filter(w => w.kind === 'off');
  const status = cycleStatus({
    startDate: protocol.startDate,
    durationWeeks: totalWeeks,
    cycle: null,
    breaks: offWindows.map(w => ({ weekStart: w.weekStart, weekEnd: w.weekEnd, reason: 'Off week' })),
    today,
  });
  const endDate = windows[windows.length - 1]?.endDate ?? protocol.startDate;

  const first = cardSummary(doseConfigToCard(dose, null)).split('. ')[0].replace(/\.$/, '');
  const second = regular && regular.offWeeks >= 1 ? `${regular.onWeeks} weeks on, ${regular.offWeeks} off, repeating.`
    : source === 'phases' ? 'Phased course.'
    : offWindows.length ? `${offWindows.length} custom off window${offWindows.length === 1 ? '' : 's'}.`
    : `${totalWeeks}-week course, no off weeks.`;
  const dates = `Starts ${format(parseISO(protocol.startDate), 'EEE d MMM yyyy')}, ends ${format(parseISO(endDate), 'EEE d MMM yyyy')}.`;

  return {
    protocolId: protocol.id,
    peptideId,
    name: getPeptideById(peptideId)?.name ?? peptideId,
    source,
    totalWeeks,
    startDate: protocol.startDate,
    endDate,
    windows,
    regular,
    status,
    setup: `${first}. ${second} ${dates}`,
  };
}

export type Verdict =
  | 'matches' | 'no-off' | 'longer-on' | 'shorter-on' | 'shorter-off' | 'longer-off' | 'extra-off' | 'custom' | 'none';

export interface Suggestion {
  typical: { onWeeks: number; offWeeks: number } | null;
  reason: string;
  verdict: Verdict;
  text: string;
  variants: { id: string; name: string; description: string }[];
}

/** How the saved cycle compares with the peptide's own typical cycle. */
export function suggestionFor(map: CycleMap, peptide: Peptide | undefined): Suggestion {
  if (!peptide) {
    return { typical: null, reason: '', verdict: 'none', text: 'No suggestion available.', variants: [] };
  }
  const typical = { onWeeks: peptide.dosing.cycleWeeks, offWeeks: peptide.dosing.offCycleWeeks };
  const variants = (peptide.dosing.protocolVariants ?? []).map(v => ({ id: v.id, name: v.name, description: v.description }));
  const base = { typical, reason: peptide.cyclingReason ?? '', variants };
  const hasOff = map.windows.some(w => w.kind === 'off');
  const mine = map.regular;
  const t = `Typical is ${typical.onWeeks} on, ${typical.offWeeks} off.`;

  if (typical.offWeeks === 0) {
    return hasOff
      ? { ...base, verdict: 'extra-off', text: `Typical is no off weeks (up to ${typical.onWeeks} weeks continuous). Yours has off weeks.` }
      : { ...base, verdict: 'matches', text: 'Matches the typical: no off weeks.' };
  }
  if (!hasOff) return { ...base, verdict: 'no-off', text: `${t} Yours has no off weeks.` };
  if (!mine) return { ...base, verdict: 'custom', text: `${t} Yours uses custom off windows.` };
  if (mine.onWeeks === typical.onWeeks && mine.offWeeks === typical.offWeeks) {
    return { ...base, verdict: 'matches', text: `Matches the typical ${typical.onWeeks} on, ${typical.offWeeks} off.` };
  }
  const yours = `${t} Yours is ${mine.onWeeks} on, ${mine.offWeeks} off.`;
  const verdict: Verdict = mine.onWeeks > typical.onWeeks ? 'longer-on'
    : mine.onWeeks < typical.onWeeks ? 'shorter-on'
    : mine.offWeeks < typical.offWeeks ? 'shorter-off' : 'longer-off';
  return { ...base, verdict, text: yours };
}

export function cycleFromSuggestion(s: Suggestion): Cycle | null {
  return s.typical && s.typical.offWeeks >= 1 ? { onWeeks: s.typical.onWeeks, offWeeks: s.typical.offWeeks } : null;
}

export interface ReviewItem { severity: 'info' | 'warn'; text: string }

const WORTH_A_LOOK: Verdict[] = ['no-off', 'custom', 'longer-on', 'shorter-off', 'extra-off'];

/** Things worth knowing about one protocol when reviewing it. */
export function reviewItems(map: CycleMap, protocol: Pick<UserProtocol, 'status'>, suggestion: Suggestion): ReviewItem[] {
  const items: ReviewItem[] = [];
  if (protocol.status === 'paused') items.push({ severity: 'warn', text: 'Paused: no doses are being scheduled.' });
  if (protocol.status === 'completed' || protocol.status === 'archived') items.push({ severity: 'info', text: 'Finished protocol.' });
  if (map.status.state === 'done') items.push({ severity: 'info', text: 'Course has ended.' });
  const next = map.status.nextChange;
  if (map.status.state !== 'done' && next?.to === 'end' && next.daysUntil <= 14) {
    items.push({ severity: 'warn', text: `Course ends in ${next.daysUntil} days.` });
  }
  if (WORTH_A_LOOK.includes(suggestion.verdict)) items.push({ severity: 'warn', text: suggestion.text });
  if (map.source === 'breaks' && map.regular === null) {
    items.push({ severity: 'info', text: 'Off weeks come from an older template, not an editable cycle.' });
  }
  return items;
}
