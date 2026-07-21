import { describe, expect, it } from 'vitest';
import { angleAt, orbitalPosition } from './orbits';

describe('angleAt', () => {
  it('returns 0 at day 0', () => {
    expect(angleAt(100, 0)).toBe(0);
  });

  it('returns the epoch phase at day 0', () => {
    expect(angleAt(100, 0, 0.75)).toBeCloseTo(0.75, 10);
  });

  it('adds elapsed orbital motion to the epoch phase', () => {
    expect(angleAt(100, 25, 0.75)).toBeCloseTo(0.75 + Math.PI / 2, 10);
  });

  it('returns π/2 at a quarter period', () => {
    expect(angleAt(100, 25)).toBeCloseTo(Math.PI / 2, 10);
  });

  it('returns π at half a period', () => {
    expect(angleAt(100, 50)).toBeCloseTo(Math.PI, 10);
  });

  it('returns 2π at a full period', () => {
    expect(angleAt(100, 100)).toBeCloseTo(2 * Math.PI, 10);
  });

  it('returns negative angles for retrograde (negative) periods', () => {
    expect(angleAt(-4, 1)).toBeCloseTo(-Math.PI / 2, 10);
  });
});

describe('orbitalPosition', () => {
  it('places the body on the +x axis at angle 0', () => {
    expect(orbitalPosition(10, 20, 5, 0)).toEqual({ x: 15, y: 20 });
  });

  it('keeps the distance from the center equal to the radius', () => {
    const p = orbitalPosition(3, -2, 7, 1.234);
    expect(Math.hypot(p.x - 3, p.y - -2)).toBeCloseTo(7, 10);
  });
});
