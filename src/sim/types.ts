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
  /** J2000 orbital inclination to the ecliptic in radians. */
  inclinationRad: number;
  /** J2000 longitude of the ascending node (Omega) in radians. */
  ascendingNodeRad: number;
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

export type CometClass = 'short' | 'long' | 'hyperbolic';

export interface CometSpec {
  name: string;
  designation: string;
  /** Orbital eccentricity (>= 1 for hyperbolic / near-parabolic). */
  eccentricity: number;
  /** Semi-major axis in AU (negative for hyperbolic). */
  semiMajorAxisAu: number;
  /** Perihelion distance q in AU. */
  perihelionDistanceAu: number;
  /** Longitude of perihelion (Omega + omega) in radians. */
  perihelionLongitudeRad: number;
  /** Orbital inclination to the ecliptic in radians. */
  inclinationRad: number;
  /** Longitude of the ascending node (Omega) in radians. */
  ascendingNodeRad: number;
  /** Time of perihelion passage in simDays (Tp_JD - 2461041.5). */
  perihelionTimeSimDays: number;
  /** True for retrograde ecliptic motion (inclination > 90 deg). */
  retrograde: boolean;
  cometClass: CometClass;
  /** Exaggerated display radius in world units. */
  bodyRadius: number;
  color: string;
  /** Optional flag, e.g. "historical" for ISON. */
  note?: string;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
