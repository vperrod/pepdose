import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addWeeks } from 'date-fns';
import {
  ArrowLeft, ArrowRight, Check, Beaker, CalendarDays,
  Syringe, TrendingUp, Zap,
} from 'lucide-react';
import { PEPTIDES, getPeptideById, CATEGORY_LABELS, type Peptide, type FrequencyType, type TimeOfDay } from '../data/peptides';
import { PROTOCOL_TEMPLATES, type ProtocolTemplate } from '../data/protocols';
import { getStackWarnings } from '../data/stackingRules';
import { generateSchedule } from '../utils/scheduleEngine';
import { saveProtocol, saveScheduledDoses } from '../db/operations';

type Step = 'select' | 'configure' | 'review';

const CATEGORY_COLORS: Record<string, string> = {
  healing: '#22c55e',
  glp1: '#6366f1',
  gh_secretagogue: '#f59e0b',
  fat_loss: '#ef4444',
  cosmetic: '#ec4899',
  sexual_health: '#a855f7',
  nootropic: '#06b6d4',
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Every day',
  eod: 'Every other day',
  weekly: 'Once per week',
  biweekly: 'Every 2 weeks',
  custom: 'Custom interval',
};

const TIME_LABELS: Record<string, string> = {
  morning_fasting: 'Morning (fasting)',
  morning: 'Morning',
  evening: 'Evening',
  pre_bed: 'Before bed',
  before_activity: 'Before activity',
  any: 'Any time',
};

interface PeptideConfig {
  peptideId: string;
  dose: number;
  unit: 'mcg' | 'mg';
  frequency: FrequencyType;
  customFrequencyDays?: number;
  timesPerDay: number;
  timeOfDay: TimeOfDay;
}

