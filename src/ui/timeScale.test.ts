import { describe, expect, it } from 'vitest';
import { SPEED_MULTIPLIERS } from '../sim/clock';
import { speedMultiplierLabel, timeScaleLabel } from './timeScale';

describe('timeScaleLabel', () => {
  it('maps every speed multiplier to its human-readable scale', () => {
    expect(timeScaleLabel(1_200)).toBe('1s = 20 min');
    expect(timeScaleLabel(3_600)).toBe('1s = 1 h');
    expect(timeScaleLabel(21_600)).toBe('1s = 6 h');
    expect(timeScaleLabel(43_200)).toBe('1s = 12 h');
    expect(timeScaleLabel(86_400)).toBe('1s = 24 h');
    expect(timeScaleLabel(2_592_000)).toBe('1s = 1 month');
    expect(timeScaleLabel(7_776_000)).toBe('1s = 3 months');
    expect(timeScaleLabel(31_536_000)).toBe('1s = 1 year');
    expect(timeScaleLabel(94_608_000)).toBe('1s = 3 years');
  });

  it('gives every speed option a distinct, non-empty label', () => {
    const labels = SPEED_MULTIPLIERS.map(timeScaleLabel);
    expect(labels.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(SPEED_MULTIPLIERS.length);
  });
});

describe('speedMultiplierLabel', () => {
  it('formats the multiplier with digit grouping', () => {
    expect(speedMultiplierLabel(1_200)).toBe('1,200×');
    expect(speedMultiplierLabel(86_400)).toBe('86,400×');
    expect(speedMultiplierLabel(94_608_000)).toBe('94,608,000×');
  });
});
