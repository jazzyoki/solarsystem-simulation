export interface PlanetSpec {
  name: string;
  /** Sidereal orbital period in days. */
  periodDays: number;
  /** J2000 ecliptic longitude in radians at 2026-01-01 00:00 UTC. */
  epochAngleRad: number;
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
