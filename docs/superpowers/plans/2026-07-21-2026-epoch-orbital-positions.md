# 2026 Epoch Orbital Positions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start the simulation at `2026-01-01 00:00 UTC` with JPL-derived orbital angles for all eight planets and Earth's Moon while preserving constant-speed circular motion.

**Architecture:** Keep elapsed simulation time as `simDays = 0` at the new epoch. Store static epoch angles in the existing planet and moon data records, add the angle as an offset in the pure orbital helper, and have `Simulation.snapshot()` pass each body's offset into that helper. Change only date formatting and simulation-core data/math; rendering, layout, controls, and input handling remain unchanged.

**Tech Stack:** TypeScript 5.6, React 18, Vite 5, Vitest 2, JPL Horizons static source data.

## Global Constraints

- Follow the approved spec: `docs/superpowers/specs/2026-07-21-2026-epoch-orbital-positions-design.md`.
- Keep `src/sim/` pure: no DOM, React, Canvas API, runtime network calls, or JPL API calls.
- Keep all orbits circular and coplanar with the existing stylized radii.
- Preserve existing sidereal periods, speed controls, pausing, retrograde behavior, layout, rendering, zoom, pan, and touch interaction.
- Calibrate only the eight planets and Earth's Moon; the other 97 moons retain zero epoch phase.
- Use J2000 ecliptic geometric longitudes at `2026-01-01 00:00 UTC` from the approved spec.
- Use `toBeCloseTo` for floating-point assertions.
- Add no runtime dependencies.
- Follow strict red-green TDD: run each new test and observe the expected failure before writing production code.

---

## File Structure

- Modify `src/sim/types.ts` to add epoch-angle fields to `PlanetSpec` and `MoonSpec`.
- Modify `src/sim/data.ts` to store the verified JPL epoch angles.
- Modify `src/sim/data.test.ts` to lock down the static phase table and Moon-only calibration scope.
- Modify `src/sim/orbits.ts` to add an initial phase to `angleAt`.
- Modify `src/sim/orbits.test.ts` to test phase-aware angle calculation and compatibility with zero phase.
- Modify `src/sim/simulation.ts` to apply body phases when producing snapshots.
- Modify `src/sim/simulation.test.ts` to verify initial planet and Moon positions and continued orbital behavior.
- Modify `src/sim/formatDate.ts` to use the 2026 midnight UTC epoch.
- Modify `src/sim/formatDate.test.ts` to verify date rollover from the new epoch.

No files are created in `src/`; the existing boundaries already fit the change.

---

### Task 1: Add Verified Epoch Phase Data

**Files:**
- Modify: `src/sim/types.ts:1-16`
- Modify: `src/sim/data.ts:1-40`
- Test: `src/sim/data.test.ts:1-75`

**Interfaces:**
- Consumes: the existing `PlanetSpec` and `MoonSpec` data-table structure.
- Produces: required `PlanetSpec.epochAngleRad: number` and optional `MoonSpec.epochAngleRad?: number` for later snapshot calculations.

- [ ] **Step 1: Add failing tests for the JPL phase table**

In `src/sim/data.test.ts`, add these constants after `EXPECTED_MOON_COUNTS`:

```ts
const DEG_TO_RAD = Math.PI / 180;

const EXPECTED_PLANET_EPOCH_ANGLES_DEG: Record<string, number> = {
  Mercury: 242.262456669,
  Venus: 277.021284224,
  Earth: 100.209656729,
  Mars: 283.796552295,
  Jupiter: 108.967359114,
  Saturn: 1.552905047,
  Uranus: 59.539656457,
  Neptune: 0.995246704,
};
```

Add these tests inside `describe('data tables', ...)`:

```ts
it('stores the JPL epoch angle for every planet', () => {
  for (const planet of PLANETS) {
    expect(planet.epochAngleRad, planet.name).toBeCloseTo(
      EXPECTED_PLANET_EPOCH_ANGLES_DEG[planet.name] * DEG_TO_RAD,
      10,
    );
  }
});

it("calibrates only Earth's Moon", () => {
  const calibratedMoons = MOONS.filter((moon) => moon.epochAngleRad !== undefined);
  expect(calibratedMoons.map((moon) => moon.name)).toEqual(['Moon']);
  expect(calibratedMoons[0].epochAngleRad).toBeCloseTo(66.351233998 * DEG_TO_RAD, 10);
});
```

- [ ] **Step 2: Run the data tests and verify the new assertions fail**

Run:

```bash
npm test -- src/sim/data.test.ts
```

Expected: FAIL because planet `epochAngleRad` values are `undefined` and no moon is calibrated.

- [ ] **Step 3: Extend the simulation data types**

