import { describe, it, expect } from 'vitest';
import { buildProtocolDraft, buildDoses, canSave } from './protocolFromCards';
import { defaultCard, type CardValue } from './cycleForm';
import { getPeptideById } from '../data/peptides';

describe('protocolFromCards utilities', () => {
  const kpv = getPeptideById('kpv')!;

  it('should create a ProtocolDraft with correct name for two peptides', () => {
    const card1 = defaultCard(kpv);
    const card2 = { ...card1, peptideId: 'semaglutide' } as CardValue;
    const draft = buildProtocolDraft([card1, card2]);
    expect(draft.name).toBe('KPV + Semaglutide');
  });

  it('should set durationWeeks as the max from doses', () => {
    const card1 = { ...defaultCard(kpv), onWeeks: 6, offWeeks: 0 } as CardValue;
    const card2 = { ...card1, peptideId: 'semaglutide', onWeeks: 10, offWeeks: 0 } as CardValue;
    const draft = buildProtocolDraft([card1, card2]);
    expect(draft.durationWeeks).toBe(10);
  });

  it('should generate doses only in expected weeks for weekly_days schedule', () => {
    const baseCard = defaultCard(kpv);
    const weeklyCard = { ...baseCard, frequency: 'weekly_days', daysOfWeek: [1, 4], onWeeks: 5, offWeeks: 3 } as CardValue;
    const draft = buildProtocolDraft([weeklyCard]);
    const doses = buildDoses(draft, 'test-protocol', '2026-01-05');
    
    const weeks6to8 = doses.filter(d => d.weekNumber >= 6 && d.weekNumber <= 8);
    const weeks5 = doses.filter(d => d.weekNumber === 5);
    const weeks9 = doses.filter(d => d.weekNumber === 9);
    
    expect(weeks6to8.length).toBe(0);
    expect(weeks5.length).toBeGreaterThan(0);
    expect(weeks9.length).toBeGreaterThan(0);
  });

  it('should yield doses only in weeks 1-4 for card with offWeeks 0 and onWeeks 4', () => {
    const baseCard = defaultCard(kpv);
    const noOffCard = { ...baseCard, offWeeks: 0, onWeeks: 4 } as CardValue;
    const draft = buildProtocolDraft([noOffCard]);
    const doses = buildDoses(draft, 'test-protocol', '2026-01-05');
    
    const weeks1to4 = doses.filter(d => d.weekNumber >= 1 && d.weekNumber <= 4);
    const otherWeeks = doses.filter(d => d.weekNumber < 1 || d.weekNumber > 4);
    
    expect(weeks1to4.length).toBe(doses.length);
    expect(otherWeeks.length).toBe(0);
  });

  it('should return false for canSave when dose is 0', () => {
    const card = { ...defaultCard(kpv), dose: 0 } as CardValue;
    expect(canSave([card])).toBe(false);
  });

  it('should return false for canSave when weekly_days has no days', () => {
    const card = { ...defaultCard(kpv), frequency: 'weekly_days', daysOfWeek: [] } as CardValue;
    expect(canSave([card])).toBe(false);
  });

  it('should return true for canSave with a normal default card', () => {
    expect(canSave([defaultCard(kpv)])).toBe(true);
  });
});