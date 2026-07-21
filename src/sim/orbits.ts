import type { BodyPosition } from './types';

/**
 * Orbit angle in radians after `simDays`, offset by the body's angle at the
 * simulation epoch. Negative period => retrograde elapsed motion.
 */
export function angleAt(
  periodDays: number,
  simDays: number,
  epochAngleRad = 0,
): number {
  return epochAngleRad + (2 * Math.PI * simDays) / periodDays;
}

/** Position on a circular orbit around (cx, cy). Math convention: y-up. */
export function orbitalPosition(cx: number, cy: number, radius: number, angle: number): BodyPosition {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}