Update the interfaces in `src/sim/types.ts` to exactly:

```ts
export interface PlanetSpec {
  name: string;
  /** Sidereal orbital period in days. */
  periodDays: number;
  /** J2000 ecliptic longitude in radians at 2026-01-01 00:00 UTC. */
  epochAngleRad: number;
  /** Display radius in world units (px at zoom 1). */
  bodyRadius: number;
  color: string;
}

export interface MoonSpec {
  name: string;
  /** Parent planet name - must match a PlanetSpec.name. */
  parent: string;
  /** Sidereal orbital period in days; negative = retrograde. */
  periodDays: number;
  /** Optional J2000 ecliptic longitude in radians at the simulation epoch. */
  epochAngleRad?: number;
}
```

Keep `BodyPosition` unchanged below these interfaces.

- [ ] **Step 4: Add the verified epoch values to the data table**

In `src/sim/data.ts`, add this constant below the imports:

```ts
const DEG_TO_RAD = Math.PI / 180;
```

Replace `PLANETS` with:

```ts
export const PLANETS: PlanetSpec[] = [
  {
    name: 'Mercury',
    periodDays: 87.9691,
    epochAngleRad: 242.262456669 * DEG_TO_RAD,
    bodyRadius: 4,
    color: '#9c8e82',
  },
  {
    name: 'Venus',
    periodDays: 224.701,
    epochAngleRad: 277.021284224 * DEG_TO_RAD,
    bodyRadius: 6,
    color: '#e3bb76',
  },
  {
    name: 'Earth',
    periodDays: 365.256,
    epochAngleRad: 100.209656729 * DEG_TO_RAD,
    bodyRadius: 6,
    color: '#4d9de0',
  },
  {
    name: 'Mars',
    periodDays: 686.98,
    epochAngleRad: 283.796552295 * DEG_TO_RAD,
    bodyRadius: 5,
    color: '#c1440e',
  },
  {
    name: 'Jupiter',
    periodDays: 4332.589,
    epochAngleRad: 108.967359114 * DEG_TO_RAD,
    bodyRadius: 14,
    color: '#d8a25e',
  },
  {
    name: 'Saturn',
    periodDays: 10759.22,
    epochAngleRad: 1.552905047 * DEG_TO_RAD,
    bodyRadius: 12,
    color: '#e0c38b',
  },
  {
    name: 'Uranus',
    periodDays: 30688.5,
    epochAngleRad: 59.539656457 * DEG_TO_RAD,
    bodyRadius: 9,
    color: '#7dd3d8',
  },
  {
    name: 'Neptune',
    periodDays: 60182,
    epochAngleRad: 0.995246704 * DEG_TO_RAD,
    bodyRadius: 9,
    color: '#5b7fd4',
  },
];
```

Add `epochAngleRad` only to the existing Earth Moon entry:

```ts
{ name: 'Moon', parent: 'Earth', periodDays: 27.3217, epochAngleRad: 66.351233998 * DEG_TO_RAD },
```

Do not add an epoch angle to any other moon.

- [ ] **Step 5: Run the focused data tests**

Run:

```bash
npm test -- src/sim/data.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 6: Type-check the required and optional fields**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no type errors.

- [ ] **Step 7: Commit the epoch data**

```bash
git add src/sim/types.ts src/sim/data.ts src/sim/data.test.ts
git commit -m "feat: add 2026 orbital epoch phases"
```

---

### Task 2: Support Initial Phase In Orbital Math

**Files:**
- Modify: `src/sim/orbits.ts:3-9`
- Test: `src/sim/orbits.test.ts:1-24`

**Interfaces:**
- Consumes: orbital periods, elapsed `simDays`, and radian epoch angles from Task 1.
- Produces: `angleAt(periodDays: number, simDays: number, epochAngleRad?: number): number` with a zero default.

- [ ] **Step 1: Add failing phase-offset tests**

Add these tests inside `describe('angleAt', ...)` in `src/sim/orbits.test.ts`:

```ts
it('returns the epoch phase at day 0', () => {
  expect(angleAt(100, 0, 0.75)).toBeCloseTo(0.75, 10);
});

it('adds elapsed orbital motion to the epoch phase', () => {
  expect(angleAt(100, 25, 0.75)).toBeCloseTo(0.75 + Math.PI / 2, 10);
});
```

Keep the existing zero-phase and retrograde tests unchanged. They verify that
the optional argument remains backward-compatible and that negative periods
still reverse only the elapsed-motion term.

- [ ] **Step 2: Run the orbital tests and verify the new assertions fail**

Run:

```bash
npm test -- src/sim/orbits.test.ts
```

Expected: FAIL because the current two-argument implementation ignores the epoch phase.

- [ ] **Step 3: Implement the phase-aware helper**

Replace the `angleAt` comment and implementation in `src/sim/orbits.ts` with:

```ts
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
```

Do not normalize the result; `orbitalPosition` passes it directly to `sin` and
`cos`, which support unbounded radians.

- [ ] **Step 4: Run the focused orbital tests**

Run:

```bash
npm test -- src/sim/orbits.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit the orbital helper change**

