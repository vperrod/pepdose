/** Run startup housekeeping once the browser is idle, so it doesn't compete with
 *  first render. Safari has no requestIdleCallback, hence the timer fallback. */
export function whenIdle(task: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: 5000 });
  else setTimeout(task, 1000);
}
