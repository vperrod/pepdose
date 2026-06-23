import { useState, useEffect, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getScheduledDosesInRange } from '../db/operations';
import { getPeptideById } from '../data/peptides';
import type { ScheduledDose } from '../db/schema';

const CATEGORY_COLORS: Record<string, string> = {
  healing: '#22c55e',
  glp1: '#6366f1',
  gh_secretagogue: '#f59e0b',
  fat_loss: '#ef4444',
  cosmetic: '#ec4899',
  sexual_health: '#a855f7',
  nootropic: '#06b6d4',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthDoses, setMonthDoses] = useState<ScheduledDose[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rangeStart = format(calStart, 'yyyy-MM-dd');
      const rangeEnd = format(calEnd, 'yyyy-MM-dd');
      const doses = await getScheduledDosesInRange(rangeStart, rangeEnd);
      setMonthDoses(doses);
      setLoading(false);
    }
    load();
  }, [currentMonth]);

  const dosesByDate = useMemo(() => {
    const map = new Map<string, ScheduledDose[]>();
    for (const dose of monthDoses) {
      const existing = map.get(dose.date) || [];
      existing.push(dose);
      map.set(dose.date, existing);
    }
    return map;
  }, [monthDoses]);

  const selectedDoses = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    return (dosesByDate.get(key) || [])
      .map(d => {
        const pep = getPeptideById(d.peptideId);
        return {
          ...d,
          peptideName: pep?.name ?? d.peptideId,
          color: CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa',
        };
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, dosesByDate]);

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center justify-between mb-5 stagger-item">
        <button
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="tap-target p-2 rounded-xl hover:bg-card"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <h1 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h1>
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="tap-target p-2 rounded-xl hover:bg-card"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0 mb-2 stagger-item" style={{ animationDelay: '0.05s' }}>
        {WEEKDAYS.map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-text-muted py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0 stagger-item" style={{ animationDelay: '0.1s' }}>
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayDoses = dosesByDate.get(dateKey) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);

          const uniqueColors = [...new Set(
            dayDoses.map(d => {
              const pep = getPeptideById(d.peptideId);
              return CATEGORY_COLORS[pep?.category ?? 'healing'] ?? '#00d4aa';
            })
          )].slice(0, 3);

          const hasLogged = dayDoses.some(d => d.status === 'logged');
          const hasMissed = dayDoses.some(d => d.status === 'missed');

          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDate(day)}
              className={`
                relative flex flex-col items-center justify-center py-2 min-h-[52px] rounded-xl transition-colors
                ${!inMonth ? 'opacity-30' : ''}
                ${selected ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-card'}
              `}
            >
              <span
                className={`
                  text-sm font-medium
                  ${today && !selected ? 'text-primary' : ''}
                  ${selected ? 'text-primary font-semibold' : ''}
                  ${!today && !selected ? 'text-text' : ''}
                `}
              >
                {format(day, 'd')}
              </span>
              {uniqueColors.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {uniqueColors.map((color, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 stagger-item" style={{ animationDelay: '0.15s' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">
          {format(selectedDate, 'EEEE, MMMM d')}
        </h2>

        {selectedDoses.length === 0 ? (
          <div className="card-glass p-6 text-center">
            <p className="text-text-muted text-sm">No doses scheduled</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDoses.map((dose) => {
              const isDone = dose.status === 'logged';
              const isMissed = dose.status === 'missed';
              return (
                <button
                  key={dose.id}
                  className="card-glass w-full flex items-center gap-3 p-4 tap-target text-left"
                >
                  <div className="flex flex-col items-center w-12">
                    <span className="text-xs font-mono text-text-muted">{dose.time}</span>
                    <div
                      className="w-2 h-2 rounded-full mt-1"
                      style={{ backgroundColor: isDone ? '#22c55e' : isMissed ? '#ef4444' : dose.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${isDone ? 'text-text-muted' : ''}`}>
                      {dose.peptideName}
                    </p>
                    <p className="text-xs text-text-muted font-mono">
                      {dose.dose} {dose.unit} · {dose.route === 'subq' ? 'SubQ' : dose.route}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                    isDone ? 'bg-success/15 text-success' :
                    isMissed ? 'bg-danger/15 text-danger' :
                    'bg-primary-dim text-primary'
                  }`}>
                    {isDone ? 'Done' : isMissed ? 'Missed' : 'Pending'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
