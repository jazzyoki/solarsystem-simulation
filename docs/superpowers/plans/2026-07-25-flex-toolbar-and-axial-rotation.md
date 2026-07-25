# Flex Toolbar Layout + 3D Axial Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the toolbar wrap instead of overflowing narrow viewports, and make the Sun and all nine planets rotate about their real tilted axes in the 3D view whenever the speed scale is below `1s = 1 month`.

**Architecture:** Part A moves `.toolbar` and `.picker-column` into one absolutely positioned `.left-stack` flex column so the toolbar can wrap without colliding with the pickers. Part B adds `rotationPeriodDays` + `obliquityRad` to the body data, derives a spin angle as a pure function of `simDays` in a new `src/sim/rotation.ts`, carries it through `BodySnapshot3D`, and applies it in the 3D renderer as a static tilt on each body group plus a per-frame `rotation.z` on its sphere.

**Tech Stack:** React 18, TypeScript, Vite, Three.js (`src/render3d` only), Vitest + @testing-library/react + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-25-flex-toolbar-and-axial-rotation-design.md`

## Global Constraints

- **`rotationPeriodDays` is ALWAYS POSITIVE.** Retrograde spin is expressed *only* through `obliquityRad > π/2` (IAU convention). Never encode retrograde spin as a negative period — the repo's *orbital* convention (`MoonSpec.periodDays` signed) does not apply to rotation. Venus with both a negative period and its 177.36° tilt would double-count and spin the wrong way.
- Rotation data (period in days / obliquity in degrees): Sun 25.38 / 7.25 · Mercury 58.646 / 0.034 · Venus 243.025 / 177.36 · Earth 0.99727 / 23.44 · Mars 1.02596 / 25.19 · Jupiter 0.41354 / 3.13 · Saturn 0.44401 / 26.73 · Uranus 0.71833 / 97.77 · Neptune 0.67125 / 28.32 · Pluto 6.38723 / 122.53.
- The spin angle is a **pure function of `simDays`**, never an accumulator.
- Spin applies only while the speed multiplier is **below** `2_592_000` (`1s = 1 month`); at or above it the spin **freezes at its last angle** (skip the write — do not reset to zero).
- Axial tilt is static geometry and applies at **every** speed, including when the spin is frozen.
- Only the Sun and the nine `PLANETS` spin. Moons and comets report `spinRad: 0` and `obliquityRad: 0`.
- Saturn's ring keeps its current on-screen orientation and must **not** spin with the planet.
- Nothing under `src/render/` (the 2D renderer) changes; `BodySnapshot` (2D) is untouched.
- Three.js must not be imported outside `src/render3d/`.
- Run tests with `npm test` and the type-check/build with `npm run build`. `tsconfig.json` includes `src`, so test files are type-checked too.
- `src/staticAssets.test.ts` has a **pre-existing, unrelated failure** (a social-preview PNG byte comparison sensitive to Windows font rendering). It fails identically on `master`. If it is the only failure, the suite counts as green; never "fix" it.

---

### Task 1: Flex toolbar layout (Part A)

Part A has **no automated test** — jsdom performs no layout and does not compute `pointer-events`, so neither the wrap nor the drag-through behavior is assertable. This is a deliberate spec decision, not an omission. The gate for this task is: the full suite stays green, `npm run build` is clean, and the CSS/markup is correct by inspection against the three load-bearing details called out below.

**Files:**
- Modify: `src/App.tsx:48-60` (wrap `<Toolbar>` + `.picker-column` in `.left-stack`)
- Modify: `src/styles.css:34-40` (`.toolbar`), `src/styles.css:142-150` (`.picker-column`), and add `.left-stack`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks. Part B does not touch the toolbar or CSS.

- [ ] **Step 1: Wrap the toolbar and picker column in a stack container**

In `src/App.tsx`, the returned JSX currently has `<Toolbar .../>` followed by a sibling `<div className="picker-column">`. Wrap exactly those two in a new stack div, leaving the two `<canvas>` elements and `<DateDisplay>` as siblings of the stack:

```tsx
      <div className="left-stack">
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
        <div className="picker-column">
          {mode === 'threeD' && (
            <PlanetPicker planets={FOCUSABLE_BODIES} selected={focusedBody} onSelect={selectBody} />
          )}
          {cometsEnabled && (
            <CometPicker
              comets={COMETS.map((c) => ({ name: c.name, designation: c.designation, note: c.note }))}
              selected={selectedComet}
              onSelect={selectComet}
              onJumpToPerihelion={jumpToPerihelion}
            />
          )}
        </div>
      </div>
