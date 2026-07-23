# Pluto And Charon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dwarf planet Pluto and its moon Charon to the Schematic and To Scale solar-system views.

**Architecture:** Extend the existing `PLANETS` and `MOONS` data tables so the generic layout, simulation, orbit-path, extent, and rendering pipelines include both bodies without new production interfaces. Add focused regression coverage for source data, epoch placement, retrograde moon motion, path counts, camera extent inputs, and canvas rendering counts.

**Tech Stack:** TypeScript 5.6, React 18, Canvas 2D, Vite 5, Vitest 2

## Global Constraints

- Keep `src/sim/` pure; no Canvas, React, DOM, or runtime ephemeris requests.
- Pluto remains in the existing `PlanetSpec`/`PLANETS` major-body pipeline, with a comment identifying it as a dwarf planet.
- Pluto values are fixed at `periodDays: 90921.85108674582`, epoch longitude `302.961154488` degrees, semi-major axis `39.57126152242962` AU, eccentricity `0.2494484952274253`, and perihelion longitude `225.218605929714` degrees.
- Pluto uses `bodyRadius: 4` and color `#b8a99a`.
- Charon uses `parent: 'Pluto'` and `periodDays: -6.387222`; it has no `epochAngleRad`.
- Both scale modes must agree on Pluto's longitude at `simDays = 0`.
- Charon uses the existing stylized circular moon model and shared moon appearance in both modes.
- Do not add Pluto's smaller moons, other dwarf planets, 3D inclination, barycentric wobble, filters, toggles, or dependencies.
- Preserve asteroid-belt, comet, date, speed, pause, zoom, pan, touch, and moon-visibility behavior.

## File Structure

- Modify `src/sim/data.ts`: append Pluto's static orbital/display data and Charon's parent/period data.
- Modify `src/sim/data.test.ts`: validate body order, moon counts, Pluto's source values, and Charon's relationship and period.
- Modify `src/sim/simulation.test.ts`: validate expanded snapshots, Pluto's epoch placement in both modes, Charon's retrograde motion, real-distance ordering, and nine paths per mode.
- Modify `src/render/drawScene.test.ts`: update body, guide, label, moon-bubble, and asteroid draw-count expectations for Pluto and Charon.
- Do not modify `src/sim/simulation.ts`, `src/sim/layout.ts`, or `src/render/drawScene.ts`; their data-driven loops already provide the required behavior.

---

### Task 1: Add Pluto And Charon Through The Existing Pipelines

**Files:**
- Modify: `src/sim/data.ts:37-225`
- Test: `src/sim/data.test.ts:5-160`
- Test: `src/sim/simulation.test.ts:17-153`
- Test: `src/render/drawScene.test.ts:67-170`

**Interfaces:**
- Consumes: existing `PlanetSpec`, `MoonSpec`, `Simulation.snapshot(mode?)`, `Simulation.orbitPaths(mode?)`, `Simulation.extent(mode?)`, `computeLayout`, and `drawScene` behavior.
- Produces: `PLANETS` with Pluto as its ninth entry and `MOONS` with Charon as its 99th entry; no new exported type or function.

- [ ] **Step 1: Write failing data-table tests**

In `src/sim/data.test.ts`, add Pluto to every expected major-body data table:

```ts
const EXPECTED_MOON_COUNTS: Record<string, number> = {
  Mercury: 0,
  Venus: 0,
  Earth: 1,
  Mars: 2,
  Jupiter: 20,
  Saturn: 30,
  Uranus: 29,
  Neptune: 16,
  Pluto: 1,
};

const EXPECTED_PLANET_EPOCH_ANGLES_DEG: Record<string, number> = {
  Mercury: 242.262456669,
  Venus: 277.021284224,
  Earth: 100.209656729,
  Mars: 283.796552295,
  Jupiter: 108.967359114,
  Saturn: 1.552905047,
  Uranus: 59.539656457,
  Neptune: 0.995246704,
  Pluto: 302.961154488,
};

const EXPECTED_SEMI_MAJOR_AXIS_AU: Record<string, number> = {
  Mercury: 0.38709927,
  Venus: 0.72333566,
  Earth: 1.00000261,
  Mars: 1.52371034,
  Jupiter: 5.202887,
  Saturn: 9.53667594,
  Uranus: 19.18916464,
  Neptune: 30.06992276,
  Pluto: 39.57126152242962,
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
  Pluto: 0.2494484952274253,
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
  Pluto: 225.218605929714,
};
```

