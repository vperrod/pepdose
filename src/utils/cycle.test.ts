import { describe, it, expect } from 'vitest';
import { cycleToBreaks, breaksToCycle } from './cycle';

describe('cycle functions', () => {
  // Test cycleToBreaks with various inputs
  it('returns empty array when offWeeks < 1', () => {
    expect(cycleToBreaks({ onWeeks: 8, offWeeks: 0 }, 30)).toEqual([]);
  });

  it('returns empty array when onWeeks < 1', () => {
    expect(cycleToBreaks({ onWeeks: 0, offWeeks: 8 }, 30)).toEqual([]);
  });

  it('returns empty array when onWeeks = 0', () => {
    expect(cycleToBreaks({ onWeeks: 0, offWeeks: 8 }, 30)).toEqual([]);
  });

  it('returns empty array when offWeeks = 0', () => {
    expect(cycleToBreaks({ onWeeks: 8, offWeeks: 0 }, 30)).toEqual([]);
  });

  it('returns empty array when non-integer input', () => {
    expect(cycleToBreaks({ onWeeks: 8.5, offWeeks: 8 }, 30)).toEqual([]);
  });

  it('returns empty array when NaN input', () => {
    expect(cycleToBreaks({ onWeeks: NaN, offWeeks: 8 }, 30)).toEqual([]);
  });

  it('returns single break for 8/8 with total 24', () => {
    expect(cycleToBreaks({ onWeeks: 8, offWeeks: 8 }, 24)).toEqual([{ weekStart: 9, weekEnd: 16, reason: 'Off week' }]);
  });

  it('returns two breaks for 8/8 with total 30', () => {
    expect(cycleToBreaks({ onWeeks: 8, offWeeks: 8 }, 30)).toEqual([
      { weekStart: 9, weekEnd: 16, reason: 'Off week' },
      { weekStart: 25, weekEnd: 30, reason: 'Off week' }
    ]);
  });

  it('returns two breaks for 4/2 with total 14', () => {
    expect(cycleToBreaks({ onWeeks: 4, offWeeks: 2 }, 14)).toEqual([
      { weekStart: 5, weekEnd: 6, reason: 'Off week' },
      { weekStart: 11, weekEnd: 12, reason: 'Off week' }
    ]);
  });

  // Test breaksToCycle
  it('returns null for undefined input', () => {
    expect(breaksToCycle(undefined, 30)).toBeNull();
  });

  it('returns null for empty array input', () => {
    expect(breaksToCycle([], 30)).toBeNull();
  });

  it('returns null for irregular breaks input', () => {
    expect(breaksToCycle([{ weekStart: 9, weekEnd: 16, reason: 'Off week' }, { weekStart: 26, weekEnd: 30, reason: 'Off week' }], 30)).toBeNull();
  });

  it('returns Cycle for perfectly regular breaks', () => {
    expect(breaksToCycle([{ weekStart: 9, weekEnd: 16, reason: 'Off week' }, { weekStart: 25, weekEnd: 30, reason: 'Off week' }], 30)).toEqual({ onWeeks: 8, offWeeks: 8 });
  });

  // Test round-trip
  it('breaksToCycle round-trips 8/8 with total 30', () => {
    const breaks = cycleToBreaks({ onWeeks: 8, offWeeks: 8 }, 30);
    const cycle = breaksToCycle(breaks, 30);
    expect(cycle).toEqual({ onWeeks: 8, offWeeks: 8 });
  });

  it('breaksToCycle round-trips 4/2 with total 14', () => {
    const breaks = cycleToBreaks({ onWeeks: 4, offWeeks: 2 }, 14);
    const cycle = breaksToCycle(breaks, 14);
    expect(cycle).toEqual({ onWeeks: 4, offWeeks: 2 });
  });
});