import {
  eccentricAnomalyFromMean,
  meanAnomalyFromTrue,
  trueAnomalyFromEccentric,
} from './kepler';
import type { BodyPosition } from './types';

const TWO_PI = Math.PI * 2;

export interface OrbitalElements {
  semiMajorAxisAu: number;
  eccentricity: number;
  perihelionLongitudeRad: number;
  periodDays: number;
  /** Heliocentric ecliptic true longitude at simDays = 0. */
  epochLongitudeRad: number;
}

export interface EllipseGeometry {
  /** Ellipse center in world units (Sun sits at the +/- focus, at the origin). */
  centerX: number;
  centerY: number;
  semiMajorAxis: number;
  semiMinorAxis: number;
  /** Major-axis rotation from +x, CCW (world/math convention). */
  rotationRad: number;
}

/** Mean anomaly at simDays = 0, derived from the stored epoch true longitude. */
export function epochMeanAnomaly(el: OrbitalElements): number {
  const trueAnomaly0 = el.epochLongitudeRad - el.perihelionLongitudeRad;
  return meanAnomalyFromTrue(trueAnomaly0, el.eccentricity);
}

/**
 * Heliocentric position in AU (ecliptic plane, Sun at the origin) at simDays.
 * The +x axis points toward ecliptic longitude 0. Negative periodDays =>
 * retrograde elapsed motion.
 */
export function ellipticalPositionAu(el: OrbitalElements, simDays: number): BodyPosition {
  const meanAnomaly = epochMeanAnomaly(el) + (TWO_PI * simDays) / el.periodDays;
  const E = eccentricAnomalyFromMean(meanAnomaly, el.eccentricity);
  const trueAnomaly = trueAnomalyFromEccentric(E, el.eccentricity);
  const radiusAu = el.semiMajorAxisAu * (1 - el.eccentricity * Math.cos(E));
  const longitude = el.perihelionLongitudeRad + trueAnomaly;
  return { x: radiusAu * Math.cos(longitude), y: radiusAu * Math.sin(longitude) };
}

/** Ellipse geometry in world units, with the Sun (focus) at the origin. */
export function ellipseGeometry(el: OrbitalElements, auToWorld: number): EllipseGeometry {
  const a = el.semiMajorAxisAu * auToWorld;
  const b = a * Math.sqrt(1 - el.eccentricity * el.eccentricity);
  const focusToCenter = a * el.eccentricity;
  // The center lies opposite the perihelion direction from the focus.
  return {
    centerX: -focusToCenter * Math.cos(el.perihelionLongitudeRad),
    centerY: -focusToCenter * Math.sin(el.perihelionLongitudeRad),
    semiMajorAxis: a,
    semiMinorAxis: b,
    rotationRad: el.perihelionLongitudeRad,
  };
}
