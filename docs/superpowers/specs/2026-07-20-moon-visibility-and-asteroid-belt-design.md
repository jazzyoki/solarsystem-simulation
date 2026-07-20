# Moon Visibility Fade & Asteroid Belt Design

**Goal:** Add scale-dependent moon and moon-label visibility with smooth fades, and a stylized asteroid belt between Mars and Jupiter.

**Architecture:** Keep the existing `Simulation` pure (positions only). Add two new renderer modules: `visibility.ts` for opacity math and `asteroidBelt.ts` for belt rendering. `drawScene.ts` orchestrates drawing and applies opacity via `ctx.globalAlpha`. A new `ASTEROID_BELT` constant in `src/sim/data.ts` defines belt geometry.

**Tech Stack:** TypeScript, React, Vite, Canvas 2D, Vitest.

## Global Constraints

- React ^18.3.1, TypeScript ^5.6.3, Vite ^5.4.11, Vitest ^2.1.8.
- Simulation logic remains unchanged; only renderer code changes.
- Follow existing test patterns: mock `CanvasRenderingContext2D` and assert on method calls.
- No new dependencies.
- Fades must be smooth (not sudden on/off).

## Feature 1: Scale-Based Moon and Moon-Label Visibility

### Description

Moons and their labels should only appear once the host planet's "bubble" is large enough on screen. The transition must fade via transparency.

- Moon bodies fade from fully transparent (invisible) to fully opaque as the planet bubble diameter grows from **15%** to **25%** of the smaller viewport dimension.
- Moon labels fade from fully transparent to fully opaque as the planet bubble diameter grows from **35%** to **45%** of the smaller viewport dimension.
- When a planet has no moons, opacity stays 0. Planets with moons always track their current opacity values.

### Implementation

Create `src/render/visibility.ts`:

```ts
export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Returns the moon-body opacity for a planet bubble rendered at the given
 * screen diameter (px). Fades in between 15 % and 25 % of min(width, height).
 */
export function moonOpacity(
  bubbleScreenDiameter: number,
  viewport: ViewportSize,
): number;

/**
 * Returns the moon-label opacity for a planet bubble rendered at the given
 * screen diameter (px). Fades in between 35 % and 45 % of min(width, height).
 */
export function labelOpacity(
  bubbleScreenDiameter: number,
  viewport: ViewportSize,
): number;
```

Both helpers clamp the result to `[0, 1]` and use linear interpolation.

Modify `src/render/drawScene.ts`:

- During the body-drawing loop, when a planet is encountered, pre-compute its `bubbleScreenDiameter = layout.planets[name].bubbleRadius * camera.scale * 2`.
- Store the current planet's `currentMoonOpacity` and `currentLabelOpacity` for use on the subsequent moon bodies.
- When drawing a moon:
  - Set `ctx.globalAlpha = currentMoonOpacity`.
  - Draw the moon body.
  - Reset `ctx.globalAlpha = 1`.
- When drawing a moon label:
  - Skip if `currentLabelOpacity <= 0`.
  - Set `ctx.globalAlpha = currentLabelOpacity`.
  - Draw the label.
  - Reset `ctx.globalAlpha = 1`.

Planet labels remain always visible; only moon labels are controlled by the fade.

### Testing

Create `src/render/visibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { labelOpacity, moonOpacity } from './visibility';

describe('visibility', () => {
  const viewport = { width: 1000, height: 800 };

  it('returns 0 below the moon threshold', () => {
    expect(moonOpacity(119, viewport)).toBe(0);
  });

  it('returns 1 above the moon threshold', () => {
    expect(moonOpacity(250, viewport)).toBe(1);
  });

  it('fades linearly between moon thresholds', () => {
    expect(moonOpacity(160, viewport)).toBeCloseTo(0.25, 5);
    expect(moonOpacity(200, viewport)).toBeCloseTo(0.5, 5);
  });

  it('returns 0 below the label threshold', () => {
    expect(labelOpacity(279, viewport)).toBe(0);
  });

  it('returns 1 above the label threshold', () => {
    expect(labelOpacity(450, viewport)).toBe(1);
  });

  it('fades linearly between label thresholds', () => {
    expect(labelOpacity(360, viewport)).toBeCloseTo(0.25, 5);
    expect(labelOpacity(400, viewport)).toBeCloseTo(0.5, 5);
  });
});
```