export function NewProtocol() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('select');
  const [protocolName, setProtocolName] = useState('');
  const [peptideConfigs, setPeptideConfigs] = useState<PeptideConfig[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredPeptides = useMemo(() => {
    let list = PEPTIDES;
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category === selectedCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.aliases.some(a => a.toLowerCase().includes(q))
      );
    }
    return list;
  }, [search, selectedCategory]);

  const stackWarnings = useMemo(() => {
    if (peptideConfigs.length < 2) return [];
    const ids = peptideConfigs.map(c => c.peptideId);
    return getStackWarnings(ids);
  }, [peptideConfigs]);

  function selectPeptide(peptide: Peptide) {
    if (peptideConfigs.some(c => c.peptideId === peptide.id)) return;
    const config: PeptideConfig = {
      peptideId: peptide.id,
      dose: peptide.dosing.standard,
      unit: peptide.dosing.unit,
      frequency: peptide.dosing.frequency,
      timesPerDay: peptide.dosing.timesPerDay || 1,
      timeOfDay: peptide.dosing.timeOfDay,
    };
    setPeptideConfigs(prev => [...prev, config]);
    setDurationWeeks(peptide.dosing.cycleWeeks);
    if (!protocolName) setProtocolName(peptide.name);
    setStep('configure');
  }

  function selectTemplate(template: ProtocolTemplate) {
    const configs: PeptideConfig[] = template.peptides.map(tp => {
      const pep = getPeptideById(tp.peptideId);
      return {
        peptideId: tp.peptideId,
        dose: tp.doseOverride ?? pep?.dosing.standard ?? 100,
        unit: tp.unitOverride ?? pep?.dosing.unit ?? 'mcg',
        frequency: (tp.frequencyOverride as FrequencyType) ?? pep?.dosing.frequency ?? 'daily',
        timesPerDay: pep?.dosing.timesPerDay || 1,
        timeOfDay: pep?.dosing.timeOfDay ?? 'morning',
      };
    });
    setPeptideConfigs(configs);
    setDurationWeeks(template.durationWeeks);
    setProtocolName(template.name);
    setStep('configure');
  }

  function removePeptide(id: string) {
    setPeptideConfigs(prev => prev.filter(c => c.peptideId !== id));
  }

  function updateConfig(index: number, updates: Partial<PeptideConfig>) {
    setPeptideConfigs(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  }

  async function createProtocol() {
    if (peptideConfigs.length === 0) return;
    setSaving(true);

    const protocol = await saveProtocol({
      name: protocolName || peptideConfigs.map(c => getPeptideById(c.peptideId)?.name).join(' + '),
      peptideIds: peptideConfigs.map(c => c.peptideId),
      doses: peptideConfigs.map(c => ({
        peptideId: c.peptideId,
        dose: c.dose,
        unit: c.unit,
        frequency: c.frequency,
        timesPerDay: c.timesPerDay,
        timeOfDay: c.timeOfDay,
      })),
      startDate,
      durationWeeks,
      status: 'active',
    });

    const allDoses = peptideConfigs.flatMap(config =>
      generateSchedule({
        peptideId: config.peptideId,
        dose: config.dose,
        unit: config.unit,
        frequency: config.frequency,
        timesPerDay: config.timesPerDay,
        timeOfDay: config.timeOfDay,
        startDate,
        durationWeeks,
        protocolId: protocol.id,
      })
    );

    await saveScheduledDoses(allDoses);
    setSaving(false);
    navigate('/');
  }

  const totalDoses = useMemo(() => {
    if (peptideConfigs.length === 0) return 0;
    return peptideConfigs.reduce((sum, config) => {
      const daysInCycle = durationWeeks * 7;
      switch (config.frequency) {
        case 'daily': return sum + daysInCycle * config.timesPerDay;
        case 'eod': return sum + Math.ceil(daysInCycle / 2);
        case 'weekly': return sum + durationWeeks;
        case 'biweekly': return sum + Math.ceil(durationWeeks / 2);
        default: return sum + daysInCycle;
      }
    }, 0);
  }, [peptideConfigs, durationWeeks]);

  const endDate = useMemo(() => {
    return format(addWeeks(new Date(startDate), durationWeeks), 'MMM d, yyyy');
  }, [startDate, durationWeeks]);

  return (
    <div className="safe-top px-5 pt-4 pb-8">
      <div className="flex items-center gap-3 mb-5 stagger-item">
        <button
          onClick={() => {
            if (step === 'configure') setStep('select');
            else if (step === 'review') setStep('configure');
            else navigate(-1);
          }}
          className="tap-target p-2 -ml-2 rounded-xl"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <h1 className="text-xl font-bold flex-1">
          {step === 'select' ? 'New Protocol' : step === 'configure' ? 'Configure' : 'Review'}
        </h1>
        <div className="flex gap-1.5">
          {(['select', 'configure', 'review'] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? 'w-6 bg-primary' : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>
      </div>

      {step === 'select' && (
        <div>
          {PROTOCOL_TEMPLATES.length > 0 && (
            <div className="mb-6 stagger-item" style={{ animationDelay: '0.05s' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">
                Quick Start Templates
              </h2>
              <div className="space-y-2">
                {PROTOCOL_TEMPLATES.map((t) => {
                  const pepNames = t.peptides.map(p => getPeptideById(p.peptideId)?.name ?? p.peptideId).join(' + ');
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className="card-glass w-full p-4 tap-target text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-dim flex items-center justify-center">
                          <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{t.name}</p>
                          <p className="text-xs text-text-muted truncate">{pepNames} · {t.durationWeeks}w</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-text-muted" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="stagger-item" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">
              Or pick a peptide
            </h2>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search peptides..."
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 mb-3"
            />
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-5 px-5 scrollbar-none">
              {['all', ...Object.keys(CATEGORY_LABELS)].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                    selectedCategory === cat
                      ? 'bg-primary text-bg'
                      : 'bg-card text-text-secondary border border-border'
                  }`}
                >
                  {cat === 'all' ? 'All' : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredPeptides.map(pep => {
                const color = CATEGORY_COLORS[pep.category] ?? '#00d4aa';
                const isSelected = peptideConfigs.some(c => c.peptideId === pep.id);
                return (
                  <button
                    key={pep.id}
                    onClick={() => selectPeptide(pep)}
                    disabled={isSelected}
                    className={`card-glass w-full p-4 tap-target text-left ${isSelected ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: color + '22' }}
                      >
                        <Syringe className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{pep.name}</p>
                        <p className="text-xs text-text-muted truncate">{pep.mechanismShort}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-text-secondary">
                          {pep.dosing.standard} {pep.dosing.unit}
                        </p>
                        <p className="text-xs text-text-muted">{pep.dosing.frequency}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 'configure' && (
        <div>
          <div className="mb-5 stagger-item" style={{ animationDelay: '0.05s' }}>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">
              Protocol Name
            </label>
            <input
              type="text"
              value={protocolName}
              onChange={e => setProtocolName(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {peptideConfigs.map((config, idx) => {
            const pep = getPeptideById(config.peptideId);
            const color = CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa';
            const hasTitration = pep?.dosing.titration && pep.dosing.titration.length > 0;

            return (
              <div
                key={config.peptideId}
                className="card-glass p-4 mb-4 stagger-item"
                style={{ animationDelay: `${0.1 + idx * 0.05}s` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: color + '22' }}
                  >
                    <Syringe className="w-4 h-4" style={{ color }} />
                  </div>
                  <span className="font-semibold text-sm flex-1">{pep?.name}</span>
                  {peptideConfigs.length > 1 && (
                    <button
                      onClick={() => removePeptide(config.peptideId)}
                      className="text-xs text-danger px-2 py-1"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {hasTitration && (
                  <div className="flex items-center gap-2 text-xs text-secondary bg-secondary-dim rounded-lg px-3 py-2 mb-4">
                    <TrendingUp className="w-4 h-4" />
                    Auto-titration enabled — dose steps up per protocol
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Dose</label>
                    <div className="flex">
                      <input
                        type="number"
                        value={config.dose}
                        onChange={e => updateConfig(idx, { dose: parseFloat(e.target.value) || 0 })}
                        className="flex-1 bg-bg-raised border border-border rounded-l-lg px-3 py-2 text-sm font-mono text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                        step={config.unit === 'mg' ? 0.1 : 10}
                      />
                      <select
                        value={config.unit}
                        onChange={e => updateConfig(idx, { unit: e.target.value as 'mcg' | 'mg' })}
                        className="bg-bg-raised border border-l-0 border-border rounded-r-lg px-2 py-2 text-xs text-text-secondary"
                      >
                        <option value="mcg">mcg</option>
                        <option value="mg">mg</option>
                      </select>
                    </div>
                    {pep && (
                      <p className="text-[10px] text-text-muted mt-1">
                        Range: {pep.dosing.low}–{pep.dosing.high} {pep.dosing.unit}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-text-muted block mb-1">Frequency</label>
                    <select
                      value={config.frequency}
                      onChange={e => updateConfig(idx, { frequency: e.target.value as FrequencyType })}
                      className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text"
                    >
                      {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-text-muted block mb-1">Time of Day</label>
                    <select
                      value={config.timeOfDay}
                      onChange={e => updateConfig(idx, { timeOfDay: e.target.value as TimeOfDay })}
                      className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text"
                    >
                      {Object.entries(TIME_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {config.frequency === 'daily' && (
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Times/day</label>
                      <select
                        value={config.timesPerDay}
                        onChange={e => updateConfig(idx, { timesPerDay: parseInt(e.target.value) })}
                        className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text"
                      >
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={3}>3x</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button
            onClick={() => setStep('select')}
            className="w-full card-glass p-3 text-sm text-primary font-medium flex items-center justify-center gap-2 mb-5 stagger-item"
            style={{ animationDelay: '0.2s' }}
          >
            <Beaker className="w-4 h-4" />
            Add another peptide
          </button>

          <div className="card-glass p-4 mb-5 stagger-item" style={{ animationDelay: '0.25s' }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Schedule
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Duration</label>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={durationWeeks}
                    onChange={e => setDurationWeeks(parseInt(e.target.value) || 1)}
                    min={1}
                    max={52}
                    className="flex-1 bg-bg-raised border border-border rounded-l-lg px-3 py-2 text-sm font-mono text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="bg-bg-raised border border-l-0 border-border rounded-r-lg px-3 py-2 text-xs text-text-muted">
                    weeks
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Ends {endDate} · ~{totalDoses} total injections
            </p>
          </div>

          {stackWarnings.length > 0 && (
            <div className="mb-5 space-y-2 stagger-item" style={{ animationDelay: '0.3s' }}>
              {stackWarnings.map((w, i) => (
                <div
                  key={i}
                  className={`text-xs p-3 rounded-lg flex items-start gap-2 ${
                    w.relation === 'contraindicated' ? 'bg-danger-dim text-danger' :
                    w.relation === 'caution' ? 'bg-warning-dim text-warning' :
                    'bg-primary-dim text-primary'
                  }`}
                >
                  <Beaker className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{w.note}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setStep('review')}
            disabled={peptideConfigs.length === 0}
            className="w-full bg-primary text-bg font-semibold py-3.5 rounded-xl tap-target flex items-center justify-center gap-2 disabled:opacity-40 stagger-item"
            style={{ animationDelay: '0.35s' }}
          >
            Review Protocol
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div className="card-glass p-5 mb-5 stagger-item" style={{ animationDelay: '0.05s' }}>
            <h2 className="font-semibold text-lg mb-1">{protocolName}</h2>
            <p className="text-sm text-text-muted mb-4">
              {format(new Date(startDate), 'MMM d, yyyy')} → {endDate}
            </p>

            {peptideConfigs.map((config) => {
              const pep = getPeptideById(config.peptideId);
              const color = CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa';
              const hasTitration = pep?.dosing.titration && pep.dosing.titration.length > 0;

              return (
                <div key={config.peptideId} className="flex items-center gap-3 py-3 border-t border-border">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: color + '22' }}
                  >
                    <Syringe className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{pep?.name}</p>
                    <p className="text-xs text-text-muted font-mono">
                      {hasTitration ? 'Titration protocol' : `${config.dose} ${config.unit}`}
                      {' · '}{FREQUENCY_LABELS[config.frequency]}
                      {' · '}{TIME_LABELS[config.timeOfDay]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card-glass p-4 mb-5 stagger-item" style={{ animationDelay: '0.1s' }}>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold font-mono text-primary">{durationWeeks}</p>
                <p className="text-xs text-text-muted">Weeks</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-primary">{totalDoses}</p>
                <p className="text-xs text-text-muted">Injections</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-primary">{peptideConfigs.length}</p>
                <p className="text-xs text-text-muted">Peptides</p>
              </div>
            </div>
          </div>

          <button
            onClick={createProtocol}
            disabled={saving}
            className="w-full bg-primary text-bg font-semibold py-3.5 rounded-xl tap-target flex items-center justify-center gap-2 disabled:opacity-60 stagger-item"
            style={{ animationDelay: '0.15s' }}
          >
            {saving ? (
              <span className="animate-pulse">Creating schedule...</span>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Start Protocol
              </>
            )}
          </button>

          <p className="text-center text-xs text-text-muted mt-3 stagger-item" style={{ animationDelay: '0.2s' }}>
            All {totalDoses} injections will be scheduled on your calendar
          </p>
        </div>
      )}
    </div>
  );
}
