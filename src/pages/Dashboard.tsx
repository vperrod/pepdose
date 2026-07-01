import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInMinutes, differenceInHours, differenceInWeeks, parseISO } from 'date-fns';
import { Syringe, TrendingUp, ChevronRight, Zap } from 'lucide-react';
import { getScheduledDosesForDate, getProtocols, getDoseLogsForDate } from '../db/operations';
import { getPeptideById } from '../data/peptides';
import { scheduleDayNotifications, clearScheduledNotifications } from '../utils/notifications';
import type { ScheduledDose, UserProtocol } from '../db/schema';

interface DashboardDose extends ScheduledDose {
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

export function Dashboard() {
  const navigate = useNavigate();
  const [todayDoses, setTodayDoses] = useState<DashboardDose[]>([]);
  const [protocols, setProtocols] = useState<UserProtocol[]>([]);
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const notifTimers = useRef<number[]>([]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();

  useEffect(() => {
    async function load() {
      const [doses, protos, logs] = await Promise.all([
        getScheduledDosesForDate(today),
        getProtocols('active'),
        getDoseLogsForDate(today),
      ]);

      const enriched: DashboardDose[] = doses.map(d => {
        const pep = getPeptideById(d.peptideId);
        return {
          ...d,
          peptideName: pep?.name ?? d.peptideId,
          categoryColor: CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa',
        };
      }).sort((a, b) => a.time.localeCompare(b.time));

      setTodayDoses(enriched);
      setProtocols(protos);
      setLogged(new Set(logs.map(l => l.scheduledDoseId).filter(Boolean) as string[]));
      setLoading(false);

      clearScheduledNotifications(notifTimers.current);
      notifTimers.current = scheduleDayNotifications(doses);
    }
    load();
    return () => clearScheduledNotifications(notifTimers.current);
  }, [today]);

  const completedCount = todayDoses.filter(d => d.status === 'logged' || logged.has(d.id)).length;
  const totalCount = todayDoses.length;
  const nextDose = todayDoses.find(d => d.status === 'upcoming' && !logged.has(d.id));

  function getTimeUntil(timeStr: string): string {
    const [h, m] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    const mins = differenceInMinutes(target, now);
    if (mins <= 0) return 'Now';
    if (mins < 60) return `${mins}m`;
    const hrs = differenceInHours(target, now);
    return `${hrs}h ${mins % 60}m`;
  }

  if (loading) {
    return (
      <div className="safe-top px-5 pt-4">
        <div className="skeleton h-8 w-40 mb-6" />
        <div className="skeleton h-32 w-full mb-4" />
        <div className="skeleton h-20 w-full mb-3" />
        <div className="skeleton h-20 w-full mb-3" />
        <div className="skeleton h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="safe-top px-5 pt-4">
      <header className="mb-6 stagger-item">
        <p className="text-text-secondary text-sm font-medium">
          {format(now, 'EEEE, MMMM d')}
        </p>
        <h1 className="text-2xl font-bold tracking-tight mt-1">
          PepDose
        </h1>
      </header>

      {nextDose ? (
        <div
          className="card-glass p-5 mb-5 stagger-item"
          style={{ animationDelay: '0.05s' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: nextDose.categoryColor + '22' }}
            >
              <Syringe className="w-5 h-5" style={{ color: nextDose.categoryColor }} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Next injection</p>
              <p className="text-lg font-semibold">{nextDose.peptideName}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-bold text-primary">{getTimeUntil(nextDose.time)}</p>
              <p className="text-xs text-text-muted">{nextDose.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span className="font-mono">{nextDose.dose} {nextDose.unit}</span>
            <span className="text-border">|</span>
            <span>{nextDose.route === 'subq' ? 'SubQ' : nextDose.route?.toUpperCase()}</span>
            {nextDose.suggestedSite && (
              <>
                <span className="text-border">|</span>
                <span>{nextDose.suggestedSite}</span>
              </>
            )}
          </div>
          {nextDose.isTitrationStepUp && (
            <div className="mt-3 flex items-center gap-2 text-warning text-xs font-medium bg-warning-dim rounded-lg px-3 py-2">
              <TrendingUp className="w-4 h-4" />
              Dose increase — titration step-up today
            </div>
          )}
        </div>
      ) : totalCount > 0 ? (
        <div
          className="card-glass p-5 mb-5 stagger-item text-center"
          style={{ animationDelay: '0.05s' }}
        >
          <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6 text-success" />
          </div>
          <p className="text-lg font-semibold">All done for today</p>
          <p className="text-sm text-text-muted mt-1">
            {completedCount}/{totalCount} doses logged
          </p>
        </div>
      ) : (
        <div
          className="card-glass p-5 mb-5 stagger-item text-center"
          style={{ animationDelay: '0.05s' }}
        >
          <p className="text-text-muted">No doses scheduled today</p>
          <p className="text-sm text-text-muted mt-1">Start a protocol to see your schedule</p>
        </div>
      )}

      {totalCount > 0 && (
        <div className="mb-5 stagger-item" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Today's schedule
            </h2>
            <span className="text-xs font-mono text-primary">
              {completedCount}/{totalCount}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-border overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-2">
            {todayDoses.map((dose, i) => {
              const isDone = dose.status === 'logged' || logged.has(dose.id);
              return (
                <button
                  key={dose.id}
                  className="card-glass w-full flex items-center gap-3 p-4 tap-target text-left stagger-item"
                  style={{ animationDelay: `${0.15 + i * 0.05}s` }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isDone ? '#22c55e' : dose.categoryColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${isDone ? 'line-through text-text-muted' : ''}`}>
                      {dose.peptideName}
                    </p>
                    <p className="text-xs text-text-muted font-mono">
                      {dose.dose} {dose.unit}
                    </p>
                  </div>
                  <span className={`text-xs font-mono ${isDone ? 'text-success' : 'text-text-secondary'}`}>
                    {isDone ? 'Logged' : dose.time}
                  </span>
                  {!isDone && <ChevronRight className="w-4 h-4 text-text-muted" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {protocols.length > 0 && (
        <div className="mb-5 stagger-item" style={{ animationDelay: '0.25s' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">
            Active protocols
          </h2>
          <div className="space-y-2">
            {protocols.map((proto) => {
              const mainPepId = proto.peptideIds[0];
              const pep = mainPepId ? getPeptideById(mainPepId) : undefined;
              const color = CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa';
              const currentWeek = Math.max(1, differenceInWeeks(new Date(), parseISO(proto.startDate)) + 1);
              const progress = (currentWeek / proto.durationWeeks) * 100;

              return (
                <button
                  key={proto.id}
                  onClick={() => navigate('/protocols', { state: { openId: proto.id } })}
                  className="card-glass p-4 w-full text-left tap-target block"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-sm">
                        {proto.name || pep?.name || mainPepId}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted font-mono">
                      Week {Math.min(currentWeek, proto.durationWeeks)}/{proto.durationWeeks}
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
