import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles, ArrowRight } from 'lucide-react';
import { CATEGORY_LABELS, getPeptideById, type PeptideCategory } from '../data/peptides';
import { peptidesForGoal, synergyStacksFor } from '../utils/goalPicker';

const GOALS = Object.entries(CATEGORY_LABELS) as [PeptideCategory, string][];

export function GoalPicker() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState<PeptideCategory | null>(null);

  const peptides = goal ? peptidesForGoal(goal) : [];
  const stacks = goal ? synergyStacksFor(goal) : [];

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => (goal ? setGoal(null) : navigate(-1))} className="tap-target" aria-label="Back">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">Find a protocol</h1>
      </div>

      {!goal ? (
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map(([cat, label]) => (
            <button key={cat} onClick={() => setGoal(cat)}
              className="card-glass p-4 tap-target text-left flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-secondary shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">{CATEGORY_LABELS[goal]} peptides</p>
          <div className="space-y-2">
            {peptides.map(p => (
              <button key={p.id}
                onClick={() => navigate('/protocols/new', { state: { preselectPeptideIds: [p.id] } })}
                className="card-glass w-full p-4 tap-target text-left flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-text-muted">{p.mechanismShort}</p>
                  <p className="text-[11px] text-text-secondary font-mono mt-0.5">
                    {p.dosing.standard} {p.dosing.unit} · {p.route}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted shrink-0" />
              </button>
            ))}
          </div>

          {stacks.length > 0 && (
            <div>
              <p className="text-sm text-text-muted mb-2">Synergy stacks</p>
              <div className="space-y-2">
                {stacks.map((s, i) => (
                  <button key={i}
                    onClick={() => navigate('/protocols/new', { state: { preselectPeptideIds: [s.peptideA, s.peptideB] } })}
                    className="card-glass w-full p-4 tap-target text-left">
                    <p className="text-sm font-semibold">
                      {getPeptideById(s.peptideA)?.name} + {getPeptideById(s.peptideB)?.name}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{s.note}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
