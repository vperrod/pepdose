import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { format, parseISO } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { applyCycleToProtocol, getProtocol, getScheduledDosesForProtocol, withCycle } from '../db/operations';
import type { ScheduledDose, UserProtocol } from '../db/schema';
import { getPeptideById } from '../data/peptides';
import { buildCycleMap, cycleFromSuggestion, reviewItems, suggestionFor } from '../utils/cycleMap';
import type { Cycle } from '../utils/cycle';
import { DisclaimerFooter } from '../components/DisclaimerFooter';

const day = (d: string) => format(parseISO(d), 'EEE d MMM');

/** One peptide's whole plan: setup, every ON/OFF window with dates, and how it compares with the typical cycle. */
export function CycleDetail() {
  const { protocolId = '', peptideId = '' } = useParams();
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [protocol, setProtocol] = useState<UserProtocol | null>(null);
  const [doses, setDoses] = useState<ScheduledDose[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<{ cycle: Cycle | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, d] = await Promise.all([getProtocol(protocolId), getScheduledDosesForProtocol(protocolId)]);
    setProtocol(p ?? null);
    setDoses(d);
    setLoaded(true);
  }, [protocolId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPending(null); setError(null); }, [protocolId, peptideId]);

  const view = useMemo(() => {
    if (!protocol || !protocol.doses.some(d => d.peptideId === peptideId)) return null;
    try {
      const map = buildCycleMap({ protocol, peptideId, doses, today });
      const suggestion = suggestionFor(map, getPeptideById(peptideId));
      return { map, suggestion, items: reviewItems(map, protocol, suggestion) };
    } catch {
      return null; // damaged record: show the "cannot be shown" message instead of crashing
    }
  }, [protocol, peptideId, doses, today]);

  const preview = useMemo(() => {
    if (!protocol || !pending) return null;
    try {
      return buildCycleMap({ protocol: withCycle(protocol, peptideId, pending.cycle), peptideId, doses, today });
    } catch {
      return null;
    }
  }, [protocol, pending, peptideId, doses, today]);

  async function apply() {
    if (!pending) return;
    setSaving(true);
    setError(null);
    try {
      await applyCycleToProtocol(protocolId, peptideId, pending.cycle);
      setPending(null);
      await load().catch(() => {}); // the cycle is saved; a failed refresh must not read as a failed apply
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply the cycle. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const back = (
    <button onClick={() => navigate(-1)} className="tap-target p-2 -ml-2 rounded-xl" aria-label="Back">
      <ArrowLeft className="w-5 h-5 text-text-secondary" />
    </button>
  );

  if (loaded && !view) {
    return (
      <div className="safe-top px-5 pt-4 pb-28">
        <div className="flex items-center gap-3 mb-5">{back}<h1 className="text-xl font-bold">Cycle</h1></div>
        <p className="text-sm text-text-muted">This protocol or peptide no longer exists, or its data cannot be read.</p>
      </div>
    );
  }
  if (!view) return <div className="safe-top px-5 pt-4" />;

  const { map, suggestion, items } = view;
  const st = map.status;
  const adoptable = cycleFromSuggestion(suggestion);
  const canAdopt = !!adoptable && suggestion.verdict !== 'matches';
  const canRemoveOff = suggestion.verdict === 'extra-off' && map.source === 'cycle' && !protocol?.breaks?.length;

  return (
    <div className="safe-top px-5 pt-4 pb-28">
      <div className="flex items-center gap-3 mb-5">
        {back}
        <h1 className="text-xl font-bold flex-1">{map.name}</h1>
        <span className={`font-mono text-xs px-2 py-1 rounded-full ${st.state === 'off' ? 'bg-amber-500/20 text-amber-400' : st.state === 'on' ? 'bg-green-500/20 text-green-400' : 'bg-card text-text-muted'}`}>
          {st.state === 'on' || st.state === 'off' ? `${st.state.toUpperCase()} · week ${st.weekInPhase} of ${st.phaseWeeks}` : st.state === 'upcoming' ? 'Not started' : 'Ended'}
        </span>
      </div>

      <section className="card-glass p-4 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Your setup</h2>
        <p className="text-sm">{map.setup}</p>
        <button onClick={() => navigate('/protocols')} className="mt-3 text-xs font-medium text-primary tap-target">Edit in Protocols</button>
      </section>

      <section className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Every window</h2>
        <ul className="space-y-2">
          {map.windows.map(w => (
            <li key={w.weekStart} className={`rounded-lg px-3 py-2 bg-card ${w.isNow ? 'ring-2 ring-text' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${w.kind === 'on' ? 'bg-green-500 text-bg' : 'bg-amber-500 text-bg'}`}>{w.kind === 'on' ? 'ON' : 'OFF'}</span>
                <span className="text-sm flex-1">{day(w.startDate)} to {day(w.endDate)}</span>
                <span className="font-mono text-xs text-text-muted">wk {w.weekStart}–{w.weekEnd}</span>
              </div>
              <p className="text-xs text-text-muted mt-1">
                {w.isNow && st.nextChange ? `NOW · ${st.nextChange.to === 'end' ? 'course ends' : st.nextChange.to === 'off' ? 'off' : 'back on'} ${day(st.nextChange.date)} (in ${st.nextChange.daysUntil} days) · ` : ''}
                {w.kind === 'off' ? 'No doses' : `${w.done} of ${w.planned} doses logged`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-glass p-4 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">What the app suggests</h2>
        <p className="text-sm">{suggestion.text}</p>
        {suggestion.reason && <p className="text-xs text-text-muted mt-2">{suggestion.reason}</p>}
        {suggestion.variants.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium mb-1">Presets for this peptide</p>
            <ul className="space-y-1">
              {suggestion.variants.map(v => <li key={v.id} className="text-xs text-text-muted"><b className="text-text">{v.name}.</b> {v.description}</li>)}
            </ul>
          </div>
        )}
        {items.length > 0 && (
          <ul className="mt-3 space-y-1">
            {items.map(i => <li key={i.text} className={`text-xs ${i.severity === 'warn' ? 'text-warning' : 'text-text-muted'}`}>{i.text}</li>)}
          </ul>
        )}

        {!pending && (canAdopt || canRemoveOff) && (
          <div className="mt-3 flex flex-col gap-2">
            {canAdopt && adoptable && (
              <button onClick={() => setPending({ cycle: adoptable })} className="w-full py-2.5 rounded-xl bg-primary text-bg text-sm font-semibold tap-target">
                Use suggested cycle ({adoptable.onWeeks} on, {adoptable.offWeeks} off)
              </button>
            )}
            {canRemoveOff && (
              <button onClick={() => setPending({ cycle: null })} className="w-full py-2.5 rounded-xl border border-border text-sm font-medium tap-target">
                Run without off weeks
              </button>
            )}
          </div>
        )}

        {pending && preview && (
          <div className="mt-3 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold mb-1">After this change</p>
            <p className="text-sm">{preview.setup}</p>
            <p className="text-xs text-text-muted mt-1">Upcoming doses are rebuilt. Doses you already logged stay as they are.</p>
            {error && <p role="alert" className="text-xs text-danger mt-2">{error}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setPending(null); setError(null); }} className="flex-1 py-2 rounded-lg border border-border text-sm tap-target">Cancel</button>
              <button onClick={apply} disabled={saving} className="flex-1 py-2 rounded-lg bg-primary text-bg text-sm font-semibold tap-target disabled:opacity-50">{saving ? 'Applying…' : 'Apply'}</button>
            </div>
          </div>
        )}
      </section>

      <DisclaimerFooter />
    </div>
  );
}
