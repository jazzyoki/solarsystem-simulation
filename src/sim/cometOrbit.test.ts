import { describe, expect, it } from 'vitest';
import { COMETS } from './data';
import { cometPathAu, cometPositionAu, meanMotion, COMET_PATH_SEGMENTS } from './cometOrbit';
import type { CometSpec } from './types';

const byName = (name: string): CometSpec => COMETS.find((c) => c.name === name)!;

function distance(spec: CometSpec, simDays: number): number {
  const p = cometPositionAu(spec, simDays);
  return Math.hypot(p.x, p.y);
}

describe('meanMotion', () => {
  it('matches 2*pi/period for a 1 AU circular orbit (~365.25 days)', () => {
    // n = k / a^1.5; for a = 1 AU, period = 2*pi / n days.
    const period = (2 * Math.PI) / meanMotion(1);
    expect(period).toBeCloseTo(365.25, 0);
  });
});

describe('cometPositionAu', () => {
  it('places a bound comet at perihelion distance q at Tp', () => {
    const halley = byName('Halley');
    expect(distance(halley, halley.perihelionTimeSimDays)).toBeCloseTo(halley.perihelionDistanceAu, 4);
  });

  it('places an unbound comet at perihelion distance q at Tp', () => {
    const borisov = byName('Borisov');
    expect(distance(borisov, borisov.perihelionTimeSimDays)).toBeCloseTo(borisov.perihelionDistanceAu, 4);
  });

  it('moves the comet farther from the Sun after perihelion', () => {
    const encke = byName('Encke');
    const rAtPeri = distance(encke, encke.perihelionTimeSimDays);
    const rLater = distance(encke, encke.perihelionTimeSimDays + 200);
    expect(rLater).toBeGreaterThan(rAtPeri);
  });
});

describe('cometPathAu', () => {
  it('returns segments + 1 points', () => {
    expect(cometPathAu(byName('Halley'))).toHaveLength(COMET_PATH_SEGMENTS + 1);
  });

  it('closes the ellipse for a short-period comet', () => {
    const pts = cometPathAu(byName('Encke'));
    const first = pts[0];
    const last = pts[pts.length - 1];
    expect(first.x).toBeCloseTo(last.x, 6);
    expect(first.y).toBeCloseTo(last.y, 6);
  });

  it('keeps a hyperbolic path within the radius window', () => {
    const maxR = Math.max(...cometPathAu(byName('Borisov')).map((p) => Math.hypot(p.x, p.y)));
    expect(maxR).toBeLessThanOrEqual(35 * 1.01);
  });

  it('starts every path near perihelion distance q at the arc midpoint', () => {
    const halley = byName('Halley');
    const pts = cometPathAu(halley);
    const mid = pts[COMET_PATH_SEGMENTS / 2];
    expect(Math.hypot(mid.x, mid.y)).toBeCloseTo(halley.perihelionDistanceAu, 4);
  });
});
