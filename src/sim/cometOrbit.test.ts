import { describe, expect, it } from 'vitest';
import { COMETS } from './data';
import {
  cometPathAu,
  cometPositionAu,
  meanMotion,
  COMET_PATH_SEGMENTS,
  COMET_PATH_WINDOW_AU,
} from './cometOrbit';
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

  it('is symmetric about its midpoint: radius is even in true anomaly', () => {
    // r(nu) depends only on cos(nu), which is even, and the sampler mirrors
    // nu about 0 at the midpoint index. So points equidistant from the
    // midpoint (i and segments - i) must sit at the same heliocentric
    // radius, regardless of nuMax — unlike an r===q check at a single
    // fixed index, this would fail if the sampling were skewed or offset.
    const halley = byName('Halley');
    const pts = cometPathAu(halley);
    for (const i of [10, 30, 50]) {
      const a = pts[i];
      const b = pts[COMET_PATH_SEGMENTS - i];
      expect(Math.hypot(b.x, b.y)).toBeCloseTo(Math.hypot(a.x, a.y), 6);
    }
  });

  it('clips a long-period comet well inside its true aphelion', () => {
    // Hale-Bopp: a ~= 177 AU, aphelion ~= a(1+e) ~= 354 AU. The rendered
    // path must be clipped to the COMET_PATH_WINDOW_AU window, not the
    // true (far larger) aphelion distance.
    const haleBopp = byName('Hale-Bopp');
    const maxR = Math.max(...cometPathAu(haleBopp).map((p) => Math.hypot(p.x, p.y)));
    expect(maxR).toBeLessThanOrEqual(COMET_PATH_WINDOW_AU * 1.05);
  });
});