Replace the solar-order and moon-total assertions with:

```ts
it('has 8 planets followed by dwarf planet Pluto in solar order', () => {
  expect(PLANETS.map((p) => p.name)).toEqual([
    'Mercury',
    'Venus',
    'Earth',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
  ]);
});

it('has 99 moons', () => {
  expect(MOONS).toHaveLength(99);
});
```

Add a focused test after the moon-count test:

```ts
it('stores Charon as Pluto\'s retrograde moon', () => {
  expect(MOONS.find((moon) => moon.name === 'Charon')).toEqual({
    name: 'Charon',
    parent: 'Pluto',
    periodDays: -6.387222,
  });
});
```

The existing loop-based epoch and orbital-element tests will now also validate Pluto.

- [ ] **Step 2: Run the data tests to verify they fail**

Run: `npm test -- src/sim/data.test.ts`

Expected: FAIL because `PLANETS` does not contain Pluto, `MOONS` has 98 entries instead of 99, and Charon is absent.

- [ ] **Step 3: Write failing simulation behavior tests**

In `src/sim/simulation.test.ts`, replace the data import:

```ts
import { AU_TO_WORLD, COMETS, PLANETS } from './data';
```

Then add Pluto to the epoch-angle map:

```ts
const EXPECTED_PLANET_EPOCH_ANGLES_DEG: Record<string, number> = {
  Mercury: 242.262456669,
  Venus: 277.021284224,
  Earth: 100.209656729,
  Mars: 283.796552295,
  Jupiter: 108.967359114,
  Saturn: 1.552905047,
  Uranus: 59.539656457,
  Neptune: 0.995246704,
  Pluto: 302.961154488,
};
```

Replace the snapshot-count test with:

```ts
it('snapshots 109 bodies (1 sun + 9 major bodies + 99 moons)', () => {
  expect(new Simulation().snapshot().bodies).toHaveLength(109);
});
```

Add this test after the Triton retrograde test:

```ts
it('Charon orbits retrograde around Pluto', () => {
  const sim = new Simulation();
  advanceDays(sim, 1);
  const bodies = sim.snapshot().bodies;
  const pluto = bodies.find((b) => b.name === 'Pluto')!;
  const charon = bodies.find((b) => b.name === 'Charon')!;
  const angle = Math.atan2(charon.y - pluto.y, charon.x - pluto.x);
  expect(angle).toBeCloseTo((2 * Math.PI) / -6.387222, 5);
});
```

At the start of the real-distance ordering assertions, add:

```ts
expect(dist('Pluto')).toBeGreaterThan(dist('Neptune'));
```

Change both orbit-path length assertions from `8` to `9`:

```ts
it('produces one ellipse path per major body in to-scale mode', () => {
  const paths = new Simulation().orbitPaths('toScale');
  expect(paths).toHaveLength(9);
  expect(paths.every((p) => p.kind === 'ellipse')).toBe(true);
});

it('produces circular paths in schematic mode', () => {
  const paths = new Simulation().orbitPaths('schematic');
  expect(paths).toHaveLength(9);
  expect(paths.every((p) => p.kind === 'circle')).toBe(true);
});
```

Replace the generic extent test with explicit Pluto framing assertions:

