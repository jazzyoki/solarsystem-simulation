# Schematic / To-Scale Mode Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a UI switcher between "Schematic" (current circular layout) and "To Scale" mode, where planets follow real elliptical orbits with true semi-major-axis spacing and Keplerian variable angular velocity.

**Architecture:** Keep the existing circular schematic path untouched as the default. Add pure orbital-mechanics helpers (Kepler solver + elliptical position/geometry) that derive each planet's mean anomaly from its already-stored 2026 epoch longitude, so both modes agree on longitude at `simDays = 0`. Make `Simulation.snapshot()`, a new `orbitPaths()`, and a new `extent()` take a `ScaleMode` argument. `drawScene` renders either circle guides or rotated ellipse guides from the returned paths. The React layer holds the mode in state, re-fits the camera and rebuilds the asteroid belt on switch.

**Tech Stack:** TypeScript 5.6, React 18, Vite 5, Vitest 2. Static J2000 Keplerian elements (Standish / JPL "Keplerian Elements for Approximate Positions of the Major Planets").

## Global Constraints

These are the design decisions this feature was scoped around (captured directly from the requester; no separate spec file was authored). Every task inherits them:

- **Distances:** true linear scale — orbit radius ∝ real semi-major axis in AU. Inner planets legitimately cluster near the Sun; the user zooms/pans to inspect them.
- **Angular velocity:** Keplerian (variable) — solve Kepler's equation so planets move faster near perihelion. Do NOT use constant mean angular speed on the ellipse.
- **Eccentricity:** real J2000 eccentricities (low-e orbits will look nearly circular; that is correct).
- **Body sizes:** stay schematic in both modes — do NOT scale `bodyRadius`. Only distances and orbit shapes change.
- Default mode on load is **Schematic**; the schematic mode's behavior, math, layout, and initial view must be byte-for-byte unchanged.
- Moons keep their schematic ring/bubble geometry in both modes, anchored to the parent planet's (mode-dependent) position. Do not compute real moon orbital elements.
- Keep `src/sim/` pure: no DOM, React, Canvas API, or network access. Keplerian math lives in `src/sim/`.
- Add no runtime dependencies.
- `AU_TO_WORLD = 150` world units per AU (tunable constant; chosen so Mercury's perihelion clears the schematic Sun disc).
- Use `toBeCloseTo` for floating-point assertions. Follow existing test style (mock `CanvasRenderingContext2D` for render tests).
- Follow strict red-green TDD: run each new test and observe the expected failure before writing production code. Commit each task independently.

---

## File Structure

**Created:**
- `src/sim/kepler.ts` — pure Kepler-equation solver and anomaly conversions.
- `src/sim/kepler.test.ts` — tests for the solver/conversions.
- `src/sim/ellipticalOrbit.ts` — epoch→mean-anomaly, elliptical position (AU), and ellipse geometry (world units).
- `src/sim/ellipticalOrbit.test.ts` — tests for the elliptical helpers.

**Modified:**
- `src/sim/types.ts` — add `ScaleMode` and orbital-element fields to `PlanetSpec`.
- `src/sim/data.ts` — add `AU_TO_WORLD`, per-planet orbital elements, and mode-aware asteroid-belt radii.
- `src/sim/data.test.ts` — lock down elements, scale constant, and to-scale belt radii.
- `src/render/asteroidBelt.ts` — thread `ScaleMode` through belt construction.
- `src/sim/simulation.ts` — mode-aware `snapshot`, new `orbitPaths`, new `extent`; export `OrbitPath`.
- `src/sim/simulation.test.ts` — to-scale position/ordering/path/extent tests.
- `src/render/drawScene.ts` — draw circle or ellipse orbit guides from `OrbitPath[]`.
- `src/render/drawScene.test.ts` — add `ellipse` to the mock; pass `orbitPaths`; add a to-scale test.
- `src/ui/Toolbar.tsx` — add the mode switcher buttons.
- `src/ui/Toolbar.test.tsx` — update prop defaults; test the switcher.
- `src/hooks/useSimulation.ts` — hold mode, re-fit camera + rebuild belt on switch, pass mode to draw.
- `src/App.tsx` — wire `mode`/`setMode` into `Toolbar`.
- `src/styles.css` — style the switcher separator.

**Consuming-order note:** Tasks are ordered so each task only depends on earlier ones. Task 4 (simulation) depends on Tasks 1–3. Task 5 (render) depends on Task 4. Task 6 (UI) depends on Tasks 4–5.

---

### Task 1: Orbital-element data, scale constant, and `ScaleMode` type

**Files:**
- Modify: `src/sim/types.ts:1-26`
- Modify: `src/sim/data.ts:1-24` (add constants), planet table, and `ASTEROID_BELT.getRadii`
- Modify: `src/render/asteroidBelt.ts:22-26`
- Test: `src/sim/data.test.ts:1-103`

**Interfaces:**
- Consumes: existing `PlanetSpec` table with `periodDays` and `epochAngleRad`.
- Produces:
  - `export type ScaleMode = 'schematic' | 'toScale'`
  - `PlanetSpec.semiMajorAxisAu: number`, `PlanetSpec.eccentricity: number`, `PlanetSpec.perihelionLongitudeRad: number`
  - `export const AU_TO_WORLD: number` (= 150)
  - `ASTEROID_BELT.getRadii(layout: Layout, mode?: ScaleMode): { inner: number; outer: number }`
  - `buildAsteroidBelt(layout, seed, count, mode?: ScaleMode): AsteroidState[]`

- [ ] **Step 1: Write failing tests for elements, scale, and to-scale belt radii**

In `src/sim/data.test.ts`, change the import line to include `AU_TO_WORLD`:

```ts
import { ASTEROID_BELT, AU_TO_WORLD, MOONS, PLANETS } from './data';
```

Add these constants after `EXPECTED_PLANET_EPOCH_ANGLES_DEG` (keep the existing `DEG_TO_RAD`):

```ts
const EXPECTED_SEMI_MAJOR_AXIS_AU: Record<string, number> = {
  Mercury: 0.38709927,
  Venus: 0.72333566,
  Earth: 1.00000261,
  Mars: 1.52371034,
  Jupiter: 5.202887,
  Saturn: 9.53667594,
  Uranus: 19.18916464,
  Neptune: 30.06992276,
};

const EXPECTED_ECCENTRICITY: Record<string, number> = {
  Mercury: 0.20563593,
  Venus: 0.00677672,
  Earth: 0.01671123,
  Mars: 0.0933941,
  Jupiter: 0.04838624,
  Saturn: 0.05386179,
  Uranus: 0.04725744,
  Neptune: 0.00859048,
};

const EXPECTED_PERIHELION_LONGITUDE_DEG: Record<string, number> = {
  Mercury: 77.45779628,
  Venus: 131.60246718,
  Earth: 102.93768193,
  Mars: 336.05637041,
  Jupiter: 14.72847983,
  Saturn: 92.59887831,
  Uranus: 170.9542763,
  Neptune: 44.96476227,
};
```

Add these tests inside `describe('data tables', ...)`:

```ts
it('stores real orbital elements for every planet', () => {
  for (const p of PLANETS) {
    expect(p.semiMajorAxisAu, p.name).toBeCloseTo(EXPECTED_SEMI_MAJOR_AXIS_AU[p.name], 8);
    expect(p.eccentricity, p.name).toBeCloseTo(EXPECTED_ECCENTRICITY[p.name], 8);
    expect(p.perihelionLongitudeRad, p.name).toBeCloseTo(
      EXPECTED_PERIHELION_LONGITUDE_DEG[p.name] * DEG_TO_RAD,
      10,
    );
  }
});

it('exposes a positive AU-to-world scale', () => {
  expect(AU_TO_WORLD).toBeGreaterThan(0);
});

it('places the to-scale asteroid belt between the real Mars and Jupiter orbits', () => {
  const layout = computeLayout(PLANETS, MOONS);
  const { inner, outer } = ASTEROID_BELT.getRadii(layout, 'toScale');
  const mars = PLANETS.find((p) => p.name === 'Mars')!;
  const jupiter = PLANETS.find((p) => p.name === 'Jupiter')!;
  expect(inner).toBeGreaterThan(mars.semiMajorAxisAu * (1 + mars.eccentricity) * AU_TO_WORLD);
  expect(outer).toBeLessThan(jupiter.semiMajorAxisAu * (1 - jupiter.eccentricity) * AU_TO_WORLD);
  expect(outer).toBeGreaterThan(inner);
});
```

- [ ] **Step 2: Run the data tests and verify the new assertions fail**

Run:

```bash
npm test -- src/sim/data.test.ts
```

Expected: FAIL — `AU_TO_WORLD` is not exported, planet element fields are `undefined`, and `getRadii` ignores the `'toScale'` argument.

- [ ] **Step 3: Add `ScaleMode` and element fields to the types**

In `src/sim/types.ts`, add the `ScaleMode` type at the top and extend `PlanetSpec` (leave `MoonSpec` and `BodyPosition` unchanged):

```ts
export type ScaleMode = 'schematic' | 'toScale';

export interface PlanetSpec {
  name: string;
  /** Sidereal orbital period in days. */
  periodDays: number;
  /** J2000 ecliptic longitude in radians at 2026-01-01 00:00 UTC. */
  epochAngleRad: number;
  /** J2000 semi-major axis in astronomical units (to-scale mode). */
  semiMajorAxisAu: number;
  /** J2000 orbital eccentricity. */
  eccentricity: number;
  /** J2000 longitude of perihelion (Omega + omega) in radians. */
  perihelionLongitudeRad: number;
  /** Display radius in world units (px at zoom 1). */
  bodyRadius: number;
  color: string;
}
```

- [ ] **Step 4: Add the scale constant, elements, and mode-aware belt radii**

In `src/sim/data.ts`, add the `ScaleMode` import and the constant. Change the import line and the `DEG_TO_RAD` block to:

```ts
import type { Layout } from './layout';
import type { MoonSpec, PlanetSpec, ScaleMode } from './types';

const DEG_TO_RAD = Math.PI / 180;

/** World units per astronomical unit in to-scale mode. */
export const AU_TO_WORLD = 150;
```

Replace the whole `ASTEROID_BELT` `getRadii` method so it branches on mode (keep the other belt fields unchanged):

```ts
  getRadii(layout: Layout, mode: ScaleMode = 'schematic') {
    const gap = 10;
    if (mode === 'toScale') {
      const mars = PLANETS.find((p) => p.name === 'Mars')!;
      const jupiter = PLANETS.find((p) => p.name === 'Jupiter')!;
      return {
        inner: mars.semiMajorAxisAu * (1 + mars.eccentricity) * AU_TO_WORLD + gap,
        outer: jupiter.semiMajorAxisAu * (1 - jupiter.eccentricity) * AU_TO_WORLD - gap,
      };
    }
    const mars = layout.planets.Mars;
    const jupiter = layout.planets.Jupiter;
    return {
      inner: mars.orbitRadius + mars.bubbleRadius + gap,
      outer: jupiter.orbitRadius - jupiter.bubbleRadius - gap,
    };
  },
```

Replace the `PLANETS` array with the element-augmented version:

```ts
export const PLANETS: PlanetSpec[] = [
  {
    name: 'Mercury',
    periodDays: 87.9691,
    epochAngleRad: 242.262456669 * DEG_TO_RAD,
    semiMajorAxisAu: 0.38709927,
    eccentricity: 0.20563593,
    perihelionLongitudeRad: 77.45779628 * DEG_TO_RAD,
    bodyRadius: 4,
    color: '#9c8e82',
  },
  {
    name: 'Venus',
    periodDays: 224.701,
    epochAngleRad: 277.021284224 * DEG_TO_RAD,
    semiMajorAxisAu: 0.72333566,
    eccentricity: 0.00677672,
    perihelionLongitudeRad: 131.60246718 * DEG_TO_RAD,
    bodyRadius: 6,
    color: '#e3bb76',
  },
  {
    name: 'Earth',
    periodDays: 365.256,
    epochAngleRad: 100.209656729 * DEG_TO_RAD,
    semiMajorAxisAu: 1.00000261,
    eccentricity: 0.01671123,
    perihelionLongitudeRad: 102.93768193 * DEG_TO_RAD,
    bodyRadius: 6,
    color: '#4d9de0',
  },
  {
    name: 'Mars',
    periodDays: 686.98,
    epochAngleRad: 283.796552295 * DEG_TO_RAD,
    semiMajorAxisAu: 1.52371034,
    eccentricity: 0.0933941,
    perihelionLongitudeRad: 336.05637041 * DEG_TO_RAD,
    bodyRadius: 5,
    color: '#c1440e',
  },
  {
    name: 'Jupiter',
    periodDays: 4332.589,
    epochAngleRad: 108.967359114 * DEG_TO_RAD,
    semiMajorAxisAu: 5.202887,
    eccentricity: 0.04838624,
    perihelionLongitudeRad: 14.72847983 * DEG_TO_RAD,
    bodyRadius: 14,
    color: '#d8a25e',
  },
  {
    name: 'Saturn',
    periodDays: 10759.22,
    epochAngleRad: 1.552905047 * DEG_TO_RAD,
    semiMajorAxisAu: 9.53667594,
    eccentricity: 0.05386179,
    perihelionLongitudeRad: 92.59887831 * DEG_TO_RAD,
    bodyRadius: 12,
    color: '#e0c38b',
  },
  {
    name: 'Uranus',
    periodDays: 30688.5,
    epochAngleRad: 59.539656457 * DEG_TO_RAD,
    semiMajorAxisAu: 19.18916464,
    eccentricity: 0.04725744,
    perihelionLongitudeRad: 170.9542763 * DEG_TO_RAD,
    bodyRadius: 9,
    color: '#7dd3d8',
  },
  {
    name: 'Neptune',
    periodDays: 60182,
    epochAngleRad: 0.995246704 * DEG_TO_RAD,
    semiMajorAxisAu: 30.06992276,
    eccentricity: 0.00859048,
    perihelionLongitudeRad: 44.96476227 * DEG_TO_RAD,
    bodyRadius: 9,
    color: '#5b7fd4',
  },
];
```

- [ ] **Step 5: Thread `ScaleMode` through `buildAsteroidBelt`**

In `src/render/asteroidBelt.ts`, add `ScaleMode` to the imports and pass mode into `getRadii`:

```ts
import { ASTEROID_BELT } from '../sim/data';
import type { Layout } from '../sim/layout';
import { angleAt, orbitalPosition } from '../sim/orbits';
import type { ScaleMode } from '../sim/types';
import type { Camera } from './camera';
```

Change the `buildAsteroidBelt` signature and its `getRadii` call:

```ts
export function buildAsteroidBelt(
  layout: Layout,
  seed: number,
  count: number,
  mode: ScaleMode = 'schematic',
): AsteroidState[] {
  const rand = mulberry32(seed);
  const { inner, outer } = ASTEROID_BELT.getRadii(layout, mode);
  const { minRadius, maxRadius } = ASTEROID_BELT;
```

Leave the rest of `buildAsteroidBelt` and `drawAsteroidBelt` unchanged.

- [ ] **Step 6: Run the affected suites**

Run:

```bash
npm test -- src/sim/data.test.ts src/render/asteroidBelt.test.ts
```

Expected: PASS. The existing asteroid-belt tests still pass because `mode` defaults to `'schematic'`.

- [ ] **Step 7: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/sim/types.ts src/sim/data.ts src/sim/data.test.ts src/render/asteroidBelt.ts
git commit -m "feat: add orbital elements and AU scale for to-scale mode"
```

---

### Task 2: Kepler equation solver and anomaly conversions

**Files:**
- Create: `src/sim/kepler.ts`
- Test: `src/sim/kepler.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure math).
- Produces:
  - `eccentricAnomalyFromMean(meanAnomalyRad: number, eccentricity: number): number`
  - `trueAnomalyFromEccentric(eccentricAnomalyRad: number, eccentricity: number): number`
  - `meanAnomalyFromTrue(trueAnomalyRad: number, eccentricity: number): number`

