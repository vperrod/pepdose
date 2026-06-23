import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import {
  Heart, Weight, Activity, Brain, Moon, Smile, Zap, FileText,
  TrendingUp, Plus, ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { saveHealthMarker, getHealthMarkers } from '../db/operations';
import type { HealthMarker } from '../db/schema';

const MOOD_EMOJI = ['', '\u{1F622}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F604}'];
const ENERGY_EMOJI = ['', '\u{1F6AB}', '\u{1F422}', '\u{26A1}', '\u{1F525}', '\u{1F680}'];
const SLEEP_EMOJI = ['', '\u{1F62B}', '\u{1F634}', '\u{1F4A4}', '\u{1F319}', '\u{2B50}'];

const CHART_LINES = [
  { key: 'weight', color: '#00d4aa', label: 'Weight' },
  { key: 'bodyFatPct', color: '#6366f1', label: 'Body Fat %' },
  { key: 'restingHR', color: '#ef4444', label: 'Resting HR' },
  { key: 'fastingGlucose', color: '#f59e0b', label: 'Glucose' },
  { key: 'mood', color: '#22c55e', label: 'Mood' },
  { key: 'energy', color: '#8b5cf6', label: 'Energy' },
  { key: 'sleepQuality', color: '#3b82f6', label: 'Sleep' },
] as const;

type ChartKey = typeof CHART_LINES[number]['key'];

function EmojiScale({ value, onChange, emojis, label }: {
  value: number; onChange: (v: number) => void; emojis: string[]; label: string;
}) {
  return (
    <div>
      <label className="text-xs text-text-muted font-medium mb-2 block">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`tap-target flex-1 h-11 rounded-lg text-xl transition-all ${
              value === n
                ? 'bg-primary/20 ring-2 ring-primary/40 scale-110'
                : 'bg-bg-raised hover:bg-card'
            }`}
            aria-label={`${label} ${n} of 5`}
          >
            {emojis[n]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ponytail: single component, no router/tab abstraction
export function HealthMarkers() {
  const [view, setView] = useState<'form' | 'trends'>('form');
  const [markers, setMarkers] = useState<HealthMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state — flat, no form library needed
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [hr, setHr] = useState('');
  const [glucose, setGlucose] = useState('');
  const [mood, setMood] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [sleep, setSleep] = useState(0);
  const [sideEffects, setSideEffects] = useState('');
  const [notes, setNotes] = useState('');

  // Chart filter
  const [activeLines, setActiveLines] = useState<Set<ChartKey>>(
    new Set(['weight', 'mood', 'energy'])
  );
  const [range, setRange] = useState(30);

  const load = useCallback(async () => {
    const data = await getHealthMarkers();
    setMarkers(data.sort((a, b) => a.date.localeCompare(b.date)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setWeight(''); setBodyFat(''); setBpSys(''); setBpDia('');
    setHr(''); setGlucose(''); setMood(0); setEnergy(0);
    setSleep(0); setSideEffects(''); setNotes('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }

  async function handleSave() {
    setSaving(true);
    const marker: Omit<HealthMarker, 'id' | 'createdAt'> = {
      date,
      ...(weight && { weight: parseFloat(weight) }),
      ...(bodyFat && { bodyFatPct: parseFloat(bodyFat) }),
      ...(bpSys && { bloodPressureSys: parseInt(bpSys) }),
      ...(bpDia && { bloodPressureDia: parseInt(bpDia) }),
      ...(hr && { restingHR: parseInt(hr) }),
      ...(glucose && { fastingGlucose: parseFloat(glucose) }),
      ...(mood && { mood }),
      ...(energy && { energy }),
      ...(sleep && { sleepQuality: sleep }),
      ...(sideEffects && { sideEffects }),
      ...(notes && { notes }),
    };
    await saveHealthMarker(marker);
    resetForm();
    await load();
    setSaving(false);
  }

  function toggleLine(key: ChartKey) {
    setActiveLines(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const cutoff = format(subDays(new Date(), range), 'yyyy-MM-dd');
  const chartData = markers
    .filter(m => m.date >= cutoff)
    .map(m => ({
      date: format(new Date(m.date), 'MMM d'),
      weight: m.weight,
      bodyFatPct: m.bodyFatPct,
      restingHR: m.restingHR,
      fastingGlucose: m.fastingGlucose,
      mood: m.mood,
      energy: m.energy,
      sleepQuality: m.sleepQuality,
    }));

  if (loading) {
    return (
      <div className="safe-top px-5 pt-4 pb-28">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="skeleton h-24 w-full mb-3" />
        <div className="skeleton h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="safe-top px-5 pt-4 pb-28">
      <header className="mb-5 stagger-item">
        <h1 className="text-2xl font-bold tracking-tight">Health Markers</h1>
        <p className="text-text-secondary text-sm mt-1">
          {markers.length} entries logged
        </p>
      </header>

      {/* Toggle */}
      <div className="flex gap-2 mb-5 stagger-item">
        <button
          onClick={() => setView('form')}
          className={`flex-1 tap-target rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            view === 'form'
              ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
              : 'bg-bg-raised text-text-muted'
          }`}
        >
          <Plus className="w-4 h-4" /> Log Entry
        </button>
        <button
          onClick={() => setView('trends')}
          className={`flex-1 tap-target rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            view === 'trends'
              ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
              : 'bg-bg-raised text-text-muted'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Trends
        </button>
      </div>

      {view === 'form' ? (
        <div className="space-y-4 stagger-item">
          {/* Date */}
          <div>
            <label className="text-xs text-text-muted font-medium mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
            />
          </div>

          {/* Weight + Body Fat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted font-medium mb-1.5 flex items-center gap-1.5">
                <Weight className="w-3.5 h-3.5" /> Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="82.5"
                className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium mb-1.5 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Body Fat %
              </label>
              <input
                type="number"
                step="0.1"
                value={bodyFat}
                onChange={e => setBodyFat(e.target.value)}
                placeholder="18.0"
                className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Blood Pressure */}
          <div>
            <label className="text-xs text-text-muted font-medium mb-1.5 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" /> Blood Pressure
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={bpSys}
                onChange={e => setBpSys(e.target.value)}
                placeholder="Systolic"
                className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
              />
              <input
                type="number"
                value={bpDia}
                onChange={e => setBpDia(e.target.value)}
                placeholder="Diastolic"
                className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* HR + Glucose */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted font-medium mb-1.5 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-red-400" /> Resting HR
              </label>
              <input
                type="number"
                value={hr}
                onChange={e => setHr(e.target.value)}
                placeholder="62"
                className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium mb-1.5 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Fasting Glucose
              </label>
              <input
                type="number"
                step="0.1"
                value={glucose}
                onChange={e => setGlucose(e.target.value)}
                placeholder="95"
                className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Emoji scales */}
          <div className="card-glass p-4 space-y-4">
            <EmojiScale value={mood} onChange={setMood} emojis={MOOD_EMOJI} label="Mood" />
            <EmojiScale value={energy} onChange={setEnergy} emojis={ENERGY_EMOJI} label="Energy" />
            <EmojiScale value={sleep} onChange={setSleep} emojis={SLEEP_EMOJI} label="Sleep Quality" />
          </div>

          {/* Side Effects */}
          <div>
            <label className="text-xs text-text-muted font-medium mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Side Effects
            </label>
            <textarea
              value={sideEffects}
              onChange={e => setSideEffects(e.target.value)}
              placeholder="Nausea, headache, injection site redness..."
              rows={2}
              className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-text-muted font-medium mb-1.5 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="General observations..."
              rows={2}
              className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none resize-none"
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full tap-target bg-primary text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      ) : (
        <div className="space-y-4 stagger-item">
          {/* Range selector */}
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`flex-1 tap-target rounded-lg py-2 text-xs font-medium transition-all ${
                  range === d
                    ? 'bg-primary/20 text-primary'
                    : 'bg-bg-raised text-text-muted'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Line toggles */}
          <div className="flex flex-wrap gap-2">
            {CHART_LINES.map(l => (
              <button
                key={l.key}
                onClick={() => toggleLine(l.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeLines.has(l.key)
                    ? 'ring-1 ring-current'
                    : 'opacity-40'
                }`}
                style={{ color: l.color, backgroundColor: l.color + '18' }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          {chartData.length > 0 ? (
            <div className="card-glass p-4">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#1e2a42" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#131a2b',
                      border: '1px solid #1e2a42',
                      borderRadius: '0.75rem',
                      fontSize: '0.75rem',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                  />
                  {CHART_LINES.filter(l => activeLines.has(l.key)).map(l => (
                    <Line
                      key={l.key}
                      type="monotone"
                      dataKey={l.key}
                      stroke={l.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: l.color }}
                      connectNulls
                      name={l.label}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="card-glass p-8 text-center text-text-muted text-sm">
              <Moon className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No data in this range. Log some entries first.
            </div>
          )}

          {/* Recent entries */}
          {markers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs text-text-muted font-medium uppercase tracking-wider">
                Recent Entries
              </h3>
              {markers.slice(-5).reverse().map(m => (
                <div key={m.id} className="card-glass p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-text-secondary text-xs">
                      {format(new Date(m.date), 'MMM d, yyyy')}
                    </span>
                    <div className="flex gap-1 text-base">
                      {m.mood ? MOOD_EMOJI[m.mood] : null}
                      {m.energy ? ENERGY_EMOJI[m.energy] : null}
                      {m.sleepQuality ? SLEEP_EMOJI[m.sleepQuality] : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-muted font-mono">
                    {m.weight != null && <span>{m.weight} kg</span>}
                    {m.bodyFatPct != null && <span>{m.bodyFatPct}% bf</span>}
                    {m.bloodPressureSys != null && <span>{m.bloodPressureSys}/{m.bloodPressureDia} mmHg</span>}
                    {m.restingHR != null && <span>{m.restingHR} bpm</span>}
                    {m.fastingGlucose != null && <span>{m.fastingGlucose} mg/dL</span>}
                  </div>
                  {m.sideEffects && (
                    <p className="text-xs text-amber-400/70 mt-1">{m.sideEffects}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
