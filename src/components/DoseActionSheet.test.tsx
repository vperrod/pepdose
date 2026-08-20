// @vitest-environment jsdom
import { it, expect, afterEach, vi } from 'vitest';
import { format } from 'date-fns';
import { render, act, cleanup } from '@testing-library/react';
import { DoseActionSheet } from './DoseActionSheet';
import type { DoseLog, ScheduledDose } from '../db/schema';

const ops = vi.hoisted(() => ({ getDoseLogsSince: vi.fn(async (): Promise<DoseLog[]> => []) }));
vi.mock('../db/operations', () => ({
  getDoseLogsSince: ops.getDoseLogsSince,
  logDose: vi.fn(),
  updateDoseLog: vi.fn(),
  updateScheduledDose: vi.fn(),
  deleteDoseLog: vi.fn(),
  getProtocol: vi.fn().mockResolvedValue(undefined),
}));

const today = format(new Date(), 'yyyy-MM-dd');

const dose: ScheduledDose & { peptideName: string; color: string } = {
  id: 'dose-1', owner: 'Victor', protocolId: 'p1', peptideId: 'bpc-157',
  date: today, time: '09:00', dose: 250, unit: 'mcg', route: 'subq',
  status: 'logged', weekNumber: 1, peptideName: 'BPC-157', color: '#fff',
};

const log: DoseLog = {
  id: 'log-1', owner: 'Victor', scheduledDoseId: 'dose-1', protocolId: 'p1',
  peptideId: 'bpc-157', date: today, time: '09:00', dose: 250, unit: 'mcg',
  route: 'subq', createdAt: `${today}T09:00:00.000Z`,
};

// A site injected within 3 days renders in BodyMapSVG's "recently used" red.
const RECENT_RED = '#ef4444';

async function renderSheet() {
  const r = render(<DoseActionSheet dose={dose} log={log} onClose={() => {}} onUpdated={() => {}} />);
  await act(async () => {});
  return r;
}

afterEach(() => { cleanup(); ops.getDoseLogsSince.mockReset(); });

it("marks a site as recently used when this dose's owner injected there today", async () => {
  ops.getDoseLogsSince.mockResolvedValue([{ ...log, id: 'l2', injectionSite: 'Left abdomen' }]);
  const { container } = await renderSheet();
  expect(container.querySelectorAll(`circle[fill="${RECENT_RED}"]`).length).toBeGreaterThan(0);
});

it('ignores the other profile\'s injections when computing site rest times', async () => {
  ops.getDoseLogsSince.mockResolvedValue([
    { ...log, id: 'l3', owner: 'Nadia', injectionSite: 'Left abdomen' },
  ]);
  const { container } = await renderSheet();
  expect(container.querySelectorAll(`circle[fill="${RECENT_RED}"]`)).toHaveLength(0);
});
