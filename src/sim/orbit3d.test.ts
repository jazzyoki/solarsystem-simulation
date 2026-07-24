import { describe, expect, it } from 'vitest';
import { ellipticalPositionAu } from './ellipticalOrbit';
import { COMETS } from './data';
import { cometPositionAu, COMET_PATH_SEGMENTS, COMET_PATH_WINDOW_AU } from './cometOrbit';
import {
  cometPath3dAu,
  cometPosition3dAu,
  ellipticalPath3dAu,
  ellipticalPosition3dAu,
  ORBIT_PATH_SEGMENTS,
  orbitalPlaneToEcliptic,
  type OrbitalElements3D,
} from './orbit3d';

const FLAT: OrbitalElements3D = {
  semiMajorAxisAu: 1.5,
  eccentricity: 0.2,
  perihelionLongitudeRad: 0.7,
  periodDays: 500,
  epochLongitudeRad: 1.2,
  inclinationRad: 0,
  ascendingNodeRad: 0,
};

const TILTED: OrbitalElements3D = { ...FLAT, inclinationRad: 0.5, ascendingNodeRad: 0.4 };

describe('orbitalPlaneToEcliptic', () => {
  it('preserves the radius under rotation', () => {
    const o = { inclinationRad: 1.1, ascendingNodeRad: 2.3, perihelionLongitudeRad: 3.0 };
    for (const nu of [0, 0.5, 2, 4.5]) {
      const p = orbitalPlaneToEcliptic(o, 2.5, nu);
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(2.5, 12);
    }
  });

  it('crosses z = 0 heading north at the ascending node', () => {
    const o = { inclinationRad: 0.3, ascendingNodeRad: 1.1, perihelionLongitudeRad: 1.8 };
    // u = ω + ν = 0 puts the body on the node line at ecliptic longitude Ω.
    const nu = -(o.perihelionLongitudeRad - o.ascendingNodeRad);
    const p = orbitalPlaneToEcliptic(o, 2, nu);
    expect(p.z).toBeCloseTo(0, 12);
    expect(Math.atan2(p.y, p.x)).toBeCloseTo(o.ascendingNodeRad, 12);
    expect(orbitalPlaneToEcliptic(o, 2, nu + 0.01).z).toBeGreaterThan(0);
  });

  it('reaches z amplitude r·sin(i) a quarter turn past the node', () => {
    const o = { inclinationRad: 0.5, ascendingNodeRad: 0.4, perihelionLongitudeRad: 0.9 };
    const nu = Math.PI / 2 - (o.perihelionLongitudeRad - o.ascendingNodeRad);
    expect(orbitalPlaneToEcliptic(o, 3, nu).z).toBeCloseTo(3 * Math.sin(0.5), 12);
  });
});

describe('ellipticalPosition3dAu', () => {
  it('collapses exactly to the 2D position when inclination is zero', () => {
    for (const t of [0, 42.5, 137, 400]) {
      const p2 = ellipticalPositionAu(FLAT, t);
      const p3 = ellipticalPosition3dAu(FLAT, t);
      expect(p3.x, `t=${t}`).toBeCloseTo(p2.x, 12);
      expect(p3.y, `t=${t}`).toBeCloseTo(p2.y, 12);
      expect(p3.z, `t=${t}`).toBeCloseTo(0, 12);
    }
  });

  it('ignores the ascending node when inclination is zero', () => {
    const rotated = { ...FLAT, ascendingNodeRad: 2.1 };
    const p2 = ellipticalPositionAu(FLAT, 100);
    const p3 = ellipticalPosition3dAu(rotated, 100);
    expect(p3.x).toBeCloseTo(p2.x, 12);
    expect(p3.y).toBeCloseTo(p2.y, 12);
    expect(p3.z).toBeCloseTo(0, 12);
  });

  it('bounds |z| by r·sin(i) on a tilted orbit', () => {
    for (const t of [0, 50, 125, 250, 375]) {
      const p = ellipticalPosition3dAu(TILTED, t);
      const r = Math.hypot(p.x, p.y, p.z);
      expect(Math.abs(p.z), `t=${t}`).toBeLessThanOrEqual(
        r * Math.sin(TILTED.inclinationRad) + 1e-12,
      );
    }
  });
});

describe('ellipticalPath3dAu', () => {
  it('samples an open ring of the configured segment count', () => {
    const pts = ellipticalPath3dAu(TILTED);
    expect(pts).toHaveLength(ORBIT_PATH_SEGMENTS);
    for (const p of pts) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
    }
  });

  it('starts at perihelion distance a(1−e)', () => {
    const p0 = ellipticalPath3dAu(TILTED)[0];
    expect(Math.hypot(p0.x, p0.y, p0.z)).toBeCloseTo(
      TILTED.semiMajorAxisAu * (1 - TILTED.eccentricity),
      10,
    );
  });
});

const halley = COMETS.find((c) => c.name === 'Halley')!;
const encke = COMETS.find((c) => c.name === 'Encke')!;
const borisov = COMETS.find((c) => c.name === 'Borisov')!;

describe('cometPosition3dAu', () => {
  it('matches the 2D heliocentric distance for every comet (orientation cannot change r)', () => {
    for (const c of COMETS) {
      const t = c.perihelionTimeSimDays + 30;
      const p2 = cometPositionAu(c, t);
      const p3 = cometPosition3dAu(c, t);
      expect(Math.hypot(p3.x, p3.y, p3.z), c.name).toBeCloseTo(Math.hypot(p2.x, p2.y), 8);
    }
  });

  it('sits at perihelion distance q at Tp', () => {
    const p = cometPosition3dAu(halley, halley.perihelionTimeSimDays);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(halley.perihelionDistanceAu, 8);
  });

  it('moves Halley retrograde in the ecliptic projection via its real inclination', () => {
    const a = cometPosition3dAu(halley, halley.perihelionTimeSimDays);
    const b = cometPosition3dAu(halley, halley.perihelionTimeSimDays + 5);
    // z-component of a×b: negative = clockwise from ecliptic north = retrograde.
    expect(a.x * b.y - a.y * b.x).toBeLessThan(0);
  });

  it('moves Encke prograde', () => {
    const a = cometPosition3dAu(encke, encke.perihelionTimeSimDays);
    const b = cometPosition3dAu(encke, encke.perihelionTimeSimDays + 5);
    expect(a.x * b.y - a.y * b.x).toBeGreaterThan(0);
  });
});

describe('cometPath3dAu', () => {
  it('returns segments+1 points with perihelion at the midpoint', () => {
    const pts = cometPath3dAu(halley);
    expect(pts).toHaveLength(COMET_PATH_SEGMENTS + 1);
    const mid = pts[COMET_PATH_SEGMENTS / 2];
    expect(Math.hypot(mid.x, mid.y, mid.z)).toBeCloseTo(halley.perihelionDistanceAu, 8);
  });

  it('clips unbound paths to the radius window', () => {
    for (const p of cometPath3dAu(borisov)) {
      expect(Math.hypot(p.x, p.y, p.z)).toBeLessThanOrEqual(COMET_PATH_WINDOW_AU + 1e-6);
    }
  });

  it('tilts a high-inclination path out of the ecliptic', () => {
    const maxZ = Math.max(...cometPath3dAu(halley).map((p) => Math.abs(p.z)));
    expect(maxZ).toBeGreaterThan(1); // Halley: i = 162°, aphelion ≈ 35 AU
  });
});
