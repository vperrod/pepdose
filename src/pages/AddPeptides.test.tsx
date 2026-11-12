// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { AddPeptides } from './AddPeptides';

const ops = vi.hoisted(() => ({
  saveProtocol: vi.fn(async (_p: unknown) => ({ id: 'proto-1' })),
  saveScheduledDoses: vi.fn(async (_doses: unknown[], _owner: string) => {}),
  navigate: vi.fn(),
}));

vi.mock('../db/operations', () => ({
  saveProtocol: ops.saveProtocol,
  saveScheduledDoses: ops.saveScheduledDoses,
}));

vi.mock('react-router', () => ({
  useNavigate: () => ops.navigate,
  useLocation: () => ({ state: null }),
}));

vi.mock('../components/UserPicker', () => ({
  UserPicker: () => null,
}));

vi.mock('../components/DisclaimerFooter', () => ({
  DisclaimerFooter: () => null,
}));

const savedProtocol = () => ops.saveProtocol.mock.calls[0][0] as {
  doses: { peptideId: string; dose: number; durationWeeks?: number;
           variantId?: string; schedulePhases?: unknown[]; frequency?: string;
           daysOfWeek?: number[]; customSchedule?: boolean; cycle?: { onWeeks: number; offWeeks: number } }[];
};

beforeEach(() => {
  ops.saveProtocol.mockClear();
  ops.saveScheduledDoses.mockClear();
  ops.navigate.mockClear();
});

afterEach(cleanup);

describe('AddPeptides', () => {

  it('searches for KPV, picks it, and saves successfully', async () => {
    await act(async () => { render(<AddPeptides />); });
    fireEvent.change(screen.getByPlaceholderText('Search peptides...'),
      { target: { value: 'KPV' } });
    fireEvent.click(screen.getByRole('button', { name: /KPV/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save/ })); });
    expect(ops.saveProtocol).toHaveBeenCalledTimes(1);
    const protocolArg = ops.saveProtocol.mock.calls[0][0] as { doses: { cycle?: unknown }[] };
    expect(protocolArg.doses[0].cycle).toBeDefined();
    expect(protocolArg).not.toHaveProperty('breaks');
  });

  it('enables Save after picking a peptide and respects weeks on/off', async () => {
    await act(async () => { render(<AddPeptides />); });
    fireEvent.change(screen.getByPlaceholderText('Search peptides...'),
      { target: { value: 'KPV' } });
    fireEvent.click(screen.getByRole('button', { name: /KPV/ }));
    expect((screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Weeks on'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Weeks off'), { target: { value: '3' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save/ })); });
    expect(savedProtocol().doses[0].cycle).toEqual({ onWeeks: 5, offWeeks: 3 });
  });

  it('saveScheduledDoses receives a non-empty array', async () => {
    await act(async () => { render(<AddPeptides />); });
    fireEvent.change(screen.getByPlaceholderText('Search peptides...'),
      { target: { value: 'KPV' } });
    fireEvent.click(screen.getByRole('button', { name: /KPV/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save/ })); });
    expect(ops.saveScheduledDoses).toHaveBeenCalledTimes(1);
    const dosesArg = ops.saveScheduledDoses.mock.calls[0][0] as unknown[];
    expect(Array.isArray(dosesArg)).toBe(true);
    expect(dosesArg.length).toBeGreaterThan(0);
  });
});