```

- [ ] **Step 2: Move the positioning into `.left-stack` and let the toolbar wrap**

In `src/styles.css`, replace the `.toolbar` rule:

```css
.toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 6px;
}
```

with the stack plus a wrapping, in-flow toolbar:

```css
/*
 * Owns the top-left position for the toolbar + picker column so the toolbar
 * can wrap to a second row without the pickers colliding with it.
 * - max-width is what forces the wrap; without it this shrink-to-fit stack
 *   would keep growing past the viewport edge.
 * - align-items: flex-start keeps both children at their content width; the
 *   default stretch would widen the pickers to the toolbar's width.
 * - pointer-events: none is required, not cosmetic: this box now spans the
 *   union of both children, and a transparent container would swallow canvas
 *   drags in the empty area beside the narrower picker column.
 */
.left-stack {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: calc(100% - 24px);
  align-items: flex-start;
  pointer-events: none;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  pointer-events: auto;
}
```

Then replace the `.picker-column` rule:

```css
.picker-column {
  position: absolute;
  top: 52px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
```

with the in-flow version (the hardcoded `top: 52px`, which assumed a one-row toolbar, is gone):

```css
.picker-column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  pointer-events: auto;
}
```

Change nothing else in the file. The `@media (max-width: 640px)` block needs no edit — it only hides `.toolbar-separator` and repositions `.date-controls`.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS except the pre-existing `src/staticAssets.test.ts` failure. No other suite changes — no test asserts on this markup.

- [ ] **Step 4: Type-check and build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/styles.css
git commit -m "fix: let the toolbar wrap and keep the picker column below it"
```

---

### Task 2: Rotation data, spin math, and the speed cutoff

**Files:**
- Modify: `src/sim/types.ts:6-25` (`PlanetSpec` gains two fields)
- Modify: `src/sim/data.ts:9` (`SUN`) and each of the nine entries in `PLANETS` (`src/sim/data.ts:36-145`)
- Create: `src/sim/rotation.ts`
- Create: `src/sim/rotation.test.ts`
- Modify: `src/sim/clock.ts` (append the cutoff constant + predicate)
- Modify: `src/sim/data.test.ts` (add expectation tables + four tests)
- Modify: `src/sim/clock.test.ts` (add an `axialSpinEnabled` describe block)

**Interfaces:**
- Consumes: `SPEED_MULTIPLIERS` and `SpeedMultiplier` from `src/sim/clock.ts` (already present: the readonly tuple `[1200, 3600, 21600, 43200, 86400, 2592000, 7776000, 31536000, 94608000]` and the union derived from it).
- Produces:
  - `PlanetSpec.rotationPeriodDays: number` and `PlanetSpec.obliquityRad: number`
  - `SUN.rotationPeriodDays` / `SUN.obliquityRad`
  - `axialSpinRad(simDays: number, rotationPeriodDays: number): number` from `src/sim/rotation.ts`
  - `AXIAL_SPIN_MAX_MULTIPLIER: number` (= `2_592_000`) and `axialSpinEnabled(multiplier: SpeedMultiplier): boolean` from `src/sim/clock.ts`

- [ ] **Step 1: Write the failing spin-math test**

Create `src/sim/rotation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { axialSpinRad } from './rotation';

const TWO_PI = Math.PI * 2;

describe('axialSpinRad', () => {
  it('is zero at the epoch', () => {
    expect(axialSpinRad(0, 0.99727)).toBe(0);
  });

  it('advances a quarter turn in a quarter period', () => {
    expect(axialSpinRad(0.25, 1)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('wraps a whole turn back to zero rather than 2pi', () => {
    expect(axialSpinRad(1, 1)).toBeCloseTo(0, 12);
    expect(axialSpinRad(10, 1)).toBeCloseTo(0, 12);
  });

  it('keeps large day counts inside [0, 2pi)', () => {
    for (const simDays of [1234.5678, 90_000, 1e6]) {
      const angle = axialSpinRad(simDays, 0.41354);
      expect(angle, `simDays ${simDays}`).toBeGreaterThanOrEqual(0);
      expect(angle, `simDays ${simDays}`).toBeLessThan(TWO_PI);
    }
  });

  it('wraps pre-epoch (negative) days into [0, 2pi) instead of returning a negative angle', () => {
    // Dates before the 2026 epoch give a negative simDays.
    expect(axialSpinRad(-0.25, 1)).toBeCloseTo((3 * Math.PI) / 2, 12);
    const angle = axialSpinRad(-5000.5, 1.02596);
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(TWO_PI);
  });

  it('returns 0 for a zero period instead of NaN', () => {
    expect(axialSpinRad(123, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/sim/rotation.test.ts`
