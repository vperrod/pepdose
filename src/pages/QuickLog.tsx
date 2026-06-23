import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Syringe, Check, MapPin, Clock, Plus } from 'lucide-react';
import { getScheduledDosesForDate, getDoseLogsForDate, logDose } from '../db/operations';
import { getPeptideById } from '../data/peptides';
import type { ScheduledDose } from '../db/schema';

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
  const [justLogged, setJustLogged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      const [scheduled, logs] = await Promise.all([
        getScheduledDosesForDate(today),
        getDoseLogsForDate(today),
      ]);

      const enriched: QuickDose[] = scheduled.map(d => {
        const pep = getPeptideById(d.peptideId);
        return {
          ...d,
          peptideName: pep?.name ?? d.peptideId,
          categoryColor: CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa',
        };
      }).sort((a, b) => a.time.localeCompare(b.time));

      setDoses(enriched);
      setLogged(new Set(logs.map(l => l.scheduledDoseId).filter(Boolean) as string[]));
      setLoading(false);
    }
    load();
  }, [today]);

  async function handleLog(dose: QuickDose) {
    if (logged.has(dose.id) || justLogged.has(dose.id)) return;

    const now = format(new Date(), 'HH:mm');
    await logDose({
      scheduledDoseId: dose.id,
      protocolId: dose.protocolId,
      peptideId: dose.peptideId,
      date: today,
      time: now,
      dose: dose.dose,
      unit: dose.unit,
      route: dose.route,
      injectionSite: dose.suggestedSite,
    });

    setJustLogged(prev => new Set(prev).add(dose.id));
    setLogged(prev => new Set(prev).add(dose.id));
  }

  const pending = doses.filter(d => !logged.has(d.id));
  const done = doses.filter(d => logged.has(d.id));

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
                    <p className="font-semibold truncate">{dose.peptideName}</p>
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

      {done.length > 0 && (
        <section className="mb-6">
          <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-3">
            Completed ({done.length})
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
          </div>
        </section>
      )}

      {/* ponytail: ad-hoc modal/sheet when needed, link to full form for now */}
      <button
        className="card-glass w-full p-4 tap-target flex items-center justify-center gap-2 text-primary font-medium stagger-item"
        style={{ animationDelay: `${Math.min(pending.length, 5) * 0.05 + 0.1}s` }}
        onClick={() => {
          // TODO(victor): navigate to ad-hoc dose form (#adhoc)
        }}
      >
        <Plus className="w-5 h-5" />
        Ad-hoc dose
      </button>
    </div>
  );
}
