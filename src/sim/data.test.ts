import { describe, expect, it } from 'vitest';
import { ASTEROID_BELT, AU_TO_WORLD, COMETS, MOONS, PLANETS } from './data';
import { computeLayout } from './layout';

const EXPECTED_MOON_COUNTS: Record<string, number> = {
  Mercury: 0,
  Venus: 0,
  Earth: 1,
  Mars: 2,
  Jupiter: 20,
  Saturn: 30,
  Uranus: 29,
  Neptune: 16,
  Pluto: 1,
};

const DEG_TO_RAD = Math.PI / 180;

const EXPECTED_PLANET_EPOCH_ANGLES_DEG: Record<string, number> = {
  Mercury: 242.262456669,
  Venus: 277.021284224,
  Earth: 100.209656729,
  Mars: 283.796552295,
  Jupiter: 108.967359114,
  Saturn: 1.552905047,
  Uranus: 59.539656457,
  Neptune: 0.995246704,
  Pluto: 302.961154488,
};

const EXPECTED_SEMI_MAJOR_AXIS_AU: Record<string, number> = {
  Mercury: 0.38709927,
  Venus: 0.72333566,
  Earth: 1.00000261,
  Mars: 1.52371034,
  Jupiter: 5.202887,
  Saturn: 9.53667594,
  Uranus: 19.18916464,
  Neptune: 30.06992276,
  Pluto: 39.57126152242962,
};

const EXPECTED_ECCENTRICITY: Record<string, number> = {
  Mercury: 0.20563593,
  Venus: 0.00677672,
  Earth: 0.01671123,
  Mars: 0.0933941,
  Jupiter: 0.04838624,
  Saturn: 0.05386179,
  Uranus: 0.04725744,
  Neptune: 0.00859048,
  Pluto: 0.2494484952274253,
};

const EXPECTED_PERIHELION_LONGITUDE_DEG: Record<string, number> = {
  Mercury: 77.45779628,
  Venus: 131.60246718,
  Earth: 102.93768193,
  Mars: 336.05637041,
  Jupiter: 14.72847983,
  Saturn: 92.59887831,
  Uranus: 170.9542763,
  Neptune: 44.96476227,
  Pluto: 225.218605929714,
};

