// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { ExportImport } from './ExportImport';

// Mock the destructive operations at the module boundary so the UI's confirm/
// import flows are exercised without touching IndexedDB.
const ops = vi.hoisted(() => ({
  importData: vi.fn(async () => {}),
  clearAllData: vi.fn(async () => {}),
}));

vi.mock('../db/operations', () => ({
  exportAllData: async () => '{}',
  importData: ops.importData,
  clearAllData: ops.clearAllData,
}));

// Cloud sync off → CloudSyncCard is skipped, keeping these tests focused on the
// data-loss paths.
vi.mock('../db/supabase', () => ({ cloudEnabled: false, supabase: null }));
vi.mock('../db/sync', () => ({ resetSyncCursor: () => {}, syncNow: async () => null }));
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

// Capture the throwaway <input> handleImport builds so tests can drive its
// onchange directly instead of relying on a real file picker.
let capturedInput: HTMLInputElement | null = null;
const realCreateElement = document.createElement.bind(document);

const fireImport = async (fileText: string) => {
  await act(async () => {
    capturedInput!.onchange!({ target: { files: [{ text: async () => fileText }] } } as unknown as Event);
  });
};

beforeEach(() => {
  vi.useFakeTimers(); // freeze the post-action window.location.reload timer
  ops.importData.mockClear();
  ops.clearAllData.mockClear();
  capturedInput = null;
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = realCreateElement(tag);
    if (tag === 'input') {
      capturedInput = el as HTMLInputElement;
      el.click = () => {}; // don't open a real picker
    }
    return el;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ExportImport clear-all confirm flow', () => {
  it('hides the destructive action behind a confirmation step', () => {
    render(<ExportImport />);
    expect(screen.queryByText('Delete Everything')).toBeNull();
    fireEvent.click(screen.getByText('Clear All Data'));
    expect(screen.getByText('Delete Everything')).toBeTruthy();
  });

  it('cancelling backs out without wiping data', () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByText('Clear All Data'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete Everything')).toBeNull();
    expect(ops.clearAllData).not.toHaveBeenCalled();
  });

  it('confirming wipes the database', async () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByText('Clear All Data'));
    await act(async () => { fireEvent.click(screen.getByText('Delete Everything')); });
    expect(ops.clearAllData).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/All data cleared/)).toBeTruthy();
  });

  it('reports an error instead of claiming success when the wipe throws', async () => {
    ops.clearAllData.mockRejectedValueOnce(new Error('db locked'));
    render(<ExportImport />);
    fireEvent.click(screen.getByText('Clear All Data'));
    await act(async () => { fireEvent.click(screen.getByText('Delete Everything')); });
    expect(screen.getByText(/Could not clear data/)).toBeTruthy();
  });
});

describe('ExportImport import flow', () => {
  it('restores a valid backup and reports the protocol count', async () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByText('Import Backup'));
    await fireImport(JSON.stringify({ version: 1, protocols: [{}, {}] }));
    expect(ops.importData).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Imported 2 protocols/)).toBeTruthy();
  });

  it('rejects a malformed (unparseable) file without touching the database', async () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByText('Import Backup'));
    await fireImport('this is not json');
    expect(ops.importData).not.toHaveBeenCalled();
    expect(screen.getByText('Invalid backup file')).toBeTruthy();
  });

  it('rejects a JSON file missing required backup fields', async () => {
    render(<ExportImport />);
    fireEvent.click(screen.getByText('Import Backup'));
    await fireImport(JSON.stringify({ version: 1 })); // no protocols
    expect(ops.importData).not.toHaveBeenCalled();
    expect(screen.getByText('Invalid backup file')).toBeTruthy();
  });
});
