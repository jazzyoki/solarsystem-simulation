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

describe('Simulation', () => {
  it('snapshots 107 bodies (1 sun + 8 planets + 98 moons)', () => {
    expect(new Simulation().snapshot().bodies).toHaveLength(107);
  });

  it('places the sun at the origin', () => {
    const sun = new Simulation().snapshot().bodies[0];
    expect(sun).toMatchObject({ name: 'Sun', x: 0, y: 0, kind: 'sun' });
  });

  it('starts all bodies aligned on the +x axis at day 0', () => {
    for (const b of new Simulation().snapshot().bodies) {
      expect(b.y, b.name).toBeCloseTo(0, 10);
      expect(b.x, b.name).toBeGreaterThanOrEqual(0);
    }
  });

  it('Earth completes exactly one revolution per Earth year', () => {
    const sim = new Simulation();
    advanceDays(sim, 365.256);
    const earth = sim.snapshot().bodies.find((b) => b.name === 'Earth')!;
    const r = sim.layout.planets.Earth.orbitRadius;
    expect(Math.hypot(earth.x, earth.y)).toBeCloseTo(r, 5);
    expect(earth.y).toBeCloseTo(0, 5);
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
