import type { Peptide, FrequencyType, TimeOfDay, SchedulePhase } from '../data/peptides';
import type { UserProtocol, ReconMix } from '../db/schema';
import type { Cycle } from './cycle';
import { defaultRecon } from './penClicks';
import { summarizePhases, phasesTotalWeeks } from './scheduleEngine';

// Type definitions
export type DoseConfig = UserProtocol['doses'][number];

export interface CardValue {
  peptideId: string;
  dose: number;
  unit: 'mcg' | 'mg' | 'IU';
  timeOfDay: TimeOfDay;
  frequency: FrequencyType;
  daysOfWeek: number[];
  customFrequencyDays?: number;
  timesPerDay: number;
  onWeeks: number;
  offWeeks: number;
  schedulePhases?: SchedulePhase[];
  variantId?: string;
  customSchedule?: boolean;
  recon?: ReconMix;
  penColor?: string;
}

/** Creates a default CardValue from a Peptide, applying the mapping rules. */
export function defaultCard(peptide: Peptide): CardValue {
  // dose from first variant's doseOverride ?? titration?.[0]?.dose ?? dosing.standard
  const dose = peptide.dosing.protocolVariants?.[0]?.doseOverride ??
               peptide.dosing.titration?.[0]?.dose ??
               peptide.dosing.standard;

  // unit from dosing
  const unit = peptide.dosing.unit;

  // timeOfDay from dosing
  const timeOfDay = peptide.dosing.timeOfDay;

  // timesPerDay from dosing (default 1)
  const timesPerDay = peptide.dosing.timesPerDay || 1;

  // onWeeks/offWeeks from dosing
  const onWeeks = peptide.dosing.cycleWeeks;
  const offWeeks = peptide.dosing.offCycleWeeks;

  // recon from peptide via defaultRecon
  const recon = defaultRecon(peptide);

  // Determine frequency and daysOfWeek from dosing.frequency
  let frequency: FrequencyType;
  let daysOfWeek: number[];

  if (peptide.dosing.frequency === 'daily') {
    frequency = 'daily';
    daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
  } else if (peptide.dosing.frequency === '5x_week') {
    frequency = 'weekly_days';
    daysOfWeek = [1, 2, 3, 4, 5];
  } else if (peptide.dosing.frequency === 'eod') {
    frequency = 'eod';
    daysOfWeek = [];
  } else if (peptide.dosing.frequency === 'weekly') {
    frequency = 'weekly_days';
    daysOfWeek = [1];
  } else if (peptide.dosing.frequency === 'biweekly') {
    frequency = 'biweekly';
    daysOfWeek = [];
  } else if (peptide.dosing.frequency === 'weekly_days') {
    frequency = 'weekly_days';
    daysOfWeek = [1, 4]; // default from docs
  } else if (peptide.dosing.frequency === 'custom') {
    frequency = 'custom';
    daysOfWeek = [];
  } else {
    frequency = peptide.dosing.frequency;
    daysOfWeek = [];
  }

  // If peptide has protocolVariants, use first variant
  let schedulePhases: SchedulePhase[] | undefined;
  let variantId: string | undefined;

  if (peptide.dosing.protocolVariants && peptide.dosing.protocolVariants.length > 0) {
    const firstVariant = peptide.dosing.protocolVariants[0];
    schedulePhases = firstVariant.phases;
    variantId = firstVariant.id;
  }

  return {
    peptideId: peptide.id,
    dose,
    unit,
    timeOfDay,
    frequency,
    daysOfWeek,
    customFrequencyDays: peptide.dosing.frequency === 'custom' ? peptide.dosing.customFrequencyDays : undefined,
    timesPerDay,
    onWeeks,
    offWeeks,
    schedulePhases,
    variantId,
    customSchedule: false,
    recon,
    penColor: undefined,
  };
}

/** Map an array of day numbers (0-6) to a frequency string. */
export function daysToFrequency(days: number[]): 'daily' | 'weekly_days' {
  if (days.length === 7) return 'daily';
  return 'weekly_days';
}

/** Calculate total weeks for a cycle (on + off). */
export function cycleTotalWeeks(onWeeks: number, offWeeks: number): number {
  if (offWeeks < 1) return onWeeks;
  if (isNaN(onWeeks) || onWeeks < 1) return 1;
  return Math.max(24, 2 * (onWeeks + offWeeks));
}

/** Convert a CardValue to a DoseConfig with proper field mapping. */
export function cardToDoseConfig(card: CardValue): DoseConfig {
  const result: Partial<DoseConfig> = {
    peptideId: card.peptideId,
    dose: card.dose,
    unit: card.unit,
    frequency: card.frequency,
    timesPerDay: card.timesPerDay,
    timeOfDay: card.timeOfDay,
    durationWeeks: card.schedulePhases?.length
      ? phasesTotalWeeks(card.schedulePhases)
      : cycleTotalWeeks(card.onWeeks, card.offWeeks),
  };

  // Add daysOfWeek only when frequency is 'weekly_days'
  if (card.frequency === 'weekly_days' && card.daysOfWeek.length > 0) {
    result.daysOfWeek = card.daysOfWeek;
  }

  // Add customFrequencyDays only when frequency is 'custom'
  if (card.frequency === 'custom' && card.customFrequencyDays) {
    result.customFrequencyDays = card.customFrequencyDays;
  }

  // Add cycle only when offWeeks >= 1
  if (card.offWeeks >= 1) {
    result.cycle = { onWeeks: card.onWeeks, offWeeks: card.offWeeks };
  }

  // Pass through optional fields when defined
  if (card.schedulePhases) result.schedulePhases = card.schedulePhases;
  if (card.variantId) result.variantId = card.variantId;
  if (card.customSchedule) result.customSchedule = card.customSchedule;
  if (card.recon) result.recon = card.recon;
  if (card.penColor) result.penColor = card.penColor;

  return result as DoseConfig;
}

