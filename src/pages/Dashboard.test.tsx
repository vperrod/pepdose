// @vitest-environment jsdom
import { it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { format } from 'date-fns';
import { ViewFilterProvider } from '../context/ViewFilterContext';
import { Dashboard } from './Dashboard';
import type { UserProtocol, ScheduledDose } from '../db/schema';

const ops = vi.hoisted(() => ({
  getScheduledDosesForDate: vi.fn(async () => [] as ScheduledDose[]),
  getProtocols: vi.fn(async () => [] as UserProtocol[]),
  getDoseLogsForDate: vi.fn(async () => []),
  getScheduledDosesForProtocols: vi.fn(async () => [] as ScheduledDose[]),
}));

vi.mock('../db/operations', () => ops);
vi.mock('../utils/notifications', () => ({ scheduleReminders: async () => {} }));
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

const today = format(new Date(), 'yyyy-MM-dd');

const activeProtocol: UserProtocol = {
  id: 'p1', name: 'Healing', peptideIds: ['bpc-157'], doses: [], startDate: today,
  durationWeeks: 4, status: 'active', owner: 'Victor',
  createdAt: `${today}T00:00:00.000Z`, updatedAt: `${today}T00:00:00.000Z`,
} as UserProtocol;

const dose = (over: Partial<ScheduledDose>): ScheduledDose => ({
  id: 'd1', protocolId: 'p1', peptideId: 'bpc-157', date: today, time: '23:59',
  dose: 250, unit: 'mcg', status: 'upcoming', weekNumber: 1, owner: 'Victor',
  createdAt: `${today}T00:00:00.000Z`,
  ...over,
} as ScheduledDose);

async function renderDashboard() {
  localStorage.setItem('pepdose-view-filter', 'Victor');
  await act(async () => {
    render(<ViewFilterProvider><Dashboard /></ViewFilterProvider>);
  });
}

beforeEach(() => { Object.values(ops).forEach(fn => fn.mockClear()); });
afterEach(cleanup);

it('shows the empty state when nothing is scheduled today', async () => {
  await renderDashboard();
  expect(screen.getByText('No doses scheduled today')).toBeTruthy();
});

it('shows the next upcoming dose with its peptide name and amount', async () => {
  ops.getScheduledDosesForDate.mockResolvedValue([dose({})]);
  ops.getProtocols.mockResolvedValue([activeProtocol]);
  await renderDashboard();
  expect(screen.getByText('Next injection')).toBeTruthy();
  expect(screen.getAllByText('BPC-157').length).toBeGreaterThan(0);
  expect(screen.getAllByText('250 mcg').length).toBeGreaterThan(0);
});

it('shows the all-done state once every scheduled dose is logged', async () => {
  ops.getScheduledDosesForDate.mockResolvedValue([dose({ status: 'logged' })]);
  await renderDashboard();
  expect(screen.getByText('All done for today')).toBeTruthy();
  expect(screen.getByText('1/1 doses logged')).toBeTruthy();
});
