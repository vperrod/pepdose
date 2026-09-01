// @vitest-environment jsdom
import { it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup, screen, fireEvent } from '@testing-library/react';
import { ViewFilterProvider } from '../context/ViewFilterContext';
import { VialInventory } from './VialInventory';
import { computeRecon, doseToMg } from '../utils/reconMath';
import { getPeptideById } from '../data/peptides';
import type { Vial } from '../db/schema';

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

const ops = vi.hoisted(() => ({
  getVials: vi.fn(async () => [] as Vial[]),
  saveVial: vi.fn(async () => 'v1'),
  updateVial: vi.fn(async () => undefined),
  getDoseLogsForPeptide: vi.fn(async () => []),
  getAllDoseLogs: vi.fn(async () => []),
}));
vi.mock('../db/operations', () => ops);

const forecast = vi.hoisted(() => ({ predictEmptyDate: vi.fn(() => null) }));
vi.mock('../utils/vialForecast', () => forecast);

async function renderForm() {
  localStorage.setItem('pepdose-view-filter', 'Victor');
  await act(async () => {
    render(<ViewFilterProvider><VialInventory /></ViewFilterProvider>);
  });
  // Header holds the back button then the "+" that opens the add-vial form.
  await act(async () => { fireEvent.click(screen.getAllByRole('button')[1]); });
}

function reconHint() {
  return screen.getByText(/doses\/vial/).textContent?.replace(/\s+/g, ' ').trim();
}

function fill(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
}

beforeEach(() => { Object.values(ops).forEach(fn => fn.mockClear()); });
afterEach(cleanup);

it("predicts a vial's empty date from its own owner's logs only", async () => {
  ops.getVials.mockResolvedValueOnce([{
    id: 'v1', peptideId: 'bpc-157', owner: 'Victor', status: 'active',
    dosesRemaining: 10, totalDoses: 20, amountMg: 10, bacWaterMl: 2,
    reconstitutionDate: '2026-08-01T00:00:00.000Z',
  } as Vial]);
  ops.getAllDoseLogs.mockResolvedValueOnce([
    { peptideId: 'bpc-157', owner: 'Victor', date: '2026-08-30' },
    { peptideId: 'bpc-157', owner: 'Nadia', date: '2026-08-31' },
  ]);
  localStorage.setItem('pepdose-view-filter', 'Victor');

  await act(async () => {
    render(<ViewFilterProvider><VialInventory /></ViewFilterProvider>);
  });

  expect(forecast.predictEmptyDate).toHaveBeenCalledWith(10, ['2026-08-30'], expect.any(Date));
});

it("prefills total doses from the selected peptide's own vial defaults", async () => {
  await renderForm();
  const bpc = getPeptideById('bpc-157')!;

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bpc-157' } });

  const expected = computeRecon({
    mode: 'forward', vialMg: bpc.reconstitution.typicalVialMg,
    doseMg: doseToMg(bpc.dosing.standard, bpc.dosing.unit),
    bacWaterMl: 1, targetUnits: 0, unitsPerMl: 100,
  }).dosesPerVial;
  const totalDoses = screen.getByPlaceholderText('Total doses') as HTMLInputElement;
  expect(totalDoses.value).toBe(String(expected));
});

it('reports whole doses per vial for the typed mix', async () => {
  await renderForm();

  fill('Amount (mg)', '10');
  fill('BAC water (ml)', '2');
  fill('Dose per injection', '3');

  expect(reconHint()).toContain('3 doses/vial'); // floor(10 / 3)
});

it('reports the concentration and syringe units of the typed mix', async () => {
  await renderForm();

  fill('Amount (mg)', '10');
  fill('BAC water (ml)', '2');
  fill('Dose per injection', '2.5');

  expect(reconHint()).toContain('5.0 mg/ml · 50u/dose');
});

it('converts a mcg dose to mg before dividing the vial', async () => {
  await renderForm();

  fill('Amount (mg)', '5');
  fill('BAC water (ml)', '2');
  fill('Dose per injection', '500');
  fireEvent.click(screen.getByRole('button', { name: 'mg' })); // mg -> IU
  fireEvent.click(screen.getByRole('button', { name: 'IU' })); // IU -> mcg

  expect(reconHint()).toContain('10 doses/vial'); // 5mg / 500mcg
});

it('still reports doses per vial before any BAC water is entered', async () => {
  await renderForm();

  fill('Amount (mg)', '10');
  fill('Dose per injection', '2');

  expect(reconHint()).toContain('5 doses/vial');
});
