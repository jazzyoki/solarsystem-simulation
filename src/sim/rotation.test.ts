import { describe, expect, it } from 'vitest';
import { axialSpinRad } from './rotation';

const TWO_PI = Math.PI * 2;

describe('axialSpinRad', () => {
  it('is zero at the epoch', () => {
    expect(axialSpinRad(0, 0.99727)).toBe(0);
  });

  it('advances a quarter turn in a quarter period', () => {
    expect(axialSpinRad(0.25, 1)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('wraps a whole turn back to zero rather than 2pi', () => {
    expect(axialSpinRad(1, 1)).toBeCloseTo(0, 12);
    expect(axialSpinRad(10, 1)).toBeCloseTo(0, 12);
  });

  it('keeps large day counts inside [0, 2pi)', () => {
    for (const simDays of [1234.5678, 90_000, 1e6]) {
      const angle = axialSpinRad(simDays, 0.41354);
      expect(angle, `simDays ${simDays}`).toBeGreaterThanOrEqual(0);
      expect(angle, `simDays ${simDays}`).toBeLessThan(TWO_PI);
    }
  });

  it('wraps pre-epoch (negative) days into [0, 2pi) instead of returning a negative angle', () => {
    // Dates before the 2026 epoch give a negative simDays.
    expect(axialSpinRad(-0.25, 1)).toBeCloseTo((3 * Math.PI) / 2, 12);
    const angle = axialSpinRad(-5000.5, 1.02596);
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(TWO_PI);
  });

  it('returns 0 for a zero period instead of NaN', () => {
    expect(axialSpinRad(123, 0)).toBe(0);
  });

  it('returns positive zero, not -0, for negative whole-turn inputs', () => {
    expect(Object.is(axialSpinRad(-1, 1), 0)).toBe(true);
    expect(Object.is(axialSpinRad(-10, 0.5), 0)).toBe(true);
  });
});
