import { ABDOMEN_CLOCK } from '../data/injectionSites';

const CENTER = 110;
const RADIUS = 78;

export function AbdomenClockDial({ selected, onSelect }: { selected?: string; onSelect: (label: string) => void }) {
  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[260px] mx-auto" role="group" aria-label="Abdomen clock positions">
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#1e2a42" strokeWidth="1.5" />
      <circle cx={CENTER} cy={CENTER} r="6" fill="#64748b" />
      <text x={CENTER} y={CENTER + 22} textAnchor="middle" className="fill-current text-text-muted" fontSize="9">navel</text>
      {ABDOMEN_CLOCK.map(({ label, hour }) => {
        const angle = ((hour * 30) - 90) * (Math.PI / 180); // 12 at top
        const x = CENTER + RADIUS * Math.cos(angle);
        const y = CENTER + RADIUS * Math.sin(angle);
        const isSel = selected === label;
        return (
          <g key={label} className="cursor-pointer" onClick={() => onSelect(label)}>
            <circle cx={x} cy={y} r="16" fill={isSel ? '#22c55e' : '#334155'} opacity={isSel ? 0.5 : 0.25} />
            <text x={x} y={y + 3} textAnchor="middle" fontSize="10" className="fill-current">{hour}</text>
          </g>
        );
      })}
    </svg>
  );
}
