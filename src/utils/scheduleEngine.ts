import { addDays, addWeeks, format, eachDayOfInterval, isBefore, parseISO } from 'date-fns';
import { type Peptide, type SchedulePhase, getPeptideById } from '../data/peptides';
import type { ProtocolBreak } from '../data/protocols';
import type { ScheduledDose } from '../db/schema';
import { SITE_LABELS } from '../data/injectionSites';

/** A scheduled dose before an owner is assigned. Owner is stamped at the save boundary. */
export type DraftDose = Omit<ScheduledDose, 'owner'>;

interface ScheduleConfig {
  peptideId: string;
  dose: number;
  unit: 'mcg' | 'mg' | 'IU';
  frequency: string;
  customFrequencyDays?: number;
  // Only used when frequency is 'weekly_days': 0=Sunday..6=Saturday.
  daysOfWeek?: number[];
  timesPerDay?: number;
  timeOfDay: string;
  startDate: string;
  durationWeeks: number;
  protocolId: string;
  schedulePhases?: SchedulePhase[];
  protocolBreaks?: ProtocolBreak[];
}

function generateId(): string {
  return crypto.randomUUID();
}

function getTimeString(timeOfDay: string): string {
  switch (timeOfDay) {
    case 'morning_fasting': return '06:30';
    case 'morning': return '08:00';
    case 'evening': return '18:00';
    case 'pre_bed': return '22:00';
    case 'before_activity': return '19:00';
    default: return '09:00';
  }
}

function suggestSite(index: number): string {
  return SITE_LABELS[index % SITE_LABELS.length];
}

/** Returns true if the given 1-based week number falls within any protocol break. */
function isInBreak(weekNum: number, breaks?: ProtocolBreak[]): boolean {
  if (!breaks || breaks.length === 0) return false;
  return breaks.some(b => weekNum >= b.weekStart && weekNum <= b.weekEnd);
}

