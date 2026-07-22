const KEPLER_TOLERANCE = 1e-12;
const KEPLER_MAX_ITERATIONS = 100;
const TWO_PI = Math.PI * 2;

/**
 * Solve Kepler's equation `M = E - e*sin(E)` for the eccentric anomaly `E`.
 * Newton-Raphson is safeguarded with bisection so it converges for every
 * eccentricity below 1, including the near-1 values of comets, where the
 * derivative near perihelion is tiny and unguarded Newton would diverge.
 */
export function eccentricAnomalyFromMean(meanAnomalyRad: number, eccentricity: number): number {
  if (eccentricity === 0) return meanAnomalyRad;

  // Reduce M to [0, 2*pi) so the root is bracketed by [0, 2*pi]; re-add the
  // whole turns afterwards so `E - e*sin(E) = M` holds for the original M.
  const turns = Math.floor(meanAnomalyRad / TWO_PI);
  const M = meanAnomalyRad - turns * TWO_PI;

  // f(E) = E - e*sin(E) - M is strictly increasing (f' = 1 - e*cos(E) > 0),
  // so exactly one root lies in [lo, hi].
  let lo = 0;
  let hi = TWO_PI;
  let E = M;
  for (let i = 0; i < KEPLER_MAX_ITERATIONS; i++) {
    const f = E - eccentricity * Math.sin(E) - M;
    if (f > 0) hi = E;
    else lo = E;
    const fp = 1 - eccentricity * Math.cos(E);
    let next = E - f / fp;
    // If Newton steps outside the bracket (or the derivative is tiny), take a
    // bisection step instead — bisection on a bracketed monotone root cannot
    // diverge.
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    if (Math.abs(next - E) < KEPLER_TOLERANCE) {
      E = next;
      break;
    }
    E = next;
  }
  return E + turns * TWO_PI;
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
