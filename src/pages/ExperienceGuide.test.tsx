// @vitest-environment jsdom
// The page picks which guides to show from the active protocols, derives the
// cycle week from each protocol's start date, and auto-expands the matching
// timeline band. ownerIsolation.test.tsx only checks whose protocols are read.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { format, subWeeks } from 'date-fns';
import { ViewFilterProvider } from '../context/ViewFilterContext';
import { ExperienceGuide } from './ExperienceGuide';
import type { UserProtocol } from '../db/schema';

const navigate = vi.hoisted(() => vi.fn());

const ops = vi.hoisted(() => ({
  getProtocols: vi.fn(async () => [] as UserProtocol[]),
}));

vi.mock('../db/operations', () => ops);
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

const protocol = (over: Partial<UserProtocol> = {}): UserProtocol => ({
  id: 'p1',
  name: 'Healing',
  peptideIds: ['bpc-157'],
  startDate: format(new Date(), 'yyyy-MM-dd'),
  durationWeeks: 8,
  status: 'active',
  owner: 'Victor',
  createdAt: new Date().toISOString(),
  ...over,
} as UserProtocol);

async function renderPage() {
  await act(async () => { render(<ViewFilterProvider><ExperienceGuide /></ViewFilterProvider>); });
}

beforeEach(() => {
  navigate.mockReset();
  ops.getProtocols.mockReset().mockResolvedValue([]);
  localStorage.setItem('pepdose-view-filter', 'Victor');
});
afterEach(cleanup);

describe('ExperienceGuide active protocols', () => {
  it('derives the cycle week from the protocol start date', async () => {
    ops.getProtocols.mockResolvedValue([
      protocol({ startDate: format(subWeeks(new Date(), 2), 'yyyy-MM-dd') }),
    ]);
    await renderPage();
    expect(screen.getByText('Week 3 of cycle')).toBeTruthy();
  });

  it('shows one guide per peptide even when two protocols share it', async () => {
    ops.getProtocols.mockResolvedValue([
      protocol({ id: 'p1' }),
      protocol({ id: 'p2', name: 'Second' }),
    ]);
    await renderPage();
    expect(screen.getAllByText('BPC-157')).toHaveLength(1);
  });

  it('skips peptides that have no experience data', async () => {
    ops.getProtocols.mockResolvedValue([protocol({ peptideIds: ['not-a-peptide'] })]);
    await renderPage();
    expect(screen.getByText(/No active protocols/)).toBeTruthy();
  });

  it('marks the band covering the current week as where you are', async () => {
    ops.getProtocols.mockResolvedValue([protocol()]);
    await renderPage();
    expect(screen.getByText('YOU ARE HERE')).toBeTruthy();
  });
});

describe('ExperienceGuide browse mode', () => {
  async function browseTo(peptideId: string) {
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Select peptide'), { target: { value: peptideId } });
    });
  }

  it('renders the chosen peptide guide when no protocol is active', async () => {
    await renderPage();
    await browseTo('bpc-157');
    expect(screen.getByText('Side Effects')).toBeTruthy();
  });

  it('shows no cycle week for a guide browsed outside a protocol', async () => {
    await renderPage();
    await browseTo('bpc-157');
    expect(screen.queryByText(/of cycle/)).toBeNull();
  });

  it('sends the reconstitution shortcut to the calculator for that peptide', async () => {
    await renderPage();
    await browseTo('retatrutide');
    await act(async () => { fireEvent.click(screen.getByText('Reconstitute')); });
    expect(navigate).toHaveBeenCalledWith('/calculator?peptide=retatrutide');
  });
});
