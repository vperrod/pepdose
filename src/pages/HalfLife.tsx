import { useState, useEffect, useMemo } from 'react';
import { Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot,
} from 'recharts';
import { getDoseLogsSince, getScheduledDosesInRange } from '../db/operations';
import { getPeptideById } from '../data/peptides';
import type { DoseLog, ScheduledDose } from '../db/schema';
import {
  sampleLevels, currentStatus, type PeptideSeries, type DoseEvent,
} from '../utils/activeLevels';
import { useOwnerFilter } from '../context/ViewFilterContext';
import { DisclaimerFooter } from '../components/DisclaimerFooter';

const CATEGORY_COLORS: Record<string, string> = {
  healing: '#22c55e',
  glp1: '#6366f1',
  gh_secretagogue: '#f59e0b',
  fat_loss: '#ef4444',
  cosmetic: '#ec4899',
  sexual_health: '#a855f7',
  nootropic: '#06b6d4',
};

const WINDOWS = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 7 * 24 },
  { label: '30d', hours: 30 * 24 },
] as const;

const CHART_POINTS = 220;
const PROJECT_MAX_HOURS = 10 * 24; // cap the forward projection
// 30d max window + 10 half-lives of the longest-acting peptide (216h) ≈ 120d
const DOSE_LOG_LOOKBACK_DAYS = 120;

function eventTs(date: string, time: string): number {
  return new Date(`${date}T${time || '08:00'}`).getTime();
}

