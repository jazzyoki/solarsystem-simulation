import { describe, expect, it } from 'vitest';
import { ASTEROID_BELT, MOONS, PLANETS } from './data';
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
};

describe('data tables', () => {
  it('has 8 planets in solar order', () => {
    expect(PLANETS.map((p) => p.name)).toEqual([
      'Mercury',
      'Venus',
      'Earth',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
    ]);
  });

  it('has 98 moons', () => {
    expect(MOONS).toHaveLength(98);
  });

  it('has the expected moon count per planet', () => {
    for (const [planet, count] of Object.entries(EXPECTED_MOON_COUNTS)) {
      expect(
        MOONS.filter((m) => m.parent === planet).length,
        planet,
      ).toBe(count);
    }
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
});