```bash
git add src/sim/orbits.ts src/sim/orbits.test.ts
git commit -m "feat: offset orbital motion by epoch phase"
```

---

### Task 3: Apply Epoch Phases To Simulation Snapshots

**Files:**
- Modify: `src/sim/simulation.ts:28-50`
- Test: `src/sim/simulation.test.ts:1-58`

**Interfaces:**
- Consumes: `PlanetSpec.epochAngleRad`, `MoonSpec.epochAngleRad`, and the phase-aware `angleAt` from Tasks 1-2.
- Produces: snapshots with calibrated planet positions and calibrated Earth-Moon relative position at `simDays = 0`.

- [ ] **Step 1: Define expected snapshot angles in the test**

Add these constants and helpers after `advanceDays` in `src/sim/simulation.test.ts`:

```ts
const DEG_TO_RAD = Math.PI / 180;

const EXPECTED_PLANET_EPOCH_ANGLES_DEG: Record<string, number> = {
  Mercury: 242.262456669,
  Venus: 277.021284224,
  Earth: 100.209656729,
  Mars: 283.796552295,
  Jupiter: 108.967359114,
  Saturn: 1.552905047,
  Uranus: 59.539656457,
  Neptune: 0.995246704,
};

function normalizedAngle(y: number, x: number): number {
  const angle = Math.atan2(y, x);
  return angle < 0 ? angle + 2 * Math.PI : angle;
}
```

- [ ] **Step 2: Replace the aligned-body test with calibrated-position tests**

Remove the existing test named `starts all bodies aligned on the +x axis at day 0`.

Add these three tests in its place:

```ts
it('starts every planet at its JPL epoch longitude', () => {
  const bodies = new Simulation().snapshot().bodies;

  for (const [name, expectedDegrees] of Object.entries(EXPECTED_PLANET_EPOCH_ANGLES_DEG)) {
    const planet = bodies.find((body) => body.name === name)!;
    expect(normalizedAngle(planet.y, planet.x), name).toBeCloseTo(
      expectedDegrees * DEG_TO_RAD,
      9,
    );
  }
});

it("starts Earth's Moon at its JPL geocentric epoch longitude", () => {
  const bodies = new Simulation().snapshot().bodies;
  const earth = bodies.find((body) => body.name === 'Earth')!;
  const moon = bodies.find((body) => body.name === 'Moon')!;

  expect(normalizedAngle(moon.y - earth.y, moon.x - earth.x)).toBeCloseTo(
    66.351233998 * DEG_TO_RAD,
    9,
  );
});

it('keeps uncalibrated moons at zero relative phase', () => {
  const bodies = new Simulation().snapshot().bodies;
  const mars = bodies.find((body) => body.name === 'Mars')!;
  const phobos = bodies.find((body) => body.name === 'Phobos')!;

  expect(phobos.y - mars.y).toBeCloseTo(0, 10);
  expect(phobos.x - mars.x).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Make the Earth-period assertion independent of zero phase**

Replace the existing `Earth completes exactly one revolution per Earth year`
test with:

```ts
it('returns Earth to its epoch position after one Earth year', () => {
  const sim = new Simulation();
  const initialEarth = sim.snapshot().bodies.find((body) => body.name === 'Earth')!;

  advanceDays(sim, 365.256);
  const earth = sim.snapshot().bodies.find((body) => body.name === 'Earth')!;
  const radius = sim.layout.planets.Earth.orbitRadius;

  expect(Math.hypot(earth.x, earth.y)).toBeCloseTo(radius, 5);
  expect(earth.x).toBeCloseTo(initialEarth.x, 5);
  expect(earth.y).toBeCloseTo(initialEarth.y, 5);
});
```

- [ ] **Step 4: Run the simulation tests and verify calibrated positions fail**

Run:

```bash
npm test -- src/sim/simulation.test.ts
```

Expected: FAIL in the planet and Earth-Moon epoch-angle tests because
`Simulation.snapshot()` still calls `angleAt` without the stored offsets. The
uncalibrated moon and revised full-period tests may already pass.

- [ ] **Step 5: Pass epoch phases into snapshot calculations**

In `src/sim/simulation.ts`, replace the planet position calculation with:

```ts
const pos = orbitalPosition(
  0,
  0,
  orbitRadius,
  angleAt(planet.periodDays, simDays, planet.epochAngleRad),
);
```

Replace the moon position calculation with:

```ts
const mpos = orbitalPosition(
  pos.x,
  pos.y,
  ring,
  angleAt(moon.periodDays, simDays, moon.epochAngleRad),
);
```

No other snapshot fields or loops change.

- [ ] **Step 6: Run the focused simulation tests**

Run:

```bash
npm test -- src/sim/simulation.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 7: Run all simulation-core tests**

