import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInWeeks, parseISO, format } from 'date-fns';
import { Plus, Beaker, Pencil, Trash2, Pause, Play, X, AlertTriangle } from 'lucide-react';
import { getProtocols, deleteProtocol, updateProtocol, updateFutureScheduledDoses } from '../db/operations';
import { getPeptideById } from '../data/peptides';
import type { UserProtocol } from '../db/schema';

const CATEGORY_COLORS: Record<string, string> = {
  healing: '#22c55e',
  glp1: '#6366f1',
  gh_secretagogue: '#f59e0b',
  fat_loss: '#ef4444',
  cosmetic: '#ec4899',
  sexual_health: '#a855f7',
  nootropic: '#06b6d4',
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Every day',
  eod: 'Every other day',
  weekly: 'Once per week',
  biweekly: 'Every 2 weeks',
  custom: 'Custom interval',
};

const TIME_LABELS: Record<string, string> = {
  morning_fasting: 'Morning (fasting)',
  morning: 'Morning',
  evening: 'Evening',
  pre_bed: 'Before bed',
  before_activity: 'Before activity',
  any: 'Any time',
};

type SheetMode = 'actions' | 'edit' | 'delete';

export function Protocols() {
  const navigate = useNavigate();
  const [protocols, setProtocols] = useState<UserProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProto, setActiveProto] = useState<UserProtocol | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>('actions');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editDoses, setEditDoses] = useState<UserProtocol['doses']>([]);
  const [editDuration, setEditDuration] = useState(4);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadProtocols();
  }, []);

  async function loadProtocols() {
    const p = await getProtocols();
    setProtocols(p);
    setLoading(false);
  }

  function openSheet(proto: UserProtocol) {
    setActiveProto(proto);
    setSheetMode('actions');
    setEditDoses(proto.doses.map(d => ({ ...d })));
    setEditDuration(proto.durationWeeks);
    setEditName(proto.name);
  }

  function closeSheet() {
    setActiveProto(null);
    setSheetMode('actions');
  }

  async function handleDelete() {
    if (!activeProto) return;
    setDeleting(true);
    await deleteProtocol(activeProto.id);
    setDeleting(false);
    closeSheet();
    await loadProtocols();
  }

  async function handleTogglePause() {
    if (!activeProto) return;
    const newStatus = activeProto.status === 'paused' ? 'active' : 'paused';
    await updateProtocol(activeProto.id, { status: newStatus });
    closeSheet();
    await loadProtocols();
  }

  async function handleSaveEdit() {
    if (!activeProto) return;
    setSaving(true);

    await updateProtocol(activeProto.id, {
      name: editName,
      durationWeeks: editDuration,
      doses: editDoses,
    });

    const today = format(new Date(), 'yyyy-MM-dd');
    for (const dose of editDoses) {
      const original = activeProto.doses.find(d => d.peptideId === dose.peptideId);
      if (original && (original.dose !== dose.dose || original.unit !== dose.unit)) {
        await updateFutureScheduledDoses(
          activeProto.id,
          today,
          { dose: dose.dose, unit: dose.unit as 'mcg' | 'mg' },
          'dose',
          `${original.dose} ${original.unit}`,
          `${dose.dose} ${dose.unit}`,
        );
      }
    }

    setSaving(false);
    closeSheet();
    await loadProtocols();
  }

  function updateEditDose(index: number, updates: Partial<UserProtocol['doses'][0]>) {
    setEditDoses(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d));
  }

  if (loading) {
    return (
      <div className="safe-top px-5 pt-4">
        <div className="skeleton h-8 w-40 mb-6" />
        <div className="skeleton h-24 w-full mb-3" />
        <div className="skeleton h-24 w-full mb-3" />
      </div>
    );
  }

  return (
    <div className="safe-top px-5 pt-4 pb-28">
      <div className="flex items-center justify-between mb-5 stagger-item">
        <h1 className="text-xl font-bold">Protocols</h1>
        <button onClick={() => navigate('/protocols/new')} className="tap-target flex items-center gap-2 bg-primary text-bg font-semibold text-sm px-4 py-2.5 rounded-xl">
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {protocols.length === 0 ? (
        <div className="card-glass p-8 text-center stagger-item" style={{ animationDelay: '0.05s' }}>
          <div className="w-14 h-14 rounded-2xl bg-primary-dim flex items-center justify-center mx-auto mb-4">
            <Beaker className="w-7 h-7 text-primary" />
          </div>
          <p className="font-semibold mb-1">No protocols yet</p>
          <p className="text-sm text-text-muted">
            Start your first peptide cycle — pick a peptide and set a start date.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {protocols.map((proto, i) => {
            const mainPepId = proto.peptideIds[0];
            const pep = mainPepId ? getPeptideById(mainPepId) : undefined;
            const color = CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa';
            const currentWeek = Math.max(1, differenceInWeeks(new Date(), parseISO(proto.startDate)) + 1);
            const progress = (Math.min(currentWeek, proto.durationWeeks) / proto.durationWeeks) * 100;
            const mainDose = proto.doses[0];

            return (
              <button
                key={proto.id}
                onClick={() => openSheet(proto)}
                className="card-glass w-full p-4 tap-target text-left stagger-item"
                style={{ animationDelay: `${0.05 + i * 0.05}s` }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: color + '22' }}
                  >
                    <Beaker className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{proto.name || pep?.name || mainPepId}</p>
                    {mainDose && (
                      <p className="text-xs text-text-muted font-mono">
                        {mainDose.dose} {mainDose.unit} · {mainDose.frequency}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                    proto.status === 'active' ? 'bg-success/15 text-success' :
                    proto.status === 'paused' ? 'bg-warning-dim text-warning' :
                    'bg-border text-text-muted'
                  }`}>
                    {proto.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">
                    W{Math.min(currentWeek, proto.durationWeeks)}/{proto.durationWeeks}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeProto && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={closeSheet} />
          <div className="fixed bottom-0 left-0 right-0 z-[70] animate-slide-up">
            <div className="bg-bg-raised rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <p className="font-semibold text-sm">{activeProto.name}</p>
                <button onClick={closeSheet} className="tap-target p-2 rounded-xl hover:bg-card" aria-label="Close">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              {sheetMode === 'actions' && (
                <div className="p-4 space-y-2">
                  <button
                    onClick={() => setSheetMode('edit')}
                    className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                  >
                    <Pencil className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">Edit Protocol</p>
                      <p className="text-xs text-text-muted">Change doses, duration, or name</p>
                    </div>
                  </button>

                  {activeProto.status !== 'completed' && (
                    <button
                      onClick={handleTogglePause}
                      className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                    >
                      {activeProto.status === 'paused' ? (
                        <>
                          <Play className="w-5 h-5 text-success" />
                          <div>
                            <p className="font-medium text-sm">Resume Protocol</p>
                            <p className="text-xs text-text-muted">Continue where you left off</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Pause className="w-5 h-5 text-warning" />
                          <div>
                            <p className="font-medium text-sm">Pause Protocol</p>
                            <p className="text-xs text-text-muted">Temporarily stop without deleting</p>
                          </div>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => setSheetMode('delete')}
                    className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                  >
                    <Trash2 className="w-5 h-5 text-danger" />
                    <div>
                      <p className="font-medium text-sm text-danger">Delete Protocol</p>
                      <p className="text-xs text-text-muted">Remove protocol and all scheduled doses</p>
                    </div>
                  </button>
                </div>
              )}

              {sheetMode === 'edit' && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wider block mb-1.5">
                      Protocol Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>

                  {editDoses.map((dose, idx) => {
                    const pep = getPeptideById(dose.peptideId);
                    const color = CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa';
                    return (
                      <div key={dose.peptideId} className="card-glass p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: color + '22' }}
                          >
                            <Beaker className="w-3.5 h-3.5" style={{ color }} />
                          </div>
                          <span className="font-semibold text-sm">{pep?.name ?? dose.peptideId}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-text-muted block mb-1">Dose</label>
                            <div className="flex">
                              <input
                                type="number"
                                step="any"
                                value={parseFloat(dose.dose.toPrecision(10))}
                                onChange={e => updateEditDose(idx, { dose: parseFloat(e.target.value) || 0 })}
                                className="flex-1 bg-bg-raised border border-border rounded-l-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                              />
                              <select
                                value={dose.unit}
                                onChange={e => updateEditDose(idx, { unit: e.target.value as 'mcg' | 'mg' })}
                                className="bg-bg-raised border border-l-0 border-border rounded-r-lg px-2 py-2 text-xs text-text-secondary"
                              >
                                <option value="mcg">mcg</option>
                                <option value="mg">mg</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-text-muted block mb-1">Frequency</label>
                            <select
                              value={dose.frequency}
                              onChange={e => updateEditDose(idx, { frequency: e.target.value })}
                              className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm"
                            >
                              {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-text-muted block mb-1">Time</label>
                            <select
                              value={dose.timeOfDay}
                              onChange={e => updateEditDose(idx, { timeOfDay: e.target.value })}
                              className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm"
                            >
                              {Object.entries(TIME_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wider block mb-1.5">
                      Duration (weeks)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={editDuration}
                      onChange={e => setEditDuration(parseInt(e.target.value) || 1)}
                      className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>

                  <p className="text-xs text-text-muted">
                    Dose changes apply to all future scheduled injections.
                  </p>

                  <div className="flex gap-3 pt-2 pb-4">
                    <button
                      onClick={() => setSheetMode('actions')}
                      className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-medium text-text-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex-1 px-4 py-3 rounded-xl bg-primary text-bg text-sm font-semibold disabled:opacity-40"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {sheetMode === 'delete' && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/20">
                    <AlertTriangle className="w-6 h-6 text-danger shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-danger">Delete "{activeProto.name}"?</p>
                      <p className="text-xs text-text-muted mt-1">
                        This removes the protocol and all its scheduled doses. Logged dose history is kept.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 pb-4">
                    <button
                      onClick={() => setSheetMode('actions')}
                      className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-medium text-text-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-3 rounded-xl bg-danger text-white text-sm font-semibold disabled:opacity-40"
                    >
                      {deleting ? 'Deleting...' : 'Delete Protocol'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
