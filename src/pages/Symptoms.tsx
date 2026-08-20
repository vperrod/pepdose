import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Activity } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { getAllDoseLogs, getScheduledDosesInRange } from '../db/operations';
import type { DoseLog, ScheduledDose } from '../db/schema';
import { symptomTrends } from '../utils/symptomTrends';
import { useOwnerFilter } from '../context/ViewFilterContext';

const PALETTE = ['#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#ec4899', '#06b6d4', '#a855f7', '#84cc16'];

export function Symptoms() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledDose[]>([]);
  const [loading, setLoading] = useState(true);
  const applyOwnerFilter = useOwnerFilter();

  useEffect(() => {
    getAllDoseLogs().then((l) => {
      setLogs(l);
      // Step-up markers only ever land on a date this chart already has a
      // logged dose for (see stepUps below) — so there's no need to pull
      // every scheduled dose ever created, just the ones inside the actual
      // logged date span.
      if (l.length === 0) {
        setScheduled([]);
        setLoading(false);
        return;
      }
      const dates = l.map((log) => log.date).sort();
      getScheduledDosesInRange(dates[0], dates[dates.length - 1]).then((s) => {
        setScheduled(s);
        setLoading(false);
      });
    });
  }, []);

  const visibleLogs = applyOwnerFilter(logs);
  const trends = useMemo(() => symptomTrends(visibleLogs), [visibleLogs]);
  const topNames = trends.slice(0, 6).map(t => t.name);
  const colorFor = (name: string) => PALETTE[topNames.indexOf(name) % PALETTE.length];

  // Build date-keyed chart rows across the top symptoms.
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const t of trends) {
      if (!topNames.includes(t.name)) continue;
      for (const p of t.points) {
        const row = byDate.get(p.date) ?? { date: p.date };
        row[t.name] = p.severity;
        byDate.set(p.date, row);
      }
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [trends, topNames]);

  // Titration step-up dates → reference lines (the "did the step-up spike symptoms?" view).
  const stepUps = useMemo(() => {
    const seen = new Set<string>();
    const out: { date: string; label: string }[] = [];
    for (const d of applyOwnerFilter(scheduled)) {
      if (!d.isTitrationStepUp) continue;
      const key = `${d.date}-${d.peptideId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ date: d.date, label: `${d.dose}${d.unit}` });
    }
    return out.filter(su => chartData.some(r => r.date === su.date));
  }, [scheduled, applyOwnerFilter, chartData]);

  if (loading) {
    return <div className="safe-top px-5 pt-4"><p className="text-text-muted">Loading...</p></div>;
  }

  return (
    <div className="safe-top px-5 pt-4 pb-24">
      <div className="flex items-center gap-3 mb-5 stagger-item">
        <button onClick={() => navigate(-1)} className="tap-target p-2 -ml-2" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Symptoms</h1>
      </div>

      {trends.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '55vh' }}>
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <p className="font-semibold text-lg mb-1">No symptoms logged yet</p>
          <p className="text-sm text-text-muted max-w-xs">
            When you log a dose, add how you're feeling (nausea, fatigue, heart rate…) with a severity.
            They'll chart here against your dose timeline.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-text-muted mb-4 stagger-item">
            Severity over time. Dashed lines mark titration step-ups — watch whether symptoms spike after a dose increase.
          </p>

          {/* Chart */}
          <div className="card-glass p-3 mb-5 stagger-item" style={{ animationDelay: '0.05s' }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="#1e2a42" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#1e2a42' }}
                  tickLine={{ stroke: '#1e2a42' }}
                  tickFormatter={d => String(d).slice(5)}
                  minTickGap={20}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#1e2a42' }}
                  tickLine={{ stroke: '#1e2a42' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#131a2b', border: '1px solid #1e2a42', borderRadius: 12, fontSize: 12 }}
                />
                {stepUps.map((su, i) => (
                  <ReferenceLine key={i} x={su.date} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
                ))}
                {topNames.map(name => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={colorFor(name)}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Per-symptom summary */}
          <div className="space-y-2 stagger-item" style={{ animationDelay: '0.1s' }}>
            {trends.map(t => (
              <div key={t.name} className="card-glass p-3 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: topNames.includes(t.name) ? colorFor(t.name) : '#475569' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{t.name}</p>
                  <p className="text-xs text-text-muted">logged {t.count}×</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold" style={{ color: t.avgSeverity >= 7 ? '#ef4444' : t.avgSeverity >= 4 ? '#f59e0b' : '#22c55e' }}>
                    {t.avgSeverity.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-text-muted">avg · max {t.maxSeverity}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