- [ ] **Step 1: Write the failing test file**

Create `src/sim/kepler.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/sim/kepler.test.ts
```

Expected: FAIL — `./kepler` does not exist.

- [ ] **Step 3: Implement the solver**

Create `src/sim/kepler.ts`:

```ts
const KEPLER_TOLERANCE = 1e-12;
const KEPLER_MAX_ITERATIONS = 50;

/**
 * Solve Kepler's equation `M = E - e*sin(E)` for the eccentric anomaly `E`
 * using Newton-Raphson. Valid for the planetary eccentricities used here
 * (all well below 0.8).
 */
export function eccentricAnomalyFromMean(meanAnomalyRad: number, eccentricity: number): number {
  let E = meanAnomalyRad;
  for (let i = 0; i < KEPLER_MAX_ITERATIONS; i++) {
    const delta = (E - eccentricity * Math.sin(E) - meanAnomalyRad) /
      (1 - eccentricity * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < KEPLER_TOLERANCE) break;
  }
  return E;
}

/** True anomaly `nu` from eccentric anomaly `E`. */
export function trueAnomalyFromEccentric(eccentricAnomalyRad: number, eccentricity: number): number {
  return Math.atan2(
    Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomalyRad),
    Math.cos(eccentricAnomalyRad) - eccentricity,
  );
}

/** Mean anomaly `M` from true anomaly `nu` (inverse path via eccentric anomaly). */
export function meanAnomalyFromTrue(trueAnomalyRad: number, eccentricity: number): number {
  const E = Math.atan2(
    Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(trueAnomalyRad),
    Math.cos(trueAnomalyRad) + eccentricity,
  );
  return E - eccentricity * Math.sin(E);
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
npm test -- src/sim/kepler.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/kepler.ts src/sim/kepler.test.ts
git commit -m "feat: add Kepler equation solver and anomaly conversions"
```

