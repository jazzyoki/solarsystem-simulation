import { eccentricAnomalyFromMean, trueAnomalyFromEccentric } from './kepler';
import { hyperbolicAnomalyFromMean, trueAnomalyFromHyperbolic } from './hyperbolicOrbit';
import type { BodyPosition, CometSpec } from './types';

/** Gaussian gravitational constant (AU^1.5 / day). */
export const GAUSS_K = 0.01720209895;

/** Mean motion (rad/day) from the semi-major axis; |a| handles hyperbolas. */
export function meanMotion(semiMajorAxisAu: number): number {
  return GAUSS_K / Math.abs(semiMajorAxisAu) ** 1.5;
}

/** Mean anomaly at simDays; negated for retrograde ecliptic motion. */
export function cometMeanAnomaly(spec: CometSpec, simDays: number): number {
  const n = meanMotion(spec.semiMajorAxisAu);
  const direction = spec.retrograde ? -1 : 1;
  return direction * n * (simDays - spec.perihelionTimeSimDays);
}

/** Heliocentric position in AU (ecliptic plane, Sun at origin) at simDays. */
export function cometPositionAu(spec: CometSpec, simDays: number): BodyPosition {
  const e = spec.eccentricity;
  const M = cometMeanAnomaly(spec, simDays);
  let trueAnomaly: number;
  if (e < 1) {
    const E = eccentricAnomalyFromMean(M, e);
    trueAnomaly = trueAnomalyFromEccentric(E, e);
  } else {
    const H = hyperbolicAnomalyFromMean(M, e);
    trueAnomaly = trueAnomalyFromHyperbolic(H, e);
  }
  // Polar conic equation r = q(1+e) / (1 + e*cos(nu)), derived from the
  // semi-latus rectum p = a(1-e^2) = q(1+e). Using the stored perihelion
  // distance q directly (rather than recomputing a*(1-e)) keeps the radius
  // exact at Tp even though `a` and `q` are independently-sourced, rounded
  // ephemeris values that don't satisfy a*(1-e) = q to full precision.
  const radiusAu = (spec.perihelionDistanceAu * (1 + e)) / (1 + e * Math.cos(trueAnomaly));
  const longitude = spec.perihelionLongitudeRad + trueAnomaly;
  return { x: radiusAu * Math.cos(longitude), y: radiusAu * Math.sin(longitude) };
}
