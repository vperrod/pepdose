import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import {
  Heart, Weight, Activity, Brain, Moon, Zap, FileText,
  TrendingUp, Plus, Ruler, ChevronDown,
} from 'lucide-react';
import { MEASUREMENT_KEYS, MEASUREMENT_LABELS, pruneMeasurements } from '../utils/measurements';
import { computeProgressSummary } from '../utils/progressSummary';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { saveHealthMarker, getHealthMarkers } from '../db/operations';
import { UserPicker } from '../components/UserPicker';
import { UserBadge } from '../components/UserBadge';
import { useOwnerFilter } from '../context/ViewFilterContext';
import { getLastOwner, setLastOwner, type UserName } from '../data/users';
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
  { key: 'waist', color: '#ec4899', label: 'Waist' },
  { key: 'chest', color: '#14b8a6', label: 'Chest' },
  { key: 'hips', color: '#a855f7', label: 'Hips' },
  { key: 'shoulders', color: '#f97316', label: 'Shoulders' },
  { key: 'neck', color: '#eab308', label: 'Neck' },
  { key: 'armL', color: '#84cc16', label: 'Arm (L)' },
  { key: 'armR', color: '#10b981', label: 'Arm (R)' },
  { key: 'thighL', color: '#06b6d4', label: 'Thigh (L)' },
  { key: 'thighR', color: '#0ea5e9', label: 'Thigh (R)' },
  { key: 'calfL', color: '#f43f5e', label: 'Calf (L)' },
  { key: 'calfR', color: '#d946ef', label: 'Calf (R)' },
] as const;

type ChartKey = typeof CHART_LINES[number]['key'];

const METRIC_UNITS: Record<ChartKey, string> = {
  weight: 'kg', bodyFatPct: '%', restingHR: 'bpm', fastingGlucose: 'mg/dL',
  mood: '/5', energy: '/5', sleepQuality: '/5',
  waist: 'cm', chest: 'cm', hips: 'cm', shoulders: 'cm', neck: 'cm',
  armL: 'cm', armR: 'cm', thighL: 'cm', thighR: 'cm', calfL: 'cm', calfR: 'cm',
};

const PROGRESS_METRICS = CHART_LINES.map(l => ({
  key: l.key, label: l.label, unit: METRIC_UNITS[l.key],
}));

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
  const [owner, setOwner] = useState<UserName>(getLastOwner());
  const applyOwnerFilter = useOwnerFilter();
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
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [showMeasurements, setShowMeasurements] = useState(false);

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
    setSleep(0); setSideEffects(''); setNotes(''); setMeasurements({});
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }

  const hasEntry = !!(
    weight || bodyFat || bpSys || bpDia || hr || glucose ||
    mood || energy || sleep || sideEffects.trim() || notes.trim() ||
    pruneMeasurements(measurements)
  );

  async function handleSave() {
    if (!hasEntry) return;
    setSaving(true);
    const prunedMeasurements = pruneMeasurements(measurements);
    const marker: Omit<HealthMarker, 'id' | 'createdAt'> = {
      owner,
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
      ...(prunedMeasurements && { measurements: prunedMeasurements }),
    };
    await saveHealthMarker(marker);
    setLastOwner(owner);
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
  const visibleMarkers = applyOwnerFilter(markers);
  const chartData = visibleMarkers
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
      ...m.measurements,
    }));
  const progress = computeProgressSummary(visibleMarkers, PROGRESS_METRICS, cutoff);

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
          {visibleMarkers.length} entries logged
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
          <UserPicker value={owner} onChange={setOwner} />
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

          {/* Body measurements */}
          <div className="card-glass overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMeasurements(v => !v)}
              aria-expanded={showMeasurements}
              className="w-full tap-target flex items-center justify-between px-4 py-3 text-sm font-medium"
            >
              <span className="flex items-center gap-1.5 text-text-secondary">
                <Ruler className="w-3.5 h-3.5" /> Body Measurements (cm)
              </span>
              <ChevronDown
                className={`w-4 h-4 text-text-muted transition-transform ${showMeasurements ? 'rotate-180' : ''}`}
              />
            </button>
            {showMeasurements && (
              <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                {MEASUREMENT_KEYS.map(key => (
                  <div key={key}>
                    <label
                      htmlFor={`m-${key}`}
                      className="text-xs text-text-muted font-medium mb-1.5 block"
                    >
                      {MEASUREMENT_LABELS[key]}
                    </label>
                    <input
                      id={`m-${key}`}
                      type="number"
                      step="0.1"
                      value={measurements[key] ?? ''}
                      onChange={e => setMeasurements(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="cm"
                      className="w-full bg-bg-raised border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
                    />
                  </div>
                ))}
              </div>
            )}
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
            disabled={saving || !hasEntry}
            className="w-full tap-target bg-primary text-white font-semibold rounded-xl py-3.5 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving...' : hasEntry ? 'Save Entry' : 'Enter a value to save'}
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

          {/* Progress summary */}
          {progress.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {progress.map(p => {
                const arrow = p.delta > 0 ? '↑' : p.delta < 0 ? '↓' : '→';
                return (
                  <div key={p.key} className="card-glass p-3">
                    <p className="text-xs text-text-muted font-medium">{p.label}</p>
                    <p className="text-sm font-mono mt-0.5">
                      {p.count > 1 ? `${p.first} → ${p.last}` : p.last}
                      <span className="text-text-muted"> {p.unit}</span>
                    </p>
                    {p.count > 1 && (
                      <p className="text-xs font-mono text-text-secondary mt-0.5">
                        {arrow} {p.delta > 0 ? '+' : ''}{p.delta} {p.unit} over {range}d
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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
          {visibleMarkers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs text-text-muted font-medium uppercase tracking-wider">
                Recent Entries
              </h3>
              {visibleMarkers.slice(-5).reverse().map(m => (
                <div key={m.id} className="card-glass p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 font-mono text-text-secondary text-xs">
                      {format(new Date(m.date), 'MMM d, yyyy')}
                      <UserBadge owner={m.owner} />
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
                  {m.measurements && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted font-mono mt-1">
                      {MEASUREMENT_KEYS.filter(k => m.measurements?.[k] != null).map(k => (
                        <span key={k}>{MEASUREMENT_LABELS[k]} {m.measurements![k]}cm</span>
                      ))}
                    </div>
                  )}
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
