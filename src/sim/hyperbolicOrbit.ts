const HYPERBOLIC_TOLERANCE = 1e-12;
const HYPERBOLIC_MAX_ITERATIONS = 100;

/**
 * Solve the hyperbolic Kepler equation `M = e*sinh(H) - H` for the hyperbolic
 * anomaly `H` using Newton-Raphson. Valid for e > 1.
 */
export function hyperbolicAnomalyFromMean(meanAnomaly: number, eccentricity: number): number {
  const M = meanAnomaly;
  let H = Math.asinh(M / eccentricity);
  for (let i = 0; i < HYPERBOLIC_MAX_ITERATIONS; i++) {
    const delta = (eccentricity * Math.sinh(H) - H - M) /
      (eccentricity * Math.cosh(H) - 1);
    H -= delta;
    if (Math.abs(delta) < HYPERBOLIC_TOLERANCE) break;
  }
  return H;
}

/** True anomaly `nu` from hyperbolic anomaly `H`. */
export function trueAnomalyFromHyperbolic(hyperbolicAnomaly: number, eccentricity: number): number {
  return 2 * Math.atan2(
    Math.sqrt(eccentricity + 1) * Math.tanh(hyperbolicAnomaly / 2),
    Math.sqrt(eccentricity - 1),
  );
}