export function generateSchedule(config: ScheduleConfig): DraftDose[] {
  const peptide = getPeptideById(config.peptideId);
  const doses: DraftDose[] = [];
  const startDate = parseISO(config.startDate);
  const endDate = addWeeks(startDate, config.durationWeeks);
  const timeStr = getTimeString(config.timeOfDay);

  if (config.schedulePhases && config.schedulePhases.length > 0) {
    return generatePhasedSchedule(config, peptide, timeStr);
  }

  // Non-positive duration → no schedule. Without this the daily path feeds
  // eachDayOfInterval a start-after-end range and throws (mirrors the negative
  // custom-interval guard below).
  if (!(config.durationWeeks > 0)) return [];

  const hasTitration = peptide?.dosing.titration && peptide.dosing.titration.length > 0;

  let doseIndex = 0;

  if (config.frequency === 'daily') {
    const days = eachDayOfInterval({ start: startDate, end: addDays(endDate, -1) });
    for (const day of days) {
      const weekNum = Math.floor((day.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (isInBreak(weekNum, config.protocolBreaks)) continue;
      const currentDose = hasTitration ? getTitrationDose(peptide!, weekNum, config.dose) : config.dose;
      const currentUnit = hasTitration ? (peptide!.dosing.titration![0].unit) : config.unit;
      const prevWeekDose = hasTitration && weekNum > 1 ? getTitrationDose(peptide!, weekNum - 1, config.dose) : currentDose;
      const isStepUp = hasTitration && currentDose !== prevWeekDose && day.getDay() === startDate.getDay();

      const timesPerDay = config.timesPerDay || 1;
      for (let t = 0; t < timesPerDay; t++) {
        const adjustedTime = timesPerDay > 1
          ? (t === 0 ? '08:00' : '22:00')
          : timeStr;

        doses.push({
          id: generateId(),
          protocolId: config.protocolId,
          peptideId: config.peptideId,
          date: format(day, 'yyyy-MM-dd'),
          time: adjustedTime,
          dose: currentDose,
          unit: currentUnit,
          route: peptide?.route || 'subq',
          status: 'upcoming',
          suggestedSite: peptide?.route === 'subq' || peptide?.route === 'im' ? suggestSite(doseIndex) : undefined,
          isTitrationStepUp: isStepUp,
          weekNumber: weekNum,
        });
        doseIndex++;
      }
    }
  } else if (config.frequency === 'eod') {
    let current = startDate;
    while (isBefore(current, endDate)) {
      const weekNum = Math.floor((current.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (isInBreak(weekNum, config.protocolBreaks)) { current = addDays(current, 2); continue; }
      const currentDose = hasTitration ? getTitrationDose(peptide!, weekNum, config.dose) : config.dose;

      doses.push({
        id: generateId(),
        protocolId: config.protocolId,
        peptideId: config.peptideId,
        date: format(current, 'yyyy-MM-dd'),
        time: timeStr,
        dose: currentDose,
        unit: config.unit,
        route: peptide?.route || 'subq',
        status: 'upcoming',
        suggestedSite: suggestSite(doseIndex),
        weekNumber: weekNum,
      });
      doseIndex++;
      current = addDays(current, 2);
    }
  } else if (config.frequency === 'weekly') {
    let current = startDate;
    while (isBefore(current, endDate)) {
      const weekNum = Math.floor((current.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (isInBreak(weekNum, config.protocolBreaks)) { current = addDays(current, 7); continue; }
      const currentDose = hasTitration ? getTitrationDose(peptide!, weekNum, config.dose) : config.dose;
      const currentUnit = hasTitration ? (peptide!.dosing.titration![0].unit) : config.unit;
      const prevWeekDose = weekNum > 1 && hasTitration ? getTitrationDose(peptide!, weekNum - 1, config.dose) : currentDose;

      doses.push({
        id: generateId(),
        protocolId: config.protocolId,
        peptideId: config.peptideId,
        date: format(current, 'yyyy-MM-dd'),
        time: timeStr,
        dose: currentDose,
        unit: currentUnit,
        route: peptide?.route || 'subq',
        status: 'upcoming',
        suggestedSite: suggestSite(doseIndex),
        isTitrationStepUp: currentDose !== prevWeekDose,
        weekNumber: weekNum,
      });
      doseIndex++;
      current = addDays(current, 7);
    }
  } else if (config.frequency === 'biweekly') {
    let current = startDate;
    while (isBefore(current, endDate)) {
      const weekNum = Math.floor((current.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (isInBreak(weekNum, config.protocolBreaks)) { current = addDays(current, 14); continue; }
      doses.push({
        id: generateId(),
        protocolId: config.protocolId,
        peptideId: config.peptideId,
        date: format(current, 'yyyy-MM-dd'),
        time: timeStr,
        dose: config.dose,
        unit: config.unit,
        route: peptide?.route || 'subq',
        status: 'upcoming',
        suggestedSite: suggestSite(doseIndex),
        weekNumber: weekNum,
      });
      doseIndex++;
      current = addDays(current, 14);
    }
  } else if (config.frequency === 'weekly_days' && config.daysOfWeek && config.daysOfWeek.length > 0) {
    const days = eachDayOfInterval({ start: startDate, end: addDays(endDate, -1) });
    for (const day of days) {
      if (!config.daysOfWeek.includes(day.getDay())) continue;
      const weekNum = Math.floor((day.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (isInBreak(weekNum, config.protocolBreaks)) continue;
      const currentDose = hasTitration ? getTitrationDose(peptide!, weekNum, config.dose) : config.dose;
      const currentUnit = hasTitration ? (peptide!.dosing.titration![0].unit) : config.unit;
      const prevWeekDose = hasTitration && weekNum > 1 ? getTitrationDose(peptide!, weekNum - 1, config.dose) : currentDose;

      doses.push({
        id: generateId(),
        protocolId: config.protocolId,
        peptideId: config.peptideId,
        date: format(day, 'yyyy-MM-dd'),
        time: timeStr,
        dose: currentDose,
        unit: currentUnit,
        route: peptide?.route || 'subq',
        status: 'upcoming',
        suggestedSite: suggestSite(doseIndex),
        isTitrationStepUp: hasTitration && currentDose !== prevWeekDose,
        weekNumber: weekNum,
      });
      doseIndex++;
    }
  } else if (config.frequency === 'custom' && config.customFrequencyDays && config.customFrequencyDays > 0) {
    let current = startDate;
    while (isBefore(current, endDate)) {
      const weekNum = Math.floor((current.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (isInBreak(weekNum, config.protocolBreaks)) { current = addDays(current, config.customFrequencyDays); continue; }
      doses.push({
        id: generateId(),
        protocolId: config.protocolId,
        peptideId: config.peptideId,
        date: format(current, 'yyyy-MM-dd'),
        time: timeStr,
        dose: config.dose,
        unit: config.unit,
        route: peptide?.route || 'subq',
        status: 'upcoming',
        suggestedSite: suggestSite(doseIndex),
        weekNumber: weekNum,
      });
      doseIndex++;
      current = addDays(current, config.customFrequencyDays);
    }
  }

  return doses;
}

function getTitrationDose(peptide: Peptide, weekNumber: number, startDose?: number): number {
  const titration = peptide.dosing.titration;
  if (!titration || titration.length === 0) return peptide.dosing.standard;

  let base = titration[titration.length - 1].dose;
  for (const step of titration) {
    if (weekNumber >= step.weekStart && weekNumber <= step.weekEnd) {
      base = step.dose;
      break;
    }
  }

  // Honor a user-chosen starting dose by scaling the whole ladder proportionally,
  // so someone can start Retatrutide at 0.5mg instead of the stock 2mg week-1 step.
  const firstStep = titration[0].dose;
  if (startDose && startDose > 0 && firstStep > 0 && startDose !== firstStep) {
    return Math.round(base * (startDose / firstStep) * 1000) / 1000;
  }
  return base;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Generate doses for a tapered protocol: walk day by day, and for each day emit a
// dose only if the active phase's cadence lands on it. Weeks with no phase are off.
function generatePhasedSchedule(config: ScheduleConfig, peptide: Peptide | undefined, timeStr: string): DraftDose[] {
  const phases = config.schedulePhases!;
  const startDate = parseISO(config.startDate);
  const totalWeeks = phasesTotalWeeks(phases);
  // Non-positive duration → no schedule. Without this eachDayOfInterval gets a
  // start-after-end range and throws (mirrors the flat-path guard above).
  if (!(totalWeeks > 0)) return [];
  const days = eachDayOfInterval({ start: startDate, end: addDays(addWeeks(startDate, totalWeeks), -1) });
  const hasTitration = !!peptide?.dosing.titration && peptide.dosing.titration.length > 0;

  const doses: DraftDose[] = [];
  let doseIndex = 0;

  for (const day of days) {
    const dayOffset = Math.round((day.getTime() - startDate.getTime()) / MS_PER_DAY);
    const weekNum = Math.floor(dayOffset / 7) + 1;
    // Protocol-level breaks override even active phases — weeks in a break get no doses.
    if (isInBreak(weekNum, config.protocolBreaks)) continue;
    const phase = phases.find(p => weekNum >= p.weekStart && weekNum <= p.weekEnd);
    if (!phase) continue; // off week

    const dow = day.getDay();
    let emit = false;
    switch (phase.frequency) {
      case 'daily': emit = true; break;
      case '5x_week': emit = dow !== 0 && dow !== 6; break; // weekdays
      case 'eod': emit = dayOffset % 2 === 0; break;
      case 'weekly': emit = dow === startDate.getDay(); break;
      case 'weekly_days': emit = phase.daysOfWeek?.includes(dow) ?? false; break;
      default: emit = true;
    }
    if (!emit) continue;

    doses.push({
      id: generateId(),
      protocolId: config.protocolId,
      peptideId: config.peptideId,
      date: format(day, 'yyyy-MM-dd'),
      time: timeStr,
      dose: hasTitration ? getTitrationDose(peptide!, weekNum, config.dose) : config.dose,
      unit: hasTitration ? peptide!.dosing.titration![0].unit : config.unit,
      route: peptide?.route || 'subq',
      status: 'upcoming',
      suggestedSite: peptide?.route === 'subq' || peptide?.route === 'im' ? suggestSite(doseIndex) : undefined,
      weekNumber: weekNum,
    });
    doseIndex++;
  }

  return doses;
}

export function phasesTotalWeeks(phases: SchedulePhase[]): number {
  return phases.reduce((max, p) => Math.max(max, p.weekEnd), 0);
}

const FREQ_SHORT: Record<string, string> = {
  daily: 'Daily', '5x_week': '5×/wk', eod: 'EOD', weekly: 'Weekly', biweekly: 'Bi-weekly', custom: 'Custom',
};
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function phaseFrequencyLabel(p: SchedulePhase): string {
  if (p.frequency === 'weekly_days' && p.daysOfWeek?.length) {
    return p.daysOfWeek.map(d => WEEKDAY_SHORT[d]).join('/');
  }
  return FREQ_SHORT[p.frequency] ?? p.frequency;
}

// "Daily ×2wk → 5×/wk ×2wk → off"
export function summarizePhases(phases: SchedulePhase[]): string {
  if (!phases.length) return '';
  const parts = phases.map(p => `${phaseFrequencyLabel(p)} ×${p.weekEnd - p.weekStart + 1}wk`);
  return `${parts.join(' → ')} → off`;
}

export function extendSchedule(
  existingDoses: ScheduledDose[],
  additionalWeeks: number,
  config: ScheduleConfig,
): DraftDose[] {
  const lastDose = existingDoses
    .filter(d => d.peptideId === config.peptideId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .pop();

  if (!lastDose) return [];

  const newStart = addDays(parseISO(lastDose.date), 1);
  return generateSchedule({
    ...config,
    startDate: format(newStart, 'yyyy-MM-dd'),
    durationWeeks: additionalWeeks,
  });
}
