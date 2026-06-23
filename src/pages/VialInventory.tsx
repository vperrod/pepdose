import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Droplets, AlertTriangle, Trash2, X } from 'lucide-react';
import { getVials, saveVial, updateVial } from '../db/operations';
import { PEPTIDES, getPeptideById } from '../data/peptides';
import type { Vial } from '../db/schema';
import { format, differenceInDays, parseISO } from 'date-fns';

export function VialInventory() {
  const navigate = useNavigate();
  const [vials, setVials] = useState<Vial[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [peptideId, setPeptideId] = useState('');
  const [amountMg, setAmountMg] = useState('');
  const [bacWater, setBacWater] = useState('');
  const [dosesRemaining, setDosesRemaining] = useState('');
  const [storageLocation, setStorageLocation] = useState('');

  const load = useCallback(async () => {
    setVials(await getVials());
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
    });
    setPeptideId(''); setAmountMg(''); setBacWater(''); setDosesRemaining(''); setStorageLocation('');
    setShowForm(false);
    load();
  };

  const handleDiscard = async (id: string) => {
    await updateVial(id, { status: 'empty' });
    load();
  };

  const active = vials.filter(v => v.status === 'active');
  const empty = vials.filter(v => v.status === 'empty');

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
          <select value={peptideId} onChange={e => setPeptideId(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm">
            <option value="">Select peptide...</option>
            {PEPTIDES.filter(p => p.route !== 'oral' && p.route !== 'intranasal').map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Amount (mg)" value={amountMg} onChange={e => setAmountMg(e.target.value)} className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm" />
            <input type="number" placeholder="BAC water (ml)" value={bacWater} onChange={e => setBacWater(e.target.value)} className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Total doses" value={dosesRemaining} onChange={e => setDosesRemaining(e.target.value)} className="bg-bg border border-border rounded-xl px-3 py-2.5 text-sm" />
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
            const expiring = daysSinceRecon !== null && daysSinceRecon >= 21;
            const lowStock = v.dosesRemaining <= 3 && v.dosesRemaining > 0;

            return (
              <div key={v.id} className="card-glass p-4 stagger-item" style={{ animationDelay: `${0.05 + i * 0.04}s` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{pep?.name || v.peptideId}</p>
                    <p className="text-xs text-text-muted">{v.amountMg}mg · {v.bacWaterMl ? `${v.bacWaterMl}ml BAC` : 'unreconstituted'}</p>
                  </div>
                  <button onClick={() => handleDiscard(v.id)} className="p-1.5 text-text-muted hover:text-danger">
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

                {(expiring || lowStock) && (
                  <div className="mt-2 flex gap-2">
                    {lowStock && (
                      <span className="text-[10px] text-warning flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Low stock
                      </span>
                    )}
                    {expiring && daysSinceRecon !== null && (
                      <span className="text-[10px] text-danger flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Recon {daysSinceRecon}d ago
                      </span>
                    )}
                  </div>
                )}

                {v.reconstitutionDate && (
                  <p className="text-[10px] text-text-muted mt-1">
                    Reconstituted {format(parseISO(v.reconstitutionDate), 'MMM d')}
                    {v.storageLocation && ` · ${v.storageLocation}`}
                  </p>
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
