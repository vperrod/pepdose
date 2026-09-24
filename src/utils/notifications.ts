import { format } from 'date-fns';
import { getScheduledDosesForDate, getDoseLogsForDate } from '../db/operations';
import { getPeptideById } from '../data/peptides';
import { zonedTimeToUtc } from './tz';
import { filterByOwner } from '../context/ownerFilter';
import { readStoredSettings } from './storedSettings';

const VIEW_FILTER_KEY = 'pepdose-view-filter';

/** Mirrors ViewFilterContext's storage read — notifications.ts is a plain
 *  module (armed from a timer/SW callback), not a component, so it can't use
 *  the React context and reads the same localStorage key directly. */
function activeOwnerFilter() {
  const raw = localStorage.getItem(VIEW_FILTER_KEY);
  return raw === 'Victor' || raw === 'Nadia' ? raw : 'all';
}

/**
 * Local-first dose reminders.
 *
 * pepdose has no backend, so there is no server push. Reminders are scheduled
 * with in-page timers and fired through the service worker registration
 * (`showNotification`) so they render as real OS notifications. This works
 * whenever the app (or its tab) is alive; it cannot wake a fully-closed app the
 * way a push server would. On app open / tab focus we re-evaluate and fire any
 * reminder whose window opened while we were away (deduped per day).
 */

interface AppSettings {
  notificationsEnabled: boolean;
  reminderMinutesBefore: number;
  timezone: string;
}

const FIRED_KEY = 'pepdose-fired-reminders';

function readSettings(): AppSettings {
  const parsed = readStoredSettings();
  return {
    notificationsEnabled: !!parsed.notificationsEnabled,
    reminderMinutesBefore: typeof parsed.reminderMinutesBefore === 'number' && Number.isFinite(parsed.reminderMinutesBefore) ? parsed.reminderMinutesBefore : 15,
    timezone: typeof parsed.timezone === 'string' && parsed.timezone ? parsed.timezone : (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'),
  };
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function canNotify(): boolean {
  return notificationsSupported() && Notification.permission === 'granted';
}

// --- per-day dedupe of fired reminders -------------------------------------

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function firedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.date === todayStr()) return new Set<string>(parsed.ids);
  } catch { /* ignore */ }
  return new Set();
}

function markFired(id: string) {
  const set = firedSet();
  set.add(id);
  localStorage.setItem(FIRED_KEY, JSON.stringify({ date: todayStr(), ids: [...set] }));
}

function unmarkFired(id: string) {
  const set = firedSet();
  if (!set.delete(id)) return;
  localStorage.setItem(FIRED_KEY, JSON.stringify({ date: todayStr(), ids: [...set] }));
}

// --- scheduled (triggered) notifications for closed-app delivery -----------

/** True where the Notification Triggers API lets a notification fire at a future
 *  timestamp even if the app is fully closed (Chrome/Edge on Android). */
export function triggeredNotificationsSupported(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return notificationsSupported() && typeof (globalThis as any).TimestampTrigger === 'function';
}

/**
 * Arm a dose reminder that can fire even when the app is closed, using the
 * Notification Triggers API. Falls back to the in-page timer path (caller's
 * responsibility) when unsupported. The timestamp is computed in the user's
 * chosen timezone so travel doesn't shift the dose time.
 */
