import { describe, expect, it } from 'vitest';
import { MOONS, PLANETS } from './data';

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

  it('names are unique across planets and moons', () => {
    const all = [...PLANETS.map((p) => p.name), ...MOONS.map((m) => m.name)];
    expect(new Set(all).size).toBe(all.length);
  });
});
