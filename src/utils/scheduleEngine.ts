import { addDays, addWeeks, format, eachDayOfInterval, isBefore, parseISO } from 'date-fns';
import { type Peptide, getPeptideById } from '../data/peptides';
import type { ScheduledDose } from '../db/schema';

interface ScheduleConfig {
  peptideId: string;
  dose: number;
  unit: 'mcg' | 'mg';
  frequency: string;
  customFrequencyDays?: number;
  timesPerDay?: number;
  timeOfDay: string;
  startDate: string;
  durationWeeks: number;
  protocolId: string;
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

const INJECTION_SITES = [
  'Left abdomen', 'Right abdomen',
  'Left thigh (outer)', 'Right thigh (outer)',
  'Left deltoid', 'Right deltoid',
  'Left glute', 'Right glute',
];

function suggestSite(index: number): string {
  return INJECTION_SITES[index % INJECTION_SITES.length];
}

export function generateSchedule(config: ScheduleConfig): ScheduledDose[] {
  const peptide = getPeptideById(config.peptideId);
  const doses: ScheduledDose[] = [];
  const startDate = parseISO(config.startDate);
  const endDate = addWeeks(startDate, config.durationWeeks);
  const timeStr = getTimeString(config.timeOfDay);
  const hasTitration = peptide?.dosing.titration && peptide.dosing.titration.length > 0;

  let doseIndex = 0;

  if (config.frequency === 'daily') {
    const days = eachDayOfInterval({ start: startDate, end: addDays(endDate, -1) });
    for (const day of days) {
      const weekNum = Math.floor((day.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      const currentDose = hasTitration ? getTitrationDose(peptide!, weekNum) : config.dose;
      const currentUnit = hasTitration ? (peptide!.dosing.titration![0].unit) : config.unit;
      const prevWeekDose = hasTitration && weekNum > 1 ? getTitrationDose(peptide!, weekNum - 1) : currentDose;
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
      const currentDose = hasTitration ? getTitrationDose(peptide!, weekNum) : config.dose;

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
      const currentDose = hasTitration ? getTitrationDose(peptide!, weekNum) : config.dose;
      const currentUnit = hasTitration ? (peptide!.dosing.titration![0].unit) : config.unit;
      const prevWeekDose = weekNum > 1 && hasTitration ? getTitrationDose(peptide!, weekNum - 1) : currentDose;

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
  } else if (config.frequency === 'custom' && config.customFrequencyDays) {
    let current = startDate;
    while (isBefore(current, endDate)) {
      const weekNum = Math.floor((current.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
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

function getTitrationDose(peptide: Peptide, weekNumber: number): number {
  const titration = peptide.dosing.titration;
  if (!titration || titration.length === 0) return peptide.dosing.standard;

  for (const step of titration) {
    if (weekNumber >= step.weekStart && weekNumber <= step.weekEnd) {
      return step.dose;
    }
  }
  return titration[titration.length - 1].dose;
}

export function updateFutureDoses(
  existingDoses: ScheduledDose[],
  fromDate: string,
  updates: Partial<Pick<ScheduledDose, 'dose' | 'unit' | 'time'>>,
): ScheduledDose[] {
  return existingDoses.map(d => {
    if (d.status === 'upcoming' && d.date >= fromDate) {
      return { ...d, ...updates, editNote: `Modified on ${format(new Date(), 'yyyy-MM-dd')}` };
    }
    return d;
  });
}

export function extendSchedule(
  existingDoses: ScheduledDose[],
  additionalWeeks: number,
  config: ScheduleConfig,
): ScheduledDose[] {
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
