// @vitest-environment jsdom
// The creation flow's wiring, not the schedule maths (scheduleEngine has its
// own tests): which dose, phases and duration a selected peptide or variant
// hands to saveProtocol/generateSchedule. A bug here silently mis-doses a user
// even though every helper it calls is correct.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { NewProtocol } from './NewProtocol';
import { getPeptideById } from '../data/peptides';

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

const savedProtocol = () => ops.saveProtocol.mock.calls[0][0] as {
  doses: { peptideId: string; dose: number; durationWeeks?: number;
           variantId?: string; schedulePhases?: unknown[]; frequency?: string;
           daysOfWeek?: number[]; customSchedule?: boolean }[];
};

// Mirrors the CUSTOM_SCHEDULE sentinel value in NewProtocol.tsx/Protocols.tsx —
// not exported, so tests target the <select> by its option value directly.
const CUSTOM_SCHEDULE = '__custom__';
const scheduledDoses = () => ops.saveScheduledDoses.mock.calls[0][0] as
  { peptideId: string; dose: number; date: string }[];

/** Walk the wizard: pick Retatrutide, optionally retune it, then create. */
async function createWith(retune?: () => void) {
  await act(async () => { render(<NewProtocol />); });
  fireEvent.change(screen.getByPlaceholderText('Search peptides...'),
    { target: { value: 'Retatrutide' } });
  fireEvent.click(screen.getByText('Retatrutide'));
  retune?.();
  fireEvent.click(screen.getByRole('button', { name: /Review Protocol/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Start Protocol/ }));
  });
}

const doseField = () => screen.getAllByRole('spinbutton')[0];

beforeEach(() => {
  ops.saveProtocol.mockClear();
  ops.saveScheduledDoses.mockClear();
  ops.navigate.mockClear();
});

afterEach(cleanup);

describe('NewProtocol', () => {
  it('starts a selected peptide on its first protocol variant', async () => {
    await createWith();
    const variant = getPeptideById('retatrutide')!.dosing.protocolVariants![0];
    expect(savedProtocol().doses[0].variantId).toBe(variant.id);
  });

  it('takes the cycle length from the variant phases, not the default 4 weeks', async () => {
    await createWith();
    const variant = getPeptideById('retatrutide')!.dosing.protocolVariants![0];
    const lastWeek = variant.phases[variant.phases.length - 1].weekEnd;
    expect(savedProtocol().doses[0].durationWeeks).toBe(lastWeek);
  });

  it('carries the variant phases through to the saved protocol', async () => {
    await createWith();
    const variant = getPeptideById('retatrutide')!.dosing.protocolVariants![0];
    expect(savedProtocol().doses[0].schedulePhases).toEqual(variant.phases);
  });

  it('switching variant applies that variant dose override', async () => {
    const community = getPeptideById('retatrutide')!.dosing
      .protocolVariants!.find(v => v.id === 'community-cycle')!;
    await createWith(() => {
      fireEvent.change(screen.getByDisplayValue(
        getPeptideById('retatrutide')!.dosing.protocolVariants![0].name),
        { target: { value: community.id } });
    });
    expect(savedProtocol().doses[0].dose).toBe(community.doseOverride);
  });

  it('saves the start dose the user typed instead of the template default', async () => {
    await createWith(() => {
      fireEvent.change(doseField(), { target: { value: '0.5' } });
    });
    expect(savedProtocol().doses[0].dose).toBe(0.5);
  });

  it('scales the titration ladder to that start dose on the generated schedule', async () => {
    // Ladder step 1 is 2mg; starting at 0.5mg must scale the whole ladder down
    // (getTitrationDose), not jump the user to the template's first step.
    await createWith(() => {
      fireEvent.change(doseField(), { target: { value: '0.5' } });
    });
    expect(scheduledDoses()[0].dose).toBe(0.5);
  });

  it('refuses to create anything when the dose is blank', async () => {
    await createWith(() => {
      fireEvent.change(doseField(), { target: { value: '0' } });
    });
    expect(ops.saveProtocol).not.toHaveBeenCalled();
  });

  it('picking Custom Schedule drops the canned variant and is not overwritten by variant defaults', async () => {
    const variant = getPeptideById('retatrutide')!.dosing.protocolVariants![0];
    await createWith(() => {
      fireEvent.change(screen.getByDisplayValue(variant.name), { target: { value: CUSTOM_SCHEDULE } });
      fireEvent.click(screen.getByLabelText('Monday'));
    });
    const dose = savedProtocol().doses[0];
    expect(dose.schedulePhases).toBeUndefined();
    expect(dose.variantId).toBeUndefined();
    expect(dose.frequency).toBe('weekly_days');
    expect(dose.daysOfWeek).toEqual([1]);
    expect(dose.customSchedule).toBe(true);
  });

  it('re-enables Start Protocol when the write throws', async () => {
    ops.saveScheduledDoses.mockRejectedValueOnce(new Error('QuotaExceededError'));
    await createWith();
    const button = screen.getByRole('button', { name: /Start Protocol/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('shows the failure reason when the write throws', async () => {
    ops.saveScheduledDoses.mockRejectedValueOnce(new Error('QuotaExceededError'));
    await createWith();
    expect(screen.getByRole('alert').textContent).toContain('QuotaExceededError');
  });
});
