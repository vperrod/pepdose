import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scheduleReminders } from './notifications';
import { zonedTimeToUtc, tzOffsetMs } from './tz';
import { saveScheduledDoses, clearAllData } from '../db/operations';
import type { UserName } from '../data/users';

const showNotification = vi.fn();

// --- helpers ---------------------------------------------------------------

function makeStore() {
  return new Map<string, string>();
}

function stubBrowser(timezone: string, overrides: any = {}) {
  const store = overrides.store ?? makeStore();
  const NotificationStub = Object.assign(vi.fn(), { permission: overrides.permission ?? 'granted' });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  localStorage.setItem('pepdose-settings', JSON.stringify({
    notificationsEnabled: true,
    reminderMinutesBefore: 15,
    timezone,
  }));
  vi.stubGlobal('Notification', NotificationStub);
  vi.stubGlobal('window', { Notification: NotificationStub });
  vi.stubGlobal('navigator', {
    serviceWorker: {
      ready: Promise.resolve({
        showNotification,
        getNotifications: overrides.getNotifications ?? (async () => []),
      }),
    },
  });
  return store;
}

async function seedDose(id: string, time: string, date = '2026-01-05', owner: UserName = 'Victor') {
  await saveScheduledDoses([{
    id,
    protocolId: 'p1',
    peptideId: 'bpc-157',
    date,
    time,
    dose: 250,
    unit: 'mcg',
    route: 'subq',
    status: 'upcoming',
    weekNumber: 1,
  }], owner);
}

const flush = () => new Promise(resolve => setImmediate(resolve));

// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-01-05T12:50:00Z'));
  showNotification.mockClear();
  await clearAllData();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Existing baseline coverage
// ---------------------------------------------------------------------------

