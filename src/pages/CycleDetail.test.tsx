// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { CycleDetail } from './CycleDetail';
import type { ScheduledDose, UserProtocol } from '../db/schema';

const ops = vi.hoisted(() => ({
  getProtocol: vi.fn(),
  getScheduledDosesForProtocol: vi.fn(async () => [] as ScheduledDose[]),
  applyCycleToProtocol: vi.fn(async () => {}),
}));

vi.mock('../db/operations', async () => {
  const real = await vi.importActual<typeof import('../db/operations')>('../db/operations');
  return { ...ops, withCycle: real.withCycle };
});
vi.mock('react-router', () => ({
  useParams: () => ({ protocolId: 'p1', peptideId: 'tb-500' }),
  useNavigate: () => vi.fn(),
}));


const protocol = (over: Partial<UserProtocol> = {}): UserProtocol => ({
  id: 'p1', owner: 'Victor', name: 'TB', peptideIds: ['tb-500'],
  doses: [{ peptideId: 'tb-500', dose: 2, unit: 'mg', frequency: 'daily', timeOfDay: 'morning', durationWeeks: 12 }],
  startDate: '2026-10-05', durationWeeks: 12, status: 'active', createdAt: '', updatedAt: '', ...over,
});

const show = async (p: UserProtocol | undefined) => {
  ops.getProtocol.mockResolvedValue(p);
  await act(async () => { render(<CycleDetail />); });
};

beforeEach(() => { ops.applyCycleToProtocol.mockClear(); });
afterEach(cleanup);

describe('CycleDetail', () => {
  it('describes the setup in one sentence', async () => {
    await show(protocol());
    expect(screen.queryByText(/12-week course, no off weeks\./)).not.toBeNull();
  });

  it('lists the window with its dates', async () => {
    await show(protocol());
    expect(screen.queryByText(/Mon 5 Oct to Sun 27 Dec/)).not.toBeNull();
  });

  it('compares the plan with the typical cycle', async () => {
    await show(protocol());
    expect(screen.queryAllByText('Typical is 6 on, 4 off. Yours has no off weeks.').length).toBeGreaterThan(0);
  });

  it('previews the new plan before applying anything', async () => {
    await show(protocol());
    fireEvent.click(screen.getByRole('button', { name: /Use suggested cycle/ }));
    expect(screen.queryByText(/6 weeks on, 4 off, repeating/)).not.toBeNull();
    expect(ops.applyCycleToProtocol).not.toHaveBeenCalled();
  });

  it('applies the suggested cycle to this peptide only after confirming', async () => {
    await show(protocol());
    fireEvent.click(screen.getByRole('button', { name: /Use suggested cycle/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply' })); });
    expect(ops.applyCycleToProtocol).toHaveBeenCalledWith('p1', 'tb-500', { onWeeks: 6, offWeeks: 4 });
  });

  it('offers no change when the plan already matches', async () => {
    await show(protocol({ doses: [{ peptideId: 'tb-500', dose: 2, unit: 'mg', frequency: 'daily', timeOfDay: 'morning', durationWeeks: 24, cycle: { onWeeks: 6, offWeeks: 4 } }], durationWeeks: 24 }));
    expect(screen.queryByRole('button', { name: /Use suggested cycle/ })).toBeNull();
  });

  it('says so when the protocol no longer exists', async () => {
    await show(undefined);
    expect(screen.queryByText(/no longer exists/)).not.toBeNull();
  });
});