export async function scheduleTriggeredReminder(
  id: string,
  title: string,
  body: string,
  doseAt: number,
  url: string,
): Promise<boolean> {
  if (!triggeredNotificationsSupported()) return false;
  if (doseAt <= Date.now()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trigger = new (globalThis as any).TimestampTrigger(doseAt);
    // showTrigger is a Notification Triggers API extension not yet in lib.dom.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      body,
      tag: id,
      icon: import.meta.env.BASE_URL + 'icons/icon-192.svg',
      badge: import.meta.env.BASE_URL + 'icons/icon-192.svg',
      data: { url },
      showTrigger: trigger,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (reg.showNotification as any)(title, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Close armed-but-not-yet-fired OS triggers whose dose was edited or no longer
 * exists (tag = dose id), and unmark them so the caller re-arms from current
 * truth. Already-shown notifications are left alone. No-op where the Triggers
 * API is absent.
 */
async function cancelStaleTriggers(
  items: { dose: { id: string }; remindAt: number; title: string; body: string }[],
  now: number,
): Promise<void> {
  if (!triggeredNotificationsSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // includeTriggered lists armed-but-not-yet-shown triggered notifications.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const armed: any[] = await (reg.getNotifications as any)({ includeTriggered: true });
    const current = new Map(items.map((i) => [i.dose.id, i]));
    for (const n of armed) {
      if (!n.showTrigger || n.showTrigger.timestamp <= now) continue; // shown or not triggered: leave it
      const match = current.get(n.tag);
      if (match && match.remindAt === n.showTrigger.timestamp && match.title === n.title && match.body === n.body) continue;
      n.close();
      unmarkFired(n.tag);
    }
  } catch { /* ignore */ }
}

async function show(title: string, body: string, tag: string, url: string) {
  if (!canNotify()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      tag,
      icon: import.meta.env.BASE_URL + 'icons/icon-192.svg',
      badge: import.meta.env.BASE_URL + 'icons/icon-192.svg',
      data: { url },
    });
  } catch {
    try { new Notification(title, { body, tag }); } catch { /* ignore */ }
  }
}

export async function showTestNotification() {
  await show(
    'pepdose reminders are on',
    "You'll get a nudge before each scheduled dose while the app is open.",
    'pepdose-test',
    import.meta.env.BASE_URL,
  );
}

// --- scheduling ------------------------------------------------------------

let timers: ReturnType<typeof setTimeout>[] = [];

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

/**
 * Recompute and (re)arm reminders for today's still-pending doses. Safe to call
 * repeatedly — it clears prior timers first. Reminders already fired today are
 * skipped via the per-day dedupe set.
 */
export async function scheduleReminders(): Promise<void> {
  clearTimers();
  const settings = readSettings();
  if (!settings.notificationsEnabled || !canNotify()) return;

  const today = todayStr();
  const ownerFilter = activeOwnerFilter();
  const [scheduledAll, logsAll] = await Promise.all([
    getScheduledDosesForDate(today),
    getDoseLogsForDate(today),
  ]);
  const scheduled = filterByOwner(scheduledAll, ownerFilter);
  const logs = filterByOwner(logsAll, ownerFilter);
  const loggedIds = new Set(logs.map(l => l.scheduledDoseId).filter(Boolean));
  const pending = scheduled.filter(d => d.status === 'upcoming' && !loggedIds.has(d.id));

  const now = Date.now();
  const lead = settings.reminderMinutesBefore * 60_000;

  const items = pending.flatMap((dose) => {
    const doseAt = zonedTimeToUtc(dose.date, dose.time || '08:00', settings.timezone);
    if (Number.isNaN(doseAt)) return [];
    const pep = getPeptideById(dose.peptideId);
    return [{
      dose,
      doseAt,
      remindAt: doseAt - lead,
      title: `${pep?.name ?? 'Dose'} reminder`,
      body: `${dose.dose} ${dose.unit} due at ${dose.time}${dose.owner ? ` · ${dose.owner}` : ''}`,
      url: import.meta.env.BASE_URL + 'log',
    }];
  });

  // An OS trigger armed for a since-edited/deleted dose would still fire with
  // the old info — close those before (re-)arming.
  await cancelStaleTriggers(items, now);

  for (const { dose, doseAt, remindAt, title, body, url } of items) {
    if (firedSet().has(dose.id)) continue;

    // Window already open (reminder time passed but the dose isn't long overdue):
    // fire immediately so a reopened app still nudges you.
    if (remindAt <= now && doseAt + 60 * 60_000 > now) {
      markFired(dose.id);
      void show(title, body, dose.id, url);
      continue;
    }

    if (remindAt > now) {
      // Prefer a triggered notification so it still fires if the app is closed.
      // Where unsupported, fall back to an in-page timer (fires only while open/backgrounded).
      const armed = await scheduleTriggeredReminder(dose.id, title, body, remindAt, url);
      if (armed) {
        // The OS will fire this even if the app is closed; record it now so a
        // later reopen doesn't re-show it via the immediate-fire branch.
        markFired(dose.id);
      } else {
        const timer = setTimeout(() => {
          markFired(dose.id);
          void show(title, body, dose.id, url);
        }, remindAt - now);
        timers.push(timer);
      }
    }
  }
}

/**
 * Wire reminders to the app lifecycle: schedule now, and re-schedule whenever
 * the tab regains focus (covers day rollover and reminders that came due while
 * the app was backgrounded). Returns a cleanup function.
 */
export function initReminders(): () => void {
  void scheduleReminders();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void scheduleReminders();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  return () => {
    clearTimers();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
}