Run:

```bash
npm test -- src/sim
```

Expected: PASS for all test files under `src/sim/`.

- [ ] **Step 8: Commit snapshot phase integration**

```bash
git add src/sim/simulation.ts src/sim/simulation.test.ts
git commit -m "feat: initialize bodies at 2026 positions"
```

---

### Task 4: Move The Displayed Date Epoch To 2026

**Files:**
- Modify: `src/sim/formatDate.ts:1-5`
- Test: `src/sim/formatDate.test.ts:1-29`

**Interfaces:**
- Consumes: elapsed `simDays` from `SimClock`, unchanged from prior tasks.
- Produces: `formatSimDate(simDays: number): string` anchored to `2026-01-01 00:00 UTC`.

- [ ] **Step 1: Replace date expectations with the new epoch**

Replace the tests in `src/sim/formatDate.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { formatSimDate } from './formatDate';

describe('formatSimDate', () => {
  it('formats the epoch as 2026-01-01', () => {
    expect(formatSimDate(0)).toBe('2026-01-01');
  });

  it('advances one calendar day per sim day', () => {
    expect(formatSimDate(1)).toBe('2026-01-02');
  });

  it('rolls over months', () => {
    expect(formatSimDate(31)).toBe('2026-02-01');
  });

  it('handles the 2028 leap day', () => {
    expect(formatSimDate(789)).toBe('2028-02-29');
    expect(formatSimDate(1096)).toBe('2029-01-01');
  });

  it('starts at midnight, so the date flips after a whole simulated day', () => {
    expect(formatSimDate(0.999)).toBe('2026-01-01');
    expect(formatSimDate(1)).toBe('2026-01-02');
  });

  it('handles large values', () => {
    expect(formatSimDate(10000)).toBe('2053-05-19');
  });
});
```

- [ ] **Step 2: Run the date tests and verify they fail against J2000**

Run:

```bash
npm test -- src/sim/formatDate.test.ts
```

Expected: FAIL because `formatSimDate(0)` still returns `2000-01-01` and the old
epoch starts at noon.

- [ ] **Step 3: Change the date epoch to midnight in 2026**

Replace the epoch and function comment at the top of `src/sim/formatDate.ts` with:

```ts
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const MS_PER_DAY = 86_400_000;

/** Formats 2026-01-01 00:00 UTC + simDays as YYYY-MM-DD. */
```

Keep the existing `formatSimDate` function body unchanged.

- [ ] **Step 4: Run the focused date tests**

Run:

```bash
npm test -- src/sim/formatDate.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit the date epoch change**

```bash
git add src/sim/formatDate.ts src/sim/formatDate.test.ts
git commit -m "feat: start simulation date in 2026"
```

---

### Task 5: Verify The Complete Feature

**Files:**
- Verify only; no expected source changes.

**Interfaces:**
- Consumes: the complete 2026 epoch implementation from Tasks 1-4.
- Produces: verification evidence that the feature integrates without regressions.

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

Expected: TypeScript reports no errors and Vite completes the production build.

- [ ] **Step 3: Check formatting and final scope**

Run:

```bash
git diff --check master...HEAD
git status --short
```

Expected: `git diff --check` prints nothing; `git status --short` prints nothing.

- [ ] **Step 4: Manually inspect the initial scene**

Run:

```bash
npm run dev
```

Open the local Vite URL and verify:

1. The initial date reads `2026-01-01`.
2. The planets are visibly distributed around the Sun rather than aligned.
3. Earth appears near 100 degrees and its Moon appears near 66 degrees relative to Earth.
4. Time advances continuously with the existing circular motion.
5. Pause, speed controls, mouse input, and touch input still respond.

Stop the development server after verification. No commit is needed unless a
real defect is found; if one is found, add a failing regression test before the
fix and commit that fix separately.

---

## Completion Checklist

- Eight planet records contain the approved JPL epoch angles.
- Only Earth's Moon contains a calibrated moon epoch angle.
- `angleAt` applies the epoch offset while retaining a zero default.
- Snapshot generation uses planet and moon offsets.
- Date formatting begins at midnight UTC on `2026-01-01`.
- Circular radii, periods, retrograde behavior, and all non-simulation layers remain unchanged.
- Focused tests, full tests, TypeScript checking, and production build pass.
