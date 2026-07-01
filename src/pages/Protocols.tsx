import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { differenceInWeeks, parseISO, format } from 'date-fns';
import { Plus, Beaker, Pencil, Trash2, Pause, Play, X, AlertTriangle, TrendingUp, CalendarDays, Settings2, CheckCircle2, Circle, MapPin, ArrowUpCircle, Sparkles } from 'lucide-react';
import {
  getProtocols, deleteProtocol, updateProtocol,
  getScheduledDosesForProtocol, deleteUpcomingDosesFrom, saveScheduledDoses,
  getDoseLogsForProtocol,
} from '../db/operations';
import { getPeptideById, type Peptide } from '../data/peptides';
import { getCurrentWeekGuide } from '../data/experienceTimelines';
import { generateSchedule, summarizePhases, phasesTotalWeeks } from '../utils/scheduleEngine';
import { DoseActionSheet } from '../components/DoseActionSheet';
import type { UserProtocol, ScheduledDose, DoseLog } from '../db/schema';

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

type SheetMode = 'journey' | 'actions' | 'edit' | 'delete';

export function Protocols() {
  const navigate = useNavigate();
  const location = useLocation();
  const [protocols, setProtocols] = useState<UserProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProto, setActiveProto] = useState<UserProtocol | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>('actions');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [journeyDoses, setJourneyDoses] = useState<ScheduledDose[]>([]);
  const [journeyLogs, setJourneyLogs] = useState<DoseLog[]>([]);
  const [selectedDose, setSelectedDose] = useState<(ScheduledDose & { peptideName: string; color: string }) | null>(null);
  const [selectedLog, setSelectedLog] = useState<DoseLog | undefined>(undefined);

  // Edit state
  const [editDoses, setEditDoses] = useState<UserProtocol['doses']>([]);
  const [editStartDate, setEditStartDate] = useState('');
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadProtocols();
  }, []);

  useEffect(() => {
    const openId = (location.state as { openId?: string } | null)?.openId;
    if (!openId || protocols.length === 0) return;
    const proto = protocols.find(p => p.id === openId);
    if (proto) openSheet(proto);
    navigate('.', { replace: true, state: null });
  }, [protocols, location.state]);

  async function loadProtocols() {
    const p = await getProtocols();
    setProtocols(p);
    setLoading(false);
  }

  async function loadJourney(protocolId: string) {
    setJourneyDoses([]);
    setJourneyLogs([]);
    const [doses, logs] = await Promise.all([
      getScheduledDosesForProtocol(protocolId),
      getDoseLogsForProtocol(protocolId),
    ]);
    setJourneyDoses(doses);
    setJourneyLogs(logs);
  }

  function openSheet(proto: UserProtocol) {
    setActiveProto(proto);
    setSheetMode('journey');
    loadJourney(proto.id);
    setEditDoses(proto.doses.map(d => {
      const pep = getPeptideById(d.peptideId);
      // Backfill a phased variant for older records that predate variants.
      const fallbackVariant = pep?.dosing.protocolVariants?.[0];
      const phases = d.schedulePhases ?? fallbackVariant?.phases;
      return {
        ...d,
        schedulePhases: phases,
        variantId: d.variantId ?? (phases ? fallbackVariant?.id : undefined),
        durationWeeks: phases ? phasesTotalWeeks(phases) : (d.durationWeeks ?? proto.durationWeeks),
        timesPerDay: d.timesPerDay ?? pep?.dosing.timesPerDay ?? 1,
        customFrequencyDays: d.customFrequencyDays ?? pep?.dosing.customFrequencyDays,
      };
    }));
    setEditStartDate(proto.startDate);
    setEditName(proto.name);
  }

  function closeSheet() {
    setActiveProto(null);
    setSheetMode('actions');
  }

  function openDoseEditor(dose: ScheduledDose, log?: DoseLog) {
    const pep = getPeptideById(dose.peptideId);
    const color = CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa';
    setSelectedDose({ ...dose, peptideName: pep?.name ?? dose.peptideId, color });
    setSelectedLog(log);
  }

  async function handleDoseUpdated() {
    if (activeProto) await loadJourney(activeProto.id);
    setSelectedDose(null);
    setSelectedLog(undefined);
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

    const protoDuration = Math.max(...editDoses.map(d => d.durationWeeks ?? activeProto.durationWeeks));

    // Regenerate the full schedule from the (possibly new) start date so titration
    // week-alignment is preserved, then keep only the upcoming portion.
    const fullDoses = editDoses.flatMap(d =>
      generateSchedule({
        peptideId: d.peptideId,
        dose: d.dose,
        unit: d.unit as 'mcg' | 'mg',
        frequency: d.frequency,
        customFrequencyDays: d.customFrequencyDays,
        timesPerDay: d.timesPerDay,
        timeOfDay: d.timeOfDay,
        startDate: editStartDate,
        durationWeeks: d.durationWeeks ?? activeProto.durationWeeks,
        schedulePhases: d.schedulePhases,
        protocolId: activeProto.id,
      })
    );

    // Preserve any dose that already happened (logged/skipped/missed) — never rewrite history.
    const existing = await getScheduledDosesForProtocol(activeProto.id);
    const preserved = new Set(
      existing.filter(d => d.status !== 'upcoming').map(d => `${d.peptideId}|${d.date}`)
    );

    const today = format(new Date(), 'yyyy-MM-dd');
    const regen = fullDoses.filter(d => d.date >= today && !preserved.has(`${d.peptideId}|${d.date}`));

    await deleteUpcomingDosesFrom(activeProto.id, today);
    await saveScheduledDoses(regen);

    await updateProtocol(activeProto.id, {
      name: editName,
      startDate: editStartDate,
      durationWeeks: protoDuration,
      doses: editDoses,
    });

    setSaving(false);
    closeSheet();
    await loadProtocols();
  }

  function updateEditDose(index: number, updates: Partial<UserProtocol['doses'][0]>) {
    setEditDoses(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d));
  }

  function applyVariantEdit(index: number, peptide: Peptide | undefined, variantId: string) {
    const variant = peptide?.dosing.protocolVariants?.find(v => v.id === variantId);
    if (!variant) return;
    updateEditDose(index, {
      variantId: variant.id,
      schedulePhases: variant.phases,
      durationWeeks: phasesTotalWeeks(variant.phases),
      dose: variant.doseOverride ?? peptide?.dosing.standard ?? 0,
    });
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
        <button onClick={() => navigate('/find')} className="tap-target flex items-center gap-1.5 text-xs font-medium text-secondary bg-card px-3 py-2 rounded-lg">
          <Sparkles className="w-4 h-4" /> Find
        </button>
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

              {sheetMode === 'journey' && (() => {
                const sorted = [...journeyDoses].sort((a, b) =>
                  (a.date + a.time).localeCompare(b.date + b.time));
                const logged = sorted.filter(d => d.status === 'logged').length;
                const nowWeek = Math.max(1, differenceInWeeks(new Date(), parseISO(activeProto.startDate)) + 1);
                const weeks = [...new Set(sorted.map(d => d.weekNumber))].sort((a, b) => a - b);
                const logByDose = new Map(
                  journeyLogs.filter(l => l.scheduledDoseId).map(l => [l.scheduledDoseId!, l]));
                const STATUS: Record<string, { color: string; label: string }> = {
                  logged: { color: '#22c55e', label: 'done' },
                  upcoming: { color: '#64748b', label: 'upcoming' },
                  missed: { color: '#ef4444', label: 'missed' },
                  skipped: { color: '#f59e0b', label: 'skipped' },
                };
                return (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-text-muted">
                        <span className="text-success font-semibold">{logged}</span> of {sorted.length} doses logged
                        {' · '}Week {Math.min(nowWeek, activeProto.durationWeeks)}/{activeProto.durationWeeks}
                      </div>
                      <button
                        onClick={() => setSheetMode('actions')}
                        className="tap-target flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-card px-3 py-2 rounded-lg"
                      >
                        <Settings2 className="w-4 h-4" /> Manage
                      </button>
                    </div>

                    {sorted.length === 0 ? (
                      <p className="text-sm text-text-muted text-center py-8">
                        No doses scheduled yet.
                      </p>
                    ) : weeks.map(week => (
                      <div key={week}>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Week {week}</p>
                          {week === nowWeek && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-dim text-primary">now</span>
                          )}
                        </div>
                        {(() => {
                          const weekPeptideIds = [...new Set(sorted.filter(d => d.weekNumber === week).map(d => d.peptideId))];
                          const guides = weekPeptideIds
                            .map(pid => ({ pid, guide: getCurrentWeekGuide(pid, week) }))
                            .filter(g => g.guide);
                          if (guides.length === 0) return null;
                          return (
                            <div className="space-y-2 mb-2">
                              {guides.map(({ pid, guide }) => (
                                <div key={pid} className="rounded-xl bg-card border border-border px-3 py-2.5">
                                  <p className="text-xs font-semibold text-secondary mb-1">
                                    {getPeptideById(pid)?.name}: {guide!.title}
                                  </p>
                                  <p className="text-[11px] text-text-muted leading-relaxed">{guide!.description}</p>
                                  {guide!.tips.length > 0 && (
                                    <ul className="mt-1.5 space-y-0.5">
                                      {guide!.tips.map((tip, i) => (
                                        <li key={i} className="text-[11px] text-text-secondary flex gap-1.5">
                                          <span className="text-secondary">•</span>{tip}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        <div className="space-y-1.5">
                          {sorted.filter(d => d.weekNumber === week).map(d => {
                            const pep = getPeptideById(d.peptideId);
                            const st = STATUS[d.status] ?? STATUS.upcoming;
                            const log = logByDose.get(d.id);
                            const shownDose = d.status === 'logged' ? (log?.dose ?? d.dose) : d.dose;
                            const shownSite = d.status === 'logged' ? log?.injectionSite : d.suggestedSite;
                            return (
                              <button
                                key={d.id}
                                onClick={() => openDoseEditor(d, log)}
                                className="w-full text-left flex items-center gap-3 card-glass px-3 py-2.5 tap-target"
                              >
                                {d.status === 'logged'
                                  ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: st.color }} />
                                  : <Circle className="w-4 h-4 shrink-0" style={{ color: st.color }} />}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium truncate">{pep?.name ?? d.peptideId}</span>
                                    {d.isTitrationStepUp && (
                                      <ArrowUpCircle className="w-3.5 h-3.5 text-secondary shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-text-muted font-mono">
                                    {format(parseISO(d.date), 'EEE MMM d')} · {shownDose} {d.unit}
                                    {shownSite && (
                                      <span className="inline-flex items-center gap-0.5 ml-1.5">
                                        <MapPin className="w-3 h-3" />{shownSite}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <span
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0"
                                  style={{ color: st.color, backgroundColor: st.color + '1a' }}
                                >
                                  {st.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

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

                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={e => setEditStartDate(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Moving this reshuffles upcoming doses. Logged doses stay put.
                    </p>
                  </div>

                  {editDoses.map((dose, idx) => {
                    const pep = getPeptideById(dose.peptideId);
                    const color = CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa';
                    const hasTitration = !!pep?.dosing.titration && pep.dosing.titration.length > 0;
                    const variants = pep?.dosing.protocolVariants;
                    const isPhased = !!variants?.length;
                    const activeVariant = variants?.find(v => v.id === dose.variantId);
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

                        {hasTitration && (
                          <div className="flex items-center gap-2 text-xs text-secondary bg-secondary-dim rounded-lg px-3 py-2 mb-3">
                            <TrendingUp className="w-4 h-4 shrink-0" />
                            Auto-titration — dose steps up automatically. Length still applies.
                          </div>
                        )}

                        {isPhased && (
                          <div className="mb-3">
                            <label className="text-xs text-text-muted block mb-1">Protocol</label>
                            <select
                              value={dose.variantId ?? variants![0].id}
                              onChange={e => applyVariantEdit(idx, pep, e.target.value)}
                              className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm"
                            >
                              {variants!.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                            {activeVariant && (
                              <div className="mt-2 text-[11px] text-text-muted space-y-1">
                                <p className="text-secondary font-medium">{summarizePhases(activeVariant.phases)}</p>
                                <p>{activeVariant.description}</p>
                                {activeVariant.source && (
                                  <a href={activeVariant.source} target="_blank" rel="noreferrer" className="text-primary underline">
                                    source
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}

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
                          {!isPhased && (
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
                          )}
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
                          {!isPhased && (
                            <div>
                              <label className="text-xs text-text-muted block mb-1">Length (weeks)</label>
                              <input
                                type="number"
                                min={1}
                                max={52}
                                value={dose.durationWeeks ?? 1}
                                onChange={e => updateEditDose(idx, { durationWeeks: parseInt(e.target.value) || 1 })}
                                className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          )}
                          {dose.frequency === 'daily' && !isPhased && (
                            <div>
                              <label className="text-xs text-text-muted block mb-1">Times/day</label>
                              <select
                                value={dose.timesPerDay ?? 1}
                                onChange={e => updateEditDose(idx, { timesPerDay: parseInt(e.target.value) })}
                                className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm"
                              >
                                <option value={1}>1x</option>
                                <option value={2}>2x</option>
                                <option value={3}>3x</option>
                              </select>
                            </div>
                          )}
                          {dose.frequency === 'custom' && !isPhased && (
                            <div>
                              <label className="text-xs text-text-muted block mb-1">Every N days</label>
                              <input
                                type="number"
                                min={1}
                                value={dose.customFrequencyDays ?? 3}
                                onChange={e => updateEditDose(idx, { customFrequencyDays: parseInt(e.target.value) || 1 })}
                                className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <p className="text-xs text-text-muted">
                    Saving rebuilds all upcoming injections from these settings. Already-logged
                    doses are kept.
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

      {selectedDose && (
        <DoseActionSheet
          dose={selectedDose}
          log={selectedLog}
          onClose={() => { setSelectedDose(null); setSelectedLog(undefined); }}
          onUpdated={handleDoseUpdated}
        />
      )}
    </div>
  );
}
