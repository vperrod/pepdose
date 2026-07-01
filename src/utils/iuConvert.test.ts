import { describe, it, expect } from 'vitest';
import { mgToIu, iuToMg } from './iuConvert';

describe('iuConvert', () => {
  it('converts mg to IU (HGH 1mg≈3IU)', () => {
    expect(mgToIu(1, 1 / 3)).toBeCloseTo(3);
  });
  it('converts IU to mg', () => {
    expect(iuToMg(3, 1 / 3)).toBeCloseTo(1);
  });
  it('handles zero ratio safely', () => {
    expect(mgToIu(1, 0)).toBe(0);
  });
});
