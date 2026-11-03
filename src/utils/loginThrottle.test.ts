import { describe, it, expect } from 'vitest';
import { lockoutRemainingMs, LOCKOUT_MS, MAX_FAILURES } from './loginThrottle';

describe('lockoutRemainingMs', () => {
  it('allows attempts below the failure limit', () => {
    expect(lockoutRemainingMs(MAX_FAILURES - 1, 1000, 1000)).toBe(0);
  });
  it('locks out at the failure limit', () => {
    expect(lockoutRemainingMs(MAX_FAILURES, 1000, 1000)).toBe(LOCKOUT_MS);
  });
  it('releases after the lockout window', () => {
    expect(lockoutRemainingMs(MAX_FAILURES, 1000, 1000 + LOCKOUT_MS)).toBe(0);
  });
});