---

### Task 3: Elliptical position and ellipse geometry helpers

**Files:**
- Create: `src/sim/ellipticalOrbit.ts`
- Test: `src/sim/ellipticalOrbit.test.ts`

**Interfaces:**
- Consumes: `kepler.ts` from Task 2; `BodyPosition` from `types.ts`.
- Produces:
  - `interface OrbitalElements { semiMajorAxisAu; eccentricity; perihelionLongitudeRad; periodDays; epochLongitudeRad }`
  - `interface EllipseGeometry { centerX; centerY; semiMajorAxis; semiMinorAxis; rotationRad }`
  - `epochMeanAnomaly(el: OrbitalElements): number`
  - `ellipticalPositionAu(el: OrbitalElements, simDays: number): BodyPosition`
  - `ellipseGeometry(el: OrbitalElements, auToWorld: number): EllipseGeometry`

- [ ] **Step 1: Write the failing test file**

Create `src/sim/ellipticalOrbit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ellipseGeometry,
  ellipticalPositionAu,
  epochMeanAnomaly,
  type OrbitalElements,
} from './ellipticalOrbit';

function elements(overrides: Partial<OrbitalElements> = {}): OrbitalElements {
  return {
    semiMajorAxisAu: 1,
    eccentricity: 0,
    perihelionLongitudeRad: 0,
    periodDays: 100,
    epochLongitudeRad: 0,
    ...overrides,
  };
}

function longitude(p: { x: number; y: number }): number {
  const a = Math.atan2(p.y, p.x);
  return a < 0 ? a + 2 * Math.PI : a;
}

describe('epochMeanAnomaly', () => {
  it('equals epoch longitude minus perihelion for a circular orbit', () => {
    const m = epochMeanAnomaly(
      elements({ epochLongitudeRad: 1.0, perihelionLongitudeRad: 0.3 }),
    );
    expect(m).toBeCloseTo(0.7, 10);
  });
});

describe('ellipticalPositionAu', () => {
  it('starts at the epoch longitude at day 0', () => {
    const el = elements({ eccentricity: 0.2, perihelionLongitudeRad: 0.5, epochLongitudeRad: 2.0 });
    expect(longitude(ellipticalPositionAu(el, 0))).toBeCloseTo(2.0, 9);
  });

  it('keeps a circular orbit at radius equal to the semi-major axis', () => {
    const el = elements({ semiMajorAxisAu: 3, eccentricity: 0 });
    const p = ellipticalPositionAu(el, 37);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(3, 10);
  });

  it('places the planet between perihelion and aphelion radii', () => {
    const el = elements({ semiMajorAxisAu: 2, eccentricity: 0.3 });
    for (const t of [10, 20, 33, 60, 90]) {
      const p = ellipticalPositionAu(el, t);
      const r = Math.hypot(p.x, p.y);
      expect(r).toBeGreaterThanOrEqual(2 * (1 - 0.3) - 1e-9);
      expect(r).toBeLessThanOrEqual(2 * (1 + 0.3) + 1e-9);
    }
  });

  it('sweeps faster near perihelion than near aphelion (Kepler second law)', () => {
    // Epoch longitude == perihelion longitude => starts exactly at perihelion.
    const el = elements({ eccentricity: 0.5, perihelionLongitudeRad: 0, epochLongitudeRad: 0 });
    const nearPeri = Math.abs(
      longitude(ellipticalPositionAu(el, 1)) - longitude(ellipticalPositionAu(el, 0)),
    );
    const nearApo = Math.abs(
      longitude(ellipticalPositionAu(el, 51)) - longitude(ellipticalPositionAu(el, 50)),
    );
    expect(nearPeri).toBeGreaterThan(nearApo);
  });

  it('reverses direction for a negative (retrograde) period', () => {
    const el = elements({ periodDays: -100 });
    // Moving clockwise from longitude 0 lands just below 2*pi.
    expect(longitude(ellipticalPositionAu(el, 1))).toBeGreaterThan(Math.PI);
  });
});

describe('ellipseGeometry', () => {
  it('is a circle centered on the focus for zero eccentricity', () => {
    const g = ellipseGeometry(elements({ semiMajorAxisAu: 2, eccentricity: 0 }), 10);
    expect(g.centerX).toBeCloseTo(0, 10);
    expect(g.centerY).toBeCloseTo(0, 10);
    expect(g.semiMajorAxis).toBeCloseTo(20, 10);
    expect(g.semiMinorAxis).toBeCloseTo(20, 10);
  });

  it('offsets the center opposite perihelion and shortens the minor axis', () => {
    const g = ellipseGeometry(
      elements({ semiMajorAxisAu: 1, eccentricity: 0.5, perihelionLongitudeRad: 0 }),
      10,
    );
    // Perihelion along +x, so the center shifts to -x by a*e*auToWorld = 5.
    expect(g.centerX).toBeCloseTo(-5, 10);
    expect(g.centerY).toBeCloseTo(0, 10);
    expect(g.semiMajorAxis).toBeCloseTo(10, 10);
    expect(g.semiMinorAxis).toBeCloseTo(10 * Math.sqrt(1 - 0.25), 10);
    expect(g.rotationRad).toBeCloseTo(0, 10);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/sim/ellipticalOrbit.test.ts
```

