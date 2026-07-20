import type { MoonSpec, PlanetSpec } from './types';

export interface LayoutEntry {
  /** Planet's orbit radius around the sun (world units). */
  orbitRadius: number;
  /** Radius of the planet's moon system (0 when the planet has no moons). */
  bubbleRadius: number;
}

export interface Layout {
  planets: Record<string, LayoutEntry>;
  /** Moon name -> orbit radius around its parent planet (world units). */
  moons: Record<string, number>;
}

const FIRST_ORBIT_RADIUS = 80;
const ORBIT_GAP = 25;
const MOON_RING_START = 6;
const MOON_RING_STEP = 3;

export function computeLayout(planets: PlanetSpec[], moons: MoonSpec[]): Layout {
  const layout: Layout = { planets: {}, moons: {} };
  let previousOrbit = 0;
  let previousBubble = 0;

  planets.forEach((planet, index) => {
    const planetMoons = moons
      .filter((m) => m.parent === planet.name)
      .sort((a, b) => Math.abs(a.periodDays) - Math.abs(b.periodDays));

    const bubble =
      planetMoons.length === 0
        ? 0
        : planet.bodyRadius +
          MOON_RING_START +
          (planetMoons.length - 1) * MOON_RING_STEP +
          MOON_RING_STEP;

    const orbitRadius =
      index === 0 ? FIRST_ORBIT_RADIUS : previousOrbit + previousBubble + bubble + ORBIT_GAP;

    layout.planets[planet.name] = { orbitRadius, bubbleRadius: bubble };
    planetMoons.forEach((moon, i) => {
      layout.moons[moon.name] = planet.bodyRadius + MOON_RING_START + i * MOON_RING_STEP;
    });

    previousOrbit = orbitRadius;
    previousBubble = bubble;
  });

  return layout;
}
