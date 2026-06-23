import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar as CalIcon, List } from 'lucide-react';
import { getAllDoseLogs } from '../db/operations';
import { getPeptideById } from '../data/peptides';
import type { DoseLog } from '../db/schema';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths } from 'date-fns';

export function DoseHistory() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [view, setView] = useState<'heatmap' | 'list'>('heatmap');
  const [month, setMonth] = useState(new Date());
  const [filterPeptide, setFilterPeptide] = useState('');

  const load = useCallback(async () => {
    setLogs(await getAllDoseLogs());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!filterPeptide) return logs;
    return logs.filter(l => l.peptideId === filterPeptide);
  }, [logs, filterPeptide]);

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of filtered) {
      map[log.date] = (map[log.date] || 0) + 1;
    }
    return map;
  }, [filtered]);

  const peptideIds = useMemo(() => [...new Set(logs.map(l => l.peptideId))], [logs]);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  function heatColor(count: number): string {
    if (count === 0) return '#131a2b';
    if (count === 1) return '#00d4aa33';
    if (count === 2) return '#00d4aa66';
    if (count === 3) return '#00d4aa99';
    return '#00d4aacc';
  }

  const sortedLogs = useMemo(() =>
    [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [filtered]
  );

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center gap-3 mb-4 stagger-item">
        <button onClick={() => navigate(-1)} className="tap-target p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">Dose History</h1>
        <div className="flex bg-card rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView('heatmap')}
            className={`p-2 ${view === 'heatmap' ? 'bg-primary/20 text-primary' : 'text-text-muted'}`}
          >
            <CalIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-2 ${view === 'list' ? 'bg-primary/20 text-primary' : 'text-text-muted'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {peptideIds.length > 0 && (
        <div className="mb-4 stagger-item" style={{ animationDelay: '0.05s' }}>
          <select
            value={filterPeptide}
            onChange={e => setFilterPeptide(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm"
          >
            <option value="">All peptides</option>
            {peptideIds.map(id => (
              <option key={id} value={id}>{getPeptideById(id)?.name || id}</option>
            ))}
          </select>
        </div>
      )}

      {view === 'heatmap' && (
        <div className="stagger-item" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setMonth(subMonths(month, 1))} className="tap-target p-2 text-text-muted">&larr;</button>
            <p className="font-semibold text-sm">{format(month, 'MMMM yyyy')}</p>
            <button onClick={() => setMonth(addMonths(month, 1))} className="tap-target p-2 text-text-muted">&rarr;</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] text-text-muted py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const count = countByDate[key] || 0;
              return (
                <div
                  key={key}
                  className="aspect-square rounded-md flex items-center justify-center text-[10px] relative"
                  style={{ backgroundColor: heatColor(count) }}
                  title={`${key}: ${count} doses`}
                >
                  <span className={count > 0 ? 'text-primary font-medium' : 'text-text-muted'}>
                    {format(day, 'd')}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-[10px] text-text-muted">Less</span>
            {[0, 1, 2, 3, 4].map(n => (
              <div key={n} className="w-3 h-3 rounded-sm" style={{ backgroundColor: heatColor(n) }} />
            ))}
            <span className="text-[10px] text-text-muted">More</span>
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-1.5 stagger-item" style={{ animationDelay: '0.1s' }}>
          {sortedLogs.length === 0 && (
            <div className="card-glass p-8 text-center">
              <p className="text-text-muted text-sm">No dose logs yet</p>
            </div>
          )}
          {sortedLogs.map((log, i) => {
            const pep = getPeptideById(log.peptideId);
            return (
              <div key={log.id} className="card-glass p-3 flex items-center gap-3" style={{ animationDelay: `${0.02 * i}s` }}>
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pep?.name || log.peptideId}</p>
                  <p className="text-[10px] text-text-muted">
                    {log.dose}{log.unit} · {log.injectionSite || 'no site'} · {format(parseISO(log.createdAt), 'h:mm a')}
                  </p>
                </div>
                <span className="text-xs text-text-muted flex-shrink-0">{format(parseISO(log.date), 'MMM d')}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
