import { describe, it, expect } from 'vitest';
import { predictEmptyDate } from './vialForecast';

const today = new Date('2026-07-01T00:00:00Z');

describe('predictEmptyDate', () => {
  it('projects empty date from average log interval', () => {
    // every 2 days, 3 doses left → +6 days
    expect(predictEmptyDate(3, ['2026-06-27', '2026-06-29', '2026-07-01'], today)).toBe('2026-07-07');
  });
  it('returns null with fewer than 2 logs', () => {
    expect(predictEmptyDate(3, ['2026-07-01'], today)).toBeNull();
  });
  it('returns null when nothing remains', () => {
    expect(predictEmptyDate(0, ['2026-06-27', '2026-06-29'], today)).toBeNull();
  });
});
