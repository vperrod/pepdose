export type PeptideCategory =
  | 'healing'
  | 'glp1'
  | 'gh_secretagogue'
  | 'fat_loss'
  | 'cosmetic'
  | 'sexual_health'
  | 'nootropic';

export type InjectionRoute = 'subq' | 'im' | 'oral' | 'intranasal' | 'topical';
export type FrequencyType = 'daily' | 'eod' | 'weekly' | 'biweekly' | 'custom';
export type TimeOfDay = 'morning_fasting' | 'morning' | 'evening' | 'pre_bed' | 'before_activity' | 'any';

export interface TitrationStep {
  weekStart: number;
  weekEnd: number;
  dose: number;
  unit: 'mcg' | 'mg';
}

export interface DosingProtocol {
  low: number;
  standard: number;
  high: number;
  unit: 'mcg' | 'mg';
  frequency: FrequencyType;
  customFrequencyDays?: number;
  timesPerDay?: number;
  cycleWeeks: number;
  offCycleWeeks: number;
  titration?: TitrationStep[];
  timeOfDay: TimeOfDay;
  withFood: 'fasting' | 'fed' | 'either';
}

export interface Peptide {
  id: string;
  name: string;
  aliases: string[];
  category: PeptideCategory;
  halfLifeHours: number;
  mechanismShort: string;
  route: InjectionRoute;
  needleGauge: string;
  dosing: DosingProtocol;
  reconstitution: {
    typicalVialMg: number;
    bacWaterMl: number;
    shelfLifeDays: number;
    storageTemp: string;
  };
  cyclingReason: string;
  isCustom?: boolean;
}

