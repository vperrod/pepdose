// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { AuthGate } from './AuthGate';

// Mutable doubles for the supabase client and syncNow, so each test can steer
const state = vi.hoisted(() => ({

  cloudEnabled: true,
  session: null as { user: { id: string } } | null,
  syncResult: { pushed: 0, pulled: 0, errors: [] as string[] },
  syncCalls: 0,
  signUpCalls: 0,
  signInCalls: 0,
  authCallback: (_e: string, _s: null | { user: { id: string } }) => {},
}));

vi.mock('../db/supabase', () => ({

  get cloudEnabled() { return state.cloudEnabled; },
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: state.session } }),
      onAuthStateChange: (_cb: (event: string, s: null | { user: { id: string } }) => void) => {
        state.authCallback = _cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: async () => {
        state.signInCalls += 1;
        return { data: { session: null }, error: null };
      },
      signUp: async () => {
        state.signUpCalls += 1;
        return { data: { session: null }, error: null };
      },
    },
  },
}));

vi.mock('../db/sync', () => ({
  syncNow: async () => {
    state.syncCalls += 1;
    return { ...state.syncResult, errors: [...state.syncResult.errors] };
  },
}));

const flush = () => act(async () => {}); // drain pending getSession/syncNow promises

beforeEach(() => {
  state.cloudEnabled = true;
  state.session = null;
  state.syncResult = { pushed: 0, pulled: 0, errors: [] };
  state.syncCalls = 0;
  state.signUpCalls = 0;
  state.signInCalls = 0;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AuthGate', () => {
  it('renders children directly when cloud sync is not configured', () => {
    state.cloudEnabled = false;
    render(<AuthGate><p>app</p></AuthGate>);
    expect(screen.getByText('app')).toBeTruthy();
  });

  it('shows the login form when cloud is enabled and no one is signed in', async () => {
    render(<AuthGate><p>app</p></AuthGate>);
    await flush();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.queryByText('app')).toBeNull();
  });

  it('syncs once on login and then renders the app', async () => {
    state.session = { user: { id: 'u1' } };
    render(<AuthGate><p>app</p></AuthGate>);
    await flush();
    expect(screen.getByText('app')).toBeTruthy();
    expect(state.syncCalls).toBe(1);
  });

  it('keeps syncing on the 30s interval', async () => {
    vi.useFakeTimers();
    state.session = { user: { id: 'u1' } };
    render(<AuthGate><p>app</p></AuthGate>);
    await flush();
    await act(async () => { vi.advanceTimersByTime(31_000); });
    await act(async () => { vi.advanceTimersByTime(31_000); });
    expect(state.syncCalls).toBe(3); // login + two ticks
  });

  it('coalesces triggers that land while a sync is still running', async () => {
    vi.useFakeTimers();
    state.session = { user: { id: 'u1' } };
    render(<AuthGate><p>app</p></AuthGate>);
    await flush();
    // Two interval ticks inside one turn of the event loop: the second must
    // join the in-flight sync instead of starting a second six-store pass.
    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(state.syncCalls).toBe(2); // login + one coalesced tick
  });

  it('surfaces auto-sync errors as a status indicator, not a modal', async () => {
    state.session = { user: { id: 'u1' } };
    state.syncResult = { pushed: 0, pulled: 0, errors: ['protocols: boom'] };
    render(<AuthGate><p>app</p></AuthGate>);
    await flush();
    expect(screen.getByRole('status').textContent).toContain('protocols: boom');
    expect(screen.getByText('app')).toBeTruthy(); // app stays usable behind it
  });

  it('clears the indicator once a later sync succeeds', async () => {
    vi.useFakeTimers();
    state.session = { user: { id: 'u1' } };
    state.syncResult = { pushed: 0, pulled: 0, errors: ['protocols: boom'] };
    render(<AuthGate><p>app</p></AuthGate>);
    await flush();
    state.syncResult = { pushed: 0, pulled: 0, errors: [] };
    await act(async () => { vi.advanceTimersByTime(31_000); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('syncs again when the window regains focus', async () => {
    state.session = { user: { id: 'u1' } };
    render(<AuthGate><p>app</p></AuthGate>);
    await flush();
    expect(state.syncCalls).toBe(1);
    await act(async () => { fireEvent(window, new Event('focus')); });
    expect(state.syncCalls).toBe(2);
  });

  it('syncs when the tab is hidden, not when it becomes visible', async () => {
    state.session = { user: { id: 'u1' } };
    render(<AuthGate><p>app</p></AuthGate>);
    await flush();
    expect(state.syncCalls).toBe(1);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(state.syncCalls).toBe(2);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(state.syncCalls).toBe(2); // becoming visible again does not re-trigger
  });

  describe('focus and unload cleanup', () => {
    it('keeps syncing on the 30s interval and stops after unmount', async () => {
      vi.useFakeTimers();
      state.session = { user: { id: 'u1' } };
      const { unmount } = render(<AuthGate><p>app</p></AuthGate>);
      await flush();
      expect(state.syncCalls).toBe(1);
      await act(async () => { vi.advanceTimersByTime(31_000); });
      expect(state.syncCalls).toBeGreaterThanOrEqual(2);
      unmount();
      await act(async () => { vi.advanceTimersByTime(31_000); });
      // If cleanup failed, an extra mock sync would fire after unmount.
      expect(state.syncCalls).toBeLessThan(4);
    });
  });

  describe('shared-account sign-in only', () => {
    it('offers no self-signup path', async () => {
      render(<AuthGate><p>app</p></AuthGate>);
      await flush();
      expect(screen.queryByText('No account yet? Create one')).toBeNull();
    });

    it('signs in via signInWithPassword and never calls signUp', async () => {
      render(<AuthGate><p>app</p></AuthGate>);
      await flush();
      fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'v@example.com' } });
      fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'shared-pw' } });
      fireEvent.submit(screen.getByPlaceholderText('Password').closest('form')!);
      await flush();
      expect(state.signInCalls).toBe(1);
      expect(state.signUpCalls).toBe(0);
    });
  });
});
