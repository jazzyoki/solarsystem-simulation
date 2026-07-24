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

/** Radius (AU) at which long-period and hyperbolic arcs are clipped. */
export const COMET_PATH_WINDOW_AU = 35;
/** Number of segments in a sampled comet path (points = segments + 1). */
export const COMET_PATH_SEGMENTS = 128;

/**
 * Maximum |true anomaly| drawn for a comet path: π for short-period comets,
 * else clipped to the radius window (and, for hyperbolas, to just inside the
 * asymptote).
 */
export function cometNuMax(spec: CometSpec, rWindowAu: number = COMET_PATH_WINDOW_AU): number {
  const e = spec.eccentricity;
  if (spec.cometClass === 'short') return Math.PI;
  const semiLatus = spec.perihelionDistanceAu * (1 + e);
  const cosAtWindow = (semiLatus / rWindowAu - 1) / e;
  const nuAtWindow = Math.acos(Math.max(-1, Math.min(1, cosAtWindow)));
  if (e < 1) return nuAtWindow;
  return Math.min(Math.acos(-1 / e) - 1e-3, nuAtWindow);
}

/**
 * Sample a comet's orbit into a polyline of heliocentric AU points, symmetric
 * in true anomaly about perihelion (midpoint = perihelion). Short-period comets
 * sample the full ellipse; long-period and hyperbolic comets are clipped to a
 * radius window (and, for hyperbolas, to just inside the asymptote).
 */
export function cometPathAu(
  spec: CometSpec,
  rWindowAu: number = COMET_PATH_WINDOW_AU,
  segments: number = COMET_PATH_SEGMENTS,
): BodyPosition[] {
  const e = spec.eccentricity;
  const semiLatus = spec.perihelionDistanceAu * (1 + e); // p = q(1 + e)
  const w = spec.perihelionLongitudeRad;

  const nuMax = cometNuMax(spec, rWindowAu);

  const points: BodyPosition[] = [];
  for (let i = 0; i <= segments; i++) {
    const nu = -nuMax + (2 * nuMax * i) / segments;
    const r = semiLatus / (1 + e * Math.cos(nu));
    const longitude = w + nu;
    points.push({ x: r * Math.cos(longitude), y: r * Math.sin(longitude) });
  }
  return points;
}
