// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CycleTimeline } from './CycleTimeline';
import { buildCycleMap } from '../utils/cycleMap';
import type { UserProtocol } from '../db/schema';

const protocol = (over: Partial<UserProtocol> = {}): UserProtocol => ({
  id: 'p1', owner: 'Victor', name: 'TB', peptideIds: ['tb-500'],
  doses: [{ peptideId: 'tb-500', dose: 2, unit: 'mg', frequency: 'daily', timeOfDay: 'morning', durationWeeks: 24, cycle: { onWeeks: 6, offWeeks: 4 } }],
  startDate: '2026-10-05', durationWeeks: 24, status: 'active', createdAt: '', updatedAt: '', ...over,
});
const maps = (p = protocol()) => [buildCycleMap({ protocol: p, peptideId: 'tb-500', doses: [], today: '2026-11-12' })];

afterEach(cleanup);

describe('CycleTimeline', () => {
  it('labels every window with its kind and weeks', () => {
    render(<CycleTimeline maps={maps()} today="2026-11-12" onOpen={() => {}} />);
    expect(screen.queryByText('ON 1–6')).not.toBeNull();
    expect(screen.queryByText('OFF 7–10')).not.toBeNull();
  });

  it('draws the today line when today is inside the plan', () => {
    render(<CycleTimeline maps={maps()} today="2026-11-12" onOpen={() => {}} />);
    expect(screen.queryByTestId('today-line')).not.toBeNull();
  });

  it('draws no today line once the plan is over', () => {
    render(<CycleTimeline maps={maps()} today="2028-01-01" onOpen={() => {}} />);
    expect(screen.queryByTestId('today-line')).toBeNull();
  });

  it('opens the row when its name is tapped', () => {
    const onOpen = vi.fn();
    render(<CycleTimeline maps={maps()} today="2026-11-12" onOpen={onOpen} />);
    fireEvent.click(screen.getByText('TB-500'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('marks a paused protocol', () => {
    render(<CycleTimeline maps={maps()} today="2026-11-12" pausedIds={new Set(['p1'])} onOpen={() => {}} />);
    expect(screen.queryByText(/paused · 6 on \/ 4 off/)).not.toBeNull();
  });

  it('renders nothing without protocols', () => {
    const { container } = render(<CycleTimeline maps={[]} today="2026-11-12" onOpen={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
