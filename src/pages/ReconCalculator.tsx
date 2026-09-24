import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Calculator, Droplets, ChevronDown } from 'lucide-react';
import { PEPTIDES } from '../data/peptides';
import { mgToIu } from '../utils/iuConvert';
import { readStoredSettings } from '../utils/storedSettings';
import { DisclaimerFooter } from '../components/DisclaimerFooter';
import {
  blendBreakdown,
  computeRecon,
  doseToMg,
  formatComponentDose,
  isImpracticalWater,
  isOverfilledSyringe,
} from '../utils/reconMath';

// ponytail: only injectable peptides with reconstitution data make sense here
const RECON_PEPTIDES = PEPTIDES.filter(p => p.reconstitution.typicalVialMg > 0);

type Mode = 'forward' | 'reverse';
const UNIT_PRESETS = [10, 20, 50];

// Units per mL depends on the syringe: U-100 = 100 units/mL, U-40 = 40 (Settings).
function unitsPerMl(): number {
  return readStoredSettings().syringeType === 'u40' ? 40 : 100;
}

export function ReconCalculator() {
  const uPerMl = unitsPerMl();
  const syringeLabel = uPerMl === 40 ? 'U-40' : 'U-100';
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>('forward');
  const [vialMg, setVialMg] = useState('');
  const [bacWaterMl, setBacWaterMl] = useState('');
  const [desiredDose, setDesiredDose] = useState('');
  const [doseUnit, setDoseUnit] = useState<'mcg' | 'mg' | 'IU'>('mcg');
  const [targetUnits, setTargetUnits] = useState('10'); // reverse mode: units mark to hit
  const [selectedPeptide, setSelectedPeptide] = useState('');
  const [iuMg, setIuMg] = useState('');       // mg to convert
  const [mgPerIu, setMgPerIu] = useState('0.333'); // HGH default 1mg≈3IU

  const selectedPep = RECON_PEPTIDES.find(p => p.id === selectedPeptide);
  const components = selectedPep?.reconstitution.components;

  function handlePeptideSelect(id: string) {
    setSelectedPeptide(id);
    if (!id) return;
    const p = RECON_PEPTIDES.find(p => p.id === id);
    if (!p) return;
    setVialMg(String(p.reconstitution.typicalVialMg));
    setBacWaterMl(String(p.reconstitution.bacWaterMl));
    setDesiredDose(String(p.dosing.standard));
    setDoseUnit(p.dosing.unit);
  }

  // Deep-link target: /calculator?peptide=<id> preselects the peptide (used by the
  // "Reconstitute this" shortcut in the experience guide).
  useEffect(() => {
    const pid = searchParams.get('peptide');
    if (pid && RECON_PEPTIDES.some(p => p.id === pid)) handlePeptideSelect(pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // shared math — pure + unit-tested in utils/reconMath.ts
  const dose = parseFloat(desiredDose);
  const doseMg = doseToMg(dose, doseUnit);
  const targetU = parseFloat(targetUnits);
  const { valid, solvedWater, concentration, volumeMl, units: iu, dosesPerVial } = computeRecon({
    mode,
    vialMg: parseFloat(vialMg),
    doseMg,
    bacWaterMl: parseFloat(bacWaterMl),
    targetUnits: targetU,
    unitsPerMl: uPerMl,
  });

  const componentDoses = valid && components ? blendBreakdown(components, doseMg) : [];

  // syringe visual: max = uPerMl (1ml)
  const syringeFill = valid ? Math.min(iu / uPerMl, 1) : 0;
  const syringeWarning = isOverfilledSyringe(iu, uPerMl);
  const waterImpractical = isImpracticalWater(valid, mode, solvedWater);

  const iuResult = parseFloat(iuMg) > 0 && parseFloat(mgPerIu) > 0 ? mgToIu(parseFloat(iuMg), parseFloat(mgPerIu)) : 0;

  return (
    <div className="safe-top px-5 pt-4 pb-28">
      <header className="mb-6 stagger-item">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reconstitution</h1>
            <p className="text-text-muted text-sm">Calculator</p>
          </div>
        </div>
      </header>

      {/* Peptide selector */}
      <div className="card-glass p-4 mb-4 stagger-item" style={{ animationDelay: '0.05s' }}>
        <label className="text-xs text-text-muted uppercase tracking-wider font-medium block mb-2">
          Peptide (optional)
        </label>
        <div className="relative">
          <select
            value={selectedPeptide}
            onChange={e => handlePeptideSelect(e.target.value)}
            className="w-full bg-bg-raised text-text border border-border rounded-xl px-4 py-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 tap-target"
          >
            <option value="">Custom / Manual</option>
            {RECON_PEPTIDES.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.reconstitution.typicalVialMg}{p.dosing.unit === 'IU' ? ' IU' : 'mg'} vial)
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex bg-bg-raised rounded-xl border border-border overflow-hidden mb-4 stagger-item" style={{ animationDelay: '0.08s' }}>
        <button
          onClick={() => setMode('forward')}
          className={`flex-1 px-3 py-2.5 text-xs font-semibold tap-target transition-colors ${mode === 'forward' ? 'bg-primary text-bg' : 'text-text-muted'}`}
        >
          I know my water → find units
        </button>
        <button
          onClick={() => setMode('reverse')}
          className={`flex-1 px-3 py-2.5 text-xs font-semibold tap-target transition-colors ${mode === 'reverse' ? 'bg-primary text-bg' : 'text-text-muted'}`}
        >
          Clean draw → find water
        </button>
      </div>

      {/* Inputs */}
      <div className="card-glass p-4 mb-4 stagger-item" style={{ animationDelay: '0.1s' }}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider font-medium block mb-1.5">
              Vial size
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={vialMg}
                onChange={e => setVialMg(e.target.value)}
                placeholder="5"
                className="w-full bg-bg-raised text-text border border-border rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 tap-target"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">mg</span>
            </div>
          </div>
          {mode === 'forward' ? (
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider font-medium block mb-1.5">
                BAC water
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={bacWaterMl}
                  onChange={e => setBacWaterMl(e.target.value)}
                  placeholder="2"
                  className="w-full bg-bg-raised text-text border border-border rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 tap-target"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">ml</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider font-medium block mb-1.5">
                Draw to
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={targetUnits}
                  onChange={e => setTargetUnits(e.target.value)}
                  placeholder="10"
                  className="w-full bg-bg-raised text-text border border-border rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 tap-target"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">units</span>
              </div>
            </div>
          )}
        </div>

        {mode === 'reverse' && (
          <div className="flex gap-2 mb-3">
            {UNIT_PRESETS.map(u => (
              <button
                key={u}
                onClick={() => setTargetUnits(String(u))}
                className={`flex-1 py-2 rounded-lg text-xs font-mono font-semibold tap-target border transition-colors ${
                  targetU === u ? 'bg-primary/20 text-primary border-primary/40' : 'bg-bg-raised text-text-muted border-border'
                }`}
              >
                {u}u
              </button>
            ))}
          </div>
        )}

        <label className="text-xs text-text-muted uppercase tracking-wider font-medium block mb-1.5">
          Desired dose
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              value={desiredDose}
              onChange={e => setDesiredDose(e.target.value)}
              placeholder="250"
              className="w-full bg-bg-raised text-text border border-border rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 tap-target"
            />
          </div>
          <button
            onClick={() => setDoseUnit(doseUnit === 'mcg' ? 'mg' : doseUnit === 'mg' ? 'IU' : 'mcg')}
            className="bg-bg-raised border border-border rounded-xl px-4 py-3 font-mono text-sm font-semibold text-primary tap-target min-w-[60px]"
          >
            {doseUnit}
          </button>
        </div>
      </div>

      {/* Reverse-mode headline: how much water to add */}
      {mode === 'reverse' && valid && (
        <div className="card-glass p-4 mb-4 stagger-item" style={{ animationDelay: '0.12s' }}>
          <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">Add this much water</p>
          <p className="font-mono text-3xl font-bold text-primary">{solvedWater.toFixed(2)} <span className="text-lg text-text-muted">mL</span></p>
          <p className="text-xs text-text-secondary mt-1">
            Then your {dose}{doseUnit} dose = <span className="font-mono text-text">{targetU} units</span> on a {syringeLabel} syringe.
          </p>
          {waterImpractical && (
            <p className="text-xs text-yellow-400 mt-2">
              {solvedWater < 0.3 ? 'Very little water — hard to measure. Try a smaller unit mark.' : 'A lot of water — big injection volume. Try a larger unit mark.'}
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {valid && (
        <div className="card-glass p-4 mb-4 stagger-item" style={{ animationDelay: '0.15s' }}>
          <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-3">Results</p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-bg-raised rounded-xl p-3 text-center">
              <p className="font-mono text-xl font-bold text-primary">{volumeMl.toFixed(3)}</p>
              <p className="text-xs text-text-muted mt-1">ml to draw</p>
            </div>
            <div className="bg-bg-raised rounded-xl p-3 text-center">
              <p className="font-mono text-xl font-bold text-secondary">{iu.toFixed(1)}</p>
              <p className="text-xs text-text-muted mt-1">units ({syringeLabel})</p>
            </div>
            <div className="bg-bg-raised rounded-xl p-3 text-center">
              <p className="font-mono text-xl font-bold text-text">{dosesPerVial}</p>
              <p className="text-xs text-text-muted mt-1">doses/vial</p>
            </div>
          </div>

          <div className="text-xs text-text-secondary space-y-1">
            <p>Concentration: <span className="font-mono text-text">{concentration.toFixed(2)} {doseUnit === 'IU' ? 'IU' : 'mg'}/ml</span></p>
            {doseMg < 0.001 && (
              <p className="text-yellow-400">Dose very small — verify units are correct</p>
            )}
          </div>

          {/* Blend per-component breakdown */}
          {componentDoses.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">
                Per injection ({selectedPep?.name.split(' ')[0]} blend)
              </p>
              <div className="space-y-1.5">
                {componentDoses.map(c => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{c.name}</span>
                    <span className="font-mono text-text">
                      {formatComponentDose(c.mg)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Syringe visual */}
      {valid && (
        <div className="card-glass p-4 stagger-item" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 mb-3">
            <Droplets className="w-4 h-4 text-primary" />
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
              {syringeLabel} Insulin Syringe
            </p>
          </div>

          {/* Syringe barrel */}
          <div className="relative mx-auto" style={{ width: '100%', maxWidth: 280 }}>
            {/* Tick marks */}
            <div className="flex justify-between text-[10px] font-mono text-text-muted px-1 mb-1">
              <span>0</span>
              <span>{uPerMl / 4}</span>
              <span>{uPerMl / 2}</span>
              <span>{(uPerMl * 3) / 4}</span>
              <span>{uPerMl} u</span>
            </div>
            {/* Barrel */}
            <div className="relative h-8 bg-bg-raised border border-border rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{
                  width: `${syringeFill * 100}%`,
                  backgroundColor: syringeWarning ? '#ef4444' : 'var(--color-primary)',
                  opacity: 0.7,
                }}
              />
              {/* Needle indicator line at fill level */}
              {syringeFill > 0.02 && (
                <div
                  className="absolute inset-y-0 w-0.5 bg-white/80"
                  style={{ left: `${syringeFill * 100}%` }}
                />
              )}
            </div>
            {/* Reading */}
            <p className="text-center mt-2 font-mono text-sm">
              <span className={syringeWarning ? 'text-red-400' : 'text-primary'}>
                Draw to {iu.toFixed(1)} unit mark
              </span>
              {syringeWarning && (
                <span className="block text-red-400 text-xs mt-1">
                  Exceeds 1ml syringe — use a larger syringe or add more BAC water
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="card-glass p-5 mt-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Droplets className="w-4 h-4 text-secondary" /> mg → IU</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Dose (mg)</label>
            <input type="number" step="any" value={iuMg} onChange={e => setIuMg(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">mg per IU</label>
            <input type="number" step="any" value={mgPerIu} onChange={e => setMgPerIu(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
        <p className="text-sm mt-3 font-mono text-primary">= {iuResult.toFixed(2)} IU</p>
      </div>
      <DisclaimerFooter />
    </div>
  );
}
