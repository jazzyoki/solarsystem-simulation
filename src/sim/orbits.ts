import type { BodyPosition } from './types';

/**
 * Orbit angle in radians after `simDays` days for a body with the given
 * orbital period. Negative period => retrograde (angle decreases).
 */
export function angleAt(periodDays: number, simDays: number): number {
  return (2 * Math.PI * simDays) / periodDays;
}

/** Position on a circular orbit around (cx, cy). Math convention: y-up. */
export function orbitalPosition(cx: number, cy: number, radius: number, angle: number): BodyPosition {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}
