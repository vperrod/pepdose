import { useState, useEffect, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, addDays, addWeeks, parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getScheduledDosesInRange, getDoseLogsInRange, getProtocols, getScheduledDosesForProtocols } from '../db/operations';
import { clicksForDose, formatClicks, penMlPerClick } from '../utils/penClicks';
import { withoutInactiveUpcoming } from '../utils/doseVisibility';
import { getPeptideById } from '../data/peptides';
import { DoseActionSheet } from '../components/DoseActionSheet';
import { AdhocLogSheet } from '../components/AdhocLogSheet';
import { ProtocolTimeline } from '../components/ProtocolTimeline';
import { UserBadge } from '../components/UserBadge';
import { useViewFilter } from '../context/ViewFilterContext';
import { filterByOwner } from '../context/ownerFilter';
import { penColorHex } from '../components/PenColorField';
import type { ScheduledDose, DoseLog, UserProtocol } from '../db/schema';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthDoses, setMonthDoses] = useState<ScheduledDose[]>([]);
  const [monthAdhoc, setMonthAdhoc] = useState<DoseLog[]>([]);
  const [logsByDoseId, setLogsByDoseId] = useState<Map<string, DoseLog>>(new Map());
  const [protocolsById, setProtocolsById] = useState<Map<string, UserProtocol>>(new Map());
  const [activeDose, setActiveDose] = useState<(ScheduledDose & { peptideName: string; color: string }) | null>(null);
  const [viewAdhocLog, setViewAdhocLog] = useState<DoseLog | null>(null);
  const [view, setView] = useState<'month' | 'timeline'>('month');
  const [timelineProtocols, setTimelineProtocols] = useState<UserProtocol[]>([]);
  const [dosesByProtocol, setDosesByProtocol] = useState<Map<string, ScheduledDose[]>>(new Map());
  const [reloadKey, setReloadKey] = useState(0);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  useEffect(() => {
    async function load() {
      const rangeStart = format(calStart, 'yyyy-MM-dd');
      const rangeEnd = format(calEnd, 'yyyy-MM-dd');
      // All protocols, not just active ones: a dose from a finished protocol still
      // needs its name on the row, or rows from different runs look identical.
      const [doses, logs, protos, allProtos] = await Promise.all([
        getScheduledDosesInRange(rangeStart, rangeEnd),
        getDoseLogsInRange(rangeStart, rangeEnd),
        getProtocols('active'),
        getProtocols(),
      ]);
      setMonthDoses(withoutInactiveUpcoming(doses, new Set(protos.map(p => p.id))));
      setLogsByDoseId(new Map(
        logs.filter(l => l.scheduledDoseId).map(l => [l.scheduledDoseId!, l]),
      ));
      // Logs without a scheduledDoseId are ad-hoc doses — they must still
      // show on the calendar or a logged dose looks like it vanished.
      setMonthAdhoc(logs.filter(l => !l.scheduledDoseId));
      setProtocolsById(new Map(allProtos.map(p => [p.id, p])));
    }
    load();
  }, [currentMonth, reloadKey]);

  useEffect(() => {
    async function loadTimeline() {
      const protos = await getProtocols('active');
      const byProto = new Map<string, ScheduledDose[]>(protos.map(p => [p.id, []]));
      for (const d of await getScheduledDosesForProtocols(protos.map(p => p.id))) {
        byProto.get(d.protocolId)!.push(d);
      }
      setTimelineProtocols(protos);
      setDosesByProtocol(byProto);
    }
    if (view === 'timeline') loadTimeline();
  }, [view, reloadKey]);

  const { filter } = useViewFilter();

  const dosesByDate = useMemo(() => {
    const map = new Map<string, ScheduledDose[]>();
    for (const dose of filterByOwner(monthDoses, filter)) {
      const existing = map.get(dose.date) || [];
      existing.push(dose);
      map.set(dose.date, existing);
    }
    return map;
  }, [monthDoses, filter]);

  // Compute which calendar days fall within a protocol's break windows,
  // so the month grid can show a visual "off" indicator on those days.
  const breakByDate = useMemo(() => {
    const map = new Map<string, string>(); // dateKey -> break reason
    for (const proto of filterByOwner([...protocolsById.values()], filter)) {
      // The map now holds every protocol so rows can be named; only a running
      // protocol's break weeks should hatch the grid.
      if (proto.status !== 'active') continue;
      if (!proto.breaks || proto.breaks.length === 0) continue;
      const start = parseISO(proto.startDate);
      for (const brk of proto.breaks) {
        for (let w = brk.weekStart; w <= brk.weekEnd; w++) {
          const weekStart = addWeeks(start, w - 1);
          for (let d = 0; d < 7; d++) {
            const day = addDays(weekStart, d);
            const key = format(day, 'yyyy-MM-dd');
            if (!map.has(key)) map.set(key, brk.reason);
          }
        }
      }
    }
    return map;
  }, [protocolsById, filter]);

  const adhocByDate = useMemo(() => {
    const map = new Map<string, DoseLog[]>();
    for (const log of filterByOwner(monthAdhoc, filter)) {
      map.set(log.date, [...(map.get(log.date) ?? []), log]);
    }
    return map;
  }, [monthAdhoc, filter]);

  const selectedAdhoc = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    return [...(adhocByDate.get(key) ?? [])].sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, adhocByDate]);

  const selectedDoses = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    return (dosesByDate.get(key) || [])
      .map(d => {
        const pep = getPeptideById(d.peptideId);
        const doseConfig = protocolsById.get(d.protocolId)?.doses.find(x => x.peptideId === d.peptideId);
        return {
          ...d,
          peptideName: pep?.name ?? d.peptideId,
          protocolName: protocolsById.get(d.protocolId)?.name ?? '',
          recon: doseConfig?.recon,
          penColor: doseConfig?.penColor,
          color: penColorHex(doseConfig?.penColor),
        };
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, dosesByDate, protocolsById]);

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center justify-between mb-4 stagger-item">
        {view === 'month' ? (
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="tap-target p-2 rounded-xl hover:bg-card"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          </button>
        ) : <span className="w-9" />}
        <h1 className="text-lg font-semibold">
          {view === 'month' ? format(currentMonth, 'MMMM yyyy') : 'Protocol Timeline'}
        </h1>
        {view === 'month' && !isSameMonth(currentMonth, new Date()) && (
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="tap-target text-xs font-medium text-primary bg-primary-dim px-2 py-1 rounded"
            aria-label="Jump to current month"
          >
            Today
          </button>
        )}
        {view === 'month' ? (
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="tap-target p-2 rounded-xl hover:bg-card"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          </button>
        ) : <span className="w-9" />}
      </div>

      <div className="flex bg-card rounded-xl p-1 mb-4 stagger-item">
        {(['month', 'timeline'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 text-center text-sm font-medium py-2 rounded-lg transition-colors ${
              view === v ? 'bg-primary text-bg' : 'text-text-secondary'
            }`}
          >
            {v === 'month' ? 'Month' : 'Timeline'}
          </button>
        ))}
      </div>

      {view === 'month' && (
      <>
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

          const dayPeptides = (() => {
            const seen = new Set<string>();
            const segs: { name: string; color: string }[] = [];
            for (const d of dayDoses) {
              const pep = getPeptideById(d.peptideId);
              const name = pep?.name ?? d.peptideId;
              if (seen.has(name)) continue;
              seen.add(name);
              const penColor = protocolsById.get(d.protocolId)?.doses.find(x => x.peptideId === d.peptideId)?.penColor;
              segs.push({ name, color: penColorHex(penColor) });
            }
            for (const log of adhocByDate.get(dateKey) ?? []) {
              const pep = getPeptideById(log.peptideId);
              const name = pep?.name ?? log.peptideId;
              if (seen.has(name)) continue;
              seen.add(name);
              segs.push({ name, color: penColorHex(undefined) });
            }
            return segs;
          })();
          const MAX_SEG = 8;
          const dayExtra = dayPeptides.length - MAX_SEG;
          const dayStrip = dayPeptides.slice(0, MAX_SEG);

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
              {dayStrip.length > 0 && (
                <div className="flex items-end gap-px mt-1 h-3">
                  {dayStrip.map((s, i) => (
                    <div
                      key={i}
                      className="h-full w-1.5 rounded-sm shrink-0"
                      style={{ backgroundColor: s.color }}
                      title={s.name}
                    />
                  ))}
                  {dayExtra > 0 && (
                    <span className="text-[8px] leading-none text-text-muted ml-0.5">+{dayExtra}</span>
                  )}
                </div>
              )}
              {breakByDate.has(dateKey) && (
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 3px, transparent 3px, transparent 6px)',
                  }}
                  title={breakByDate.get(dateKey)}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 stagger-item" style={{ animationDelay: '0.15s' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">
          {format(selectedDate, 'EEEE, MMMM d')}
        </h2>

        {selectedDoses.length === 0 && selectedAdhoc.length === 0 ? (
          <div className="card-glass p-6 text-center">
            <p className="text-text-muted text-sm">No doses scheduled</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDoses.map((dose) => {
              const isDone = dose.status === 'logged';
              const isMissed = dose.status === 'missed';
              const doseLog = logsByDoseId.get(dose.id);
              const clicks = formatClicks(clicksForDose(doseLog?.dose ?? dose.dose, dose.unit, dose.recon, penMlPerClick()));
              return (
                <button
                  key={dose.id}
                  onClick={() => setActiveDose(dose)}
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
                    <div className="flex items-center gap-2">
                      <p className={`font-medium text-sm ${isDone ? 'text-text-muted' : ''}`}>
                        {dose.peptideName}
                      </p>
                      <UserBadge owner={dose.owner} />
                    </div>
                    {dose.protocolName && (
                      <p className="text-[10px] text-text-muted truncate">{dose.protocolName}</p>
                    )}
                    <p className="text-xs text-text-muted font-mono">
                      {doseLog?.dose ?? dose.dose} {dose.unit} · {dose.route === 'subq' ? 'SubQ' : dose.route}
                    </p>
                    {clicks && <p className="text-[11px] text-primary font-mono">{clicks}</p>}
                    {dose.penColor && <p className="text-[11px] text-text-muted">Pen: {dose.penColor}</p>}
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
            {selectedAdhoc.map((log) => {
              const pep = getPeptideById(log.peptideId);
              return (
                <button key={log.id} onClick={() => setViewAdhocLog(log)} className="card-glass w-full flex items-center gap-3 p-4 tap-target text-left">
                  <div className="flex flex-col items-center w-12">
                    <span className="text-xs font-mono text-text-muted">{log.time}</span>
                    <div className="w-2 h-2 rounded-full mt-1 bg-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-text-muted">{pep?.name ?? log.peptideId}</p>
                      <UserBadge owner={log.owner} />
                    </div>
                    <p className="text-xs text-text-muted font-mono">
                      {log.dose} {log.unit}{log.injectionSite ? ` · ${log.injectionSite}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-secondary/15 text-secondary">
                    Ad-hoc
                  </span>
                </button>
              );
            })}
          </div>
        )}
        </div>
      </>
      )}

      {view === 'timeline' && (
        <ProtocolTimeline
          protocols={timelineProtocols}
          dosesByProtocol={dosesByProtocol}
          logsByDoseId={logsByDoseId}
        />
      )}

      {viewAdhocLog && (
        <AdhocLogSheet
          log={viewAdhocLog}
          onClose={() => setViewAdhocLog(null)}
          onDeleted={() => setReloadKey(k => k + 1)}
        />
      )}

      {activeDose && (
        <DoseActionSheet
          dose={activeDose}
          log={logsByDoseId.get(activeDose.id)}
          onClose={() => setActiveDose(null)}
          onUpdated={() => setReloadKey(k => k + 1)}
        />
      )}
    </div>
  );
}