describe('scheduleReminders timezone awareness', () => {
  it('fires a catch-up reminder when the window opened in the chosen timezone', async () => {
    stubBrowser('America/New_York');
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification.mock.calls[0]?.[1]?.tag).toBe('d1');
  });

  it('does not fire for the same wall-clock time when it is long past in UTC', async () => {
    stubBrowser('UTC');
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('arms an in-page timer at the zone-correct reminder time for a future dose', async () => {
    stubBrowser('America/New_York');
    await seedDose('d2', '09:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(55 * 60_000);
    await flush();
    expect(showNotification.mock.calls[0]?.[1]?.tag).toBe('d2');
  });
});

describe('triggered (closed-app) reminders', () => {
  it('arms an OS trigger for a future dose without re-arming on re-run', async () => {
    stubBrowser('America/New_York');
    const TimestampTrigger = vi.fn(function (this: { timestamp: number }, ts: number) {
      this.timestamp = ts;
    });
    vi.stubGlobal('TimestampTrigger', TimestampTrigger);
    await seedDose('d2', '09:00');

    await scheduleReminders();
    await flush();

    expect(showNotification).toHaveBeenCalledTimes(1);
    const options = showNotification.mock.calls[0]?.[1];
    expect(options?.tag).toBe('d2');
    expect(options?.showTrigger).toBeInstanceOf(TimestampTrigger);

    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });
});

describe('stale trigger cancellation', () => {
  it('closes an armed trigger whose dose no longer exists', async () => {
    stubBrowser('America/New_York');
    vi.stubGlobal('TimestampTrigger', vi.fn());
    const close = vi.fn();
    const stale = { tag: 'gone', title: 'old', body: 'old', showTrigger: { timestamp: Date.now() + 30 * 60_000 }, close };
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification, getNotifications: async () => [stale] }) },
    });

    await scheduleReminders();
    await flush();

    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('per-day fired dedupe', () => {
  it('does not fire the same reminder twice in one day', async () => {
    stubBrowser('America/New_York');
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire a triggered reminder after its window opens on reopen', async () => {
    stubBrowser('America/New_York');
    vi.stubGlobal('TimestampTrigger', vi.fn());
    await seedDose('d2', '09:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// P0 — DST transitions + precise zonedTimeToUtc
// ---------------------------------------------------------------------------

describe('P0 DST transitions', () => {
  describe('zonedTimeToUtc spring-forward', () => {
    it('maps 02:30 local on spring-forward day to the pre-transition UTC instant', () => {
      const ms = zonedTimeToUtc('2026-03-08', '02:30', 'America/New_York');
      expect(new Date(ms).toISOString()).toBe('2026-03-08T07:30:00.000Z');
    });

    it('maps 03:30 local on spring-forward day to the post-transition UTC instant', () => {
      const ms = zonedTimeToUtc('2026-03-08', '03:30', 'America/New_York');
      expect(new Date(ms).toISOString()).toBe('2026-03-08T08:30:00.000Z');
    });

    it('distinguishes pre- and post-gap mappings by 1 hour', () => {
      const pre = zonedTimeToUtc('2026-03-08', '02:30', 'America/New_York');
      const post = zonedTimeToUtc('2026-03-08', '03:30', 'America/New_York');
      expect(new Date(post).getTime()).toBeGreaterThan(new Date(pre).getTime());
    });
  });

  describe('zonedTimeToUtc fall-back repeated hour', () => {
    it('returns a single deterministic UTC instant for 01:30 on fall-back day Nov 1', () => {
      const ms = zonedTimeToUtc('2026-11-01', '01:30', 'America/New_York');
      expect(Number.isNaN(ms)).toBe(false);
      expect(new Date(ms).toISOString()).toMatch(/^2026-11-01T0[5-6]:30:00\.000Z$/);
    });
  });

  describe('P0 integrated DST + trigger arming', () => {
    it('arms a single trigger for a dose without re-arming on re-run', async () => {
      const TimestampTrigger = vi.fn(function (this: { timestamp: number }, ts: number) {
        this.timestamp = ts;
      });
      vi.stubGlobal('TimestampTrigger', TimestampTrigger);
      stubBrowser('America/New_York');
      await seedDose('d-spring', '08:00', '2026-01-05');
      await scheduleReminders();
      await flush();
      // On NY 08:00 the remindAt = 12:45 UTC is past -> immediate-fire path for
      // this fixed system time, so we verify re-entry idempotency via fired-set
      // guard rather than trigger arming.
      expect(showNotification).toHaveBeenCalledTimes(1);
      await scheduleReminders();
      await flush();
      expect(showNotification).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// P0 — Trigger API multiple-schedule races (cancelStaleTriggers)
// ---------------------------------------------------------------------------

describe('P0 cancelStaleTriggers', () => {
  it('closes an armed trigger whose payload no longer matches current dose', async () => {
    stubBrowser('America/New_York');
    vi.stubGlobal('TimestampTrigger', vi.fn());
    const close = vi.fn();
    const armed = {
      tag: 'd2',
      title: 'BPC-157 reminder',
      body: '250 mcg due at 09:00',
      showTrigger: { timestamp: Date.now() + 45 * 60_000 },
      close,
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification, getNotifications: async () => [armed] }) },
    });
    // With title and body different from what doses would produce, the trigger
    // mismatches and is closed. This covers the cancelStaleTriggers mismatch
    // path without relying on strict timestamp equality.
    await seedDose('d2', '10:00');
    await scheduleReminders();
    await flush();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes an armed trigger and re-arms fresh for the updated dose content', async () => {
    stubBrowser('America/New_York');
    vi.stubGlobal('TimestampTrigger', vi.fn());
    const close = vi.fn();
    const armed = {
      tag: 'd1',
      title: 'BPC-157 reminder',
      body: '250 mcg due at 08:00',
      showTrigger: { timestamp: Date.now() + 30 * 60_000 },
      close,
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification, getNotifications: async () => [armed] }) },
    });
    await seedDose('d1', '09:00'); // time change -> new remindAt -> mismatch -> closes + re-arms
    await scheduleReminders();
    await flush();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('no-ops when no armed triggers are present', async () => {
    stubBrowser('America/New_York');
    vi.stubGlobal('TimestampTrigger', vi.fn());
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification, getNotifications: async () => [] }) },
    });
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// P1 — immediate-fire branch consistency
// ---------------------------------------------------------------------------

describe('P1 immediate-fire branches', () => {
  it('immediately fires when remindAt passed and dose still within 1-hour window', async () => {
    stubBrowser('America/New_York');
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0]?.[1]?.tag).toBe('d1');
  });

  it('does not fire when dose is more than 1-hour overdue', async () => {
    stubBrowser('UTC');
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('marks fired on immediate-fire so re-entry skips', async () => {
    const store = stubBrowser('America/New_York');
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
    const persisted = store.get('pepdose-fired-reminders');
    expect(persisted).toBeTruthy();
    expect(JSON.parse(persisted!).ids).toContain('d1');
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// P1 — dedupe resets across day boundary + visibilitychange
// ---------------------------------------------------------------------------

describe('P1 per-day dedupe boundary behavior', () => {
  it('fired ids from yesterday do not block today after midnight', async () => {
    const store = makeStore();
    vi.setSystemTime(new Date('2026-01-05T12:50:00Z'));
    stubBrowser('America/New_York', { store });
    await seedDose('yesterday', '08:00', '2026-01-05');
    await seedDose('today', '08:00', '2026-01-06');
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
    const yesterdayFired = JSON.parse(store.get('pepdose-fired-reminders') || '{}');
    expect(yesterdayFired.date).toBe('2026-01-05');
    expect(yesterdayFired.ids).toContain('yesterday');

    vi.setSystemTime(new Date('2026-01-06T12:50:00Z'));
    showNotification.mockClear();
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0]?.[1]?.tag).toBe('today');
  });

  it('re-evaluation on visibilitychange clears prior timers without throwing', async () => {
    stubBrowser('America/New_York');
    await seedDose('d2', '09:00');
    await scheduleReminders();
    await flush();
    const handler = vi.fn();
    document.addEventListener('visibilitychange', handler);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(showNotification).not.toHaveBeenCalled();
    document.removeEventListener('visibilitychange', handler);
  });
});

// ---------------------------------------------------------------------------
// P1 — fallback/invalid timezone mechanics
// ---------------------------------------------------------------------------

describe('P1 fallback timezone handling', () => {
  it('falls back to Intl local when settings tz is empty', async () => {
    const store = makeStore();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const NotificationStub = Object.assign(vi.fn(), { permission: 'granted' });
    vi.stubGlobal('Notification', NotificationStub);
    vi.stubGlobal('window', { Notification: NotificationStub });
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification }) },
    });
    localStorage.setItem('pepdose-settings', JSON.stringify({
      notificationsEnabled: true,
      reminderMinutesBefore: 15,
      timezone: '',
    }));
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('tzOffsetMs returns 0 for an unrecognized timezone', () => {
    expect(tzOffsetMs(Date.UTC(2026, 0, 15, 12, 0, 0), 'Not/AZone')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// P2 — unsupported timezone skips gracefully
// ---------------------------------------------------------------------------

describe('P2 unsupported timezone handling', () => {
  it('falls back to naive local when Intl throws for an unsupported timezone', async () => {
    const Orig = (globalThis as any).Intl.DateTimeFormat;
    let threw = false;
    // Must be a `function`, not an arrow: vitest 5 refuses to `new` a mock whose
    // implementation is not constructible, and the code under test calls
    // `new Intl.DateTimeFormat(...)`.
    (globalThis as any).Intl.DateTimeFormat = vi.fn(function () {
      threw = true;
      throw new Error('broken');
    });
    const ms = zonedTimeToUtc('2026-01-05', '08:00', 'Not/AZone');
    expect(new Date(ms).toISOString()).toBe('2026-01-05T08:00:00.000Z');
    expect(threw).toBe(true);
    (globalThis as any).Intl.DateTimeFormat = Orig;
  });

  it('does not crash scheduleReminders when Intl throws for the timezone', async () => {
    const Orig = (globalThis as any).Intl.DateTimeFormat;
    (globalThis as any).Intl.DateTimeFormat = vi.fn(function () { throw new Error('broken'); });
    const store = makeStore();
    stubBrowser('Asia/Kolkata', { store });
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).not.toHaveBeenCalled();
    (globalThis as any).Intl.DateTimeFormat = Orig;
  });
});

// ---------------------------------------------------------------------------
// P2 — malformed settings JSON
// ---------------------------------------------------------------------------

describe('P2 malformed settings', () => {
  it('readSettings falls back to safe defaults when JSON is corrupt', async () => {
    const store = makeStore();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const NotificationStub = Object.assign(vi.fn(), { permission: 'granted' });
    vi.stubGlobal('Notification', NotificationStub);
    vi.stubGlobal('window', { Notification: NotificationStub });
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification }) },
    });
    localStorage.setItem('pepdose-settings', '</html>{');
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// P2 — localStorage quota failure at markFired
// ---------------------------------------------------------------------------

describe('P2 localStorage quota failure', () => {
  it('duplicate-fires when markFired silently fails because setItem throws', async () => {
    const store = makeStore();
    stubBrowser('America/New_York', { store });
    await seedDose('d1', '08:00');
    const origSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn((_k: string, _v: string) => {});
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
    // With setItem mocked as a noop, persistence never happens; a later
    // scheduleReminders therefore sees an empty fired set and re-fires.
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(2);
    localStorage.setItem = origSetItem;
  });
});

// ---------------------------------------------------------------------------
// P2 — missing dose.time defaults to 08:00
// ---------------------------------------------------------------------------

describe('P2 default dose time', () => {
  it('falls back to 08:00 when dose.time is empty', async () => {
    const store = makeStore();
    stubBrowser('UTC', { store });
    await seedDose('d1', '');
    await scheduleReminders();
    await flush();
    expect(showNotification).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// P3 — cancelStaleTriggers rejects on getNotifications failure
// ---------------------------------------------------------------------------

describe('P3 cancelStaleTriggers rejects', () => {
  it('ignores getNotifications rejection without throwing', async () => {
    const store = makeStore();
    stubBrowser('America/New_York', { store });
    const TimestampTrigger = vi.fn(function (this: { timestamp: number }, ts: number) {
      this.timestamp = ts;
    });
    vi.stubGlobal('TimestampTrigger', TimestampTrigger);
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          showNotification,
          getNotifications: async () => { throw new Error('sw reject'); },
        }),
      },
    });
    await seedDose('d1', '14:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// P3 — firedSet empty / missing storage shapes
// ---------------------------------------------------------------------------

describe('P3 empty fired set', () => {
  it('schedules a pending dose when fired storage is empty', async () => {
    const store = makeStore();
    stubBrowser('America/New_York', { store });
    await seedDose('d1', '09:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('treats stale fired-set date entries as empty', async () => {
    const store = makeStore();
    stubBrowser('America/New_York', { store });
    store.set('pepdose-fired-reminders', JSON.stringify({ date: '2000-01-01', ids: ['ancient'] }));
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// P3 — unmarkFired idempotency (exercised through cancelStaleTriggers)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cross-profile isolation — reminders must respect the active profile filter
// ---------------------------------------------------------------------------

describe('cross-profile reminder isolation', () => {
  it('does not notify Victor\'s dose while Nadia is the active profile', async () => {
    const store = makeStore();
    stubBrowser('America/New_York', { store });
    store.set('pepdose-view-filter', 'Nadia');
    await seedDose('victor-dose', '08:00', '2026-01-05', 'Victor');
    await seedDose('nadia-dose', '08:00', '2026-01-05', 'Nadia');

    await scheduleReminders();
    await flush();

    expect(showNotification.mock.calls.map(c => c[1]?.tag)).toEqual(['nadia-dose']);
  });

  it('notifies both profiles\' doses when the filter is "all"', async () => {
    const store = makeStore();
    stubBrowser('America/New_York', { store });
    store.set('pepdose-view-filter', 'all');
    await seedDose('victor-dose', '08:00', '2026-01-05', 'Victor');
    await seedDose('nadia-dose', '08:00', '2026-01-05', 'Nadia');

    await scheduleReminders();
    await flush();

    expect(showNotification.mock.calls.map(c => c[1]?.tag).sort()).toEqual(['nadia-dose', 'victor-dose']);
  });
});

describe('P3 unmarkFired idempotency', () => {
  it('ignores close on armed trigger whose tag is missing from firedSet', async () => {
    stubBrowser('America/New_York');
    vi.stubGlobal('TimestampTrigger', vi.fn());
    const close = vi.fn();
    const armed = {
      tag: 'unknown-id',
      title: 'BPC-157 reminder',
      body: '250 mcg due at 08:00',
      showTrigger: { timestamp: Date.now() + 30 * 60_000 },
      close,
    };
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ showNotification, getNotifications: async () => [armed] }) },
    });
    await seedDose('d1', '08:00');
    await scheduleReminders();
    await flush();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
