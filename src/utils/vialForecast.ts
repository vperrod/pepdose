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
