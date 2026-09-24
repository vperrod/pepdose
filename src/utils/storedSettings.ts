export const SETTINGS_KEY = 'pepdose-settings';

/** Raw settings object from localStorage; `{}` when missing, corrupt, or not an object. */
export function readStoredSettings(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
