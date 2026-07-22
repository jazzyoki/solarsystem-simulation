const KEPLER_TOLERANCE = 1e-12;
const KEPLER_MAX_ITERATIONS = 100;

/**
 * Solve Kepler's equation `M = E - e*sin(E)` for the eccentric anomaly `E`
 * using Newton-Raphson. A second-order starting value keeps it convergent for
 * the high eccentricities of comets (up to ~0.9999), as well as planets.
 */
export function eccentricAnomalyFromMean(meanAnomalyRad: number, eccentricity: number): number {
  const M = meanAnomalyRad;
  let E = M + eccentricity * Math.sin(M) * (1 + eccentricity * Math.cos(M));
  for (let i = 0; i < KEPLER_MAX_ITERATIONS; i++) {
    const delta = (E - eccentricity * Math.sin(E) - M) /
      (1 - eccentricity * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < KEPLER_TOLERANCE) break;
  }
  return E;
}

/** True anomaly `nu` from eccentric anomaly `E`. */
export function trueAnomalyFromEccentric(eccentricAnomalyRad: number, eccentricity: number): number {
  return Math.atan2(
    Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomalyRad),
    Math.cos(eccentricAnomalyRad) - eccentricity,
  );
}

/** Mean anomaly `M` from true anomaly `nu` (inverse path via eccentric anomaly). */
export function meanAnomalyFromTrue(trueAnomalyRad: number, eccentricity: number): number {
  const E = Math.atan2(
    Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(trueAnomalyRad),
    Math.cos(trueAnomalyRad) + eccentricity,
  );
  return E - eccentricity * Math.sin(E);
}