Expected: FAIL — `./ellipticalOrbit` does not exist.

- [ ] **Step 3: Implement the elliptical helpers**

Create `src/sim/ellipticalOrbit.ts`:

```ts
import {
  eccentricAnomalyFromMean,
  meanAnomalyFromTrue,
  trueAnomalyFromEccentric,
} from './kepler';
import type { BodyPosition } from './types';

const TWO_PI = Math.PI * 2;

export interface OrbitalElements {
  semiMajorAxisAu: number;
  eccentricity: number;
  perihelionLongitudeRad: number;
  periodDays: number;
  /** Heliocentric ecliptic true longitude at simDays = 0. */
  epochLongitudeRad: number;
}

export interface EllipseGeometry {
  /** Ellipse center in world units (Sun sits at the +/- focus, at the origin). */
  centerX: number;
  centerY: number;
  semiMajorAxis: number;
  semiMinorAxis: number;
  /** Major-axis rotation from +x, CCW (world/math convention). */
  rotationRad: number;
}

/** Mean anomaly at simDays = 0, derived from the stored epoch true longitude. */
export function epochMeanAnomaly(el: OrbitalElements): number {
  const trueAnomaly0 = el.epochLongitudeRad - el.perihelionLongitudeRad;
  return meanAnomalyFromTrue(trueAnomaly0, el.eccentricity);
}

/**
 * Heliocentric position in AU (ecliptic plane, Sun at the origin) at simDays.
 * The +x axis points toward ecliptic longitude 0. Negative periodDays =>
 * retrograde elapsed motion.
 */
export function ellipticalPositionAu(el: OrbitalElements, simDays: number): BodyPosition {
  const meanAnomaly = epochMeanAnomaly(el) + (TWO_PI * simDays) / el.periodDays;
  const E = eccentricAnomalyFromMean(meanAnomaly, el.eccentricity);
  const trueAnomaly = trueAnomalyFromEccentric(E, el.eccentricity);
  const radiusAu = el.semiMajorAxisAu * (1 - el.eccentricity * Math.cos(E));
  const longitude = el.perihelionLongitudeRad + trueAnomaly;
  return { x: radiusAu * Math.cos(longitude), y: radiusAu * Math.sin(longitude) };
}

/** Ellipse geometry in world units, with the Sun (focus) at the origin. */
export function ellipseGeometry(el: OrbitalElements, auToWorld: number): EllipseGeometry {
  const a = el.semiMajorAxisAu * auToWorld;
  const b = a * Math.sqrt(1 - el.eccentricity * el.eccentricity);
  const focusToCenter = a * el.eccentricity;
  // The center lies opposite the perihelion direction from the focus.
  return {
    centerX: -focusToCenter * Math.cos(el.perihelionLongitudeRad),
    centerY: -focusToCenter * Math.sin(el.perihelionLongitudeRad),
    semiMajorAxis: a,
    semiMinorAxis: b,
    rotationRad: el.perihelionLongitudeRad,
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
npm test -- src/sim/ellipticalOrbit.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/ellipticalOrbit.ts src/sim/ellipticalOrbit.test.ts
git commit -m "feat: add elliptical orbit position and geometry helpers"
```

