// @vitest-environment jsdom
// Two-owner render tests: each screen gets rows for both profiles and is
// rendered as Victor; nothing of Nadia's may reach the DOM.
//
// db/ownerFilterWiring.test.ts only checks that a file uses the owner filter
// somewhere. All three shipped leaks (titration coach, calendar break hatch,
// journey health markers) lived in files that already filtered a sibling read,
// so that guard passed while the leak shipped. These tests catch that class:
// a new unfiltered read on one of these screens fails here regardless of what
// the rest of the file does.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { format, startOfWeek } from 'date-fns';
import { ViewFilterProvider } from '../context/ViewFilterContext';
import { Dashboard } from './Dashboard';
import { Calendar } from './Calendar';
import { Protocols } from './Protocols';
import { HalfLife } from './HalfLife';
import { InjectionMap } from './InjectionMap';
import { VialInventory } from './VialInventory';
import type { UserProtocol, ScheduledDose, HealthMarker, DoseLog, Vial } from '../db/schema';

const ops = vi.hoisted(() => ({
  getProtocols: vi.fn(async () => [] as UserProtocol[]),
  getProtocol: vi.fn(async () => undefined as UserProtocol | undefined),
  getScheduledDosesForProtocol: vi.fn(async () => [] as ScheduledDose[]),
  getScheduledDosesForDate: vi.fn(async () => [] as ScheduledDose[]),
  getScheduledDosesInRange: vi.fn(async () => [] as ScheduledDose[]),
  getDoseLogsForDate: vi.fn(async () => []),
  getDoseLogsInRange: vi.fn(async () => []),
  getDoseLogsForProtocol: vi.fn(async () => []),
  getDoseLogsForPeptide: vi.fn(async () => [] as DoseLog[]),
  getHealthMarkers: vi.fn(async () => [] as HealthMarker[]),
  getAllDoseLogs: vi.fn(async () => []),
  getDoseLogsSince: vi.fn(async () => [] as DoseLog[]),
  getVials: vi.fn(async () => [] as Vial[]),
  updateProtocol: vi.fn(async () => {}),
  deleteProtocol: vi.fn(async () => {}),
  deleteUpcomingDosesFrom: vi.fn(async () => {}),
  saveScheduledDoses: vi.fn(async () => {}),
  logDose: vi.fn(async () => ({})),
}));

vi.mock('../db/operations', () => ops);
vi.mock('../utils/notifications', () => ({ scheduleReminders: async () => {} }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: null }),
}));

const TODAY = format(new Date(), 'yyyy-MM-dd');
const WEEK_START = format(startOfWeek(new Date()), 'yyyy-MM-dd');

const protocol = (over: Partial<UserProtocol>): UserProtocol => ({
  id: 'p1',
  name: 'Healing',
  peptideIds: ['bpc-157'],
  doses: [{
    peptideId: 'bpc-157', dose: 250, unit: 'mcg', frequency: 'daily',
    timesPerDay: 1, timeOfDay: 'morning', durationWeeks: 4,
  }],
  startDate: WEEK_START,
  durationWeeks: 4,
  status: 'active',
  owner: 'Victor',
  createdAt: `${TODAY}T00:00:00.000Z`,
  ...over,
} as UserProtocol);

const stepUp = (protocolId: string, owner: 'Victor' | 'Nadia'): ScheduledDose => ({
  id: `d-${protocolId}`, protocolId, peptideId: 'bpc-157', date: TODAY, time: '08:00',
  dose: 500, unit: 'mcg', status: 'upcoming', weekNumber: 2, isTitrationStepUp: true,
  owner, createdAt: `${TODAY}T00:00:00.000Z`,
} as ScheduledDose);

const doseLog = (owner: 'Victor' | 'Nadia'): DoseLog => ({
  id: `l-${owner}`, protocolId: `p-${owner}`, peptideId: 'bpc-157', date: TODAY, time: '08:00',
  dose: 250, unit: 'mcg', injectionSite: 'Left abdomen', owner, createdAt: `${TODAY}T08:00:00.000Z`,
} as DoseLog);

const doseLogOn = (owner: 'Victor' | 'Nadia', date: string): DoseLog => ({
  id: `l-${owner}-${date}`, protocolId: `p-${owner}`, peptideId: 'bpc-157', date, time: '08:00',
  dose: 250, unit: 'mcg', injectionSite: 'Left abdomen', owner, createdAt: `${date}T08:00:00.000Z`,
} as DoseLog);

const vial = (owner: 'Victor' | 'Nadia'): Vial => ({
  id: `v-${owner}`, owner, peptideId: 'bpc-157', amountMg: 5, bacWaterMl: 2,
  dosesRemaining: 4, totalDoses: 10, status: 'active', createdAt: `${TODAY}T00:00:00.000Z`,
} as Vial);

async function renderAsVictor(ui: React.ReactElement) {
  let result!: ReturnType<typeof render>;
  await act(async () => { result = render(<ViewFilterProvider>{ui}</ViewFilterProvider>); });
  return result;
}

beforeEach(() => {
  Object.values(ops).forEach(fn => fn.mockClear());
  localStorage.setItem('pepdose-view-filter', 'Victor');
});
afterEach(cleanup);

