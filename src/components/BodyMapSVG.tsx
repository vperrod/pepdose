import { useState } from 'react';
import { INJECTION_SITES, type BodyView } from '../data/injectionSites';

interface BodyMapProps {
  selectedSite?: string;
  onSelectSite: (siteId: string) => void;
  daysSinceMap?: Record<string, number>;
}

function getSiteColor(days: number | undefined): string {
  if (days === undefined) return '#64748b';
  if (days > 7) return '#22c55e';
  if (days >= 3) return '#f59e0b';
  return '#ef4444';
}

export function BodyMapSVG({ selectedSite, onSelectSite, daysSinceMap = {} }: BodyMapProps) {
  const [view, setView] = useState<BodyView>('front');

  const currentSites = INJECTION_SITES.filter(s => s.view === view);

  return (
    <div>
      <div className="flex gap-2 mb-3 justify-center">
        <button
          onClick={() => setView('front')}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            view === 'front' ? 'bg-primary text-bg' : 'bg-card text-text-secondary border border-border'
          }`}
        >
          Front
        </button>
        <button
          onClick={() => setView('back')}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            view === 'back' ? 'bg-primary text-bg' : 'bg-card text-text-secondary border border-border'
          }`}
        >
          Back
        </button>
      </div>

      <svg viewBox="0 0 200 360" className="w-full max-w-[240px] mx-auto" role="img" aria-label={`Body map ${view} view`}>
        {/* Body outline */}
        <g stroke="#1e2a42" strokeWidth="1.5" fill="none" opacity="0.6">
          {/* Head */}
          <ellipse cx="100" cy="40" rx="22" ry="26" />
          {/* Neck */}
          <line x1="90" y1="66" x2="90" y2="80" />
          <line x1="110" y1="66" x2="110" y2="80" />
          {/* Shoulders */}
          <path d="M90,80 Q70,82 48,100" />
          <path d="M110,80 Q130,82 152,100" />
          {/* Torso */}
          <path d="M48,100 L42,108 L40,160 Q42,200 65,230" />
          <path d="M152,100 L158,108 L160,160 Q158,200 135,230" />
          {/* Arms */}
          <path d="M42,108 Q32,140 28,175 Q26,185 30,190" />
          <path d="M158,108 Q168,140 172,175 Q174,185 170,190" />
          {/* Legs */}
          <path d="M65,230 L60,290 Q58,320 62,350" />
          <path d="M135,230 L140,290 Q142,320 138,350" />
          <path d="M65,230 Q95,240 100,240 Q105,240 135,230" />
          {/* Inner legs */}
          <path d="M85,230 L88,290 Q90,320 86,350" />
          <path d="M115,230 L112,290 Q110,320 114,350" />
        </g>

        {/* Injection sites */}
        {currentSites.map(site => {
          const days = daysSinceMap[site.id];
          const color = getSiteColor(days);
          const isSelected = selectedSite === site.id;

          return (
            <g key={site.id} className="cursor-pointer" onClick={() => onSelectSite(site.id)}>
              <circle
                cx={site.cx}
                cy={site.cy}
                r={site.r + 4}
                fill={color}
                opacity={isSelected ? 0.3 : 0.1}
                className="transition-opacity"
              />
              <circle
                cx={site.cx}
                cy={site.cy}
                r={site.r}
                fill={color}
                opacity={isSelected ? 0.5 : 0.25}
                stroke={isSelected ? color : 'none'}
                strokeWidth={isSelected ? 2 : 0}
                className="transition-all"
              />
              <circle
                cx={site.cx}
                cy={site.cy}
                r={4}
                fill={color}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex justify-center gap-4 mt-3 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success inline-block" /> 7+ days
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-warning inline-block" /> 3-7 days
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-danger inline-block" /> &lt;3 days
        </span>
      </div>
    </div>
  );
}