---

### Task 4: Make the simulation mode-aware

**Files:**
- Modify: `src/sim/simulation.ts:1-71`
- Test: `src/sim/simulation.test.ts:1-105`

**Interfaces:**
- Consumes: `AU_TO_WORLD` and elements from Task 1; `ellipticalPositionAu`/`ellipseGeometry`/`EllipseGeometry` from Task 3; existing `orbitalPosition`/`angleAt`.
- Produces:
  - `export type OrbitPath = { kind: 'circle'; radius: number } | ({ kind: 'ellipse' } & EllipseGeometry)`
  - `Simulation.snapshot(mode?: ScaleMode): Snapshot`
  - `Simulation.orbitPaths(mode?: ScaleMode): OrbitPath[]`
  - `Simulation.extent(mode?: ScaleMode): number`

- [ ] **Step 1: Write failing to-scale simulation tests**

In `src/sim/simulation.test.ts`, add these tests inside `describe('Simulation', ...)` (the existing `DEG_TO_RAD`, `EXPECTED_PLANET_EPOCH_ANGLES_DEG`, and `normalizedAngle` helpers are reused):

```ts
it('places every planet at its epoch longitude in to-scale mode', () => {
  const bodies = new Simulation().snapshot('toScale').bodies;
  for (const [name, deg] of Object.entries(EXPECTED_PLANET_EPOCH_ANGLES_DEG)) {
    const p = bodies.find((b) => b.name === name)!;
    expect(normalizedAngle(p.y, p.x), name).toBeCloseTo(deg * DEG_TO_RAD, 6);
  }
});

it('spreads planets by real distance in to-scale mode', () => {
  const bodies = new Simulation().snapshot('toScale').bodies;
  const dist = (n: string) => {
    const b = bodies.find((x) => x.name === n)!;
    return Math.hypot(b.x, b.y);
  };
  expect(dist('Neptune')).toBeGreaterThan(dist('Uranus'));
  expect(dist('Uranus')).toBeGreaterThan(dist('Saturn'));
  expect(dist('Saturn')).toBeGreaterThan(dist('Jupiter'));
  expect(dist('Jupiter')).toBeGreaterThan(dist('Mars'));
  expect(dist('Mars')).toBeGreaterThan(dist('Earth'));
  expect(dist('Earth')).toBeGreaterThan(dist('Mercury'));
  // Earth's semi-major axis ~ 1 AU maps to ~ AU_TO_WORLD (150) world units.
  expect(dist('Earth')).toBeGreaterThan(140);
  expect(dist('Earth')).toBeLessThan(160);
});

it('keeps schematic snapshots identical to the default', () => {
  const a = new Simulation().snapshot();
  const b = new Simulation().snapshot('schematic');
  expect(a.bodies).toEqual(b.bodies);
});

it('produces one ellipse path per planet in to-scale mode', () => {
  const paths = new Simulation().orbitPaths('toScale');
  expect(paths).toHaveLength(8);
  expect(paths.every((p) => p.kind === 'ellipse')).toBe(true);
});

it('produces circular paths in schematic mode', () => {
  const paths = new Simulation().orbitPaths('schematic');
  expect(paths).toHaveLength(8);
  expect(paths.every((p) => p.kind === 'circle')).toBe(true);
});

it('reports a larger extent in to-scale mode than schematic', () => {
  const sim = new Simulation();
  expect(sim.extent('toScale')).toBeGreaterThan(sim.extent('schematic'));
});
```

- [ ] **Step 2: Run the simulation tests and verify the new assertions fail**

Run:

```bash
npm test -- src/sim/simulation.test.ts
```

Expected: FAIL — `snapshot('toScale')` currently ignores the argument, and `orbitPaths`/`extent` do not exist.

- [ ] **Step 3: Rewrite `simulation.ts` to be mode-aware**

Replace the entire contents of `src/sim/simulation.ts` with:

