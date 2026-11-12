import { describe, it, expect } from 'vitest';
import { getPeptideById } from '../data/peptides';
import type { ScheduledDose, UserProtocol } from '../db/schema';
import { buildCycleMap, suggestionFor, cycleFromSuggestion, reviewItems } from './cycleMap';

type DoseCfg = UserProtocol['doses'][number];

const protocolWith = (dose: Partial<DoseCfg>, over: Partial<UserProtocol> = {}): UserProtocol => ({
  id: 'p1', owner: 'Victor', name: 'P', peptideIds: ['tb-500'],
  doses: [{ peptideId: 'tb-500', dose: 2, unit: 'mg', frequency: 'daily', timeOfDay: 'morning', ...dose }],
  startDate: '2026-10-05', durationWeeks: 32, status: 'active',
  createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', ...over,
});

const doseRow = (weekNumber: number, status: ScheduledDose['status']): ScheduledDose => ({
  id: `d${weekNumber}${status}`, owner: 'Victor', protocolId: 'p1', peptideId: 'tb-500',
  date: '2026-10-05', time: '08:00', dose: 2, unit: 'mg', route: 'subq', status, weekNumber,
});

const map = (p: UserProtocol, today = '2026-11-12', doses: ScheduledDose[] = []) =>
  buildCycleMap({ protocol: p, peptideId: 'tb-500', doses, today });

const cycleMap = () => map(protocolWith({ cycle: { onWeeks: 8, offWeeks: 8 }, durationWeeks: 32 }));

describe('buildCycleMap with a saved cycle', () => {
  it('lists four windows for 8 on / 8 off over 32 weeks', () => {
    expect(cycleMap().windows).toHaveLength(4);
  });

  it('dates the first ON window from the start to the Sunday of week 8', () => {
    expect([cycleMap().windows[0].startDate, cycleMap().windows[0].endDate]).toEqual(['2026-10-05', '2026-11-29']);
  });

  it('dates the first OFF window from Monday of week 9 to the Sunday of week 16', () => {
    expect([cycleMap().windows[1].startDate, cycleMap().windows[1].endDate]).toEqual(['2026-11-30', '2027-01-24']);
  });

  it('ends the map on the last Sunday of the course', () => {
    expect(cycleMap().endDate).toBe('2027-05-16');
  });

  it('reports the cycle source and regular pattern', () => {
    expect([cycleMap().source, cycleMap().regular]).toEqual(['cycle', { onWeeks: 8, offWeeks: 8 }]);
  });

  it('marks only the window that contains today', () => {
    expect(cycleMap().windows.map(w => w.isNow)).toEqual([true, false, false, false]);
  });

  it('describes the setup in one sentence with dates', () => {
    expect(cycleMap().setup).toBe('Every day, 2 mg. 8 weeks on, 8 off, repeating. Starts Mon 5 Oct 2026, ends Sun 16 May 2027.');
  });
});

describe('buildCycleMap from older protocols', () => {
  it('reads regular legacy breaks as a cycle', () => {
    const m = map(protocolWith({}, { durationWeeks: 24, breaks: [{ weekStart: 9, weekEnd: 16, reason: 'x' }] }));
    expect([m.source, m.regular]).toEqual(['breaks', { onWeeks: 8, offWeeks: 8 }]);
  });

  it('keeps irregular legacy breaks as separate windows with no regular cycle', () => {
    const m = map(protocolWith({}, { durationWeeks: 16, breaks: [{ weekStart: 5, weekEnd: 6, reason: 'x' }, { weekStart: 12, weekEnd: 12, reason: 'y' }] }));
    expect(m.windows.map(w => `${w.kind}${w.weekStart}-${w.weekEnd}`)).toEqual(['on1-4', 'off5-6', 'on7-11', 'off12-12', 'on13-16']);
  });

  it('has no regular cycle for irregular legacy breaks', () => {
    const m = map(protocolWith({}, { durationWeeks: 16, breaks: [{ weekStart: 5, weekEnd: 6, reason: 'x' }, { weekStart: 12, weekEnd: 12, reason: 'y' }] }));
    expect(m.regular).toBeNull();
  });

  it('treats weeks between phases as off weeks', () => {
    const phases = [{ weekStart: 1, weekEnd: 4, frequency: 'daily' as const }, { weekStart: 7, weekEnd: 10, frequency: 'daily' as const }];
    const m = map(protocolWith({ schedulePhases: phases }, { durationWeeks: 10 }));
    expect(m.windows.map(w => `${w.kind}${w.weekStart}-${w.weekEnd}`)).toEqual(['on1-4', 'off5-6', 'on7-10']);
  });

  it('reports a phased source', () => {
    const phases = [{ weekStart: 1, weekEnd: 4, frequency: 'daily' as const }];
    expect(map(protocolWith({ schedulePhases: phases }, { durationWeeks: 4 })).source).toBe('phases');
  });

  it('shows a plain course as one ON window', () => {
    const m = map(protocolWith({ durationWeeks: 12 }, { durationWeeks: 12 }));
    expect([m.windows.length, m.source]).toEqual([1, 'course']);
  });

  it('names a plain course with no off weeks in the setup', () => {
    expect(map(protocolWith({ durationWeeks: 12 }, { durationWeeks: 12 })).setup).toContain('12-week course, no off weeks.');
  });
});

