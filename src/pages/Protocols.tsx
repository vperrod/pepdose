import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInWeeks, parseISO } from 'date-fns';
import { Plus, Beaker } from 'lucide-react';
import { getProtocols } from '../db/operations';
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

export function Protocols() {
  const navigate = useNavigate();
  const [protocols, setProtocols] = useState<UserProtocol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProtocols().then(p => {
      setProtocols(p);
      setLoading(false);
    });
  }, []);

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
    <div className="safe-top px-5 pt-4">
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
                <div className="w-full h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
