import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Plus, Droplets, AlertTriangle, Trash2, X } from 'lucide-react';
import { getVials, saveVial, updateVial, getDoseLogsForPeptide } from '../db/operations';
import { PEPTIDES, getPeptideById } from '../data/peptides';
import type { Vial } from '../db/schema';
import { format, differenceInDays, parseISO } from 'date-fns';
import { predictEmptyDate } from '../utils/vialForecast';
import { UserPicker } from '../components/UserPicker';
import { UserBadge } from '../components/UserBadge';
import { useOwnerFilter } from '../context/ViewFilterContext';
import { getLastOwner, setLastOwner, type UserName } from '../data/users';

export function VialInventory() {
  const navigate = useNavigate();
  const [vials, setVials] = useState<Vial[]>([]);
  const [emptyDates, setEmptyDates] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [peptideId, setPeptideId] = useState('');
  const [amountMg, setAmountMg] = useState('');
  const [bacWater, setBacWater] = useState('');
  const [perDose, setPerDose] = useState('');
  const [perDoseUnit, setPerDoseUnit] = useState<'mcg' | 'mg' | 'IU'>('mg');
  const [dosesRemaining, setDosesRemaining] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [owner, setOwner] = useState<UserName>(getLastOwner());
  const applyOwnerFilter = useOwnerFilter();

  function selectPeptide(id: string) {
    setPeptideId(id);
    const p = getPeptideById(id);
    if (!p) return;
    setAmountMg(String(p.reconstitution.typicalVialMg || ''));
    setBacWater(String(p.reconstitution.bacWaterMl || ''));
    setPerDose(String(p.dosing.standard));
    setPerDoseUnit(p.dosing.unit);
    // Prefill total doses from the vial's own reconstitution defaults.
    const stdMg = p.dosing.unit === 'mcg' ? p.dosing.standard / 1000 : p.dosing.standard;
    const doses = p.reconstitution.typicalVialMg > 0 && stdMg > 0
      ? Math.floor(p.reconstitution.typicalVialMg / stdMg)
      : 0;
    setDosesRemaining(doses > 0 ? String(doses) : '');
  }

  // Reconstitution math for the add-vial form: derive doses-per-vial + concentration.
  const vialMgNum = parseFloat(amountMg);
  const waterNum = parseFloat(bacWater);
  const perDoseMg = parseFloat(perDose) > 0 ? (perDoseUnit === 'mcg' ? parseFloat(perDose) / 1000 : parseFloat(perDose)) : 0;
  const computedDoses = vialMgNum > 0 && perDoseMg > 0 ? Math.floor(vialMgNum / perDoseMg) : 0;
  const concentration = vialMgNum > 0 && waterNum > 0 ? vialMgNum / waterNum : 0;
  const unitsPerDose = concentration > 0 && perDoseMg > 0 ? (perDoseMg / concentration) * 100 : 0;

  const load = useCallback(async () => {
    const list = await getVials();
    setVials(list);
    const entries = await Promise.all(
      list.filter(v => v.status === 'active').map(async (v) => {
        const plogs = await getDoseLogsForPeptide(v.peptideId);
        const ownLogs = plogs.filter(l => l.owner === v.owner);
        const d = predictEmptyDate(v.dosesRemaining, ownLogs.map(l => l.date), new Date());
        return [v.id, d] as const;
      })
    );
    const map: Record<string, string> = {};
    for (const [id, d] of entries) {
      if (d) map[id] = d;
    }
    setEmptyDates(map);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!peptideId || !amountMg) return;
    const totalDoses = dosesRemaining ? parseInt(dosesRemaining) : 0;
    await saveVial({
      peptideId,
      amountMg: parseFloat(amountMg),
      bacWaterMl: bacWater ? parseFloat(bacWater) : 0,
      reconstitutionDate: new Date().toISOString(),
      dosesRemaining: totalDoses,
      totalDoses,
      status: 'active',
      storageLocation: storageLocation || undefined,
      owner,
    });
    setLastOwner(owner);
    setPeptideId(''); setAmountMg(''); setBacWater(''); setPerDose(''); setDosesRemaining(''); setStorageLocation('');
    setShowForm(false);
    load();
  };

  const handleDiscard = async (id: string) => {
    const pep = getPeptideById(vials.find(v => v.id === id)?.peptideId ?? '');
    if (!window.confirm(`Discard this ${pep?.name ?? ''} vial? It will be moved to Empty / Discarded.`)) return;
    await updateVial(id, { status: 'empty' });
    load();
  };

  const visible = applyOwnerFilter(vials);
  const active = visible.filter(v => v.status === 'active');
  const empty = visible.filter(v => v.status === 'empty');

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center gap-3 mb-5 stagger-item">
        <button onClick={() => navigate(-1)} className="tap-target p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">Vial Inventory</h1>
        <button onClick={() => setShowForm(true)} className="tap-target p-2 bg-primary/20 rounded-xl">
          <Plus className="w-5 h-5 text-primary" />
        </button>
      </div>

      {showForm && (
        <div className="card-glass p-4 mb-4 stagger-item space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-sm">Add Vial</p>
            <button onClick={() => setShowForm(false)} className="p-1"><X className="w-4 h-4 text-text-muted" /></button>
          </div>
          <UserPicker value={owner} onChange={setOwner} />
          <select value={peptideId} onChange={e => selectPeptide(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm">
            <option value="">Select peptide...</option>
            {PEPTIDES.filter(p => p.route !== 'oral' && p.route !== 'intranasal').map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" inputMode="decimal" placeholder="Amount (mg)" value={amountMg} onChange={e => setAmountMg(e.target.value)} className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm" />
            <input type="number" inputMode="decimal" placeholder="BAC water (ml)" value={bacWater} onChange={e => setBacWater(e.target.value)} className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm" />
          </div>

          {/* Dose per injection → auto-computes doses/vial for an accurate run-out forecast */}
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" placeholder="Dose per injection" value={perDose} onChange={e => setPerDose(e.target.value)} className="flex-1 bg-bg border border-border rounded-xl px-3 py-2.5 text-sm" />
            <button
              onClick={() => setPerDoseUnit(perDoseUnit === 'mcg' ? 'mg' : perDoseUnit === 'mg' ? 'IU' : 'mcg')}
              className="bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-semibold text-primary min-w-[56px]"
            >
              {perDoseUnit}
            </button>
          </div>
          {computedDoses > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2">
              <p className="text-xs text-text-secondary">
                ≈ <span className="font-mono text-text">{computedDoses}</span> doses/vial
                {concentration > 0 && <> · <span className="font-mono text-text">{concentration.toFixed(1)}</span> mg/ml</>}
                {unitsPerDose > 0 && <> · <span className="font-mono text-text">{unitsPerDose.toFixed(0)}</span>u/dose</>}
              </p>
              <button
                onClick={() => setDosesRemaining(String(computedDoses))}
                className="text-xs font-semibold text-primary tap-target px-2 py-1"
              >
                Use
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input type="number" inputMode="numeric" placeholder="Total doses" value={dosesRemaining} onChange={e => setDosesRemaining(e.target.value)} className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm" />
            <input type="text" placeholder="Location" value={storageLocation} onChange={e => setStorageLocation(e.target.value)} className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <button onClick={handleAdd} className="w-full bg-primary text-bg font-semibold py-2.5 rounded-xl text-sm">Add Vial</button>
        </div>
      )}

      {active.length === 0 && !showForm && (
        <div className="card-glass p-8 text-center stagger-item">
          <Droplets className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">No active vials</p>
          <p className="text-text-muted text-xs mt-1">Tap + to add your first vial</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2 mb-6">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2 stagger-item">Active ({active.length})</p>
          {active.map((v, i) => {
            const pep = getPeptideById(v.peptideId);
            const daysSinceRecon = v.reconstitutionDate ? differenceInDays(new Date(), parseISO(v.reconstitutionDate)) : null;
            const shelfLife = pep?.reconstitution.shelfLifeDays ?? 28;
            const budDaysLeft = daysSinceRecon !== null ? shelfLife - daysSinceRecon : null;
            const budWarn = budDaysLeft !== null && budDaysLeft <= 5;
            const budExpired = budDaysLeft !== null && budDaysLeft < 0;
            const lowStock = v.dosesRemaining <= 3 && v.dosesRemaining > 0;

            return (
              <div key={v.id} className="card-glass p-4 stagger-item" style={{ animationDelay: `${0.05 + i * 0.04}s` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{pep?.name || v.peptideId}</p>
                      <UserBadge owner={v.owner} />
                    </div>
                    <p className="text-xs text-text-muted">{v.amountMg}mg · {v.bacWaterMl ? `${v.bacWaterMl}ml BAC` : 'unreconstituted'}</p>
                  </div>
                  <button onClick={() => handleDiscard(v.id)} aria-label={`Discard ${pep?.name || 'vial'}`} className="p-1.5 text-text-muted hover:text-danger">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 bg-bg rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${v.totalDoses ? (v.dosesRemaining / v.totalDoses) * 100 : 0}%`,
                        backgroundColor: v.dosesRemaining <= 3 ? '#ef4444' : '#00d4aa',
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-text-muted">{v.dosesRemaining}/{v.totalDoses}</span>
                </div>

                {(budWarn || lowStock) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lowStock && (
                      <span className="text-[10px] text-warning flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Low stock · {v.dosesRemaining} left
                      </span>
                    )}
                    {budWarn && budDaysLeft !== null && (
                      <span className={`text-[10px] flex items-center gap-1 ${budExpired ? 'text-danger' : 'text-warning'}`}>
                        <AlertTriangle className="w-3 h-3" />
                        {budExpired ? `Expired ${-budDaysLeft}d ago` : budDaysLeft === 0 ? 'Expires today' : `Expires in ${budDaysLeft}d`}
                      </span>
                    )}
                  </div>
                )}

                {v.reconstitutionDate && (
                  <p className="text-[10px] text-text-muted mt-1">
                    Reconstituted {format(parseISO(v.reconstitutionDate), 'MMM d')}
                    {budDaysLeft !== null && budDaysLeft >= 0 && ` · use by ${format(new Date(parseISO(v.reconstitutionDate).getTime() + shelfLife * 86400000), 'MMM d')}`}
                    {v.storageLocation && ` · ${v.storageLocation}`}
                  </p>
                )}

                {emptyDates[v.id] && (
                  <p className="text-xs text-text-muted mt-1">Est. empty ~{emptyDates[v.id]}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {empty.length > 0 && (
        <div>
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2 stagger-item">Empty / Discarded ({empty.length})</p>
          {empty.map((v, i) => {
            const pep = getPeptideById(v.peptideId);
            return (
              <div key={v.id} className="card-glass p-3 opacity-50 mb-1 stagger-item" style={{ animationDelay: `${0.05 + i * 0.04}s` }}>
                <p className="text-xs">{pep?.name || v.peptideId} · {v.amountMg}mg</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
