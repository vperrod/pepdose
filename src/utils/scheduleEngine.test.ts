import { describe, it, expect } from 'vitest';
import { generateSchedule, extendSchedule, phasesTotalWeeks, summarizePhases } from './scheduleEngine';
import { getPeptideById } from '../data/peptides';
import type { ScheduledDose } from '../db/schema';

// Retatrutide ladder: wk1-4 = 2mg, wk5-8 = 4mg, ... (see data/peptides.ts)
const RETA = {
  peptideId: 'retatrutide',
  unit: 'mg' as const,
  frequency: 'weekly',
  timeOfDay: 'morning',
  startDate: '2026-01-05', // Monday
  durationWeeks: 8,
  protocolId: 'p1',
};

describe('titration dose scaling', () => {
  it('leaves the stock ladder unchanged when the start dose equals the first step', () => {
    const doses = generateSchedule({ ...RETA, dose: 2 });
    expect(doses[0].dose).toBe(2); // week 1
    expect(doses[4].dose).toBe(4); // week 5
  });

  it('scales the whole ladder to a gentler chosen start dose', () => {
    const doses = generateSchedule({ ...RETA, dose: 0.5 }); // quarter of the 2mg step
    expect(doses[0].dose).toBe(0.5); // week 1: 2 * 0.25
    expect(doses[4].dose).toBe(1); //   week 5: 4 * 0.25
  });
});

// Unknown peptide id -> no titration ladder, so frequency math is isolated.
const PLAIN = {
  peptideId: 'no-such-peptide',
  dose: 250,
  unit: 'mcg' as const,
  timeOfDay: 'morning',
  startDate: '2026-01-05', // Monday
  durationWeeks: 1,
  protocolId: 'p1',
};

