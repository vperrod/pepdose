import { useState } from 'react';
import { Calculator, Droplets, ChevronDown } from 'lucide-react';
import { PEPTIDES } from '../data/peptides';

// ponytail: only injectable peptides with reconstitution data make sense here
const RECON_PEPTIDES = PEPTIDES.filter(p => p.reconstitution.typicalVialMg > 0);

export function ReconCalculator() {
  const [vialMg, setVialMg] = useState('');
  const [bacWaterMl, setBacWaterMl] = useState('');
  const [desiredDose, setDesiredDose] = useState('');
  const [doseUnit, setDoseUnit] = useState<'mcg' | 'mg'>('mcg');
  const [selectedPeptide, setSelectedPeptide] = useState('');

  function handlePeptideSelect(id: string) {
    setSelectedPeptide(id);
    if (!id) return;
    const p = RECON_PEPTIDES.find(p => p.id === id);
    if (!p) return;
    setVialMg(String(p.reconstitution.typicalVialMg));
    setBacWaterMl(String(p.reconstitution.bacWaterMl));
    // pre-fill standard dose
    setDesiredDose(String(p.dosing.unit === 'mg' ? p.dosing.standard * 1000 : p.dosing.standard));
    setDoseUnit('mcg');
  }

  // math
  const vial = parseFloat(vialMg);
  const water = parseFloat(bacWaterMl);
  const dose = parseFloat(desiredDose);
  const valid = vial > 0 && water > 0 && dose > 0;

  const doseMg = valid ? (doseUnit === 'mcg' ? dose / 1000 : dose) : 0;
  const concentration = valid ? vial / water : 0; // mg/ml
  const volumeMl = valid ? doseMg / concentration : 0;
  const iu = volumeMl * 100; // U-100 syringe
  const dosesPerVial = doseMg > 0 ? Math.floor(vial / doseMg) : 0;

  // syringe visual: max 100 IU = 1ml, clamp for display
  const syringeFill = valid ? Math.min(iu / 100, 1) : 0;
  const syringeWarning = iu > 100;

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
                {p.name} ({p.reconstitution.typicalVialMg}mg vial)
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
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
        </div>

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
            onClick={() => setDoseUnit(doseUnit === 'mcg' ? 'mg' : 'mcg')}
            className="bg-bg-raised border border-border rounded-xl px-4 py-3 font-mono text-sm font-semibold text-primary tap-target min-w-[60px]"
          >
            {doseUnit}
          </button>
        </div>
      </div>

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
              <p className="text-xs text-text-muted mt-1">IU (U-100)</p>
            </div>
            <div className="bg-bg-raised rounded-xl p-3 text-center">
              <p className="font-mono text-xl font-bold text-text">{dosesPerVial}</p>
              <p className="text-xs text-text-muted mt-1">doses/vial</p>
            </div>
          </div>

          <div className="text-xs text-text-secondary space-y-1">
            <p>Concentration: <span className="font-mono text-text">{concentration.toFixed(2)} mg/ml</span></p>
            {doseMg < 0.001 && (
              <p className="text-yellow-400">Dose very small — verify units are correct</p>
            )}
          </div>
        </div>
      )}

      {/* Syringe visual */}
      {valid && (
        <div className="card-glass p-4 stagger-item" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 mb-3">
            <Droplets className="w-4 h-4 text-primary" />
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
              U-100 Insulin Syringe
            </p>
          </div>

          {/* Syringe barrel */}
          <div className="relative mx-auto" style={{ width: '100%', maxWidth: 280 }}>
            {/* Tick marks */}
            <div className="flex justify-between text-[10px] font-mono text-text-muted px-1 mb-1">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100 IU</span>
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
                Draw to {iu.toFixed(1)} IU mark
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
    </div>
  );
}
