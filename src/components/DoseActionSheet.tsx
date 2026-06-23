import { useState } from 'react';
import { format } from 'date-fns';
import { X, Check, Clock, MapPin, CalendarDays, SkipForward, Pencil } from 'lucide-react';
import { logDose, updateScheduledDose } from '../db/operations';
import type { ScheduledDose } from '../db/schema';

const INJECTION_SITES = [
  'Left abdomen', 'Right abdomen',
  'Left thigh (outer)', 'Right thigh (outer)',
  'Left deltoid', 'Right deltoid',
  'Left glute', 'Right glute',
];

interface DoseActionSheetProps {
  dose: ScheduledDose & { peptideName: string; color: string };
  onClose: () => void;
  onUpdated: () => void;
}

type SheetMode = 'actions' | 'log' | 'reschedule';

export function DoseActionSheet({ dose, onClose, onUpdated }: DoseActionSheetProps) {
  const [mode, setMode] = useState<SheetMode>(dose.status === 'logged' ? 'actions' : 'log');
  const [actualDose, setActualDose] = useState(parseFloat(dose.dose.toPrecision(10)));
  const [actualTime, setActualTime] = useState(format(new Date(), 'HH:mm'));
  const [site, setSite] = useState(dose.suggestedSite || INJECTION_SITES[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [newDate, setNewDate] = useState(dose.date);
  const [newTime, setNewTime] = useState(dose.time);

  const isLogged = dose.status === 'logged';

  async function handleLog() {
    setSaving(true);
    await logDose({
      scheduledDoseId: dose.id,
      protocolId: dose.protocolId,
      peptideId: dose.peptideId,
      date: dose.date,
      time: actualTime,
      dose: actualDose,
      unit: dose.unit,
      route: dose.route,
      injectionSite: site,
      notes: notes || undefined,
    });
    onUpdated();
    onClose();
  }

  async function handleReschedule() {
    setSaving(true);
    await updateScheduledDose(dose.id, {
      date: newDate,
      time: newTime,
      editNote: `Rescheduled from ${dose.date} ${dose.time}`,
    });
    onUpdated();
    onClose();
  }

  async function handleSkip() {
    setSaving(true);
    await updateScheduledDose(dose.id, { status: 'skipped' });
    onUpdated();
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] animate-slide-up">
        <div className="bg-bg-raised rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: dose.color }}
              />
              <div>
                <p className="font-semibold text-sm">{dose.peptideName}</p>
                <p className="text-xs text-text-muted">
                  {dose.dose} {dose.unit} · {dose.date} · {dose.time}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="tap-target p-2 rounded-xl hover:bg-card" aria-label="Close">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          {mode === 'actions' && (
            <div className="p-4 space-y-2">
              {!isLogged && (
                <button
                  onClick={() => setMode('log')}
                  className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                >
                  <Check className="w-5 h-5 text-success" />
                  <div>
                    <p className="font-medium text-sm">Log Dose</p>
                    <p className="text-xs text-text-muted">Record injection details</p>
                  </div>
                </button>
              )}
              {!isLogged && (
                <button
                  onClick={() => setMode('reschedule')}
                  className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                >
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Reschedule</p>
                    <p className="text-xs text-text-muted">Move to different date/time</p>
                  </div>
                </button>
              )}
              {!isLogged && (
                <button
                  onClick={handleSkip}
                  disabled={saving}
                  className="card-glass w-full p-4 tap-target flex items-center gap-3 text-left"
                >
                  <SkipForward className="w-5 h-5 text-warning" />
                  <div>
                    <p className="font-medium text-sm">Skip Dose</p>
                    <p className="text-xs text-text-muted">Mark as intentionally skipped</p>
                  </div>
                </button>
              )}
              {isLogged && (
                <div className="card-glass p-4 flex items-center gap-3">
                  <Check className="w-5 h-5 text-success" />
                  <p className="text-sm text-text-muted">Already logged</p>
                </div>
              )}
            </div>
          )}

          {mode === 'log' && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  Actual Dose ({dose.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={parseFloat(actualDose.toPrecision(10))}
                  onChange={e => setActualDose(parseFloat(e.target.value) || 0)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Time of Injection
                </label>
                <input
                  type="time"
                  value={actualTime}
                  onChange={e => setActualTime(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  Injection Site
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {INJECTION_SITES.map(s => (
                    <button
                      key={s}
                      onClick={() => setSite(s)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        site === s
                          ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                          : 'bg-card border border-border text-text-secondary hover:bg-card-hover'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  <Pencil className="w-3 h-3 inline mr-1" />
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Side effects, feelings, etc."
                  rows={2}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2 pb-4">
                <button
                  onClick={() => isLogged ? onClose() : setMode('actions')}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-medium text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLog}
                  disabled={saving || actualDose <= 0}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-bg text-sm font-semibold disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Log Dose'}
                </button>
              </div>
            </div>
          )}

          {mode === 'reschedule' && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  New Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  New Time
                </label>
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2 pb-4">
                <button
                  onClick={() => setMode('actions')}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-medium text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={saving || (newDate === dose.date && newTime === dose.time)}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-bg text-sm font-semibold disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Reschedule'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
