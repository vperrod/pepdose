import type { CardValue } from './cycleForm';
import type { DraftDose } from './scheduleEngine';
import { cardToDoseConfig } from './cycleForm';
import { generateSchedule } from './scheduleEngine';
import { getPeptideById } from '../data/peptides';

export interface ProtocolDraft {
  name: string;
  peptideIds: string[];
  doses: ReturnType<typeof cardToDoseConfig>[];
  durationWeeks: number;
}

export function buildProtocolDraft(cards: CardValue[]): ProtocolDraft {
  const doses = cards.map(cardToDoseConfig);
  const durationWeeks = Math.max(...doses.map(d => d.durationWeeks ?? 1));
  const name = cards
    .map(card => {
      const peptide = getPeptideById(card.peptideId);
      return peptide?.name ?? card.peptideId;
    })
    .join(' + ');
  const peptideIds = cards.map(card => card.peptideId);

  return { name, peptideIds, doses, durationWeeks };
}

export function buildDoses(draft: ProtocolDraft, protocolId: string, startDate: string): DraftDose[] {
  return draft.doses.flatMap(dose => {
    return generateSchedule({
      protocolId,
      peptideId: dose.peptideId,
      dose: dose.dose,
      unit: dose.unit,
      frequency: dose.frequency,
      customFrequencyDays: dose.customFrequencyDays,
      daysOfWeek: dose.daysOfWeek,
      timesPerDay: dose.timesPerDay,
      timeOfDay: dose.timeOfDay,
      startDate,
      durationWeeks: dose.durationWeeks ?? draft.durationWeeks,
      schedulePhases: dose.schedulePhases,
      cycle: dose.cycle,
    });
  });
}

export function canSave(cards: CardValue[]): boolean {
  if (cards.length === 0) return false;
  
  for (const card of cards) {
    if (card.dose <= 0) return false;
    
    if (card.frequency === 'weekly_days' && card.daysOfWeek.length === 0) return false;
    
    if (card.frequency === 'custom' && (!card.customFrequencyDays || card.customFrequencyDays <= 0)) return false;
    
    if (card.onWeeks < 1) return false;
  }
  
  return true;
}