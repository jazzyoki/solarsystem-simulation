import { SimClock } from './clock';
import { AU_TO_WORLD, MOONS, MOON_STYLE, PLANETS, SUN } from './data';
import {
  ellipseGeometry,
  ellipticalPositionAu,
  type EllipseGeometry,
  type OrbitalElements,
} from './ellipticalOrbit';
import { computeLayout, type Layout } from './layout';
import { angleAt, orbitalPosition } from './orbits';
import type { BodyPosition, PlanetSpec, ScaleMode } from './types';

export interface BodySnapshot {
  name: string;
  x: number;
  y: number;
  bodyRadius: number;
  color: string;
  kind: 'sun' | 'planet' | 'moon';
}

export interface Snapshot {
  simDays: number;
  bodies: BodySnapshot[];
}

export type OrbitPath =
  | { kind: 'circle'; radius: number }
  | ({ kind: 'ellipse' } & EllipseGeometry);

function elementsFor(planet: PlanetSpec): OrbitalElements {
  return {
    semiMajorAxisAu: planet.semiMajorAxisAu,
    eccentricity: planet.eccentricity,
    perihelionLongitudeRad: planet.perihelionLongitudeRad,
    periodDays: planet.periodDays,
    epochLongitudeRad: planet.epochAngleRad,
  };
}

export class Simulation {
  readonly clock = new SimClock();
  readonly layout: Layout = computeLayout(PLANETS, MOONS);

  advance(realDtSeconds: number): void {
    this.clock.advance(realDtSeconds);
  }

  private planetPosition(planet: PlanetSpec, simDays: number, mode: ScaleMode): BodyPosition {
    if (mode === 'toScale') {
      const au = ellipticalPositionAu(elementsFor(planet), simDays);
      return { x: au.x * AU_TO_WORLD, y: au.y * AU_TO_WORLD };
    }
    const { orbitRadius } = this.layout.planets[planet.name];
    return orbitalPosition(
      0,
      0,
      orbitRadius,
      angleAt(planet.periodDays, simDays, planet.epochAngleRad),
    );
  }

  snapshot(mode: ScaleMode = 'schematic'): Snapshot {
    const { simDays } = this.clock;
    const bodies: BodySnapshot[] = [
      { name: SUN.name, x: 0, y: 0, bodyRadius: SUN.bodyRadius, color: SUN.color, kind: 'sun' },
    ];

    for (const planet of PLANETS) {
      const pos = this.planetPosition(planet, simDays, mode);
      bodies.push({
        name: planet.name,
        ...pos,
        bodyRadius: planet.bodyRadius,
        color: planet.color,
        kind: 'planet',
      });

      for (const moon of MOONS) {
        if (moon.parent !== planet.name) continue;
        const ring = this.layout.moons[moon.name];
        const mpos = orbitalPosition(
          pos.x,
          pos.y,
          ring,
          angleAt(moon.periodDays, simDays, moon.epochAngleRad),
        );
        bodies.push({
          name: moon.name,
          ...mpos,
          bodyRadius: MOON_STYLE.bodyRadius,
          color: MOON_STYLE.color,
          kind: 'moon',
        });
      }
    }

    return { simDays, bodies };
  }

  orbitPaths(mode: ScaleMode = 'schematic'): OrbitPath[] {
    if (mode === 'toScale') {
      return PLANETS.map((planet) => ({
        kind: 'ellipse' as const,
        ...ellipseGeometry(elementsFor(planet), AU_TO_WORLD),
      }));
    }
    return PLANETS.map((planet) => ({
      kind: 'circle' as const,
      radius: this.layout.planets[planet.name].orbitRadius,
    }));
  }

  extent(mode: ScaleMode = 'schematic'): number {
    if (mode === 'toScale') {
      return (
        Math.max(...PLANETS.map((p) => p.semiMajorAxisAu * (1 + p.eccentricity))) * AU_TO_WORLD
      );
    }
    return Math.max(
      ...Object.values(this.layout.planets).map((e) => e.orbitRadius + e.bubbleRadius),
    );
  }
}
