// src/utils/goalPicker.test.ts
import { describe, it, expect } from 'vitest';
import { peptidesForGoal, synergyStacksFor } from './goalPicker';

describe('peptidesForGoal', () => {
  it('returns only peptides in the given category', () => {
    const healing = peptidesForGoal('healing');
    expect(healing.length).toBeGreaterThan(0);
    expect(healing.every(p => p.category === 'healing')).toBe(true);
  });
});

describe('synergyStacksFor', () => {
  it('returns synergy stacks where both peptides are in the category', () => {
    const stacks = synergyStacksFor('healing');
    expect(stacks.every(s => s.relation === 'synergy')).toBe(true);
    // BPC-157 + TB-500 are both healing peptides and a documented synergy
    expect(stacks.some(s =>
      [s.peptideA, s.peptideB].sort().join('+') === ['bpc-157', 'tb-500'].sort().join('+')
    )).toBe(true);
  });
  it('excludes synergies whose peptides are outside the category', () => {
    const stacks = synergyStacksFor('nootropic');
    expect(stacks.every(s => s.relation === 'synergy')).toBe(true);
  });
});
