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
