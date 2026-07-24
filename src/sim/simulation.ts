import { SimClock } from './clock';
import { AU_TO_WORLD, COMETS, MOONS, MOON_STYLE, PLANETS, SUN } from './data';
import { cometPathAu, cometPositionAu } from './cometOrbit';
import {
  ellipseGeometry,
  ellipticalPositionAu,
  type EllipseGeometry,
  type OrbitalElements,
} from './ellipticalOrbit';
import { computeLayout, type Layout } from './layout';
import { angleAt, orbitalPosition } from './orbits';
import {
  cometPath3dAu,
  cometPosition3dAu,
  ellipticalPath3dAu,
  ellipticalPosition3dAu,
  type OrbitalElements3D,
} from './orbit3d';
import type { BodyPosition, CometSpec, PlanetSpec, ScaleMode, Vec3 } from './types';

export interface BodySnapshot {
  name: string;
  x: number;
  y: number;
  bodyRadius: number;
  color: string;
  kind: 'sun' | 'planet' | 'moon' | 'comet';
}

export interface Snapshot {
  simDays: number;
  bodies: BodySnapshot[];
}

export interface CometPathRender {
  points: BodyPosition[];
  color: 'green' | 'red';
}

export interface BodySnapshot3D extends BodySnapshot {
  z: number;
}

export interface Snapshot3D {
  simDays: number;
  bodies: BodySnapshot3D[];
}

export interface CometPath3DRender {
  points: Vec3[];
  color: 'green' | 'red';
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

function elements3dFor(planet: PlanetSpec): OrbitalElements3D {
  return {
    ...elementsFor(planet),
    inclinationRad: planet.inclinationRad,
    ascendingNodeRad: planet.ascendingNodeRad,
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

  private findComet(cometName: string): CometSpec | undefined {
    return COMETS.find((c) => c.name === cometName);
  }

  cometBody(cometName: string): BodySnapshot | null {
    const comet = this.findComet(cometName);
    if (!comet) return null;
    const au = cometPositionAu(comet, this.clock.simDays);
    return {
      name: comet.name,
      x: au.x * AU_TO_WORLD,
      y: au.y * AU_TO_WORLD,
      bodyRadius: comet.bodyRadius,
      color: comet.color,
      kind: 'comet',
    };
  }

  cometPath(cometName: string): CometPathRender | null {
    const comet = this.findComet(cometName);
    if (!comet) return null;
    const points = cometPathAu(comet).map((p) => ({ x: p.x * AU_TO_WORLD, y: p.y * AU_TO_WORLD }));
    return { points, color: comet.cometClass === 'hyperbolic' ? 'red' : 'green' };
  }

  cometExtent(cometName: string): number {
    const comet = this.findComet(cometName);
    if (!comet) return 0;
    const maxAu = Math.max(...cometPathAu(comet).map((p) => Math.hypot(p.x, p.y)));
    return maxAu * AU_TO_WORLD;
  }

  /** 3D snapshot: real inclined planet positions; moons on ecliptic-parallel rings. */
  snapshot3D(): Snapshot3D {
    const { simDays } = this.clock;
    const bodies: BodySnapshot3D[] = [
      { name: SUN.name, x: 0, y: 0, z: 0, bodyRadius: SUN.bodyRadius, color: SUN.color, kind: 'sun' },
    ];

    for (const planet of PLANETS) {
      const au = ellipticalPosition3dAu(elements3dFor(planet), simDays);
      const pos = { x: au.x * AU_TO_WORLD, y: au.y * AU_TO_WORLD, z: au.z * AU_TO_WORLD };
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
          x: mpos.x,
          y: mpos.y,
          z: pos.z,
          bodyRadius: MOON_STYLE.bodyRadius,
          color: MOON_STYLE.color,
          kind: 'moon',
        });
      }
    }

    return { simDays, bodies };
  }

  /** One 256-point 3D loop per major body, in world units. */
  orbitPaths3D(): Vec3[][] {
    return PLANETS.map((planet) =>
      ellipticalPath3dAu(elements3dFor(planet)).map((p) => ({
        x: p.x * AU_TO_WORLD,
        y: p.y * AU_TO_WORLD,
        z: p.z * AU_TO_WORLD,
      })),
    );
  }

  cometBody3D(cometName: string): BodySnapshot3D | null {
    const comet = this.findComet(cometName);
    if (!comet) return null;
    const au = cometPosition3dAu(comet, this.clock.simDays);
    return {
      name: comet.name,
      x: au.x * AU_TO_WORLD,
      y: au.y * AU_TO_WORLD,
      z: au.z * AU_TO_WORLD,
      bodyRadius: comet.bodyRadius,
      color: comet.color,
      kind: 'comet',
    };
  }

  cometPath3D(cometName: string): CometPath3DRender | null {
    const comet = this.findComet(cometName);
    if (!comet) return null;
    const points = cometPath3dAu(comet).map((p) => ({
      x: p.x * AU_TO_WORLD,
      y: p.y * AU_TO_WORLD,
      z: p.z * AU_TO_WORLD,
    }));
    return { points, color: comet.cometClass === 'hyperbolic' ? 'red' : 'green' };
  }
}