describe('data tables', () => {
  it('has 8 planets followed by dwarf planet Pluto in solar order', () => {
    expect(PLANETS.map((p) => p.name)).toEqual([
      'Mercury',
      'Venus',
      'Earth',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
      'Pluto',
    ]);
  });

  it('stores Pluto\'s period and display values', () => {
    expect(PLANETS.find((planet) => planet.name === 'Pluto')).toMatchObject({
      periodDays: 90921.85108674582,
      bodyRadius: 4,
      color: '#b8a99a',
    });
  });

  it('has 99 moons', () => {
    expect(MOONS).toHaveLength(99);
  });

  it('has the expected moon count per planet', () => {
    for (const [planet, count] of Object.entries(EXPECTED_MOON_COUNTS)) {
      expect(
        MOONS.filter((m) => m.parent === planet).length,
        planet,
      ).toBe(count);
    }
  });

  it("stores Charon as Pluto's retrograde moon", () => {
    expect(MOONS.find((moon) => moon.name === 'Charon')).toEqual({
      name: 'Charon',
      parent: 'Pluto',
      periodDays: -6.387222,
    });
  });

  it('every moon parent exists', () => {
    const names = new Set(PLANETS.map((p) => p.name));
    for (const m of MOONS) {
      expect(names.has(m.parent), m.name).toBe(true);
    }
  });

  it('all periods are non-zero', () => {
    for (const p of PLANETS) expect(p.periodDays, p.name).not.toBe(0);
    for (const m of MOONS) expect(m.periodDays, m.name).not.toBe(0);
  });

  it('stores the JPL epoch angle for every planet', () => {
    for (const planet of PLANETS) {
      expect(planet.epochAngleRad, planet.name).toBeCloseTo(
        EXPECTED_PLANET_EPOCH_ANGLES_DEG[planet.name] * DEG_TO_RAD,
        10,
      );
    }
  });

  it("calibrates only Earth's Moon", () => {
    const calibratedMoons = MOONS.filter((moon) => moon.epochAngleRad !== undefined);
    expect(calibratedMoons.map((moon) => moon.name)).toEqual(['Moon']);
    expect(calibratedMoons[0].epochAngleRad).toBeCloseTo(66.351233998 * DEG_TO_RAD, 10);
  });

  it('names are unique across planets and moons', () => {
    const all = [...PLANETS.map((p) => p.name), ...MOONS.map((m) => m.name)];
    expect(new Set(all).size).toBe(all.length);
  });

  it('ASTEROID_BELT has positive geometry constants', () => {
    expect(ASTEROID_BELT.count).toBeGreaterThan(0);
    expect(ASTEROID_BELT.minRadius).toBeGreaterThan(0);
    expect(ASTEROID_BELT.maxRadius).toBeGreaterThan(0);
    expect(ASTEROID_BELT.seed).toBeGreaterThan(0);
  });

  it('ASTEROID_BELT radii sit strictly between Mars and Jupiter bubbles', () => {
    const layout = computeLayout(PLANETS, MOONS);
    const { inner, outer } = ASTEROID_BELT.getRadii(layout);
    const marsOuter = layout.planets.Mars.orbitRadius + layout.planets.Mars.bubbleRadius;
    const jupiterInner = layout.planets.Jupiter.orbitRadius - layout.planets.Jupiter.bubbleRadius;
    expect(inner).toBeGreaterThan(marsOuter);
    expect(outer).toBeLessThan(jupiterInner);
  });

  it('stores real orbital elements for every planet', () => {
    for (const p of PLANETS) {
      expect(p.semiMajorAxisAu, p.name).toBeCloseTo(EXPECTED_SEMI_MAJOR_AXIS_AU[p.name], 8);
      expect(p.eccentricity, p.name).toBeCloseTo(EXPECTED_ECCENTRICITY[p.name], 8);
      expect(p.perihelionLongitudeRad, p.name).toBeCloseTo(
        EXPECTED_PERIHELION_LONGITUDE_DEG[p.name] * DEG_TO_RAD,
        10,
      );
    }
  });

  it('exposes a positive AU-to-world scale', () => {
    expect(AU_TO_WORLD).toBeGreaterThan(0);
  });

  it('places the to-scale asteroid belt between the real Mars and Jupiter orbits', () => {
    const layout = computeLayout(PLANETS, MOONS);
    const { inner, outer } = ASTEROID_BELT.getRadii(layout, 'toScale');
    const mars = PLANETS.find((p) => p.name === 'Mars')!;
    const jupiter = PLANETS.find((p) => p.name === 'Jupiter')!;
    expect(inner).toBeGreaterThan(mars.semiMajorAxisAu * (1 + mars.eccentricity) * AU_TO_WORLD);
    expect(outer).toBeLessThan(jupiter.semiMajorAxisAu * (1 - jupiter.eccentricity) * AU_TO_WORLD);
    expect(outer).toBeGreaterThan(inner);
  });
});

describe('COMETS', () => {
  it('contains exactly 15 comets with unique names', () => {
    expect(COMETS).toHaveLength(15);
    expect(new Set(COMETS.map((c) => c.name)).size).toBe(15);
  });

  it('tags hyperbolic comets iff eccentricity >= 1', () => {
    for (const c of COMETS) {
      expect(c.cometClass === 'hyperbolic').toBe(c.eccentricity >= 1);
    }
  });

  it('has positive perihelion distance and radius for every comet', () => {
    for (const c of COMETS) {
      expect(c.perihelionDistanceAu).toBeGreaterThan(0);
      expect(c.bodyRadius).toBeGreaterThan(0);
    }
  });

  it('gives bound comets a positive semi-major axis and unbound a negative one', () => {
    for (const c of COMETS) {
      if (c.eccentricity < 1) expect(c.semiMajorAxisAu).toBeGreaterThan(0);
      else expect(c.semiMajorAxisAu).toBeLessThan(0);
    }
  });
});
