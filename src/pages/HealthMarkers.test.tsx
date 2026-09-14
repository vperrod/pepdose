// @vitest-environment jsdom
// The log form builds the stored marker by hand (parse + omit-if-blank) and the
// trends view derives its range cutoff and progress summary from that same list.
// ownerIsolation.test.tsx only proves the owner filter is applied; nothing
// covered the parsing, the omit-blank behaviour, or the range cutoff.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { format, subDays } from 'date-fns';
import { ViewFilterProvider } from '../context/ViewFilterContext';
import { HealthMarkers } from './HealthMarkers';
import type { HealthMarker } from '../db/schema';

const ops = vi.hoisted(() => ({
  getHealthMarkers: vi.fn(async () => [] as HealthMarker[]),
  saveHealthMarker: vi.fn(async (_marker: Omit<HealthMarker, 'id' | 'createdAt'>) => 'm1'),
}));

vi.mock('../db/operations', () => ops);

const marker = (over: Partial<HealthMarker>): HealthMarker => ({
  id: 'm1',
  date: format(new Date(), 'yyyy-MM-dd'),
  owner: 'Victor',
  createdAt: new Date().toISOString(),
  ...over,
} as HealthMarker);

async function renderPage() {
  await act(async () => { render(<ViewFilterProvider><HealthMarkers /></ViewFilterProvider>); });
}

function type(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
}

async function openTrends() {
  await act(async () => { fireEvent.click(screen.getByText('Trends')); });
}

beforeEach(() => {
  ops.getHealthMarkers.mockReset().mockResolvedValue([]);
  ops.saveHealthMarker.mockReset().mockResolvedValue('m1');
  localStorage.setItem('pepdose-view-filter', 'Victor');
});
afterEach(cleanup);

describe('HealthMarkers log form', () => {
  it('refuses to save while every field is empty', async () => {
    await renderPage();
    expect(screen.getByText('Enter a value to save').hasAttribute('disabled')).toBe(true);
  });

  it('stores the typed weight as a number', async () => {
    await renderPage();
    type('82.5', '81.4');
    await act(async () => { fireEvent.click(screen.getByText('Save Entry')); });
    expect(ops.saveHealthMarker.mock.calls[0][0]).toMatchObject({ weight: 81.4 });
  });

  it('omits fields left blank from the stored marker', async () => {
    await renderPage();
    type('82.5', '81.4');
    await act(async () => { fireEvent.click(screen.getByText('Save Entry')); });
    expect(ops.saveHealthMarker.mock.calls[0][0]).not.toHaveProperty('bodyFatPct');
  });

  it('nests body measurements under a measurements object', async () => {
    await renderPage();
    await act(async () => { fireEvent.click(screen.getByText(/Body Measurements/)); });
    fireEvent.change(screen.getByLabelText('Waist'), { target: { value: '86' } });
    await act(async () => { fireEvent.click(screen.getByText('Save Entry')); });
    expect(ops.saveHealthMarker.mock.calls[0][0]).toMatchObject({ measurements: { waist: 86 } });
  });

  it('clears the form after a successful save', async () => {
    await renderPage();
    type('82.5', '81.4');
    await act(async () => { fireEvent.click(screen.getByText('Save Entry')); });
    expect((screen.getByPlaceholderText('82.5') as HTMLInputElement).value).toBe('');
  });
});

describe('HealthMarkers trends', () => {
  it('summarises a metric as its first-to-last change over the range', async () => {
    ops.getHealthMarkers.mockResolvedValue([
      marker({ id: 'm1', date: format(subDays(new Date(), 5), 'yyyy-MM-dd'), weight: 80 }),
      marker({ id: 'm2', date: format(new Date(), 'yyyy-MM-dd'), weight: 78 }),
    ]);
    await renderPage();
    await openTrends();
    expect(screen.getByText(/80 → 78/)).toBeTruthy();
  });

  it('drops markers older than the selected range from the summary', async () => {
    ops.getHealthMarkers.mockResolvedValue([
      marker({ id: 'm1', date: format(subDays(new Date(), 20), 'yyyy-MM-dd'), weight: 80 }),
      marker({ id: 'm2', date: format(new Date(), 'yyyy-MM-dd'), weight: 78 }),
    ]);
    await renderPage();
    await openTrends();
    await act(async () => { fireEvent.click(screen.getByText('7d')); });
    expect(screen.queryByText(/80 → 78/)).toBeNull();
  });

  it('reports the change direction and amount between the range endpoints', async () => {
    ops.getHealthMarkers.mockResolvedValue([
      marker({ id: 'm1', date: format(subDays(new Date(), 5), 'yyyy-MM-dd'), weight: 80 }),
      marker({ id: 'm2', date: format(new Date(), 'yyyy-MM-dd'), weight: 78 }),
    ]);
    await renderPage();
    await openTrends();
    expect(screen.getByText(/↓ -2 kg over 30d/)).toBeTruthy();
  });
});
