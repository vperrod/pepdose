// @vitest-environment jsdom
// utils/reconMath.ts is unit-tested on its own; what is untested is the wiring
// around it — peptide autofill, the ?peptide= deep link, the dose-unit cycle,
// the U-40 syringe setting, and which warnings the results feed into.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { ReconCalculator } from './ReconCalculator';

// Mutable so one test can exercise the /calculator?peptide=<id> deep link.
const searchParams = vi.hoisted(() => ({ current: new URLSearchParams('') }));

vi.mock('react-router', () => ({
  useSearchParams: () => [searchParams.current, vi.fn()],
}));

async function renderPage() {
  await act(async () => { render(<ReconCalculator />); });
}

function type(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
}

// BPC-157 ships a 5mg vial / 2ml water / 500mcg standard dose, so the autofilled
// draw is 0.5mg at 2.5mg/ml = 0.2ml = 20 units on a U-100 syringe, 10 doses/vial.
function selectBpc157() {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bpc-157' } });
}

beforeEach(() => {
  searchParams.current = new URLSearchParams('');
  localStorage.clear();
});
afterEach(cleanup);

describe('ReconCalculator peptide presets', () => {
  it('autofills the vial size from the selected peptide', async () => {
    await renderPage();
    selectBpc157();
    expect((screen.getByPlaceholderText('5') as HTMLInputElement).value).toBe('5');
  });

  it('computes the unit mark to draw from the autofilled preset', async () => {
    await renderPage();
    selectBpc157();
    expect(screen.getByText('Draw to 20.0 unit mark')).toBeTruthy();
  });

  it('counts the whole doses that fit in the vial', async () => {
    await renderPage();
    selectBpc157();
    expect(screen.getByText('doses/vial').previousSibling!.textContent).toBe('10');
  });

  it('preselects the peptide named in the ?peptide= deep link', async () => {
    searchParams.current = new URLSearchParams('peptide=bpc-157');
    await renderPage();
    expect(screen.getByText('Draw to 20.0 unit mark')).toBeTruthy();
  });
});

describe('ReconCalculator warnings and modes', () => {
  it('warns when the draw overflows a 1ml syringe', async () => {
    await renderPage();
    type('5', '5');
    type('2', '12');
    type('250', '500');
    expect(screen.getByText(/Exceeds 1ml syringe/)).toBeTruthy();
  });

  it('back-solves the water needed to land the dose on the target unit mark', async () => {
    await renderPage();
    selectBpc157();
    await act(async () => { fireEvent.click(screen.getByText('Clean draw → find water')); });
    const headline = screen.getByText('Add this much water').nextElementSibling!;
    expect(headline.textContent).toBe('1.00 mL');
  });

  it('reads the syringe scale from the saved U-40 setting', async () => {
    localStorage.setItem('pepdose-settings', JSON.stringify({ syringeType: 'u40' }));
    await renderPage();
    selectBpc157();
    expect(screen.getByText('U-40 Insulin Syringe')).toBeTruthy();
  });

  it('converts milligrams to IU using the entered mg-per-IU ratio', async () => {
    await renderPage();
    const mgInput = screen.getByText('Dose (mg)').parentElement!.querySelector('input')!;
    fireEvent.change(mgInput, { target: { value: '2' } });
    expect(screen.getByText('= 6.01 IU')).toBeTruthy();
  });
});