```ts
import { SimClock } from './clock';
import { AU_TO_WORLD, MOONS, MOON_STYLE, PLANETS, SUN } from './data';
import {
  ellipseGeometry,
  ellipticalPositionAu,
  type EllipseGeometry,
  type OrbitalElements,
} from './ellipticalOrbit';
import { computeLayout, type Layout } from './layout';
import { angleAt, orbitalPosition } from './orbits';
import type { BodyPosition, PlanetSpec, ScaleMode } from './types';

export interface BodySnapshot {
  name: string;
  x: number;
  y: number;
  bodyRadius: number;
  color: string;
  kind: 'sun' | 'planet' | 'moon';
}

export interface Snapshot {
  simDays: number;
  bodies: BodySnapshot[];
}

export type OrbitPath =
  | { kind: 'circle'; radius: number }
  | ({ kind: 'ellipse' } & EllipseGeometry);

function elementsFor(planet: PlanetSpec): OrbitalElements {
  return {
    semiMajorAxisAu: planet.semiMajorAxisAu,
    eccentricity: planet.eccentricity,
    perihelionLongitudeRad: planet.perihelionLongitudeRad,
    periodDays: planet.periodDays,
    epochLongitudeRad: planet.epochAngleRad,
  };
}

export class Simulation {
  readonly clock = new SimClock();
  readonly layout: Layout = computeLayout(PLANETS, MOONS);

  advance(realDtSeconds: number): void {
    this.clock.advance(realDtSeconds);
  }

  private planetPosition(planet: PlanetSpec, simDays: number, mode: ScaleMode): BodyPosition {
    if (mode === 'toScale') {
      const au = ellipticalPositionAu(elementsFor(planet), simDays);
      return { x: au.x * AU_TO_WORLD, y: au.y * AU_TO_WORLD };
    }
    const { orbitRadius } = this.layout.planets[planet.name];
    return orbitalPosition(
      0,
      0,
      orbitRadius,
      angleAt(planet.periodDays, simDays, planet.epochAngleRad),
    );
  }

  snapshot(mode: ScaleMode = 'schematic'): Snapshot {
    const { simDays } = this.clock;
    const bodies: BodySnapshot[] = [
      { name: SUN.name, x: 0, y: 0, bodyRadius: SUN.bodyRadius, color: SUN.color, kind: 'sun' },
    ];

    for (const planet of PLANETS) {
      const pos = this.planetPosition(planet, simDays, mode);
      bodies.push({
        name: planet.name,
        ...pos,
        bodyRadius: planet.bodyRadius,
        color: planet.color,
        kind: 'planet',
      });

      for (const moon of MOONS) {
        if (moon.parent !== planet.name) continue;
        const ring = this.layout.moons[moon.name];
        const mpos = orbitalPosition(
          pos.x,
          pos.y,
          ring,
          angleAt(moon.periodDays, simDays, moon.epochAngleRad),
        );
        bodies.push({
          name: moon.name,
          ...mpos,
          bodyRadius: MOON_STYLE.bodyRadius,
          color: MOON_STYLE.color,
          kind: 'moon',
        });
      }
    }

    return { simDays, bodies };
  }

  orbitPaths(mode: ScaleMode = 'schematic'): OrbitPath[] {
    if (mode === 'toScale') {
      return PLANETS.map((planet) => ({
        kind: 'ellipse' as const,
        ...ellipseGeometry(elementsFor(planet), AU_TO_WORLD),
      }));
    }
    return PLANETS.map((planet) => ({
      kind: 'circle' as const,
      radius: this.layout.planets[planet.name].orbitRadius,
    }));
  }

  extent(mode: ScaleMode = 'schematic'): number {
    if (mode === 'toScale') {
      return (
        Math.max(...PLANETS.map((p) => p.semiMajorAxisAu * (1 + p.eccentricity))) * AU_TO_WORLD
      );
    }
    return Math.max(
      ...Object.values(this.layout.planets).map((e) => e.orbitRadius + e.bubbleRadius),
    );
  }
}
```

- [ ] **Step 4: Run the simulation tests and verify they pass**

Run:

```bash
npm test -- src/sim/simulation.test.ts
```

Expected: PASS. The existing schematic tests still pass (default mode unchanged); the six new tests pass.

- [ ] **Step 5: Run all simulation-core tests**

Run:

```bash
npm test -- src/sim
```

Expected: PASS for every file under `src/sim/`.

- [ ] **Step 6: Commit**

```bash
git add src/sim/simulation.ts src/sim/simulation.test.ts
git commit -m "feat: add mode-aware snapshots, orbit paths, and extent"
```

---

### Task 5: Render circle or ellipse orbit guides

**Files:**
- Modify: `src/render/drawScene.ts:1-39`
- Test: `src/render/drawScene.test.ts:1-129`

**Interfaces:**
- Consumes: `OrbitPath` from Task 4; `Camera`.
- Produces: `drawScene(ctx, snap, layout, camera, viewportW, viewportH, asteroids?, orbitPaths?)` where `orbitPaths: OrbitPath[]` (default `[]`) drives the orbit-guide layer.

- [ ] **Step 1: Add `ellipse` to the mock and update existing tests to pass orbit paths**

In `src/render/drawScene.test.ts`, add `ellipse: vi.fn()` to the `fns` object in `createMockCtx` (after `arc: vi.fn(),`):

```ts
    arc: vi.fn(),
    ellipse: vi.fn(),
```

Update the three existing `drawScene(...)` calls to pass the schematic orbit paths as the final argument, so the circle guides are still drawn (arc counts stay the same):

In "draws the background, planets ...":

```ts
    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600, [], sim.orbitPaths());
```

In "shows moons and moon labels ...":

```ts
    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600, [], sim.orbitPaths());
```

In "draws the asteroid belt ...":

```ts
    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600, belt, sim.orbitPaths());
```

- [ ] **Step 2: Add a failing test for to-scale ellipse guides**

Add this test at the end of `describe('drawScene', ...)`:

```ts
it('draws rotated ellipse guides in to-scale mode', () => {
  const sim = new Simulation();
  const camera = new Camera();
  camera.fitToView(sim.extent('toScale'), 800, 600);
  const ctx = createMockCtx();

  drawScene(
    ctx,
    sim.snapshot('toScale'),
    sim.layout,
    camera,
    800,
    600,
    [],
    sim.orbitPaths('toScale'),
  );

  // One ellipse per planet; no circular orbit guides.
  expect(ctx.ellipse).toHaveBeenCalledTimes(8);
  // 9 bodies (sun + 8 planets) + 1 sun glow + 6 moon bubble guides, no orbit circles.
  expect(ctx.arc).toHaveBeenCalledTimes(16);
});
```

- [ ] **Step 3: Run the render tests and verify the new test fails**

Run:

```bash
npm test -- src/render/drawScene.test.ts
```

Expected: FAIL on the to-scale test — `drawScene` still draws orbit circles from `snap.bodies` and never calls `ctx.ellipse`. (The three updated existing tests may already pass because their arc counts are unchanged.)

- [ ] **Step 4: Replace the orbit-guide loop in `drawScene`**

In `src/render/drawScene.ts`, update the imports to add `OrbitPath`:

```ts
import type { Layout } from '../sim/layout';
import { MOONS } from '../sim/data';
import type { OrbitPath, Snapshot } from '../sim/simulation';
import type { Camera } from './camera';
import { drawAsteroidBelt, type AsteroidState } from './asteroidBelt';
import { labelOpacity, moonOpacity, type ViewportSize } from './visibility';
```

Change the `drawScene` signature to accept `orbitPaths`:

```ts
export function drawScene(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot,
  layout: Layout,
  camera: Camera,
  viewportW: number,
  viewportH: number,
  asteroids: AsteroidState[] = [],
  orbitPaths: OrbitPath[] = [],
): void {
```

Replace the existing "Planet orbit guides" block:

```ts
  // Planet orbit guides (circles around the sun).
  ctx.strokeStyle = ORBIT_GUIDE;
  ctx.lineWidth = 1;
  for (const body of snap.bodies) {
    if (body.kind !== 'planet') continue;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, layout.planets[body.name].orbitRadius * camera.scale, 0, Math.PI * 2);
    ctx.stroke();
  }
```

with this path-driven version:

