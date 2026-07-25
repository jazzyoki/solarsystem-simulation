const TWO_PI = Math.PI * 2;

/**
 * Axial spin angle in radians for a body at simDays, wrapped into [0, 2pi).
 *
 * A pure function of simDays rather than an accumulator, so seeking a date,
 * pausing, or switching view modes always yields the same orientation for the
 * same date. Reducing turns before scaling keeps precision at large simDays.
 *
 * rotationPeriodDays is always positive (see PlanetSpec): retrograde spin is
 * expressed through obliquity > pi/2, never a negative period. A 0 period
 * returns 0 rather than NaN, which would silently make a body vanish.
 */
export function axialSpinRad(simDays: number, rotationPeriodDays: number): number {
  if (rotationPeriodDays === 0) return 0;
  const angle = ((simDays / rotationPeriodDays) % 1) * TWO_PI;
  return angle < 0 ? angle + TWO_PI : angle;
}