describe('generateSchedule frequency branches', () => {
  it('daily emits one dose per day', () => {
    const doses = generateSchedule({ ...PLAIN, frequency: 'daily' });
    expect(doses.map(d => d.date)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11',
    ]);
  });

  it('daily with timesPerDay=2 emits morning and pre-bed doses', () => {
    const doses = generateSchedule({ ...PLAIN, frequency: 'daily', timesPerDay: 2 });
    expect(doses.slice(0, 2).map(d => d.time)).toEqual(['08:00', '22:00']);
  });

  it('eod emits every other day', () => {
    const doses = generateSchedule({ ...PLAIN, frequency: 'eod' });
    expect(doses.map(d => d.date)).toEqual(['2026-01-05', '2026-01-07', '2026-01-09', '2026-01-11']);
  });

  it('weekly emits one dose per week', () => {
    const doses = generateSchedule({ ...PLAIN, frequency: 'weekly', durationWeeks: 3 });
    expect(doses.map(d => d.date)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19']);
  });

  it('biweekly emits one dose every 14 days', () => {
    const doses = generateSchedule({ ...PLAIN, frequency: 'biweekly', durationWeeks: 4 });
    expect(doses.map(d => d.date)).toEqual(['2026-01-05', '2026-01-19']);
  });

  it('custom emits on the chosen day interval', () => {
    const doses = generateSchedule({ ...PLAIN, frequency: 'custom', customFrequencyDays: 3 });
    expect(doses.map(d => d.date)).toEqual(['2026-01-05', '2026-01-08', '2026-01-11']);
  });

  it('custom without a day interval emits nothing', () => {
    expect(generateSchedule({ ...PLAIN, frequency: 'custom' })).toEqual([]);
  });

  it('non-positive durationWeeks emits nothing instead of throwing', () => {
    expect(generateSchedule({ ...PLAIN, frequency: 'daily', durationWeeks: 0 })).toEqual([]);
    expect(generateSchedule({ ...PLAIN, frequency: 'daily', durationWeeks: -2 })).toEqual([]);
  });

  it('custom with a negative day interval emits nothing instead of looping forever', () => {
    expect(generateSchedule({ ...PLAIN, frequency: 'custom', customFrequencyDays: -1 })).toEqual([]);
  });

  it('weekly_days emits exactly on the chosen weekdays, every week, with no drift', () => {
    // 2026-01-05 is a Monday. Choosing Mon(1) + Thu(4) must give exactly 2/week
    // for every week of the run — the whole point vs. a custom N-day interval.
    const doses = generateSchedule({
      ...PLAIN, frequency: 'weekly_days', daysOfWeek: [1, 4], durationWeeks: 3,
    });
    expect(doses.map(d => d.date)).toEqual([
      '2026-01-05', '2026-01-08',
      '2026-01-12', '2026-01-15',
      '2026-01-19', '2026-01-22',
    ]);
  });

  it('weekly_days without any days chosen emits nothing', () => {
    expect(generateSchedule({ ...PLAIN, frequency: 'weekly_days', daysOfWeek: [] })).toEqual([]);
    expect(generateSchedule({ ...PLAIN, frequency: 'weekly_days' })).toEqual([]);
  });

  it('phased schedules follow each phase cadence and skip off weeks', () => {
    const doses = generateSchedule({
      ...PLAIN,
      frequency: 'daily',
      schedulePhases: [
        { weekStart: 1, weekEnd: 1, frequency: 'daily' },
        { weekStart: 3, weekEnd: 3, frequency: 'weekly' }, // week 2 is off
      ],
    });
    expect(doses.map(d => d.date)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11',
      '2026-01-19',
    ]);
  });

  it('phased weekly_days emits on the phase\'s chosen weekdays', () => {
    const doses = generateSchedule({
      ...PLAIN,
      frequency: 'daily',
      durationWeeks: 2,
      schedulePhases: [{ weekStart: 1, weekEnd: 2, frequency: 'weekly_days', daysOfWeek: [1, 4] }],
    });
    expect(doses.map(d => d.date)).toEqual(['2026-01-05', '2026-01-08', '2026-01-12', '2026-01-15']);
  });

  it("NAD+ Steady 100mg variant is genuinely twice weekly, not once", () => {
    // Regression: this variant used to hardcode frequency 'weekly' (once/week)
    // despite its own name and description promising twice weekly.
    const nad = getPeptideById('nad-plus')!;
    const steady = nad.dosing.protocolVariants!.find(v => v.id === 'steady-100')!;
    const doses = generateSchedule({
      ...PLAIN, peptideId: 'nad-plus', dose: 100, frequency: 'daily', schedulePhases: steady.phases,
    });
    const perWeek = new Map<number, number>();
    for (const d of doses) perWeek.set(d.weekNumber!, (perWeek.get(d.weekNumber!) ?? 0) + 1);
    expect([...perWeek.values()]).toEqual([2, 2, 2, 2]);
  });

  it('phased 5x_week skips weekends', () => {
    const doses = generateSchedule({
      ...PLAIN,
      frequency: 'daily',
      schedulePhases: [{ weekStart: 1, weekEnd: 1, frequency: '5x_week' }],
    });
    expect(doses.map(d => d.date)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
    ]);
  });

  it('phased schedule with non-positive total weeks emits nothing instead of throwing', () => {
    expect(generateSchedule({
      ...PLAIN,
      frequency: 'daily',
      schedulePhases: [{ weekStart: 0, weekEnd: 0, frequency: 'daily' }],
    })).toEqual([]);
  });

  it('protocolBreaks suppress dose generation during break weeks (daily)', () => {
    const doses = generateSchedule({
      ...PLAIN,
      frequency: 'daily',
      durationWeeks: 4,
      protocolBreaks: [{ weekStart: 2, weekEnd: 3, reason: 'off-cycle' }],
    });
    // startDate = Jan 5 (Mon), durationWeeks = 4 → schedule runs Jan 5 – Feb 1 (28 days).
    // Week 1 = Jan 5-11, Week 2 = Jan 12-18, Week 3 = Jan 19-25, Week 4 = Jan 22-28, Week 5 = Jan 29-Feb 1
    // Break weeks 2-3 suppress Jan 12-25; remaining = Jan 5-11 + Jan 26-Feb 1
    expect(doses.map(d => d.date)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11',
      '2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29', '2026-01-30', '2026-01-31', '2026-02-01',
    ]);
  });

  it('protocolBreaks suppress dose generation during break weeks (weekly)', () => {
    const doses = generateSchedule({
      ...PLAIN,
      peptideId: 'no-such-peptide',
      dose: 250,
      unit: 'mcg',
      frequency: 'weekly',
      durationWeeks: 4,
      protocolBreaks: [{ weekStart: 2, weekEnd: 2, reason: 'off-cycle' }],
    });
    // Week 1 (Jan 5), Week 2 break, Week 3 (Jan 19), Week 4 (Jan 26)
    expect(doses.map(d => d.date)).toEqual([
      '2026-01-05', '2026-01-19', '2026-01-26',
    ]);
  });

  it('protocolBreaks suppress doses even with phased schedules', () => {
    const doses = generateSchedule({
      ...PLAIN,
      frequency: 'daily',
      schedulePhases: [{ weekStart: 1, weekEnd: 3, frequency: 'daily' }],
      protocolBreaks: [{ weekStart: 2, weekEnd: 2, reason: 'off-cycle' }],
    });
    // Week 1: daily, Week 2: break, Week 3: daily
    expect(doses.map(d => d.date)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11',
      '2026-01-19', '2026-01-20', '2026-01-21', '2026-01-22', '2026-01-23', '2026-01-24', '2026-01-25',
    ]);
  });
});

