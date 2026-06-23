import { useState, useEffect, useMemo } from 'react';
import { differenceInWeeks, parseISO } from 'date-fns';
import { Shield, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight, BookOpen, OctagonAlert } from 'lucide-react';
import { getProtocols } from '../db/operations';
import { getExperienceForPeptide, EXPERIENCE_DATA, type PeptideExperience, type Severity } from '../data/experienceTimelines';
import { getPeptideById, PEPTIDES } from '../data/peptides';
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

const SEVERITY_COLORS: Record<Severity, string> = {
  normal: '#22c55e',
  monitor: '#f59e0b',
  stop: '#ef4444',
};

const SEVERITY_LABELS: Record<Severity, string> = {
  normal: 'Expected',
  monitor: 'Watch closely',
  stop: 'Stop & consult',
};

// ponytail: peptides with experience data only — no point showing empty guides
const GUIDABLE_PEPTIDE_IDS = EXPERIENCE_DATA.map(e => e.peptideId);

function WeekTimeline({ experience, currentWeek }: { experience: PeptideExperience; currentWeek: number | null }) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  // Auto-expand current week range on mount
  useEffect(() => {
    if (currentWeek !== null) {
      const idx = experience.weeklyGuide.findIndex(g => currentWeek >= g.weekStart && currentWeek <= g.weekEnd);
      if (idx !== -1) setExpandedWeek(idx);
    }
  }, [currentWeek, experience]);

  return (
    <div className="relative ml-4">
      {/* Vertical line */}
      <div className="absolute left-0 top-2 bottom-2 w-px bg-border" />

      {experience.weeklyGuide.map((guide, idx) => {
        const isCurrent = currentWeek !== null && currentWeek >= guide.weekStart && currentWeek <= guide.weekEnd;
        const isPast = currentWeek !== null && currentWeek > guide.weekEnd;
        const expanded = expandedWeek === idx;
        const weekLabel = guide.weekStart === guide.weekEnd
          ? `Week ${guide.weekStart}`
          : guide.weekEnd >= 999
            ? `Week ${guide.weekStart}+`
            : `Weeks ${guide.weekStart}–${guide.weekEnd}`;

        return (
          <div key={idx} className="relative pl-6 pb-4">
            {/* Node */}
            <div
              className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full -translate-x-[5px] z-10"
              style={{
                backgroundColor: isCurrent ? '#00d4aa' : isPast ? 'var(--text-muted)' : 'var(--bg-card)',
                border: isCurrent ? '2px solid #00d4aa' : '2px solid var(--border)',
                boxShadow: isCurrent ? '0 0 8px #00d4aa66' : 'none',
              }}
            />

            <button
              onClick={() => setExpandedWeek(expanded ? null : idx)}
              className={`w-full text-left tap-target ${isPast && !isCurrent ? 'opacity-50' : ''}`}
              aria-expanded={expanded}
            >
              <div className="flex items-center gap-2">
                {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />}
                <span className="text-xs font-medium text-text-muted">{weekLabel}</span>
                {isCurrent && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#00d4aa22] text-[#00d4aa]">
                    YOU ARE HERE
                  </span>
                )}
              </div>
              <p className="font-semibold text-sm mt-0.5">{guide.title}</p>
            </button>

            {expanded && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-text-muted leading-relaxed">{guide.description}</p>
                {guide.tips.length > 0 && (
                  <ul className="space-y-1">
                    {guide.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-text-muted">
                        <CheckCircle className="w-3.5 h-3.5 text-[#22c55e] shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SideEffectsSection({ experience }: { experience: PeptideExperience }) {
  if (experience.sideEffects.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Shield className="w-4 h-4 text-text-muted" />
        Side Effects
      </h3>
      <div className="space-y-1.5">
        {experience.sideEffects.map((se, i) => {
          const color = SEVERITY_COLORS[se.severity];
          return (
            <div key={i} className="card-glass p-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                  style={{ backgroundColor: color + '22', color }}
                >
                  {SEVERITY_LABELS[se.severity]}
                </span>
                <span className="text-sm font-medium">{se.name}</span>
              </div>
              <p className="text-xs text-text-muted">{se.notes}</p>
              <div className="flex gap-3 mt-1.5 text-[10px] text-text-muted">
                <span>Onset: {se.onset}</span>
                <span>Duration: {se.duration}</span>
                <span className="capitalize">{se.likelihood}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RedFlagsSection({ redFlags }: { redFlags: string[] }) {
  if (redFlags.length === 0) return null;

  return (
    <div className="card-glass p-4 border border-[#ef444444]" style={{ backgroundColor: '#ef444408' }}>
      <h3 className="text-sm font-semibold flex items-center gap-2 text-[#ef4444] mb-2">
        <OctagonAlert className="w-4 h-4" />
        Red Flags — Stop and Seek Medical Attention
      </h3>
      <ul className="space-y-1.5">
        {redFlags.map((flag, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444] shrink-0 mt-0.5" />
            <span>{flag}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PeptideGuideCard({ peptideId, currentWeek }: { peptideId: string; currentWeek: number | null }) {
  const [open, setOpen] = useState(true);
  const pep = getPeptideById(peptideId);
  const experience = getExperienceForPeptide(peptideId);
  if (!pep || !experience) return null;

  const color = CATEGORY_COLORS[pep.category] ?? '#00d4aa';

  return (
    <div className="space-y-4 stagger-item">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 w-full tap-target text-left">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '22' }}>
          <BookOpen className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{pep.name}</p>
          {currentWeek !== null && (
            <p className="text-xs text-text-muted">Week {currentWeek} of cycle</p>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
      </button>

      {open && (
        <div className="space-y-5 pl-1">
          <WeekTimeline experience={experience} currentWeek={currentWeek} />
          <SideEffectsSection experience={experience} />
          <RedFlagsSection redFlags={experience.redFlags} />
          {experience.postCycleNotes && (
            <div className="card-glass p-3">
              <p className="text-xs font-semibold text-text-muted mb-1">Post-cycle notes</p>
              <p className="text-xs text-text-muted leading-relaxed">{experience.postCycleNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExperienceGuide() {
  const [protocols, setProtocols] = useState<UserProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [browsePeptideId, setBrowsePeptideId] = useState('');

  useEffect(() => {
    getProtocols('active').then(p => {
      setProtocols(p);
      setLoading(false);
    });
  }, []);

  // Deduplicate peptide IDs across active protocols, compute current week per peptide
  const activePeptides = useMemo(() => {
    const seen = new Map<string, number>();
    for (const proto of protocols) {
      const weeksSinceStart = differenceInWeeks(new Date(), parseISO(proto.startDate));
      const currentWeek = Math.max(1, weeksSinceStart + 1);
      for (const pid of proto.peptideIds) {
        if (getExperienceForPeptide(pid) && !seen.has(pid)) {
          seen.set(pid, currentWeek);
        }
      }
    }
    return seen;
  }, [protocols]);

  const hasActiveGuides = activePeptides.size > 0;

  if (loading) {
    return (
      <div className="safe-top px-5 pt-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-muted animate-pulse" />
          <span className="text-sm text-text-muted">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="safe-top px-5 pt-4 pb-28">
      <h1 className="text-xl font-bold mb-1 stagger-item">Experience Guide</h1>
      <p className="text-sm text-text-muted mb-5 stagger-item">Week-by-week: what to expect, watch for, and when to stop.</p>

      {hasActiveGuides ? (
        <div className="space-y-6">
          {[...activePeptides.entries()].map(([peptideId, currentWeek]) => (
            <PeptideGuideCard key={peptideId} peptideId={peptideId} currentWeek={currentWeek} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card-glass p-4 stagger-item">
            <p className="text-sm text-text-muted mb-3">No active protocols. Browse any peptide's experience guide below.</p>
            <select
              value={browsePeptideId}
              onChange={e => setBrowsePeptideId(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-border rounded-lg px-3 py-2.5 text-sm tap-target"
              aria-label="Select peptide"
            >
              <option value="">Select a peptide...</option>
              {PEPTIDES.filter(p => GUIDABLE_PEPTIDE_IDS.includes(p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {browsePeptideId && (
            <PeptideGuideCard peptideId={browsePeptideId} currentWeek={null} />
          )}
        </div>
      )}
    </div>
  );
}
