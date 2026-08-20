import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { X, Check, Clock, MapPin, CalendarDays, SkipForward, Pencil, Trash2 } from 'lucide-react';
import { logDose, updateScheduledDose, updateDoseLog, getDoseLogsSince, deleteDoseLog, getProtocol } from '../db/operations';
import type { ScheduledDose, DoseLog, ReconMix } from '../db/schema';
import { clicksForDose, formatClicks, penMlPerClick } from '../utils/penClicks';
import { SITE_LABELS, INJECTION_SITES } from '../data/injectionSites';
import { getPeptideById } from '../data/peptides';
import { symptomsForCategory } from '../data/symptoms';
import { BodyMapSVG } from './BodyMapSVG';
import { AbdomenClockDial } from './AbdomenClockDial';
import { daysSinceByLabel, mostRestedLabel } from '../utils/injectionStats';
import { filterByOwner } from '../context/ownerFilter';

interface DoseActionSheetProps {
  dose: ScheduledDose & { peptideName: string; color: string };
  log?: DoseLog;
  onClose: () => void;
  onUpdated: () => void;
}

type SheetMode = 'actions' | 'log' | 'reschedule';

const REACTIONS = ['redness', 'lump', 'pain', 'bruise'] as const;

export function DoseActionSheet({ dose, log, onClose, onUpdated }: DoseActionSheetProps) {
  const isLogged = dose.status === 'logged';
  // Pending doses open on the actions menu so Log / Reschedule / Skip are all
  // visible; an already-logged dose opens straight into its editable log.
  const [mode, setMode] = useState<SheetMode>(isLogged ? 'log' : 'actions');
  // Keep the dose field as a string so intermediate edits ("", "0.", "2.5") are
  // never clobbered mid-typing. Parse to a number only at save time.
  const [actualDoseStr, setActualDoseStr] = useState(
    String(parseFloat((log?.dose ?? dose.dose).toPrecision(10))),
  );
  const actualDose = parseFloat(actualDoseStr);
  const doseValid = Number.isFinite(actualDose) && actualDose > 0;
  const [actualTime, setActualTime] = useState(log?.time ?? format(new Date(), 'HH:mm'));
  const [site, setSite] = useState(log?.injectionSite || dose.suggestedSite || SITE_LABELS[0]);
  const [notes, setNotes] = useState(log?.notes ?? '');
  const [reaction, setReaction] = useState<typeof REACTIONS[number] | undefined>(log?.siteReaction);
  const [symptoms, setSymptoms] = useState<Record<string, number>>(
    () => Object.fromEntries((log?.symptoms ?? []).map(s => [s.name, s.severity])),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Pen clicks for this injection, tracking the dose actually typed. Loaded from
  // the protocol's own mix so every screen that opens this sheet gets it.
  const [recon, setRecon] = useState<ReconMix | undefined>();
  const [penColor, setPenColor] = useState<string | undefined>();
  useEffect(() => {
    let live = true;
    void getProtocol(dose.protocolId).then(p => {
      const doseConfig = p?.doses.find(d => d.peptideId === dose.peptideId);
      if (live) {
        setRecon(doseConfig?.recon);
        setPenColor(doseConfig?.penColor);
      }
    });
    return () => { live = false; };
  }, [dose.protocolId, dose.peptideId]);
  const clicks = formatClicks(
    clicksForDose(doseValid ? actualDose : dose.dose, dose.unit, recon, penMlPerClick()),
  );

  const symptomOptions = symptomsForCategory(getPeptideById(dose.peptideId)?.category);
  function toggleSymptom(name: string) {
    setSymptoms(prev => {
      const next = { ...prev };
      if (name in next) delete next[name];
      else next[name] = 5;
      return next;
    });
  }
  const symptomsArray = Object.entries(symptoms).map(([name, severity]) => ({ name, severity }));
  const [daysMap, setDaysMap] = useState<Record<string, number>>({});
  const [showClock, setShowClock] = useState(false);
  const isAbdomen = site.startsWith('Left abdomen') || site.startsWith('Right abdomen') || site.startsWith('Abdomen');

  const userPickedSite = useRef(false);

  const [newDate, setNewDate] = useState(dose.date);
  const [newTime, setNewTime] = useState(dose.time);

  useEffect(() => {
    getDoseLogsSince(90).then(logs => {
      // Site rest times are per-body: only this dose's owner's injections count,
      // never the other profile's (the view filter can be 'all', so it won't do).
      const ds = daysSinceByLabel(filterByOwner(logs, dose.owner), new Date());
      setDaysMap(ds);
      // only auto-pick a rested zone when logging fresh (no existing site chosen)
      if (!log?.injectionSite && !dose.suggestedSite && !userPickedSite.current) setSite(mostRestedLabel(SITE_LABELS, ds));
    });
  }, [log?.injectionSite, dose.suggestedSite, dose.owner]);

  const idByLabel = Object.fromEntries(INJECTION_SITES.map(s => [s.label, s.id]));
  const labelById = Object.fromEntries(INJECTION_SITES.map(s => [s.id, s.label]));
  const daysById = Object.fromEntries(
    Object.entries(daysMap).map(([label, d]) => [idByLabel[label], d]).filter(([id]) => id),
  );

  // A thrown IndexedDB write (quota, blocked tx) must never strand the sheet on
  // "Saving…": finally always clears `saving`, and the error surfaces inline so
  // the user can retry instead of silently losing the edit.
  async function runSave(write: () => Promise<unknown>) {
    setSaving(true);
    setSaveError(null);
    try {
      await write();
      onUpdated();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleLog() {
    if (!doseValid) return;
    return runSave(() =>
      log
        ? updateDoseLog(log.id, {
            time: actualTime,
            dose: actualDose,
            injectionSite: site,
            siteReaction: reaction,
            symptoms: symptomsArray.length ? symptomsArray : undefined,
            notes: notes || undefined,
          })
        : logDose({
            owner: dose.owner,
            scheduledDoseId: dose.id,
            protocolId: dose.protocolId,
            peptideId: dose.peptideId,
            date: dose.date,
            time: actualTime,
            dose: actualDose,
            unit: dose.unit,
            route: dose.route,
            injectionSite: site,
            siteReaction: reaction,
            symptoms: symptomsArray.length ? symptomsArray : undefined,
            notes: notes || undefined,
          }),
    );
  }

  function handleReschedule() {
    return runSave(() =>
      updateScheduledDose(dose.id, {
        date: newDate,
        time: newTime,
        editNote: `Rescheduled from ${dose.date} ${dose.time}`,
      }),
    );
  }

  function handleSkip() {
    return runSave(() => updateScheduledDose(dose.id, { status: 'skipped' }));
  }

  // Deleting a log restores the vial draw-down and flips the scheduled dose
  // back to pending (deleteDoseLog handles both + the sync tombstone).
  function handleDeleteLog() {
    if (!log) return;
    return runSave(() => deleteDoseLog(log.id));
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] animate-slide-up">
        <div className="bg-bg-raised rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: dose.color }}
              />
              <div>
                <p className="font-semibold text-sm">{dose.peptideName}</p>
                <p className="text-xs text-text-muted">
                  {(log?.dose ?? dose.dose)} {dose.unit} · {log?.date ?? dose.date} · {log?.time ?? dose.time}
                </p>
                {clicks && <p className="text-xs text-primary font-mono">{clicks}</p>}
                {penColor && <p className="text-xs text-text-muted">Pen: {penColor}</p>}
              </div>
            </div>
            <button onClick={onClose} className="tap-target p-2 rounded-xl hover:bg-card" aria-label="Close">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          {saveError && (
            <div role="alert" className="mx-4 mt-4 card-glass p-3 border border-danger/40 text-sm text-danger">
              {saveError}
            </div>
          )}

          {mode === 'actions' && (
            <div className="p-4 space-y-2">
              {!isLogged && (
                <button
                  onClick={() => setMode('log')}
                  className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                >
                  <Check className="w-5 h-5 text-success" />
                  <div>
                    <p className="font-medium text-sm">Log Dose</p>
                    <p className="text-xs text-text-muted">Record injection details</p>
                  </div>
                </button>
              )}
              {!isLogged && (
                <button
                  onClick={() => setMode('reschedule')}
                  className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                >
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Reschedule</p>
                    <p className="text-xs text-text-muted">Move to different date/time</p>
                  </div>
                </button>
              )}
              {!isLogged && (
                <button
                  onClick={handleSkip}
                  disabled={saving}
                  className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                >
                  <SkipForward className="w-5 h-5 text-warning" />
                  <div>
                    <p className="font-medium text-sm">Skip Dose</p>
                    <p className="text-xs text-text-muted">Mark as intentionally skipped</p>
                  </div>
                </button>
              )}
              {isLogged && (
                <div className="card-glass p-4 flex items-center gap-3">
                  <Check className="w-5 h-5 text-success" />
                  <p className="text-sm text-text-muted">Already logged</p>
                </div>
              )}
            </div>
          )}

          {mode === 'log' && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  Actual Dose ({dose.unit})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={actualDoseStr}
                  onChange={e => setActualDoseStr(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Time of Injection
                </label>
                <input
                  type="time"
                  value={actualTime}
                  onChange={e => setActualTime(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  Injection Site
                </label>
                <BodyMapSVG
                  selectedSite={idByLabel[site]}
                  onSelectSite={(id) => { userPickedSite.current = true; setSite(labelById[id]); }}
                  daysSinceMap={daysById}
                />
                <p className="text-center text-xs text-text-muted mt-1">{site}</p>
                {isAbdomen && (
                  <button onClick={() => setShowClock(v => !v)} className="block mx-auto mt-2 text-xs text-primary underline">
                    {showClock ? 'Hide' : 'Use'} clock method
                  </button>
                )}
                {showClock && <AbdomenClockDial selected={site} onSelect={(label) => { userPickedSite.current = true; setSite(label); }} />}
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">Site reaction (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {REACTIONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setReaction(reaction === r ? undefined : r)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${
                        reaction === r ? 'bg-warning/20 text-warning ring-1 ring-warning/40' : 'bg-card border border-border text-text-secondary'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  How you're feeling (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {symptomOptions.map(s => {
                    const active = s.name in symptoms;
                    return (
                      <button
                        key={s.name}
                        onClick={() => toggleSymptom(s.name)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          active ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'bg-card border border-border text-text-secondary'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
                {symptomsArray.length > 0 && (
                  <div className="mt-3 space-y-2.5">
                    {symptomsArray.map(s => (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="text-xs text-text-secondary w-32 shrink-0 truncate">{s.name}</span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={s.severity}
                          onChange={e => setSymptoms(prev => ({ ...prev, [s.name]: parseInt(e.target.value) }))}
                          className="flex-1 accent-primary"
                          aria-label={`${s.name} severity`}
                        />
                        <span className="text-xs font-mono w-6 text-right" style={{ color: s.severity >= 7 ? '#ef4444' : s.severity >= 4 ? '#f59e0b' : '#22c55e' }}>
                          {s.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  <Pencil className="w-3 h-3 inline mr-1" />
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Side effects, feelings, etc."
                  rows={2}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>

              <div className={`flex gap-3 pt-2${log ? '' : ' pb-4'}`}>
                <button
                  onClick={() => isLogged ? onClose() : setMode('actions')}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-medium text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLog}
                  disabled={saving || !doseValid}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-bg text-sm font-semibold disabled:opacity-40"
                >
                  {saving ? 'Saving...' : log ? 'Save Changes' : 'Log Dose'}
                </button>
              </div>

              {log && (
                <div className="pb-4">
                  {!confirmingDelete ? (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="w-full px-4 py-3 rounded-xl border border-danger/40 text-sm font-medium text-danger flex items-center justify-center gap-2 tap-target"
                    >
                      <Trash2 className="w-4 h-4" /> Delete log
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmingDelete(false)}
                        className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-medium text-text-secondary"
                      >
                        Keep it
                      </button>
                      <button
                        onClick={handleDeleteLog}
                        disabled={saving}
                        className="flex-1 px-4 py-3 rounded-xl bg-danger text-white text-sm font-semibold disabled:opacity-40"
                      >
                        {saving ? 'Deleting…' : 'Yes, delete — back to pending'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === 'reschedule' && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  New Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  New Time
                </label>
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2 pb-4">
                <button
                  onClick={() => setMode('actions')}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-medium text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={saving || (newDate === dose.date && newTime === dose.time)}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-bg text-sm font-semibold disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Reschedule'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
