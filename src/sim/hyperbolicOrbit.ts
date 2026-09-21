const HYPERBOLIC_TOLERANCE = 1e-12;
const HYPERBOLIC_MAX_ITERATIONS = 100;

// Avoid subtracting two nearly equal numbers near the parabolic limit.
function sinhMinusArgument(H: number): number {
  if (H >= 0.5) return Math.sinh(H) - H;
  const squared = H * H;
  let term = H * squared / 6;
  let sum = term;
  for (let order = 5; order <= 17; order += 2) {
    term *= squared / (order * (order - 1));
    sum += term;
  }
  return sum;
}

/**
 * Solve `M = e*sinh(H) - H` for e > 1 with bracketed Newton steps.
 * Solve the positive half only, preserving the equation's odd symmetry.
 */
export function hyperbolicAnomalyFromMean(meanAnomaly: number, eccentricity: number): number {
  if (meanAnomaly === 0) return meanAnomaly;
  const M = Math.abs(meanAnomaly);
  const excess = eccentricity - 1;
  const residual = (H: number) => excess * H + eccentricity * sinhMinusArgument(H) - M;
  let lower = 0;
  let upper = Math.asinh(M / eccentricity) + 1;
  while (residual(upper) < 0) upper *= 2;
  let H = Math.min(upper, M / excess, Math.cbrt(M) * Math.cbrt(6 / eccentricity));

  for (let i = 0; i < HYPERBOLIC_MAX_ITERATIONS; i++) {
    const error = residual(H);
    if (error === 0) break;
    if (error > 0) upper = H;
    else lower = H;
    // cosh(H) - 1 = 2*sinh(H/2)^2 is stable for tiny H.
    const derivative = excess + 2 * eccentricity * Math.sinh(H / 2) ** 2;
    const newton = H - error / derivative;
    const next = Number.isFinite(newton) && newton > lower && newton < upper
      ? newton
      : lower + (upper - lower) / 2;
    if (Math.abs(next - H) <= HYPERBOLIC_TOLERANCE * H) {
      H = next;
      break;
    }
    H = next;
  }
  return Math.sign(meanAnomaly) * H;
}

/** True anomaly `nu` from hyperbolic anomaly `H`. */
export function trueAnomalyFromHyperbolic(hyperbolicAnomaly: number, eccentricity: number): number {
  return 2 * Math.atan2(
    Math.sqrt(eccentricity + 1) * Math.tanh(hyperbolicAnomaly / 2),
    Math.sqrt(eccentricity - 1),
  );
}
