import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Syringe, Check, MapPin, Clock, Plus, X } from 'lucide-react';
import { getScheduledDosesForDate, getDoseLogsForDate, getProtocols, logDose } from '../db/operations';
import { withoutInactiveUpcoming } from '../utils/doseVisibility';
import { getPeptideById, PEPTIDES } from '../data/peptides';
import type { ScheduledDose, DoseLog } from '../db/schema';
import { UserBadge } from '../components/UserBadge';
import { UserPicker } from '../components/UserPicker';
import { DecimalInput } from '../components/DecimalInput';
import { AdhocLogSheet } from '../components/AdhocLogSheet';
import { getLastOwner, setLastOwner, type UserName } from '../data/users';
import { useOwnerFilter } from '../context/ViewFilterContext';

interface QuickDose extends ScheduledDose {
  peptideName: string;
  categoryColor: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  healing: '#22c55e',
  glp1: '#6366f1',
  gh_secretagogue: '#f59e0b',
  fat_loss: '#ef4444',
  cosmetic: '#ec4899',
  sexual_health: '#a855f7',
  nootropic: '#06b6d4',
};

export function QuickLog() {
  const [doses, setDoses] = useState<QuickDose[]>([]);
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [todayLogs, setTodayLogs] = useState<DoseLog[]>([]);
  const [justLogged, setJustLogged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAdhoc, setShowAdhoc] = useState(false);
  const [adhocMsg, setAdhocMsg] = useState('');
  const [viewAdhocLog, setViewAdhocLog] = useState<DoseLog | null>(null);
  const [logError, setLogError] = useState('');
  const inFlight = useRef(new Set<string>());

  const today = format(new Date(), 'yyyy-MM-dd');
  const applyOwnerFilter = useOwnerFilter();

  const load = useCallback(async () => {
    const [scheduled, logs, protos] = await Promise.all([
      getScheduledDosesForDate(today),
      getDoseLogsForDate(today),
      getProtocols('active'),
    ]);

    const visible = withoutInactiveUpcoming(scheduled, new Set(protos.map(p => p.id)));
    const enriched: QuickDose[] = visible.map(d => {
      const pep = getPeptideById(d.peptideId);
      return {
        ...d,
        peptideName: pep?.name ?? d.peptideId,
        categoryColor: CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa',
      };
    }).sort((a, b) => a.time.localeCompare(b.time));

    setDoses(enriched);
    setTodayLogs(logs);
    setLogged(new Set(logs.map(l => l.scheduledDoseId).filter(Boolean) as string[]));
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  async function handleLog(dose: QuickDose) {
    // The ref updates synchronously; state only changes after the save resolves.
    if (inFlight.current.has(dose.id) || logged.has(dose.id) || justLogged.has(dose.id)) return;
    inFlight.current.add(dose.id);
    setLogError('');

    try {
      await logDose({
        owner: dose.owner,
        scheduledDoseId: dose.id,
        protocolId: dose.protocolId,
        peptideId: dose.peptideId,
        date: today,
        time: format(new Date(), 'HH:mm'),
        dose: dose.dose,
        unit: dose.unit,
        route: dose.route,
        injectionSite: dose.suggestedSite,
      });
      setJustLogged(prev => new Set(prev).add(dose.id));
      setLogged(prev => new Set(prev).add(dose.id));
    } catch (e) {
      setLogError(e instanceof Error ? e.message : 'Could not save — please try again.');
      await load();
    } finally {
      inFlight.current.delete(dose.id);
    }
  }

  const visible = applyOwnerFilter(doses);
  const pending = visible.filter(d => !logged.has(d.id));
  const done = visible.filter(d => logged.has(d.id));
  // Ad-hoc doses logged today: without these the page shows no trace of a
  // just-logged ad-hoc dose, which reads as a failed save.
  const adhocDone = applyOwnerFilter(todayLogs.filter(l => !l.scheduledDoseId));

  if (loading) {
    return (
      <div className="safe-top px-5 pt-4 pb-28">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="skeleton h-24 w-full mb-3" />
        <div className="skeleton h-24 w-full mb-3" />
        <div className="skeleton h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="safe-top px-5 pt-4 pb-28">
      <header className="mb-6 stagger-item">
        <h1 className="text-2xl font-bold tracking-tight">Log Dose</h1>
        <p className="text-text-secondary text-sm mt-1">
          {pending.length ? `${pending.length} remaining today` : 'All done for today'}
        </p>
      </header>

      {logError && (
        <div role="alert" className="card-glass p-3 mb-3 border border-danger/40 text-sm text-danger">
          {logError}
        </div>
      )}

      {pending.length > 0 && (
        <section className="mb-6">
          <div className="space-y-3">
            {pending.map((dose, i) => (
              <button
                key={dose.id}
                onClick={() => handleLog(dose)}
                className="card-glass w-full text-left p-4 tap-target stagger-item relative overflow-hidden"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {justLogged.has(dose.id) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-success/20 z-10">
                    <div className="check-burst">
                      <Check className="w-10 h-10 text-success" strokeWidth={3} />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: dose.categoryColor + '22' }}
                  >
                    <Syringe className="w-5 h-5" style={{ color: dose.categoryColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{dose.peptideName}</p>
                      <UserBadge owner={dose.owner} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dose.time}
                      </span>
                      <span className="font-mono">{dose.dose} {dose.unit}</span>
                      {dose.suggestedSite && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {dose.suggestedSite}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-text-muted uppercase tracking-wider font-medium">
                    Tap
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {(done.length > 0 || adhocDone.length > 0) && (
        <section className="mb-6">
          <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-3">
            Completed ({done.length + adhocDone.length})
          </p>
          <div className="space-y-2">
            {done.map(dose => (
              <div key={dose.id} className="card-glass p-3 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-success" />
                  </div>
                  <p className="text-sm text-text-secondary line-through flex-1">{dose.peptideName}</p>
                  <span className="text-xs text-text-muted font-mono">{dose.dose} {dose.unit}</span>
                </div>
              </div>
            ))}
            {adhocDone.map(log => (
              <button key={log.id} onClick={() => setViewAdhocLog(log)} className="card-glass p-3 opacity-70 w-full text-left tap-target">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <p className="text-sm text-text-secondary truncate">{getPeptideById(log.peptideId)?.name ?? log.peptideId}</p>
                    <UserBadge owner={log.owner} />
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary/15 text-secondary shrink-0">ad-hoc</span>
                  </div>
                  <span className="text-xs text-text-muted font-mono shrink-0">{log.dose} {log.unit} · {log.time}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {adhocMsg && (
        <div className="card-glass p-3 mb-3 flex items-center gap-2 border border-success/40">
          <Check className="w-4 h-4 text-success" />
          <p className="text-sm">{adhocMsg}</p>
        </div>
      )}

      <button
        className="card-glass w-full p-4 tap-target flex items-center justify-center gap-2 text-primary font-medium stagger-item"
        style={{ animationDelay: `${Math.min(pending.length, 5) * 0.05 + 0.1}s` }}
        onClick={() => setShowAdhoc(true)}
      >
        <Plus className="w-5 h-5" />
        Ad-hoc dose
      </button>

      {viewAdhocLog && (
        <AdhocLogSheet
          log={viewAdhocLog}
          onClose={() => setViewAdhocLog(null)}
          onDeleted={load}
        />
      )}

      {showAdhoc && (
        <AdhocDoseSheet
          onClose={() => setShowAdhoc(false)}
          onLogged={(name) => {
            setShowAdhoc(false);
            setAdhocMsg(`Logged ${name}`);
            setTimeout(() => setAdhocMsg(''), 3000);
            load(); // a today-dose must show up in Completed immediately
          }}
        />
      )}
    </div>
  );
}

function AdhocDoseSheet({ onClose, onLogged }: { onClose: () => void; onLogged: (name: string) => void }) {
  // Every peptide is loggable ad-hoc — the old injectable-only filter silently
  // hid MK-677 (oral) and Semax/Selank (intranasal) from the picker.
  const [owner, setOwner] = useState<UserName>(getLastOwner());
  const [peptideId, setPeptideId] = useState('');
  const [dose, setDose] = useState(0);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pep = getPeptideById(peptideId);
  const unit = (pep?.dosing.unit ?? 'mg') as 'mcg' | 'mg' | 'IU';
  const valid = !!peptideId && dose > 0;

  // A thrown IndexedDB write must never strand the sheet on "Saving…" (same
  // guarantee DoseActionSheet gives): surface the error inline so the user can retry.
  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      await logDose({
        owner,
        protocolId: '',
        peptideId,
        date,
        time,
        dose,
        unit,
        route: pep?.route ?? 'subcutaneous',
      });
      setLastOwner(owner);
      onLogged(pep?.name ?? 'dose');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] animate-slide-up">
        <div className="bg-bg-raised rounded-t-2xl max-h-[85vh] overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Log an ad-hoc dose</p>
            <button onClick={onClose} className="tap-target p-2 rounded-xl hover:bg-card" aria-label="Close">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          {saveError && (
            <div role="alert" className="card-glass p-3 border border-danger/40 text-sm text-danger">
              {saveError}
            </div>
          )}

          <UserPicker value={owner} onChange={setOwner} />

          <div>
            <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">Peptide</label>
            <select
              value={peptideId}
              onChange={e => setPeptideId(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select peptide…</option>
              {PEPTIDES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">Dose ({unit})</label>
            <DecimalInput
              value={dose}
              onChange={setDose}
              min={0}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">Date</label>
              <input
                type="date"
                value={date}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2 pb-2">
            <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-medium text-text-secondary">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !valid}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-bg text-sm font-semibold disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Log Dose'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
