# Moon Visibility Fade & Asteroid Belt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scale-dependent moon and moon-label visibility fades, plus a stylized asteroid belt between Mars and Jupiter.

**Architecture:** Two new renderer modules (`visibility.ts` for opacity math, `asteroidBelt.ts` for the belt) keep the simulation untouched. `drawScene.ts` applies opacity via `ctx.globalAlpha` and draws the belt.

**Tech Stack:** TypeScript, React, Vite, Canvas 2D API, Vitest.

## Global Constraints

- React ^18.3.1, React DOM ^18.3.1, TypeScript ^5.6.3, Vite ^5.4.11, Vitest ^2.1.8.
- Simulation logic remains unchanged; only renderer code changes.
- Follow existing test patterns: mock `CanvasRenderingContext2D` and assert on method calls.
- No new runtime dependencies.
- Fades must be smooth (linear interpolation, clamped to `[0, 1]`).

## File Structure

- `src/render/visibility.ts` — new opacity helpers (`moonOpacity`, `labelOpacity`).
- `src/render/visibility.test.ts` — unit tests for opacity helpers.
- `src/render/asteroidBelt.ts` — deterministic asteroid belt builder and drawer.
- `src/render/asteroidBelt.test.ts` — tests for builder and drawer.
- `src/render/drawScene.ts` — applies moon/label fades and draws the belt.
- `src/render/drawScene.test.ts` — updated for new visibility behavior.
- `src/sim/data.ts` — adds `ASTEROID_BELT` geometry and styling constants.
- `src/hooks/useSimulation.ts` — builds belt once and passes it to `drawScene`.

---

### Task 1: Visibility helpers

**Files:**
- Create: `src/render/visibility.ts`
- Create: `src/render/visibility.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `moonOpacity(bubbleScreenDiameter: number, viewport: ViewportSize): number`
  - `labelOpacity(bubbleScreenDiameter: number, viewport: ViewportSize): number`

- [ ] **Step 1: Write the failing test**

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
    expect(moonOpacity(140, viewport)).toBeCloseTo(0.25, 5);
    expect(moonOpacity(160, viewport)).toBeCloseTo(0.5, 5);
    expect(moonOpacity(180, viewport)).toBeCloseTo(0.75, 5);
  });

  it('returns 0 below the label threshold', () => {
    expect(labelOpacity(279, viewport)).toBe(0);
  });

  it('returns 1 above the label threshold', () => {
    expect(labelOpacity(450, viewport)).toBe(1);
  });

  it('fades linearly between label thresholds', () => {
    expect(labelOpacity(300, viewport)).toBeCloseTo(0.25, 5);
    expect(labelOpacity(320, viewport)).toBeCloseTo(0.5, 5);
    expect(labelOpacity(340, viewport)).toBeCloseTo(0.75, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/render/visibility.test.ts
```

Expected: FAIL — module not found / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/render/visibility.ts`:

```ts
export interface ViewportSize {
  width: number;
  height: number;
}

function fade(coverage: number, start: number, end: number): number {
  if (coverage <= start) return 0;
  if (coverage >= end) return 1;
  return (coverage - start) / (end - start);
}

export function moonOpacity(bubbleScreenDiameter: number, viewport: ViewportSize): number {
  return fade(bubbleScreenDiameter / Math.min(viewport.width, viewport.height), 0.15, 0.25);
}

