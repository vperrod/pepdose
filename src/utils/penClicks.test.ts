import { describe, it, expect, afterEach } from 'vitest';
import { clicksForDose, formatClicks, penMlPerClick, defaultRecon, DEFAULT_ML_PER_CLICK } from './penClicks';
import { PEPTIDES } from '../data/peptides';

const MIX = { vialAmount: 10, bacWaterMl: 2 }; // 5 mg/ml

describe('clicksForDose', () => {
  it('converts an mg dose to pen clicks at 0.01 ml per click', () => {
    expect(clicksForDose(0.5, 'mg', MIX, DEFAULT_ML_PER_CLICK)?.clicks).toBeCloseTo(10);
  });

  it('converts an mcg dose through mg', () => {
    expect(clicksForDose(500, 'mcg', MIX, DEFAULT_ML_PER_CLICK)?.clicks).toBeCloseTo(10);
  });

  it('treats an IU dose as the vial IU count, not a mass', () => {
    expect(clicksForDose(2, 'IU', { vialAmount: 5000, bacWaterMl: 1 }, 0.01)?.volumeMl)
      .toBeCloseTo(0.0004);
  });

  it('scales with a finer pen click volume', () => {
    expect(clicksForDose(0.5, 'mg', MIX, 0.005)?.clicks).toBeCloseTo(20);
  });

  it('returns null when the mix is missing', () => {
    expect(clicksForDose(0.5, 'mg', undefined)).toBeNull();
  });

  it('returns null when water is zero', () => {
    expect(clicksForDose(0.5, 'mg', { vialAmount: 10, bacWaterMl: 0 })).toBeNull();
  });
});

describe('formatClicks', () => {
  it('drops the trailing zero decimal', () => {
    expect(formatClicks(clicksForDose(0.5, 'mg', MIX))).toBe('10 clicks · 0.10 ml');
  });

  it('singularises one click', () => {
    expect(formatClicks(clicksForDose(0.05, 'mg', MIX))).toBe('1 click · 0.01 ml');
  });
});

describe('penMlPerClick', () => {
  afterEach(() => localStorage.removeItem('pepdose-settings'));

  it('defaults when no settings are stored', () => {
    expect(penMlPerClick()).toBe(DEFAULT_ML_PER_CLICK);
  });

  it('reads a stored click volume', () => {
    localStorage.setItem('pepdose-settings', JSON.stringify({ penMlPerClick: 0.005 }));
    expect(penMlPerClick()).toBe(0.005);
  });

  it('accepts a numeric string', () => {
    localStorage.setItem('pepdose-settings', JSON.stringify({ penMlPerClick: '0.02' }));
    expect(penMlPerClick()).toBe(0.02);
  });

  it('falls back on corrupt JSON', () => {
    localStorage.setItem('pepdose-settings', '{not json');
    expect(penMlPerClick()).toBe(DEFAULT_ML_PER_CLICK);
  });

  it('falls back on a negative value', () => {
    localStorage.setItem('pepdose-settings', JSON.stringify({ penMlPerClick: -0.01 }));
    expect(penMlPerClick()).toBe(DEFAULT_ML_PER_CLICK);
  });

  it('falls back on a non-numeric value', () => {
    localStorage.setItem('pepdose-settings', JSON.stringify({ penMlPerClick: 'abc' }));
    expect(penMlPerClick()).toBe(DEFAULT_ML_PER_CLICK);
  });
});

describe('defaultRecon', () => {
  const pep = PEPTIDES[0];

  it('pre-fills from the peptide typical vial and water', () => {
    expect(defaultRecon(pep)).toEqual({
      vialAmount: pep.reconstitution.typicalVialMg,
      bacWaterMl: pep.reconstitution.bacWaterMl,
    });
  });

  it('returns undefined for an undefined peptide', () => {
    expect(defaultRecon(undefined)).toBeUndefined();
  });

  it('returns undefined when the typical vial is zero', () => {
    expect(defaultRecon({ ...pep, reconstitution: { ...pep.reconstitution, typicalVialMg: 0 } }))
      .toBeUndefined();
  });
});
