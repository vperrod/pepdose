import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { getAllDoseLogs } from '../db/operations';
import { zoneStats, daysSinceByLabel, type ZoneStat } from '../utils/injectionStats';
import { INJECTION_SITES } from '../data/injectionSites';
import { BodyMapSVG } from '../components/BodyMapSVG';
import type { DoseLog } from '../db/schema';

const idByLabel = Object.fromEntries(INJECTION_SITES.map(s => [s.label, s.id]));

export function InjectionMap() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [windowDays, setWindowDays] = useState(90);

  useEffect(() => { getAllDoseLogs().then(setLogs); }, []);

  const today = new Date();
  const stats: ZoneStat[] = zoneStats(logs, windowDays, today);
  const daysMap = daysSinceByLabel(logs, today);
  const daysById = Object.fromEntries(
    Object.entries(daysMap).map(([label, d]) => [idByLabel[label], d]).filter(([id]) => id),
  );
  const maxCount = Math.max(1, ...stats.map(s => s.count));

  return (
    <div className="safe-top px-5 pt-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="tap-target"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold flex-1">Injection Map</h1>
      </div>

      <div className="card-glass p-5 mb-4">
        <BodyMapSVG selectedSite={undefined} onSelectSite={() => {}} daysSinceMap={daysById} />
      </div>

      <div className="flex gap-2 mb-3">
        {[30, 90].map(w => (
          <button
            key={w}
            onClick={() => setWindowDays(w)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${
              windowDays === w ? 'bg-primary text-bg' : 'bg-card text-text-secondary border border-border'
            }`}
          >
            {w}d
          </button>
        ))}
      </div>

      <div className="card-glass p-4 space-y-2">
        {stats.length === 0 && <p className="text-sm text-text-muted">No logged sites in this window.</p>}
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="text-sm w-32 shrink-0">{s.label}</span>
            <div className="flex-1 h-2 rounded-full bg-card overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(s.count / maxCount) * 100}%` }} />
            </div>
            <span className="text-xs text-text-muted w-16 text-right">{s.count}× · {s.daysSince}d</span>
          </div>
        ))}
      </div>
    </div>
  );
}
