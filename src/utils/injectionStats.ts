import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { DoseLog } from '../db/schema';

type SiteLog = Pick<DoseLog, 'injectionSite' | 'date'>;

export interface ZoneStat {
  label: string;
  count: number;
  lastUsed?: string;
  daysSince?: number;
}

export function zoneStats(logs: SiteLog[], windowDays: number, today: Date): ZoneStat[] {
  const byLabel = new Map<string, { count: number; lastUsed: string }>();
  for (const l of logs) {
    if (!l.injectionSite) continue;
    if (differenceInCalendarDays(today, parseISO(l.date)) >= windowDays) continue;
    const cur = byLabel.get(l.injectionSite);
    if (!cur) byLabel.set(l.injectionSite, { count: 1, lastUsed: l.date });
    else {
      cur.count += 1;
      if (l.date > cur.lastUsed) cur.lastUsed = l.date;
    }
  }
  return [...byLabel.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      lastUsed: v.lastUsed,
      daysSince: differenceInCalendarDays(today, parseISO(v.lastUsed)),
    }))
    .sort((a, b) => (a.daysSince ?? 999) - (b.daysSince ?? 999) || b.count - a.count);
}

export function daysSinceByLabel(logs: SiteLog[], today: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of logs) {
    if (!l.injectionSite) continue;
    const d = differenceInCalendarDays(today, parseISO(l.date));
    if (out[l.injectionSite] === undefined || d < out[l.injectionSite]) out[l.injectionSite] = d;
  }
  return out;
}

export function mostRestedLabel(labels: string[], daysSince: Record<string, number>): string {
  const unused = labels.find(l => daysSince[l] === undefined);
  if (unused) return unused;
  return labels.reduce((best, l) => (daysSince[l] > daysSince[best] ? l : best), labels[0]);
}
