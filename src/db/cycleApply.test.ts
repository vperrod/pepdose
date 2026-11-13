import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { format } from 'date-fns';
import { applyCycleToProtocol, clearAllData, getProtocol, getScheduledDosesForProtocol, rebuildUpcomingDoses, saveProtocol, saveScheduledDoses, withCycle } from './operations';
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

describe('withCycle on a stack', () => {
  const stack = (): UserProtocol => ({
    ...base(), id: 's', createdAt: '', updatedAt: '', durationWeeks: 8,
    peptideIds: ['tb-500', 'bpc-157'],
    doses: [
      { peptideId: 'tb-500', dose: 2, unit: 'mg', frequency: 'daily', timeOfDay: 'morning' },
      { peptideId: 'bpc-157', dose: 250, unit: 'mcg', frequency: 'daily', timeOfDay: 'morning' },
    ],
  });

  it('keeps the other peptide at its own 8-week course', () => {
    const next = withCycle(stack(), 'tb-500', { onWeeks: 5, offWeeks: 2 });
    expect(next.doses[1].durationWeeks).toBe(8);
  });

  it('raises only the cycled peptide to the cycle length', () => {
    const next = withCycle(stack(), 'tb-500', { onWeeks: 5, offWeeks: 2 });
    expect(next.doses[0].durationWeeks).toBe(24);
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

  it('keeps the ids of upcoming doses a rebuild leaves unchanged', async () => {
    const { proto } = await seedPlainCourse();
    const upcomingIds = async () => (await getScheduledDosesForProtocol(proto.id)).filter(d => d.status === 'upcoming').map(d => d.id).sort();
    const before = await upcomingIds();
    await rebuildUpcomingDoses((await getProtocol(proto.id))!);
    expect(await upcomingIds()).toEqual(before);
  });

  it('writes no deletion tombstones when a rebuild changes nothing', async () => {
    const { proto } = await seedPlainCourse();
    await rebuildUpcomingDoses((await getProtocol(proto.id))!);
    expect(await (await getDB()).getAll('deletions')).toEqual([]);
  });

  it('updates a changed dose in place under its old id', async () => {
    const { proto } = await seedPlainCourse();
    const upcoming = (await getScheduledDosesForProtocol(proto.id)).find(d => d.status === 'upcoming')!;
    await rebuildUpcomingDoses({ ...proto, doses: [{ ...proto.doses[0], dose: 3 }] });
    expect((await (await getDB()).get('scheduledDoses', upcoming.id))?.dose).toBe(3);
  });

  it('tombstones exactly the doses that left the schedule', async () => {
    const { proto } = await seedPlainCourse();
    const before = (await getScheduledDosesForProtocol(proto.id)).map(d => d.id);
    await applyCycleToProtocol(proto.id, 'tb-500', { onWeeks: 4, offWeeks: 2 });
    const after = new Set((await getScheduledDosesForProtocol(proto.id)).map(d => d.id));
    const tombstoned = (await (await getDB()).getAll('deletions')).map(r => r.id).sort();
    expect(tombstoned).toEqual(before.filter(id => !after.has(id)).sort());
  });

  it('stamps rebuilt doses with the protocol owner', async () => {
    const { proto } = await seedPlainCourse();
    await applyCycleToProtocol(proto.id, 'tb-500', { onWeeks: 4, offWeeks: 2 });
    const owners = new Set((await getScheduledDosesForProtocol(proto.id)).map(d => d.owner));
    expect([...owners]).toEqual(['Victor']);
  });
});
