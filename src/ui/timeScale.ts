import type { SpeedMultiplier } from '../sim/clock';

/**
 * Human-readable time scale for a speed multiplier. The clock advances
 * 1 sim day per real second at 1x (SimClock.advance), so the multiplier IS
 * the number of sim days per real second.
 */
export function timeScaleLabel(multiplier: SpeedMultiplier): string {
  if (multiplier === 0.5) return '1s = ½ day';
  if (multiplier === 1) return '1s = 1 day';
  return `1s = ${multiplier} days`;
}
