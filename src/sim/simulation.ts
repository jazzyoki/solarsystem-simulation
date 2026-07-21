import { SimClock } from './clock';
import { MOONS, MOON_STYLE, PLANETS, SUN } from './data';
import { computeLayout, type Layout } from './layout';
import { angleAt, orbitalPosition } from './orbits';

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

export class Simulation {
  readonly clock = new SimClock();
  readonly layout: Layout = computeLayout(PLANETS, MOONS);

  advance(realDtSeconds: number): void {
    this.clock.advance(realDtSeconds);
  }

  snapshot(): Snapshot {
    const { simDays } = this.clock;
    const bodies: BodySnapshot[] = [
      { name: SUN.name, x: 0, y: 0, bodyRadius: SUN.bodyRadius, color: SUN.color, kind: 'sun' },
    ];

    for (const planet of PLANETS) {
      const { orbitRadius } = this.layout.planets[planet.name];
      const pos = orbitalPosition(
        0,
        0,
        orbitRadius,
        angleAt(planet.periodDays, simDays, planet.epochAngleRad),
      );
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
}
