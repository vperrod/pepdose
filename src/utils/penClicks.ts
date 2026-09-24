// Turns a protocol's reconstitution mix (vial amount + BAC water) into the
// number of pen clicks for a given dose. Separate from reconMath.ts, which
// answers "how much water should I add" — this answers "what do I dial today".
import type { Peptide } from '../data/peptides';
import type { ReconMix } from '../db/schema';
import { readStoredSettings } from './storedSettings';

/** Most peptide pens dial 1 insulin unit (0.01 ml) per click; some do 0.005/0.02. */
export const DEFAULT_ML_PER_CLICK = 0.01;

export interface ClickDose {
  /** vial units per ml (mg/ml, or IU/ml for IU peptides) */
  concentration: number;
  volumeMl: number;
  clicks: number;
}

export function penMlPerClick(): number {
  const v = parseFloat(String(readStoredSettings().penMlPerClick));
  return v > 0 ? v : DEFAULT_ML_PER_CLICK;
}

/** Pre-fill for a new protocol: the peptide's own typical vial + water.
 *  `typicalVialMg` already holds an IU count for IU peptides. */
export function defaultRecon(pep: Peptide | undefined): ReconMix | undefined {
  return pep && pep.reconstitution.typicalVialMg > 0
    ? { vialAmount: pep.reconstitution.typicalVialMg, bacWaterMl: pep.reconstitution.bacWaterMl }
    : undefined;
}

/** Dose expressed in the vial's own unit: mcg converts to mg, mg and IU pass through. */
function inVialUnit(dose: number, unit: 'mcg' | 'mg' | 'IU'): number {
  return unit === 'mcg' ? dose / 1000 : dose;
}

export function clicksForDose(
  dose: number,
  unit: 'mcg' | 'mg' | 'IU',
  recon: ReconMix | undefined,
  mlPerClick: number = DEFAULT_ML_PER_CLICK,
): ClickDose | null {
  const amount = inVialUnit(dose, unit);
  if (!(amount > 0) || !(recon && recon.vialAmount > 0 && recon.bacWaterMl > 0) || !(mlPerClick > 0)) {
    return null;
  }
  const concentration = recon.vialAmount / recon.bacWaterMl;
  const volumeMl = amount / concentration;
  return { concentration, volumeMl, clicks: volumeMl / mlPerClick };
}

/** e.g. "12 clicks · 0.12 ml" — clicks to one decimal, trailing .0 dropped. */
export function formatClicks(c: ClickDose | null): string | null {
  if (!c) return null;
  const n = c.clicks.toFixed(1).replace(/\.0$/, '');
  return `${n} click${n === '1' ? '' : 's'} · ${c.volumeMl.toFixed(2)} ml`;
}