```ts
  // Orbit guides: circles (schematic) or rotated ellipses (to-scale).
  ctx.strokeStyle = ORBIT_GUIDE;
  ctx.lineWidth = 1;
  for (const path of orbitPaths) {
    ctx.beginPath();
    if (path.kind === 'circle') {
      ctx.arc(origin.x, origin.y, path.radius * camera.scale, 0, Math.PI * 2);
    } else {
      const center = camera.worldToScreen({ x: path.centerX, y: path.centerY });
      // World angles are CCW (y-up); the camera flips y, so screen rotation = -rotationRad.
      ctx.ellipse(
        center.x,
        center.y,
        path.semiMajorAxis * camera.scale,
        path.semiMinorAxis * camera.scale,
        -path.rotationRad,
        0,
        Math.PI * 2,
      );
    }
    ctx.stroke();
  }
```

Leave the rest of `drawScene` (asteroid belt, bodies, bubbles, labels) unchanged.

- [ ] **Step 5: Run the render tests and verify they pass**

Run:

```bash
npm test -- src/render/drawScene.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/render/drawScene.ts src/render/drawScene.test.ts
git commit -m "feat: render circle or ellipse orbit guides by mode"
```

---

### Task 6: Mode switcher UI and wiring

**Files:**
- Modify: `src/ui/Toolbar.tsx:1-31`
- Modify: `src/ui/Toolbar.test.tsx:1-44`
- Modify: `src/hooks/useSimulation.ts:1-130`
- Modify: `src/App.tsx:1-22`
- Modify: `src/styles.css:36-46`

**Interfaces:**
- Consumes: `ScaleMode` from `types.ts`; `Simulation.snapshot/orbitPaths/extent` from Task 4; `buildAsteroidBelt(..., mode)` from Task 1.
- Produces:
  - `ToolbarProps` gains `mode: ScaleMode` and `onSelectMode: (mode: ScaleMode) => void`.
  - `useSimulation` returns `mode: ScaleMode` and `setMode: (m: ScaleMode) => void` in addition to the existing fields.

- [ ] **Step 1: Update Toolbar test defaults and add switcher tests**

In `src/ui/Toolbar.test.tsx`, add the two new required props to the defaults in `renderToolbar`:

```ts
  const props: ToolbarProps = {
    multiplier: 1,
    paused: false,
    mode: 'schematic',
    onSelectSpeed: vi.fn(),
    onTogglePause: vi.fn(),
    onSelectMode: vi.fn(),
    ...overrides,
  };
```

Add these tests inside `describe('Toolbar', ...)`:

```ts
it('renders the Schematic and To Scale buttons', () => {
  renderToolbar();
  expect(screen.getByRole('button', { name: 'Schematic' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'To Scale' })).toBeTruthy();
});

it('marks the active mode', () => {
  renderToolbar({ mode: 'toScale' });
  expect(screen.getByRole('button', { name: 'To Scale' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Schematic' }).getAttribute('aria-pressed')).toBe('false');
});

it('calls onSelectMode when a mode button is clicked', () => {
  const props = renderToolbar();
  fireEvent.click(screen.getByRole('button', { name: 'To Scale' }));
  expect(props.onSelectMode).toHaveBeenCalledWith('toScale');
  fireEvent.click(screen.getByRole('button', { name: 'Schematic' }));
  expect(props.onSelectMode).toHaveBeenCalledWith('schematic');
});
```

- [ ] **Step 2: Run the Toolbar tests and verify failures**

Run:

```bash
npm test -- src/ui/Toolbar.test.tsx
```

Expected: FAIL — the mode buttons do not exist yet (and TypeScript flags the missing props).

- [ ] **Step 3: Add the switcher to the Toolbar**

Replace the entire contents of `src/ui/Toolbar.tsx` with:

```tsx
import type { SpeedMultiplier } from '../sim/clock';
import type { ScaleMode } from '../sim/types';

export interface ToolbarProps {
  multiplier: SpeedMultiplier;
  paused: boolean;
  mode: ScaleMode;
  onSelectSpeed: (m: SpeedMultiplier) => void;
  onTogglePause: () => void;
  onSelectMode: (mode: ScaleMode) => void;
}

const SPEEDS: SpeedMultiplier[] = [0.5, 1, 10, 100, 1000];
const MODES: { value: ScaleMode; label: string }[] = [
  { value: 'schematic', label: 'Schematic' },
  { value: 'toScale', label: 'To Scale' },
];

export function Toolbar({
  multiplier,
  paused,
  mode,
  onSelectSpeed,
  onTogglePause,
  onSelectMode,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      {SPEEDS.map((speed) => (
        <button
          key={speed}
          type="button"
          className={speed === multiplier ? 'active' : ''}
          aria-pressed={speed === multiplier}
          onClick={() => onSelectSpeed(speed)}
        >
          {speed}x
        </button>
      ))}
      <button type="button" aria-pressed={paused} onClick={onTogglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <span className="toolbar-separator" aria-hidden="true" />
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          className={m.value === mode ? 'active' : ''}
          aria-pressed={m.value === mode}
          onClick={() => onSelectMode(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the Toolbar tests and verify they pass**

Run:

```bash
npm test -- src/ui/Toolbar.test.tsx
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Add the separator style**

In `src/styles.css`, add this rule after the `.toolbar button.active { ... }` block:

```css
.toolbar-separator {
  width: 1px;
  align-self: stretch;
  margin: 0 4px;
  background: #34406e;
}
```

- [ ] **Step 6: Wire mode through `useSimulation`**

Replace the entire contents of `src/hooks/useSimulation.ts` with:

