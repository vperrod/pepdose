export type StackRelation = 'synergy' | 'neutral' | 'caution' | 'contraindicated';

export interface StackRule {
  peptideA: string;
  peptideB: string;
  relation: StackRelation;
  note: string;
}

export const STACKING_RULES: StackRule[] = [
  { peptideA: 'bpc-157', peptideB: 'tb-500', relation: 'synergy', note: '"Wolverine Stack" — BPC-157 targets local tissue repair while TB-500 promotes systemic cell migration. Well-documented synergistic healing.' },
  { peptideA: 'bpc-157', peptideB: 'kpv', relation: 'synergy', note: 'BPC-157 repairs tissue while KPV reduces inflammation. Excellent combo for gut healing and injury recovery.' },
  { peptideA: 'bpc-157', peptideB: 'ghk-cu', relation: 'synergy', note: 'BPC-157 heals deep tissue, GHK-Cu promotes collagen/skin. Complementary repair mechanisms.' },
  { peptideA: 'cjc-1295-no-dac', peptideB: 'ipamorelin', relation: 'synergy', note: 'Gold-standard GH stack. CJC (GHRH) + Ipamorelin (GHRP) amplify GH pulse synergistically. Best taken together pre-bed.' },
  { peptideA: 'cjc-1295-no-dac', peptideB: 'sermorelin', relation: 'caution', note: 'Both are GHRH analogs competing for same receptor. Redundant — pick one, not both.' },
  { peptideA: 'cjc-1295-no-dac', peptideB: 'cjc-1295-dac', relation: 'contraindicated', note: 'Same compound with different half-lives. Never run both. Choose one based on protocol needs.' },
  { peptideA: 'cjc-1295-dac', peptideB: 'ipamorelin', relation: 'caution', note: 'CJC-DAC provides sustained (not pulsatile) GH. Less synergistic with Ipamorelin than the no-DAC version.' },
  { peptideA: 'semaglutide', peptideB: 'tirzepatide', relation: 'contraindicated', note: 'Both are GLP-1 agonists. Running both risks severe GI side effects, hypoglycemia, and pancreatitis. Never combine.' },
  { peptideA: 'semaglutide', peptideB: 'retatrutide', relation: 'contraindicated', note: 'Retatrutide already has GLP-1 activity. Stacking with semaglutide doubles GLP-1 stimulation. Dangerous.' },
  { peptideA: 'tirzepatide', peptideB: 'retatrutide', relation: 'contraindicated', note: 'Both have GLP-1 activity. Never combine GLP-1 agonists.' },
  { peptideA: 'mk-677', peptideB: 'cjc-1295-no-dac', relation: 'caution', note: 'Both elevate GH. Combined may push IGF-1 too high. Monitor bloodwork closely if stacking. Most choose one or the other.' },
  { peptideA: 'mk-677', peptideB: 'ipamorelin', relation: 'caution', note: 'Both stimulate GH via ghrelin pathway. Redundant receptor activation. Pick one.' },
  { peptideA: 'mk-677', peptideB: 'semaglutide', relation: 'caution', note: 'MK-677 increases appetite significantly. Semaglutide decreases it. Counterproductive pairing.' },
  { peptideA: 'aod-9604', peptideB: 'semaglutide', relation: 'neutral', note: 'Different mechanisms. AOD-9604 targets lipolysis, semaglutide targets appetite/metabolism. Can be combined.' },
  { peptideA: 'pt-141', peptideB: 'bpc-157', relation: 'neutral', note: 'No known interaction. Different pathways and use patterns (BPC daily, PT-141 as-needed).' },
  { peptideA: 'semax', peptideB: 'selank', relation: 'synergy', note: 'Complementary nootropics. Semax enhances BDNF/focus, Selank reduces anxiety via GABA. Popular cognitive stack.' },
  { peptideA: 'bpc-157', peptideB: 'semaglutide', relation: 'neutral', note: 'BPC-157 may help with GI side effects of semaglutide (gut healing properties). Some practitioners recommend this.' },
  { peptideA: 'tb-500', peptideB: 'ghk-cu', relation: 'synergy', note: 'TB-500 handles deep tissue repair, GHK-Cu supports surface/collagen healing. Good post-surgery stack.' },
];

export function getStackingInfo(peptideA: string, peptideB: string): StackRule | undefined {
  return STACKING_RULES.find(
    r => (r.peptideA === peptideA && r.peptideB === peptideB) ||
         (r.peptideA === peptideB && r.peptideB === peptideA)
  );
}

export function getStackWarnings(peptideIds: string[]): StackRule[] {
  const warnings: StackRule[] = [];
  for (let i = 0; i < peptideIds.length; i++) {
    for (let j = i + 1; j < peptideIds.length; j++) {
      const rule = getStackingInfo(peptideIds[i], peptideIds[j]);
      if (rule && (rule.relation === 'caution' || rule.relation === 'contraindicated')) {
        warnings.push(rule);
      }
    }
  }
  return warnings;
}