Expected: FAIL — cannot resolve `./rotation`.

- [ ] **Step 3: Implement the spin math**

Create `src/sim/rotation.ts`:

```ts
const TWO_PI = Math.PI * 2;

/**
 * Axial spin angle in radians for a body at simDays, wrapped into [0, 2pi).
 *
 * A pure function of simDays rather than an accumulator, so seeking a date,
 * pausing, or switching view modes always yields the same orientation for the
 * same date. Reducing turns before scaling keeps precision at large simDays.
 *
 * rotationPeriodDays is always positive (see PlanetSpec): retrograde spin is
 * expressed through obliquity > pi/2, never a negative period. A 0 period
 * returns 0 rather than NaN, which would silently make a body vanish.
 */
export function axialSpinRad(simDays: number, rotationPeriodDays: number): number {
  if (rotationPeriodDays === 0) return 0;
  const angle = ((simDays / rotationPeriodDays) % 1) * TWO_PI;
  return angle < 0 ? angle + TWO_PI : angle;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- src/sim/rotation.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing data tests**

In `src/sim/data.test.ts`, add `SUN` to the existing import from `./data` (it currently imports `ASTEROID_BELT, AU_TO_WORLD, COMETS, MOONS, PLANETS`), then add these tables beside the existing `EXPECTED_*` tables:

```ts
const EXPECTED_ROTATION_PERIOD_DAYS: Record<string, number> = {
  Mercury: 58.646,
  Venus: 243.025,
  Earth: 0.99727,
  Mars: 1.02596,
  Jupiter: 0.41354,
  Saturn: 0.44401,
  Uranus: 0.71833,
  Neptune: 0.67125,
  Pluto: 6.38723,
};

const EXPECTED_OBLIQUITY_DEG: Record<string, number> = {
  Mercury: 0.034,
  Venus: 177.36,
  Earth: 23.44,
  Mars: 25.19,
  Jupiter: 3.13,
  Saturn: 26.73,
  Uranus: 97.77,
  Neptune: 28.32,
  Pluto: 122.53,
};

/** The only bodies whose spin is retrograde — encoded as obliquity > 90 deg. */
const RETROGRADE_SPINNERS = ['Venus', 'Uranus', 'Pluto'];
```

and these four tests inside the existing `describe('data tables', ...)` block:

```ts
  it('stores each planet sidereal rotation period', () => {
    for (const [name, days] of Object.entries(EXPECTED_ROTATION_PERIOD_DAYS)) {
      expect(PLANETS.find((p) => p.name === name)!.rotationPeriodDays, name).toBeCloseTo(days, 10);
    }
  });

  it('stores each planet axial tilt', () => {
    for (const [name, deg] of Object.entries(EXPECTED_OBLIQUITY_DEG)) {
      expect(PLANETS.find((p) => p.name === name)!.obliquityRad, name).toBeCloseTo(
        deg * DEG_TO_RAD,
        12,
      );
    }
  });

  it('keeps every rotation period positive, so retrograde spin lives in obliquity alone', () => {
    for (const p of PLANETS) {
      expect(Number.isFinite(p.rotationPeriodDays), p.name).toBe(true);
      expect(p.rotationPeriodDays, p.name).toBeGreaterThan(0);
    }
    expect(SUN.rotationPeriodDays).toBeGreaterThan(0);
  });

  it('keeps obliquity within [0, pi], retrograde for exactly Venus, Uranus and Pluto', () => {
    for (const p of PLANETS) {
      expect(p.obliquityRad, p.name).toBeGreaterThanOrEqual(0);
      expect(p.obliquityRad, p.name).toBeLessThanOrEqual(Math.PI);
      expect(p.obliquityRad > Math.PI / 2, p.name).toBe(RETROGRADE_SPINNERS.includes(p.name));
    }
    expect(SUN.obliquityRad).toBeCloseTo(7.25 * DEG_TO_RAD, 12);
    expect(SUN.rotationPeriodDays).toBeCloseTo(25.38, 10);
  });
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npm test -- src/sim/data.test.ts`
Expected: FAIL — `rotationPeriodDays` and `obliquityRad` are `undefined` on every planet.

- [ ] **Step 7: Add the two fields to the type**

In `src/sim/types.ts`, add to `PlanetSpec` (after `ascendingNodeRad`, before `bodyRadius`):

```ts
  /** Sidereal rotation period in days. Always positive — see obliquityRad. */
  rotationPeriodDays: number;
  /**
   * Axial tilt in radians, IAU convention: a value > pi/2 means the body spins
   * retrograde. Never encode retrograde spin as a negative rotation period;
   * the two would cancel. Applied relative to the ecliptic (a stylization: the
   * real value is relative to the body's own orbital plane).
   */
  obliquityRad: number;
