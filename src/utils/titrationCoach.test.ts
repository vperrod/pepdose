import { describe, it, expect } from 'vitest';
import { nextTitrationStep } from './titrationCoach';
import type { ScheduledDose } from '../db/schema';

const today = new Date('2026-07-01T00:00:00Z');

function dose(partial: Partial<ScheduledDose>): ScheduledDose {
  return {
    id: 'x', protocolId: 'p', peptideId: 'reta', date: '2026-07-05', time: '09:00',
    dose: 4, unit: 'mg', route: 'subq', status: 'upcoming', weekNumber: 4,
    isTitrationStepUp: true, ...partial,
  };
}

describe('nextTitrationStep', () => {
  it('returns the earliest upcoming step-up on/after today', () => {
    const doses = [
      dose({ id: 'a', date: '2026-07-12', weekNumber: 5, dose: 6 }),
      dose({ id: 'b', date: '2026-07-05', weekNumber: 4, dose: 4 }),
    ];
    const r = nextTitrationStep(doses, today);
    expect(r).toEqual({ peptideId: 'reta', weekNumber: 4, dose: 4, unit: 'mg', date: '2026-07-05' });
  });
  it('ignores past step-ups', () => {
    const doses = [dose({ id: 'a', date: '2026-06-01', weekNumber: 1 })];
    expect(nextTitrationStep(doses, today)).toBeNull();
  });
  it('ignores non-step-up and non-upcoming doses', () => {
    const doses = [
      dose({ id: 'a', isTitrationStepUp: false }),
      dose({ id: 'b', status: 'logged' }),
    ];
    expect(nextTitrationStep(doses, today)).toBeNull();
  });
  it('returns null when there are no doses', () => {
    expect(nextTitrationStep([], today)).toBeNull();
  });
});
