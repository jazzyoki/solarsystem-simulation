# Comets Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Comets layer — a toolbar toggle and picker that focuses one of 15 famous comets, drawing its Keplerian orbit (green if bound, red if unbound) and an exaggerated comet body at its real position for the current sim date.

**Architecture:** Comets reuse the existing to-scale elliptical machinery. Three pure additions — a high-eccentricity Kepler solver upgrade, a hyperbolic-orbit solver, and a comet position/path module parameterized by perihelion-passage time — feed a comet snapshot and path into `Simulation`. `drawScene` renders the path and body; `useSimulation` + a new picker wire the toggle, focus, auto-framing, and jump-to-perihelion.

**Tech Stack:** React 18 + TypeScript + Vite, Canvas 2D, Vitest + @testing-library/react. Pure orbital math in `src/sim/`, rendering in `src/render/`, hooks in `src/hooks/`, UI in `src/ui/`.

## Global Constraints

- Keep `src/sim/` pure: positions only, no Canvas/React/`Date.now()`. Impure reads live in the hook.
- Both scale modes agree on each body's longitude at `simDays = 0`; never reset the clock on a mode/layer change.
- Epoch: `2026-01-01 00:00 UTC` = `simDays 0` = JD `2461041.5`.
- `AU_TO_WORLD = 150` world units per AU (to-scale mode).
- Angles stored in radians (`× DEG_TO_RAD`); `DEG_TO_RAD = Math.PI / 180` (already in `data.ts`).
- Comet body radius exaggerated: `3` world units (moon is `1.5`, smallest planet `4`).
- Path color: bound (`short`/`long`) → green; unbound (`hyperbolic`) → red.
- Tests: mock `CanvasRenderingContext2D` for render tests; `toBeCloseTo` for floats; component tests use `@testing-library/react` + `vitest` (see `Toolbar.test.tsx`).
- Commit each task independently. Run `npm test` before each commit.

---

### Task 1: High-eccentricity Kepler solver

Upgrade `eccentricAnomalyFromMean` so Newton–Raphson converges for comet eccentricities (up to ~0.9999). The current `E = M` starter and 50-iteration cap fail above e≈0.8.

**Files:**
- Modify: `src/sim/kepler.ts:1-18`
- Test: `src/sim/kepler.test.ts` (add cases)

**Interfaces:**
- Consumes: nothing new.
- Produces: `eccentricAnomalyFromMean(meanAnomalyRad: number, eccentricity: number): number` — unchanged signature, now valid for e up to ~0.9999.

- [ ] **Step 1: Write the failing tests**

Add to `src/sim/kepler.test.ts` inside the `describe('eccentricAnomalyFromMean', ...)` block:

```ts
  it('solves Kepler equation at high (cometary) eccentricity', () => {
    for (const e of [0.968, 0.995, 0.9999]) {
      for (const M of [0.1, 1.0, 2.5, 3.5, 5.0]) {
        const E = eccentricAnomalyFromMean(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 9);
      }
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- kepler`
Expected: FAIL — the high-e case does not converge (assertion mismatch).

- [ ] **Step 3: Implement the robust starter and higher cap**

Replace the top of `src/sim/kepler.ts` (lines 1-18) with:

```ts
const KEPLER_TOLERANCE = 1e-12;
const KEPLER_MAX_ITERATIONS = 100;

/**
 * Solve Kepler's equation `M = E - e*sin(E)` for the eccentric anomaly `E`
 * using Newton-Raphson. A second-order starting value keeps it convergent for
 * the high eccentricities of comets (up to ~0.9999), as well as planets.
 */
export function eccentricAnomalyFromMean(meanAnomalyRad: number, eccentricity: number): number {
  const M = meanAnomalyRad;
  let E = M + eccentricity * Math.sin(M) * (1 + eccentricity * Math.cos(M));
  for (let i = 0; i < KEPLER_MAX_ITERATIONS; i++) {
    const delta = (E - eccentricity * Math.sin(E) - M) /
      (1 - eccentricity * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < KEPLER_TOLERANCE) break;
  }
  return E;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- kepler`
Expected: PASS (all existing cases plus the new high-e case).

- [ ] **Step 5: Commit**

```bash
git add src/sim/kepler.ts src/sim/kepler.test.ts
git commit -m "feat: converge Kepler solver at cometary eccentricities"
```

---

### Task 2: Hyperbolic-orbit solver

New module for unbound orbits (e ≥ 1): solve the hyperbolic Kepler equation and convert to true anomaly.

**Files:**
- Create: `src/sim/hyperbolicOrbit.ts`
- Test: `src/sim/hyperbolicOrbit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hyperbolicAnomalyFromMean(meanAnomaly: number, eccentricity: number): number` — hyperbolic anomaly `H` solving `M = e·sinh(H) − H`.
  - `trueAnomalyFromHyperbolic(hyperbolicAnomaly: number, eccentricity: number): number` — true anomaly `ν`.

- [ ] **Step 1: Write the failing tests**

Create `src/sim/hyperbolicOrbit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hyperbolicAnomalyFromMean, trueAnomalyFromHyperbolic } from './hyperbolicOrbit';

describe('hyperbolicAnomalyFromMean', () => {
  it('solves M = e*sinh(H) - H for interstellar eccentricities', () => {
    for (const e of [1.2, 3.36, 6.14]) {
      for (const H of [-1.5, -0.4, 0.4, 1.5, 3.0]) {
        const M = e * Math.sinh(H) - H;
        expect(hyperbolicAnomalyFromMean(M, e)).toBeCloseTo(H, 9);
      }
    }
  });

  it('returns 0 at perihelion (M = 0)', () => {
    expect(hyperbolicAnomalyFromMean(0, 3.36)).toBeCloseTo(0, 12);
  });
});

describe('trueAnomalyFromHyperbolic', () => {
  it('is 0 at perihelion', () => {
    expect(trueAnomalyFromHyperbolic(0, 3.36)).toBeCloseTo(0, 12);
  });

  it('stays within the asymptote limit acos(-1/e)', () => {
    const e = 1.2;
    const nuInf = Math.acos(-1 / e);
    expect(trueAnomalyFromHyperbolic(20, e)).toBeLessThan(nuInf);
    expect(trueAnomalyFromHyperbolic(20, e)).toBeGreaterThan(nuInf - 0.05);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- hyperbolicOrbit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the solver**

Create `src/sim/hyperbolicOrbit.ts`:

```ts
const HYPERBOLIC_TOLERANCE = 1e-12;
const HYPERBOLIC_MAX_ITERATIONS = 100;

