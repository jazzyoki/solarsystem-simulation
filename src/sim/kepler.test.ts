import { describe, expect, it } from 'vitest';
import {
  eccentricAnomalyFromMean,
  meanAnomalyFromTrue,
  trueAnomalyFromEccentric,
} from './kepler';

describe('eccentricAnomalyFromMean', () => {
  it('returns the mean anomaly when the orbit is circular', () => {
    expect(eccentricAnomalyFromMean(1.2, 0)).toBeCloseTo(1.2, 12);
  });

  it('solves Kepler equation E - e*sin(E) = M', () => {
    const e = 0.2;
    const E = eccentricAnomalyFromMean(1.0, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(1.0, 10);
  });

  it('maps M = pi to E = pi', () => {
    expect(eccentricAnomalyFromMean(Math.PI, 0.3)).toBeCloseTo(Math.PI, 10);
  });

  it('solves Kepler equation at high (cometary) eccentricity', () => {
    for (const e of [0.968, 0.995, 0.9999]) {
      for (const M of [0.1, 1.0, 2.5, 3.5, 5.0]) {
        const E = eccentricAnomalyFromMean(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 9);
      }
    }
  });
});

describe('true/mean anomaly conversions', () => {
  it('round-trips E -> nu -> M for a moderate eccentricity', () => {
    const e = 0.15;
    const E = 0.9;
    const nu = trueAnomalyFromEccentric(E, e);
    const M = meanAnomalyFromTrue(nu, e);
    expect(M).toBeCloseTo(E - e * Math.sin(E), 10);
    expect(eccentricAnomalyFromMean(M, e)).toBeCloseTo(E, 10);
  });

  it('is identity at nu = 0', () => {
    expect(trueAnomalyFromEccentric(0, 0.4)).toBeCloseTo(0, 12);
    expect(meanAnomalyFromTrue(0, 0.4)).toBeCloseTo(0, 12);
  });
});
