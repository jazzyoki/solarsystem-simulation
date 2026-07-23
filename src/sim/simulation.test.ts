import { describe, expect, it } from 'vitest';
import { AU_TO_WORLD, COMETS, PLANETS } from './data';
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
  Pluto: 302.961154488,
};

function normalizedAngle(y: number, x: number): number {
  const angle = Math.atan2(y, x);
  return angle < 0 ? angle + 2 * Math.PI : angle;
}

describe('Simulation', () => {
  it('snapshots 109 bodies (1 sun + 9 major bodies + 99 moons)', () => {
    expect(new Simulation().snapshot().bodies).toHaveLength(109);
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

  it('Charon orbits retrograde around Pluto', () => {
    const sim = new Simulation();
    advanceDays(sim, 1);
    const bodies = sim.snapshot().bodies;
    const pluto = bodies.find((b) => b.name === 'Pluto')!;
    const charon = bodies.find((b) => b.name === 'Charon')!;
    const angle = Math.atan2(charon.y - pluto.y, charon.x - pluto.x);
    expect(angle).toBeCloseTo((2 * Math.PI) / -6.387222, 5);
  });

  it('places every planet at its epoch longitude in to-scale mode', () => {
    const bodies = new Simulation().snapshot('toScale').bodies;
    for (const [name, deg] of Object.entries(EXPECTED_PLANET_EPOCH_ANGLES_DEG)) {
      const p = bodies.find((b) => b.name === name)!;
      expect(normalizedAngle(p.y, p.x), name).toBeCloseTo(deg * DEG_TO_RAD, 6);
    }
  });

  it('spreads planets by real distance in to-scale mode', () => {
    const bodies = new Simulation().snapshot('toScale').bodies;
    const dist = (n: string) => {
      const b = bodies.find((x) => x.name === n)!;
      return Math.hypot(b.x, b.y);
    };
    expect(dist('Pluto')).toBeGreaterThan(dist('Neptune'));
    expect(dist('Neptune')).toBeGreaterThan(dist('Uranus'));
    expect(dist('Uranus')).toBeGreaterThan(dist('Saturn'));
    expect(dist('Saturn')).toBeGreaterThan(dist('Jupiter'));
    expect(dist('Jupiter')).toBeGreaterThan(dist('Mars'));
    expect(dist('Mars')).toBeGreaterThan(dist('Earth'));
    expect(dist('Earth')).toBeGreaterThan(dist('Mercury'));
    // Earth's semi-major axis ~ 1 AU maps to ~ AU_TO_WORLD (150) world units.
    expect(dist('Earth')).toBeGreaterThan(140);
    expect(dist('Earth')).toBeLessThan(160);
  });

  it('keeps schematic snapshots identical to the default', () => {
    const a = new Simulation().snapshot();
    const b = new Simulation().snapshot('schematic');
    expect(a.bodies).toEqual(b.bodies);
  });

  it('produces one ellipse path per major body in to-scale mode', () => {
    const paths = new Simulation().orbitPaths('toScale');
    expect(paths).toHaveLength(9);
    expect(paths.every((p) => p.kind === 'ellipse')).toBe(true);
  });

  it('produces circular paths in schematic mode', () => {
    const paths = new Simulation().orbitPaths('schematic');
    expect(paths).toHaveLength(9);
    expect(paths.every((p) => p.kind === 'circle')).toBe(true);
  });

  it('includes Pluto and Charon in the schematic extent', () => {
    const sim = new Simulation();
    const pluto = sim.layout.planets.Pluto;
    expect(sim.extent('schematic')).toBe(pluto.orbitRadius + pluto.bubbleRadius);
  });

  it("includes Pluto's aphelion in the to-scale extent", () => {
    const sim = new Simulation();
    const pluto = PLANETS.find((planet) => planet.name === 'Pluto')!;
    expect(sim.extent('toScale')).toBeCloseTo(
      pluto.semiMajorAxisAu * (1 + pluto.eccentricity) * AU_TO_WORLD,
      10,
    );
  });
});

describe('Simulation comets', () => {
  it('returns null for an unknown comet', () => {
    const sim = new Simulation();
    expect(sim.cometBody('Nope')).toBeNull();
    expect(sim.cometPath('Nope')).toBeNull();
  });

  it('colors bound comets green and unbound comets red', () => {
    const sim = new Simulation();
    expect(sim.cometPath('Halley')!.color).toBe('green');
    expect(sim.cometPath('Borisov')!.color).toBe('red');
  });

  it('reports a comet body in world units with kind "comet"', () => {
    const sim = new Simulation();
    sim.clock.setSimDays(COMETS.find((c) => c.name === 'Halley')!.perihelionTimeSimDays);
    const body = sim.cometBody('Halley')!;
    expect(body.kind).toBe('comet');
    // At perihelion, q = 0.575 AU * 150 = ~86 world units from the Sun.
    expect(Math.hypot(body.x, body.y)).toBeCloseTo(0.575 * 150, 0);
  });

  it('gives a positive framing extent', () => {
    const sim = new Simulation();
    expect(sim.cometExtent('Halley')).toBeGreaterThan(0);
  });
});
