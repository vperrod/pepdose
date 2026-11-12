import { describe, it, expect } from 'vitest';
import { getPeptideById } from '../data/peptides';
import { defaultCard, daysToFrequency, cycleTotalWeeks, cardToDoseConfig, cycleStrip, cardSummary } from './cycleForm';

describe('cycleForm utilities', () => {
  // Test defaultCard with real peptides from the data
  it('defaultCard for daily peptide (bpc-157)', () => {
    const peptide = getPeptideById('bpc-157');
    expect(peptide).toBeDefined();
    expect(defaultCard(peptide!)).toMatchObject({
      peptideId: 'bpc-157',
      dose: 500,
      unit: 'mcg',
      timeOfDay: 'any',
      frequency: 'daily',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      timesPerDay: 1,
      onWeeks: 6,
      offWeeks: 4,
    });
  });

  it('defaultCard for weekly peptide (semaglutide)', () => {
    const peptide = getPeptideById('semaglutide');
    expect(peptide).toBeDefined();
    expect(defaultCard(peptide!)).toMatchObject({
      peptideId: 'semaglutide',
      dose: 0.25,
      unit: 'mg',
      timeOfDay: 'any',
      frequency: 'weekly_days',
      daysOfWeek: [1],
      timesPerDay: 1,
      onWeeks: 52,
      offWeeks: 0,
    });
  });

  it('defaultCard for peptide with offCycleWeeks>0 (kpv)', () => {
    const peptide = getPeptideById('kpv');
    expect(peptide).toBeDefined();
    expect(defaultCard(peptide!)).toMatchObject({
      peptideId: 'kpv',
      dose: 500,
      unit: 'mcg',
      timeOfDay: 'morning',
      frequency: 'daily',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      timesPerDay: 1,
      onWeeks: 4,
      offWeeks: 2,
    });
  });

  it('defaultCard for peptide with protocolVariants (ghk-cu)', () => {
    const peptide = getPeptideById('ghk-cu');
    expect(peptide).toBeDefined();
    expect(defaultCard(peptide!)).toMatchObject({
      peptideId: 'ghk-cu',
      dose: 2,
      unit: 'mg',
      timeOfDay: 'any',
      frequency: 'daily',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      timesPerDay: 1,
      onWeeks: 8,
      offWeeks: 4,
      schedulePhases: [{ weekStart: 1, weekEnd: 4, frequency: 'daily' }],
      variantId: 'daily-30d',
    });
  });

  it('defaultCard for peptide with custom frequency (tb-500)', () => {
    const peptide = getPeptideById('tb-500');
    expect(peptide).toBeDefined();
    expect(defaultCard(peptide!)).toMatchObject({
      peptideId: 'tb-500',
      dose: 2.5,
      unit: 'mg',
      timeOfDay: 'any',
      frequency: 'custom',
      daysOfWeek: [],
      customFrequencyDays: 3,
      timesPerDay: 1,
      onWeeks: 6,
      offWeeks: 4,
    });
  });

  it('daysToFrequency 7 days returns daily', () => {
    expect(daysToFrequency([0, 1, 2, 3, 4, 5, 6])).toBe('daily');
  });

  it('daysToFrequency 2 days returns weekly_days', () => {
    expect(daysToFrequency([0, 1])).toBe('weekly_days');
  });

  it('cycleTotalWeeks 8/8 = 32', () => {
    expect(cycleTotalWeeks(8, 8)).toBe(32);
  });

  it('cycleTotalWeeks 4/2 = 24', () => {
    expect(cycleTotalWeeks(4, 2)).toBe(24);
  });

  it('cycleTotalWeeks 12/0 = 12', () => {
    expect(cycleTotalWeeks(12, 0)).toBe(12);
  });

  it('cycleTotalWeeks 0/3 = 1', () => {
    expect(cycleTotalWeeks(0, 3)).toBe(1);
  });

  it('cardToDoseConfig sets cycle only when off>=1', () => {
    const card = {
      peptideId: 'test',
      dose: 100,
      unit: 'mcg' as const,
      timeOfDay: 'morning_fasting' as const,
      frequency: 'daily' as const,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      timesPerDay: 1,
      onWeeks: 8,
      offWeeks: 4,
    };

    const doseConfig = cardToDoseConfig(card);

    expect(doseConfig.cycle).toEqual({ onWeeks: 8, offWeeks: 4 });

    const cardNoOff = { ...card, offWeeks: 0 };
    const doseConfigNoOff = cardToDoseConfig(cardNoOff);

    expect(doseConfigNoOff.cycle).toBeUndefined();
  });

  it('cardToDoseConfig omits daysOfWeek for daily frequency', () => {
    const card = {
      peptideId: 'test',
      dose: 100,
      unit: 'mcg' as const,
      timeOfDay: 'morning_fasting' as const,
      frequency: 'daily' as const,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      timesPerDay: 1,
      onWeeks: 8,
      offWeeks: 4,
    };

    const doseConfig = cardToDoseConfig(card);

    expect(doseConfig.daysOfWeek).toBeUndefined();
  });

  it('cycleStrip 8/8/24 has pattern 8T,8F,8T', () => {
    expect(cycleStrip(8, 8, 24)).toEqual([
      true, true, true, true, true, true, true, true, // week 1-8 ON
      false, false, false, false, false, false, false, false, // week 9-16 OFF
      true, true, true, true, true, true, true, true  // week 17-24 ON
    ]);
  });

  it('cycleStrip 2/0/2 returns [true, true]', () => {
    expect(cycleStrip(2, 0, 2)).toEqual([true, true]);
  });

  it('cardSummary for Mon+Thu 8/8', () => {
    const card = {
      peptideId: 'test',
      dose: 2,
      unit: 'mg' as const,
      timeOfDay: 'any' as const,
      frequency: 'weekly_days' as const,
      daysOfWeek: [1, 4], // Mon & Thu
      timesPerDay: 1,
      onWeeks: 8,
      offWeeks: 8,
    };

    expect(cardSummary(card)).toBe('Mon & Thu, 2 mg. 8 weeks on, 8 off.');
  });

  it('cardSummary for 12/0', () => {
    const card = {
      peptideId: 'test',
      dose: 2,
      unit: 'mg' as const,
      timeOfDay: 'any' as const,
      frequency: 'weekly_days' as const,
      daysOfWeek: [1, 4], // Mon & Thu
      timesPerDay: 1,
      onWeeks: 12,
      offWeeks: 0,
    };

    expect(cardSummary(card)).toBe('Mon & Thu, 2 mg. 12 weeks.');
  });
});