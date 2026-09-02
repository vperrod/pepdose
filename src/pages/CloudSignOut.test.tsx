// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ExportImport } from './ExportImport';

// Sign-out has to leave nothing behind: the next account to sign in on this device
// reads the same IndexedDB, so a stale row set leaks across accounts (and gets
// re-uploaded under the new user id).
const mocks = vi.hoisted(() => ({
  clearAllData: vi.fn(async () => {}),
  resetSyncCursor: vi.fn(),
  syncNow: vi.fn(async () => ({ pushed: 0, pulled: 0, errors: [] as string[] })),
  signOut: vi.fn(async () => {}),
}));

vi.mock('../db/operations', () => ({
  exportAllData: async () => '{}',
  importData: async () => {},
  clearAllData: mocks.clearAllData,
}));

vi.mock('../db/supabase', () => ({
  cloudEnabled: true,
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { email: 'shared@example.com' } } }),
      signOut: mocks.signOut,
    },
  },
}));

vi.mock('../db/sync', () => ({
  resetSyncCursor: mocks.resetSyncCursor,
  syncNow: mocks.syncNow,
}));

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../context/ViewFilterContext', () => ({ useViewFilter: () => ({ filter: 'all', setFilter: () => {} }) }));

const clickSignOut = async () => {
  await act(async () => {
    render(<ExportImport />);
  });
  await act(async () => {
    screen.getByText('Sign out').click();
  });
};

beforeEach(() => {
  mocks.clearAllData.mockClear();
  mocks.resetSyncCursor.mockClear();
  mocks.syncNow.mockClear();
  mocks.signOut.mockClear();
  mocks.syncNow.mockResolvedValue({ pushed: 0, pulled: 0, errors: [] });
  // jsdom's location.reload is non-configurable — swap the whole object.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('cloud sign-out data isolation', () => {
  it('clears the local store on sign-out', async () => {
    await clickSignOut();
    expect(mocks.clearAllData).toHaveBeenCalled();
  });

  it('resets the sync cursor so the next account starts from a full pass', async () => {
    await clickSignOut();
    expect(mocks.resetSyncCursor).toHaveBeenCalled();
  });

  it('pushes pending local changes to the cloud before wiping them', async () => {
    await clickSignOut();
    expect(mocks.syncNow).toHaveBeenCalled();
  });

  it('still clears the local store when the final sync fails', async () => {
    mocks.syncNow.mockRejectedValue(new Error('offline'));
    await clickSignOut();
    expect(mocks.clearAllData).toHaveBeenCalled();
  });

  it('ends the Supabase session', async () => {
    await clickSignOut();
    expect(mocks.signOut).toHaveBeenCalled();
  });
});
