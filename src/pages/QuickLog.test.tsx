// @vitest-environment jsdom
import { it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { QuickLog } from './QuickLog';

// Mock the db layer so the ad-hoc sheet's save flow is exercised without IndexedDB.
const ops = vi.hoisted(() => ({
  logDose: vi.fn(async () => ({})),
  scheduled: [] as object[],
}));

vi.mock('../db/operations', () => ({
  getScheduledDosesForDate: async () => ops.scheduled,
  getDoseLogsForDate: async () => [],
  getProtocols: async () => [{ id: 'p1' }],
  logDose: ops.logDose,
}));
vi.mock('../context/ViewFilterContext', () => ({
  useOwnerFilter: () => <T,>(x: T) => x,
}));

async function openAdhocAndFill() {
  await act(async () => { render(<QuickLog />); });
  fireEvent.click(screen.getByText('Ad-hoc dose'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tirzepatide' } });
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '250' } });
}
const saveButton = () => screen.getByRole('button', { name: 'Log Dose' });

afterEach(cleanup);


  it('a double tap while the save is pending logs the dose once', async () => {
    ops.scheduled = [{ id: 'd1', protocolId: 'p1', peptideId: 'tirzepatide', owner: 'Victor', time: '08:00', dose: 2.5, unit: 'mg', route: 'subcutaneous', status: 'upcoming' }];
    ops.logDose.mockClear();
    ops.logDose.mockImplementation(() => new Promise(() => {}));
    await act(async () => { render(<QuickLog />); });
    const card = screen.getByRole('button', { name: /Tirzepatide/ });
    await act(async () => { fireEvent.click(card); });
    await act(async () => { fireEvent.click(card); });
    ops.scheduled = [];
    expect(ops.logDose).toHaveBeenCalledTimes(1);
  });

  it('logs the dose and shows a confirmation', async () => {
    ops.logDose.mockResolvedValue({});
    await openAdhocAndFill();
    await act(async () => { fireEvent.click(saveButton()); });
    expect(screen.getByText(/Logged Tirzepatide/)).toBeTruthy();
  });

  it('a failed save shows the error instead of stranding the sheet on "Saving…"', async () => {
    // Synchronous throw: vitest's unhandled-rejection tracker false-positives on
    // the spy's recorded rejected promise; the component's try/catch is hit either way.
    ops.logDose.mockImplementation(() => { throw new Error('quota exceeded'); });
    await openAdhocAndFill();
    await act(async () => { fireEvent.click(saveButton()); });
    expect(screen.getByRole('alert').textContent).toContain('quota exceeded');
    expect(saveButton()).toBeTruthy(); // button usable again, not "Saving…"
  });