```

- [ ] **Step 8: Add the rotation data**

In `src/sim/data.ts`, extend `SUN`:

```ts
export const SUN = {
  name: 'Sun',
  bodyRadius: 22,
  color: '#ffcc33',
  rotationPeriodDays: 25.38,
  obliquityRad: 7.25 * DEG_TO_RAD,
} as const;
```

Then add the two fields to each planet in `PLANETS`, inserted after that planet's `ascendingNodeRad` line:

```ts
    // Mercury
    rotationPeriodDays: 58.646,
    obliquityRad: 0.034 * DEG_TO_RAD,
    // Venus — retrograde, expressed as obliquity > 90 deg with a positive period
    rotationPeriodDays: 243.025,
    obliquityRad: 177.36 * DEG_TO_RAD,
    // Earth
    rotationPeriodDays: 0.99727,
    obliquityRad: 23.44 * DEG_TO_RAD,
    // Mars
    rotationPeriodDays: 1.02596,
    obliquityRad: 25.19 * DEG_TO_RAD,
    // Jupiter
    rotationPeriodDays: 0.41354,
    obliquityRad: 3.13 * DEG_TO_RAD,
    // Saturn
    rotationPeriodDays: 0.44401,
    obliquityRad: 26.73 * DEG_TO_RAD,
    // Uranus — retrograde
    rotationPeriodDays: 0.71833,
    obliquityRad: 97.77 * DEG_TO_RAD,
    // Neptune
    rotationPeriodDays: 0.67125,
    obliquityRad: 28.32 * DEG_TO_RAD,
    // Pluto — retrograde
    rotationPeriodDays: 6.38723,
    obliquityRad: 122.53 * DEG_TO_RAD,
```

The `// Planet` comments above are labels identifying which entry each pair belongs to — do not paste them into the file.

- [ ] **Step 9: Run the data tests to verify they pass**

Run: `npm test -- src/sim/data.test.ts`
Expected: PASS.

- [ ] **Step 10: Write the failing cutoff test**

In `src/sim/clock.test.ts`, add `AXIAL_SPIN_MAX_MULTIPLIER` and `axialSpinEnabled` to the existing import from `./clock`, then add a new top-level describe block:

```ts
describe('axialSpinEnabled', () => {
  it('enables spin for the five scales below 1s = 1 month and disables the rest', () => {
    expect(SPEED_MULTIPLIERS.filter((m) => axialSpinEnabled(m))).toEqual([
      1_200, 3_600, 21_600, 43_200, 86_400,
    ]);
    expect(SPEED_MULTIPLIERS.filter((m) => !axialSpinEnabled(m))).toEqual([
      2_592_000, 7_776_000, 31_536_000, 94_608_000,
    ]);
  });

  it('puts the boundary between 1s = 24 h and 1s = 1 month', () => {
    expect(AXIAL_SPIN_MAX_MULTIPLIER).toBe(2_592_000);
    expect(axialSpinEnabled(86_400)).toBe(true);
    expect(axialSpinEnabled(2_592_000)).toBe(false);
  });
});
```

- [ ] **Step 11: Run it to verify it fails**

Run: `npm test -- src/sim/clock.test.ts`
Expected: FAIL — `axialSpinEnabled` is not exported from `./clock`.

- [ ] **Step 12: Implement the cutoff**

Append to `src/sim/clock.ts` (after `DEFAULT_SPEED_MULTIPLIER`, before `SECONDS_PER_DAY`):

```ts
/**
 * Axial rotation in the 3D view stays legible only below 1 simulated month per
 * real second. Above it a fast rotator strobes: Jupiter would spin 72 turns a
 * second at 1s = 1 month, versus 2.4 at 1s = 24 h.
 */
export const AXIAL_SPIN_MAX_MULTIPLIER = 2_592_000;

export function axialSpinEnabled(multiplier: SpeedMultiplier): boolean {
  return multiplier < AXIAL_SPIN_MAX_MULTIPLIER;
}
```

