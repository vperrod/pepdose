// @vitest-environment jsdom
// Presentational hub: no data, no derived state. The only behaviour that can
// break is which route each entry sends the user to.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Insights } from './Insights';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

function open(label: string) {
  fireEvent.click(screen.getByText(label));
}

beforeEach(() => navigate.mockReset());
afterEach(cleanup);

describe('Insights hub', () => {
  it('offers every insight destination', () => {
    render(<Insights />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('opens active levels', () => {
    render(<Insights />);
    open('Active Levels');
    expect(navigate).toHaveBeenCalledWith('/half-life');
  });

  it('opens health markers', () => {
    render(<Insights />);
    open('Health Markers');
    expect(navigate).toHaveBeenCalledWith('/health-markers');
  });

  it('opens dose history', () => {
    render(<Insights />);
    open('Dose History');
    expect(navigate).toHaveBeenCalledWith('/history');
  });

  it('opens symptoms', () => {
    render(<Insights />);
    open('Symptoms');
    expect(navigate).toHaveBeenCalledWith('/symptoms');
  });

  it('opens the injection map', () => {
    render(<Insights />);
    open('Injection Map');
    expect(navigate).toHaveBeenCalledWith('/injection-map');
  });
});
