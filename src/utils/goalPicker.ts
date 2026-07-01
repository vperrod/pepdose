import { PEPTIDES, getPeptideById, type Peptide, type PeptideCategory } from '../data/peptides';
import { STACKING_RULES, type StackRule } from '../data/stackingRules';

export function peptidesForGoal(category: PeptideCategory): Peptide[] {
  return PEPTIDES.filter(p => p.category === category);
}

export function synergyStacksFor(category: PeptideCategory): StackRule[] {
  return STACKING_RULES.filter(r => {
    if (r.relation !== 'synergy') return false;
    const a = getPeptideById(r.peptideA);
    const b = getPeptideById(r.peptideB);
    return a?.category === category && b?.category === category;
  });
}
