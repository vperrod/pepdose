export interface ProtocolBreak {
  /** 1-based week number within the protocol's total span (including off-cycle weeks). */
  weekStart: number;
  /** 1-based week number within the protocol's total span. */
  weekEnd: number;
  /** Human-readable reason shown in the calendar/timeline. */
  reason: string;
}

export interface ProtocolTemplate {
  id: string;
  name: string;
  description: string;
  peptides: {
    peptideId: string;
    doseOverride?: number;
    unitOverride?: 'mcg' | 'mg' | 'IU';
    frequencyOverride?: string;
    // Per-peptide cycle length. Lets a combo protocol run each peptide for a
    // different duration (e.g. GLP-1 for months while a cosmetic peptide cycles
    // for weeks). Falls back to the template's durationWeeks when unset.
    durationWeeksOverride?: number;
    // Pre-select a variant for this peptide when the template is chosen.
    variantId?: string;
  }[];
  durationWeeks: number;
  category: string;
  /** Optional scheduled off-week ranges — weeks where no doses are generated for any peptide. */
  breaks?: ProtocolBreak[];
}

export const PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    id: 'retatrutide',
    name: 'Retatrutide (weight loss)',
    description: 'Once a week, start low (0.5–2 mg) and only step up after 4+ weeks at a dose. Typical 2–8 mg.',
    peptides: [
      { peptideId: 'retatrutide' },
    ],
    durationWeeks: 12,
    category: 'Weight Loss',
  },
  {
    id: 'tirzepatide',
    name: 'Tirzepatide (weight loss)',
    description: 'Once a week. 2.5 mg for 4 weeks, then +2.5 mg no sooner than every 4 weeks if needed. Most land at 5–10 mg.',
    peptides: [
      { peptideId: 'tirzepatide' },
    ],
    durationWeeks: 12,
    category: 'Weight Loss',
  },
  {
    id: 'cagrilintide',
    name: 'Cagrilintide (GLP-1 add-on)',
    description: 'Once a week, start at 0.25 mg and step up every 4 weeks if needed (max 2.4 mg). Adds to a GLP-1.',
    peptides: [
      { peptideId: 'cagrilintide' },
    ],
    durationWeeks: 12,
    category: 'Weight Loss',
  },
  {
    id: 'klow',
    name: 'KLOW (recovery, skin, gut)',
    description: '4–5 mg a shot, 5 days on and 2 off, for about 12 weeks, then 4 weeks off. Start at 2–3 mg for the first few days.',
    peptides: [
      { peptideId: 'klow' },
    ],
    durationWeeks: 16,
    category: 'Recovery',
    breaks: [
      { weekStart: 13, weekEnd: 16, reason: 'Off-cycle' },
    ],
  },
  {
    id: 'glow',
    name: 'GLOW (recovery, skin)',
    description: 'Same as KLOW without the gut peptide: 4–5 mg, 5 on and 2 off, about 12 weeks, then 4 weeks off.',
    peptides: [
      { peptideId: 'glow-blend' },
    ],
    durationWeeks: 16,
    category: 'Recovery',
    breaks: [
      { weekStart: 13, weekEnd: 16, reason: 'Off-cycle' },
    ],
  },
  {
    id: 'tesamorelin',
    name: 'Tesamorelin (belly fat)',
    description: '1–2 mg a night on an empty stomach, in the belly. Label dose 1.4 mg. Many run 12–16 weeks.',
    peptides: [
      { peptideId: 'tesamorelin' },
    ],
    durationWeeks: 12,
    category: 'Growth Hormone',
  },
  {
    id: 'cjc-ipamorelin',
    name: 'CJC-1295 + Ipamorelin (sleep, recovery)',
    description: 'About 100 mcg of each in one shot at bedtime, empty stomach. Work up to 300 mcg. No trial has tested this stack.',
    peptides: [
      { peptideId: 'cjc-ipamorelin' },
    ],
    durationWeeks: 12,
    category: 'Growth Hormone',
  },
  {
    id: 'mots-c',
    name: 'MOTS-c (metabolic reset)',
    description: '5 mg a shot, 2–3 times a week, for 4–8 weeks, then 4 weeks off. Evidence is mostly mice.',
    peptides: [
      { peptideId: 'mots-c' },
    ],
    durationWeeks: 12,
    category: 'Longevity',
    breaks: [
      { weekStart: 9, weekEnd: 12, reason: 'Off-cycle' },
    ],
  },
  {
    id: 'semax',
    name: 'Semax (focus)',
    description: 'Nasal spray in the morning, 2 weeks on, then 1–3 weeks off. Skip caffeine with it.',
    peptides: [
      { peptideId: 'semax' },
    ],
    durationWeeks: 2,
    category: 'Nootropic',
  },
  {
    id: 'selank',
    name: 'Selank (calm)',
    description: 'Nasal spray, 2 weeks on, then 1–3 weeks off.',
    peptides: [
      { peptideId: 'selank' },
    ],
    durationWeeks: 2,
    category: 'Nootropic',
  },
  {
    id: 'thymosin-alpha-1',
    name: 'Thymosin Alpha-1 (immune)',
    description: '1.6 mg twice a week, 3–4 days apart, for 8–12 weeks, then about a month off.',
    peptides: [
      { peptideId: 'thymosin-alpha-1' },
    ],
    durationWeeks: 12,
    category: 'Immune',
  },
];
