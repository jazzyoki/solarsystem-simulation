import { describe, expect, it } from 'vitest';
import { timeScaleLabel } from './timeScale';

describe('timeScaleLabel', () => {
  it('maps every speed multiplier to its real-time scale', () => {
    expect(timeScaleLabel(0.5)).toBe('1s = ½ day');
    expect(timeScaleLabel(1)).toBe('1s = 1 day');
    expect(timeScaleLabel(10)).toBe('1s = 10 days');
    expect(timeScaleLabel(100)).toBe('1s = 100 days');
    expect(timeScaleLabel(1000)).toBe('1s = 1000 days');
  });
});