- [ ] **Step 13: Run the clock tests to verify they pass**

Run: `npm test -- src/sim/clock.test.ts`
Expected: PASS.

- [ ] **Step 14: Run the full suite and build**

Run: `npm test && npm run build`
Expected: suite green apart from the pre-existing `src/staticAssets.test.ts` failure; build clean. `PlanetSpec` gained two *required* fields, so a missing entry in `PLANETS` would surface here as a `tsc` error.

- [ ] **Step 15: Commit**

```bash
git add src/sim/types.ts src/sim/data.ts src/sim/data.test.ts src/sim/rotation.ts src/sim/rotation.test.ts src/sim/clock.ts src/sim/clock.test.ts
git commit -m "feat: add axial rotation data, spin math, and the speed cutoff"
```

---

### Task 3: Carry spin and tilt through the 3D snapshot

**Files:**
- Modify: `src/sim/simulation.ts:40-42` (`BodySnapshot3D`), `src/sim/simulation.ts:193-232` (`snapshot3D`), `src/sim/simulation.ts:245-258` (`cometBody3D`), plus the import block at the top
- Modify: `src/sim/simulation.test.ts` (add four tests)
- Modify: `src/render3d/sceneObjects.test.ts:17-22,51-53` (the three `BodySnapshot3D` fixtures must gain the new required fields or `tsc` fails)

**Interfaces:**
- Consumes: `axialSpinRad(simDays, rotationPeriodDays)` from `src/sim/rotation.ts`; `PlanetSpec.rotationPeriodDays` / `.obliquityRad`; `SUN.rotationPeriodDays` / `.obliquityRad`.
- Produces: `BodySnapshot3D.spinRad: number` and `BodySnapshot3D.obliquityRad: number` — required fields, `0` for moons and comets. Task 4's renderer reads both.

- [ ] **Step 1: Write the failing snapshot tests**

In `src/sim/simulation.test.ts`, add these four tests inside the existing top-level `describe` that holds the other `snapshot3D` tests. `advanceDays`, `DEG_TO_RAD`, `PLANETS`, and `COMETS` are already available in that file.

```ts
  it('snapshot3D reports zero spin for every body at the epoch', () => {
    for (const body of new Simulation().snapshot3D().bodies) {
      expect(body.spinRad, body.name).toBe(0);
    }
  });

  it('snapshot3D advances each body spin at its own sidereal rate', () => {
    const sim = new Simulation();
    const earthSpec = PLANETS.find((p) => p.name === 'Earth')!;
    advanceDays(sim, earthSpec.rotationPeriodDays / 4);
    const bodies = sim.snapshot3D().bodies;
    const earth = bodies.find((b) => b.name === 'Earth')!;
    const jupiter = bodies.find((b) => b.name === 'Jupiter')!;
    expect(earth.spinRad).toBeCloseTo(Math.PI / 2, 6);
    // Jupiter turns ~2.4x faster, so a shared/global angle would fail here.
    expect(jupiter.spinRad).not.toBeCloseTo(earth.spinRad, 3);
  });

  it('snapshot3D tilts planets and leaves moons unspun and untilted', () => {
    const sim = new Simulation();
    advanceDays(sim, 10);
    const bodies = sim.snapshot3D().bodies;
    expect(bodies.find((b) => b.name === 'Uranus')!.obliquityRad).toBeCloseTo(
      97.77 * DEG_TO_RAD,
      12,
    );
    expect(bodies.find((b) => b.name === 'Sun')!.spinRad).toBeGreaterThan(0);
    const moon = bodies.find((b) => b.name === 'Moon')!;
    expect(moon.spinRad).toBe(0);
    expect(moon.obliquityRad).toBe(0);
  });

  it('cometBody3D reports no spin or tilt', () => {
    const sim = new Simulation();
    advanceDays(sim, 10);
    const body = sim.cometBody3D(COMETS[0].name)!;
    expect(body.spinRad).toBe(0);
    expect(body.obliquityRad).toBe(0);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- src/sim/simulation.test.ts`
Expected: FAIL — `spinRad` and `obliquityRad` are `undefined` on every snapshot body.

- [ ] **Step 3: Extend `BodySnapshot3D` and populate it**

In `src/sim/simulation.ts`, add the import:

```ts
import { axialSpinRad } from './rotation';
```

Extend the interface:

