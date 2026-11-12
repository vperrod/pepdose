import { useState, useMemo, useEffect } from 'react';
import { Clock, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Peptide, FrequencyType } from '../data/peptides';
import type { CardValue } from '../utils/cycleForm';
import { DecimalInput } from './DecimalInput';
import { WeekdayPicker } from './WeekdayPicker';
import { ReconMixFields } from './ReconMixFields';
import { PenColorField } from './PenColorField';
import { cycleStrip, cycleTotalWeeks, cardSummary } from '../utils/cycleForm';
import { DisclaimerFooter } from './DisclaimerFooter';

const TIME_LABELS: Record<string, string> = {
  morning_fasting: 'Morning (fasting)',
  morning: 'Morning',
  evening: 'Evening',
  pre_bed: 'Before bed',
  before_activity: 'Before activity',
  any: 'Any time',
};

const FREQUENCY_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly_days', label: 'Specific days of week' },
  { value: 'eod', label: 'Every other day' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'custom', label: 'Custom interval' },
];

interface PeptideCycleCardProps {
  value: CardValue;
  peptide: Peptide;
  onChange: (v: CardValue) => void;
  onRemove?: () => void;
}

/** Number input that keeps its own text while typing, so clearing the field to retype is possible. */
function WeeksInput({ id, label, value, min, onCommit }: {
  id: string; label: string; value: number; min: number; onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  return (
    <input
      id={id}
      type="number"
      value={draft}
      min={min}
      aria-label={label}
      onChange={e => {
        setDraft(e.target.value);
        const n = parseInt(e.target.value, 10);
        if (Number.isInteger(n) && n >= min) onCommit(n);
      }}
      onBlur={() => setDraft(String(value))}
      className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}

export function PeptideCycleCard({ value, peptide, onChange, onRemove }: PeptideCycleCardProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isPenOpen, setIsPenOpen] = useState(false);

  // Determine if a variant is active
  const hasVariants = peptide.dosing.protocolVariants && peptide.dosing.protocolVariants.length > 0;
  const variantActive = value.variantId && value.schedulePhases;

  // Preset select options
  const presetOptions = useMemo(() => {
    if (!hasVariants || !peptide.dosing.protocolVariants) return [];
    const options = [{ value: '__custom__', label: 'Custom (set your own schedule)' }];
    options.push(...peptide.dosing.protocolVariants.map(v => ({ value: v.id, label: v.name })));
    return options;
  }, [hasVariants, peptide.dosing.protocolVariants]);

  // Handle preset change
  const handlePresetChange = (variantId: string) => {
    if (variantId === '__custom__') {
      onChange({
        ...value,
        variantId: undefined,
        schedulePhases: undefined,
        customSchedule: true,
        daysOfWeek: [],
        frequency: 'weekly_days',
      });
    } else {
      const variant = peptide.dosing.protocolVariants?.find(v => v.id === variantId);
      if (variant) {
        onChange({
          ...value,
          variantId: variant.id,
          schedulePhases: variant.phases,
          dose: variant.doseOverride ?? peptide.dosing.standard,
          customSchedule: false,
        });
      }
    }
  };

  const unitOptions = ['mcg', 'mg', 'IU'] as const;

  // Time options
  const timeOptions = Object.entries(TIME_LABELS).map(([value, label]) => ({ value, label }));

  // Frequency options
  const frequencyOptions = FREQUENCY_OPTIONS;

  // Determine if WeekdayPicker should show
  const showWeekdayPicker = !value.schedulePhases && 
    (value.frequency === 'daily' || value.frequency === 'weekly_days');

  // Handle days change
  const handleDaysChange = (days: number[]) => {
    onChange({
      ...value,
      daysOfWeek: days,
      frequency: days.length === 0 ? 'weekly_days' : (days.length === 7 ? 'daily' : 'weekly_days'),
    });
  };

  // Handle frequency change
  const handleFrequencyChange = (newFrequency: FrequencyType) => {
    const updates: Partial<CardValue> = { frequency: newFrequency };

    if (newFrequency === 'weekly_days') {
      updates.daysOfWeek = [];
    } else if (newFrequency === 'daily') {
      updates.daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
    }

    onChange({ ...value, ...updates });
  };

  // Handle custom frequency days change
  const handleCustomFrequencyDaysChange = (days: number) => {
    onChange({
      ...value,
      customFrequencyDays: days > 0 ? days : undefined,
    });
  };

  // Handle times per day change
  const handleTimesPerDayChange = (times: number) => {
    onChange({
      ...value,
      timesPerDay: times,
    });
  };

  // Calculate strip data
  const stripData = useMemo(() => {
    return cycleStrip(value.onWeeks, value.offWeeks, cycleTotalWeeks(value.onWeeks, value.offWeeks));
  }, [value.onWeeks, value.offWeeks]);

  // Calculate summary
  const summary = useMemo(() => {
    return cardSummary(value);
  }, [value]);

  return (
    <div className="card-glass p-5 rounded-xl relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-text">{peptide.name}</h3>
        {onRemove && (
          <button
            onClick={onRemove}
            className="tap-target p-2 -mr-2 rounded-lg"
            aria-label="Remove peptide"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        )}
        {peptide.doseGuide && (
          <p className="text-xs text-text-muted mt-1 w-full">{peptide.doseGuide}</p>
        )}
      </div>

      {/* Preset Select */}
      {hasVariants && (
        <div className="mb-4">
          <label className="text-xs text-text-muted block mb-2">Preset</label>
          <select
            value={value.variantId ?? '__custom__'}
            onChange={e => handlePresetChange(e.target.value)}
            className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {presetOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {variantActive && peptide.dosing.protocolVariants?.find(v => v.id === value.variantId)?.description && (
            <p className="text-xs text-text-muted mt-1">{peptide.dosing.protocolVariants?.find(v => v.id === value.variantId)?.description}</p>
          )}
        </div>
      )}

      {/* Dose and Time Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Dose Input */}
        <div>
          <label className="text-xs text-text-muted block mb-2">Dose</label>
          <div className="flex gap-2">
            <DecimalInput
              value={value.dose}
              onChange={dose => onChange({ ...value, dose })}
              step={value.unit === 'mg' ? 0.1 : 10}
              min={0}
              className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Dose amount"
            />
            <select
              value={value.unit}
              onChange={e => onChange({ ...value, unit: e.target.value as 'mcg' | 'mg' | 'IU' })}
              className="bg-bg-raised border border-border rounded-lg px-2 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Dose unit"
            >
              {unitOptions.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Range {value.unit === 'mcg' ? '10' : value.unit === 'mg' ? '0.5' : '10'}–{value.unit === 'mcg' ? '800' : value.unit === 'mg' ? '2.4' : '40'} {value.unit}
          </p>
        </div>

        {/* Time Select */}
        <div>
          <label className="text-xs text-text-muted block mb-2">Time</label>
          <div className="relative">
            <select
              value={value.timeOfDay}
              onChange={e => onChange({ ...value, timeOfDay: e.target.value as typeof value.timeOfDay })}
              className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none"
              aria-label="Time of day"
              id={`${value.peptideId}-time`}
            >
              {timeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Injection Days */}
      {showWeekdayPicker && (
        <div className="mb-4">
          <WeekdayPicker
            value={value.daysOfWeek}
            onChange={handleDaysChange}
          />
        </div>
      )}

      {/* Weeks On/Off Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label htmlFor={`${value.peptideId}-weeks-on`} className="text-xs text-text-muted block mb-2">Weeks on</label>
          <WeeksInput
            id={`${value.peptideId}-weeks-on`}
            label="Weeks on"
            value={value.onWeeks}
            min={1}
            onCommit={n => onChange({ ...value, onWeeks: n })}
          />
        </div>
        <div>
          <label htmlFor={`${value.peptideId}-weeks-off`} className="text-xs text-text-muted block mb-2">Weeks off</label>
          <WeeksInput
            id={`${value.peptideId}-weeks-off`}
            label="Weeks off"
            value={value.offWeeks}
            min={0}
            onCommit={n => onChange({ ...value, offWeeks: n })}
          />
        </div>
      </div>

      {/* 24-Week Strip */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted">Cycle strip (24 weeks)</span>
          <span className="text-xs text-text-muted sr-only">{summary}</span>
        </div>
        <div className="grid grid-cols-24 gap-0.5">
          {stripData.map((isOn, week) => (
            <div
              key={week}
              className={`aspect-square rounded-sm ${isOn ? 'bg-green-500/80' : 'bg-amber-500/30'} border border-border/50`}
              aria-hidden="true"
            />
          ))}
        </div>
        <p className="text-xs text-text-muted mt-2">{summary}</p>
      </div>

      {/* More Options */}
      <details
        className="mb-3 border-t border-border pt-3"
        open={isMoreOpen || value.frequency === 'eod' || value.frequency === 'biweekly' || value.frequency === 'custom'}
        onToggle={e => setIsMoreOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-medium text-text-muted hover:text-text">
          {isMoreOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          More options
        </summary>

        <div className="mt-3 space-y-3">
          {/* Pattern Select */}
          <div>
            <label className="text-xs text-text-muted block mb-2">Pattern</label>
            <select
              value={value.frequency}
              onChange={e => handleFrequencyChange(e.target.value as FrequencyType)}
              className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={!!value.schedulePhases}
            >
              {frequencyOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Custom Days Input (shown when frequency is custom) */}
            {value.frequency === 'custom' && !value.schedulePhases && (
              <div className="mt-2">
                <label className="text-xs text-text-muted block mb-2">Every N days</label>
                <input
                  type="number"
                  value={value.customFrequencyDays || ''}
                  onChange={e => handleCustomFrequencyDaysChange(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full bg-bg-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. 3"
                />
              </div>
            )}

            {/* Times per day (shown when frequency is daily) */}
            {value.frequency === 'daily' && !value.schedulePhases && (
              <div className="mt-2">
                <label className="text-xs text-text-muted block mb-2">Times per day</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(times => (
                    <button
                      key={times}
                      onClick={() => handleTimesPerDayChange(times)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        value.timesPerDay === times
                          ? 'bg-primary text-bg'
                          : 'bg-bg-raised border border-border text-text-muted'
                      }`}
                    >
                      {times}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </details>

      {/* Pen Setup */}
      <details
        className="border-t border-border pt-3"
        open={isPenOpen}
        onToggle={e => setIsPenOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-medium text-text-muted hover:text-text">
          {isPenOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Pen setup
        </summary>

        <div className="mt-3 space-y-3">
          <ReconMixFields
            value={value.recon}
            dose={value.dose}
            unit={value.unit}
            onChange={recon => onChange({ ...value, recon })}
          />
          <PenColorField
            value={value.penColor}
            onChange={penColor => onChange({ ...value, penColor })}
          />
        </div>
      </details>

      <DisclaimerFooter className="mt-4" />
    </div>
  );
}
