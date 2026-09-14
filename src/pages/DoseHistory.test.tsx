// @vitest-environment jsdom
// Two shapings of the same log list: a per-date count map behind the heatmap and
// a newest-first sort behind the list view, plus the peptide filter that feeds
// both. ownerIsolation.test.tsx only proves the owner filter runs first.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { format, subDays, subMonths } from 'date-fns';
import { ViewFilterProvider } from '../context/ViewFilterContext';
import { DoseHistory } from './DoseHistory';
import type { DoseLog } from '../db/schema';

const ops = vi.hoisted(() => ({
  getDoseLogsSince: vi.fn(async () => [] as DoseLog[]),
}));

vi.mock('../db/operations', () => ops);
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

const TODAY = format(new Date(), 'yyyy-MM-dd');

const log = (over: Partial<DoseLog>): DoseLog => ({
  id: 'l1',
  protocolId: 'p1',
  peptideId: 'bpc-157',
  date: TODAY,
  time: '08:00',
  dose: 250,
  unit: 'mcg',
  injectionSite: 'Left abdomen',
  owner: 'Victor',
  createdAt: `${TODAY}T08:00:00.000Z`,
  ...over,
} as DoseLog);

async function renderPage() {
  await act(async () => { render(<ViewFilterProvider><DoseHistory /></ViewFilterProvider>); });
}

// The heatmap/list toggle is icon-only, so there is no accessible name to query.
async function openList() {
  const listToggle = document.querySelector('.lucide-list')!.closest('button')!;
  await act(async () => { fireEvent.click(listToggle); });
}

// List rows render the peptide name in a <p>; the filter <select> repeats those
// same names in its <option>s, so row assertions have to exclude the dropdown.
function listedPeptideNames() {
  return [...document.querySelectorAll('p.truncate')].map(p => p.textContent);
}

beforeEach(() => {
  ops.getDoseLogsSince.mockReset().mockResolvedValue([]);
  localStorage.setItem('pepdose-view-filter', 'Victor');
});
afterEach(cleanup);

describe('DoseHistory heatmap', () => {
  it('counts every log landing on the same day', async () => {
    ops.getDoseLogsSince.mockResolvedValue([
      log({ id: 'l1' }), log({ id: 'l2' }), log({ id: 'l3' }),
    ]);
    await renderPage();
    expect(screen.getByTitle(`${TODAY}: 3 doses`)).toBeTruthy();
  });

  it('leaves a day with no logs at zero', async () => {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    ops.getDoseLogsSince.mockResolvedValue([log({ id: 'l1' })]);
    await renderPage();
    expect(screen.getByTitle(`${yesterday}: 0 doses`)).toBeTruthy();
  });

  it('moves the grid to the previous month', async () => {
    await renderPage();
    await act(async () => { fireEvent.click(screen.getByText('←')); });
    expect(screen.getByText(format(subMonths(new Date(), 1), 'MMMM yyyy'))).toBeTruthy();
  });
});

describe('DoseHistory list', () => {
  it('orders logs newest first', async () => {
    ops.getDoseLogsSince.mockResolvedValue([
      log({ id: 'old', date: format(subDays(new Date(), 3), 'yyyy-MM-dd'), peptideId: 'tb-500' }),
      log({ id: 'new', date: TODAY }),
    ]);
    await renderPage();
    await openList();
    expect(listedPeptideNames()[0]).toBe('BPC-157');
  });

  it('shows the empty state when nothing is logged', async () => {
    await renderPage();
    await openList();
    expect(screen.getByText('No dose logs yet')).toBeTruthy();
  });
});

describe('DoseHistory peptide filter', () => {
  it('narrows the list to the selected peptide', async () => {
    ops.getDoseLogsSince.mockResolvedValue([
      log({ id: 'l1', peptideId: 'bpc-157' }),
      log({ id: 'l2', peptideId: 'tb-500' }),
    ]);
    await renderPage();
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tb-500' } });
    });
    await openList();
    expect(listedPeptideNames()).toEqual(['TB-500']);
  });

  it('drops filtered-out logs from the heatmap count', async () => {
    ops.getDoseLogsSince.mockResolvedValue([
      log({ id: 'l1', peptideId: 'bpc-157' }),
      log({ id: 'l2', peptideId: 'tb-500' }),
    ]);
    await renderPage();
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tb-500' } });
    });
    expect(screen.getByTitle(`${TODAY}: 1 doses`)).toBeTruthy();
  });
});