describe('buildCycleMap dose counts', () => {
  const rows = [doseRow(1, 'logged'), doseRow(1, 'upcoming'), doseRow(9, 'upcoming')];

  it('counts planned doses in the first window', () => {
    expect(map(protocolWith({ cycle: { onWeeks: 8, offWeeks: 8 }, durationWeeks: 32 }), '2026-11-12', rows).windows[0].planned).toBe(2);
  });

  it('counts logged doses in the first window', () => {
    expect(map(protocolWith({ cycle: { onWeeks: 8, offWeeks: 8 }, durationWeeks: 32 }), '2026-11-12', rows).windows[0].done).toBe(1);
  });

  it('counts a dose that sits in an off window', () => {
    expect(map(protocolWith({ cycle: { onWeeks: 8, offWeeks: 8 }, durationWeeks: 32 }), '2026-11-12', rows).windows[1].planned).toBe(1);
  });
});

describe('suggestionFor', () => {
  const tb = getPeptideById('tb-500');
  const reta = getPeptideById('retatrutide');
  const course = (p: ReturnType<typeof protocolWith>) => map(p);

  it('flags off weeks on a peptide that is normally run continuously', () => {
    const m = buildCycleMap({ protocol: protocolWith({ peptideId: 'retatrutide', cycle: { onWeeks: 8, offWeeks: 8 }, durationWeeks: 32 }, { peptideIds: ['retatrutide'] }), peptideId: 'retatrutide', doses: [], today: '2026-11-12' });
    expect(suggestionFor(m, reta).verdict).toBe('extra-off');
  });

  it('accepts a continuous course for a continuous peptide', () => {
    const m = buildCycleMap({ protocol: protocolWith({ peptideId: 'retatrutide', durationWeeks: 12 }, { durationWeeks: 12, peptideIds: ['retatrutide'] }), peptideId: 'retatrutide', doses: [], today: '2026-11-12' });
    expect(suggestionFor(m, reta).verdict).toBe('matches');
  });

  it('flags a course with no off weeks when the peptide normally cycles', () => {
    expect(suggestionFor(course(protocolWith({ durationWeeks: 12 }, { durationWeeks: 12 })), tb).verdict).toBe('no-off');
  });

  it('matches the typical cycle', () => {
    expect(suggestionFor(course(protocolWith({ cycle: { onWeeks: 6, offWeeks: 4 }, durationWeeks: 24 }, { durationWeeks: 24 })), tb).verdict).toBe('matches');
  });

  it('flags a longer ON period', () => {
    expect(suggestionFor(course(protocolWith({ cycle: { onWeeks: 8, offWeeks: 4 }, durationWeeks: 24 }, { durationWeeks: 24 })), tb).verdict).toBe('longer-on');
  });

  it('flags a shorter ON period', () => {
    expect(suggestionFor(course(protocolWith({ cycle: { onWeeks: 4, offWeeks: 4 }, durationWeeks: 24 }, { durationWeeks: 24 })), tb).verdict).toBe('shorter-on');
  });

  it('flags shorter off weeks', () => {
    expect(suggestionFor(course(protocolWith({ cycle: { onWeeks: 6, offWeeks: 2 }, durationWeeks: 24 }, { durationWeeks: 24 })), tb).verdict).toBe('shorter-off');
  });

  it('flags custom off windows', () => {
    const p = protocolWith({}, { durationWeeks: 16, breaks: [{ weekStart: 5, weekEnd: 6, reason: 'x' }, { weekStart: 12, weekEnd: 12, reason: 'y' }] });
    expect(suggestionFor(course(p), tb).verdict).toBe('custom');
  });

  it('gives no suggestion for an unknown peptide', () => {
    expect(suggestionFor(cycleMap(), undefined).verdict).toBe('none');
  });

  it('states the typical and your cycle in the text', () => {
    expect(suggestionFor(course(protocolWith({ cycle: { onWeeks: 8, offWeeks: 4 }, durationWeeks: 24 }, { durationWeeks: 24 })), tb).text)
      .toBe('Typical is 6 on, 4 off. Yours is 8 on, 4 off.');
  });
});

describe('cycleFromSuggestion', () => {
  it('returns the typical cycle for a peptide that cycles', () => {
    expect(cycleFromSuggestion(suggestionFor(cycleMap(), getPeptideById('tb-500')))).toEqual({ onWeeks: 6, offWeeks: 4 });
  });

  it('returns null for a continuous peptide', () => {
    expect(cycleFromSuggestion(suggestionFor(cycleMap(), getPeptideById('retatrutide')))).toBeNull();
  });
});

describe('reviewItems', () => {
  const sug = suggestionFor(cycleMap(), getPeptideById('tb-500'));

  it('warns that a paused protocol schedules nothing', () => {
    expect(reviewItems(cycleMap(), { status: 'paused' }, sug).map(i => i.text)).toContain('Paused: no doses are being scheduled.');
  });

  it('warns when the course ends within 14 days', () => {
    const m = map(protocolWith({ durationWeeks: 6 }, { durationWeeks: 6 }), '2026-11-12');
    expect(reviewItems(m, { status: 'active' }, suggestionFor(m, undefined)).map(i => i.text)).toContain('Course ends in 4 days.');
  });

  it('repeats the suggestion text when the cycle is worth a look', () => {
    const m = map(protocolWith({ durationWeeks: 12 }, { durationWeeks: 12 }));
    const s = suggestionFor(m, getPeptideById('tb-500'));
    expect(reviewItems(m, { status: 'active' }, s).map(i => i.text)).toContain(s.text);
  });

  it('notes that older template off weeks are not an editable cycle', () => {
    const m = map(protocolWith({}, { durationWeeks: 16, breaks: [{ weekStart: 5, weekEnd: 6, reason: 'x' }, { weekStart: 12, weekEnd: 12, reason: 'y' }] }));
    expect(reviewItems(m, { status: 'active' }, suggestionFor(m, undefined)).map(i => i.text)).toContain('Off weeks come from an older template, not an editable cycle.');
  });
});
