// @vitest-environment jsdom
// The creation flow's wiring, not the schedule maths (scheduleEngine has its
// own tests): which dose, phases and duration a selected peptide or variant
// hands to saveProtocol/generateSchedule. A bug here silently mis-doses a user
// even though every helper it calls is correct.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { NewProtocol } from './NewProtocol';

const ops = vi.hoisted(() => ({
  saveProtocol: vi.fn(async (_p: unknown) => ({ id: 'proto-1' })),
  saveScheduledDoses: vi.fn(async (_doses: unknown[], _owner: string) => {}),
  navigate: vi.fn(),
}));

vi.mock('../db/operations', () => ({
  saveProtocol: ops.saveProtocol,
  saveScheduledDoses: ops.saveScheduledDoses,
}));

vi.mock('react-router', () => ({
  useNavigate: () => ops.navigate,
  useLocation: () => ({ state: null }),
}));

vi.mock('../components/UserPicker', () => ({
  UserPicker: () => null,
}));

const savedProtocol = () => ops.saveProtocol.mock.calls[0][0] as {
  doses: { peptideId: string; dose: number; durationWeeks?: number;
           variantId?: string; schedulePhases?: unknown[]; frequency?: string;
           daysOfWeek?: number[]; customSchedule?: boolean }[];
};

/** Walk the wizard: pick Tirzepatide, optionally retune it, then create. */
async function createWith(retune?: () => void) {
  await act(async () => { render(<NewProtocol />); });
  fireEvent.change(screen.getByPlaceholderText('Search peptides...'),
    { target: { value: 'Tirzepatide' } });
  fireEvent.click(screen.getByText('Tirzepatide'));
  retune?.();
  fireEvent.click(screen.getByRole('button', { name: /Review Protocol/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Start Protocol/ }));
  });
}

const doseField = () => screen.getAllByRole('spinbutton')[0];

beforeEach(() => {
  ops.saveProtocol.mockClear();
  ops.saveScheduledDoses.mockClear();
  ops.navigate.mockClear();
});

afterEach(cleanup);

describe('NewProtocol', () => {




  it('saves the start dose the user typed instead of the template default', async () => {
    await createWith(() => {
      fireEvent.change(doseField(), { target: { value: '5' } });
    });
    expect(savedProtocol().doses[0].dose).toBe(5);
  });


  it('refuses to create anything when the dose is blank', async () => {
    await createWith(() => {
      fireEvent.change(doseField(), { target: { value: '0' } });
    });
    expect(ops.saveProtocol).not.toHaveBeenCalled();
  });


  it('re-enables Start Protocol when the write throws', async () => {
    ops.saveScheduledDoses.mockRejectedValueOnce(new Error('QuotaExceededError'));
    await createWith();
    const button = screen.getByRole('button', { name: /Start Protocol/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('shows the failure reason when the write throws', async () => {
    ops.saveScheduledDoses.mockRejectedValueOnce(new Error('QuotaExceededError'));
    await createWith();
    expect(screen.getByRole('alert').textContent).toContain('QuotaExceededError');
  });
});
