// @vitest-environment jsdom
// The page always reads 90 days of logs and narrows in memory, so the 30d/90d
// toggle is real filtering logic rather than a refetch. It also flags sites with
// a recorded reaction. ownerIsolation.test.tsx covers only whose logs are read.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { format, subDays } from 'date-fns';
import { ViewFilterProvider } from '../context/ViewFilterContext';
import { InjectionMap } from './InjectionMap';
import type { DoseLog } from '../db/schema';

const ops = vi.hoisted(() => ({
  getDoseLogsSince: vi.fn(async () => [] as DoseLog[]),
}));

vi.mock('../db/operations', () => ops);
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

const log = (over: Partial<DoseLog>): DoseLog => ({
  id: 'l1',
  protocolId: 'p1',
  peptideId: 'bpc-157',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '08:00',
  dose: 250,
  unit: 'mcg',
  injectionSite: 'Left abdomen',
  owner: 'Victor',
  createdAt: new Date().toISOString(),
  ...over,
} as DoseLog);

async function renderPage() {
  await act(async () => { render(<ViewFilterProvider><InjectionMap /></ViewFilterProvider>); });
}

beforeEach(() => {
  ops.getDoseLogsSince.mockReset().mockResolvedValue([]);
  localStorage.setItem('pepdose-view-filter', 'Victor');
});
afterEach(cleanup);

describe('InjectionMap', () => {
  it('says so when no site was used in the window', async () => {
    await renderPage();
    expect(screen.getByText('No logged sites in this window.')).toBeTruthy();
  });

  it('reports each site with its use count and rest days', async () => {
    ops.getDoseLogsSince.mockResolvedValue([log({ id: 'l1' }), log({ id: 'l2' })]);
    await renderPage();
    expect(screen.getByText('2× · 0d')).toBeTruthy();
  });

  it('drops logs older than the selected window', async () => {
    ops.getDoseLogsSince.mockResolvedValue([
      log({ id: 'l1', date: format(subDays(new Date(), 45), 'yyyy-MM-dd') }),
    ]);
    await renderPage();
    await act(async () => { fireEvent.click(screen.getByText('30d')); });
    expect(screen.getByText('No logged sites in this window.')).toBeTruthy();
  });

  it('keeps those same logs inside the wider window', async () => {
    ops.getDoseLogsSince.mockResolvedValue([
      log({ id: 'l1', date: format(subDays(new Date(), 45), 'yyyy-MM-dd') }),
    ]);
    await renderPage();
    expect(screen.getByText('Left abdomen')).toBeTruthy();
  });

  it('flags a site where a reaction was recorded', async () => {
    ops.getDoseLogsSince.mockResolvedValue([log({ id: 'l1', siteReaction: 'redness' } as Partial<DoseLog>)]);
    await renderPage();
    expect(screen.getByTitle('Reaction logged here')).toBeTruthy();
  });
});