```ts
import { useEffect, useRef, useState } from 'react';
import { buildAsteroidBelt } from '../render/asteroidBelt';
import { Camera } from '../render/camera';
import { drawScene } from '../render/drawScene';
import { PointerInteraction } from './pointerInteraction';
import type { SpeedMultiplier } from '../sim/clock';
import { ASTEROID_BELT } from '../sim/data';
import { formatSimDate } from '../sim/formatDate';
import { Simulation } from '../sim/simulation';
import type { ScaleMode } from '../sim/types';

const DATE_UPDATE_INTERVAL_FRAMES = 15;

export function useSimulation(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [multiplier, setMultiplierState] = useState<SpeedMultiplier>(1);
  const [paused, setPaused] = useState(false);
  const [mode, setModeState] = useState<ScaleMode>('schematic');
  const [date, setDate] = useState(() => formatSimDate(0));
  const simRef = useRef<Simulation | null>(null);
  const applyModeRef = useRef<(m: ScaleMode) => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sim = new Simulation();
    simRef.current = sim;
    const camera = new Camera();
    const pointerInteraction = new PointerInteraction(camera);

    let currentMode: ScaleMode = 'schematic';
    let asteroids = buildAsteroidBelt(
      sim.layout,
      ASTEROID_BELT.seed,
      ASTEROID_BELT.count,
      currentMode,
    );
    let pendingMode: ScaleMode | null = null;
    applyModeRef.current = (m: ScaleMode) => {
      pendingMode = m;
    };

    let width = 0;
    let height = 0;
    let fitted = false;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!fitted && width > 0 && height > 0) {
        camera.fitToView(sim.extent(currentMode), width, height);
        fitted = true;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      camera.zoomAt(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        e.deltaY < 0 ? 1.1 : 1 / 1.1,
      );
    };
    const toCanvasPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerInteraction.pointerDown(e.pointerId, toCanvasPoint(e));
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerInteraction.activeCount() === 0) return;
      pointerInteraction.pointerMove(e.pointerId, toCanvasPoint(e));
    };

    const onPointerUp = (e: PointerEvent) => {
      pointerInteraction.pointerUp(e.pointerId);
    };

    const onPointerCancel = (e: PointerEvent) => {
      pointerInteraction.pointerUp(e.pointerId);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    let rafId = 0;
    let lastTime = performance.now();
    let framesSinceDateUpdate = 0;
    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      sim.advance(dt);
      if (pendingMode !== null && width > 0 && height > 0) {
        currentMode = pendingMode;
        pendingMode = null;
        asteroids = buildAsteroidBelt(
          sim.layout,
          ASTEROID_BELT.seed,
          ASTEROID_BELT.count,
          currentMode,
        );
        camera.fitToView(sim.extent(currentMode), width, height);
      }
      drawScene(
        ctx,
        sim.snapshot(currentMode),
        sim.layout,
        camera,
        width,
        height,
        asteroids,
        sim.orbitPaths(currentMode),
      );
      if (++framesSinceDateUpdate >= DATE_UPDATE_INTERVAL_FRAMES) {
        framesSinceDateUpdate = 0;
        setDate(formatSimDate(sim.clock.simDays));
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [canvasRef]);

  const setMultiplier = (m: SpeedMultiplier) => {
    simRef.current?.clock.setMultiplier(m);
    setMultiplierState(m);
  };

  const togglePause = () => {
    const clock = simRef.current?.clock;
    if (!clock) return;
    clock.setPaused(!clock.paused);
    setPaused(clock.paused);
  };

  const setMode = (m: ScaleMode) => {
    applyModeRef.current(m);
    setModeState(m);
  };

  return { multiplier, paused, mode, date, setMultiplier, togglePause, setMode };
}
```

- [ ] **Step 7: Wire mode into `App`**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { DateDisplay } from './ui/DateDisplay';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { multiplier, paused, mode, date, setMultiplier, togglePause, setMode } =
    useSimulation(canvasRef);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" />
      <Toolbar
        multiplier={multiplier}
        paused={paused}
        mode={mode}
        onSelectSpeed={setMultiplier}
        onTogglePause={togglePause}
        onSelectMode={setMode}
      />
      <DateDisplay date={date} />
    </div>
  );
}
```

- [ ] **Step 8: Run the hook and UI tests**

Run:

```bash
npm test -- src/hooks/useSimulation.test.tsx src/ui/Toolbar.test.tsx
```

Expected: PASS. The existing pointer-input test is unaffected (it mocks `drawScene`).

- [ ] **Step 9: Commit**

```bash
git add src/ui/Toolbar.tsx src/ui/Toolbar.test.tsx src/hooks/useSimulation.ts src/App.tsx src/styles.css
git commit -m "feat: add Schematic/To Scale switcher and wire mode through"
```

---

### Task 7: Full verification

**Files:**
- Verify only; no expected source changes.

**Interfaces:**
- Consumes: the complete feature from Tasks 1–6.
- Produces: evidence of no regressions.

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all test files pass with zero failures.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: `tsc --noEmit` reports no errors and Vite completes the production build.

- [ ] **Step 3: Check formatting and final scope**

Run:

```bash
git diff --check master...HEAD
git status --short
```

Expected: `git diff --check` prints nothing; `git status --short` prints nothing (all work committed).

- [ ] **Step 4: Manually verify the switcher in the browser**

Run:

```bash
npm run dev
```

Open the local Vite URL and verify:

1. The scene loads in **Schematic** mode, visually identical to before this feature (evenly spaced circular orbits, `2026-01-01` start date, planets distributed by their epoch longitudes).
2. Clicking **To Scale**:
   - The camera re-fits to the larger system; orbits become **ellipses** with the Sun off-center on the eccentric ones (Mercury and Mars visibly elliptical; Earth/Venus/Neptune nearly circular).
   - Planets are spaced by **real distance** — inner planets cluster near the Sun; Neptune sits far out. Zooming in reveals the inner planets.
   - Each planet sits **on** its ellipse and moves along it; at high speed (1000x), inner planets visibly **speed up near perihelion** and slow near aphelion.
   - The asteroid belt sits between the real Mars and Jupiter orbits.
3. Clicking **Schematic** returns to the circular view and re-fits the camera.
4. Speed controls, pause/resume, zoom, pan, and touch input still work in both modes; switching mode preserves the current simulation date.

Stop the dev server after verification. No commit is needed unless a defect is found; if one is found, add a failing regression test before the fix and commit that fix separately.

---

## Completion Checklist

- All eight planets carry real J2000 semi-major axis, eccentricity, and longitude of perihelion.
- `AU_TO_WORLD` scales AU to world units; distances in to-scale mode are true linear ratios.
- Kepler's equation is solved so planets move with correct (variable) angular velocity.
- Both modes agree on each planet's longitude at `simDays = 0` (epoch longitude reused as the anchor).
- Schematic mode is unchanged: default snapshots equal `snapshot('schematic')`, initial view and math are identical.
- `drawScene` renders circle guides (schematic) or rotated ellipse guides (to-scale) from `OrbitPath[]`.
- The Toolbar exposes a Schematic/To Scale switcher; `useSimulation` re-fits the camera and rebuilds the asteroid belt on switch.
- Body sizes and moon geometry remain schematic in both modes.
- Focused tests, full suite, TypeScript checking, and production build all pass.
