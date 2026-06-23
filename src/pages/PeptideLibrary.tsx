import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Clock, Syringe } from 'lucide-react';
import { PEPTIDES, CATEGORY_LABELS } from '../data/peptides';
import type { Peptide, PeptideCategory } from '../data/peptides';

const CATEGORY_COLORS: Record<string, string> = {
  healing: '#22c55e',
  glp1: '#6366f1',
  gh_secretagogue: '#f59e0b',
  fat_loss: '#ef4444',
  cosmetic: '#ec4899',
  sexual_health: '#a855f7',
  nootropic: '#06b6d4',
};

const CATEGORIES: ('all' | PeptideCategory)[] = [
  'all', 'healing', 'glp1', 'gh_secretagogue', 'fat_loss', 'cosmetic', 'sexual_health', 'nootropic',
];

function formatFrequency(p: Peptide): string {
  const d = p.dosing;
  const times = d.timesPerDay && d.timesPerDay > 1 ? ` ${d.timesPerDay}x/day` : '';
  if (d.frequency === 'custom' && d.customFrequencyDays) return `Every ${d.customFrequencyDays} days${times}`;
  const labels: Record<string, string> = { daily: 'Daily', eod: 'Every other day', weekly: 'Weekly', biweekly: 'Biweekly' };
  return (labels[d.frequency] ?? d.frequency) + times;
}

function formatHalfLife(hours: number): string {
  if (hours >= 24) return `${Math.round(hours / 24)}d`;
  if (hours >= 1) return `${hours}h`;
  return `${Math.round(hours * 60)}min`;
}

export function PeptideLibrary() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | PeptideCategory>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return PEPTIDES.filter(p => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q)
        || p.aliases.some(a => a.toLowerCase().includes(q))
        || p.mechanismShort.toLowerCase().includes(q);
    });
  }, [search, activeCategory]);

  // ponytail: group by category only when showing "all" — flat list when filtered by category
  const grouped = useMemo(() => {
    if (activeCategory !== 'all') return [{ category: activeCategory, peptides: filtered }];
    const map = new Map<PeptideCategory, Peptide[]>();
    for (const p of filtered) {
      const arr = map.get(p.category);
      if (arr) arr.push(p);
      else map.set(p.category, [p]);
    }
    return Array.from(map.entries()).map(([category, peptides]) => ({ category, peptides }));
  }, [filtered, activeCategory]);

  return (
    <div className="safe-top px-5 pt-4 pb-28">
      <h1 className="text-xl font-bold mb-4 stagger-item">Peptide Library</h1>

      {/* Search */}
      <div className="relative mb-3 stagger-item" style={{ animationDelay: '0.05s' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="search"
          placeholder="Search peptides..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary"
          aria-label="Search peptides"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 stagger-item scrollbar-none" style={{ animationDelay: '0.1s' }}>
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat;
          const color = cat === 'all' ? '#00d4aa' : CATEGORY_COLORS[cat];
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="tap-target shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: active ? color + '22' : 'transparent',
                color: active ? color : 'var(--text-muted)',
                border: `1px solid ${active ? color + '44' : 'var(--border)'}`,
              }}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No peptides match your search.</p>
      ) : (
        grouped.map(group => (
          <div key={group.category} className="mb-5">
            {activeCategory === 'all' && (
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2" style={{ color: CATEGORY_COLORS[group.category] }}>
                {CATEGORY_LABELS[group.category]}
              </p>
            )}
            <div className="space-y-2">
              {group.peptides.map((p, i) => {
                const color = CATEGORY_COLORS[p.category];
                const expanded = expandedId === p.id;
                const Chevron = expanded ? ChevronUp : ChevronDown;
                return (
                  <button
                    key={p.id}
                    className="card-glass w-full p-4 tap-target text-left stagger-item"
                    style={{ animationDelay: `${0.12 + i * 0.03}s` }}
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    aria-expanded={expanded}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: color + '22' }}
                      >
                        <Syringe className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium">{p.name}</span>
                          <span
                            className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: color + '22', color }}
                          >
                            {p.category.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted line-clamp-2">{p.mechanismShort}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
                          <span className="font-mono">{p.dosing.standard} {p.dosing.unit} · {formatFrequency(p)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            t½ {formatHalfLife(p.halfLifeHours)}
                          </span>
                        </div>
                      </div>
                      <Chevron className="w-4 h-4 text-text-muted shrink-0 mt-1" />
                    </div>

                    {expanded && (
                      <div className="mt-3 pt-3 border-t border-border text-xs space-y-2" onClick={e => e.stopPropagation()}>
                        {p.aliases.length > 0 && (
                          <p className="text-text-muted">
                            <span className="text-text-secondary font-medium">Also known as:</span> {p.aliases.join(', ')}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-text-muted mb-0.5">Dose range</p>
                            <p className="font-mono">{p.dosing.low}–{p.dosing.high} {p.dosing.unit}</p>
                          </div>
                          <div>
                            <p className="text-text-muted mb-0.5">Cycle</p>
                            <p className="font-mono">
                              {p.dosing.cycleWeeks > 0 ? `${p.dosing.cycleWeeks}w on` : 'As needed'}
                              {p.dosing.offCycleWeeks > 0 ? ` / ${p.dosing.offCycleWeeks}w off` : ''}
                            </p>
                          </div>
                          <div>
                            <p className="text-text-muted mb-0.5">Route</p>
                            <p>{p.route} · {p.needleGauge}</p>
                          </div>
                          <div>
                            <p className="text-text-muted mb-0.5">Timing</p>
                            <p>{p.dosing.timeOfDay.replace('_', ' ')} · {p.dosing.withFood}</p>
                          </div>
                        </div>
                        {p.dosing.titration && (
                          <div>
                            <p className="text-text-muted mb-1 font-medium">Titration schedule</p>
                            <div className="flex flex-wrap gap-1.5">
                              {p.dosing.titration.map((t, idx) => (
                                <span key={idx} className="font-mono px-1.5 py-0.5 rounded bg-border">
                                  W{t.weekStart}–{t.weekEnd > 100 ? '+' : t.weekEnd}: {t.dose} {t.unit}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-text-muted mb-0.5">Reconstitution</p>
                          <p className="font-mono">
                            {p.reconstitution.typicalVialMg > 0
                              ? `${p.reconstitution.typicalVialMg}mg vial + ${p.reconstitution.bacWaterMl}ml BAC water · ${p.reconstitution.shelfLifeDays}d shelf life`
                              : `Pre-made · ${p.reconstitution.shelfLifeDays}d shelf life`}
                          </p>
                        </div>
                        <p className="text-text-muted italic">{p.cyclingReason}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
