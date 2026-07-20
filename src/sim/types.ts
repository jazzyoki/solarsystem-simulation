export interface PlanetSpec {
  name: string;
  /** Sidereal orbital period in days. */
  periodDays: number;
  /** Display radius in world units (px at zoom 1). */
  bodyRadius: number;
  color: string;
}

export interface MoonSpec {
  name: string;
  /** Parent planet name — must match a PlanetSpec.name. */
  parent: string;
  /** Sidereal orbital period in days; negative = retrograde. */
  periodDays: number;
}

export interface BodyPosition {
  x: number;
  y: number;
}
