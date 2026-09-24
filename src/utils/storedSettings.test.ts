import { beforeEach, describe, expect, it } from 'vitest';
import { readStoredSettings, SETTINGS_KEY } from './storedSettings';

describe('readStoredSettings', () => {
  beforeEach(() => localStorage.clear());

  it('returns {} when nothing is stored', () => {
    expect(readStoredSettings()).toEqual({});
  });

  it('returns {} for corrupt JSON', () => {
    localStorage.setItem(SETTINGS_KEY, '{oops');
    expect(readStoredSettings()).toEqual({});
  });

  it('returns {} for non-object JSON', () => {
    localStorage.setItem(SETTINGS_KEY, 'null');
    expect(readStoredSettings()).toEqual({});
  });

  it('returns the stored object', () => {
    localStorage.setItem(SETTINGS_KEY, '{"syringeType":"u40"}');
    expect(readStoredSettings()).toEqual({ syringeType: 'u40' });
  });
});
