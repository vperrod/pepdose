import { useState, useEffect, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { parseISO, subHours, format } from 'date-fns';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceDot,
} from 'recharts';
import { getAllDoseLogs } from '../db/operations';
import { getPeptideById } from '../data/peptides';
import type { DoseLog } from '../db/schema';

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

// ponytail: 200 points is plenty for a smooth curve on mobile
const CHART_POINTS = 200;

function doseToTimestamp(log: DoseLog): number {
  return parseISO(`${log.date}T${log.time}`).getTime();
}

function computeLevel(doseAmount: number, halfLifeHours: number, hoursElapsed: number): number {
  if (hoursElapsed < 0) return 0;
  return doseAmount * Math.pow(0.5, hoursElapsed / halfLifeHours);
}

export function HalfLife() {
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowIdx, setWindowIdx] = useState(1); // default 7d

  useEffect(() => {
    getAllDoseLogs().then(l => { setLogs(l); setLoading(false); });
  }, []);

  const window = WINDOWS[windowIdx];
  const now = Date.now();
  const windowStart = subHours(now, window.hours).getTime();

  // group logs by peptideId, only keep logs that could still contribute
  const { peptideGroups, injectionMarkers } = useMemo(() => {
    const groups: Record<string, { logs: DoseLog[]; halfLife: number; color: string; name: string }> = {};
    const markers: { time: number; peptideId: string; dose: number; color: string }[] = [];

    for (const log of logs) {
      const pep = getPeptideById(log.peptideId);
      if (!pep) continue;

      const ts = doseToTimestamp(log);
      // include if the dose was injected before window end and could still have >0.1% level at window start
      // ponytail: generous cutoff — 10 half-lives means <0.1% remaining
      const maxDecayHours = pep.halfLifeHours * 10;
      if (ts + maxDecayHours * 3600_000 < windowStart) continue;

      if (!groups[log.peptideId]) {
        groups[log.peptideId] = {
          logs: [],
          halfLife: pep.halfLifeHours,
          color: CATEGORY_COLORS[pep.category] ?? '#00d4aa',
          name: pep.name,
        };
      }
      groups[log.peptideId].logs.push(log);

      if (ts >= windowStart && ts <= now) {
        markers.push({ time: ts, peptideId: log.peptideId, dose: log.dose, color: groups[log.peptideId].color });
      }
    }

    return { peptideGroups: groups, injectionMarkers: markers };
  }, [logs, windowStart, now]);

  const peptideIds = Object.keys(peptideGroups);

  // build chart data: array of { time, [peptideId]: level% }
  const chartData = useMemo(() => {
    if (peptideIds.length === 0) return [];

    const step = (now - windowStart) / CHART_POINTS;
    const points: Record<string, unknown>[] = [];

    for (let i = 0; i <= CHART_POINTS; i++) {
      const t = windowStart + i * step;
      const point: Record<string, unknown> = { time: t };

      for (const pid of peptideIds) {
        const g = peptideGroups[pid];
        let total = 0;
        for (const log of g.logs) {
          const elapsed = (t - doseToTimestamp(log)) / 3600_000;
          total += computeLevel(log.dose, g.halfLife, elapsed);
        }
        point[pid] = Math.round(total * 100) / 100;
      }
      points.push(point);
    }

    // normalize to percentage of peak
    const peaks: Record<string, number> = {};
    for (const pid of peptideIds) {
      peaks[pid] = Math.max(...points.map(p => (p[pid] as number) || 0), 0.001);
    }
    for (const p of points) {
      for (const pid of peptideIds) {
        p[pid] = Math.round(((p[pid] as number) / peaks[pid]) * 10000) / 100;
      }
    }

    return points;
  }, [peptideIds, peptideGroups, windowStart, now]);

  if (loading) {
    return <div className="safe-top px-5 pt-4"><p className="text-text-muted">Loading...</p></div>;
  }

  if (logs.length === 0) {
    return (
      <div className="safe-top px-5 pt-4 flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="w-16 h-16 rounded-2xl bg-secondary-dim flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-secondary" />
        </div>
        <p className="font-semibold text-lg mb-1">No decay data yet</p>
        <p className="text-sm text-text-muted text-center">Log doses to see decay curves</p>
      </div>
    );
  }

  const xTickFormat = window.hours <= 24
    ? (t: number) => format(new Date(t), 'HH:mm')
    : window.hours <= 7 * 24
      ? (t: number) => format(new Date(t), 'EEE')
      : (t: number) => format(new Date(t), 'MMM d');

  return (
    <div className="safe-top px-5 pt-4 pb-24">
      <h1 className="text-xl font-bold mb-1 stagger-item">Half-Life Decay</h1>
      <p className="text-sm text-text-muted mb-4 stagger-item">Estimated compound levels over time</p>

      {/* time window selector */}
      <div className="flex gap-2 mb-5 stagger-item" style={{ animationDelay: '0.05s' }}>
        {WINDOWS.map((w, i) => (
          <button
            key={w.label}
            onClick={() => setWindowIdx(i)}
            className={`px-4 py-2 rounded-xl text-sm font-medium tap-target transition-colors ${
              i === windowIdx
                ? 'bg-secondary text-white'
                : 'card-glass text-text-muted'
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
                  <stop offset="0%" stopColor={peptideGroups[pid].color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={peptideGroups[pid].color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="time"
              type="number"
              domain={[windowStart, now]}
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
              formatter={(value: number | string, name: string) => [
                `${Number(value).toFixed(1)}%`,
                peptideGroups[name]?.name ?? name,
              ]}
            />
            {peptideIds.map(pid => (
              <Area
                key={pid}
                type="monotone"
                dataKey={pid}
                stroke={peptideGroups[pid].color}
                strokeWidth={2}
                fill={`url(#grad-${pid})`}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            {injectionMarkers.map((m, i) => {
              // find the Y value at injection time for the right peptide
              const closest = chartData.reduce((best, p) =>
                Math.abs((p.time as number) - m.time) < Math.abs((best.time as number) - m.time) ? p : best
              , chartData[0]);
              return (
                <ReferenceDot
                  key={`inj-${i}`}
                  x={m.time}
                  y={(closest?.[m.peptideId] as number) ?? 100}
                  r={4}
                  fill={m.color}
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
        {peptideIds.map(pid => {
          const g = peptideGroups[pid];
          return (
            <div key={pid} className="flex items-center gap-3 text-sm">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
              <span className="font-medium">{g.name}</span>
              <span className="text-text-muted font-mono text-xs">t½ {g.halfLife}h</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
