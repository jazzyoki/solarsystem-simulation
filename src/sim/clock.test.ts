import { describe, expect, it } from 'vitest';
import { SimClock } from './clock';

describe('SimClock', () => {
  it('starts at day 0, 1x, unpaused', () => {
    const c = new SimClock();
    expect(c.simDays).toBe(0);
    expect(c.multiplier).toBe(1);
    expect(c.paused).toBe(false);
  });

  it('advances 1 day per real second at 1x for frame dt below the cap', () => {
    const c = new SimClock();
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.1, 10);
  });

  it('advances proportionally to the multiplier for frame dt below the cap', () => {
    const c = new SimClock();
    c.setMultiplier(0.5);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.05, 10);
    c.setMultiplier(10);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(1.05, 10);
    c.setMultiplier(100);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(11.05, 10);
    c.setMultiplier(1000);
    c.advance(0.016);
    expect(c.simDays).toBeCloseTo(27.05, 10);
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
});