```ts
export interface BodySnapshot3D extends BodySnapshot {
  z: number;
  /** Axial spin angle in radians at this snapshot's simDays; 0 for moons and comets. */
  spinRad: number;
  /** Axial tilt in radians; 0 for moons and comets. */
  obliquityRad: number;
}
```

In `snapshot3D()`, the Sun entry becomes:

```ts
    const bodies: BodySnapshot3D[] = [
      {
        name: SUN.name,
        x: 0,
        y: 0,
        z: 0,
        bodyRadius: SUN.bodyRadius,
        color: SUN.color,
        kind: 'sun',
        spinRad: axialSpinRad(simDays, SUN.rotationPeriodDays),
        obliquityRad: SUN.obliquityRad,
      },
    ];
```

the planet push becomes:

```ts
      bodies.push({
        name: planet.name,
        ...pos,
        bodyRadius: planet.bodyRadius,
        color: planet.color,
        kind: 'planet',
        spinRad: axialSpinRad(simDays, planet.rotationPeriodDays),
        obliquityRad: planet.obliquityRad,
      });
```

and the moon push gains:

```ts
          kind: 'moon',
          spinRad: 0,
          obliquityRad: 0,
```

In `cometBody3D()`, the returned object gains:

```ts
      kind: 'comet',
      spinRad: 0,
      obliquityRad: 0,
```

- [ ] **Step 4: Run the simulation tests to verify they pass**

Run: `npm test -- src/sim/simulation.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the 3D scene test fixtures**

`BodySnapshot3D`'s new fields are required, so `src/render3d/sceneObjects.test.ts`'s three fixtures no longer type-check. Add a shared constant block above the fixtures and extend them — Task 4 asserts against these same tilt values:

```ts
const DEG_TO_RAD = Math.PI / 180;
const MARS_OBLIQUITY_RAD = 25.19 * DEG_TO_RAD;
const SATURN_OBLIQUITY_RAD = 26.73 * DEG_TO_RAD;

const mars: BodySnapshot3D = {
  name: 'Mars', x: 0, y: 0, z: 0, bodyRadius: 5, color: '#c1440e', kind: 'planet',
  spinRad: 0, obliquityRad: MARS_OBLIQUITY_RAD,
};
const saturn: BodySnapshot3D = {
  name: 'Saturn', x: 0, y: 0, z: 0, bodyRadius: 12, color: '#e0c38b', kind: 'planet',
  spinRad: 0, obliquityRad: SATURN_OBLIQUITY_RAD,
};
```

and the inline comet fixture inside the `'uses an unlit material for sun and comet bodies'` test:

```ts
    const comet: BodySnapshot3D = {
      name: 'Halley', x: 0, y: 0, z: 0, bodyRadius: 3, color: '#dbeeff', kind: 'comet',
      spinRad: 0, obliquityRad: 0,
    };
