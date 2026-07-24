import { eccentricAnomalyFromMean, trueAnomalyFromEccentric } from './kepler';
import { epochMeanAnomaly, type OrbitalElements } from './ellipticalOrbit';
import { hyperbolicAnomalyFromMean, trueAnomalyFromHyperbolic } from './hyperbolicOrbit';
import {
  cometNuMax,
  COMET_PATH_SEGMENTS,
  COMET_PATH_WINDOW_AU,
  meanMotion,
} from './cometOrbit';
import type { CometSpec, Vec3 } from './types';

const TWO_PI = Math.PI * 2;

/** Number of polyline points used for a 3D planet orbit guide. */
export const ORBIT_PATH_SEGMENTS = 256;

/** Orientation of an orbital plane relative to the ecliptic. */
export interface OrbitOrientation {
  inclinationRad: number;
  ascendingNodeRad: number;
  /** Longitude of perihelion, ϖ = Ω + ω. */
  perihelionLongitudeRad: number;
}

export type OrbitalElements3D = OrbitalElements & OrbitOrientation;

/**
 * Rotate an in-plane position (radius, true anomaly ν) into heliocentric
 * ecliptic 3D coordinates: p = Rz(Ω) · Rx(i) · Rz(ω) · (r·cos ν, r·sin ν, 0)
 * with ω = ϖ − Ω. +z points north of the ecliptic.
 */
export function orbitalPlaneToEcliptic(
  o: OrbitOrientation,
  radius: number,
  trueAnomalyRad: number,
): Vec3 {
  const argPerihelion = o.perihelionLongitudeRad - o.ascendingNodeRad;
  const u = argPerihelion + trueAnomalyRad; // argument of latitude
  const cosNode = Math.cos(o.ascendingNodeRad);
  const sinNode = Math.sin(o.ascendingNodeRad);
  const cosInc = Math.cos(o.inclinationRad);
  const sinInc = Math.sin(o.inclinationRad);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  return {
    x: radius * (cosNode * cosU - sinNode * sinU * cosInc),
    y: radius * (sinNode * cosU + cosNode * sinU * cosInc),
    z: radius * (sinU * sinInc),
  };
}

/**
 * Heliocentric 3D position in AU at simDays. Reuses the 2D Kepler solve and
 * epoch-mean-anomaly derivation (the epoch longitude is treated as in-orbit
 * longitude — exact at i = 0, a stylized approximation at the planets' small
 * inclinations) so 2D and 3D modes agree on each body's phase.
 */
export function ellipticalPosition3dAu(el: OrbitalElements3D, simDays: number): Vec3 {
  const meanAnomaly = epochMeanAnomaly(el) + (TWO_PI * simDays) / el.periodDays;
  const E = eccentricAnomalyFromMean(meanAnomaly, el.eccentricity);
  const trueAnomaly = trueAnomalyFromEccentric(E, el.eccentricity);
  const radiusAu = el.semiMajorAxisAu * (1 - el.eccentricity * Math.cos(E));
  return orbitalPlaneToEcliptic(el, radiusAu, trueAnomaly);
}

/**
 * Sample the full 3D orbit as `segments` points starting at perihelion,
 * uniform in true anomaly. Open ring: the renderer closes it (LineLoop).
 */
export function ellipticalPath3dAu(
  el: OrbitalElements3D,
  segments: number = ORBIT_PATH_SEGMENTS,
): Vec3[] {
  const e = el.eccentricity;
  const semiLatus = el.semiMajorAxisAu * (1 - e * e);
  const points: Vec3[] = [];
  for (let i = 0; i < segments; i++) {
    const nu = (TWO_PI * i) / segments;
    const r = semiLatus / (1 + e * Math.cos(nu));
    points.push(orbitalPlaneToEcliptic(el, r, nu));
  }
  return points;
}

/**
 * Heliocentric 3D comet position in AU at simDays. Unlike the 2D model, the
 * mean anomaly is NOT negated for retrograde comets — with the real
 * inclination applied, i > 90° produces retrograde ecliptic motion naturally.
 */
export function cometPosition3dAu(spec: CometSpec, simDays: number): Vec3 {
  const e = spec.eccentricity;
  const M = meanMotion(spec.semiMajorAxisAu) * (simDays - spec.perihelionTimeSimDays);
  let trueAnomaly: number;
  if (e < 1) {
    const E = eccentricAnomalyFromMean(M, e);
    trueAnomaly = trueAnomalyFromEccentric(E, e);
  } else {
    const H = hyperbolicAnomalyFromMean(M, e);
    trueAnomaly = trueAnomalyFromHyperbolic(H, e);
  }
  // Same q-anchored polar conic as the 2D model (see cometOrbit.ts).
  const radiusAu = (spec.perihelionDistanceAu * (1 + e)) / (1 + e * Math.cos(trueAnomaly));
  return orbitalPlaneToEcliptic(spec, radiusAu, trueAnomaly);
}

/** 3D counterpart of cometPathAu: same ν window, rotated into the ecliptic frame. */
export function cometPath3dAu(
  spec: CometSpec,
  rWindowAu: number = COMET_PATH_WINDOW_AU,
  segments: number = COMET_PATH_SEGMENTS,
): Vec3[] {
  const e = spec.eccentricity;
  const semiLatus = spec.perihelionDistanceAu * (1 + e);
  const nuMax = cometNuMax(spec, rWindowAu);
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const nu = -nuMax + (2 * nuMax * i) / segments;
    const r = semiLatus / (1 + e * Math.cos(nu));
    points.push(orbitalPlaneToEcliptic(spec, r, nu));
  }
  return points;
}
