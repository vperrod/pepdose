import { describe, it, expect } from 'vitest';
import { ALL_PEPTIDES as PEPTIDES } from './peptides';
import { EXPERIENCE_DATA } from './experienceTimelines';
import { STACKING_RULES } from './stackingRules';
import { PROTOCOL_TEMPLATES } from './protocols';

const PEPTIDE_IDS = new Set(PEPTIDES.map(p => p.id));

describe('peptide data', () => {
  it('has no duplicate ids', () => {
    expect(PEPTIDE_IDS.size).toBe(PEPTIDES.length);
  });

  it('orders every dose range low <= standard <= high', () => {
    const broken = PEPTIDES.filter(
      p => !(p.dosing.low <= p.dosing.standard && p.dosing.standard <= p.dosing.high)
    );
    expect(broken.map(p => p.id)).toEqual([]);
  });

  it('gives every injectable a reconstitution volume', () => {
    const broken = PEPTIDES.filter(
      p => p.reconstitution.typicalVialMg > 0 && p.reconstitution.bacWaterMl <= 0
    );
    expect(broken.map(p => p.id)).toEqual([]);
  });

  it('keeps every titration ladder within the compound dose range', () => {
    const broken = PEPTIDES.filter(p =>
      p.dosing.titration?.some(step => step.dose > p.dosing.high)
    );
    expect(broken.map(p => p.id)).toEqual([]);
  });
});

describe('cross-file peptide references', () => {
  it('resolves every experience entry to a peptide', () => {
    const unknown = EXPERIENCE_DATA.filter(e => !PEPTIDE_IDS.has(e.peptideId));
    expect(unknown.map(e => e.peptideId)).toEqual([]);
  });

  it('resolves every stacking rule to known peptides', () => {
    const unknown = STACKING_RULES.filter(
      r => !PEPTIDE_IDS.has(r.peptideA) || !PEPTIDE_IDS.has(r.peptideB)
    );
    expect(unknown.map(r => `${r.peptideA}+${r.peptideB}`)).toEqual([]);
  });

  it('resolves every protocol template peptide', () => {
    const unknown = PROTOCOL_TEMPLATES.flatMap(t =>
      t.peptides.filter(p => !PEPTIDE_IDS.has(p.peptideId)).map(p => `${t.id}:${p.peptideId}`)
    );
    expect(unknown).toEqual([]);
  });

  it('never lists a peptide against itself in a stacking rule', () => {
    const selfPairs = STACKING_RULES.filter(r => r.peptideA === r.peptideB);
    expect(selfPairs.map(r => r.peptideA)).toEqual([]);
  });

  it('has no duplicate stacking pair', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const r of STACKING_RULES) {
      const key = [r.peptideA, r.peptideB].sort().join('+');
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });
});