const scheduled = (id: string, date: string, status: ScheduledDose['status'] = 'upcoming'): ScheduledDose => ({
  id,
  owner: 'Victor',
  protocolId: 'p1',
  peptideId: 'no-such-peptide',
  date,
  time: '08:00',
  dose: 250,
  unit: 'mcg',
  route: 'subq',
  status,
  weekNumber: 1,
});

describe('extendSchedule', () => {
  it('continues the day after the last existing dose', () => {
    const extra = extendSchedule(
      [scheduled('a', '2026-01-05'), scheduled('b', '2026-01-11')],
      1,
      { ...PLAIN, frequency: 'daily' },
    );
    expect(extra[0].date).toBe('2026-01-12');
  });

  it('adds the requested number of weeks', () => {
    const extra = extendSchedule([scheduled('a', '2026-01-11')], 1, { ...PLAIN, frequency: 'daily' });
    expect(extra).toHaveLength(7);
  });

  it('returns nothing when the peptide has no existing doses', () => {
    expect(extendSchedule([], 1, { ...PLAIN, frequency: 'daily' })).toEqual([]);
  });

  it('returns no doses when extending by 0 weeks', () => {
    const extra = extendSchedule([scheduled('a', '2026-01-05')], 0, { ...PLAIN, frequency: 'daily' });
    expect(extra).toEqual([]);
  });

  it('ignores doses belonging to other peptides and still continues after the target peptide last dose', () => {
    const other = scheduled('other', '2026-01-20');
    other.peptideId = 'other-peptide';
    const extra = extendSchedule(
      [scheduled('a', '2026-01-05'), other],
      1,
      { ...PLAIN, frequency: 'daily' },
    );
    expect(extra[0].date).toBe('2026-01-06');
  });

  it('appends after existing upcoming doses without duplicating them', () => {
    const existing = [scheduled('a', '2026-01-05'), scheduled('b', '2026-01-06')];
    const extra = extendSchedule(existing, 1, { ...PLAIN, frequency: 'daily' });
    expect(extra[0].date).toBe('2026-01-07');
    expect(extra).toHaveLength(7);
    expect(extra.find(d => d.date === '2026-01-05')).toBeUndefined();
    expect(extra.find(d => d.date === '2026-01-06')).toBeUndefined();
  });
});

describe('phasesTotalWeeks', () => {
  it('returns 0 for empty phases', () => {
    expect(phasesTotalWeeks([])).toBe(0);
  });

  it('returns the largest weekEnd regardless of phase order', () => {
    expect(phasesTotalWeeks([
      { weekStart: 5, weekEnd: 8, frequency: 'eod' },
      { weekStart: 1, weekEnd: 4, frequency: 'daily' },
    ])).toBe(8);
  });
});

describe('summarizePhases', () => {
  it('returns empty string for empty phases', () => {
    expect(summarizePhases([])).toBe('');
  });

  it('formats frequency and week count per phase in array order', () => {
    expect(summarizePhases([
      { weekStart: 1, weekEnd: 2, frequency: 'daily' },
      { weekStart: 3, weekEnd: 4, frequency: '5x_week' },
    ])).toBe('Daily ×2wk → 5×/wk ×2wk → off');
  });

  it('renders weekly_days phases as weekday names', () => {
    expect(summarizePhases([
      { weekStart: 1, weekEnd: 4, frequency: 'weekly_days', daysOfWeek: [1, 4] },
    ])).toBe('Mon/Thu ×4wk → off');
  });
});
