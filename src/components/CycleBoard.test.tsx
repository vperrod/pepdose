// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CycleBoard } from './CycleBoard';
import type { UserProtocol } from '../db/schema';

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

const protocol = (over: Partial<UserProtocol> = {}): UserProtocol => ({
  id: 'p1',
  owner: 'Victor',
  name: 'KPV',
  peptideIds: ['kpv'],
  doses: [{
    peptideId: 'kpv', dose: 200, unit: 'mcg', frequency: 'daily', timeOfDay: 'morning',
    durationWeeks: 32, cycle: { onWeeks: 8, offWeeks: 8 },
  }],
  startDate: '2026-01-05',
  durationWeeks: 32,
  status: 'active',
  createdAt: '2026-01-05T00:00:00Z',
  updatedAt: '2026-01-05T00:00:00Z',
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-01T09:00:00'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CycleBoard', () => {
  it('shows the ON pill with week of phase on the last on-week', () => {
    render(<CycleBoard protocols={[protocol()]} />);
    expect(screen.queryByText(/ON · week 8 of 8/)).not.toBeNull();
  });

  it('warns that the off weeks start tomorrow', () => {
    render(<CycleBoard protocols={[protocol()]} />);
    expect(screen.queryByText(/Off from 2026-03-02 \(in 1 day/)).not.toBeNull();
  });

  it('renders nothing for a paused protocol', () => {
    const { container } = render(<CycleBoard protocols={[protocol({ status: 'paused' })]} />);
    expect(container.innerHTML).toBe('');
  });
});
