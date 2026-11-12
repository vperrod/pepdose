import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { type UserProtocol } from '../db/schema';
import { buildCycleMap } from '../utils/cycleMap';
import { getPeptideById } from '../data/peptides';

export function CycleBoard({ protocols }: { protocols: UserProtocol[] }) {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');

  const activeProtocols = protocols.filter(p => p.status === 'active');

  if (activeProtocols.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
        Your cycles
      </h2>
      <div className="space-y-3">
        {activeProtocols.flatMap((protocol) =>
          protocol.doses.map((dose, doseIndex) => {
            const st = buildCycleMap({ protocol, peptideId: dose.peptideId, doses: [], today }).status;

            if (st.state === 'done') return null;

            const peptide = getPeptideById(dose.peptideId);
            const peptideName = peptide?.name ?? dose.peptideId;

            const stateText = st.state === 'on'
              ? `ON · week ${st.weekInPhase} of ${st.phaseWeeks}`
              : st.state === 'off'
                ? `OFF · week ${st.weekInPhase} of ${st.phaseWeeks}`
                : st.state === 'upcoming'
                  ? `Starts ${st.nextChange?.date}`
                  : '';

            const stateClass = st.state === 'on'
              ? 'bg-green-500/20 text-green-400'
              : st.state === 'off'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-text-muted/20 text-text-muted';

            const stripSquares = st.strip.map((isOn, idx) => {
              const weekNum = idx + 1;
              const isCurrentWeek = weekNum === st.weekNum && st.weekNum >= 1 && st.weekNum <= st.strip.length;
              return (
                <div
                  key={idx}
                  className={
                    `w-6 h-6 rounded-sm ${isOn ? 'bg-green-500' : 'bg-amber-500/30'} ` +
                    (isCurrentWeek ? 'ring-2 ring-primary' : '')
                  }
                  aria-hidden
                />
              );
            });

            const nextChangeText = st.nextChange?.to === 'off'
              ? `Off from ${st.nextChange.date} (in ${st.nextChange.daysUntil} days).`
              : st.nextChange?.to === 'on'
                ? `Back on ${st.nextChange.date} (in ${st.nextChange.daysUntil} days).`
                : st.nextChange?.to === 'end'
                  ? `Course ends ${st.nextChange.date}.`
                  : st.nextChange?.to === 'start'
                    ? ''
                    : '';

            const shouldHighlight = !!st.nextChange && st.nextChange.daysUntil <= 3 &&
              (st.nextChange.to === 'off' || st.nextChange.to === 'on');

            const nextChangeElement = nextChangeText ? (
              shouldHighlight ? (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs">
                  {nextChangeText}
                </div>
              ) : (
                <div className="text-xs text-text-muted">{nextChangeText}</div>
              )
            ) : null;

            return (
              <div
                key={`${protocol.id}-${doseIndex}`}
                className="card-glass p-4 cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`${peptideName} cycle details`}
                onClick={() => navigate(`/cycle/${protocol.id}/${dose.peptideId}`)}
                onKeyDown={e => { if (e.key === 'Enter') navigate(`/cycle/${protocol.id}/${dose.peptideId}`); }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{peptideName}</span>
                  <span className={`text-xs font-mono px-2 py-1 rounded ${stateClass}`}>
                    {stateText}
                  </span>
                </div>

                <div className="flex gap-1 mb-2">
                  {stripSquares}
                </div>

                {nextChangeElement}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}