// Client-side speed bump only (bypassable): the real limit is Supabase's auth rate limit.
export const MAX_FAILURES = 5;
export const LOCKOUT_MS = 30_000;

export function lockoutRemainingMs(failures: number, lastFailureAt: number, now: number): number {
  if (failures < MAX_FAILURES) return 0;
  return Math.max(0, lastFailureAt + LOCKOUT_MS - now);
}
