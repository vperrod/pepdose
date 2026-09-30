import { describe, test, expect } from 'vitest';
import { estimateTotalDoses } from './doseEstimate';
import { type FrequencyType, type SchedulePhase } from '../data/peptides';

describe('estimateTotalDoses', () => {
  test('custom every 3 days over 4 weeks = 10', () => {
    const configs = [
      {
        frequency: 'custom' as FrequencyType,
        customFrequencyDays: 3,
      },
    ];
    expect(estimateTotalDoses(configs, 4)).toBe(10); // 4 weeks * 7 days = 28 days, every 3 days -> ceil(28/3) = 10
  });

  test('custom with 0/undefined N = 0', () => {
    const configs = [
      {
        frequency: 'custom' as FrequencyType,
        customFrequencyDays: 0,
      },
    ];
    expect(estimateTotalDoses(configs, 4)).toBe(0);
  });

  test('5x_week over 4 weeks = 20', () => {
    const configs = [
      {
        frequency: '5x_week' as FrequencyType,
      },
    ];
    expect(estimateTotalDoses(configs, 4)).toBe(20); // 4 weeks * 5 = 20
  });

  test('daily with timesPerDay 2 over 1 week = 14 (unchanged)', () => {
    const configs = [
      {
        frequency: 'daily' as FrequencyType,
        timesPerDay: 2,
      },
    ];
    expect(estimateTotalDoses(configs, 1)).toBe(14); // 1 week * 7 days * 2 = 14
  });

  test('weekly_days [1,3] over 4 weeks = 8 (unchanged)', () => {
    const configs = [
      {
        frequency: 'weekly_days' as FrequencyType,
        daysOfWeek: [1, 3], // Tue, Thu
      },
    ];
    expect(estimateTotalDoses(configs, 4)).toBe(8); // 4 weeks * 2 days = 8
  });

  test("a phases config (weekStart 1, weekEnd 2, frequency 'daily') = 14 (unchanged)", () => {
    const configs = [
      {
        frequency: 'daily' as FrequencyType, // required but not used when schedulePhases present
        schedulePhases: [
          {
            weekStart: 1,
            weekEnd: 2,
            frequency: 'daily' as FrequencyType,
          },
        ] as SchedulePhase[],
      },
    ];
    // The original code: (weekEnd - weekStart + 1) * 7 (because frequency 'daily' -> PER_WEEK['daily'] = 7)
    // (2 - 1 + 1) = 2 weeks * 7 days/week = 14 doses
    expect(estimateTotalDoses(configs, 4)).toBe(14);
  });
});