/** Generate a weekly on/off strip for a cycle. */
export function cycleStrip(onWeeks: number, offWeeks: number, totalWeeks: number, maxWeeks?: number): boolean[] {
  const weeks = Math.min(totalWeeks, maxWeeks ?? 24);
  const result: boolean[] = [];

  if (offWeeks < 1) {
    for (let w = 1; w <= weeks; w++) result.push(true);
    return result;
  }

  const cycleLength = onWeeks + offWeeks;

  for (let w = 1; w <= weeks; w++) {
    const cyclePos = (w - 1) % cycleLength;
    result.push(cyclePos < onWeeks);
  }

  return result;
}

/** Generate a human-readable summary of a CardValue. */
export function cardSummary(card: CardValue): string {
  const days = card.daysOfWeek;
  let daysPart: string;

  if (card.schedulePhases) {
    daysPart = summarizePhases(card.schedulePhases);
  } else if (days.length === 7) {
    daysPart = 'Every day';
  } else if (days.length === 0) {
    if (card.frequency === 'eod') daysPart = 'Every other day';
    else if (card.frequency === 'biweekly') daysPart = 'Every 2 weeks';
    else if (card.frequency === 'custom' && card.customFrequencyDays) daysPart = `Every ${card.customFrequencyDays} days`;
    else daysPart = '';
  } else {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    daysPart = days.map(d => dayNames[d]).join(' & ');
  }

  const dosePart = `${card.dose} ${card.unit}`;

  if (card.offWeeks >= 1) {
    return `${daysPart}, ${dosePart}. ${card.onWeeks} weeks on, ${card.offWeeks} off.`;
  } else {
    return `${daysPart}, ${dosePart}. ${card.onWeeks} weeks.`;
  }
}
/** Course length after the user edits Weeks on or Weeks off on an existing dose. A phased variant keeps its
 *  own length; turning the off weeks to 0 keeps the current course instead of shrinking it to the on weeks. */
export function cycleEditDuration(
  onWeeks: number, offWeeks: number, existing: number | undefined,
  changed: 'on' | 'off', phased: boolean,
): number {
  if (phased) return existing ?? onWeeks;
  if (offWeeks >= 1) return cycleTotalWeeks(onWeeks, offWeeks);
  return changed === 'on' ? onWeeks : existing ?? onWeeks;
}

/** Inverse of cardToDoseConfig for editing a saved dose. `legacy` is the cycle derived from a protocol's
 *  old regular `breaks`; a saved `cycle` wins. Without either, the whole course counts as weeks on. */
export function doseConfigToCard(d: DoseConfig, legacy?: Cycle | null): CardValue {
  const frequency = d.frequency as FrequencyType;
  const everyDay = [0, 1, 2, 3, 4, 5, 6];
  const daysOfWeek = d.daysOfWeek
    ?? (frequency === 'daily' ? everyDay : frequency === '5x_week' ? [1, 2, 3, 4, 5] : []);
  const cycle = d.cycle ?? legacy ?? null;
  return {
    peptideId: d.peptideId,
    dose: d.dose,
    unit: d.unit,
    timeOfDay: d.timeOfDay as TimeOfDay,
    frequency,
    daysOfWeek,
    customFrequencyDays: d.customFrequencyDays,
    timesPerDay: d.timesPerDay ?? 1,
    onWeeks: cycle?.onWeeks ?? d.durationWeeks ?? 1,
    offWeeks: cycle?.offWeeks ?? 0,
    schedulePhases: d.schedulePhases,
    variantId: d.variantId,
    customSchedule: d.customSchedule,
    recon: d.recon,
    penColor: d.penColor,
  };
}

/** The dose config to store after the user edits a card in the edit sheet. Untouched on/off weeks and preset keep the
 *  saved course length and any legacy `breaks`-derived pattern (no `cycle` written); otherwise the course follows
 *  cycleEditDuration. */
export function mergeEditedCard(existing: DoseConfig, before: CardValue, next: CardValue): DoseConfig {
  const cfg = cardToDoseConfig(next);
  const presetChanged = before.variantId !== next.variantId || !!before.schedulePhases?.length !== !!next.schedulePhases?.length;
  const cycleChanged = before.onWeeks !== next.onWeeks || before.offWeeks !== next.offWeeks;
  if (presetChanged) return cfg;
  if (!cycleChanged) {
    const { cycle: _newCycle, ...rest } = cfg;
    return { ...rest, durationWeeks: existing.durationWeeks ?? cfg.durationWeeks, ...(existing.cycle ? { cycle: existing.cycle } : {}) };
  }
  const durationWeeks = cycleEditDuration(
    next.onWeeks, next.offWeeks, existing.durationWeeks,
    before.onWeeks !== next.onWeeks ? 'on' : 'off', !!next.schedulePhases?.length,
  );
  return { ...cfg, durationWeeks };
}
