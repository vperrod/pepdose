export interface ProtocolTemplate {
  id: string;
  name: string;
  description: string;
  peptides: {
    peptideId: string;
    doseOverride?: number;
    unitOverride?: 'mcg' | 'mg';
    frequencyOverride?: string;
  }[];
  durationWeeks: number;
  category: string;
}

export const PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    id: 'wolverine-healing',
    name: 'Wolverine Healing',
    description: 'BPC-157 + TB-500 for accelerated injury recovery. The gold-standard healing stack.',
    peptides: [
      { peptideId: 'bpc-157', doseOverride: 500, unitOverride: 'mcg' },
      { peptideId: 'tb-500', doseOverride: 2.5, unitOverride: 'mg' },
    ],
    durationWeeks: 6,
    category: 'Healing',
  },
  {
    id: 'gh-boost',
    name: 'GH Boost',
    description: 'CJC-1295 (no DAC) + Ipamorelin pre-bed for optimized growth hormone pulses.',
    peptides: [
      { peptideId: 'cjc-1295-no-dac', doseOverride: 100, unitOverride: 'mcg' },
      { peptideId: 'ipamorelin', doseOverride: 200, unitOverride: 'mcg' },
    ],
    durationWeeks: 12,
    category: 'Performance',
  },
  {
    id: 'weight-management-sema',
    name: 'Weight Management (Semaglutide)',
    description: 'Semaglutide titration protocol from 0.25mg to 2.4mg weekly. Auto-escalation schedule.',
    peptides: [
      { peptideId: 'semaglutide' },
    ],
    durationWeeks: 52,
    category: 'Weight Loss',
  },
  {
    id: 'weight-management-tirz',
    name: 'Weight Management (Tirzepatide)',
    description: 'Tirzepatide titration from 2.5mg to 15mg weekly. Dual GIP/GLP-1 agonist protocol.',
    peptides: [
      { peptideId: 'tirzepatide' },
    ],
    durationWeeks: 52,
    category: 'Weight Loss',
  },
  {
    id: 'anti-aging-stack',
    name: 'Anti-Aging Stack',
    description: 'GHK-Cu daily + Epithalon 10-day course. Collagen regeneration + telomerase activation.',
    peptides: [
      { peptideId: 'ghk-cu', doseOverride: 2, unitOverride: 'mg' },
      { peptideId: 'epithalon', doseOverride: 10, unitOverride: 'mg' },
    ],
    durationWeeks: 8,
    category: 'Anti-Aging',
  },
  {
    id: 'recovery-stack',
    name: 'Recovery Stack',
    description: 'BPC-157 + TB-500 + KPV for comprehensive tissue repair with anti-inflammatory support.',
    peptides: [
      { peptideId: 'bpc-157', doseOverride: 500, unitOverride: 'mcg' },
      { peptideId: 'tb-500', doseOverride: 2.5, unitOverride: 'mg' },
      { peptideId: 'kpv', doseOverride: 500, unitOverride: 'mcg' },
    ],
    durationWeeks: 4,
    category: 'Healing',
  },
  {
    id: 'fat-loss-basic',
    name: 'Fat Loss (AOD-9604)',
    description: 'AOD-9604 morning fasting protocol. Targets stubborn fat without GH side effects.',
    peptides: [
      { peptideId: 'aod-9604', doseOverride: 300, unitOverride: 'mcg' },
    ],
    durationWeeks: 12,
    category: 'Fat Loss',
  },
  {
    id: 'cognitive-stack',
    name: 'Cognitive Enhancement',
    description: 'Semax + Selank intranasal stack for focus, memory, and anxiety reduction.',
    peptides: [
      { peptideId: 'semax', doseOverride: 600, unitOverride: 'mcg' },
      { peptideId: 'selank', doseOverride: 500, unitOverride: 'mcg' },
    ],
    durationWeeks: 4,
    category: 'Nootropic',
  },
];
