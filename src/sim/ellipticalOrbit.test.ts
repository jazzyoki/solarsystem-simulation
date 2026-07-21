import { describe, expect, it } from 'vitest';
import {
  ellipseGeometry,
  ellipticalPositionAu,
  epochMeanAnomaly,
  type OrbitalElements,
} from './ellipticalOrbit';

function elements(overrides: Partial<OrbitalElements> = {}): OrbitalElements {
  return {
    semiMajorAxisAu: 1,
    eccentricity: 0,
    perihelionLongitudeRad: 0,
    periodDays: 100,
    epochLongitudeRad: 0,
    ...overrides,
  };
}

function longitude(p: { x: number; y: number }): number {
  const a = Math.atan2(p.y, p.x);
  return a < 0 ? a + 2 * Math.PI : a;
}

describe('epochMeanAnomaly', () => {
  it('equals epoch longitude minus perihelion for a circular orbit', () => {
    const m = epochMeanAnomaly(
      elements({ epochLongitudeRad: 1.0, perihelionLongitudeRad: 0.3 }),
    );
    expect(m).toBeCloseTo(0.7, 10);
  });
});

describe('ellipticalPositionAu', () => {
  it('starts at the epoch longitude at day 0', () => {
    const el = elements({ eccentricity: 0.2, perihelionLongitudeRad: 0.5, epochLongitudeRad: 2.0 });
    expect(longitude(ellipticalPositionAu(el, 0))).toBeCloseTo(2.0, 9);
  });

  it('keeps a circular orbit at radius equal to the semi-major axis', () => {
    const el = elements({ semiMajorAxisAu: 3, eccentricity: 0 });
    const p = ellipticalPositionAu(el, 37);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(3, 10);
  });

  it('places the planet between perihelion and aphelion radii', () => {
    const el = elements({ semiMajorAxisAu: 2, eccentricity: 0.3 });
    for (const t of [10, 20, 33, 60, 90]) {
      const p = ellipticalPositionAu(el, t);
      const r = Math.hypot(p.x, p.y);
      expect(r).toBeGreaterThanOrEqual(2 * (1 - 0.3) - 1e-9);
      expect(r).toBeLessThanOrEqual(2 * (1 + 0.3) + 1e-9);
    }
  });

  it('sweeps faster near perihelion than near aphelion (Kepler second law)', () => {
    // Epoch longitude == perihelion longitude => starts exactly at perihelion.
    const el = elements({ eccentricity: 0.5, perihelionLongitudeRad: 0, epochLongitudeRad: 0 });
    const nearPeri = Math.abs(
      longitude(ellipticalPositionAu(el, 1)) - longitude(ellipticalPositionAu(el, 0)),
    );
    const nearApo = Math.abs(
      longitude(ellipticalPositionAu(el, 51)) - longitude(ellipticalPositionAu(el, 50)),
    );
    expect(nearPeri).toBeGreaterThan(nearApo);
  });

  it('reverses direction for a negative (retrograde) period', () => {
    const el = elements({ periodDays: -100 });
    // Moving clockwise from longitude 0 lands just below 2*pi.
    expect(longitude(ellipticalPositionAu(el, 1))).toBeGreaterThan(Math.PI);
  });
});

describe('ellipseGeometry', () => {
  it('is a circle centered on the focus for zero eccentricity', () => {
    const g = ellipseGeometry(elements({ semiMajorAxisAu: 2, eccentricity: 0 }), 10);
    expect(g.centerX).toBeCloseTo(0, 10);
    expect(g.centerY).toBeCloseTo(0, 10);
    expect(g.semiMajorAxis).toBeCloseTo(20, 10);
    expect(g.semiMinorAxis).toBeCloseTo(20, 10);
  });

  it('offsets the center opposite perihelion and shortens the minor axis', () => {
    const g = ellipseGeometry(
      elements({ semiMajorAxisAu: 1, eccentricity: 0.5, perihelionLongitudeRad: 0 }),
      10,
    );
    // Perihelion along +x, so the center shifts to -x by a*e*auToWorld = 5.
    expect(g.centerX).toBeCloseTo(-5, 10);
    expect(g.centerY).toBeCloseTo(0, 10);
    expect(g.semiMajorAxis).toBeCloseTo(10, 10);
    expect(g.semiMinorAxis).toBeCloseTo(10 * Math.sqrt(1 - 0.25), 10);
    expect(g.rotationRad).toBeCloseTo(0, 10);
  });
});
