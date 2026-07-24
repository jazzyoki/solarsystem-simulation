import { ASTEROID_BELT } from '../sim/data';
import type { Layout } from '../sim/layout';
import { angleAt, orbitalPosition } from '../sim/orbits';
import type { ScaleMode } from '../sim/types';
import type { Camera } from './camera';

export interface AsteroidState {
  radius: number;
  orbitRadius: number;
  angleOffset: number;
  periodDays: number;
}

export function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildAsteroidBelt(
  layout: Layout,
  seed: number,
  count: number,
  mode: ScaleMode = 'schematic',
): AsteroidState[] {
  const rand = mulberry32(seed);
  const { inner, outer } = ASTEROID_BELT.getRadii(layout, mode);
  const { minRadius, maxRadius } = ASTEROID_BELT;
  const asteroids: AsteroidState[] = [];

  for (let i = 0; i < count; i++) {
    const orbitRadius = inner + rand() * (outer - inner);
    const angleOffset = rand() * Math.PI * 2;
    const radius = minRadius + rand() * (maxRadius - minRadius);
    const periodDays = 800 + ((radius - minRadius) / (maxRadius - minRadius)) * 1200;
    asteroids.push({ radius, orbitRadius, angleOffset, periodDays });
  }

  return asteroids;
}

export function drawAsteroidBelt(
  ctx: CanvasRenderingContext2D,
  asteroids: AsteroidState[],
  camera: Camera,
  simDays: number,
): void {
  ctx.fillStyle = ASTEROID_BELT.color;
  ctx.beginPath();
  for (const a of asteroids) {
    const angle = a.angleOffset + angleAt(a.periodDays, simDays);
    const p = orbitalPosition(0, 0, a.orbitRadius, angle);
    const s = camera.worldToScreen(p);
    const r = Math.max(a.radius * camera.scale, 0.5);
    ctx.moveTo(s.x + r, s.y);
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}
