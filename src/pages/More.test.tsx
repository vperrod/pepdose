// @vitest-environment jsdom
// Static menu list — the only logic is the route behind each row, so a smoke
// render of the menu plus a couple of route checks is the whole surface.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { More } from './More';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

beforeEach(() => navigate.mockReset());
afterEach(cleanup);

describe('More menu', () => {
  it('lists every menu entry', () => {
    render(<More />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
  });

  it('opens the reconstitution calculator', () => {
    render(<More />);
    fireEvent.click(screen.getByText('Reconstitution Calculator'));
    expect(navigate).toHaveBeenCalledWith('/calculator');
  });

  it('opens settings', () => {
    render(<More />);
    fireEvent.click(screen.getByText('Settings'));
    expect(navigate).toHaveBeenCalledWith('/settings');
  });
});
