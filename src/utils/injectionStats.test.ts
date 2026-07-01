import { describe, it, expect } from 'vitest';
import { zoneStats, daysSinceByLabel, mostRestedLabel } from './injectionStats';

const today = new Date('2026-07-01T12:00:00Z');
const logs = [
  { injectionSite: 'Left abdomen', date: '2026-06-30' },
  { injectionSite: 'Left abdomen', date: '2026-06-20' },
  { injectionSite: 'Right thigh (outer)', date: '2026-06-25' },
  { injectionSite: undefined, date: '2026-06-29' },
];

describe('zoneStats', () => {
  it('counts per zone within the window, sorted hottest first', () => {
    const s = zoneStats(logs, 90, today);
    expect(s[0]).toEqual({ label: 'Left abdomen', count: 2, lastUsed: '2026-06-30', daysSince: 1 });
    expect(s.find(z => z.label === 'Right thigh (outer)')?.count).toBe(1);
  });
  it('excludes logs outside the window', () => {
    expect(zoneStats(logs, 5, today).find(z => z.label === 'Left abdomen')?.count).toBe(1);
  });
  it('ignores logs with no site', () => {
    expect(zoneStats(logs, 90, today).some(z => z.label === undefined)).toBe(false);
  });
});

describe('daysSinceByLabel', () => {
  it('returns days since most recent use per label', () => {
    expect(daysSinceByLabel(logs, today)['Left abdomen']).toBe(1);
    expect(daysSinceByLabel(logs, today)['Right thigh (outer)']).toBe(6);
  });
});

describe('mostRestedLabel', () => {
  it('prefers a never-used label', () => {
    const ds = daysSinceByLabel(logs, today);
    expect(mostRestedLabel(['Left abdomen', 'Left glute'], ds)).toBe('Left glute');
  });
  it('falls back to the oldest-used label when all used', () => {
    const ds = daysSinceByLabel(logs, today);
    expect(mostRestedLabel(['Left abdomen', 'Right thigh (outer)'], ds)).toBe('Right thigh (outer)');
  });
});