```

- [ ] **Step 6: Run the full suite and build**

Run: `npm test && npm run build`
Expected: suite green apart from the pre-existing `src/staticAssets.test.ts` failure; build clean. A missed construction site would appear here as a `tsc` error.

- [ ] **Step 7: Commit**

```bash
git add src/sim/simulation.ts src/sim/simulation.test.ts src/render3d/sceneObjects.test.ts
git commit -m "feat: carry axial spin and tilt through the 3D snapshot"
```

---

### Task 4: Tilt and spin the bodies in the 3D renderer

**Files:**
- Modify: `src/render3d/bodies.ts:9` (delete `SATURN_RING_TILT_RAD`), `:44-66` (`createSaturnRing`), `:73-95` (`createBodyObject`), and append `applyBodySpin`
- Modify: `src/render3d/ThreeRenderer.ts:4` (import), the private-field block near `:40`, and `sync()` at `:148-159`
- Modify: `src/hooks/useSimulation.ts:6` (import) and the 3D branch at `:203`
- Modify: `src/render3d/sceneObjects.test.ts` (add three tests)

**Interfaces:**
- Consumes: `BodySnapshot3D.spinRad` / `.obliquityRad` (Task 3); `axialSpinEnabled(multiplier)` from `src/sim/clock.ts` (Task 2); the fixtures `mars` / `saturn` and constants `MARS_OBLIQUITY_RAD` / `SATURN_OBLIQUITY_RAD` in `sceneObjects.test.ts` (Task 3).
- Produces: `applyBodySpin(group: THREE.Group, spinRad: number): void` from `src/render3d/bodies.ts`; `ThreeRenderer.setSpinEnabled(enabled: boolean): void`.

- [ ] **Step 1: Write the failing renderer tests**

In `src/render3d/sceneObjects.test.ts`, add `applyBodySpin` to the existing import from `./bodies`, then add these three tests inside the existing `describe('createBodyObject', ...)` block:

```ts
  it('tilts the group by the body obliquity', () => {
    const group = createBodyObject(mars, new THREE.TextureLoader());
    expect(group.rotation.x).toBeCloseTo(MARS_OBLIQUITY_RAD, 12);
  });

  it('carries Saturn ring tilt on the group rather than the ring itself', () => {
    const group = createBodyObject(saturn, new THREE.TextureLoader());
    expect(group.rotation.x).toBeCloseTo(SATURN_OBLIQUITY_RAD, 12);
    const ring = group.children[1] as THREE.Mesh;
    expect(ring.rotation.x).toBe(0);
  });

  it('applyBodySpin turns the sphere, leaving the ring and the tilt alone', () => {
    const group = createBodyObject(saturn, new THREE.TextureLoader());
    applyBodySpin(group, Math.PI / 3);
    expect(group.children[0].rotation.z).toBeCloseTo(Math.PI / 3, 12);
    // Rings orbit; they do not rotate with the planet.
    expect(group.children[1].rotation.z).toBe(0);
    expect(group.rotation.x).toBeCloseTo(SATURN_OBLIQUITY_RAD, 12);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- src/render3d/sceneObjects.test.ts`
Expected: FAIL — `applyBodySpin` is not exported, `group.rotation.x` is `0`, and the ring still carries `rotation.x = 26.7°`.

- [ ] **Step 3: Move the tilt onto the group and add the spin helper**

In `src/render3d/bodies.ts`:

Delete the constant `const SATURN_RING_TILT_RAD = (26.7 * Math.PI) / 180;` and, in `createSaturnRing`, delete the line `mesh.rotation.x = SATURN_RING_TILT_RAD;` so its tail reads:

```ts
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
```

In `createBodyObject`, set the tilt on the group right after its name (the group's rotation.x now supplies what the ring used to carry itself):

```ts
  const group = new THREE.Group();
  group.name = body.name;
  // Axial tilt lives on the group, so the sphere's local z is the pole and
  // Saturn's ring inherits the same tilt without spinning with the planet.
  group.rotation.x = body.obliquityRad;
  group.add(new THREE.Mesh(geometry, material));
  if (body.kind === 'sun') group.add(createSunGlow(body.bodyRadius));
  if (body.name === 'Saturn') group.add(createSaturnRing(body.bodyRadius, loader));
  return group;
```

Then append to the file:

```ts
/**
 * Spins a body group's sphere about its polar axis. The group carries the
 * axial tilt, so the sphere's local z IS the pole; the ring and glow are
 * siblings and stay put. Exported rather than inlined in ThreeRenderer so it
 * is testable in jsdom — ThreeRenderer needs a real WebGL context.
 */
export function applyBodySpin(group: THREE.Group, spinRad: number): void {
  const sphere = group.children[0];
  if (sphere) sphere.rotation.z = spinRad;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test -- src/render3d/sceneObjects.test.ts`
Expected: PASS — the three new tests plus the four pre-existing `createBodyObject` tests (child order and the pole-at-`+Z` assertion are unchanged).

- [ ] **Step 5: Apply the spin per frame, gated by the speed**

In `src/render3d/ThreeRenderer.ts`, extend the `bodies` import:

```ts
import { applyBodySpin, createBodyObject } from './bodies';
```

Add a field beside the other private fields (e.g. after `private lastFocusPos: THREE.Vector3 | null = null;`):

```ts
  private spinEnabled = true;
```

Add this method next to `setFocus`:

```ts
  /**
   * Axial spin is only legible at slower speeds. When disabled, sync() skips
   * the write, so each body freezes at its last angle instead of resetting.
   */
  setSpinEnabled(enabled: boolean): void {
    this.spinEnabled = enabled;
  }
```

In `sync()`, inside the `for (const body of snap.bodies)` loop, add the spin right after the position write:

```ts
      obj.visible = true;
      obj.position.set(body.x, body.y, body.z);
      if (this.spinEnabled) applyBodySpin(obj, body.spinRad);
      if (body.kind === 'comet') comet = body;
```

- [ ] **Step 6: Drive it from the simulation clock**

In `src/hooks/useSimulation.ts`, extend the clock import:

```ts
import { axialSpinEnabled, DEFAULT_SPEED_MULTIPLIER, type SpeedMultiplier } from '../sim/clock';
```

In the RAF loop's 3D branch, add the call immediately before the existing `setFocus` line:

```ts
          threeRenderer.setSpinEnabled(axialSpinEnabled(sim.clock.multiplier));
          threeRenderer.setFocus(focusedBodyRef.current);
          threeRenderer.sync(snap3, path3, cometName);
```

Reading `sim.clock.multiplier` directly is correct here: the clock object is mutable and always current, so no extra ref is needed.

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build`
Expected: suite green apart from the pre-existing `src/staticAssets.test.ts` failure; build clean.

- [ ] **Step 8: Commit**

```bash
git add src/render3d/bodies.ts src/render3d/ThreeRenderer.ts src/render3d/sceneObjects.test.ts src/hooks/useSimulation.ts
git commit -m "feat: rotate 3D bodies about their tilted axes below 1 month per second"
```

---

### Task 5: Document both features

This task is a plan-level addition: the spec has no documentation section, but the repo documents every user-visible 3D feature in `README.md` and every scene-graph convention in `AGENTS.md`, and the axial-tilt convention is exactly the kind of thing a future contributor would otherwise re-derive wrongly.

**Files:**
- Modify: `README.md:13` (the `**3D mode.**` feature bullet)
- Modify: `AGENTS.md` (the `### 3D view mode` bullet list)

**Interfaces:**
- Consumes: the finished behavior from Tasks 1-4.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the rotation sentence to the README's 3D bullet**

In `README.md`, the `- **3D mode.**` bullet currently ends with: `The Three.js renderer loads lazily on first use, so the 2D experience pays no bundle cost.` Insert this sentence immediately before that final sentence:

```markdown
Planets and the Sun also rotate about their own axes at their real sidereal rates and real axial tilts — Uranus lies on its side at 97.8°, and Venus, Uranus and Pluto turn retrograde — whenever the speed scale is below `1s = 1 month`; above that the spin would strobe, so it freezes while the orbits keep running.
```

- [ ] **Step 2: Document the tilt convention for contributors**

In `AGENTS.md`, inside the `### 3D view mode` bullet list, add this bullet directly after the bullet that begins `- Sphere geometries are rotated `rotateX(π/2)` at creation`:

```markdown
- Axial rotation: each body group carries its `obliquityRad` as `rotation.x`
  (set once at creation), and `applyBodySpin` writes the sphere child's
  `rotation.z` per frame. **`rotationPeriodDays` is always positive** —
  retrograde spin is encoded as `obliquityRad > π/2` (IAU convention), never as
  a negative period, or the two cancel. The angle comes from
  `axialSpinRad(simDays, period)` (`src/sim/rotation.ts`), a pure function of
  `simDays`, so seeking a date reproduces orientations exactly. Spin is applied
  only while `axialSpinEnabled(multiplier)` is true (below `1s = 1 month`);
  above it the write is skipped so bodies freeze rather than reset. Saturn's
  ring is a sibling of the sphere: tilted with the group, never spun.
```

- [ ] **Step 3: Verify nothing regressed**

Run: `npm test && npm run build`
Expected: suite green apart from the pre-existing `src/staticAssets.test.ts` failure; build clean. (A docs-only change touches no code — this is a regression guard before committing.)

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: describe 3D axial rotation and the tilt convention"
```

---

## Manual verification

Automated tests cannot cover Part A at all (jsdom does no layout and does not compute `pointer-events`) nor the `if (this.spinEnabled)` gate inside `ThreeRenderer`. Run `npm run dev` and check:

1. At ~360px viewport width the toolbar wraps to two rows, and the picker column (switch to 3D mode to show it) sits *below* the wrapped toolbar, not under it.
2. Dragging the canvas in the empty area to the right of the picker column still pans in 2D and orbits in 3D — this is the `pointer-events` contract.
3. On a wide desktop viewport the toolbar is a single row and nothing has visibly moved.
4. In 3D at `1s = 24 h`: Earth turns about once per second; Uranus is visibly on its side; Venus turns the opposite way to Earth.
5. Switch to `1s = 1 month`: the spin freezes while orbital motion continues, and Uranus is *still* on its side — the tilt is static geometry and must survive the cutoff. Switch back to `1s = 24 h`: the spin resumes (one instantaneous jump to the angle the new date implies is expected).
6. Pick a date, seek away, and return: the same date reproduces the same orientations.
