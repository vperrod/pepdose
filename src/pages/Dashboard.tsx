import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { format, differenceInMinutes, differenceInHours, differenceInWeeks, parseISO } from 'date-fns';
import { Syringe, TrendingUp, ChevronRight, Zap, Flame } from 'lucide-react';
import { getScheduledDosesForDate, getProtocols, getDoseLogsForDate, getScheduledDosesForProtocols } from '../db/operations';
import { getPeptideById } from '../data/peptides';
import { scheduleReminders } from '../utils/notifications';
import { nextTitrationStep, type NextStep } from '../utils/titrationCoach';
import { adherenceStats } from '../utils/adherence';
import { DoseActionSheet } from '../components/DoseActionSheet';
import { AdhocLogSheet } from '../components/AdhocLogSheet';
import type { ScheduledDose, UserProtocol, DoseLog, ReconMix } from '../db/schema';
import { clicksForDose, formatClicks, penMlPerClick } from '../utils/penClicks';
import { withoutInactiveUpcoming } from '../utils/doseVisibility';
import { UserBadge } from '../components/UserBadge';
import { useOwnerFilter } from '../context/ViewFilterContext';
import { DisclaimerFooter } from '../components/DisclaimerFooter';

interface DashboardDose extends ScheduledDose {
  peptideName: string;
  categoryColor: string;
  recon?: ReconMix;
  penColor?: string;
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
  const [logsByDoseId, setLogsByDoseId] = useState<Map<string, DoseLog>>(new Map());
  const [adhocLogs, setAdhocLogs] = useState<DoseLog[]>([]);
  const [viewAdhocLog, setViewAdhocLog] = useState<DoseLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [allScheduled, setAllScheduled] = useState<ScheduledDose[]>([]);
  const [activeDose, setActiveDose] = useState<DashboardDose | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();

  useEffect(() => {
    async function load() {
      const [doses, protos, logs] = await Promise.all([
        getScheduledDosesForDate(today),
        getProtocols('active'),
        getDoseLogsForDate(today),
      ]);

      const activeIds = new Set(protos.map(p => p.id));
      const enriched: DashboardDose[] = withoutInactiveUpcoming(doses, activeIds).map(d => {
        const pep = getPeptideById(d.peptideId);
        const doseConfig = protos.find(p => p.id === d.protocolId)?.doses.find(x => x.peptideId === d.peptideId);
        return {
          ...d,
          peptideName: pep?.name ?? d.peptideId,
          categoryColor: CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa',
          recon: doseConfig?.recon,
          penColor: doseConfig?.penColor,
        };
      }).sort((a, b) => a.time.localeCompare(b.time));

      setTodayDoses(enriched);
      setProtocols(protos);
      setLogged(new Set(logs.map(l => l.scheduledDoseId).filter(Boolean) as string[]));
      setLogsByDoseId(new Map(
        logs.filter(l => l.scheduledDoseId).map(l => [l.scheduledDoseId!, l]),
      ));
      setAdhocLogs(logs.filter(l => !l.scheduledDoseId));
      setLoading(false);

      // Re-arm reminders whenever today's doses change (new log, edit, reload).
      void scheduleReminders();
    }
    load();
  }, [today, reloadKey]);

  useEffect(() => {
    (async () => {
      const active = await getProtocols('active');
      const allDoses = await getScheduledDosesForProtocols(active.map(p => p.id));
      setAllScheduled(allDoses);
    })();
  }, [reloadKey]);

  const applyOwnerFilter = useOwnerFilter();
  const adherence = useMemo(
    () => adherenceStats(applyOwnerFilter(allScheduled)),
    [applyOwnerFilter, allScheduled],
  );
  // Titration alerts are opt-in per protocol (UserProtocol.titrationAlerts).
  // Only owner-visible doses from a protocol that asked for them can raise the coach card.
  const coach = useMemo<NextStep | null>(() => {
    const alerting = new Set(
      applyOwnerFilter(protocols).filter(p => p.titrationAlerts).map(p => p.id),
    );
    if (!alerting.size) return null;
    return nextTitrationStep(
      applyOwnerFilter(allScheduled).filter(d => alerting.has(d.protocolId)),
      new Date(),
    );
  }, [applyOwnerFilter, protocols, allScheduled]);
  const visibleDoses = applyOwnerFilter(todayDoses);
  const visibleProtocols = applyOwnerFilter(protocols);
  // Protocols that opted into titration alerts — nothing announces a step-up
  // for the others, even though their schedule still steps up.
  const alertingProtocolIds = useMemo(
    () => new Set(protocols.filter(p => p.titrationAlerts).map(p => p.id)),
    [protocols],
  );
  const completedCount = visibleDoses.filter(d => d.status === 'logged' || logged.has(d.id)).length;
  const totalCount = visibleDoses.length;
  const visibleAdhoc = applyOwnerFilter(adhocLogs);
  const nextDose = visibleDoses.find(d => d.status === 'upcoming' && !logged.has(d.id));

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

