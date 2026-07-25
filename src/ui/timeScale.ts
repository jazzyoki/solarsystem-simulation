import type { SpeedMultiplier } from '../sim/clock';

/**
 * Human-readable scale per speed option. Typing this as a full Record over
 * SpeedMultiplier makes a missing or stray entry a compile error, so this
 * table cannot drift from SPEED_MULTIPLIERS.
 */
const SCALE_LABELS: Record<SpeedMultiplier, string> = {
  1200: '1s = 20 min',
  3600: '1s = 1 h',
  21600: '1s = 6 h',
  43200: '1s = 12 h',
  86400: '1s = 24 h',
  2592000: '1s = 1 month',
  7776000: '1s = 3 months',
  31536000: '1s = 1 year',
  94608000: '1s = 3 years',
};

/** Dropdown text for a speed, e.g. '1s = 24 h'. */
export function timeScaleLabel(multiplier: SpeedMultiplier): string {
  return SCALE_LABELS[multiplier];
}

/** Raw speed factor for a speed, e.g. '86,400x' (U+00D7 multiplication sign). */
export function speedMultiplierLabel(multiplier: SpeedMultiplier): string {
  return `${multiplier.toLocaleString('en-US')}×`;
}
