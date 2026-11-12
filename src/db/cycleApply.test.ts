import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { format } from 'date-fns';
import { applyCycleToProtocol, clearAllData, getProtocol, getScheduledDosesForProtocol, saveProtocol, saveScheduledDoses, withCycle } from './operations';
import { generateSchedule } from '../utils/scheduleEngine';
import { getDB, type UserProtocol } from './schema';

const today = format(new Date(), 'yyyy-MM-dd');
const base = (): Omit<UserProtocol, 'id' | 'createdAt' | 'updatedAt'> => ({
  owner: 'Victor', name: 'TB-500', peptideIds: ['tb-500'],
  doses: [{ peptideId: 'tb-500', dose: 2, unit: 'mg', frequency: 'daily', timeOfDay: 'morning', durationWeeks: 12 }],
  startDate: today, durationWeeks: 12, status: 'active',
});

async function seedPlainCourse() {
  const proto = await saveProtocol(base());
  const doses = generateSchedule({
    protocolId: proto.id, peptideId: 'tb-500', dose: 2, unit: 'mg', frequency: 'daily',
    timeOfDay: 'morning', startDate: today, durationWeeks: 12,
  });
  await saveScheduledDoses(doses, 'Victor');
  const db = await getDB();
  const first = (await getScheduledDosesForProtocol(proto.id)).sort((a, b) => a.date.localeCompare(b.date))[0];
  await db.put('scheduledDoses', { ...first, status: 'logged' });
  return { proto, firstId: first.id };
}

beforeEach(async () => { await clearAllData(); });

describe('withCycle', () => {
  const proto = { ...base(), id: 'p', createdAt: '', updatedAt: '' };

  it('never shortens the course below the cycle length', () => {
    expect(withCycle(proto, 'tb-500', { onWeeks: 8, offWeeks: 8 }).durationWeeks).toBe(32);
  });

  it('keeps a longer existing course', () => {
    expect(withCycle({ ...proto, durationWeeks: 52, doses: [{ ...proto.doses[0], durationWeeks: 52 }] }, 'tb-500', { onWeeks: 4, offWeeks: 2 }).durationWeeks).toBe(52);
  });

  it('removes the cycle when given null', () => {
    const withIt = withCycle(proto, 'tb-500', { onWeeks: 4, offWeeks: 2 });
    expect(withCycle(withIt, 'tb-500', null).doses[0].cycle).toBeUndefined();
  });
});

describe('applyCycleToProtocol', () => {
  it('stores the cycle on the protocol', async () => {
    const { proto } = await seedPlainCourse();
    await applyCycleToProtocol(proto.id, 'tb-500', { onWeeks: 4, offWeeks: 2 });
    expect((await getProtocol(proto.id))?.doses[0].cycle).toEqual({ onWeeks: 4, offWeeks: 2 });
  });

  it('leaves no doses in the off weeks', async () => {
    const { proto } = await seedPlainCourse();
    await applyCycleToProtocol(proto.id, 'tb-500', { onWeeks: 4, offWeeks: 2 });
    const weeks = new Set((await getScheduledDosesForProtocol(proto.id)).map(d => d.weekNumber));
    expect([weeks.has(4), weeks.has(5), weeks.has(6), weeks.has(7)]).toEqual([true, false, false, true]);
  });

  it('keeps a dose that was already logged', async () => {
    const { proto, firstId } = await seedPlainCourse();
    await applyCycleToProtocol(proto.id, 'tb-500', { onWeeks: 4, offWeeks: 2 });
    const kept = (await getScheduledDosesForProtocol(proto.id)).find(d => d.id === firstId);
    expect(kept?.status).toBe('logged');
  });

  it('does not duplicate the logged day', async () => {
    const { proto } = await seedPlainCourse();
    await applyCycleToProtocol(proto.id, 'tb-500', { onWeeks: 4, offWeeks: 2 });
    const onToday = (await getScheduledDosesForProtocol(proto.id)).filter(d => d.date === today);
    expect(onToday).toHaveLength(1);
  });

  it('writes no dose dated before today', async () => {
    const { proto } = await seedPlainCourse();
    const before = (await getScheduledDosesForProtocol(proto.id)).filter(d => d.date < today).length;
    await applyCycleToProtocol(proto.id, 'tb-500', { onWeeks: 4, offWeeks: 2 });
    const after = (await getScheduledDosesForProtocol(proto.id)).filter(d => d.date < today).length;
    expect(after).toBe(before);
  });

  it('stamps rebuilt doses with the protocol owner', async () => {
    const { proto } = await seedPlainCourse();
    await applyCycleToProtocol(proto.id, 'tb-500', { onWeeks: 4, offWeeks: 2 });
    const owners = new Set((await getScheduledDosesForProtocol(proto.id)).map(d => d.owner));
    expect([...owners]).toEqual(['Victor']);
  });
});
