// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// __BUILD_TIME__ is injected by Vite's `define` at build time (vite.config.ts) —
// not present under vitest, so stub it before Settings.tsx evaluates the footer.
vi.stubGlobal('__BUILD_TIME__', 'test-build');

import { Settings } from './Settings';

// penMlPerClick feeds pen-click math app-wide (utils/penClicks.ts) — a bad
// default or a write that doesn't persist would silently mis-dose every
// screen that shows clicks.
const mocks = vi.hoisted(() => ({
  requestNotificationPermission: vi.fn(async () => true),
  scheduleReminders: vi.fn(async () => {}),
  showTestNotification: vi.fn(async () => {}),
  notificationsSupported: vi.fn(() => true),
  triggeredNotificationsSupported: vi.fn(() => false),
}));

vi.mock('../utils/notifications', () => ({
  requestNotificationPermission: mocks.requestNotificationPermission,
  scheduleReminders: mocks.scheduleReminders,
  showTestNotification: mocks.showTestNotification,
  notificationsSupported: mocks.notificationsSupported,
  triggeredNotificationsSupported: mocks.triggeredNotificationsSupported,
}));

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

function loadPersistedSettings() {
  const raw = localStorage.getItem('pepdose-settings');
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  localStorage.clear();
  mocks.requestNotificationPermission.mockClear();
  mocks.scheduleReminders.mockClear();
  mocks.notificationsSupported.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Settings defaults', () => {
  it('defaults pen click volume to 0.01 ml', () => {
    render(<Settings />);
    expect((screen.getByLabelText('Pen click volume') as HTMLSelectElement).value).toBe('0.01');
  });

  it('persists the default settings to localStorage on mount', () => {
    render(<Settings />);
    expect(loadPersistedSettings().penMlPerClick).toBe(0.01);
  });
});

describe('Settings pen click volume', () => {
  it('persists a changed pen click volume', async () => {
    render(<Settings />);
    await act(async () => {
      screen.getByLabelText('Pen click volume').dispatchEvent(new Event('change', { bubbles: true }));
    });
    const select = screen.getByLabelText('Pen click volume') as HTMLSelectElement;
    await act(async () => {
      select.value = '0.02';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(loadPersistedSettings().penMlPerClick).toBe(0.02);
  });
});

describe('Settings notification toggle', () => {
  it('enables notifications when permission is granted', async () => {
    await act(async () => {
      render(<Settings />);
    });
    await act(async () => {
      screen.getByRole('switch', { name: 'Toggle injection reminders' }).click();
    });
    expect(mocks.requestNotificationPermission).toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Toggle injection reminders' }).getAttribute('aria-checked')).toBe('true');
  });

  it('shows a blocked message when permission is denied', async () => {
    mocks.requestNotificationPermission.mockResolvedValueOnce(false);
    await act(async () => {
      render(<Settings />);
    });
    await act(async () => {
      screen.getByRole('switch', { name: 'Toggle injection reminders' }).click();
    });
    expect(screen.getByText(/Notifications are blocked/)).not.toBeNull();
  });
});
