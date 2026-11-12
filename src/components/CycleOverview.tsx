import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { getScheduledDosesForProtocols } from '../db/operations';
import type { ScheduledDose, UserProtocol } from '../db/schema';
import { getPeptideById } from '../data/peptides';
import { buildCycleMap, reviewItems, suggestionFor, type CycleMap } from '../utils/cycleMap';
import { CycleTimeline } from './CycleTimeline';

/** All active and paused protocols on one timeline, plus what looks worth reviewing in each. */
export function CycleOverview({ protocols }: { protocols: UserProtocol[] }) {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  const live = useMemo(() => protocols.filter(p => p.status === 'active' || p.status === 'paused'), [protocols]);
  const [doses, setDoses] = useState<ScheduledDose[]>([]);

  const key = live.map(p => `${p.id}:${p.updatedAt}`).join(',');
  useEffect(() => {
    let cancelled = false;
    getScheduledDosesForProtocols(live.map(p => p.id)).then(d => { if (!cancelled) setDoses(d); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const entries = useMemo(() => live.flatMap(protocol => protocol.doses.flatMap(d => {
    try {
      const map = buildCycleMap({ protocol, peptideId: d.peptideId, doses, today });
      const items = reviewItems(map, protocol, suggestionFor(map, getPeptideById(d.peptideId))).filter(i => i.severity === 'warn');
      return [{ map, items }];
    } catch {
      return []; // a damaged record must not blank the whole page
    }
  })), [live, doses, today]);

  if (entries.length === 0) return null;

  const open = (m: CycleMap) => navigate(`/cycle/${m.protocolId}/${m.peptideId}`);
  const needsLook = entries.filter(e => e.items.length > 0);

  return (
    <section className="card-glass p-4 mb-5" aria-label="Cycle map">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">Cycle map</h2>
      <CycleTimeline maps={entries.map(e => e.map)} today={today} pausedIds={new Set(live.filter(p => p.status === 'paused').map(p => p.id))} onOpen={open} />

      {needsLook.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Worth a look ({needsLook.length})
          </p>
          {needsLook.map(e => (
            <button
              key={`${e.map.protocolId}-${e.map.peptideId}`}
              onClick={() => open(e.map)}
              className="w-full text-left rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 tap-target"
            >
              <span className="block text-sm font-medium">{e.map.name}</span>
              {e.items.slice(0, 2).map(i => <span key={i.text} className="block text-xs text-text-muted">{i.text}</span>)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