      {(adherence.streak > 0 || adherence.due7 > 0) && (
        <div className="card-glass p-3 mb-4 flex items-center gap-3 stagger-item">
          <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
            <Flame className={`w-5 h-5 ${adherence.streak > 0 ? 'text-warning' : 'text-text-muted'}`} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">
              {adherence.streak > 0 ? `${adherence.streak}-day streak` : 'Start a streak'}
            </p>
            <p className="text-xs text-text-muted">
              {adherence.logged7}/{adherence.due7} logged this week
            </p>
          </div>
          {adherence.due7 > 0 && (
            <span className="font-mono text-sm font-bold text-primary">
              {Math.round((adherence.logged7 / adherence.due7) * 100)}%
            </span>
          )}
        </div>
      )}

      {nextDose ? (
        <button
          onClick={() => setActiveDose(nextDose)}
          className="card-glass p-5 mb-5 stagger-item w-full text-left tap-target block"
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
          {nextDose.isTitrationStepUp && alertingProtocolIds.has(nextDose.protocolId) && (
            <div className="mt-3 flex items-center gap-2 text-warning text-xs font-medium bg-warning-dim rounded-lg px-3 py-2">
              <TrendingUp className="w-4 h-4" />
              Dose increase — titration step-up today
            </div>
          )}
        </button>
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

      {coach && (
        <div className="card-glass p-4 mb-5 stagger-item" style={{ animationDelay: '0.08s' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-dim flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Titration coach</p>
              <p className="text-sm font-medium">
                Week {coach.weekNumber} — {getPeptideById(coach.peptideId)?.name ?? coach.peptideId}: your plan shows {coach.dose} {coach.unit}
              </p>
            </div>
            <p className="text-xs text-text-muted shrink-0">{format(parseISO(coach.date), 'EEE MMM d')}</p>
          </div>
        </div>
      )}

      {(totalCount > 0 || visibleAdhoc.length > 0) && (
        <div className="mb-5 stagger-item" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Today's schedule
            </h2>
            {totalCount > 0 && (
              <span className="text-xs font-mono text-primary">
                {completedCount}/{totalCount}
              </span>
            )}
          </div>
          {totalCount > 0 && (
            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          )}

          <div className="space-y-2">
            {visibleDoses.map((dose, i) => {
              const isDone = dose.status === 'logged' || logged.has(dose.id);
              const shownDose = logsByDoseId.get(dose.id)?.dose ?? dose.dose;
              const clicks = formatClicks(clicksForDose(shownDose, dose.unit, dose.recon, penMlPerClick()));
              return (
                <button
                  key={dose.id}
                  onClick={() => setActiveDose(dose)}
                  className="card-glass w-full flex items-center gap-3 p-4 tap-target text-left stagger-item"
                  style={{ animationDelay: `${0.15 + i * 0.05}s` }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isDone ? '#22c55e' : dose.categoryColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium text-sm ${isDone ? 'line-through text-text-muted' : ''}`}>
                        {dose.peptideName}
                      </p>
                      <UserBadge owner={dose.owner} />
                    </div>
                    <p className="text-xs text-text-muted font-mono">
                      {shownDose} {dose.unit}
                    </p>
                    {clicks && <p className="text-[11px] text-primary font-mono">{clicks}</p>}
                    {dose.penColor && <p className="text-[11px] text-text-muted">Pen: {dose.penColor}</p>}
                  </div>
                  <span className={`text-xs font-mono ${isDone ? 'text-success' : 'text-text-secondary'}`}>
                    {isDone ? 'Logged' : dose.time}
                  </span>
                  {!isDone && <ChevronRight className="w-4 h-4 text-text-muted" />}
                </button>
              );
            })}
            {visibleAdhoc.map(log => (
              <button key={log.id} onClick={() => setViewAdhocLog(log)} className="card-glass w-full flex items-center gap-3 p-4 tap-target text-left">
                <div className="w-2 h-2 rounded-full shrink-0 bg-secondary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-text-muted">
                      {getPeptideById(log.peptideId)?.name ?? log.peptideId}
                    </p>
                    <UserBadge owner={log.owner} />
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary/15 text-secondary">ad-hoc</span>
                  </div>
                  <p className="text-xs text-text-muted font-mono">{log.dose} {log.unit}</p>
                </div>
                <span className="text-xs font-mono text-success">{log.time}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {visibleProtocols.length > 0 && (
        <div className="mb-5 stagger-item" style={{ animationDelay: '0.25s' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">
            Active protocols
          </h2>
          <div className="space-y-2">
            {visibleProtocols.map((proto) => {
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
                      <UserBadge owner={proto.owner} />
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

      {coach && <DisclaimerFooter />}

      {viewAdhocLog && (
        <AdhocLogSheet
          log={viewAdhocLog}
          onClose={() => setViewAdhocLog(null)}
          onDeleted={() => setReloadKey(k => k + 1)}
        />
      )}

      {activeDose && (
        <DoseActionSheet
          dose={{ ...activeDose, color: activeDose.categoryColor }}
          log={logsByDoseId.get(activeDose.id)}
          onClose={() => setActiveDose(null)}
          onUpdated={() => { setActiveDose(null); setReloadKey(k => k + 1); }}
        />
      )}
    </div>
  );
}
