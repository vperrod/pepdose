export type BodyView = 'front' | 'back';

export interface InjectionSite {
  id: string;
  label: string;
  view: BodyView;
  cx: number;
  cy: number;
  r: number;
}

export interface ClockSite {
  id: string;
  label: string;
  hour: number; // 1..12
}

// Coordinates carried over verbatim from the original BodyMapSVG BODY_SITES.
export const INJECTION_SITES: InjectionSite[] = [
  { id: 'left-abdomen', label: 'Left abdomen', view: 'front', cx: 82, cy: 185, r: 14 },
  { id: 'right-abdomen', label: 'Right abdomen', view: 'front', cx: 118, cy: 185, r: 14 },
  { id: 'left-thigh', label: 'Left thigh (outer)', view: 'front', cx: 72, cy: 265, r: 13 },
  { id: 'right-thigh', label: 'Right thigh (outer)', view: 'front', cx: 128, cy: 265, r: 13 },
  { id: 'left-deltoid', label: 'Left deltoid', view: 'front', cx: 55, cy: 115, r: 12 },
  { id: 'right-deltoid', label: 'Right deltoid', view: 'front', cx: 145, cy: 115, r: 12 },
  { id: 'left-glute', label: 'Left glute', view: 'back', cx: 80, cy: 215, r: 15 },
  { id: 'right-glute', label: 'Right glute', view: 'back', cx: 120, cy: 215, r: 15 },
];

export const SITE_LABELS: string[] = INJECTION_SITES.map(s => s.label);

export const ABDOMEN_CLOCK: ClockSite[] = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 1;
  return { id: `abdomen-c${hour}`, label: `Abdomen (${hour} o'clock)`, hour };
});