export const PEPTIDES: Peptide[] = [
  {
    id: 'bpc-157',
    name: 'BPC-157',
    aliases: ['Body Protection Compound 157', 'PL 14736'],
    category: 'healing',
    halfLifeHours: 4,
    mechanismShort: 'Upregulates growth factor receptors (VEGF, FGF), promotes angiogenesis and tendon/ligament repair. Derived from gastric juice protein.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 200,
      standard: 500,
      high: 800,
      unit: 'mcg',
      frequency: 'daily',
      timesPerDay: 1,
      cycleWeeks: 6,
      offCycleWeeks: 4,
      timeOfDay: 'any',
      withFood: 'either',
    },
    reconstitution: {
      typicalVialMg: 5,
      bacWaterMl: 2,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Prevents receptor desensitization. Effects often persist 2-4 weeks post-cycle.',
  },
  {
    id: 'tb-500',
    name: 'TB-500',
    aliases: ['Thymosin Beta 4', 'TB4'],
    category: 'healing',
    halfLifeHours: 6,
    mechanismShort: 'Promotes cell migration, blood vessel formation, and tissue regeneration. Reduces inflammation via actin-binding.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 2,
      standard: 2.5,
      high: 5,
      unit: 'mg',
      frequency: 'custom',
      customFrequencyDays: 3,
      cycleWeeks: 6,
      offCycleWeeks: 4,
      timeOfDay: 'any',
      withFood: 'either',
    },
    reconstitution: {
      typicalVialMg: 5,
      bacWaterMl: 2,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Loading phase (2x/week × 4 weeks) then maintenance (weekly). Off-cycle prevents tolerance.',
  },
  {
    id: 'kpv',
    name: 'KPV',
    aliases: ['Lys-Pro-Val', 'Alpha-MSH fragment'],
    category: 'healing',
    halfLifeHours: 2,
    mechanismShort: 'Anti-inflammatory tripeptide derived from alpha-MSH. Inhibits NF-kB pathway. Used for gut inflammation and skin healing.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 200,
      standard: 500,
      high: 1000,
      unit: 'mcg',
      frequency: 'daily',
      cycleWeeks: 4,
      offCycleWeeks: 2,
      timeOfDay: 'morning',
      withFood: 'fasting',
    },
    reconstitution: {
      typicalVialMg: 5,
      bacWaterMl: 2,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Short cycles recommended. Anti-inflammatory effects build over 2-3 weeks.',
  },
  {
    id: 'semaglutide',
    name: 'Semaglutide',
    aliases: ['Ozempic', 'Wegovy', 'Rybelsus'],
    category: 'glp1',
    halfLifeHours: 168,
    mechanismShort: 'GLP-1 receptor agonist. Slows gastric emptying, increases insulin secretion, reduces appetite via hypothalamic signaling.',
    route: 'subq',
    needleGauge: '30-31G insulin',
    dosing: {
      low: 0.25,
      standard: 1,
      high: 2.4,
      unit: 'mg',
      frequency: 'weekly',
      cycleWeeks: 52,
      offCycleWeeks: 0,
      timeOfDay: 'any',
      withFood: 'either',
      titration: [
        { weekStart: 1, weekEnd: 4, dose: 0.25, unit: 'mg' },
        { weekStart: 5, weekEnd: 8, dose: 0.5, unit: 'mg' },
        { weekStart: 9, weekEnd: 12, dose: 1.0, unit: 'mg' },
        { weekStart: 13, weekEnd: 16, dose: 1.7, unit: 'mg' },
        { weekStart: 17, weekEnd: 999, dose: 2.4, unit: 'mg' },
      ],
    },
    reconstitution: {
      typicalVialMg: 5,
      bacWaterMl: 2,
      shelfLifeDays: 56,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Typically long-term use. Titration critical to minimize GI side effects. Consult provider for discontinuation.',
  },
  {
    id: 'tirzepatide',
    name: 'Tirzepatide',
    aliases: ['Mounjaro', 'Zepbound'],
    category: 'glp1',
    halfLifeHours: 120,
    mechanismShort: 'Dual GIP/GLP-1 receptor agonist. More potent appetite suppression and glucose control than GLP-1 alone.',
    route: 'subq',
    needleGauge: '30-31G insulin',
    dosing: {
      low: 2.5,
      standard: 10,
      high: 15,
      unit: 'mg',
      frequency: 'weekly',
      cycleWeeks: 52,
      offCycleWeeks: 0,
      timeOfDay: 'any',
      withFood: 'either',
      titration: [
        { weekStart: 1, weekEnd: 4, dose: 2.5, unit: 'mg' },
        { weekStart: 5, weekEnd: 8, dose: 5, unit: 'mg' },
        { weekStart: 9, weekEnd: 12, dose: 7.5, unit: 'mg' },
        { weekStart: 13, weekEnd: 16, dose: 10, unit: 'mg' },
        { weekStart: 17, weekEnd: 20, dose: 12.5, unit: 'mg' },
        { weekStart: 21, weekEnd: 999, dose: 15, unit: 'mg' },
      ],
    },
    reconstitution: {
      typicalVialMg: 10,
      bacWaterMl: 2,
      shelfLifeDays: 56,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Long-term use typical. Strict 4-week minimum per titration step. Never skip doses.',
  },
  {
    id: 'retatrutide',
    name: 'Retatrutide',
    aliases: ['LY3437943', 'Reta'],
    category: 'glp1',
    halfLifeHours: 144,
    mechanismShort: 'Triple agonist: GIP + GLP-1 + glucagon receptors. Phase 2 trial (NEJM 2023, n=338) showed up to -24.2% body weight at 48 weeks (12mg group). Glucagon component adds energy expenditure and hepatic fat reduction beyond pure GLP-1 agonists.',
    route: 'subq',
    needleGauge: '30-31G insulin',
    dosing: {
      low: 4,
      standard: 8,
      high: 12,
      unit: 'mg',
      frequency: 'weekly',
      cycleWeeks: 48,
      offCycleWeeks: 0,
      timeOfDay: 'any',
      withFood: 'either',
      titration: [
        { weekStart: 1, weekEnd: 4, dose: 2, unit: 'mg' },
        { weekStart: 5, weekEnd: 8, dose: 4, unit: 'mg' },
        { weekStart: 9, weekEnd: 12, dose: 6, unit: 'mg' },
        { weekStart: 13, weekEnd: 16, dose: 9, unit: 'mg' },
        { weekStart: 17, weekEnd: 999, dose: 12, unit: 'mg' },
      ],
    },
    reconstitution: {
      typicalVialMg: 10,
      bacWaterMl: 2,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Phase 3 trials ongoing (TRIUMPH program). Not yet FDA-approved. Uses the Phase 3 escalation (2→4→6→9→12mg, 4-week steps) — the smoother ladder Lilly adopted after the Phase 2 4→8mg doubling roughly doubled GI side effects. Community often titrates even slower and holds at 4–8mg. Monitor liver enzymes and lipids.',
  },
  {
    id: 'cjc-1295-no-dac',
    name: 'CJC-1295 (no DAC)',
    aliases: ['Modified GRF 1-29', 'Mod GRF'],
    category: 'gh_secretagogue',
    halfLifeHours: 0.5,
    mechanismShort: 'GHRH analog that stimulates pulsatile GH release from pituitary. Best combined with a GHRP like Ipamorelin.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 100,
      standard: 100,
      high: 300,
      unit: 'mcg',
      frequency: 'daily',
      timesPerDay: 2,
      cycleWeeks: 12,
      offCycleWeeks: 4,
      timeOfDay: 'pre_bed',
      withFood: 'fasting',
    },
    reconstitution: {
      typicalVialMg: 2,
      bacWaterMl: 2,
      shelfLifeDays: 21,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'GH pulsatility may blunt with continuous use. 12 weeks on, 4 weeks off preserves response.',
  },
  {
    id: 'cjc-1295-dac',
    name: 'CJC-1295 (with DAC)',
    aliases: ['CJC-1295 DAC', 'Drug Affinity Complex'],
    category: 'gh_secretagogue',
    halfLifeHours: 192,
    mechanismShort: 'Long-acting GHRH analog with DAC for albumin binding. Provides sustained GH elevation (not pulsatile).',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 1,
      standard: 2,
      high: 2,
      unit: 'mg',
      frequency: 'weekly',
      cycleWeeks: 12,
      offCycleWeeks: 4,
      timeOfDay: 'pre_bed',
      withFood: 'fasting',
    },
    reconstitution: {
      typicalVialMg: 2,
      bacWaterMl: 2,
      shelfLifeDays: 21,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Sustained GH elevation can cause water retention and insulin resistance. Cycling mitigates sides.',
  },
  {
    id: 'ipamorelin',
    name: 'Ipamorelin',
    aliases: ['Ipam'],
    category: 'gh_secretagogue',
    halfLifeHours: 2,
    mechanismShort: 'Selective ghrelin receptor agonist (GHRP). Stimulates GH release without significant cortisol or prolactin increase.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 100,
      standard: 200,
      high: 300,
      unit: 'mcg',
      frequency: 'daily',
      timesPerDay: 2,
      cycleWeeks: 12,
      offCycleWeeks: 4,
      timeOfDay: 'pre_bed',
      withFood: 'fasting',
    },
    reconstitution: {
      typicalVialMg: 2,
      bacWaterMl: 2,
      shelfLifeDays: 21,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Best paired with CJC-1295 (no DAC) for synergistic GH pulse. Cycle to maintain receptor sensitivity.',
  },
  {
    id: 'sermorelin',
    name: 'Sermorelin',
    aliases: ['GRF 1-29', 'Geref'],
    category: 'gh_secretagogue',
    halfLifeHours: 0.2,
    mechanismShort: 'Natural GHRH fragment (first 29 amino acids). Stimulates physiological GH release. Mildest GH secretagogue.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 100,
      standard: 300,
      high: 500,
      unit: 'mcg',
      frequency: 'daily',
      cycleWeeks: 12,
      offCycleWeeks: 4,
      timeOfDay: 'pre_bed',
      withFood: 'fasting',
    },
    reconstitution: {
      typicalVialMg: 2,
      bacWaterMl: 2,
      shelfLifeDays: 21,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Very short half-life, mimics natural GHRH pulse. Cycle to prevent pituitary desensitization.',
  },
  {
    id: 'tesamorelin',
    name: 'Tesamorelin',
    aliases: ['Egrifta'],
    category: 'gh_secretagogue',
    halfLifeHours: 0.43,
    mechanismShort: 'FDA-approved GHRH analog for visceral fat reduction in HIV lipodystrophy. Strong GH stimulation.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 1,
      standard: 2,
      high: 2,
      unit: 'mg',
      frequency: 'daily',
      cycleWeeks: 12,
      offCycleWeeks: 4,
      timeOfDay: 'pre_bed',
      withFood: 'fasting',
    },
    reconstitution: {
      typicalVialMg: 2,
      bacWaterMl: 2,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Strong GH stimulation — cycling prevents IGF-1 overshoot and insulin resistance.',
  },
  {
    id: 'mk-677',
    name: 'MK-677',
    aliases: ['Ibutamoren', 'Nutrobal'],
    category: 'gh_secretagogue',
    halfLifeHours: 24,
    mechanismShort: 'Oral ghrelin mimetic. Long-acting GH secretagogue. Increases appetite, GH, and IGF-1 without injection.',
    route: 'oral',
    needleGauge: 'N/A (oral)',
    dosing: {
      low: 10,
      standard: 25,
      high: 25,
      unit: 'mg',
      frequency: 'daily',
      cycleWeeks: 12,
      offCycleWeeks: 4,
      timeOfDay: 'pre_bed',
      withFood: 'either',
    },
    reconstitution: {
      typicalVialMg: 0,
      bacWaterMl: 0,
      shelfLifeDays: 365,
      storageTemp: 'Room temperature, away from light',
    },
    cyclingReason: 'Can cause insulin resistance and water retention with prolonged use. Monitor blood glucose.',
  },
  {
    id: 'aod-9604',
    name: 'AOD-9604',
    aliases: ['Anti-Obesity Drug 9604', 'hGH fragment 176-191'],
    category: 'fat_loss',
    halfLifeHours: 1,
    mechanismShort: 'Modified fragment of hGH (amino acids 176-191). Stimulates lipolysis without GH side effects (no glucose impact).',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 250,
      standard: 300,
      high: 500,
      unit: 'mcg',
      frequency: 'daily',
      cycleWeeks: 12,
      offCycleWeeks: 4,
      timeOfDay: 'morning_fasting',
      withFood: 'fasting',
    },
    reconstitution: {
      typicalVialMg: 5,
      bacWaterMl: 2,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Fat loss effects plateau around 12 weeks. Off-cycle resets lipase sensitivity.',
  },
  {
    id: 'ghk-cu',
    name: 'GHK-Cu',
    aliases: ['Copper peptide', 'GHK-Copper'],
    category: 'cosmetic',
    halfLifeHours: 1,
    mechanismShort: 'Copper-binding tripeptide. Stimulates collagen synthesis, wound healing, and has anti-aging properties. Remodels tissue.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 1,
      standard: 2,
      high: 3,
      unit: 'mg',
      frequency: 'daily',
      cycleWeeks: 8,
      offCycleWeeks: 4,
      timeOfDay: 'any',
      withFood: 'either',
    },
    reconstitution: {
      typicalVialMg: 5,
      bacWaterMl: 2,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Copper accumulation risk with prolonged use. Cycle to maintain safety margin.',
  },
  {
    id: 'epithalon',
    name: 'Epithalon',
    aliases: ['Epitalon', 'Epithalone', 'AEDG peptide'],
    category: 'cosmetic',
    halfLifeHours: 2,
    mechanismShort: 'Telomerase activator. May lengthen telomeres and slow cellular aging. Regulates melatonin production.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 5,
      standard: 10,
      high: 10,
      unit: 'mg',
      frequency: 'daily',
      cycleWeeks: 2,
      offCycleWeeks: 26,
      timeOfDay: 'morning',
      withFood: 'either',
    },
    reconstitution: {
      typicalVialMg: 10,
      bacWaterMl: 2,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Short intense cycles: 10 days on, repeat every 4-6 months. Telomerase activation persists.',
  },
  {
    id: 'pt-141',
    name: 'PT-141',
    aliases: ['Bremelanotide', 'Vyleesi'],
    category: 'sexual_health',
    halfLifeHours: 2.7,
    mechanismShort: 'Melanocortin-4 receptor agonist. Acts centrally (brain) to increase sexual desire. FDA-approved for female HSDD.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 0.5,
      standard: 1.75,
      high: 2,
      unit: 'mg',
      frequency: 'custom',
      customFrequencyDays: 7,
      cycleWeeks: 0,
      offCycleWeeks: 0,
      timeOfDay: 'before_activity',
      withFood: 'either',
    },
    reconstitution: {
      typicalVialMg: 10,
      bacWaterMl: 2,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'As-needed use only. Max 8 doses/month. NOT for daily use — causes nausea and blood pressure changes.',
  },
  {
    id: 'semax',
    name: 'Semax',
    aliases: ['MEHFPGP'],
    category: 'nootropic',
    halfLifeHours: 0.5,
    mechanismShort: 'Synthetic ACTH(4-10) analog. Enhances BDNF, improves focus, memory, and neuroprotection. Intranasal delivery.',
    route: 'intranasal',
    needleGauge: 'N/A (intranasal)',
    dosing: {
      low: 200,
      standard: 600,
      high: 1000,
      unit: 'mcg',
      frequency: 'daily',
      timesPerDay: 2,
      cycleWeeks: 4,
      offCycleWeeks: 4,
      timeOfDay: 'morning',
      withFood: 'either',
    },
    reconstitution: {
      typicalVialMg: 3,
      bacWaterMl: 0,
      shelfLifeDays: 30,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Prevents BDNF pathway desensitization. Equal on/off cycles maintain cognitive benefits.',
  },
  {
    id: 'selank',
    name: 'Selank',
    aliases: ['TP-7'],
    category: 'nootropic',
    halfLifeHours: 0.3,
    mechanismShort: 'Synthetic tuftsin analog. Anxiolytic and nootropic. Modulates GABA and serotonin without sedation.',
    route: 'intranasal',
    needleGauge: 'N/A (intranasal)',
    dosing: {
      low: 250,
      standard: 500,
      high: 750,
      unit: 'mcg',
      frequency: 'daily',
      timesPerDay: 2,
      cycleWeeks: 4,
      offCycleWeeks: 4,
      timeOfDay: 'morning',
      withFood: 'either',
    },
    reconstitution: {
      typicalVialMg: 3,
      bacWaterMl: 0,
      shelfLifeDays: 30,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'GABA modulation tolerance possible. 4 weeks on, 4 weeks off is standard.',
  },
  {
    id: 'glow-blend',
    name: 'GLOW (GHK-Cu + TB-500 + BPC-157)',
    aliases: ['GLOW', 'GLOW blend', 'Skin Tightening Blend', 'GHK-Cu/TB-500/BPC-157'],
    category: 'cosmetic',
    halfLifeHours: 4,
    mechanismShort: 'Pre-mixed 70mg vial: GHK-Cu (50mg) + TB-500 (10mg) + BPC-157 (10mg) at fixed 50/10/10 ratio. Anchored on GHK-Cu for collagen synthesis. TB-500 moves repair cells into position. BPC-157 restores blood flow to repair area. Blue-green tint when reconstituted (copper). Designed for skin laxity during weight loss and post-surgical recovery.',
    route: 'subq',
    needleGauge: '29-31G insulin',
    dosing: {
      low: 1.4,
      standard: 2.33,
      high: 3.5,
      unit: 'mg',
      frequency: 'daily',
      cycleWeeks: 8,
      offCycleWeeks: 4,
      timeOfDay: 'morning',
      withFood: 'either',
    },
    reconstitution: {
      typicalVialMg: 70,
      bacWaterMl: 3,
      shelfLifeDays: 28,
      storageTemp: '2-8°C refrigerated',
    },
    cyclingReason: 'Reconstitute 70mg in 3mL BAC water (23.3mg/mL): a 2.33mg dose = 10 units on a U-100 syringe. Cycle: daily weeks 1-4, 5x/week weeks 5-8, then 4-8 weeks off (or step down to 2-3x/week maintenance). Breaks let newly built collagen organize AND clear copper — GHK-Cu accumulation is the limiting factor, so never run continuously. Stop early if you get a metallic taste or GI issues.',
  },
];

export function getPeptideById(id: string): Peptide | undefined {
  return PEPTIDES.find(p => p.id === id);
}

export function getPeptidesByCategory(category: PeptideCategory): Peptide[] {
  return PEPTIDES.filter(p => p.category === category);
}

export const CATEGORY_LABELS: Record<PeptideCategory, string> = {
  healing: 'Healing & Recovery',
  glp1: 'GLP-1 Agonists',
  gh_secretagogue: 'GH Secretagogues',
  fat_loss: 'Fat Loss',
  cosmetic: 'Cosmetic / Anti-Aging',
  sexual_health: 'Sexual Health',
  nootropic: 'Nootropic',
};
