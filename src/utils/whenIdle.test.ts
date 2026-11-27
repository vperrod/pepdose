import { afterEach, expect, it, vi } from 'vitest';
import { whenIdle } from './whenIdle';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('hands the task to requestIdleCallback with a deadline', () => {
  const ric = vi.fn();
  vi.stubGlobal('requestIdleCallback', ric);
  const task = () => {};
  whenIdle(task);
  expect(ric).toHaveBeenCalledWith(task, { timeout: 5000 });
});

it('defers the task with a timer where requestIdleCallback is missing', () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestIdleCallback', undefined);
  const ran: string[] = [];
  whenIdle(() => ran.push('task'));
  const before = [...ran];
  vi.runAllTimers();
  expect({ before, after: ran }).toEqual({ before: [], after: ['task'] });
});
