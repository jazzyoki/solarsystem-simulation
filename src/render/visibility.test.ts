import { describe, expect, it } from 'vitest';
import { labelOpacity, moonOpacity } from './visibility';

describe('visibility', () => {
  const viewport = { width: 1000, height: 800 };

  it('returns 0 below the moon threshold', () => {
    expect(moonOpacity(119, viewport)).toBe(0);
  });

  it('returns 1 above the moon threshold', () => {
    expect(moonOpacity(250, viewport)).toBe(1);
  });

  it('fades linearly between moon thresholds', () => {
    expect(moonOpacity(140, viewport)).toBeCloseTo(0.25, 5);
    expect(moonOpacity(160, viewport)).toBeCloseTo(0.5, 5);
    expect(moonOpacity(180, viewport)).toBeCloseTo(0.75, 5);
  });

  it('returns 0 below the label threshold', () => {
    expect(labelOpacity(279, viewport)).toBe(0);
  });

  it('returns 1 above the label threshold', () => {
    expect(labelOpacity(450, viewport)).toBe(1);
  });

  it('fades linearly between label thresholds', () => {
    expect(labelOpacity(300, viewport)).toBeCloseTo(0.25, 5);
    expect(labelOpacity(320, viewport)).toBeCloseTo(0.5, 5);
    expect(labelOpacity(340, viewport)).toBeCloseTo(0.75, 5);
  });
});
