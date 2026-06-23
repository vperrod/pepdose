import { getPeptideById } from '../data/peptides';
import type { ScheduledDose } from '../db/schema';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function canNotify(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

export function scheduleNotification(dose: ScheduledDose, minutesBefore = 0): number | null {
  if (!canNotify()) return null;

  const [hours, minutes] = (dose.time || '08:00').split(':').map(Number);
  const target = new Date(dose.date);
  target.setHours(hours, minutes - minutesBefore, 0, 0);

  const delay = target.getTime() - Date.now();
  if (delay <= 0) return null;

  const pep = getPeptideById(dose.peptideId);
  const name = pep?.name || dose.peptideId;

  const timerId = window.setTimeout(() => {
    new Notification(`Time for ${name}`, {
      body: `${dose.dose}${dose.unit} — ${dose.route || 'SubQ'}`,
      icon: '/icons/icon-192.svg',
      tag: dose.id,
      requireInteraction: true,
    });
  }, delay);

  return timerId;
}

export function scheduleDayNotifications(doses: ScheduledDose[]): number[] {
  const settings = loadNotificationSettings();
  if (!settings.enabled) return [];

  const timerIds: number[] = [];
  for (const dose of doses) {
    if (dose.status !== 'upcoming') continue;
    const id = scheduleNotification(dose, settings.minutesBefore);
    if (id !== null) timerIds.push(id);
  }
  return timerIds;
}

export function clearScheduledNotifications(timerIds: number[]) {
  for (const id of timerIds) {
    window.clearTimeout(id);
  }
}

interface NotificationSettings {
  enabled: boolean;
  minutesBefore: number;
}

function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem('pepdose-settings');
    if (!raw) return { enabled: false, minutesBefore: 15 };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.notificationsEnabled ?? false,
      minutesBefore: parsed.reminderMinutesBefore ?? 15,
    };
  } catch {
    return { enabled: false, minutesBefore: 15 };
  }
}