Update `src/render/drawScene.test.ts` to assert that `ctx.globalAlpha` is set while drawing moons and reset afterward.

## Feature 2: Asteroid Belt

### Description

Place a stylized asteroid belt in the gap between Mars and Jupiter. It should consist of many small dots and circles slowly orbiting the sun. Timing does not need to be scientifically accurate.

### Implementation

Add to `src/sim/data.ts`:

```ts
export const ASTEROID_BELT = {
  /** Number of rendered dots. */
  count: 400,
  /**
   * World-radius range for the belt, computed from the current layout so it
   * sits cleanly between Mars's outer bubble and Jupiter's inner bubble.
   * These values are derived from `computeLayout(PLANETS, MOONS)` at runtime.
   */
  getRadii: (layout: Layout) => {
    const mars = layout.planets.Mars;
    const jupiter = layout.planets.Jupiter;
    const gap = 10;
    return {
      inner: mars.orbitRadius + mars.bubbleRadius + gap,
      outer: jupiter.orbitRadius - jupiter.bubbleRadius - gap,
    };
  },
  color: 'rgba(170, 170, 190, 0.45)',
  /** Dot radius range in world units. */
  minRadius: 0.4,
  maxRadius: 1.6,
} as const;
```

Create `src/render/asteroidBelt.ts`:

```ts
export interface AsteroidState {
  radius: number;
  orbitRadius: number;
  angleOffset: number;
  periodDays: number;
}

/**
 * Builds a deterministic list of asteroid states from a seed and belt geometry.
 */
export function buildAsteroidBelt(
  layout: Layout,
  seed: number,
  count: number,
): AsteroidState[];

/**
 * Draws all asteroids for the current simulation time.
 */
export function drawAsteroidBelt(
  ctx: CanvasRenderingContext2D,
  asteroids: AsteroidState[],
  camera: Camera,
  simDays: number,
): void;
```

Use a small deterministic PRNG (`mulberry32` or similar) seeded once per belt so the same asteroid pattern appears every run. Each asteroid:

- Picks an orbit radius uniformly between inner and outer bounds.
- Picks an angular offset in radians.
- Picks a visual radius between `minRadius` and `maxRadius`.
- Derives a rotation period from the radius (e.g., `periodDays = 800 + (radius - inner) / (outer - inner) * 1200`).

In `drawScene.ts`:

- Build the asteroid list once (e.g., in module scope or inside `drawScene` the first time it is called) using `buildAsteroidBelt`.
- Draw the belt before bodies so planets render on top.
- Each frame, compute current angle = `angleOffset + angleAt(periodDays, simDays)` and render with `camera.worldToScreen`.

### Testing

Create `src/render/asteroidBelt.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { MOONS, PLANETS } from '../sim/data';
import { computeLayout } from '../sim/layout';
import { buildAsteroidBelt, drawAsteroidBelt } from './asteroidBelt';

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
});

describe('drawAsteroidBelt', () => {
  it('draws one arc per asteroid', () => {
    const ctx = {
      fillStyle: '',
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const camera = { worldToScreen: vi.fn((p) => p), scale: 2 } as any;
    const belt = buildAsteroidBelt(layout, 7, 10);
    drawAsteroidBelt(ctx, belt, camera, 0);
    expect(ctx.arc).toHaveBeenCalledTimes(10);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
  });
});
```

## Integration

Update `src/render/drawScene.ts` signature to accept simulation days and a cached asteroid list:

```ts
export function drawScene(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot,
  layout: Layout,
  camera: Camera,
  viewportW: number,
  viewportH: number,
  asteroids: AsteroidState[],
): void;
```

Update `src/hooks/useSimulation.ts` to build the asteroid belt once when `Simulation` is created and pass it to `drawScene`.

## Spec Self-Review

1. **Spec coverage:**
   - Moon fade thresholds — covered in Feature 1.
   - Moon label fade thresholds — covered in Feature 1.
   - Asteroid belt between Mars and Jupiter — covered in Feature 2.
   - Smooth fading (no sudden transitions) — covered by linear interpolation.
   - No need to match real orbital timings — explicitly stated in Feature 2.
2. **Placeholder scan:** No TBD, TODO, or vague requirements remain.
3. **Type consistency:** New `drawScene` signature and helpers are fully typed.
4. **Scope:** This is a single, focused spec covering only the two requested visual features.
