export type ScaleMode = 'schematic' | 'toScale';

export interface PlanetSpec {
  name: string;
  /** Sidereal orbital period in days. */
  periodDays: number;
  /** J2000 ecliptic longitude in radians at 2026-01-01 00:00 UTC. */
  epochAngleRad: number;
  /** J2000 semi-major axis in astronomical units (to-scale mode). */
  semiMajorAxisAu: number;
  /** J2000 orbital eccentricity. */
  eccentricity: number;
  /** J2000 longitude of perihelion (Omega + omega) in radians. */
  perihelionLongitudeRad: number;
  /** Display radius in world units (px at zoom 1). */
  bodyRadius: number;
  color: string;
}

export interface MoonSpec {
  name: string;
  /** Parent planet name - must match a PlanetSpec.name. */
  parent: string;
  /** Sidereal orbital period in days; negative = retrograde. */
  periodDays: number;
  /** Optional J2000 ecliptic longitude in radians at the simulation epoch. */
  epochAngleRad?: number;
}

export interface BodyPosition {
  x: number;
  y: number;
}