```ts
it('includes Pluto and Charon in the schematic extent', () => {
  const sim = new Simulation();
  const pluto = sim.layout.planets.Pluto;
  expect(sim.extent('schematic')).toBe(pluto.orbitRadius + pluto.bubbleRadius);
});

it("includes Pluto's aphelion in the to-scale extent", () => {
  const sim = new Simulation();
  const pluto = PLANETS.find((planet) => planet.name === 'Pluto')!;
  expect(sim.extent('toScale')).toBeCloseTo(
    pluto.semiMajorAxisAu * (1 + pluto.eccentricity) * AU_TO_WORLD,
    10,
  );
});
```

The existing epoch-longitude loops test Pluto in both Schematic and To Scale modes once its expected angle is added.

- [ ] **Step 4: Update rendering expectations before production data exists**

In `src/render/drawScene.test.ts`, replace the affected count assertions and comments:

```ts
// 10 bodies (sun + 9 major bodies) + 1 sun glow + 9 orbit guides + 7 moon bubble guides
expect(ctx.arc).toHaveBeenCalledTimes(27);
// Only major-body labels; moon labels are hidden at this zoom.
expect(ctx.fillText).toHaveBeenCalledTimes(9);
```

```ts
// 109 bodies + 1 sun glow + 9 orbit guides + 7 moon bubble guides.
expect(ctx.arc).toHaveBeenCalledTimes(126);
```

```ts
expect(ctx.arc).toHaveBeenCalledTimes(526); // 126 + 400 belt asteroids
```

```ts
// One ellipse per major body; no circular orbit guides.
expect(ctx.ellipse).toHaveBeenCalledTimes(9);
// 10 bodies + 1 sun glow + 7 moon bubble guides, no orbit circles.
expect(ctx.arc).toHaveBeenCalledTimes(18);
```

- [ ] **Step 5: Run all affected tests to confirm the red state**

Run: `npm test -- src/sim/data.test.ts src/sim/simulation.test.ts src/render/drawScene.test.ts`

Expected: FAIL with missing Pluto/Charon data and old received counts, including 8 received orbit paths where 9 are expected.

- [ ] **Step 6: Add Pluto and Charon to the static data**

In `src/sim/data.ts`, append Pluto immediately after Neptune in `PLANETS`:

```ts
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
  // Dwarf planet
  {
    name: 'Pluto',
    periodDays: 90921.85108674582,
    epochAngleRad: 302.961154488 * DEG_TO_RAD,
    semiMajorAxisAu: 39.57126152242962,
    eccentricity: 0.2494484952274253,
    perihelionLongitudeRad: 225.218605929714 * DEG_TO_RAD,
    bodyRadius: 4,
    color: '#b8a99a',
  },
];
```

Append Charon after the Neptune moon entries and before the closing `MOONS` bracket:

```ts
  { name: 'S/2021 N 1', parent: 'Neptune', periodDays: -10036.65 },
  // Pluto (1)
  { name: 'Charon', parent: 'Pluto', periodDays: -6.387222 },
];
```

Do not add special cases to the simulation, layout, camera, or renderer.

- [ ] **Step 7: Run the affected tests to verify they pass**

Run: `npm test -- src/sim/data.test.ts src/sim/simulation.test.ts src/render/drawScene.test.ts`

Expected: PASS for all tests in the three files.

- [ ] **Step 8: Run complete verification**

Run: `npm test`

Expected: PASS with the complete Vitest suite green.

Run: `npm run build`

Expected: PASS; TypeScript reports no errors and Vite creates the production bundle.

- [ ] **Step 9: Review and commit the implementation**

Run:

```bash
git status --short
git diff --check
git diff -- src/sim/data.ts src/sim/data.test.ts src/sim/simulation.test.ts src/render/drawScene.test.ts
git log --oneline -10
```

Expected: only the four intended source/test files are changed, and `git diff --check` prints no errors.

Commit:

```bash
git add src/sim/data.ts src/sim/data.test.ts src/sim/simulation.test.ts src/render/drawScene.test.ts
git commit -m "feat: add Pluto and Charon"
```
