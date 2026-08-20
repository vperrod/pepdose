import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { differenceInWeeks, parseISO, format } from 'date-fns';
import { Plus, Beaker, Pencil, Trash2, Pause, Play, X, AlertTriangle, TrendingUp, CalendarDays, Settings2, CheckCircle2, Circle, MapPin, ArrowUpCircle, Sparkles } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  getProtocols, deleteProtocol, updateProtocol,
  getScheduledDosesForProtocol, deleteUpcomingDosesFrom, saveScheduledDoses,
  getDoseLogsForProtocol, getProtocol, getHealthMarkers, getDoseLogsForPeptide,
} from '../db/operations';
import { getPeptideById, type Peptide } from '../data/peptides';
import { getCurrentWeekGuide } from '../data/experienceTimelines';
import { generateSchedule, summarizePhases, phasesTotalWeeks } from '../utils/scheduleEngine';
import { DoseActionSheet } from '../components/DoseActionSheet';
import { AdhocLogSheet } from '../components/AdhocLogSheet';
import { DecimalInput } from '../components/DecimalInput';
import { ReconMixFields } from '../components/ReconMixFields';
import { PenColorField } from '../components/PenColorField';
import { WeekdayPicker } from '../components/WeekdayPicker';
import { defaultRecon } from '../utils/penClicks';
import { findDuplicateProtocols, type DuplicateGroup } from '../utils/duplicateProtocols';
import type { UserProtocol, ScheduledDose, DoseLog, HealthMarker } from '../db/schema';
import { UserBadge } from '../components/UserBadge';
import { useOwnerFilter } from '../context/ViewFilterContext';

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
  weekly_days: 'Specific days of week',
  custom: 'Custom interval',
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function frequencyLabel(d: { frequency: string; daysOfWeek?: number[] }): string {
  if (d.frequency === 'weekly_days' && d.daysOfWeek?.length) {
    return d.daysOfWeek.map(day => WEEKDAY_SHORT[day]).join('/');
  }
  return FREQUENCY_LABELS[d.frequency] ?? d.frequency;
}

const TIME_LABELS: Record<string, string> = {
  morning_fasting: 'Morning (fasting)',
  morning: 'Morning',
  evening: 'Evening',
  pre_bed: 'Before bed',
  before_activity: 'Before activity',
  any: 'Any time',
};

type SheetMode = 'journey' | 'actions' | 'edit' | 'delete';

// Sentinel for the "Protocol" variant dropdown: lets a peptide with canned
// phased variants (NAD+, MOTS-c, ...) drop into the flat frequency + weekday
// picker instead, since those variants otherwise hide it entirely.
const CUSTOM_SCHEDULE = '__custom__';

