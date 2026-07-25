import { describe, expect, it } from 'vitest';
import {
  AXIAL_SPIN_MAX_MULTIPLIER,
  axialSpinEnabled,
  DEFAULT_SPEED_MULTIPLIER,
  SimClock,
  SPEED_MULTIPLIERS,
} from './clock';

describe('SimClock', () => {
  it('starts at day 0, at the default speed, unpaused', () => {
    const c = new SimClock();
    expect(c.simDays).toBe(0);
    expect(c.multiplier).toBe(86_400);
    expect(DEFAULT_SPEED_MULTIPLIER).toBe(86_400);
    expect(c.paused).toBe(false);
  });

  it('treats the multiplier as simulated seconds per real second', () => {
    const c = new SimClock();
    c.setMultiplier(1_200);
    c.advance(0.1); // 0.1 real s x 1200 = 120 simulated seconds
    expect(c.simDays * 86_400).toBeCloseTo(120, 6);
  });

  it('advances 1 day per real second at 86,400x for frame dt below the cap', () => {
    const c = new SimClock();
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.1, 10);
  });

  it('advances proportionally to the multiplier for frame dt below the cap', () => {
    const c = new SimClock();
    c.setMultiplier(1_200);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.0013889, 7);
    c.setMultiplier(43_200);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.0513889, 7);
    c.setMultiplier(2_592_000);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(3.0513889, 7);
    c.setMultiplier(94_608_000);
    c.advance(0.016);
    expect(c.simDays).toBeCloseTo(20.5713889, 7);
  });

  it('exposes the nine speed options in ascending order', () => {
    expect(SPEED_MULTIPLIERS).toEqual([
      1_200, 3_600, 21_600, 43_200, 86_400,
      2_592_000, 7_776_000, 31_536_000, 94_608_000,
    ]);
    expect(SPEED_MULTIPLIERS).toContain(DEFAULT_SPEED_MULTIPLIER);
  });

  it('does not advance while paused', () => {
    const c = new SimClock();
    c.setPaused(true);
    c.advance(1);
    expect(c.simDays).toBe(0);
    c.setPaused(false);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.1, 10);
  });

  it('clamps huge frame deltas to 0.25 s', () => {
    const c = new SimClock();
    c.advance(10);
    expect(c.simDays).toBeCloseTo(0.25, 10);
  });

  it('jumps to an explicit simDays value', () => {
    const c = new SimClock();
    c.setSimDays(789);
    expect(c.simDays).toBe(789);
    c.setSimDays(-1);
    expect(c.simDays).toBe(-1);
  });
});

describe('axialSpinEnabled', () => {
  it('enables spin for the five scales below 1s = 1 month and disables the rest', () => {
    expect(SPEED_MULTIPLIERS.filter((m) => axialSpinEnabled(m))).toEqual([
      1_200, 3_600, 21_600, 43_200, 86_400,
    ]);
    expect(SPEED_MULTIPLIERS.filter((m) => !axialSpinEnabled(m))).toEqual([
      2_592_000, 7_776_000, 31_536_000, 94_608_000,
    ]);
  });

  it('puts the boundary between 1s = 24 h and 1s = 1 month', () => {
    expect(AXIAL_SPIN_MAX_MULTIPLIER).toBe(2_592_000);
    expect(axialSpinEnabled(86_400)).toBe(true);
    expect(axialSpinEnabled(2_592_000)).toBe(false);
  });
});