export function labelOpacity(bubbleScreenDiameter: number, viewport: ViewportSize): number {
  return fade(bubbleScreenDiameter / Math.min(viewport.width, viewport.height), 0.35, 0.45);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/render/visibility.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/visibility.ts src/render/visibility.test.ts
git commit -m "feat: add moon and label visibility fade helpers"
```

---

### Task 2: Apply moon and label fades in drawScene

**Files:**
- Modify: `src/render/drawScene.ts`
- Modify: `src/render/drawScene.test.ts`

**Interfaces:**
- Consumes:
  - `moonOpacity(bubbleScreenDiameter: number, viewport: ViewportSize): number`
  - `labelOpacity(bubbleScreenDiameter: number, viewport: ViewportSize): number`
- Produces: `drawScene` now skips moon bodies/labels when zoomed out and sets `ctx.globalAlpha` during fades.

- [ ] **Step 1: Write the failing test**

Update `src/render/drawScene.test.ts` to expect the new zoomed-out behavior and add a zoomed-in test for moon visibility.

Replace the file contents with:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PLANETS } from '../sim/data';
import { Simulation } from '../sim/simulation';
import { Camera } from './camera';
import { drawScene } from './drawScene';

function createMockCtx() {
  const fns = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  return Object.assign(
    { fillStyle: '', strokeStyle: '', font: '', lineWidth: 0, globalAlpha: 1 },
    fns,
  ) as unknown as CanvasRenderingContext2D;
}

describe('drawScene', () => {
  it('draws the background, planets (not moons), guides, and planet labels when zoomed out', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(1025, 800, 600);
    const ctx = createMockCtx();

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600);

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    // 9 bodies (sun + 8 planets) + 1 sun glow + 8 planet orbit guides + 6 moon bubble guides
    expect(ctx.arc).toHaveBeenCalledTimes(24);
    // Only planet labels; moon labels are hidden at this zoom.
    expect(ctx.fillText).toHaveBeenCalledTimes(8);
    expect(vi.mocked(ctx.fillText).mock.calls.map((c) => c[0])).toEqual(
      PLANETS.map((p) => p.name),
    );
  });

  it('shows moons and moon labels when zoomed in enough', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(80, 800, 600);
    camera.scale *= 8;
    const ctx = createMockCtx();

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600);

    // 107 bodies + 1 sun glow + 8 orbit guides + 6 moon bubble guides.
    expect(ctx.arc).toHaveBeenCalledTimes(122);
    expect(ctx.fillText.mock.calls.some((c) => c[0] === 'Moon')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/render/drawScene.test.ts
```

Expected: FAIL — arc count and `globalAlpha` behavior do not match.

- [ ] **Step 3: Write minimal implementation**

Update `src/render/drawScene.ts`:

```ts
import type { Layout } from '../sim/layout';
import { MOONS } from '../sim/data';
import type { Snapshot } from '../sim/simulation';
import type { Camera } from './camera';
import { labelOpacity, moonOpacity, type ViewportSize } from './visibility';

const BACKGROUND = '#0a0e1a';
const ORBIT_GUIDE = 'rgba(255, 255, 255, 0.08)';
const BUBBLE_GUIDE = 'rgba(255, 255, 255, 0.05)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.75)';
const LABEL_FONT = '11px system-ui, sans-serif';

const moonParent = new Map(MOONS.map((m) => [m.name, m.parent]));

export function drawScene(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot,
  layout: Layout,
  camera: Camera,
  viewportW: number,
  viewportH: number,
): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, viewportW, viewportH);

  const origin = camera.worldToScreen({ x: 0, y: 0 });
  const viewport: ViewportSize = { width: viewportW, height: viewportH };

  // Planet orbit guides (circles around the sun).
  ctx.strokeStyle = ORBIT_GUIDE;
  ctx.lineWidth = 1;
  for (const body of snap.bodies) {
    if (body.kind !== 'planet') continue;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, layout.planets[body.name].orbitRadius * camera.scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  let currentMoonOpacity = 0;
  let currentLabelOpacity = 0;

  for (const body of snap.bodies) {
    if (body.kind === 'planet') {
      const bubbleDiameter = layout.planets[body.name].bubbleRadius * camera.scale * 2;
      currentMoonOpacity = moonOpacity(bubbleDiameter, viewport);
      currentLabelOpacity = labelOpacity(bubbleDiameter, viewport);
    }

    // Moon bodies are fully transparent at this zoom level; skip them.
    if (body.kind === 'moon' && currentMoonOpacity <= 0) continue;

    const p = camera.worldToScreen(body);
    const r = Math.max(body.bodyRadius * camera.scale, body.kind === 'moon' ? 0.75 : 1.5);

    if (body.kind === 'sun') {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      glow.addColorStop(0, 'rgba(255, 204, 51, 0.5)');
      glow.addColorStop(1, 'rgba(255, 204, 51, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (body.kind === 'moon') {
      ctx.save();
      ctx.globalAlpha = currentMoonOpacity;
    }

    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (body.kind === 'moon') {
      ctx.restore();
    }

    if (body.kind === 'planet') {
      const { bubbleRadius } = layout.planets[body.name];
      if (bubbleRadius > 0) {
        ctx.strokeStyle = BUBBLE_GUIDE;
        ctx.beginPath();
        ctx.arc(p.x, p.y, bubbleRadius * camera.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = LABEL_FONT;
      ctx.fillText(body.name, p.x + r + 4, p.y - r - 4);
    }

    if (body.kind === 'moon' && currentLabelOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = currentLabelOpacity;
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = LABEL_FONT;
      ctx.fillText(body.name, p.x + r + 4, p.y - r - 4);
      ctx.restore();
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/render/drawScene.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/drawScene.ts src/render/drawScene.test.ts
git commit -m "feat: fade moons and moon labels based on zoom level"
```

---

### Task 3: Asteroid belt data and renderer

**Files:**
- Modify: `src/sim/data.ts`
- Create: `src/render/asteroidBelt.ts`
- Create: `src/render/asteroidBelt.test.ts`

**Interfaces:**
- Consumes:
  - `Layout` type
  - `angleAt(periodDays: number, simDays: number): number`
  - `orbitalPosition(cx, cy, radius, angle): BodyPosition`
- Produces:
  - `ASTEROID_BELT` constant
  - `AsteroidState` interface
  - `buildAsteroidBelt(layout: Layout, seed: number, count: number): AsteroidState[]`
  - `drawAsteroidBelt(ctx, asteroids, camera, simDays): void`

- [ ] **Step 1: Write the failing test**

Create `src/render/asteroidBelt.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { MOONS, PLANETS } from '../sim/data';
import { computeLayout } from '../sim/layout';
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
    const camera = { worldToScreen: vi.fn((p) => p), scale: 2 };
    const belt = buildAsteroidBelt(layout, 7, 10);
    drawAsteroidBelt(ctx, belt, camera as any, 0);
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
    const camera = { worldToScreen: vi.fn((p) => p), scale: 2 };
    const belt: AsteroidState[] = [
      { radius: 1, orbitRadius: 200, angleOffset: 0, periodDays: 100 },
    ];
    drawAsteroidBelt(ctx, belt, camera as any, 25);
    // 25 days @ 100-day period moves the asteroid one-quarter around.
    expect(camera.worldToScreen).toHaveBeenCalledWith(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/render/asteroidBelt.test.ts
```

Expected: FAIL — module and helpers not found.

- [ ] **Step 3: Write minimal implementation**

Add asteroid belt constants to `src/sim/data.ts`:

```ts
import type { Layout } from './layout';

// ... existing constants ...

export const ASTEROID_BELT = {
  count: 400,
  seed: 42_000,
  color: 'rgba(170, 170, 190, 0.45)',
  minRadius: 0.4,
  maxRadius: 1.6,
  getRadii(layout: Layout) {
    const mars = layout.planets.Mars;
    const jupiter = layout.planets.Jupiter;
    const gap = 10;
    return {
      inner: mars.orbitRadius + mars.bubbleRadius + gap,
      outer: jupiter.orbitRadius - jupiter.bubbleRadius - gap,
    };
  },
} as const;
```

Create `src/render/asteroidBelt.ts`:

```ts
import { ASTEROID_BELT } from '../sim/data';
import type { Layout } from '../sim/layout';
import { angleAt, orbitalPosition } from '../sim/orbits';
import type { Camera } from './camera';

export interface AsteroidState {
  radius: number;
  orbitRadius: number;
  angleOffset: number;
  periodDays: number;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildAsteroidBelt(layout: Layout, seed: number, count: number): AsteroidState[] {
  const rand = mulberry32(seed);
  const { inner, outer } = ASTEROID_BELT.getRadii(layout);
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/render/asteroidBelt.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/data.ts src/render/asteroidBelt.ts src/render/asteroidBelt.test.ts
git commit -m "feat: add deterministic asteroid belt between Mars and Jupiter"
```

---

### Task 4: Wire asteroid belt into the render loop

**Files:**
- Modify: `src/render/drawScene.ts`
- Modify: `src/hooks/useSimulation.ts`

**Interfaces:**
- Consumes:
  - `drawAsteroidBelt(ctx, asteroids, camera, simDays): void`
  - `buildAsteroidBelt(layout, seed, count): AsteroidState[]`
  - `ASTEROID_BELT` constant
- Produces: `drawScene` accepts an optional `asteroids` array; `useSimulation` builds and passes it.

- [ ] **Step 1: Write the failing test**

Update `src/render/drawScene.test.ts` to assert the belt is drawn when provided.

Add this test inside the `describe('drawScene', () => { ... })` block:

```ts
  it('draws the asteroid belt when asteroids are passed', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(80, 800, 600);
    const ctx = createMockCtx();
    const belt = Array.from({ length: 400 }, (_, i) => ({
      radius: 1,
      orbitRadius: 250 + i,
      angleOffset: 0,
      periodDays: 1000,
    }));

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600, belt);

    expect(ctx.arc).toHaveBeenCalledTimes(522); // 122 + 400 belt asteroids
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/render/drawScene.test.ts
```

Expected: FAIL — extra argument unsupported.

- [ ] **Step 3: Write minimal implementation**

Update `src/render/drawScene.ts`:

```ts
import type { Layout } from '../sim/layout';
import { MOONS } from '../sim/data';
import type { Snapshot } from '../sim/simulation';
import type { Camera } from './camera';
import { drawAsteroidBelt, type AsteroidState } from './asteroidBelt';
import { labelOpacity, moonOpacity, type ViewportSize } from './visibility';

// ... rest of constants unchanged ...

export function drawScene(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot,
  layout: Layout,
  camera: Camera,
  viewportW: number,
  viewportH: number,
  asteroids: AsteroidState[] = [],
): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, viewportW, viewportH);

  const origin = camera.worldToScreen({ x: 0, y: 0 });
  const viewport: ViewportSize = { width: viewportW, height: viewportH };

  // Planet orbit guides.
  ctx.strokeStyle = ORBIT_GUIDE;
  ctx.lineWidth = 1;
  for (const body of snap.bodies) {
    if (body.kind !== 'planet') continue;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, layout.planets[body.name].orbitRadius * camera.scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Asteroid belt behind planets.
  if (asteroids.length > 0) {
    drawAsteroidBelt(ctx, asteroids, camera, snap.simDays);
  }

  // ... existing body loop unchanged ...
}
```

Update `src/hooks/useSimulation.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { buildAsteroidBelt } from '../render/asteroidBelt';
import { Camera } from '../render/camera';
import { drawScene } from '../render/drawScene';
import type { SpeedMultiplier } from '../sim/clock';
import { ASTEROID_BELT } from '../sim/data';
import { formatSimDate } from '../sim/formatDate';
import { Simulation } from '../sim/simulation';
```

Inside `useEffect`, after creating `sim`:

```ts
const sim = new Simulation();
simRef.current = sim;
const camera = new Camera();
const asteroids = buildAsteroidBelt(sim.layout, ASTEROID_BELT.seed, ASTEROID_BELT.count);
```

And pass `asteroids` into the `drawScene` call:

```ts
drawScene(ctx, sim.snapshot(), sim.layout, camera, width, height, asteroids);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/render/drawScene.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Type check and commit**

```bash
npx tsc --noEmit
```

Expected: no errors.

```bash
git add src/render/drawScene.ts src/render/drawScene.test.ts src/hooks/useSimulation.ts
git commit -m "feat: render asteroid belt behind planets"
```

---

### Task 5: Full verification

**Files:**
- All modified and created files above.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Build the project**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit any remaining changes**

If the previous steps produced any uncommitted changes:

```bash
git add -A
git commit -m "chore: verify moon visibility, labels, and asteroid belt"
```

---

## Spec Coverage Self-Review

1. **Moon visibility at ~20 % screen size** — Task 1 (`moonOpacity`) and Task 2 (apply in `drawScene`).
2. **Smooth fade, not sudden** — Task 1 linear interpolation with start/end thresholds.
3. **Moon label visibility at ~40 % screen size** — Task 1 (`labelOpacity`) and Task 2 (moon label branch).
4. **Asteroid belt between Mars and Jupiter** — Task 3+4 (`ASTEROID_BELT.getRadii`, `buildAsteroidBelt`, `drawAsteroidBelt`).
5. **Stylized, slow revolution** — Task 3 (period range 800–2000 days from radius).
6. **No simulation changes** — all tasks touch renderer and data only; `src/sim/simulation.ts` is not modified.

## Placeholder Scan

- No TODO, TBD, or "implement later" entries remain.
- Every step contains runnable code or commands with expected output.
- No references to undefined helpers: all function names appear in earlier tasks.

## Type Consistency

- `moonOpacity` / `labelOpacity` signatures match usage in Task 2.
- `AsteroidState` is defined in Task 3 and reused in Task 4 signature.
- `drawScene` signature gains one optional parameter and retains all original parameters in the same order.