/**
 * Solve the hyperbolic Kepler equation `M = e*sinh(H) - H` for the hyperbolic
 * anomaly `H` using Newton-Raphson. Valid for e > 1.
 */
export function hyperbolicAnomalyFromMean(meanAnomaly: number, eccentricity: number): number {
  const M = meanAnomaly;
  let H = Math.asinh(M / eccentricity);
  for (let i = 0; i < HYPERBOLIC_MAX_ITERATIONS; i++) {
    const delta = (eccentricity * Math.sinh(H) - H - M) /
      (eccentricity * Math.cosh(H) - 1);
    H -= delta;
    if (Math.abs(delta) < HYPERBOLIC_TOLERANCE) break;
  }
  return H;
}

/** True anomaly `nu` from hyperbolic anomaly `H`. */
export function trueAnomalyFromHyperbolic(hyperbolicAnomaly: number, eccentricity: number): number {
  return 2 * Math.atan2(
    Math.sqrt(eccentricity + 1) * Math.tanh(hyperbolicAnomaly / 2),
    Math.sqrt(eccentricity - 1),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- hyperbolicOrbit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/hyperbolicOrbit.ts src/sim/hyperbolicOrbit.test.ts
git commit -m "feat: add hyperbolic Kepler solver for unbound orbits"
```

---

### Task 3: Comet type and data

Add the `CometSpec` type and the 15-comet `COMETS` array. Elements are the JPL reference set (rounded); `ϖ = Ω + ω`, `perihelionTimeSimDays = Tp_JD − 2461041.5`. Near-parabolic comets use `e` derived as `1 − q/a` (a negative) so they route through the hyperbolic branch.

**Files:**
- Modify: `src/sim/types.ts` (add `CometClass`, `CometSpec`)
- Modify: `src/sim/data.ts` (add `COMETS`)
- Test: `src/sim/data.test.ts` (add comet integrity cases)

**Interfaces:**
- Consumes: `DEG_TO_RAD` (already defined in `data.ts`).
- Produces:
  - `type CometClass = 'short' | 'long' | 'hyperbolic'`
  - `interface CometSpec { name; designation; eccentricity; semiMajorAxisAu; perihelionDistanceAu; perihelionLongitudeRad; perihelionTimeSimDays; retrograde; cometClass; bodyRadius; color; note? }`
  - `COMETS: CometSpec[]` (length 15).

- [ ] **Step 1: Write the failing tests**

Add to `src/sim/data.test.ts` (import `COMETS` alongside existing imports):

```ts
import { COMETS } from './data';

describe('COMETS', () => {
  it('contains exactly 15 comets with unique names', () => {
    expect(COMETS).toHaveLength(15);
    expect(new Set(COMETS.map((c) => c.name)).size).toBe(15);
  });

  it('tags hyperbolic comets iff eccentricity >= 1', () => {
    for (const c of COMETS) {
      expect(c.cometClass === 'hyperbolic').toBe(c.eccentricity >= 1);
    }
  });

  it('has positive perihelion distance and radius for every comet', () => {
    for (const c of COMETS) {
      expect(c.perihelionDistanceAu).toBeGreaterThan(0);
      expect(c.bodyRadius).toBeGreaterThan(0);
    }
  });

  it('gives bound comets a positive semi-major axis and unbound a negative one', () => {
    for (const c of COMETS) {
      if (c.eccentricity < 1) expect(c.semiMajorAxisAu).toBeGreaterThan(0);
      else expect(c.semiMajorAxisAu).toBeLessThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- data`
Expected: FAIL — `COMETS` is not exported.

- [ ] **Step 3: Add the type**

Append to `src/sim/types.ts`:

```ts
export type CometClass = 'short' | 'long' | 'hyperbolic';

export interface CometSpec {
  name: string;
  designation: string;
  /** Orbital eccentricity (>= 1 for hyperbolic / near-parabolic). */
  eccentricity: number;
  /** Semi-major axis in AU (negative for hyperbolic). */
  semiMajorAxisAu: number;
  /** Perihelion distance q in AU. */
  perihelionDistanceAu: number;
  /** Longitude of perihelion (Omega + omega) in radians. */
  perihelionLongitudeRad: number;
  /** Time of perihelion passage in simDays (Tp_JD - 2461041.5). */
  perihelionTimeSimDays: number;
  /** True for retrograde ecliptic motion (inclination > 90 deg). */
  retrograde: boolean;
  cometClass: CometClass;
  /** Exaggerated display radius in world units. */
  bodyRadius: number;
  color: string;
  /** Optional flag, e.g. "historical" for ISON. */
  note?: string;
}
```

- [ ] **Step 4: Add the data**

Append to `src/sim/data.ts` (after `MOONS`). `ϖ = Ω + ω` written as a sum for traceability; `perihelionTimeSimDays` as `Tp_JD - 2461041.5`:

```ts
import type { CometSpec } from './types';

const EPOCH_JD = 2461041.5;
const COMET_BODY_RADIUS = 3;
const COMET_COLOR = '#dbeeff';

export const COMETS: CometSpec[] = [
  { name: 'Halley', designation: '1P', eccentricity: 0.968, semiMajorAxisAu: 17.9, perihelionDistanceAu: 0.575,
    perihelionLongitudeRad: (59.1 + 112) * DEG_TO_RAD, perihelionTimeSimDays: 2446469.97 - EPOCH_JD,
    retrograde: true, cometClass: 'short', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'Encke', designation: '2P', eccentricity: 0.848, semiMajorAxisAu: 2.22, perihelionDistanceAu: 0.338,
    perihelionLongitudeRad: (334 + 187) * DEG_TO_RAD, perihelionTimeSimDays: 2460239.65 - EPOCH_JD,
    retrograde: false, cometClass: 'short', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'Churyumov-Gerasimenko', designation: '67P', eccentricity: 0.641, semiMajorAxisAu: 3.46, perihelionDistanceAu: 1.24,
    perihelionLongitudeRad: (50.1 + 12.8) * DEG_TO_RAD, perihelionTimeSimDays: 2457247.59 - EPOCH_JD,
    retrograde: false, cometClass: 'short', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'Wild 2', designation: '81P', eccentricity: 0.537, semiMajorAxisAu: 3.45, perihelionDistanceAu: 1.60,
    perihelionLongitudeRad: (136 + 41.7) * DEG_TO_RAD, perihelionTimeSimDays: 2459929.29 - EPOCH_JD,
    retrograde: false, cometClass: 'short', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'Swift-Tuttle', designation: '109P', eccentricity: 0.963, semiMajorAxisAu: 26.1, perihelionDistanceAu: 0.960,
    perihelionLongitudeRad: (139 + 153) * DEG_TO_RAD, perihelionTimeSimDays: 2448968.50 - EPOCH_JD,
    retrograde: true, cometClass: 'short', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'Tempel-Tuttle', designation: '55P', eccentricity: 0.906, semiMajorAxisAu: 10.3, perihelionDistanceAu: 0.976,
    perihelionLongitudeRad: (235 + 173) * DEG_TO_RAD, perihelionTimeSimDays: 2450872.60 - EPOCH_JD,
    retrograde: true, cometClass: 'short', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'Hale-Bopp', designation: 'C/1995 O1', eccentricity: 0.995, semiMajorAxisAu: 177, perihelionDistanceAu: 0.891,
    perihelionLongitudeRad: (283 + 130) * DEG_TO_RAD, perihelionTimeSimDays: 2450537.14 - EPOCH_JD,
    retrograde: false, cometClass: 'long', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'NEOWISE', designation: 'C/2020 F3', eccentricity: 0.999, semiMajorAxisAu: 358, perihelionDistanceAu: 0.295,
    perihelionLongitudeRad: (61.0 + 37.3) * DEG_TO_RAD, perihelionTimeSimDays: 2459034.18 - EPOCH_JD,
    retrograde: true, cometClass: 'long', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'Hyakutake', designation: 'C/1996 B2', eccentricity: 0.9999, semiMajorAxisAu: 2120, perihelionDistanceAu: 0.230,
    perihelionLongitudeRad: (188 + 130) * DEG_TO_RAD, perihelionTimeSimDays: 2450204.89 - EPOCH_JD,
    retrograde: true, cometClass: 'long', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'McNaught', designation: 'C/2006 P1', eccentricity: 1.0000189, semiMajorAxisAu: -9070, perihelionDistanceAu: 0.171,
    perihelionLongitudeRad: (267 + 156) * DEG_TO_RAD, perihelionTimeSimDays: 2454113.30 - EPOCH_JD,
    retrograde: false, cometClass: 'hyperbolic', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'Tsuchinshan-ATLAS', designation: 'C/2023 A3', eccentricity: 1.0000951, semiMajorAxisAu: -4110, perihelionDistanceAu: 0.391,
    perihelionLongitudeRad: (21.6 + 308) * DEG_TO_RAD, perihelionTimeSimDays: 2460581.24 - EPOCH_JD,
    retrograde: true, cometClass: 'hyperbolic', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'ISON', designation: 'C/2012 S1', eccentricity: 1.0000051, semiMajorAxisAu: -2450, perihelionDistanceAu: 0.0125,
    perihelionLongitudeRad: (296 + 346) * DEG_TO_RAD, perihelionTimeSimDays: 2456625.27 - EPOCH_JD,
    retrograde: false, cometClass: 'hyperbolic', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR, note: 'historical' },
  { name: "'Oumuamua", designation: '1I', eccentricity: 1.20, semiMajorAxisAu: -1.27, perihelionDistanceAu: 0.256,
    perihelionLongitudeRad: (24.6 + 242) * DEG_TO_RAD, perihelionTimeSimDays: 2458006.01 - EPOCH_JD,
    retrograde: true, cometClass: 'hyperbolic', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: 'Borisov', designation: '2I', eccentricity: 3.36, semiMajorAxisAu: -0.851, perihelionDistanceAu: 2.01,
    perihelionLongitudeRad: (308 + 209) * DEG_TO_RAD, perihelionTimeSimDays: 2458826.05 - EPOCH_JD,
    retrograde: false, cometClass: 'hyperbolic', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
  { name: '3I/ATLAS', designation: '3I', eccentricity: 6.14, semiMajorAxisAu: -0.264, perihelionDistanceAu: 1.36,
    perihelionLongitudeRad: (322 + 128) * DEG_TO_RAD, perihelionTimeSimDays: 2460977.99 - EPOCH_JD,
    retrograde: true, cometClass: 'hyperbolic', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
];
```

Note: `import type { CometSpec }` merges with the existing type import line in `data.ts` — combine them into `import type { CometSpec, MoonSpec, PlanetSpec, ScaleMode } from './types';` rather than adding a duplicate import.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- data`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/types.ts src/sim/data.ts src/sim/data.test.ts
git commit -m "feat: add CometSpec type and 15-comet dataset"
```

---

### Task 4: Comet position

Compute a comet's heliocentric AU position at a given `simDays`, dispatching to the elliptical or hyperbolic branch. Mean motion comes from Gauss's constant, so no period is stored.

**Files:**
- Create: `src/sim/cometOrbit.ts`
- Test: `src/sim/cometOrbit.test.ts`

**Interfaces:**
- Consumes: `eccentricAnomalyFromMean`, `trueAnomalyFromEccentric` (`kepler.ts`); `hyperbolicAnomalyFromMean`, `trueAnomalyFromHyperbolic` (`hyperbolicOrbit.ts`); `CometSpec`, `BodyPosition` (`types.ts`).
- Produces:
  - `GAUSS_K = 0.01720209895`
  - `meanMotion(semiMajorAxisAu: number): number` → `GAUSS_K / Math.abs(a) ** 1.5`
  - `cometMeanAnomaly(spec: CometSpec, simDays: number): number`
  - `cometPositionAu(spec: CometSpec, simDays: number): BodyPosition`

- [ ] **Step 1: Write the failing tests**

Create `src/sim/cometOrbit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COMETS } from './data';
import { cometPositionAu, meanMotion } from './cometOrbit';
import type { CometSpec } from './types';

const byName = (name: string): CometSpec => COMETS.find((c) => c.name === name)!;

function distance(spec: CometSpec, simDays: number): number {
  const p = cometPositionAu(spec, simDays);
  return Math.hypot(p.x, p.y);
}

describe('meanMotion', () => {
  it('matches 2*pi/period for a 1 AU circular orbit (~365.25 days)', () => {
    // n = k / a^1.5; for a = 1 AU, period = 2*pi / n days.
    const period = (2 * Math.PI) / meanMotion(1);
    expect(period).toBeCloseTo(365.25, 0);
  });
});

describe('cometPositionAu', () => {
  it('places a bound comet at perihelion distance q at Tp', () => {
    const halley = byName('Halley');
    expect(distance(halley, halley.perihelionTimeSimDays)).toBeCloseTo(halley.perihelionDistanceAu, 4);
  });

  it('places an unbound comet at perihelion distance q at Tp', () => {
    const borisov = byName('Borisov');
    expect(distance(borisov, borisov.perihelionTimeSimDays)).toBeCloseTo(borisov.perihelionDistanceAu, 4);
  });

  it('moves the comet farther from the Sun after perihelion', () => {
    const encke = byName('Encke');
    const rAtPeri = distance(encke, encke.perihelionTimeSimDays);
    const rLater = distance(encke, encke.perihelionTimeSimDays + 200);
    expect(rLater).toBeGreaterThan(rAtPeri);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cometOrbit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/sim/cometOrbit.ts`:

```ts
import { eccentricAnomalyFromMean, trueAnomalyFromEccentric } from './kepler';
import { hyperbolicAnomalyFromMean, trueAnomalyFromHyperbolic } from './hyperbolicOrbit';
import type { BodyPosition, CometSpec } from './types';

/** Gaussian gravitational constant (AU^1.5 / day). */
export const GAUSS_K = 0.01720209895;

/** Mean motion (rad/day) from the semi-major axis; |a| handles hyperbolas. */
export function meanMotion(semiMajorAxisAu: number): number {
  return GAUSS_K / Math.abs(semiMajorAxisAu) ** 1.5;
}

/** Mean anomaly at simDays; negated for retrograde ecliptic motion. */
export function cometMeanAnomaly(spec: CometSpec, simDays: number): number {
  const n = meanMotion(spec.semiMajorAxisAu);
  const direction = spec.retrograde ? -1 : 1;
  return direction * n * (simDays - spec.perihelionTimeSimDays);
}

/** Heliocentric position in AU (ecliptic plane, Sun at origin) at simDays. */
export function cometPositionAu(spec: CometSpec, simDays: number): BodyPosition {
  const e = spec.eccentricity;
  const M = cometMeanAnomaly(spec, simDays);
  let radiusAu: number;
  let trueAnomaly: number;
  if (e < 1) {
    const E = eccentricAnomalyFromMean(M, e);
    trueAnomaly = trueAnomalyFromEccentric(E, e);
    radiusAu = spec.semiMajorAxisAu * (1 - e * Math.cos(E));
  } else {
    const H = hyperbolicAnomalyFromMean(M, e);
    trueAnomaly = trueAnomalyFromHyperbolic(H, e);
    radiusAu = spec.semiMajorAxisAu * (1 - e * Math.cosh(H));
  }
  const longitude = spec.perihelionLongitudeRad + trueAnomaly;
  return { x: radiusAu * Math.cos(longitude), y: radiusAu * Math.sin(longitude) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- cometOrbit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/cometOrbit.ts src/sim/cometOrbit.test.ts
git commit -m "feat: compute comet position from perihelion time"
```

---

### Task 5: Comet path sampler

Sample a comet's orbit into a world-independent polyline (AU points). The sampled span depends on class: full ellipse (`short`), perihelion arc clipped to a radius window (`long`), asymptote-and-window-bounded arc (`hyperbolic`).

**Files:**
- Modify: `src/sim/cometOrbit.ts` (add sampler + constants)
- Test: `src/sim/cometOrbit.test.ts` (add cases)

**Interfaces:**
- Consumes: `CometSpec`, `BodyPosition`.
- Produces:
  - `COMET_PATH_WINDOW_AU = 35`
  - `COMET_PATH_SEGMENTS = 128`
  - `cometPathAu(spec: CometSpec, rWindowAu?: number, segments?: number): BodyPosition[]` — `segments + 1` points, symmetric in true anomaly about perihelion.

- [ ] **Step 1: Write the failing tests**

Add to `src/sim/cometOrbit.test.ts`:

```ts
import { cometPathAu, COMET_PATH_SEGMENTS } from './cometOrbit';

describe('cometPathAu', () => {
  it('returns segments + 1 points', () => {
    expect(cometPathAu(byName('Halley'))).toHaveLength(COMET_PATH_SEGMENTS + 1);
  });

  it('closes the ellipse for a short-period comet', () => {
    const pts = cometPathAu(byName('Encke'));
    const first = pts[0];
    const last = pts[pts.length - 1];
    expect(first.x).toBeCloseTo(last.x, 6);
    expect(first.y).toBeCloseTo(last.y, 6);
  });

  it('keeps a hyperbolic path within the radius window', () => {
    const maxR = Math.max(...cometPathAu(byName('Borisov')).map((p) => Math.hypot(p.x, p.y)));
    expect(maxR).toBeLessThanOrEqual(35 * 1.01);
  });

  it('starts every path near perihelion distance q at the arc midpoint', () => {
    const halley = byName('Halley');
    const pts = cometPathAu(halley);
    const mid = pts[COMET_PATH_SEGMENTS / 2];
    expect(Math.hypot(mid.x, mid.y)).toBeCloseTo(halley.perihelionDistanceAu, 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cometOrbit`
Expected: FAIL — `cometPathAu` not exported.

- [ ] **Step 3: Implement the sampler**

Append to `src/sim/cometOrbit.ts`:

```ts
/** Radius (AU) at which long-period and hyperbolic arcs are clipped. */
export const COMET_PATH_WINDOW_AU = 35;
/** Number of segments in a sampled comet path (points = segments + 1). */
export const COMET_PATH_SEGMENTS = 128;

/**
 * Sample a comet's orbit into a polyline of heliocentric AU points, symmetric
 * in true anomaly about perihelion (midpoint = perihelion). Short-period comets
 * sample the full ellipse; long-period and hyperbolic comets are clipped to a
 * radius window (and, for hyperbolas, to just inside the asymptote).
 */
export function cometPathAu(
  spec: CometSpec,
  rWindowAu: number = COMET_PATH_WINDOW_AU,
  segments: number = COMET_PATH_SEGMENTS,
): BodyPosition[] {
  const e = spec.eccentricity;
  const semiLatus = spec.perihelionDistanceAu * (1 + e); // p = q(1 + e)
  const w = spec.perihelionLongitudeRad;

  let nuMax: number;
  if (spec.cometClass === 'short') {
    nuMax = Math.PI;
  } else if (e < 1) {
    // Clip the arc where the radius reaches the window (or the whole ellipse).
    const cosAtWindow = (semiLatus / rWindowAu - 1) / e;
    nuMax = Math.acos(Math.max(-1, Math.min(1, cosAtWindow)));
  } else {
    const nuInf = Math.acos(-1 / e);
    const cosAtWindow = (semiLatus / rWindowAu - 1) / e;
    const nuAtWindow = Math.acos(Math.max(-1, Math.min(1, cosAtWindow)));
    nuMax = Math.min(nuInf - 1e-3, nuAtWindow);
  }

  const points: BodyPosition[] = [];
  for (let i = 0; i <= segments; i++) {
    const nu = -nuMax + (2 * nuMax * i) / segments;
    const r = semiLatus / (1 + e * Math.cos(nu));
    const longitude = w + nu;
    points.push({ x: r * Math.cos(longitude), y: r * Math.sin(longitude) });
  }
  return points;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- cometOrbit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/cometOrbit.ts src/sim/cometOrbit.test.ts
git commit -m "feat: sample comet orbit paths by class"
```

---

### Task 6: Simulation integration

Expose the focused comet through `Simulation`: a body snapshot, a world-space path with color, and a framing extent. Comets are only meaningful in to-scale coordinates (real AU).

**Files:**
- Modify: `src/sim/simulation.ts`
- Test: `src/sim/simulation.test.ts` (add cases)

**Interfaces:**
- Consumes: `COMETS`, `AU_TO_WORLD` (`data.ts`); `cometPositionAu`, `cometPathAu` (`cometOrbit.ts`); `CometSpec` (`types.ts`).
- Produces (on `Simulation`):
  - `cometBody(cometName: string): BodySnapshot | null` — comet body in world units, `kind: 'comet'`.
  - `cometPath(cometName: string): CometPathRender | null` where
    `interface CometPathRender { points: BodyPosition[]; color: 'green' | 'red' }` — points in world units.
  - `cometExtent(cometName: string): number` — world radius bounding the sampled path.
- Extends `BodySnapshot.kind` union to include `'comet'`.

- [ ] **Step 1: Write the failing tests**

Add to `src/sim/simulation.test.ts`:

```ts
import { COMETS } from './data';

describe('Simulation comets', () => {
  it('returns null for an unknown comet', () => {
    const sim = new Simulation();
    expect(sim.cometBody('Nope')).toBeNull();
    expect(sim.cometPath('Nope')).toBeNull();
  });

  it('colors bound comets green and unbound comets red', () => {
    const sim = new Simulation();
    expect(sim.cometPath('Halley')!.color).toBe('green');
    expect(sim.cometPath('Borisov')!.color).toBe('red');
  });

  it('reports a comet body in world units with kind "comet"', () => {
    const sim = new Simulation();
    sim.clock.setSimDays(COMETS.find((c) => c.name === 'Halley')!.perihelionTimeSimDays);
    const body = sim.cometBody('Halley')!;
    expect(body.kind).toBe('comet');
    // At perihelion, q = 0.575 AU * 150 = ~86 world units from the Sun.
    expect(Math.hypot(body.x, body.y)).toBeCloseTo(0.575 * 150, 0);
  });

  it('gives a positive framing extent', () => {
    const sim = new Simulation();
    expect(sim.cometExtent('Halley')).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- simulation`
Expected: FAIL — comet methods do not exist.

- [ ] **Step 3: Implement the integration**

In `src/sim/simulation.ts`:

Add to the imports from `./data`: `COMETS`. Add imports:

```ts
import { cometPathAu, cometPositionAu } from './cometOrbit';
import type { CometSpec } from './types';
```

Extend `BodySnapshot.kind` (line ~19) to:

```ts
  kind: 'sun' | 'planet' | 'moon' | 'comet';
```

Add near the other exported types:

```ts
export interface CometPathRender {
  points: BodyPosition[];
  color: 'green' | 'red';
}
```

Add these methods to the `Simulation` class:

```ts
  private findComet(cometName: string): CometSpec | undefined {
    return COMETS.find((c) => c.name === cometName);
  }

  cometBody(cometName: string): BodySnapshot | null {
    const comet = this.findComet(cometName);
    if (!comet) return null;
    const au = cometPositionAu(comet, this.clock.simDays);
    return {
      name: comet.name,
      x: au.x * AU_TO_WORLD,
      y: au.y * AU_TO_WORLD,
      bodyRadius: comet.bodyRadius,
      color: comet.color,
      kind: 'comet',
    };
  }

  cometPath(cometName: string): CometPathRender | null {
    const comet = this.findComet(cometName);
    if (!comet) return null;
    const points = cometPathAu(comet).map((p) => ({ x: p.x * AU_TO_WORLD, y: p.y * AU_TO_WORLD }));
    return { points, color: comet.cometClass === 'hyperbolic' ? 'red' : 'green' };
  }

  cometExtent(cometName: string): number {
    const comet = this.findComet(cometName);
    if (!comet) return 0;
    const maxAu = Math.max(...cometPathAu(comet).map((p) => Math.hypot(p.x, p.y)));
    return maxAu * AU_TO_WORLD;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- simulation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/simulation.ts src/sim/simulation.test.ts
git commit -m "feat: expose focused comet body, path, and extent from Simulation"
```

---

### Task 7: Render the comet path and body

Draw the focused comet's path (green/red polyline) and its exaggerated body with an anti-sunward tail and label.

**Files:**
- Modify: `src/render/drawScene.ts`
- Test: `src/render/drawScene.test.ts` (add cases)

**Interfaces:**
- Consumes: `CometPathRender` (`simulation.ts`); existing `Camera`, `Snapshot`.
- Produces: `drawScene(..., cometPath: CometPathRender | null = null)` — new trailing optional parameter; comet body is a `snap.bodies` entry with `kind: 'comet'`.

- [ ] **Step 1: Write the failing tests**

Add to `src/render/drawScene.test.ts` (follow the file's existing mock-context pattern). If the file has a `makeCtx()`/mock helper, reuse it; otherwise mirror the existing setup. Example cases:

```ts
it('strokes the comet path in its class color', () => {
  const ctx = makeCtx();
  const camera = new Camera();
  camera.fitToView(1000, 800, 600);
  const snap = { simDays: 0, bodies: [] };
  const cometPath = {
    points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 } ],
    color: 'red' as const,
  };
  drawScene(ctx, snap, layoutStub, camera, 800, 600, [], [], cometPath);
  expect(ctx.strokeStyle).toContain; // strokeStyle was set to the comet color at some point
  expect(setStrokeStyles).toContain('red');
});

it('draws a comet body from the snapshot', () => {
  const ctx = makeCtx();
  const camera = new Camera();
  camera.fitToView(1000, 800, 600);
  const snap = {
    simDays: 0,
    bodies: [ { name: 'Halley', x: 90, y: 0, bodyRadius: 3, color: '#dbeeff', kind: 'comet' as const } ],
  };
  drawScene(ctx, snap, layoutStub, camera, 800, 600, [], [], null);
  expect(ctx.arc).toHaveBeenCalled();
  expect(fillTexts).toContain('Halley');
});
```

Adapt `makeCtx`, `layoutStub`, `setStrokeStyles`, `fillTexts` to the helpers already used in `drawScene.test.ts` (inspect the file first; it records styles/calls via spies).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- drawScene`
Expected: FAIL — `drawScene` has no `cometPath` parameter; comet body branch missing.

- [ ] **Step 3: Implement rendering**

In `src/render/drawScene.ts`:

Import the type:

```ts
import type { CometPathRender, OrbitPath, Snapshot } from '../sim/simulation';
```

Add color constants near the others:

```ts
const COMET_PATH_GREEN = 'rgba(90, 220, 130, 0.8)';
const COMET_PATH_RED = 'rgba(240, 90, 90, 0.85)';
const COMET_TAIL = 'rgba(220, 240, 255, 0.5)';
```

Add the `cometPath` parameter to the signature:

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
  cometPath: CometPathRender | null = null,
): void {
```

After the planet orbit-guide loop and before the asteroid belt (i.e. after line ~53), draw the comet path:

```ts
  if (cometPath && cometPath.points.length > 1) {
    ctx.strokeStyle = cometPath.color === 'red' ? COMET_PATH_RED : COMET_PATH_GREEN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    cometPath.points.forEach((pt, i) => {
      const s = camera.worldToScreen(pt);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
  }
```

In the body loop, handle `kind: 'comet'` (add before the planet-label block; comet bodies are always drawn — no opacity gating). Inside the loop, after computing `p` and `r`:

```ts
    if (body.kind === 'comet') {
      // Anti-sunward tail: from the comet, directly away from the Sun (origin).
      const len = Math.hypot(body.x, body.y) || 1;
      const tailWorld = { x: body.x + (body.x / len) * 40, y: body.y + (body.y / len) * 40 };
      const tail = camera.worldToScreen(tailWorld);
      ctx.strokeStyle = COMET_TAIL;
      ctx.lineWidth = Math.max(r * 0.8, 1);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tail.x, tail.y);
      ctx.stroke();

      ctx.fillStyle = body.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = LABEL_COLOR;
      ctx.font = LABEL_FONT;
      ctx.fillText(body.name, p.x + r + 4, p.y - r - 4);
      continue;
    }
```

Place this block near the top of the per-body work, after `const p = ...; const r = ...;` and before the `if (body.kind === 'sun')` block, so comets don't fall through the planet/moon branches.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- drawScene`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/drawScene.ts src/render/drawScene.test.ts
git commit -m "feat: render comet path and body with tail"
```

---

### Task 8: Hook state, focus, framing, and jump-to-perihelion

Add comet state to `useSimulation`: enable flag, selected comet, actions to select/clear and jump to perihelion. Selecting a comet auto-switches to to-scale and auto-frames its orbit; the RAF loop draws the focused comet's path and body.

**Files:**
- Modify: `src/hooks/useSimulation.ts`
- Test: `src/hooks/useSimulation.test.tsx` (add cases)

**Interfaces:**
- Consumes: `Simulation.cometPath/cometBody/cometExtent`, `ScaleMode`.
- Produces (returned from `useSimulation`): `cometsEnabled: boolean`, `selectedComet: string | null`, `setCometsEnabled(on: boolean)`, `selectComet(name: string | null)`, `jumpToPerihelion()`.

- [ ] **Step 1: Write the failing tests**

Follow the existing `useSimulation.test.tsx` setup (it renders a component using the hook against a mocked canvas). Add cases:

```ts
it('defaults comets off with no selection', () => {
  const { result } = renderUseSimulation();
  expect(result.current.cometsEnabled).toBe(false);
  expect(result.current.selectedComet).toBeNull();
});

it('selecting a comet switches to to-scale mode', () => {
  const { result } = renderUseSimulation();
  act(() => result.current.selectComet('Halley'));
  expect(result.current.mode).toBe('toScale');
  expect(result.current.selectedComet).toBe('Halley');
});

it('jumpToPerihelion seeks to the comet Tp and pauses', () => {
  const { result } = renderUseSimulation();
  act(() => result.current.selectComet('Encke'));
  act(() => result.current.jumpToPerihelion());
  expect(result.current.paused).toBe(true);
});
```

Reuse whatever render/act helpers the existing tests use (`renderHook` or a wrapper component + `act`). Inspect the file first and match its style.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useSimulation`
Expected: FAIL — new fields/actions are undefined.

- [ ] **Step 3: Implement the hook changes**

In `src/hooks/useSimulation.ts`:

Add state near the other `useState` calls:

```ts
  const [cometsEnabled, setCometsEnabledState] = useState(false);
  const [selectedComet, setSelectedComet] = useState<string | null>(null);
```

Add refs the RAF loop reads (near `applyModeRef`):

```ts
  const selectedCometRef = useRef<string | null>(null);
  const pendingCometFrameRef = useRef<string | null>(null);
```

Inside the effect, after `applyModeRef.current = ...`, add a way for the loop to consume a pending frame request. In the `loop` body, after the existing `pendingMode` block, add:

```ts
      const frameComet = pendingCometFrameRef.current;
      if (frameComet !== null && width > 0 && height > 0) {
        pendingCometFrameRef.current = null;
        const extent = sim.cometExtent(frameComet);
        if (extent > 0) camera.fitToView(extent, width, height);
      }
```

Change the `drawScene(...)` call to pass the focused comet path:

```ts
      const cometPathRender = selectedCometRef.current && cometsEnabledRef.current
        ? sim.cometPath(selectedCometRef.current)
        : null;
      const snapshot = sim.snapshot(currentMode);
      if (cometPathRender && selectedCometRef.current) {
        const body = sim.cometBody(selectedCometRef.current);
        if (body) snapshot.bodies.push(body);
      }
      drawScene(ctx, snapshot, sim.layout, camera, width, height, asteroids, sim.orbitPaths(currentMode), cometPathRender);
```

Add a `cometsEnabledRef` alongside the others and keep it in sync:

```ts
  const cometsEnabledRef = useRef(false);
```

Wire the actions (near `setMode`):

```ts
  const setCometsEnabled = (on: boolean) => {
    cometsEnabledRef.current = on;
    setCometsEnabledState(on);
    if (!on) {
      selectedCometRef.current = null;
      setSelectedComet(null);
    }
  };

  const selectComet = (name: string | null) => {
    selectedCometRef.current = name;
    setSelectedComet(name);
    if (name) {
      applyModeRef.current('toScale');
      setModeState('toScale');
      pendingCometFrameRef.current = name;
    }
  };

  const jumpToPerihelion = () => {
    const name = selectedCometRef.current;
    if (!name) return;
    const comet = COMETS.find((c) => c.name === name);
    if (comet) seekToDate(comet.perihelionTimeSimDays);
  };
```

Add the import: `import { ASTEROID_BELT, COMETS } from '../sim/data';` (merge with the existing `ASTEROID_BELT` import).

Return the new fields:

```ts
  return {
    multiplier, paused, mode, date, setMultiplier, togglePause, setMode,
    seekToDate, goToToday,
    cometsEnabled, selectedComet, setCometsEnabled, selectComet, jumpToPerihelion,
  };
```

Note: `cometsEnabledRef` must be declared before the effect that references it, and set from `setCometsEnabled`. Since the RAF loop reads refs (not state), the effect does not need `cometsEnabled` in its dependency array — keep the existing `[canvasRef]` deps.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useSimulation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSimulation.ts src/hooks/useSimulation.test.tsx
git commit -m "feat: wire comet enable, focus, framing, and jump-to-perihelion"
```

---

### Task 9: Toolbar toggle, comet picker, and App wiring

Add the Comets toggle to the toolbar, a picker component for the 15 comets with a jump-to-perihelion button, and wire both into `App`.

**Files:**
- Modify: `src/ui/Toolbar.tsx`
- Modify: `src/ui/Toolbar.test.tsx`
- Create: `src/ui/CometPicker.tsx`
- Create: `src/ui/CometPicker.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css` (picker styling)

**Interfaces:**
- Consumes: `COMETS` (`data.ts`); hook fields from Task 8.
- Produces:
  - `Toolbar` gains props `cometsEnabled: boolean`, `onToggleComets: () => void` and a "Comets" button.
  - `CometPicker` component with props `{ comets: {name; designation}[]; selected: string | null; onSelect(name: string | null): void; onJumpToPerihelion(): void }`.

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/Toolbar.test.tsx` — extend the `renderToolbar` props defaults with `cometsEnabled: false, onToggleComets: vi.fn()` and add:

```ts
it('renders the Comets toggle and reflects its state', () => {
  renderToolbar({ cometsEnabled: true });
  const btn = screen.getByRole('button', { name: 'Comets' });
  expect(btn.getAttribute('aria-pressed')).toBe('true');
});

it('calls onToggleComets when the Comets button is clicked', () => {
  const props = renderToolbar();
  fireEvent.click(screen.getByRole('button', { name: 'Comets' }));
  expect(props.onToggleComets).toHaveBeenCalled();
});
```

Create `src/ui/CometPicker.test.tsx`:

```ts
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CometPicker } from './CometPicker';

const comets = [
  { name: 'Halley', designation: '1P' },
  { name: 'Encke', designation: '2P' },
];

describe('CometPicker', () => {
  it('lists every comet', () => {
    render(<CometPicker comets={comets} selected={null} onSelect={vi.fn()} onJumpToPerihelion={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Halley/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Encke/ })).toBeTruthy();
  });

  it('calls onSelect with the comet name', () => {
    const onSelect = vi.fn();
    render(<CometPicker comets={comets} selected={null} onSelect={onSelect} onJumpToPerihelion={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Halley/ }));
    expect(onSelect).toHaveBeenCalledWith('Halley');
  });

  it('shows the jump-to-perihelion button only when a comet is selected', () => {
    const onJump = vi.fn();
    const { rerender } = render(
      <CometPicker comets={comets} selected={null} onSelect={vi.fn()} onJumpToPerihelion={onJump} />,
    );
    expect(screen.queryByRole('button', { name: /perihelion/i })).toBeNull();
    rerender(<CometPicker comets={comets} selected={'Halley'} onSelect={vi.fn()} onJumpToPerihelion={onJump} />);
    fireEvent.click(screen.getByRole('button', { name: /perihelion/i }));
    expect(onJump).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Toolbar CometPicker`
Expected: FAIL — Comets button and `CometPicker` do not exist.

- [ ] **Step 3: Implement Toolbar toggle**

In `src/ui/Toolbar.tsx`, extend `ToolbarProps`:

```ts
  cometsEnabled: boolean;
  onToggleComets: () => void;
```

Destructure `cometsEnabled, onToggleComets` and add after the mode buttons (before the closing `</div>`):

```tsx
      <span className="toolbar-separator" aria-hidden="true" />
      <button
        type="button"
        className={cometsEnabled ? 'active' : ''}
        aria-pressed={cometsEnabled}
        onClick={onToggleComets}
      >
        Comets
      </button>
```

- [ ] **Step 4: Implement CometPicker**

Create `src/ui/CometPicker.tsx`:

```tsx
interface CometOption {
  name: string;
  designation: string;
}

interface CometPickerProps {
  comets: CometOption[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  onJumpToPerihelion: () => void;
}

export function CometPicker({ comets, selected, onSelect, onJumpToPerihelion }: CometPickerProps) {
  return (
    <div className="comet-picker">
      <ul className="comet-list">
        {comets.map((comet) => (
          <li key={comet.name}>
            <button
              type="button"
              className={comet.name === selected ? 'active' : ''}
              aria-pressed={comet.name === selected}
              onClick={() => onSelect(comet.name === selected ? null : comet.name)}
            >
              {comet.name} ({comet.designation})
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <button type="button" className="perihelion-button" onClick={onJumpToPerihelion}>
          Jump to perihelion
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire into App**

In `src/App.tsx`, pull the new fields from the hook and render the picker when enabled:

```tsx
import { useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { COMETS } from './sim/data';
import { dateInputToSimDays } from './sim/formatDate';
import { CometPicker } from './ui/CometPicker';
import { DateDisplay } from './ui/DateDisplay';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const {
    multiplier, paused, mode, date, setMultiplier, togglePause, setMode, seekToDate, goToToday,
    cometsEnabled, selectedComet, setCometsEnabled, selectComet, jumpToPerihelion,
  } = useSimulation(canvasRef);

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
        cometsEnabled={cometsEnabled}
        onToggleComets={() => setCometsEnabled(!cometsEnabled)}
      />
      {cometsEnabled && (
        <CometPicker
          comets={COMETS.map((c) => ({ name: c.name, designation: c.designation }))}
          selected={selectedComet}
          onSelect={selectComet}
          onJumpToPerihelion={jumpToPerihelion}
        />
      )}
      <DateDisplay
        date={date}
        onSelectDate={(value) => seekToDate(dateInputToSimDays(value))}
        onToday={goToToday}
      />
    </div>
  );
}
```

- [ ] **Step 6: Add picker styling**

Append to `src/styles.css` (match existing toolbar/date-controls positioning conventions in that file — inspect first for the pattern used):

```css
.comet-picker {
  position: absolute;
  top: 4rem;
  left: 1rem;
  max-height: 60vh;
  overflow-y: auto;
  background: rgba(10, 14, 26, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 0.5rem;
}

.comet-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.comet-picker button {
  width: 100%;
  text-align: left;
}

.comet-picker button.active {
  background: rgba(90, 220, 130, 0.25);
}

.perihelion-button {
  margin-top: 0.5rem;
  width: 100%;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- Toolbar CometPicker`
Expected: PASS.

- [ ] **Step 8: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS; type-check + production build succeed.

- [ ] **Step 9: Commit**

```bash
git add src/ui/Toolbar.tsx src/ui/Toolbar.test.tsx src/ui/CometPicker.tsx src/ui/CometPicker.test.tsx src/App.tsx src/styles.css
git commit -m "feat: add Comets toggle and comet picker UI"
```

---

### Task 10: Documentation

Update `AGENTS.md` and `README.md` to describe the comets layer.

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: Update AGENTS.md**

Add a "Comets" subsection under the orbital-model / directory documentation covering: the toggle + picker, the `CometSpec`/`COMETS` data, the three orbit classes and green/red path coloring, the high-e Kepler + hyperbolic solvers, mean motion via Gauss's constant, `Tp`-based positioning, per-class path windowing + auto-framing, jump-to-perihelion, and the 2D ecliptic-flattening simplification. Mention new files: `src/sim/hyperbolicOrbit.ts`, `src/sim/cometOrbit.ts`, `src/ui/CometPicker.tsx`.

- [ ] **Step 2: Update README.md**

Add a short user-facing note: turn on Comets, pick one of 15 famous comets to focus/frame its orbit (green = returns, red = one-time pass), and use "Jump to perihelion" to see its closest approach.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: document the comets toggle, picker, and orbit model"
```

---

## Self-Review

**Spec coverage:**
- Toggle off by default → Task 8 (state), Task 9 (UI). ✓
- 15 scored comets → Task 3. ✓
- Short/long/hyperbolic classes + green/red → Tasks 3 (class), 5 (path window), 6 (color), 7 (render). ✓
- Pick-one-to-focus + picker → Tasks 8, 9. ✓
- Auto-frame on select → Task 8 (`cometExtent` + `pendingCometFrameRef`). ✓
- Auto-switch to To Scale → Task 8 (`selectComet`). ✓
- Real current-date position, moves with clock → Tasks 4, 6, 8 (RAF pushes `cometBody`). ✓
- Exaggerated body (~3 units) + anti-sunward tail + label → Tasks 3 (radius), 7 (render). ✓
- Jump-to-perihelion → Tasks 8, 9. ✓
- High-e Kepler solver → Task 1. ✓
- Unified mean motion via Gauss's constant → Task 4. ✓
- Hyperbolic branch → Tasks 2, 4. ✓
- Path sampler with per-class windows → Task 5. ✓
- 2D ecliptic flattening (ϖ = Ω + ω, retrograde flag) → Tasks 3, 4. ✓
- Off = unchanged behavior → Task 8 (refs gate all comet work; `cometPath` null when disabled). ✓
- Testing plan → each task is TDD; data integrity in Task 3; solver/position/path in Tasks 1–5. ✓
- Docs → Task 10. ✓

**Placeholder scan:** No TBD/TODO. The one "inspect the file first" notes (Tasks 7, 8, 9 test helpers / styles.css) point at reusing existing, concrete patterns in named files — not deferred design. Test bodies and implementation code are provided in full.

**Type consistency:** `CometSpec` fields are identical across Tasks 3, 4, 6, 8. `cometPositionAu`/`cometPathAu`/`meanMotion` signatures match between Tasks 4/5 (producer) and Task 6 (consumer). `CometPathRender { points; color }` defined in Task 6, consumed in Tasks 7/8. `cometBody`/`cometPath`/`cometExtent` names consistent Tasks 6→8. Hook fields (`cometsEnabled`, `selectedComet`, `setCometsEnabled`, `selectComet`, `jumpToPerihelion`) consistent Tasks 8→9. `Toolbar` props (`cometsEnabled`, `onToggleComets`) consistent Task 9. Path color union `'green' | 'red'` consistent Tasks 6/7.
