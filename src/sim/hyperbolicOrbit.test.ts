import { describe, expect, it } from 'vitest';
import { hyperbolicAnomalyFromMean, trueAnomalyFromHyperbolic } from './hyperbolicOrbit';

describe('hyperbolicAnomalyFromMean', () => {
  it('solves M = e*sinh(H) - H for interstellar eccentricities', () => {
    for (const e of [1.2, 3.36, 6.14]) {
      for (const H of [-1.5, -0.4, 0.4, 1.5, 3.0]) {
        const M = e * Math.sinh(H) - H;
        expect(hyperbolicAnomalyFromMean(M, e)).toBeCloseTo(H, 9);
      }
    }
  });

  it('converges near the parabolic limit with signed symmetry', () => {
    for (const e of [1.0000051, 1 + Number.EPSILON]) {
      for (const expected of [1e-10, 0.001, 0.1, 1, 10]) {
        // Series avoids cancellation in the independent small-H fixture.
        const h2 = expected * expected;
        const M = expected < 0.01
          ? (e - 1) * expected + e * expected * h2 * (1 / 6 + h2 / 120 + h2 * h2 / 5040)
          : e * Math.sinh(expected) - expected;
        const actual = hyperbolicAnomalyFromMean(M, e);
        expect(actual / expected).toBeCloseTo(1, 9);
        expect(hyperbolicAnomalyFromMean(-M, e)).toBe(-actual);
      }
    }
  });

  it('returns 0 at perihelion (M = 0)', () => {
    expect(hyperbolicAnomalyFromMean(0, 3.36)).toBeCloseTo(0, 12);
  });
});

describe('trueAnomalyFromHyperbolic', () => {
  it('is 0 at perihelion', () => {
    expect(trueAnomalyFromHyperbolic(0, 3.36)).toBeCloseTo(0, 12);
  });

  it('stays within the asymptote limit acos(-1/e)', () => {
    const e = 1.2;
    const nuInf = Math.acos(-1 / e);
    expect(trueAnomalyFromHyperbolic(20, e)).toBeLessThan(nuInf);
    expect(trueAnomalyFromHyperbolic(20, e)).toBeGreaterThan(nuInf - 0.05);
  });
});