export function Protocols() {
  const navigate = useNavigate();
  const location = useLocation();
  const [protocols, setProtocols] = useState<UserProtocol[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [removingDup, setRemovingDup] = useState<string | null>(null);
  const [dupError, setDupError] = useState<string | null>(null);
  const [confirmDupId, setConfirmDupId] = useState<string | null>(null);
  const applyOwnerFilter = useOwnerFilter();
  const [loading, setLoading] = useState(true);
  const [activeProto, setActiveProto] = useState<UserProtocol | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>('actions');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journeyDoses, setJourneyDoses] = useState<ScheduledDose[]>([]);
  const [journeyLogs, setJourneyLogs] = useState<DoseLog[]>([]);
  const [journeyAdhoc, setJourneyAdhoc] = useState<DoseLog[]>([]);
  const [journeyMarkers, setJourneyMarkers] = useState<HealthMarker[]>([]);
  // null = default (only the current week expanded); user taps override per week
  const [openWeeks, setOpenWeeks] = useState<Set<number> | null>(null);
  const [metric, setMetric] = useState<'weight' | 'sleepQuality' | 'energy' | 'mood'>('weight');
  const [selectedDose, setSelectedDose] = useState<(ScheduledDose & { peptideName: string; color: string }) | null>(null);
  const [selectedLog, setSelectedLog] = useState<DoseLog | undefined>(undefined);
  const [viewAdhocLog, setViewAdhocLog] = useState<DoseLog | null>(null);

  // Edit state
  const [editDoses, setEditDoses] = useState<UserProtocol['doses']>([]);
  const [editStartDate, setEditStartDate] = useState('');
  const [editName, setEditName] = useState('');
  const [editTitrationAlerts, setEditTitrationAlerts] = useState(false);

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
    // Indexed per-protocol lookup, not a full doseLogs table scan — findDuplicateProtocols
    // only ever reads lastLogged[protocolId] for protocols in `p`, so logs for anything
    // else (deleted protocols, ad-hoc entries) are irrelevant.
    const logs = (await Promise.all(p.map(proto => getDoseLogsForProtocol(proto.id)))).flat();
    setProtocols(p);
    setDuplicates(findDuplicateProtocols(p, logs));
    setLoading(false);
  }

  async function removeDuplicate(id: string) {
    setRemovingDup(id);
    setDupError(null);
    try {
      await deleteProtocol(id);
      await loadProtocols();
    } catch (e) {
      setDupError(e instanceof Error ? e.message : 'Could not delete — please try again.');
    } finally {
      setRemovingDup(null);
    }
  }

  async function loadJourney(protocolId: string) {
    setJourneyDoses([]);
    setJourneyLogs([]);
    setJourneyAdhoc([]);
    setJourneyMarkers([]);
    const [doses, logs, proto] = await Promise.all([
      getScheduledDosesForProtocol(protocolId),
      getDoseLogsForProtocol(protocolId),
      getProtocol(protocolId),
    ]);
    setJourneyDoses(doses);
    setJourneyLogs(logs);
    if (proto) {
      // Ad-hoc doses of this protocol's peptides count as "doses done" too —
      // they carry no protocolId, so the by-protocol index can't see them.
      // Look them up by-peptide (indexed) instead of scanning the whole store.
      const byPeptide = await Promise.all(proto.peptideIds.map(pid => getDoseLogsForPeptide(pid)));
      setJourneyAdhoc(byPeptide.flat().filter(l =>
        !l.scheduledDoseId && !l.protocolId &&
        l.owner === proto.owner &&
        l.date >= proto.startDate,
      ));
      const markers = await getHealthMarkers(proto.startDate, format(new Date(), 'yyyy-MM-dd'));
      setJourneyMarkers(markers.filter(m => m.owner === proto.owner));
    }
  }

  function openSheet(proto: UserProtocol) {
    setActiveProto(proto);
    setSheetMode('journey');
    setOpenWeeks(null);
    setError(null);
    loadJourney(proto.id);
    setEditDoses(proto.doses.map(d => {
      const pep = getPeptideById(d.peptideId);
      // Backfill a phased variant for older records that predate variants existing
      // for this peptide — but never for a dose where the user deliberately chose
      // CUSTOM_SCHEDULE (customSchedule: true), or that backfill would silently
      // revert their custom weekday schedule back to the canned variant every time
      // they reopen the edit sheet.
      const fallbackVariant = d.customSchedule ? undefined : pep?.dosing.protocolVariants?.[0];
      const phases = d.schedulePhases ?? fallbackVariant?.phases;
      return {
        ...d,
        schedulePhases: phases,
        variantId: d.variantId ?? (phases ? fallbackVariant?.id : undefined),
        durationWeeks: phases ? phasesTotalWeeks(phases) : (d.durationWeeks ?? proto.durationWeeks),
        recon: d.recon ?? defaultRecon(pep),
        timesPerDay: d.timesPerDay ?? pep?.dosing.timesPerDay ?? 1,
        customFrequencyDays: d.customFrequencyDays ?? pep?.dosing.customFrequencyDays,
      };
    }));
    setEditStartDate(proto.startDate);
    setEditName(proto.name);
    setEditTitrationAlerts(proto.titrationAlerts === true);
  }

  function closeSheet() {
    setActiveProto(null);
    setSheetMode('actions');
    setError(null);
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
    setError(null);
    try {
      await deleteProtocol(activeProto.id);
      closeSheet();
      await loadProtocols();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete — please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleTogglePause() {
    if (!activeProto) return;
    const newStatus = activeProto.status === 'paused' ? 'active' : 'paused';
    setError(null);
    try {
      await updateProtocol(activeProto.id, { status: newStatus });
      closeSheet();
      await loadProtocols();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update protocol — please try again.');
    }
  }

  async function handleFinish() {
    if (!activeProto) return;
    setError(null);
    try {
      await updateProtocol(activeProto.id, { status: 'completed' });
      closeSheet();
      await loadProtocols();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update protocol — please try again.');
    }
  }

  async function handleSaveEdit() {
    if (!activeProto) return;
    setSaving(true);
    setError(null);

    try {
      const protoDuration = Math.max(...editDoses.map(d => d.durationWeeks ?? activeProto.durationWeeks));

      // Regenerate the full schedule from the (possibly new) start date so titration
      // week-alignment is preserved, then keep only the upcoming portion.
      const fullDoses = editDoses.flatMap(d =>
        generateSchedule({
          peptideId: d.peptideId,
          dose: d.dose,
          unit: d.unit as 'mcg' | 'mg' | 'IU',
          frequency: d.frequency,
          customFrequencyDays: d.customFrequencyDays,
          daysOfWeek: d.daysOfWeek,
          timesPerDay: d.timesPerDay,
          timeOfDay: d.timeOfDay,
          startDate: editStartDate,
          durationWeeks: d.durationWeeks ?? activeProto.durationWeeks,
          schedulePhases: d.schedulePhases,
          protocolBreaks: activeProto.breaks,
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
      await saveScheduledDoses(regen, activeProto.owner);

      await updateProtocol(activeProto.id, {
        name: editName,
        startDate: editStartDate,
        durationWeeks: protoDuration,
        doses: editDoses,
        titrationAlerts: editTitrationAlerts,
      });

      closeSheet();
      await loadProtocols();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes — please try again.');
    } finally {
      setSaving(false);
    }
  }

  function updateEditDose(index: number, updates: Partial<UserProtocol['doses'][0]>) {
    setEditDoses(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d));
  }

  function applyVariantEdit(index: number, peptide: Peptide | undefined, variantId: string) {
    if (variantId === CUSTOM_SCHEDULE) {
      updateEditDose(index, {
        variantId: undefined,
        schedulePhases: undefined,
        durationWeeks: undefined,
        frequency: 'weekly_days',
        daysOfWeek: [],
        customSchedule: true,
      });
      return;
    }
    const variant = peptide?.dosing.protocolVariants?.find(v => v.id === variantId);
    if (!variant) return;
    updateEditDose(index, {
      variantId: variant.id,
      schedulePhases: variant.phases,
      durationWeeks: phasesTotalWeeks(variant.phases),
      dose: variant.doseOverride ?? peptide?.dosing.standard ?? 0,
      customSchedule: false,
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

      {dupError && (
        <div role="alert" className="card-glass p-3 mb-3 border border-danger/40 text-sm text-danger stagger-item">
          {dupError}
        </div>
      )}

      {duplicates
        .map(g => ({ ...g, protocols: applyOwnerFilter(g.protocols) }))
        .filter(g => g.protocols.length > 1)
        .map(group => {
          const pepName = getPeptideById(group.peptideId)?.name ?? group.peptideId;
          return (
            <div key={`${group.owner}-${group.peptideId}`} className="card-glass p-4 mb-3 border border-warning/40 stagger-item">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                <p className="font-semibold text-sm">
                  {group.protocols.length} protocols schedule {pepName}
                </p>
              </div>
              <p className="text-xs text-text-muted mb-3">
                Each one adds its own injection to every dose day — that's why {pepName} appears
                more than once on a date. Keep the one you inject from and delete the rest.
              </p>
              <div className="space-y-2">
                {group.protocols.map(proto => {
                  const lastLogged = group.lastLoggedByProtocol[proto.id];
                  const isKeeper = proto.id === group.keepId;
                  const doseLabel = proto.doses
                    .filter(d => d.peptideId === group.peptideId)
                    .map(d => `${d.dose} ${d.unit}`)
                    .join(' + ');
                  return (
                    <div key={proto.id} className="flex items-center gap-3 bg-bg-raised rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{proto.name}</p>
                        <p className="text-[11px] text-text-muted font-mono">
                          {doseLabel} · started {format(parseISO(proto.startDate), 'MMM d')}
                          {' · '}
                          {lastLogged
                            ? `last logged ${format(parseISO(lastLogged), 'MMM d')}`
                            : 'never logged'}
                        </p>
                      </div>
                      {isKeeper ? (
                        <span className="text-[10px] font-medium px-2 py-1 rounded-md bg-success/15 text-success shrink-0">
                          Keep
                        </span>
                      ) : confirmDupId === proto.id ? (
                        <button
                          onClick={() => removeDuplicate(proto.id)}
                          disabled={removingDup === proto.id}
                          className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-danger text-white shrink-0 tap-target disabled:opacity-50"
                        >
                          {removingDup === proto.id ? 'Deleting…' : 'Confirm delete'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDupId(proto.id)}
                          className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-danger/40 text-danger shrink-0 tap-target"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-text-muted mt-2">
                Deleting a protocol removes its scheduled injections. Doses you already logged stay in your history.
              </p>
            </div>
          );
        })}

      {applyOwnerFilter(protocols).length === 0 ? (
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
          {applyOwnerFilter(protocols).map((proto, i) => {
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{proto.name || pep?.name || mainPepId}</p>
                      <UserBadge owner={proto.owner} />
                    </div>
                    {mainDose && (
                      <p className="text-xs text-text-muted font-mono">
                        {mainDose.dose} {mainDose.unit} · {frequencyLabel(mainDose)}
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

              {error && (
                <div role="alert" className="mx-4 mt-3 card-glass p-3 border border-danger/40 text-sm text-danger">
                  {error}
                </div>
              )}

              {sheetMode === 'journey' && (() => {
                const today = format(new Date(), 'yyyy-MM-dd');
                const sorted = [...journeyDoses].sort((a, b) =>
                  (a.date + a.time).localeCompare(b.date + b.time));
                const nowWeek = Math.max(1, differenceInWeeks(new Date(), parseISO(activeProto.startDate)) + 1);
                const nowWeekClamped = Math.min(nowWeek, activeProto.durationWeeks);
                const weeks = [...new Set(sorted.map(d => d.weekNumber))].sort((a, b) => a - b);
                const logByDose = new Map(
                  journeyLogs.filter(l => l.scheduledDoseId).map(l => [l.scheduledDoseId!, l]));
                // A past dose that was never logged is missed, not "upcoming" —
                // display-only; the stored status stays untouched.
                const displayStatus = (d: ScheduledDose) =>
                  d.status === 'upcoming' && d.date < today ? 'missed' : d.status;
                const STATUS: Record<string, { color: string; label: string }> = {
                  logged: { color: '#22c55e', label: 'done' },
                  upcoming: { color: '#64748b', label: 'upcoming' },
                  missed: { color: '#ef4444', label: 'missed' },
                  skipped: { color: '#f59e0b', label: 'skipped' },
                };
                const due = sorted.filter(d => d.date <= today);
                const doneCount = due.filter(d => d.status === 'logged').length;
                const missedCount = due.filter(d => displayStatus(d) === 'missed').length;
                const skippedCount = due.filter(d => d.status === 'skipped').length;
                const adhocByWeek = new Map<number, DoseLog[]>();
                for (const l of journeyAdhoc) {
                  const wk = Math.min(
                    activeProto.durationWeeks,
                    Math.max(1, differenceInWeeks(parseISO(l.date), parseISO(activeProto.startDate)) + 1),
                  );
                  adhocByWeek.set(wk, [...(adhocByWeek.get(wk) ?? []), l]);
                }
                const singlePeptide = activeProto.peptideIds.length === 1;
                const isOpen = (week: number) => (openWeeks ?? new Set([nowWeekClamped])).has(week);
                const toggleWeek = (week: number) => {
                  const next = new Set(openWeeks ?? [nowWeekClamped]);
                  if (next.has(week)) next.delete(week); else next.add(week);
                  setOpenWeeks(next);
                };
                return (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-text-muted">
                        <span className="text-success font-semibold">{doneCount}</span> of {due.length} due doses done
                        {missedCount > 0 && <span style={{ color: STATUS.missed.color }}> · {missedCount} missed</span>}
                        {skippedCount > 0 && <span style={{ color: STATUS.skipped.color }}> · {skippedCount} skipped</span>}
                        {journeyAdhoc.length > 0 && <span> · {journeyAdhoc.length} ad-hoc</span>}
                        {' · '}Week {nowWeekClamped}/{activeProto.durationWeeks}
                      </div>
                      <button
                        onClick={() => setSheetMode('actions')}
                        className="tap-target flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-card px-3 py-2 rounded-lg"
                      >
                        <Settings2 className="w-4 h-4" /> Manage
                      </button>
                    </div>

                    {(() => {
                      // No health markers in the whole window → skip the card
                      // entirely; the dose list is what this sheet is for.
                      if (journeyMarkers.length === 0) return null;
                      const METRICS: { key: typeof metric; label: string; color: string }[] = [
                        { key: 'weight', label: 'Weight', color: '#00d4aa' },
                        { key: 'sleepQuality', label: 'Sleep', color: '#6366f1' },
                        { key: 'energy', label: 'Energy', color: '#f59e0b' },
                        { key: 'mood', label: 'Mood', color: '#ec4899' },
                      ];
                      const active = METRICS.find(m => m.key === metric)!;
                      const data = journeyMarkers
                        .filter(m => m[metric] != null)
                        .map(m => ({ date: format(parseISO(m.date), 'MMM d'), value: m[metric] as number }));
                      return (
                        <div className="card-glass p-3">
                          <div className="flex gap-1.5 mb-2 flex-wrap">
                            {METRICS.map(m => (
                              <button key={m.key} onClick={() => setMetric(m.key)}
                                className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                                  metric === m.key ? 'bg-primary text-bg' : 'bg-card text-text-secondary border border-border'
                                }`}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                          {data.length === 0 ? (
                            <p className="text-xs text-text-muted text-center py-6">No {active.label.toLowerCase()} logged in this range.</p>
                          ) : (
                            <ResponsiveContainer width="100%" height={160}>
                              <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a42" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={28} domain={['auto', 'auto']} />
                                <Tooltip contentStyle={{ background: '#0f1729', border: '1px solid #1e2a42', borderRadius: 8, fontSize: 12 }} />
                                <Line type="monotone" dataKey="value" stroke={active.color} strokeWidth={2} dot={{ r: 2 }} name={active.label} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      );
                    })()}

                    {sorted.length === 0 ? (
                      <p className="text-sm text-text-muted text-center py-8">
                        No doses scheduled yet.
                      </p>
                    ) : weeks.map(week => {
                      const weekDoses = sorted.filter(d => d.weekNumber === week);
                      const weekAdhoc = adhocByWeek.get(week) ?? [];
                      const counts: Record<string, number> = {};
                      for (const d of weekDoses) counts[displayStatus(d)] = (counts[displayStatus(d)] ?? 0) + 1;
                      const open = isOpen(week);
                      return (
                      <div key={week}>
                        <button
                          onClick={() => toggleWeek(week)}
                          className="w-full flex items-center gap-2 mb-2 tap-target text-left"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Week {week}</p>
                          {week === nowWeekClamped && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-dim text-primary">now</span>
                          )}
                          <span className="flex-1 text-right text-[11px] font-mono">
                            {(['logged', 'missed', 'skipped', 'upcoming'] as const)
                              .filter(s => counts[s])
                              .map(s => (
                                <span key={s} className="ml-2" style={{ color: STATUS[s].color }}>
                                  {counts[s]} {STATUS[s].label}
                                </span>
                              ))}
                            {weekAdhoc.length > 0 && <span className="ml-2 text-secondary">{weekAdhoc.length} ad-hoc</span>}
                          </span>
                          <span className="text-text-muted text-xs">{open ? '▾' : '▸'}</span>
                        </button>
                        {open && (() => {
                          const weekPeptideIds = [...new Set(weekDoses.map(d => d.peptideId))];
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
                        {open && (
                        <div className="space-y-1.5">
                          {weekDoses.map(d => {
                            const pep = getPeptideById(d.peptideId);
                            const st = STATUS[displayStatus(d)] ?? STATUS.upcoming;
                            const log = logByDose.get(d.id);
                            const shownDose = d.status === 'logged' ? (log?.dose ?? d.dose) : d.dose;
                            const shownSite = d.status === 'logged' ? log?.injectionSite : d.suggestedSite;
                            const shownTime = d.status === 'logged' ? (log?.time ?? d.time) : d.time;
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
                                    <span className="text-sm font-medium truncate">
                                      {format(parseISO(d.date), 'EEE MMM d')}
                                      <span className="text-text-muted font-normal"> · {shownDose} {d.unit}</span>
                                      {!singlePeptide && <span className="text-text-muted font-normal"> · {pep?.name ?? d.peptideId}</span>}
                                    </span>
                                    {d.isTitrationStepUp && (
                                      <ArrowUpCircle className="w-3.5 h-3.5 text-secondary shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-text-muted font-mono">
                                    {shownTime}
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
                          {weekAdhoc.map(l => (
                            <button key={l.id} onClick={() => setViewAdhocLog(l)} className="w-full text-left flex items-center gap-3 card-glass px-3 py-2.5 tap-target">
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-secondary" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium">
                                  {format(parseISO(l.date), 'EEE MMM d')}
                                  <span className="text-text-muted font-normal"> · {l.dose} {l.unit}</span>
                                  {!singlePeptide && <span className="text-text-muted font-normal"> · {getPeptideById(l.peptideId)?.name ?? l.peptideId}</span>}
                                </span>
                                <p className="text-[11px] text-text-muted font-mono">
                                  {l.time}
                                  {l.injectionSite && (
                                    <span className="inline-flex items-center gap-0.5 ml-1.5">
                                      <MapPin className="w-3 h-3" />{l.injectionSite}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0 text-secondary" style={{ backgroundColor: '#6366f11a' }}>
                                ad-hoc
                              </span>
                            </button>
                          ))}
                        </div>
                        )}
                      </div>
                      );
                    })}
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

                  {activeProto.status !== 'completed' && activeProto.status !== 'archived' && (
                    <button
                      onClick={handleFinish}
                      className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                    >
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <div>
                        <p className="font-medium text-sm">Finish Protocol</p>
                        <p className="text-xs text-text-muted">Mark as completed — future doses become skipped</p>
                      </div>
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
                    const usingVariant = !!dose.schedulePhases?.length;
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
                              value={usingVariant ? (dose.variantId ?? variants![0].id) : CUSTOM_SCHEDULE}
                              onChange={e => applyVariantEdit(idx, pep, e.target.value)}
                              className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm"
                            >
                              <option value={CUSTOM_SCHEDULE}>Custom (set your own schedule)</option>
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
                              <DecimalInput
                                value={dose.dose}
                                onChange={v => updateEditDose(idx, { dose: v })}
                                className="flex-1 bg-bg-raised border border-border rounded-l-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                                min={0}
                              />
                              <select
                                value={dose.unit}
                                onChange={e => updateEditDose(idx, { unit: e.target.value as 'mcg' | 'mg' | 'IU' })}
                                className="bg-bg-raised border border-l-0 border-border rounded-r-lg px-2 py-2 text-xs text-text-secondary"
                              >
                                <option value="mcg">mcg</option>
                                <option value="mg">mg</option>
                                <option value="IU">IU</option>
                              </select>
                            </div>
                          </div>
                          {!usingVariant && (
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
                          {!usingVariant && (
                            <div>
                              <label className="text-xs text-text-muted block mb-1">Length (weeks)</label>
                              <input
                                type="number"
                                min={1}
                                max={52}
                                value={dose.durationWeeks ?? 1}
                                onChange={e => { const n = parseInt(e.target.value, 10); if (!Number.isFinite(n) || n < 1) return; updateEditDose(idx, { durationWeeks: n }); }}
                                className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          )}
                          {dose.frequency === 'daily' && !usingVariant && (
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
                          {dose.frequency === 'custom' && !usingVariant && (
                            <div>
                              <label className="text-xs text-text-muted block mb-1">Every N days</label>
                              <input
                                type="number"
                                min={1}
                                value={dose.customFrequencyDays ?? 3}
                                onChange={e => { const n = parseInt(e.target.value, 10); if (!Number.isFinite(n) || n < 1) return; updateEditDose(idx, { customFrequencyDays: n }); }}
                                className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          )}
                        </div>

                        {dose.frequency === 'weekly_days' && !usingVariant && (
                          <WeekdayPicker
                            value={dose.daysOfWeek}
                            onChange={days => updateEditDose(idx, { daysOfWeek: days })}
                          />
                        )}

                        <ReconMixFields
                          value={dose.recon}
                          dose={dose.dose}
                          unit={dose.unit}
                          onChange={mix => updateEditDose(idx, { recon: mix })}
                        />

                        <PenColorField
                          value={dose.penColor}
                          onChange={color => updateEditDose(idx, { penColor: color })}
                        />
                      </div>
                    );
                  })}

                  <label className="flex items-start gap-3 rounded-xl border border-border p-3">
                    <input
                      type="checkbox"
                      checked={editTitrationAlerts}
                      onChange={e => setEditTitrationAlerts(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">
                      Announce titration step-ups
                      <span className="block text-xs text-text-muted">
                        Off by default. The schedule steps up either way — this only controls
                        whether the dashboard calls it out on the day.
                      </span>
                    </span>
                  </label>

                  <p className="text-xs text-text-muted">
                    Saving rebuilds all upcoming injections from these settings. Already-logged
                    doses are kept.
                  </p>

                  {editDoses.some(d => d.frequency === 'weekly_days' && !d.daysOfWeek?.length) && (
                    <p className="text-xs text-warning text-center">
                      Pick at least one day of the week for each "Specific days" peptide to continue.
                    </p>
                  )}

                  <div className="flex gap-3 pt-2 pb-4">
                    <button
                      onClick={() => setSheetMode('actions')}
                      className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-medium text-text-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving || editDoses.some(d => d.frequency === 'weekly_days' && !d.daysOfWeek?.length)}
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

      {viewAdhocLog && activeProto && (
        <AdhocLogSheet
          log={viewAdhocLog}
          onClose={() => setViewAdhocLog(null)}
          onDeleted={() => loadJourney(activeProto.id)}
        />
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
