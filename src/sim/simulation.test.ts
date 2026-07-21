import { describe, expect, it } from 'vitest';
import { Simulation } from './simulation';

/** Advances the clock in clamp-safe steps (SimClock clamps a single call to 0.25 s). */
function advanceDays(sim: Simulation, days: number): void {
  let remaining = days;
  while (remaining > 0) {
    const step = Math.min(0.25, remaining);
    sim.advance(step);
    remaining -= step;
  }
}

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

function normalizedAngle(y: number, x: number): number {
  const angle = Math.atan2(y, x);
  return angle < 0 ? angle + 2 * Math.PI : angle;
}

describe('Simulation', () => {
  it('snapshots 107 bodies (1 sun + 8 planets + 98 moons)', () => {
    expect(new Simulation().snapshot().bodies).toHaveLength(107);
  });

  it('places the sun at the origin', () => {
    const sun = new Simulation().snapshot().bodies[0];
    expect(sun).toMatchObject({ name: 'Sun', x: 0, y: 0, kind: 'sun' });
  });

  it('starts every planet at its JPL epoch longitude', () => {
    const bodies = new Simulation().snapshot().bodies;

    for (const [name, expectedDegrees] of Object.entries(EXPECTED_PLANET_EPOCH_ANGLES_DEG)) {
      const planet = bodies.find((body) => body.name === name)!;
      expect(normalizedAngle(planet.y, planet.x), name).toBeCloseTo(
        expectedDegrees * DEG_TO_RAD,
        9,
      );
    }
  });

  it("starts Earth's Moon at its JPL geocentric epoch longitude", () => {
    const bodies = new Simulation().snapshot().bodies;
    const earth = bodies.find((body) => body.name === 'Earth')!;
    const moon = bodies.find((body) => body.name === 'Moon')!;

    expect(normalizedAngle(moon.y - earth.y, moon.x - earth.x)).toBeCloseTo(
      66.351233998 * DEG_TO_RAD,
      9,
    );
  });

  it('keeps uncalibrated moons at zero relative phase', () => {
    const bodies = new Simulation().snapshot().bodies;
    const mars = bodies.find((body) => body.name === 'Mars')!;
    const phobos = bodies.find((body) => body.name === 'Phobos')!;

    expect(phobos.y - mars.y).toBeCloseTo(0, 10);
    expect(phobos.x - mars.x).toBeGreaterThan(0);
  });

  it('returns Earth to its epoch position after one Earth year', () => {
    const sim = new Simulation();
    const initialEarth = sim.snapshot().bodies.find((body) => body.name === 'Earth')!;

    advanceDays(sim, 365.256);
    const earth = sim.snapshot().bodies.find((body) => body.name === 'Earth')!;
    const radius = sim.layout.planets.Earth.orbitRadius;

    expect(Math.hypot(earth.x, earth.y)).toBeCloseTo(radius, 5);
    expect(earth.x).toBeCloseTo(initialEarth.x, 5);
    expect(earth.y).toBeCloseTo(initialEarth.y, 5);
  });

  it("keeps Earth's Moon on its ring around the moving Earth", () => {
    const sim = new Simulation();
    advanceDays(sim, 10);
    const bodies = sim.snapshot().bodies;
    const earth = bodies.find((b) => b.name === 'Earth')!;
    const moon = bodies.find((b) => b.name === 'Moon')!;
    expect(Math.hypot(moon.x - earth.x, moon.y - earth.y)).toBeCloseTo(sim.layout.moons.Moon, 10);
  });

  it('Triton orbits retrograde around Neptune', () => {
    const sim = new Simulation();
    advanceDays(sim, 1);
    const bodies = sim.snapshot().bodies;
    const neptune = bodies.find((b) => b.name === 'Neptune')!;
    const triton = bodies.find((b) => b.name === 'Triton')!;
    const angle = Math.atan2(triton.y - neptune.y, triton.x - neptune.x);
    expect(angle).toBeCloseTo((2 * Math.PI) / -5.8769, 5);
  });
});
