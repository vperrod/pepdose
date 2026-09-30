import { type FrequencyType, type SchedulePhase } from '../data/peptides';

/**
 * Estimate total number of doses for a set of peptide configurations over a duration.
 * This function replicates the logic from NewProtocol.tsx's totalDoses useMemo,
 * but with fixes for the 'custom' and '5x_week' frequencies.
 */
export function estimateTotalDoses(
  configs: Array<{
    frequency: FrequencyType;
    customFrequencyDays?: number;
    timesPerDay?: number;
    daysOfWeek?: number[];
    durationWeeks?: number;
    schedulePhases?: Array<{
      weekStart: number;
      weekEnd: number;
      frequency: FrequencyType;
      daysOfWeek?: number[];
    }>;
  }>,
  durationWeeks: number
): number {
  if (configs.length === 0) return 0;

  const PER_WEEK: Record<string, number> = {
    daily: 7,
    '5x_week': 5,
    eod: 3.5,
    weekly: 1,
    biweekly: 0.5,
    custom: 7, // kept for backward compatibility in phases, but not used in non-phase custom
  };

  const perWeekForPhase = (p: SchedulePhase) =>
    p.frequency === 'weekly_days' ? (p.daysOfWeek?.length ?? 0) : (PER_WEEK[p.frequency] ?? 7);

  return configs.reduce((sum, config) => {
    if (config.schedulePhases?.length) {
      return sum + Math.round(
        config.schedulePhases.reduce(
          (s, p) => s + (p.weekEnd - p.weekStart + 1) * perWeekForPhase(p),
          0
        )
      );
    }

    const weeks = config.durationWeeks ?? durationWeeks;
    const daysInCycle = weeks * 7;

    switch (config.frequency) {
      case 'daily':
        return sum + daysInCycle * (config.timesPerDay ?? 1);
      case 'eod':
        return sum + Math.ceil(daysInCycle / 2);
      case 'weekly':
        return sum + weeks;
      case 'biweekly':
        return sum + Math.ceil(weeks / 2);
      case 'weekly_days':
        return sum + weeks * (config.daysOfWeek?.length ?? 0);
      case '5x_week':
        return sum + weeks * 5;
      case 'custom': {
        const n = config.customFrequencyDays ?? 0;
        return sum + (n > 0 ? Math.ceil(daysInCycle / n) : 0);
      }
      default:
        // Fallback for any other frequency (should not happen with valid FrequencyType)
        return sum + daysInCycle;
    }
  }, 0);
}