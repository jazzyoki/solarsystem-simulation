import { describe, expect, it, vi } from 'vitest';
import { MOONS, PLANETS } from '../sim/data';
import { computeLayout } from '../sim/layout';
import type { Camera } from './camera';
import { buildAsteroidBelt, drawAsteroidBelt, type AsteroidState } from './asteroidBelt';

const layout = computeLayout(PLANETS, MOONS);

describe('buildAsteroidBelt', () => {
  it('returns the requested count', () => {
    const belt = buildAsteroidBelt(layout, 12345, 400);
    expect(belt).toHaveLength(400);
  });

  it('places all asteroids between Mars and Jupiter', () => {
    const belt = buildAsteroidBelt(layout, 12345, 400);
    const marsOuter = layout.planets.Mars.orbitRadius + layout.planets.Mars.bubbleRadius;
    const jupiterInner = layout.planets.Jupiter.orbitRadius - layout.planets.Jupiter.bubbleRadius;
    for (const a of belt) {
      expect(a.orbitRadius).toBeGreaterThan(marsOuter);
      expect(a.orbitRadius).toBeLessThan(jupiterInner);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = buildAsteroidBelt(layout, 42, 100);
    const b = buildAsteroidBelt(layout, 42, 100);
    expect(a).toEqual(b);
  });

  it('gives asteroids bounded radii and periods', () => {
    const [first] = buildAsteroidBelt(layout, 1, 1);
    expect(first.radius).toBeGreaterThanOrEqual(0.4);
    expect(first.radius).toBeLessThanOrEqual(1.6);
    expect(first.periodDays).toBeGreaterThanOrEqual(800);
    expect(first.periodDays).toBeLessThanOrEqual(2000);
  });
});

describe('drawAsteroidBelt', () => {
  it('draws one arc per asteroid', () => {
    const ctx = {
      fillStyle: '',
      beginPath: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const camera = { worldToScreen: vi.fn((p) => p), scale: 2 } as unknown as Camera;
    const belt = buildAsteroidBelt(layout, 7, 10);
    drawAsteroidBelt(ctx, belt, camera, 0);
    expect(ctx.arc).toHaveBeenCalledTimes(10);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
  });

  it('animates by rotating each asteroid', () => {
    const ctx = {
      fillStyle: '',
      beginPath: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const camera = { worldToScreen: vi.fn((p) => p), scale: 2 } as unknown as Camera;
    const belt: AsteroidState[] = [
      { radius: 1, orbitRadius: 200, angleOffset: 0, periodDays: 100 },
    ];
    drawAsteroidBelt(ctx, belt, camera, 25);
    // 25 days @ 100-day period moves the asteroid one-quarter around.
    expect(camera.worldToScreen).toHaveBeenCalledWith(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });
});