function relTime(ms: number): string {
  const abs = Math.abs(ms);
  const h = abs / 3_600_000;
  if (h < 1) return `${Math.round(abs / 60_000)}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function HalfLife() {
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowIdx, setWindowIdx] = useState(1); // default 7d

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const end = format(new Date(Date.now() + PROJECT_MAX_HOURS * 3_600_000), 'yyyy-MM-dd');
    Promise.all([getDoseLogsSince(DOSE_LOG_LOOKBACK_DAYS), getScheduledDosesInRange(today, end)]).then(([l, s]) => {
      setLogs(l);
      setScheduled(s.filter(d => d.status === 'upcoming'));
      setLoading(false);
    });
  }, []);

  const activeWindow = WINDOWS[windowIdx];
  // Minute-granular so the memos below aren't invalidated by every render's fresh Date.now().
  const now = Math.floor(Date.now() / 60_000) * 60_000;
  const windowStart = now - activeWindow.hours * 3_600_000;
  const applyOwnerFilter = useOwnerFilter();
  const ownedLogs = useMemo(() => applyOwnerFilter(logs), [applyOwnerFilter, logs]);
  const ownedScheduled = useMemo(() => applyOwnerFilter(scheduled), [applyOwnerFilter, scheduled]);

  // Build per-peptide series from past logs + upcoming scheduled doses (projection).
  const { seriesList, meta, projectionEnd } = useMemo(() => {
    const byId: Record<string, { series: PeptideSeries; color: string; name: string }> = {};

    const ensure = (peptideId: string) => {
      if (byId[peptideId]) return byId[peptideId];
      const pep = getPeptideById(peptideId);
      if (!pep) return null;
      byId[peptideId] = {
        series: { peptideId, halfLifeHours: pep.halfLifeHours, events: [] },
        color: CATEGORY_COLORS[pep.category] ?? '#00d4aa',
        name: pep.name,
      };
      return byId[peptideId];
    };

    for (const log of ownedLogs) {
      const pep = getPeptideById(log.peptideId);
      if (!pep) continue;
      const ts = eventTs(log.date, log.time);
      // skip logs so old they can't contribute at window start (10 half-lives ≈ <0.1%)
      if (ts + pep.halfLifeHours * 10 * 3_600_000 < windowStart) continue;
      const entry = ensure(log.peptideId);
      entry?.series.events.push({ ts, dose: log.dose, future: false } as DoseEvent);
    }

    // Only project peptides that already have logged history in view.
    let soonestNext = Infinity;
    for (const d of ownedScheduled) {
      if (!byId[d.peptideId]) continue;
      const ts = eventTs(d.date, d.time);
      if (ts <= now) continue;
      byId[d.peptideId].series.events.push({ ts, dose: d.dose, future: true });
      soonestNext = Math.min(soonestNext, ts);
    }

    // Project forward to just past the next dose (so the trough + next rise show),
    // clamped so a distant next dose doesn't flatten the chart.
    const projHours = soonestNext === Infinity
      ? 24
      : Math.min(PROJECT_MAX_HOURS, Math.max(24, (soonestNext - now) / 3_600_000 + 36));

    return {
      seriesList: Object.values(byId).map(v => v.series),
      meta: byId,
      projectionEnd: now + projHours * 3_600_000,
    };
  }, [ownedLogs, ownedScheduled, windowStart, now]);

  const peptideIds = seriesList.map(s => s.peptideId);

  const { chartData, statuses } = useMemo(() => {
    if (seriesList.length === 0) return { chartData: [], statuses: {} as Record<string, ReturnType<typeof currentStatus>> };

    const { rows, peaks } = sampleLevels(seriesList, windowStart, projectionEnd, CHART_POINTS);

    // normalize each peptide to % of its own peak
    const norm = rows.map(r => {
      const p: Record<string, number> = { time: r.time };
      for (const pid of peptideIds) {
        const peak = peaks[pid] || 1;
        p[pid] = Math.round(((r[pid] ?? 0) / peak) * 1000) / 10;
      }
      return p;
    });

    const statuses: Record<string, ReturnType<typeof currentStatus>> = {};
    for (const s of seriesList) statuses[s.peptideId] = currentStatus(s, now, peaks[s.peptideId] || 0);

    return { chartData: norm, statuses };
  }, [seriesList, peptideIds, windowStart, projectionEnd, now]);

  if (loading) {
    return <div className="safe-top px-5 pt-4"><p className="text-text-muted">Loading...</p></div>;
  }

  if (peptideIds.length === 0) {
    return (
      <div className="safe-top px-5 pt-4 flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="w-16 h-16 rounded-2xl bg-secondary-dim flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-secondary" />
        </div>
        <p className="font-semibold text-lg mb-1">No active levels yet</p>
        <p className="text-sm text-text-muted text-center">Log doses to see how much is in your system.</p>
      </div>
    );
  }

  const xTickFormat = activeWindow.hours <= 24
    ? (t: number) => format(new Date(t), 'HH:mm')
    : activeWindow.hours <= 7 * 24
      ? (t: number) => format(new Date(t), 'EEE')
      : (t: number) => format(new Date(t), 'MMM d');

  return (
    <div className="safe-top px-5 pt-4 pb-24">
      <h1 className="text-xl font-bold mb-1 stagger-item">Active Levels</h1>
      <p className="text-sm text-text-muted mb-4 stagger-item">
        Estimated amount in your system, from your logged doses. Right of the dashed line is projected from your schedule.
      </p>

      {/* Current status per peptide */}
      <div className="space-y-2 mb-5 stagger-item" style={{ animationDelay: '0.04s' }}>
        {peptideIds.map(pid => {
          const g = meta[pid];
          const s = statuses[pid];
          if (!s) return null;
          return (
            <div key={pid} className="card-glass p-3 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{g.name}</p>
                <p className="text-xs text-text-muted">
                  {s.lastDoseTs ? `last dose ${relTime(now - s.lastDoseTs)} ago` : 'no recent dose'}
                  {s.nextDoseTs ? ` · next in ${relTime(s.nextDoseTs - now)}` : ''}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  {s.rising
                    ? <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                    : <ArrowDownRight className="w-3.5 h-3.5 text-text-muted" />}
                  <span className="font-mono font-bold text-sm" style={{ color: g.color }}>{Math.round(s.pctOfPeak)}%</span>
                </div>
                <p className="text-[10px] text-text-muted">of recent peak</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* time window selector */}
      <div className="flex gap-2 mb-4 stagger-item" style={{ animationDelay: '0.05s' }}>
        {WINDOWS.map((w, i) => (
          <button
            key={w.label}
            onClick={() => setWindowIdx(i)}
            className={`px-4 py-2 rounded-xl text-sm font-medium tap-target transition-colors ${
              i === windowIdx ? 'bg-secondary text-white' : 'card-glass text-text-muted'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* chart */}
      <div className="card-glass p-3 stagger-item" style={{ animationDelay: '0.1s' }}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <defs>
              {peptideIds.map(pid => (
                <linearGradient key={pid} id={`grad-${pid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta[pid].color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={meta[pid].color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="time"
              type="number"
              domain={[windowStart, projectionEnd]}
              tickFormatter={xTickFormat}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: '#1e2a42' }}
              tickLine={{ stroke: '#1e2a42' }}
              tickCount={5}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#1e2a42' }}
              tickLine={{ stroke: '#1e2a42' }}
              tickFormatter={v => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#131a2b',
                border: '1px solid #1e2a42',
                borderRadius: 12,
                fontSize: 12,
                fontFamily: 'monospace',
              }}
              labelFormatter={t => format(new Date(t as number), 'MMM d, HH:mm')}
              formatter={((value: unknown, name: string) => [
                `${Number(value ?? 0).toFixed(1)}%`,
                meta[name]?.name ?? name,
              ]) as never}
            />
            {peptideIds.map(pid => (
              <Area
                key={pid}
                type="monotone"
                dataKey={pid}
                stroke={meta[pid].color}
                strokeWidth={2}
                fill={`url(#grad-${pid})`}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            <ReferenceLine x={now} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
            {peptideIds.map(pid => {
              const s = statuses[pid];
              if (!s) return null;
              return (
                <ReferenceDot
                  key={`now-${pid}`}
                  x={now}
                  y={Math.round(s.pctOfPeak)}
                  r={4}
                  fill={meta[pid].color}
                  stroke="#131a2b"
                  strokeWidth={2}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* legend */}
      <div className="mt-4 space-y-2 stagger-item" style={{ animationDelay: '0.15s' }}>
        {peptideIds.map(pid => (
          <div key={pid} className="flex items-center gap-3 text-sm">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: meta[pid].color }} />
            <span className="font-medium">{meta[pid].name}</span>
            <span className="text-text-muted font-mono text-xs">t½ {meta[pid].series.halfLifeHours}h</span>
          </div>
        ))}
      </div>
      <DisclaimerFooter />
    </div>
  );
}
