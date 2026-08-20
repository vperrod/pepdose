// @vitest-environment jsdom
import { it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { ViewFilterProvider } from '../context/ViewFilterContext';
import { Symptoms } from './Symptoms';
import type { DoseLog, ScheduledDose } from '../db/schema';

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

const ops = vi.hoisted(() => ({
  getAllDoseLogs: vi.fn(async () => [] as DoseLog[]),
  getScheduledDosesInRange: vi.fn(async () => [] as ScheduledDose[]),
}));
vi.mock('../db/operations', () => ops);

const log = (over: Partial<DoseLog>): DoseLog => ({
  id: 'l1', owner: 'Victor', protocolId: 'p1', peptideId: 'bpc-157',
  date: '2026-03-01', time: '09:00', dose: 250, unit: 'mcg', route: 'subq',
  createdAt: '2026-03-01T09:00:00.000Z',
  ...over,
} as DoseLog);

async function renderSymptoms() {
  localStorage.setItem('pepdose-view-filter', 'Victor');
  await act(async () => {
    render(<ViewFilterProvider><Symptoms /></ViewFilterProvider>);
  });
}

beforeEach(() => { Object.values(ops).forEach(fn => fn.mockClear()); });
afterEach(cleanup);

it("bounds the scheduled-dose fetch to the logged data's own date span, not an all-time range", async () => {
  ops.getAllDoseLogs.mockResolvedValue([
    log({ id: 'l1', date: '2026-01-10' }),
    log({ id: 'l2', date: '2026-03-20' }),
  ]);
  await renderSymptoms();

  expect(ops.getScheduledDosesInRange).toHaveBeenCalledWith('2026-01-10', '2026-03-20');
});

it('skips the scheduled-dose fetch entirely when there are no dose logs yet', async () => {
  ops.getAllDoseLogs.mockResolvedValue([]);
  await renderSymptoms();

  expect(ops.getScheduledDosesInRange).not.toHaveBeenCalled();
});