describe('viewing as Victor never shows Nadia data', () => {
  it('Dashboard: titration coach ignores the other profile\'s step-up', async () => {
    const nadia = protocol({ id: 'pn', owner: 'Nadia', titrationAlerts: true });
    ops.getProtocols.mockResolvedValue([nadia]);
    ops.getScheduledDosesForProtocol.mockResolvedValue([stepUp('pn', 'Nadia')]);
    await renderAsVictor(<Dashboard />);
    expect(screen.queryByText('Titration coach')).toBeNull();
  });

  it('Dashboard: titration coach still shows the active profile\'s step-up', async () => {
    const victor = protocol({ id: 'pv', owner: 'Victor', titrationAlerts: true });
    ops.getProtocols.mockResolvedValue([victor]);
    ops.getScheduledDosesForProtocol.mockResolvedValue([stepUp('pv', 'Victor')]);
    await renderAsVictor(<Dashboard />);
    expect(screen.getByText('Titration coach')).toBeTruthy();
  });

  it('Calendar: break-week hatch ignores the other profile\'s break', async () => {
    const nadia = protocol({ id: 'pn', owner: 'Nadia', breaks: [{ weekStart: 1, weekEnd: 1, reason: 'NADIA-BREAK' }] });
    ops.getProtocols.mockResolvedValue([nadia]);
    const { container } = await renderAsVictor(<Calendar />);
    expect(container.querySelector('[title="NADIA-BREAK"]')).toBeNull();
  });

  it('Calendar: break-week hatch still shows the active profile\'s break', async () => {
    const victor = protocol({ id: 'pv', owner: 'Victor', breaks: [{ weekStart: 1, weekEnd: 1, reason: 'VICTOR-BREAK' }] });
    ops.getProtocols.mockResolvedValue([victor]);
    const { container } = await renderAsVictor(<Calendar />);
    expect(container.querySelector('[title="VICTOR-BREAK"]')).not.toBeNull();
  });

  it('Protocols: journey sheet ignores the other profile\'s health markers', async () => {
    const victor = protocol({ id: 'pv', owner: 'Victor' });
    ops.getProtocols.mockResolvedValue([victor]);
    ops.getProtocol.mockResolvedValue(victor);
    ops.getHealthMarkers.mockResolvedValue([{ id: 'm1', date: TODAY, weight: 70, owner: 'Nadia' } as HealthMarker]);
    await renderAsVictor(<Protocols />);
    await act(async () => { fireEvent.click(screen.getByText('Healing')); });
    expect(screen.queryByText('Weight')).toBeNull();
  });

  it('Protocols: journey sheet still charts the active profile\'s health markers', async () => {
    const victor = protocol({ id: 'pv', owner: 'Victor' });
    ops.getProtocols.mockResolvedValue([victor]);
    ops.getProtocol.mockResolvedValue(victor);
    ops.getHealthMarkers.mockResolvedValue([{ id: 'm1', date: TODAY, weight: 70, owner: 'Victor' } as HealthMarker]);
    await renderAsVictor(<Protocols />);
    await act(async () => { fireEvent.click(screen.getByText('Healing')); });
    expect(screen.getByText('Weight')).toBeTruthy();
  });

  it('HalfLife: active-levels chart ignores the other profile\'s logged doses', async () => {
    ops.getDoseLogsSince.mockResolvedValue([doseLog('Nadia')]);
    await renderAsVictor(<HalfLife />);
    expect(screen.queryByText('BPC-157')).toBeNull();
  });

  it('HalfLife: active-levels chart still shows the active profile\'s logged doses', async () => {
    ops.getDoseLogsSince.mockResolvedValue([doseLog('Victor')]);
    await renderAsVictor(<HalfLife />);
    expect(screen.getAllByText('BPC-157').length).toBeGreaterThan(0);
  });

  it('InjectionMap: site stats ignore the other profile\'s injections', async () => {
    ops.getDoseLogsSince.mockResolvedValue([doseLog('Nadia')]);
    await renderAsVictor(<InjectionMap />);
    expect(screen.queryByText('Left abdomen')).toBeNull();
  });

  it('InjectionMap: site stats still count the active profile\'s injections', async () => {
    ops.getDoseLogsSince.mockResolvedValue([doseLog('Victor')]);
    await renderAsVictor(<InjectionMap />);
    expect(screen.getByText('Left abdomen')).toBeTruthy();
  });

  it('VialInventory: empty-date forecast ignores the other profile\'s dose history', async () => {
    ops.getVials.mockResolvedValue([vial('Victor')]);
    ops.getDoseLogsForPeptide.mockResolvedValue([doseLogOn('Nadia', '2026-01-01'), doseLogOn('Nadia', '2026-01-04')]);
    await renderAsVictor(<VialInventory />);
    expect(screen.queryByText(/Est\. empty/)).toBeNull();
  });

  it('VialInventory: empty-date forecast still uses the active profile\'s dose history', async () => {
    ops.getVials.mockResolvedValue([vial('Victor')]);
    ops.getDoseLogsForPeptide.mockResolvedValue([doseLogOn('Victor', '2026-01-01'), doseLogOn('Victor', '2026-01-04')]);
    await renderAsVictor(<VialInventory />);
    expect(screen.getByText(/Est\. empty/)).toBeTruthy();
  });
});
