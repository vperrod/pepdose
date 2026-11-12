import { describe, it, expect } from 'vitest';
import { cycleStatus, protocolCycle, cycleAlerts, type CycleStatus } from './cycleStatus';

describe('cycleStatus', () => {
  // Test 1: today 2026-01-05 (Monday) with cycle {onWeeks:8,offWeeks:8}, duration 32
  it('today 2026-01-05 -> state "on", weekNum 1, weekInPhase 1, phaseWeeks 8, nextChange to "off" on 2026-03-02', () => {
    const result = cycleStatus({
      startDate: '2026-01-05',
      durationWeeks: 32,
      cycle: { onWeeks: 8, offWeeks: 8 },
      today: '2026-01-05'
    });
    
    expect(result.state).toBe('on');
    expect(result.weekNum).toBe(1);
    expect(result.totalWeeks).toBe(32);
    expect(result.weekInPhase).toBe(1);
    expect(result.phaseWeeks).toBe(8);
    expect(result.nextChange).not.toBeNull();
    expect(result.nextChange?.to).toBe('off');
    expect(result.nextChange?.date).toBe('2026-03-02');
    expect(result.nextChange?.daysUntil).toBe(56); // Jan 5 to Mar 2
  });
  
  // Test 2: today 2026-03-01 (Sunday, still week 8) -> 'on' weekInPhase 8, daysUntil 1
  it('today 2026-03-01 -> state "on", weekNum 8, weekInPhase 8, phaseWeeks 8, nextChange to "off" on 2026-03-02', () => {
    const result = cycleStatus({
      startDate: '2026-01-05',
      durationWeeks: 32,
      cycle: { onWeeks: 8, offWeeks: 8 },
      today: '2026-03-01'
    });
    
    expect(result.state).toBe('on');
    expect(result.weekNum).toBe(8);
    expect(result.totalWeeks).toBe(32);
    expect(result.weekInPhase).toBe(8);
    expect(result.phaseWeeks).toBe(8);
    expect(result.nextChange).not.toBeNull();
    expect(result.nextChange?.to).toBe('off');
    expect(result.nextChange?.date).toBe('2026-03-02');
    expect(result.nextChange?.daysUntil).toBe(1); // Mar 1 to Mar 2
  });
  
  // Test 3: today 2026-03-02 -> 'off', weekInPhase 1, phaseWeeks 8, nextChange to 'on' on 2026-04-27
  it('today 2026-03-02 -> state "off", weekNum 9, weekInPhase 1, phaseWeeks 8, nextChange to "on" on 2026-04-27', () => {
    const result = cycleStatus({
      startDate: '2026-01-05',
      durationWeeks: 32,
      cycle: { onWeeks: 8, offWeeks: 8 },
      today: '2026-03-02'
    });
    
    expect(result.state).toBe('off');
    expect(result.weekNum).toBe(9);
    expect(result.totalWeeks).toBe(32);
    expect(result.weekInPhase).toBe(1);
    expect(result.phaseWeeks).toBe(8);
    expect(result.nextChange).not.toBeNull();
    expect(result.nextChange?.to).toBe('on');
    expect(result.nextChange?.date).toBe('2026-04-27');
    expect(result.nextChange?.daysUntil).toBe(56); // Mar 2 to Apr 27
  });
  
  // Test 4: today 2026-01-04 -> 'upcoming' with nextChange to 'start' daysUntil 1
  it('today 2026-01-04 -> state "upcoming", weekNum 0, nextChange to "start" on 2026-01-05, daysUntil 1', () => {
    const result = cycleStatus({
      startDate: '2026-01-05',
      durationWeeks: 32,
      cycle: { onWeeks: 8, offWeeks: 8 },
      today: '2026-01-04'
    });
    
    expect(result.state).toBe('upcoming');
    expect(result.weekNum).toBe(0);
    expect(result.totalWeeks).toBe(32);
    expect(result.weekInPhase).toBe(0);
    expect(result.phaseWeeks).toBe(0);
    expect(result.nextChange).not.toBeNull();
    expect(result.nextChange?.to).toBe('start');
    expect(result.nextChange?.date).toBe('2026-01-05');
    expect(result.nextChange?.daysUntil).toBe(1); // Jan 4 to Jan 5
  });
  
  // Test 5: today 2026-08-31 (week 35) -> 'done'
  it('today 2026-08-31 -> state "done", weekNum 35, nextChange null', () => {
    const result = cycleStatus({
      startDate: '2026-01-05',
      durationWeeks: 32,
      cycle: { onWeeks: 8, offWeeks: 8 },
      today: '2026-08-31'
    });
    
    expect(result.state).toBe('done');
    expect(result.weekNum).toBe(35);
    expect(result.totalWeeks).toBe(32);
    expect(result.weekInPhase).toBe(0);
    expect(result.phaseWeeks).toBe(0);
    expect(result.nextChange).toBeNull();
  });
  
  // Test 6: last phase (24-week course, today in week 20 -> weeks 17-24 are ON, then the course ends)
  it('today week 20 of a 24-week 8/8 course -> state "on", nextChange to "end" on 2026-06-22', () => {
    const result = cycleStatus({
      startDate: '2026-01-05',
      durationWeeks: 24,
      cycle: { onWeeks: 8, offWeeks: 8 },
      today: '2026-05-18' // Jan 5 + 19*7 days
    });
    
    expect(result.state).toBe('on');
    expect(result.weekNum).toBe(20);
    expect(result.totalWeeks).toBe(24);
    expect(result.nextChange).not.toBeNull();
    expect(result.nextChange?.to).toBe('end');
    expect(result.nextChange?.date).toBe('2026-06-22'); // 24 * 7 days from Jan 5
  });
  
  // Test 7: cycle null and no breaks, duration 4 -> always 'on', nextChange.to 'end'
  it('cycle null and no breaks, duration 4 -> always "on", nextChange to "end"', () => {
    const result = cycleStatus({
      startDate: '2026-01-05',
      durationWeeks: 4,
      cycle: null,
      breaks: [],
      today: '2026-01-05'
    });
    
    expect(result.state).toBe('on');
    expect(result.weekNum).toBe(1);
    expect(result.totalWeeks).toBe(4);
    expect(result.weekInPhase).toBe(1);
    expect(result.phaseWeeks).toBe(4);
    expect(result.nextChange).not.toBeNull();
    expect(result.nextChange?.to).toBe('end');
    expect(result.nextChange?.date).toBe('2026-02-02'); // 4 weeks from Jan 5
  });
  
  // Test 8: strip(8/8, 32 weeks) length 24 with 8 true,8 false,8 true
  it('strip for 32 weeks with 8/8 cycle -> 24 length with 8 true,8 false,8 true', () => {
    const result = cycleStatus({
      startDate: '2026-01-05',
      durationWeeks: 32,
      cycle: { onWeeks: 8, offWeeks: 8 },
      today: '2026-01-05'
    });
    
    expect(result.strip.length).toBe(24); // min(32, 24)
    expect(result.strip.slice(0, 8)).toEqual([true, true, true, true, true, true, true, true]); // weeks 1-8 ON
    expect(result.strip.slice(8, 16)).toEqual([false, false, false, false, false, false, false, false]); // weeks 9-16 OFF
    expect(result.strip.slice(16, 24)).toEqual([true, true, true, true, true, true, true, true]); // weeks 17-24 ON
  });
  
  // Test 9: protocolCycle derives a Cycle from regular legacy breaks [{weekStart:9,weekEnd:16,reason:'x'}] with durationWeeks 24 -> {onWeeks:8,offWeeks:8}
  it('protocolCycle derives Cycle from breaks [{weekStart:9,weekEnd:16}] with duration 24', () => {
    const protocol = {
      doses: [{ peptideId: 'test', dose: 1, unit: 'mcg' as const, frequency: 'weekly', timeOfDay: 'morning' }],
      breaks: [{ weekStart: 9, weekEnd: 16, reason: 'x' }],
      durationWeeks: 24
    };
    
    const result = protocolCycle(protocol, 'test');
    
    expect(result.cycle).not.toBeNull();
    expect(result.cycle?.onWeeks).toBe(8);
    expect(result.cycle?.offWeeks).toBe(8);
    expect(result.durationWeeks).toBe(24);
  });
  
  // Test 10: protocolCycle with dose.cycle takes precedence over breaksToCycle
  it('protocolCycle uses dose.cycle when present', () => {
    const protocol = {
      doses: [{ peptideId: 'test', dose: 1, unit: 'mcg' as const, frequency: 'weekly', timeOfDay: 'morning', cycle: { onWeeks: 4, offWeeks: 2 }, durationWeeks: 24 }],
      breaks: [{ weekStart: 9, weekEnd: 16, reason: 'x' }],
      durationWeeks: 24
    };
    
    const result = protocolCycle(protocol, 'test');
    
    expect(result.cycle).not.toBeNull();
    expect(result.cycle?.onWeeks).toBe(4);
    expect(result.cycle?.offWeeks).toBe(2);
    expect(result.durationWeeks).toBe(24);
  });
});
describe('cycleAlerts', () => {
  it('daysUntil 10 -> 2 alerts with dates changeDate-3 and changeDate-1', () => {
    const status: CycleStatus = {
      state: 'on',
      weekNum: 1,
      totalWeeks: 32,
      weekInPhase: 1,
      phaseWeeks: 8,
      nextChange: {
        date: '2026-03-02',
        to: 'off',
        daysUntil: 10
      },
      strip: []
    };
    const alerts = cycleAlerts(status, 'Test Peptide');
    expect(alerts.length).toBe(2);
    expect(alerts.some(a => a.date === '2026-02-27')).toBe(true);
    expect(alerts.some(a => a.date === '2026-03-01')).toBe(true);
    expect(alerts.some(a => a.title.includes('goes off in 3 days'))).toBe(true);
    expect(alerts.some(a => a.title.includes('goes off in 1 day'))).toBe(true);
  });

  it('daysUntil 2 -> only the 1-day alert', () => {
    const status: CycleStatus = {
      state: 'on',
      weekNum: 1,
      totalWeeks: 32,
      weekInPhase: 1,
      phaseWeeks: 8,
      nextChange: {
        date: '2026-03-02',
        to: 'off',
        daysUntil: 2
      },
      strip: []
    };
    const alerts = cycleAlerts(status, 'Test Peptide');
    expect(alerts.length).toBe(1);
    expect(alerts[0].date).toBe('2026-03-01');
    expect(alerts[0].title).toContain('goes off in 1 day');
  });

  it('daysUntil 0 -> none', () => {
    const status: CycleStatus = {
      state: 'off',
      weekNum: 9,
      totalWeeks: 32,
      weekInPhase: 1,
      phaseWeeks: 8,
      nextChange: {
        date: '2026-03-02',
        to: 'off',
        daysUntil: 0
      },
      strip: []
    };
    const alerts = cycleAlerts(status, 'Test Peptide');
    expect(alerts.length).toBe(0);
  });

  it('to "start" -> none', () => {
    const status: CycleStatus = {
      state: 'upcoming',
      weekNum: 0,
      totalWeeks: 32,
      weekInPhase: 0,
      phaseWeeks: 0,
      nextChange: {
        date: '2026-01-05',
        to: 'start',
        daysUntil: 1
      },
      strip: []
    };
    const alerts = cycleAlerts(status, 'Test Peptide');
    expect(alerts.length).toBe(0);
  });

  it('to "off" title contains "goes off in 3 days"', () => {
    const status: CycleStatus = {
      state: 'on',
      weekNum: 1,
      totalWeeks: 32,
      weekInPhase: 1,
      phaseWeeks: 8,
      nextChange: {
        date: '2026-03-02',
        to: 'off',
        daysUntil: 3
      },
      strip: []
    };
    const alerts = cycleAlerts(status, 'Test Peptide');
    expect(alerts.some(a => a.title.includes('goes off in 3 days'))).toBe(true);
  });

  it('to "on" title contains "is back on in 1 day"', () => {
    const status: CycleStatus = {
      state: 'off',
      weekNum: 9,
      totalWeeks: 32,
      weekInPhase: 1,
      phaseWeeks: 8,
      nextChange: {
        date: '2026-04-27',
        to: 'on',
        daysUntil: 1
      },
      strip: []
    };
    const alerts = cycleAlerts(status, 'Test Peptide');
    expect(alerts.some(a => a.title.includes('is back on in 1 day'))).toBe(true);
  });
});
