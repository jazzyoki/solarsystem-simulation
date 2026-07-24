# 3D Rendering Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third view mode ("3D") that renders the solar system with real orbital inclinations, textured bodies, and orbit-around-target navigation via a Three.js WebGL renderer, leaving the two existing 2D Canvas modes untouched.

**Architecture:** Pure 3D orbital math is added alongside (never replacing) the existing 2D math in `src/sim/` — a single rotation `Rz(Ω)·Rx(i)·Rz(ω)` lifts the already-solved in-plane Keplerian position into ecliptic 3D. A new `src/render3d/` package holds all Three.js code (scene, meshes, textures, OrbitControls). `useSimulation` drives one RAF loop that renders to a 2D canvas or a WebGL canvas depending on the mode; the Three renderer is lazily code-split and disposed when leaving 3D.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest 2 (jsdom), Three.js (`three` + `@types/three`), Three's `OrbitControls`.

**Spec:** `docs/superpowers/specs/2026-07-24-3d-rendering-mode-design.md`

## Global Constraints

- `src/sim/` stays pure: positions only, no Three.js/React/Canvas imports, no `Date.now()`.
- Three.js is imported ONLY under `src/render3d/` (and via dynamic import in `useSimulation`).
- The 2D **Schematic** and **To Scale** modes must be byte-identical in behavior: never modify `ellipticalPositionAu`, `cometPositionAu`, `drawScene`, `Camera`, or `PointerInteraction` semantics.
- `ScaleMode` stays `'schematic' | 'toScale'`; the UI-level mode is the new `ViewMode = ScaleMode | 'threeD'` (spec amended in Task 1). `Simulation` methods that take a mode keep taking `ScaleMode`.
- Angles stored in radians via `× DEG_TO_RAD`, matching `src/sim/data.ts` style.
- Test style: Vitest, `toBeCloseTo` for floats, mock/skip real drawing surfaces. `ThreeRenderer` (needs a GPU context) is not unit-tested; everything pure is.
- Run `npm test` (Vitest) and `npm run build` (tsc + vite) before every commit. Commit each task independently.
- Seek-pauses convention, comet behavior, and all existing UI conventions from `AGENTS.md` remain in force.

---

### Task 1: 3D orbital element data (inclination + ascending node)

**Files:**
- Modify: `src/sim/types.ts`
- Modify: `src/sim/data.ts`
- Test: `src/sim/data.test.ts`
- Modify: `docs/superpowers/specs/2026-07-24-3d-rendering-mode-design.md` (three amendments)

**Interfaces:**
- Consumes: existing `PlanetSpec`, `CometSpec`.
- Produces: `PlanetSpec.inclinationRad`, `PlanetSpec.ascendingNodeRad`, `CometSpec.inclinationRad`, `CometSpec.ascendingNodeRad` (all `number`, radians) — required fields used by Tasks 2–4.

- [ ] **Step 1: Amend the spec (design deltas agreed during planning)**

Three edits to `docs/superpowers/specs/2026-07-24-3d-rendering-mode-design.md`:

Edit A — in the "### Mode type" section, replace:

```
`ScaleMode` becomes `'schematic' | 'toScale' | 'threeD'`. `useSimulation`
branches on the mode to pick the render backend and (for 3D) the 3D snapshot.
```

with:

```
`ScaleMode` stays `'schematic' | 'toScale'`; a new `ViewMode = ScaleMode |
'threeD'` is the UI-level mode. This keeps `Simulation` methods that branch on
`ScaleMode` impossible to call with `'threeD'` by mistake. `useSimulation`
branches on the `ViewMode` to pick the render backend and (for 3D) the 3D
snapshot.
```

Edit B — in "## Non-Goals (v1)", add two bullets at the end of the list:

```
- Text labels in the 3D view (2D modes keep their labels; 3D bodies are
  identified by texture, color, and position).
- Pluto/Charon textures — no reliably-sourced free 2k equirectangular maps;
  they render as flat-color spheres in 3D (the standing fallback path).
```

Edit C — in "## Textures & Assets", replace the Source bullet's body list:

```
  domain) — equirectangular diffuse maps for Sun, 8 planets, Earth's Moon,
  Pluto/Charon, plus a Saturn ring alpha map. ~1–2K resolution to bound bundle
```

with:

```
  domain) — equirectangular diffuse maps for the Sun, the 8 planets, and
  Earth's Moon, plus a Saturn ring alpha map. ~2K resolution to bound bundle
```

and in "## Goals" replace:

```
- Textured spheres for the Sun, planets, Earth's Moon, and Pluto/Charon, with a
  Saturn ring; each falls back to its existing flat color until its texture
  loads.
```

with:

```
- Textured spheres for the Sun, the 8 planets, and Earth's Moon, with a Saturn
  ring; each falls back to its existing flat color until its texture loads.
  Bodies without a sourced map (Pluto, Charon, other moons, comets) render in
  their flat data.ts color.
```

- [ ] **Step 2: Write failing tests for the new data fields**

Append to `src/sim/data.test.ts` (inside the file, new `describe` blocks at the end):

```ts
const EXPECTED_INCLINATION_DEG: Record<string, number> = {
  Mercury: 7.00497902,
  Venus: 3.39467605,
  Earth: -0.00001531,
  Mars: 1.84969142,
  Jupiter: 1.30439695,
  Saturn: 2.48599187,
  Uranus: 0.77263783,
  Neptune: 1.77004347,
  Pluto: 17.14001206,
};

const EXPECTED_ASCENDING_NODE_DEG: Record<string, number> = {
  Mercury: 48.33076593,
  Venus: 76.67984255,
  Earth: 0.0,
  Mars: 49.55953891,
  Jupiter: 100.47390909,
  Saturn: 113.66242448,
  Uranus: 74.01692503,
  Neptune: 131.78422574,
  Pluto: 110.30393684,
};

describe('3D orbital elements', () => {
  it('stores the J2000 inclination for every planet', () => {
    for (const p of PLANETS) {
      expect(p.inclinationRad, p.name).toBeCloseTo(
        EXPECTED_INCLINATION_DEG[p.name] * DEG_TO_RAD,
        10,
      );
    }
  });

  it('stores the J2000 ascending node for every planet', () => {
    for (const p of PLANETS) {
      expect(p.ascendingNodeRad, p.name).toBeCloseTo(
        EXPECTED_ASCENDING_NODE_DEG[p.name] * DEG_TO_RAD,
        10,
      );
    }
  });

  it('gives every comet an inclination and ascending node', () => {
    for (const c of COMETS) {
      expect(Number.isFinite(c.inclinationRad), c.name).toBe(true);
      expect(Number.isFinite(c.ascendingNodeRad), c.name).toBe(true);
      expect(c.inclinationRad, c.name).toBeGreaterThanOrEqual(0);
      expect(c.inclinationRad, c.name).toBeLessThan(Math.PI);
    }
  });

  it('flags comets retrograde iff inclination exceeds 90 degrees', () => {
    for (const c of COMETS) {
      expect(c.retrograde, c.name).toBe(c.inclinationRad > Math.PI / 2);
    }
  });

  it("keeps each comet's stored ϖ consistent with its stored Ω (ω = ϖ − Ω ≥ 0)", () => {
    // data.ts writes ϖ as (Ω + ω)·DEG_TO_RAD; the stored node must be the
    // first summand so the derived argument of perihelion stays sane.
    for (const c of COMETS) {
      const omega = c.perihelionLongitudeRad - c.ascendingNodeRad;
      expect(omega, c.name).toBeGreaterThanOrEqual(0);
      expect(omega, c.name).toBeLessThan(2 * Math.PI);
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- data`
Expected: FAIL — `inclinationRad`/`ascendingNodeRad` are `undefined` (TS may fail compile first; that also counts as the failing state).

- [ ] **Step 4: Add the type fields**

In `src/sim/types.ts`, add to `PlanetSpec` after `perihelionLongitudeRad`:

```ts
  /** J2000 orbital inclination to the ecliptic in radians. */
  inclinationRad: number;
  /** J2000 longitude of the ascending node (Omega) in radians. */
  ascendingNodeRad: number;
```

Add the same two fields to `CometSpec` after `perihelionLongitudeRad` (JSDoc: "Orbital inclination to the ecliptic in radians." / "Longitude of the ascending node (Omega) in radians.").

Also add to `src/sim/types.ts` (used from Task 2 onward):

```ts
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
```

- [ ] **Step 5: Add planet values in `src/sim/data.ts`**

Add two lines to each `PLANETS` entry (after `perihelionLongitudeRad`), values from the JPL J2000 approximate elements (Pluto from JPL Table 2b):

| Planet  | inclinationRad                 | ascendingNodeRad               |
|---------|--------------------------------|--------------------------------|
| Mercury | `7.00497902 * DEG_TO_RAD`      | `48.33076593 * DEG_TO_RAD`     |
| Venus   | `3.39467605 * DEG_TO_RAD`      | `76.67984255 * DEG_TO_RAD`     |
| Earth   | `-0.00001531 * DEG_TO_RAD`     | `0.0 * DEG_TO_RAD`             |
| Mars    | `1.84969142 * DEG_TO_RAD`      | `49.55953891 * DEG_TO_RAD`     |
| Jupiter | `1.30439695 * DEG_TO_RAD`      | `100.47390909 * DEG_TO_RAD`    |
| Saturn  | `2.48599187 * DEG_TO_RAD`      | `113.66242448 * DEG_TO_RAD`    |
| Uranus  | `0.77263783 * DEG_TO_RAD`      | `74.01692503 * DEG_TO_RAD`     |
| Neptune | `1.77004347 * DEG_TO_RAD`      | `131.78422574 * DEG_TO_RAD`    |
| Pluto   | `17.14001206 * DEG_TO_RAD`     | `110.30393684 * DEG_TO_RAD`    |

Example (Mercury):

```ts
    perihelionLongitudeRad: 77.45779628 * DEG_TO_RAD,
    inclinationRad: 7.00497902 * DEG_TO_RAD,
    ascendingNodeRad: 48.33076593 * DEG_TO_RAD,
```

- [ ] **Step 6: Add comet values in `src/sim/data.ts`**

Each comet already writes `perihelionLongitudeRad: (Ω + ω) * DEG_TO_RAD` with Ω as the **first** summand. Add `inclinationRad` (JPL SBDB) and `ascendingNodeRad` (the existing first summand) to each entry:

| Comet               | i (deg) | Ω (deg) |
|---------------------|--------:|--------:|
| Halley              | 162.26  | 59.1    |
| Encke               | 11.78   | 334     |
| Churyumov-Gerasimenko | 7.04  | 50.1    |
| Wild 2              | 3.24    | 136     |
| Swift-Tuttle        | 113.45  | 139     |
| Tempel-Tuttle       | 162.49  | 235     |
| Hale-Bopp           | 89.4    | 283     |
| NEOWISE             | 128.9   | 61.0    |
| Hyakutake           | 124.9   | 188     |
| McNaught            | 77.8    | 267     |
| Tsuchinshan-ATLAS   | 139.1   | 21.6    |
| ISON                | 62.4    | 296     |
| 'Oumuamua           | 122.7   | 24.6    |
| Borisov             | 44.1    | 308     |
| 3I/ATLAS            | 175.1   | 322     |

Example (Halley):

```ts
  { name: 'Halley', designation: '1P', eccentricity: 0.968, semiMajorAxisAu: 17.9, perihelionDistanceAu: 0.575,
    perihelionLongitudeRad: (59.1 + 112) * DEG_TO_RAD, perihelionTimeSimDays: 2446469.97 - EPOCH_JD,
    inclinationRad: 162.26 * DEG_TO_RAD, ascendingNodeRad: 59.1 * DEG_TO_RAD,
    retrograde: true, cometClass: 'short', bodyRadius: COMET_BODY_RADIUS, color: COMET_COLOR },
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites — nothing else consumes the new fields yet).

- [ ] **Step 8: Build and commit**

Run: `npm run build` — expected: clean.

```bash
git add src/sim/types.ts src/sim/data.ts src/sim/data.test.ts docs/superpowers/specs/2026-07-24-3d-rendering-mode-design.md
git commit -m "feat: add J2000 inclination and ascending node to planet and comet data"
```

---

### Task 2: Core 3D transform (`orbit3d.ts`) — planets

**Files:**
- Create: `src/sim/orbit3d.ts`
- Test: `src/sim/orbit3d.test.ts`

**Interfaces:**
- Consumes: `epochMeanAnomaly`, `OrbitalElements` from `./ellipticalOrbit`; `eccentricAnomalyFromMean`, `trueAnomalyFromEccentric` from `./kepler`; `Vec3` from `./types`.
- Produces (used by Tasks 3–4, 6):
  - `interface OrbitOrientation { inclinationRad: number; ascendingNodeRad: number; perihelionLongitudeRad: number }`
  - `type OrbitalElements3D = OrbitalElements & OrbitOrientation`
  - `orbitalPlaneToEcliptic(o: OrbitOrientation, radius: number, trueAnomalyRad: number): Vec3`
  - `ellipticalPosition3dAu(el: OrbitalElements3D, simDays: number): Vec3`
  - `ellipticalPath3dAu(el: OrbitalElements3D, segments?: number): Vec3[]` (returns `segments` points, open ring for a LineLoop)
  - `const ORBIT_PATH_SEGMENTS = 256`

- [ ] **Step 1: Write the failing tests**

Create `src/sim/orbit3d.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ellipticalPositionAu } from './ellipticalOrbit';
import {
  ellipticalPath3dAu,
  ellipticalPosition3dAu,
  ORBIT_PATH_SEGMENTS,
  orbitalPlaneToEcliptic,
  type OrbitalElements3D,
} from './orbit3d';

const FLAT: OrbitalElements3D = {
  semiMajorAxisAu: 1.5,
  eccentricity: 0.2,
  perihelionLongitudeRad: 0.7,
  periodDays: 500,
  epochLongitudeRad: 1.2,
  inclinationRad: 0,
  ascendingNodeRad: 0,
};

const TILTED: OrbitalElements3D = { ...FLAT, inclinationRad: 0.5, ascendingNodeRad: 0.4 };

describe('orbitalPlaneToEcliptic', () => {
  it('preserves the radius under rotation', () => {
    const o = { inclinationRad: 1.1, ascendingNodeRad: 2.3, perihelionLongitudeRad: 3.0 };
    for (const nu of [0, 0.5, 2, 4.5]) {
      const p = orbitalPlaneToEcliptic(o, 2.5, nu);
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(2.5, 12);
    }
  });

  it('crosses z = 0 heading north at the ascending node', () => {
    const o = { inclinationRad: 0.3, ascendingNodeRad: 1.1, perihelionLongitudeRad: 1.8 };
    // u = ω + ν = 0 puts the body on the node line at ecliptic longitude Ω.
    const nu = -(o.perihelionLongitudeRad - o.ascendingNodeRad);
    const p = orbitalPlaneToEcliptic(o, 2, nu);
    expect(p.z).toBeCloseTo(0, 12);
    expect(Math.atan2(p.y, p.x)).toBeCloseTo(o.ascendingNodeRad, 12);
    expect(orbitalPlaneToEcliptic(o, 2, nu + 0.01).z).toBeGreaterThan(0);
  });

  it('reaches z amplitude r·sin(i) a quarter turn past the node', () => {
    const o = { inclinationRad: 0.5, ascendingNodeRad: 0.4, perihelionLongitudeRad: 0.9 };
    const nu = Math.PI / 2 - (o.perihelionLongitudeRad - o.ascendingNodeRad);
    expect(orbitalPlaneToEcliptic(o, 3, nu).z).toBeCloseTo(3 * Math.sin(0.5), 12);
  });
});

describe('ellipticalPosition3dAu', () => {
  it('collapses exactly to the 2D position when inclination is zero', () => {
    for (const t of [0, 42.5, 137, 400]) {
      const p2 = ellipticalPositionAu(FLAT, t);
      const p3 = ellipticalPosition3dAu(FLAT, t);
      expect(p3.x, `t=${t}`).toBeCloseTo(p2.x, 12);
      expect(p3.y, `t=${t}`).toBeCloseTo(p2.y, 12);
      expect(p3.z, `t=${t}`).toBeCloseTo(0, 12);
    }
  });

  it('ignores the ascending node when inclination is zero', () => {
    const rotated = { ...FLAT, ascendingNodeRad: 2.1 };
    const p2 = ellipticalPositionAu(FLAT, 100);
    const p3 = ellipticalPosition3dAu(rotated, 100);
    expect(p3.x).toBeCloseTo(p2.x, 12);
    expect(p3.y).toBeCloseTo(p2.y, 12);
    expect(p3.z).toBeCloseTo(0, 12);
  });

  it('bounds |z| by r·sin(i) on a tilted orbit', () => {
    for (const t of [0, 50, 125, 250, 375]) {
      const p = ellipticalPosition3dAu(TILTED, t);
      const r = Math.hypot(p.x, p.y, p.z);
      expect(Math.abs(p.z), `t=${t}`).toBeLessThanOrEqual(
        r * Math.sin(TILTED.inclinationRad) + 1e-12,
      );
    }
  });
});

describe('ellipticalPath3dAu', () => {
  it('samples an open ring of the configured segment count', () => {
    const pts = ellipticalPath3dAu(TILTED);
    expect(pts).toHaveLength(ORBIT_PATH_SEGMENTS);
    for (const p of pts) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
    }
  });

  it('starts at perihelion distance a(1−e)', () => {
    const p0 = ellipticalPath3dAu(TILTED)[0];
    expect(Math.hypot(p0.x, p0.y, p0.z)).toBeCloseTo(
      TILTED.semiMajorAxisAu * (1 - TILTED.eccentricity),
      10,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- orbit3d`
Expected: FAIL — cannot resolve `./orbit3d`.

- [ ] **Step 3: Implement `src/sim/orbit3d.ts`**

```ts
import { eccentricAnomalyFromMean, trueAnomalyFromEccentric } from './kepler';
import { epochMeanAnomaly, type OrbitalElements } from './ellipticalOrbit';
import type { Vec3 } from './types';

const TWO_PI = Math.PI * 2;

/** Number of polyline points used for a 3D planet orbit guide. */
export const ORBIT_PATH_SEGMENTS = 256;

/** Orientation of an orbital plane relative to the ecliptic. */
export interface OrbitOrientation {
  inclinationRad: number;
  ascendingNodeRad: number;
  /** Longitude of perihelion, ϖ = Ω + ω. */
  perihelionLongitudeRad: number;
}

export type OrbitalElements3D = OrbitalElements & OrbitOrientation;

/**
 * Rotate an in-plane position (radius, true anomaly ν) into heliocentric
 * ecliptic 3D coordinates: p = Rz(Ω) · Rx(i) · Rz(ω) · (r·cos ν, r·sin ν, 0)
 * with ω = ϖ − Ω. +z points north of the ecliptic.
 */
export function orbitalPlaneToEcliptic(
  o: OrbitOrientation,
  radius: number,
  trueAnomalyRad: number,
): Vec3 {
  const argPerihelion = o.perihelionLongitudeRad - o.ascendingNodeRad;
  const u = argPerihelion + trueAnomalyRad; // argument of latitude
  const cosNode = Math.cos(o.ascendingNodeRad);
  const sinNode = Math.sin(o.ascendingNodeRad);
  const cosInc = Math.cos(o.inclinationRad);
  const sinInc = Math.sin(o.inclinationRad);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  return {
    x: radius * (cosNode * cosU - sinNode * sinU * cosInc),
    y: radius * (sinNode * cosU + cosNode * sinU * cosInc),
    z: radius * (sinU * sinInc),
  };
}

/**
 * Heliocentric 3D position in AU at simDays. Reuses the 2D Kepler solve and
 * epoch-mean-anomaly derivation (the epoch longitude is treated as in-orbit
 * longitude — exact at i = 0, a stylized approximation at the planets' small
 * inclinations) so 2D and 3D modes agree on each body's phase.
 */
export function ellipticalPosition3dAu(el: OrbitalElements3D, simDays: number): Vec3 {
  const meanAnomaly = epochMeanAnomaly(el) + (TWO_PI * simDays) / el.periodDays;
  const E = eccentricAnomalyFromMean(meanAnomaly, el.eccentricity);
  const trueAnomaly = trueAnomalyFromEccentric(E, el.eccentricity);
  const radiusAu = el.semiMajorAxisAu * (1 - el.eccentricity * Math.cos(E));
  return orbitalPlaneToEcliptic(el, radiusAu, trueAnomaly);
}

/**
 * Sample the full 3D orbit as `segments` points starting at perihelion,
 * uniform in true anomaly. Open ring: the renderer closes it (LineLoop).
 */
export function ellipticalPath3dAu(
  el: OrbitalElements3D,
  segments: number = ORBIT_PATH_SEGMENTS,
): Vec3[] {
  const e = el.eccentricity;
  const semiLatus = el.semiMajorAxisAu * (1 - e * e);
  const points: Vec3[] = [];
  for (let i = 0; i < segments; i++) {
    const nu = (TWO_PI * i) / segments;
    const r = semiLatus / (1 + e * Math.cos(nu));
    points.push(orbitalPlaneToEcliptic(el, r, nu));
  }
  return points;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- orbit3d`
Expected: PASS (10 tests).

- [ ] **Step 5: Full test run, build, commit**

Run: `npm test` then `npm run build` — expected: all green.

```bash
git add src/sim/orbit3d.ts src/sim/orbit3d.test.ts
git commit -m "feat: add pure 3D orbital transform (Rz(Ω)·Rx(i)·Rz(ω)) for planets"
```

---

### Task 3: Comet 3D positions and paths

**Files:**
- Modify: `src/sim/cometOrbit.ts` (extract `cometNuMax`)
- Modify: `src/sim/orbit3d.ts` (add comet functions)
- Test: `src/sim/orbit3d.test.ts` (extend), existing `src/sim/cometOrbit.test.ts` must stay green

**Interfaces:**
- Consumes: `meanMotion`, `COMET_PATH_WINDOW_AU`, `COMET_PATH_SEGMENTS` from `./cometOrbit`; `hyperbolicAnomalyFromMean`, `trueAnomalyFromHyperbolic` from `./hyperbolicOrbit`; `CometSpec` (now satisfies `OrbitOrientation`).
- Produces (used by Task 4):
  - `cometNuMax(spec: CometSpec, rWindowAu?: number): number` (exported from `cometOrbit.ts`)
  - `cometPosition3dAu(spec: CometSpec, simDays: number): Vec3`
  - `cometPath3dAu(spec: CometSpec, rWindowAu?: number, segments?: number): Vec3[]` (`segments + 1` points, perihelion at the midpoint)

- [ ] **Step 1: Write the failing tests**

Append to `src/sim/orbit3d.test.ts`:

```ts
import { COMETS } from './data';
import { cometPositionAu, COMET_PATH_SEGMENTS, COMET_PATH_WINDOW_AU } from './cometOrbit';
import { cometPath3dAu, cometPosition3dAu } from './orbit3d';

const halley = COMETS.find((c) => c.name === 'Halley')!;
const encke = COMETS.find((c) => c.name === 'Encke')!;
const borisov = COMETS.find((c) => c.name === 'Borisov')!;

describe('cometPosition3dAu', () => {
  it('matches the 2D heliocentric distance for every comet (orientation cannot change r)', () => {
    for (const c of COMETS) {
      const t = c.perihelionTimeSimDays + 30;
      const p2 = cometPositionAu(c, t);
      const p3 = cometPosition3dAu(c, t);
      expect(Math.hypot(p3.x, p3.y, p3.z), c.name).toBeCloseTo(Math.hypot(p2.x, p2.y), 8);
    }
  });

  it('sits at perihelion distance q at Tp', () => {
    const p = cometPosition3dAu(halley, halley.perihelionTimeSimDays);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(halley.perihelionDistanceAu, 8);
  });

  it('moves Halley retrograde in the ecliptic projection via its real inclination', () => {
    const a = cometPosition3dAu(halley, halley.perihelionTimeSimDays);
    const b = cometPosition3dAu(halley, halley.perihelionTimeSimDays + 5);
    // z-component of a×b: negative = clockwise from ecliptic north = retrograde.
    expect(a.x * b.y - a.y * b.x).toBeLessThan(0);
  });

  it('moves Encke prograde', () => {
    const a = cometPosition3dAu(encke, encke.perihelionTimeSimDays);
    const b = cometPosition3dAu(encke, encke.perihelionTimeSimDays + 5);
    expect(a.x * b.y - a.y * b.x).toBeGreaterThan(0);
  });
});

describe('cometPath3dAu', () => {
  it('returns segments+1 points with perihelion at the midpoint', () => {
    const pts = cometPath3dAu(halley);
    expect(pts).toHaveLength(COMET_PATH_SEGMENTS + 1);
    const mid = pts[COMET_PATH_SEGMENTS / 2];
    expect(Math.hypot(mid.x, mid.y, mid.z)).toBeCloseTo(halley.perihelionDistanceAu, 8);
  });

  it('clips unbound paths to the radius window', () => {
    for (const p of cometPath3dAu(borisov)) {
      expect(Math.hypot(p.x, p.y, p.z)).toBeLessThanOrEqual(COMET_PATH_WINDOW_AU + 1e-6);
    }
  });

  it('tilts a high-inclination path out of the ecliptic', () => {
    const maxZ = Math.max(...cometPath3dAu(halley).map((p) => Math.abs(p.z)));
    expect(maxZ).toBeGreaterThan(1); // Halley: i = 162°, aphelion ≈ 35 AU
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- orbit3d`
Expected: FAIL — `cometPosition3dAu` / `cometPath3dAu` not exported.

- [ ] **Step 3: Extract `cometNuMax` in `src/sim/cometOrbit.ts`**

Add the exported function and rewrite `cometPathAu` to use it (behavior identical):

```ts
/**
 * Maximum |true anomaly| drawn for a comet path: π for short-period comets,
 * else clipped to the radius window (and, for hyperbolas, to just inside the
 * asymptote).
 */
export function cometNuMax(spec: CometSpec, rWindowAu: number = COMET_PATH_WINDOW_AU): number {
  const e = spec.eccentricity;
  if (spec.cometClass === 'short') return Math.PI;
  const semiLatus = spec.perihelionDistanceAu * (1 + e);
  const cosAtWindow = (semiLatus / rWindowAu - 1) / e;
  const nuAtWindow = Math.acos(Math.max(-1, Math.min(1, cosAtWindow)));
  if (e < 1) return nuAtWindow;
  return Math.min(Math.acos(-1 / e) - 1e-3, nuAtWindow);
}
```

In `cometPathAu`, replace the whole `let nuMax ... else { ... }` block with:

```ts
  const nuMax = cometNuMax(spec, rWindowAu);
```

(keep `semiLatus` — the sampling loop still uses it).

- [ ] **Step 4: Add comet functions to `src/sim/orbit3d.ts`**

Add imports at the top:

```ts
import { hyperbolicAnomalyFromMean, trueAnomalyFromHyperbolic } from './hyperbolicOrbit';
import {
  cometNuMax,
  COMET_PATH_SEGMENTS,
  COMET_PATH_WINDOW_AU,
  meanMotion,
} from './cometOrbit';
import type { CometSpec, Vec3 } from './types';
```

Add at the end of the file:

```ts
/**
 * Heliocentric 3D comet position in AU at simDays. Unlike the 2D model, the
 * mean anomaly is NOT negated for retrograde comets — with the real
 * inclination applied, i > 90° produces retrograde ecliptic motion naturally.
 */
export function cometPosition3dAu(spec: CometSpec, simDays: number): Vec3 {
  const e = spec.eccentricity;
  const M = meanMotion(spec.semiMajorAxisAu) * (simDays - spec.perihelionTimeSimDays);
  let trueAnomaly: number;
  if (e < 1) {
    const E = eccentricAnomalyFromMean(M, e);
    trueAnomaly = trueAnomalyFromEccentric(E, e);
  } else {
    const H = hyperbolicAnomalyFromMean(M, e);
    trueAnomaly = trueAnomalyFromHyperbolic(H, e);
  }
  // Same q-anchored polar conic as the 2D model (see cometOrbit.ts).
  const radiusAu = (spec.perihelionDistanceAu * (1 + e)) / (1 + e * Math.cos(trueAnomaly));
  return orbitalPlaneToEcliptic(spec, radiusAu, trueAnomaly);
}

/** 3D counterpart of cometPathAu: same ν window, rotated into the ecliptic frame. */
export function cometPath3dAu(
  spec: CometSpec,
  rWindowAu: number = COMET_PATH_WINDOW_AU,
  segments: number = COMET_PATH_SEGMENTS,
): Vec3[] {
  const e = spec.eccentricity;
  const semiLatus = spec.perihelionDistanceAu * (1 + e);
  const nuMax = cometNuMax(spec, rWindowAu);
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const nu = -nuMax + (2 * nuMax * i) / segments;
    const r = semiLatus / (1 + e * Math.cos(nu));
    points.push(orbitalPlaneToEcliptic(spec, r, nu));
  }
  return points;
}
```

- [ ] **Step 5: Run tests to verify they pass — including the untouched comet suite**

Run: `npm test`
Expected: PASS. Pay attention to `cometOrbit.test.ts`: the `cometNuMax` extraction must not change any existing expectation.

- [ ] **Step 6: Build and commit**

Run: `npm run build` — expected: clean.

```bash
git add src/sim/cometOrbit.ts src/sim/orbit3d.ts src/sim/orbit3d.test.ts
git commit -m "feat: add 3D comet positions and paths using real inclinations"
```

---

### Task 4: Simulation 3D API (`snapshot3D`, `orbitPaths3D`, comet 3D accessors)

**Files:**
- Modify: `src/sim/simulation.ts`
- Test: `src/sim/simulation.test.ts` (extend)

**Interfaces:**
- Consumes: Task 2/3 exports; existing `elementsFor`, `layout`, `orbitalPosition`, `angleAt`, `AU_TO_WORLD`.
- Produces (used by Tasks 7–8):
  - `interface BodySnapshot3D extends BodySnapshot { z: number }`
  - `interface Snapshot3D { simDays: number; bodies: BodySnapshot3D[] }`
  - `interface CometPath3DRender { points: Vec3[]; color: 'green' | 'red' }`
  - `Simulation.snapshot3D(): Snapshot3D`
  - `Simulation.orbitPaths3D(): Vec3[][]` (9 arrays of 256 world-unit points)
  - `Simulation.cometBody3D(name: string): BodySnapshot3D | null`
  - `Simulation.cometPath3D(name: string): CometPath3DRender | null`

- [ ] **Step 1: Write the failing tests**

Append to `src/sim/simulation.test.ts`:

```ts
describe('Simulation 3D', () => {
  it('snapshot3D reports 109 bodies, each with a finite z', () => {
    const bodies = new Simulation().snapshot3D().bodies;
    expect(bodies).toHaveLength(109);
    for (const b of bodies) expect(Number.isFinite(b.z), b.name).toBe(true);
  });

  it('keeps the sun at the 3D origin', () => {
    const sun = new Simulation().snapshot3D().bodies[0];
    expect(sun).toMatchObject({ name: 'Sun', x: 0, y: 0, z: 0, kind: 'sun' });
  });

  it('agrees with the 2D to-scale mode on heliocentric distance per planet', () => {
    const sim = new Simulation();
    const flat = sim.snapshot('toScale').bodies;
    const solid = sim.snapshot3D().bodies;
    for (const name of Object.keys(EXPECTED_PLANET_EPOCH_ANGLES_DEG)) {
      const f = flat.find((b) => b.name === name)!;
      const s = solid.find((b) => b.name === name)!;
      expect(Math.hypot(s.x, s.y, s.z), name).toBeCloseTo(Math.hypot(f.x, f.y), 6);
    }
  });

  it("keeps Earth's |z| tiny and lets Pluto leave the ecliptic", () => {
    const sim = new Simulation();
    let plutoMaxZ = 0;
    for (let k = 0; k < 8; k++) {
      sim.clock.setSimDays((90921.85 * k) / 8);
      const bodies = sim.snapshot3D().bodies;
      expect(Math.abs(bodies.find((b) => b.name === 'Earth')!.z)).toBeLessThan(0.01);
      plutoMaxZ = Math.max(plutoMaxZ, Math.abs(bodies.find((b) => b.name === 'Pluto')!.z));
    }
    expect(plutoMaxZ).toBeGreaterThan(100); // 17° tilt at ~40 AU × 150 world units/AU
  });

  it('places every moon at its parent z (ecliptic-parallel rings)', () => {
    const bodies = new Simulation().snapshot3D().bodies;
    const byName = new Map(bodies.map((b) => [b.name, b]));
    const moon = byName.get('Moon')!;
    expect(moon.z).toBe(byName.get('Earth')!.z);
    expect(byName.get('Charon')!.z).toBe(byName.get('Pluto')!.z);
  });

  it('orbitPaths3D returns 9 loops of 256 world-unit points', () => {
    const paths = new Simulation().orbitPaths3D();
    expect(paths).toHaveLength(9);
    for (const path of paths) expect(path).toHaveLength(256);
    // Earth's loop stays ~1 AU from the origin in world units.
    const earth = paths[2];
    for (const p of earth) {
      const r = Math.hypot(p.x, p.y, p.z);
      expect(r).toBeGreaterThan(140);
      expect(r).toBeLessThan(160);
    }
  });

  it('cometBody3D sits at q·AU_TO_WORLD from the sun at Tp', () => {
    const sim = new Simulation();
    const halley = COMETS.find((c) => c.name === 'Halley')!;
    sim.clock.setSimDays(halley.perihelionTimeSimDays);
    const body = sim.cometBody3D('Halley')!;
    expect(body.kind).toBe('comet');
    expect(Math.hypot(body.x, body.y, body.z)).toBeCloseTo(0.575 * 150, 0);
  });

  it('cometPath3D keeps the green/red bound/unbound cue and returns null for unknowns', () => {
    const sim = new Simulation();
    expect(sim.cometPath3D('Halley')!.color).toBe('green');
    expect(sim.cometPath3D('Borisov')!.color).toBe('red');
    expect(sim.cometPath3D('Nope')).toBeNull();
    expect(sim.cometBody3D('Nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- simulation`
Expected: FAIL — `snapshot3D` is not a function.

- [ ] **Step 3: Implement in `src/sim/simulation.ts`**

Add imports:

```ts
import {
  cometPath3dAu,
  cometPosition3dAu,
  ellipticalPath3dAu,
  ellipticalPosition3dAu,
  type OrbitalElements3D,
} from './orbit3d';
import type { BodyPosition, CometSpec, PlanetSpec, ScaleMode, Vec3 } from './types';
```

Add type exports next to `Snapshot`:

```ts
export interface BodySnapshot3D extends BodySnapshot {
  z: number;
}

export interface Snapshot3D {
  simDays: number;
  bodies: BodySnapshot3D[];
}

export interface CometPath3DRender {
  points: Vec3[];
  color: 'green' | 'red';
}
```

Add a private helper next to `elementsFor` (module scope):

```ts
function elements3dFor(planet: PlanetSpec): OrbitalElements3D {
  return {
    ...elementsFor(planet),
    inclinationRad: planet.inclinationRad,
    ascendingNodeRad: planet.ascendingNodeRad,
  };
}
```

Add methods to `Simulation`:

```ts
  /** 3D snapshot: real inclined planet positions; moons on ecliptic-parallel rings. */
  snapshot3D(): Snapshot3D {
    const { simDays } = this.clock;
    const bodies: BodySnapshot3D[] = [
      { name: SUN.name, x: 0, y: 0, z: 0, bodyRadius: SUN.bodyRadius, color: SUN.color, kind: 'sun' },
    ];

    for (const planet of PLANETS) {
      const au = ellipticalPosition3dAu(elements3dFor(planet), simDays);
      const pos = { x: au.x * AU_TO_WORLD, y: au.y * AU_TO_WORLD, z: au.z * AU_TO_WORLD };
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
          x: mpos.x,
          y: mpos.y,
          z: pos.z,
          bodyRadius: MOON_STYLE.bodyRadius,
          color: MOON_STYLE.color,
          kind: 'moon',
        });
      }
    }

    return { simDays, bodies };
  }

  /** One 256-point 3D loop per major body, in world units. */
  orbitPaths3D(): Vec3[][] {
    return PLANETS.map((planet) =>
      ellipticalPath3dAu(elements3dFor(planet)).map((p) => ({
        x: p.x * AU_TO_WORLD,
        y: p.y * AU_TO_WORLD,
        z: p.z * AU_TO_WORLD,
      })),
    );
  }

  cometBody3D(cometName: string): BodySnapshot3D | null {
    const comet = this.findComet(cometName);
    if (!comet) return null;
    const au = cometPosition3dAu(comet, this.clock.simDays);
    return {
      name: comet.name,
      x: au.x * AU_TO_WORLD,
      y: au.y * AU_TO_WORLD,
      z: au.z * AU_TO_WORLD,
      bodyRadius: comet.bodyRadius,
      color: comet.color,
      kind: 'comet',
    };
  }

  cometPath3D(cometName: string): CometPath3DRender | null {
    const comet = this.findComet(cometName);
    if (!comet) return null;
    const points = cometPath3dAu(comet).map((p) => ({
      x: p.x * AU_TO_WORLD,
      y: p.y * AU_TO_WORLD,
      z: p.z * AU_TO_WORLD,
    }));
    return { points, color: comet.cometClass === 'hyperbolic' ? 'red' : 'green' };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Build and commit**

```bash
npm run build
git add src/sim/simulation.ts src/sim/simulation.test.ts
git commit -m "feat: expose 3D snapshots, orbit paths, and comet accessors from Simulation"
```

---

### Task 5: Three.js dependency, texture assets, and texture registry

**Files:**
- Modify: `package.json` / `package-lock.json` (via npm)
- Create: `public/textures/` (11 downloaded files)
- Create: `src/render3d/textures.ts`
- Test: `src/render3d/textures.test.ts`
- Modify: `README.md` (attribution)

**Interfaces:**
- Produces (used by Task 6):
  - `textureUrl(bodyName: string): string | null`
  - `saturnRingUrl(): string`
  - `BODY_TEXTURE_FILES: Record<string, string>`, `SATURN_RING_FILE: string`, `TEXTURE_BASE: string`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install three
npm install -D @types/three
```
Expected: both added to `package.json`; `npm run build` still clean.

- [ ] **Step 2: Download textures (Solar System Scope, CC BY 4.0)**

```bash
mkdir -p public/textures
cd public/textures
curl -fL -o 2k_sun.jpg               https://www.solarsystemscope.com/textures/download/2k_sun.jpg
curl -fL -o 2k_mercury.jpg           https://www.solarsystemscope.com/textures/download/2k_mercury.jpg
curl -fL -o 2k_venus_atmosphere.jpg  https://www.solarsystemscope.com/textures/download/2k_venus_atmosphere.jpg
curl -fL -o 2k_earth_daymap.jpg      https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg
curl -fL -o 2k_moon.jpg              https://www.solarsystemscope.com/textures/download/2k_moon.jpg
curl -fL -o 2k_mars.jpg              https://www.solarsystemscope.com/textures/download/2k_mars.jpg
curl -fL -o 2k_jupiter.jpg           https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg
curl -fL -o 2k_saturn.jpg            https://www.solarsystemscope.com/textures/download/2k_saturn.jpg
curl -fL -o 2k_saturn_ring_alpha.png https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png
curl -fL -o 2k_uranus.jpg            https://www.solarsystemscope.com/textures/download/2k_uranus.jpg
curl -fL -o 2k_neptune.jpg           https://www.solarsystemscope.com/textures/download/2k_neptune.jpg
cd ../..
```

Verify: every file exists and is a real image, not an HTML error page — each `.jpg` should be several hundred KB+:
```bash
ls -la public/textures
```
**If any download fails or returns a tiny/HTML file, STOP and report back — do not substitute a different source without a spec update.**

- [ ] **Step 3: Write the failing test**

Create `src/render3d/textures.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BODY_TEXTURE_FILES, SATURN_RING_FILE, saturnRingUrl, textureUrl } from './textures';

const texturesDir = fileURLToPath(new URL('../../public/textures/', import.meta.url));

describe('texture registry', () => {
  it('maps the sun, the 8 planets, and the Moon', () => {
    expect(Object.keys(BODY_TEXTURE_FILES).sort()).toEqual([
      'Earth', 'Jupiter', 'Mars', 'Mercury', 'Moon',
      'Neptune', 'Saturn', 'Sun', 'Uranus', 'Venus',
    ]);
  });

  it('builds URLs under /textures and returns null for unmapped bodies', () => {
    expect(textureUrl('Earth')).toBe('/textures/2k_earth_daymap.jpg');
    expect(saturnRingUrl()).toBe('/textures/2k_saturn_ring_alpha.png');
    expect(textureUrl('Pluto')).toBeNull();
    expect(textureUrl('Halley')).toBeNull();
  });

  it('has every registered file on disk', () => {
    for (const [name, file] of Object.entries(BODY_TEXTURE_FILES)) {
      expect(existsSync(texturesDir + file), `${name}: ${file}`).toBe(true);
    }
    expect(existsSync(texturesDir + SATURN_RING_FILE)).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- textures`
Expected: FAIL — cannot resolve `./textures`.

- [ ] **Step 5: Implement `src/render3d/textures.ts`**

```ts
/** Base URL (under public/) where texture maps live. */
export const TEXTURE_BASE = '/textures';

/**
 * Equirectangular diffuse maps by body name (Solar System Scope, CC BY 4.0).
 * Bodies without an entry render in their flat data.ts color.
 */
export const BODY_TEXTURE_FILES: Record<string, string> = {
  Sun: '2k_sun.jpg',
  Mercury: '2k_mercury.jpg',
  Venus: '2k_venus_atmosphere.jpg',
  Earth: '2k_earth_daymap.jpg',
  Moon: '2k_moon.jpg',
  Mars: '2k_mars.jpg',
  Jupiter: '2k_jupiter.jpg',
  Saturn: '2k_saturn.jpg',
  Uranus: '2k_uranus.jpg',
  Neptune: '2k_neptune.jpg',
};

export const SATURN_RING_FILE = '2k_saturn_ring_alpha.png';

export function textureUrl(bodyName: string): string | null {
  const file = BODY_TEXTURE_FILES[bodyName];
  return file ? `${TEXTURE_BASE}/${file}` : null;
}

export function saturnRingUrl(): string {
  return `${TEXTURE_BASE}/${SATURN_RING_FILE}`;
}
```

- [ ] **Step 6: Add attribution to `README.md`**

Add a section (near the end, after existing content):

```md
## Textures

Planet, Sun, and Moon texture maps in `public/textures/` are from
[Solar System Scope](https://www.solarsystemscope.com/textures/), licensed
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
```

- [ ] **Step 7: Run tests, build, commit**

Run: `npm test` and `npm run build` — expected: green.

```bash
git add package.json package-lock.json public/textures src/render3d/textures.ts src/render3d/textures.test.ts README.md
git commit -m "feat: add three.js dependency and CC-BY planet texture assets"
```

---

### Task 6: 3D scene objects — bodies, orbit lines, asteroid belt

**Files:**
- Modify: `src/render/asteroidBelt.ts` (export `mulberry32`)
- Create: `src/render3d/bodies.ts`
- Create: `src/render3d/orbits.ts`
- Create: `src/render3d/belt.ts`
- Test: `src/render3d/sceneObjects.test.ts`

**Interfaces:**
- Consumes: `textureUrl`, `saturnRingUrl` (Task 5); `BodySnapshot3D` (Task 4); `orbitalPlaneToEcliptic` (Task 2); `ASTEROID_BELT`, `angleAt`, `Layout`, `mulberry32`.
- Produces (used by Task 7):
  - `createBodyObject(body: BodySnapshot3D, loader: THREE.TextureLoader): THREE.Group` — sphere (+ glow sprite for Sun, + ring for Saturn), `group.name = body.name`
  - `createOrbitLine(points: Vec3[]): THREE.LineLoop`
  - `createCometPathLine(points: Vec3[], color: 'green' | 'red'): THREE.Line`
  - `interface BeltAsteroid3D { orbitRadius: number; angleOffset: number; periodDays: number; inclinationRad: number; ascendingNodeRad: number }`
  - `buildBelt3d(layout: Layout, seed: number, count: number): BeltAsteroid3D[]`
  - `createBeltPoints(count: number): THREE.Points`
  - `updateBeltPositions(points: THREE.Points, belt: BeltAsteroid3D[], simDays: number): void`
  - `const BELT_MAX_INCLINATION_RAD`

- [ ] **Step 1: Export `mulberry32` from `src/render/asteroidBelt.ts`**

Change `function mulberry32(seed: number)` to `export function mulberry32(seed: number)`. No other change; run `npm test -- asteroidBelt` — expected: PASS.

- [ ] **Step 2: Write the failing tests**

Create `src/render3d/sceneObjects.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../sim/layout';
import { ASTEROID_BELT, MOONS, PLANETS } from '../sim/data';
import type { BodySnapshot3D } from '../sim/simulation';
import { createBodyObject } from './bodies';
import { createCometPathLine, createOrbitLine } from './orbits';
import {
  BELT_MAX_INCLINATION_RAD,
  buildBelt3d,
  createBeltPoints,
  updateBeltPositions,
} from './belt';

const layout = computeLayout(PLANETS, MOONS);

const mars: BodySnapshot3D = {
  name: 'Mars', x: 0, y: 0, z: 0, bodyRadius: 5, color: '#c1440e', kind: 'planet',
};
const saturn: BodySnapshot3D = {
  name: 'Saturn', x: 0, y: 0, z: 0, bodyRadius: 12, color: '#e0c38b', kind: 'planet',
};

describe('createBodyObject', () => {
  it('wraps a sphere of the body radius in a named group', () => {
    const group = createBodyObject(mars, new THREE.TextureLoader());
    expect(group.name).toBe('Mars');
    const mesh = group.children[0] as THREE.Mesh;
    expect((mesh.geometry as THREE.SphereGeometry).parameters.radius).toBe(5);
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it('gives Saturn a ring child', () => {
    const group = createBodyObject(saturn, new THREE.TextureLoader());
    expect(group.children.length).toBe(2);
    const ring = group.children[1] as THREE.Mesh;
    expect(ring.geometry).toBeInstanceOf(THREE.RingGeometry);
  });

  it('uses an unlit material for sun and comet bodies', () => {
    const comet: BodySnapshot3D = {
      name: 'Halley', x: 0, y: 0, z: 0, bodyRadius: 3, color: '#dbeeff', kind: 'comet',
    };
    const mesh = createBodyObject(comet, new THREE.TextureLoader()).children[0] as THREE.Mesh;
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
  });
});

describe('orbit lines', () => {
  const points = [
    { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0.2 }, { x: -1, y: 0, z: 0 }, { x: 0, y: -1, z: -0.2 },
  ];

  it('createOrbitLine builds a closed loop with one vertex per point', () => {
    const line = createOrbitLine(points);
    expect(line).toBeInstanceOf(THREE.LineLoop);
    expect(line.geometry.getAttribute('position').count).toBe(4);
  });

  it('createCometPathLine colors bound green and unbound red', () => {
    const green = createCometPathLine(points, 'green');
    const red = createCometPathLine(points, 'red');
    expect((green.material as THREE.LineBasicMaterial).color.getHexString()).toBe('5adc82');
    expect((red.material as THREE.LineBasicMaterial).color.getHexString()).toBe('f05a5a');
  });
});

describe('belt', () => {
  it('is deterministic for a seed and stays inside the to-scale band', () => {
    const a = buildBelt3d(layout, ASTEROID_BELT.seed, 50);
    const b = buildBelt3d(layout, ASTEROID_BELT.seed, 50);
    expect(a).toEqual(b);
    const { inner, outer } = ASTEROID_BELT.getRadii(layout, 'toScale');
    for (const ast of a) {
      expect(ast.orbitRadius).toBeGreaterThanOrEqual(inner);
      expect(ast.orbitRadius).toBeLessThanOrEqual(outer);
      expect(ast.inclinationRad).toBeGreaterThanOrEqual(0);
      expect(ast.inclinationRad).toBeLessThanOrEqual(BELT_MAX_INCLINATION_RAD);
    }
  });

  it('updateBeltPositions writes bounded 3D positions for every asteroid', () => {
    const belt = buildBelt3d(layout, ASTEROID_BELT.seed, 25);
    const points = createBeltPoints(25);
    updateBeltPositions(points, belt, 1234);
    const attr = points.geometry.getAttribute('position');
    for (let i = 0; i < 25; i++) {
      const x = attr.getX(i);
      const y = attr.getY(i);
      const z = attr.getZ(i);
      expect(Math.hypot(x, y, z)).toBeCloseTo(belt[i].orbitRadius, 8);
      expect(Math.abs(z)).toBeLessThanOrEqual(
        belt[i].orbitRadius * Math.sin(belt[i].inclinationRad) + 1e-9,
      );
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- sceneObjects`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/render3d/orbits.ts`**

```ts
import * as THREE from 'three';
import type { Vec3 } from '../sim/types';

const ORBIT_GUIDE_COLOR = 0xffffff;
const ORBIT_GUIDE_OPACITY = 0.15;
const COMET_GREEN = 0x5adc82;
const COMET_RED = 0xf05a5a;
const COMET_PATH_OPACITY = 0.85;

function lineGeometry(points: Vec3[]): THREE.BufferGeometry {
  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/** Faint closed guide loop for a planet orbit. */
export function createOrbitLine(points: Vec3[]): THREE.LineLoop {
  return new THREE.LineLoop(
    lineGeometry(points),
    new THREE.LineBasicMaterial({
      color: ORBIT_GUIDE_COLOR,
      transparent: true,
      opacity: ORBIT_GUIDE_OPACITY,
    }),
  );
}

/** Open comet path; green = bound orbit, red = unbound (educational cue). */
export function createCometPathLine(points: Vec3[], color: 'green' | 'red'): THREE.Line {
  return new THREE.Line(
    lineGeometry(points),
    new THREE.LineBasicMaterial({
      color: color === 'red' ? COMET_RED : COMET_GREEN,
      transparent: true,
      opacity: COMET_PATH_OPACITY,
    }),
  );
}
```

- [ ] **Step 5: Implement `src/render3d/bodies.ts`**

```ts
import * as THREE from 'three';
import type { BodySnapshot3D } from '../sim/simulation';
import { saturnRingUrl, textureUrl } from './textures';

const SPHERE_WIDTH_SEGMENTS = 32;
const SPHERE_HEIGHT_SEGMENTS = 16;
const SATURN_RING_INNER_FACTOR = 1.24;
const SATURN_RING_OUTER_FACTOR = 2.27;
const SATURN_RING_TILT_RAD = (26.7 * Math.PI) / 180;
const SUN_GLOW_SCALE = 6;

type BodyMaterial = THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;

function applyTexture(material: BodyMaterial, url: string, loader: THREE.TextureLoader): void {
  loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    material.map = tex;
    material.color.set('#ffffff'); // stop tinting once the real map arrives
    material.needsUpdate = true;
  });
}

/** Soft additive-looking glow sprite behind the sun (canvas radial gradient). */
function createSunGlow(radius: number): THREE.Sprite {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 204, 51, 0.5)');
    g.addColorStop(1, 'rgba(255, 204, 51, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    material.map = new THREE.CanvasTexture(canvas);
  }
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(radius * SUN_GLOW_SCALE);
  return sprite;
}

function createSaturnRing(bodyRadius: number, loader: THREE.TextureLoader): THREE.Mesh {
  const inner = bodyRadius * SATURN_RING_INNER_FACTOR;
  const outer = bodyRadius * SATURN_RING_OUTER_FACTOR;
  const geometry = new THREE.RingGeometry(inner, outer, 64);
  // Remap UVs so u runs radially — ring alpha maps are radial strips.
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 1);
  }
  const material = new THREE.MeshBasicMaterial({
    color: '#e0c38b',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
  applyTexture(material, saturnRingUrl(), loader);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = SATURN_RING_TILT_RAD;
  return mesh;
}

/**
 * Sphere (+ glow for the Sun, + ring for Saturn) in a group named after the
 * body. Renders immediately in the body's flat color; swaps to its texture
 * map when the async load completes.
 */
export function createBodyObject(body: BodySnapshot3D, loader: THREE.TextureLoader): THREE.Group {
  const geometry = new THREE.SphereGeometry(
    body.bodyRadius,
    SPHERE_WIDTH_SEGMENTS,
    SPHERE_HEIGHT_SEGMENTS,
  );
  const unlit = body.kind === 'sun' || body.kind === 'comet';
  const material: BodyMaterial = unlit
    ? new THREE.MeshBasicMaterial({ color: body.color })
    : new THREE.MeshStandardMaterial({ color: body.color, roughness: 1, metalness: 0 });
  const url = textureUrl(body.name);
  if (url) applyTexture(material, url, loader);

  const group = new THREE.Group();
  group.name = body.name;
  group.add(new THREE.Mesh(geometry, material));
  if (body.kind === 'sun') group.add(createSunGlow(body.bodyRadius));
  if (body.name === 'Saturn') group.add(createSaturnRing(body.bodyRadius, loader));
  return group;
}
```

- [ ] **Step 6: Implement `src/render3d/belt.ts`**

```ts
import * as THREE from 'three';
import { ASTEROID_BELT } from '../sim/data';
import type { Layout } from '../sim/layout';
import { angleAt } from '../sim/orbits';
import { orbitalPlaneToEcliptic } from '../sim/orbit3d';
import { mulberry32 } from '../render/asteroidBelt';

/** Real main-belt objects mostly sit below ~8° inclination. */
export const BELT_MAX_INCLINATION_RAD = (8 * Math.PI) / 180;

export interface BeltAsteroid3D {
  orbitRadius: number;
  angleOffset: number;
  periodDays: number;
  inclinationRad: number;
  ascendingNodeRad: number;
}

/** Deterministic 3D belt in the to-scale band between Mars and Jupiter. */
export function buildBelt3d(layout: Layout, seed: number, count: number): BeltAsteroid3D[] {
  const rand = mulberry32(seed);
  const { inner, outer } = ASTEROID_BELT.getRadii(layout, 'toScale');
  const belt: BeltAsteroid3D[] = [];
  for (let i = 0; i < count; i++) {
    belt.push({
      orbitRadius: inner + rand() * (outer - inner),
      angleOffset: rand() * Math.PI * 2,
      periodDays: 1200 + rand() * 800,
      inclinationRad: rand() * BELT_MAX_INCLINATION_RAD,
      ascendingNodeRad: rand() * Math.PI * 2,
    });
  }
  return belt;
}

export function createBeltPoints(count: number): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const material = new THREE.PointsMaterial({
    color: 0xaaaabe,
    transparent: true,
    opacity: 0.45,
    size: 2,
    sizeAttenuation: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // positions change every frame; skip bounds upkeep
  return points;
}

export function updateBeltPositions(
  points: THREE.Points,
  belt: BeltAsteroid3D[],
  simDays: number,
): void {
  const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
  belt.forEach((a, i) => {
    const angle = a.angleOffset + angleAt(a.periodDays, simDays);
    const p = orbitalPlaneToEcliptic(
      {
        inclinationRad: a.inclinationRad,
        ascendingNodeRad: a.ascendingNodeRad,
        perihelionLongitudeRad: a.ascendingNodeRad, // ω = 0: circular, phase-only orbit
      },
      a.orbitRadius,
      angle,
    );
    attr.setXYZ(i, p.x, p.y, p.z);
  });
  attr.needsUpdate = true;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (including the untouched `asteroidBelt.test.ts`).

- [ ] **Step 8: Build and commit**

```bash
npm run build
git add src/render/asteroidBelt.ts src/render3d/bodies.ts src/render3d/orbits.ts src/render3d/belt.ts src/render3d/sceneObjects.test.ts
git commit -m "feat: add 3D scene object factories (bodies, orbit lines, inclined belt)"
```

---

### Task 7: OrbitControls wrapper and ThreeRenderer

**Files:**
- Create: `src/render3d/controls.ts`
- Create: `src/render3d/ThreeRenderer.ts`
- Create: `src/render3d/index.ts`

**Interfaces:**
- Consumes: Tasks 4–6 exports.
- Produces (used by Task 8):
  - `createControls(camera: THREE.PerspectiveCamera, canvas: HTMLElement): OrbitControls`
  - `class ThreeRenderer`:
    - `constructor(canvas: HTMLCanvasElement, orbitPaths: Vec3[][], belt: BeltAsteroid3D[], extent: number)`
    - `setSize(width: number, height: number, dpr: number): void`
    - `sync(snap: Snapshot3D, cometPath: CometPath3DRender | null, cometKey: string | null): void`
    - `render(): void`
    - `resetView(extent: number): void`
    - `dispose(): void`
  - `src/render3d/index.ts` re-exports `ThreeRenderer` and `buildBelt3d` (single dynamic-import entry point for the code-split chunk)

No unit tests: `THREE.WebGLRenderer` needs a GPU context jsdom cannot provide. Correctness lives in the tested sim/scene-object layers; this class stays a thin imperative shell. Verified by `npm run build` (types) and Task 9's manual run.

- [ ] **Step 1: Implement `src/render3d/controls.ts`**

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Orbit-around-target navigation, configured per the design spec:
 * damping/inertia, distance clamps, zoom-to-cursor, screen-space pan, and
 * standard touch gestures (1-finger rotate, 2-finger pinch-zoom + pan).
 * Double-click re-centers the focus on the Sun.
 */
export function createControls(camera: THREE.PerspectiveCamera, canvas: HTMLElement): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 40;
  controls.maxDistance = 60000;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  canvas.addEventListener('dblclick', () => {
    controls.target.set(0, 0, 0);
  });
  return controls;
}
```

- [ ] **Step 2: Implement `src/render3d/ThreeRenderer.ts`**

```ts
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BodySnapshot3D, CometPath3DRender, Snapshot3D } from '../sim/simulation';
import type { Vec3 } from '../sim/types';
import { createBodyObject } from './bodies';
import { createBeltPoints, updateBeltPositions, type BeltAsteroid3D } from './belt';
import { createControls } from './controls';
import { createCometPathLine, createOrbitLine } from './orbits';

const BACKGROUND = 0x0a0e1a;
const AMBIENT_COLOR = 0x333344;
const AMBIENT_INTENSITY = 1.2;
const SUN_LIGHT_INTENSITY = 2.5;
const CAMERA_FOV_DEG = 50;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 200000;
const TAIL_COLOR = 0xdcf0ff;
const TAIL_OPACITY = 0.5;
const TAIL_MIN_WORLD = 30;
const TAIL_MAX_WORLD = 200;
const TAIL_SCALE = 20000;

/**
 * Imperative WebGL backend for the 3D view mode. Mirrors drawScene's role:
 * one sync() + render() per RAF tick. World axes match the sim (x/y ecliptic,
 * z north); the camera is z-up.
 */
export class ThreeRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private loader = new THREE.TextureLoader();
  private bodyObjects = new Map<string, THREE.Group>();
  private belt: BeltAsteroid3D[];
  private beltPoints: THREE.Points;
  private cometLine: { key: string; line: THREE.Line } | null = null;
  private tailLine: THREE.Line;

  constructor(canvas: HTMLCanvasElement, orbitPaths: Vec3[][], belt: BeltAsteroid3D[], extent: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.scene.background = new THREE.Color(BACKGROUND);
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, CAMERA_NEAR, CAMERA_FAR);
    this.camera.up.set(0, 0, 1);
    this.controls = createControls(this.camera, canvas);

    this.scene.add(new THREE.AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY));
    // decay 0: stylized — planets stay lit at real distances.
    this.scene.add(new THREE.PointLight(0xffffff, SUN_LIGHT_INTENSITY, 0, 0));

    for (const path of orbitPaths) this.scene.add(createOrbitLine(path));

    this.belt = belt;
    this.beltPoints = createBeltPoints(belt.length);
    this.scene.add(this.beltPoints);

    const tailGeometry = new THREE.BufferGeometry();
    tailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tailLine = new THREE.Line(
      tailGeometry,
      new THREE.LineBasicMaterial({ color: TAIL_COLOR, transparent: true, opacity: TAIL_OPACITY }),
    );
    this.tailLine.visible = false;
    this.tailLine.frustumCulled = false;
    this.scene.add(this.tailLine);

    this.resetView(extent);
  }

  setSize(width: number, height: number, dpr: number): void {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  /** Frames a world radius: focus on the Sun, ~30° above the ecliptic. */
  resetView(extent: number): void {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, -extent * 1.2, extent * 0.7);
    this.camera.lookAt(0, 0, 0);
  }

  sync(snap: Snapshot3D, cometPath: CometPath3DRender | null, cometKey: string | null): void {
    const seen = new Set<string>();
    let comet: BodySnapshot3D | null = null;
    for (const body of snap.bodies) {
      seen.add(body.name);
      let obj = this.bodyObjects.get(body.name);
      if (!obj) {
        obj = createBodyObject(body, this.loader);
        this.bodyObjects.set(body.name, obj);
        this.scene.add(obj);
      }
      obj.visible = true;
      obj.position.set(body.x, body.y, body.z);
      if (body.kind === 'comet') comet = body;
    }
    for (const [name, obj] of this.bodyObjects) {
      if (!seen.has(name)) obj.visible = false;
    }

    this.tailLine.visible = comet !== null;
    if (comet) this.updateTail(comet);

    if (this.cometLine && (!cometPath || this.cometLine.key !== cometKey)) {
      this.scene.remove(this.cometLine.line);
      this.cometLine.line.geometry.dispose();
      (this.cometLine.line.material as THREE.Material).dispose();
      this.cometLine = null;
    }
    if (cometPath && cometKey && !this.cometLine) {
      const line = createCometPathLine(cometPath.points, cometPath.color);
      this.cometLine = { key: cometKey, line };
      this.scene.add(line);
    }

    updateBeltPositions(this.beltPoints, this.belt, snap.simDays);
  }

  private updateTail(comet: BodySnapshot3D): void {
    const r = Math.hypot(comet.x, comet.y, comet.z) || 1;
    const len = Math.max(TAIL_MIN_WORLD, Math.min(TAIL_MAX_WORLD, TAIL_SCALE / r));
    const attr = this.tailLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.setXYZ(0, comet.x, comet.y, comet.z);
    attr.setXYZ(
      1,
      comet.x + (comet.x / r) * len,
      comet.y + (comet.y / r) * len,
      comet.z + (comet.z / r) * len,
    );
    attr.needsUpdate = true;
  }

  render(): void {
    this.controls.update(); // damping needs a per-frame tick
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.controls.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as Partial<THREE.Mesh> & THREE.Object3D;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => disposeMaterial(m));
      else if (material) disposeMaterial(material);
    });
    this.renderer.dispose();
  }
}

function disposeMaterial(material: THREE.Material): void {
  const mapped = material as THREE.Material & { map?: THREE.Texture | null };
  mapped.map?.dispose();
  material.dispose();
}
```

- [ ] **Step 3: Implement `src/render3d/index.ts`**

```ts
export { ThreeRenderer } from './ThreeRenderer';
export { buildBelt3d, type BeltAsteroid3D } from './belt';
```

- [ ] **Step 4: Verify with typecheck + full tests**

Run: `npm run build` — expected: clean compile (this is the verification gate for this task).
Run: `npm test` — expected: PASS, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/render3d/controls.ts src/render3d/ThreeRenderer.ts src/render3d/index.ts
git commit -m "feat: add Three.js renderer with orbit-around-target controls"
```

---

### Task 8: UI wiring — ViewMode, Toolbar "3D" entry, dual canvas, hook integration

**Files:**
- Modify: `src/sim/types.ts` (add `ViewMode`)
- Modify: `src/ui/Toolbar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/hooks/useSimulation.ts`
- Test: `src/hooks/useSimulation.test.tsx` (extend)

**Interfaces:**
- Consumes: `ThreeRenderer`, `buildBelt3d` via `import('../render3d')`; Simulation 3D API (Task 4).
- Produces: `type ViewMode = ScaleMode | 'threeD'`; `useSimulation(canvasRef, canvas3dRef?)` — same return shape, `mode: ViewMode`; `ToolbarProps.mode: ViewMode`, `onSelectMode: (mode: ViewMode) => void`.

- [ ] **Step 1: Write the failing tests**

In `src/hooks/useSimulation.test.tsx`, add inside the top-level `describe`:

```tsx
  it('accepts the threeD view mode', () => {
    let hookState: any;

    function TestThreeD() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef, canvas3dRef);
      return (
        <>
          <canvas ref={canvasRef} />
          <canvas ref={canvas3dRef} />
        </>
      );
    }

    render(<TestThreeD />);

    act(() => {
      hookState.setMode('threeD');
    });

    expect(hookState.mode).toBe('threeD');
  });

  it('selecting a comet keeps 3D mode (no forced switch to to-scale)', () => {
    let hookState: any;

    function TestCometIn3D() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef, canvas3dRef);
      return (
        <>
          <canvas ref={canvasRef} />
          <canvas ref={canvas3dRef} />
        </>
      );
    }

    render(<TestCometIn3D />);

    act(() => {
      hookState.setMode('threeD');
    });
    act(() => {
      hookState.selectComet('Halley');
    });

    expect(hookState.mode).toBe('threeD');
    expect(hookState.selectedComet).toBe('Halley');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useSimulation`
Expected: FAIL — `setMode('threeD')` rejected by types / comet selection forces `'toScale'`.

- [ ] **Step 3: Add `ViewMode` to `src/sim/types.ts`**

Below `ScaleMode`:

```ts
/** UI-level view mode: the two 2D scale modes plus the WebGL 3D view. */
export type ViewMode = ScaleMode | 'threeD';
```

- [ ] **Step 4: Add the third mode to `src/ui/Toolbar.tsx`**

Change the import and types from `ScaleMode` to `ViewMode`:

```ts
import type { ViewMode } from '../sim/types';
```

In `ToolbarProps`: `mode: ViewMode;` and `onSelectMode: (mode: ViewMode) => void;`.

Extend `MODES`:

```ts
const MODES: { value: ViewMode; label: string }[] = [
  { value: 'schematic', label: 'Schematic' },
  { value: 'toScale', label: 'To Scale' },
  { value: 'threeD', label: '3D' },
];
```

In the `<select className="mode-select">` handler: `onSelectMode(e.target.value as ViewMode)`.

- [ ] **Step 5: Dual canvas in `src/App.tsx` and CSS**

In `App.tsx`, add a second ref and canvas; hide the inactive one with the `hidden` attribute:

```tsx
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
  const {
    multiplier, paused, mode, date, setMultiplier, togglePause, setMode,
    seekToDate, goToToday,
    cometsEnabled, selectedComet, setCometsEnabled, selectComet, jumpToPerihelion,
  } = useSimulation(canvasRef, canvas3dRef);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" hidden={mode === 'threeD'} />
      <canvas ref={canvas3dRef} className="scene" hidden={mode !== 'threeD'} />
      {/* ...rest unchanged (Toolbar, CometPicker, DateDisplay)... */}
```

In `src/styles.css`, after the `.scene` rule (`.scene` sets `display: block`, which would defeat the `hidden` attribute without this):

```css
.scene[hidden] {
  display: none;
}
```

- [ ] **Step 6: Wire the hook (`src/hooks/useSimulation.ts`)**

6a. Imports and signature:

```ts
import type { ScaleMode, ViewMode } from '../sim/types';
import type { CometPath3DRender } from '../sim/simulation';
import type { ThreeRenderer } from '../render3d';
```

```ts
export function useSimulation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  canvas3dRef?: React.RefObject<HTMLCanvasElement | null>,
) {
```

State becomes `ViewMode`: `const [mode, setModeState] = useState<ViewMode>('schematic');` and `applyModeRef` becomes `useRef<(m: ViewMode) => void>(() => {});`.

6b. Inside the effect, next to the existing locals:

```ts
    const canvas3d = canvas3dRef?.current ?? null;
    let currentMode: ViewMode = 'schematic';
    let pendingMode: ViewMode | null = null;
    let threeRenderer: ThreeRenderer | null = null;
    let threeLoading = false;
    let disposed = false;
```

(`currentMode`/`pendingMode` replace the existing `ScaleMode`-typed declarations.)

6c. In `resize()`, after the existing 2D sizing, add:

```ts
      threeRenderer?.setSize(width, height, dpr);
```

6d. Replace the `pendingMode` block in the loop with:

```ts
      if (pendingMode !== null && width > 0 && height > 0) {
        currentMode = pendingMode;
        pendingMode = null;
        if (currentMode !== 'threeD') {
          asteroids = buildAsteroidBelt(
            sim.layout,
            ASTEROID_BELT.seed,
            ASTEROID_BELT.count,
            currentMode,
          );
          camera.fitToView(sim.extent(currentMode), width, height);
        } else {
          threeRenderer?.resetView(sim.extent('toScale'));
        }
      }
```

6e. Replace the comet-frame / reset-frame / draw section of the loop with a mode branch. The 2D branch is the existing code unchanged (with `currentMode` narrowed); the 3D branch lazily loads the renderer:

```ts
      if (currentMode === 'threeD') {
        if (!threeRenderer && !threeLoading && canvas3d) {
          threeLoading = true;
          void import('../render3d').then((m) => {
            if (disposed) return;
            const belt = m.buildBelt3d(sim.layout, ASTEROID_BELT.seed, ASTEROID_BELT.count);
            threeRenderer = new m.ThreeRenderer(
              canvas3d,
              sim.orbitPaths3D(),
              belt,
              sim.extent('toScale'),
            );
            threeRenderer.setSize(width, height, window.devicePixelRatio || 1);
            threeLoading = false;
          });
        }
        if (threeRenderer) {
          const frameComet3d = pendingCometFrameRef.current;
          if (frameComet3d !== null) {
            pendingCometFrameRef.current = null;
            const extent = sim.cometExtent(frameComet3d);
            if (extent > 0) threeRenderer.resetView(extent);
          }
          if (pendingResetFrameRef.current) {
            pendingResetFrameRef.current = false;
            threeRenderer.resetView(sim.extent('toScale'));
          }
          const snap3 = sim.snapshot3D();
          const cometName =
            cometsEnabledRef.current && selectedCometRef.current
              ? selectedCometRef.current
              : null;
          let path3: CometPath3DRender | null = null;
          if (cometName) {
            path3 = sim.cometPath3D(cometName);
            const body3 = sim.cometBody3D(cometName);
            if (body3) snap3.bodies.push(body3);
          }
          threeRenderer.sync(snap3, path3, cometName);
          threeRenderer.render();
        }
      } else {
        if (threeRenderer) {
          threeRenderer.dispose();
          threeRenderer = null;
        }
        // ...existing 2D code: pendingCometFrameRef / pendingResetFrameRef
        // handling, cometPathRender, snapshot, drawScene — UNCHANGED, using
        // currentMode (narrowed to ScaleMode here).
      }
```

Note: the pending-frame refs are consumed by whichever branch is active, so a pending comet frame set while the 3D chunk is still loading stays pending until the renderer exists.

6f. Cleanup — in the effect's return, add before the listener removals:

```ts
      disposed = true;
      threeRenderer?.dispose();
      threeRenderer = null;
```

6g. `setMode` takes `ViewMode`:

```ts
  const setMode = (m: ViewMode) => {
    applyModeRef.current(m);
    setModeState(m);
  };
```

6h. `selectComet`: only force to-scale from schematic (3D already shows real orbits):

```ts
  const selectComet = (name: string | null) => {
    selectedCometRef.current = name;
    setSelectedComet(name);
    if (name) {
      if (mode === 'schematic') {
        applyModeRef.current('toScale');
        setModeState('toScale');
      }
      pendingCometFrameRef.current = name;
    } else {
      pendingResetFrameRef.current = true;
    }
  };
```

Effect dependency array becomes `[canvasRef, canvas3dRef]`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — the two new tests plus every existing test (in particular: "selecting a comet switches to to-scale mode" still passes, since the default mode is schematic).

- [ ] **Step 8: Build and commit**

```bash
npm run build
git add src/sim/types.ts src/ui/Toolbar.tsx src/App.tsx src/styles.css src/hooks/useSimulation.ts src/hooks/useSimulation.test.tsx
git commit -m "feat: add 3D view mode with dual-canvas renderer switching"
```

---

### Task 9: Docs, full verification, and manual 3D check

**Files:**
- Modify: `AGENTS.md`
- Verify: whole app

- [ ] **Step 1: Update `AGENTS.md`**

In "Project Overview", extend the first paragraph's feature list with: `a **3D view mode** (Three.js WebGL renderer with real orbital inclinations and orbit-around-target navigation),`.

In "Directory Structure", update the `src/sim/` bullet to mention `orbit3d.ts` (3D transform `Rz(Ω)·Rx(i)·Rz(ω)`, comet 3D positions/paths) and add:

```md
- `src/render3d/` — Three.js WebGL backend for the 3D view mode (`ThreeRenderer`,
  `bodies` incl. textures + Saturn ring, `orbits`, `belt`, `controls` =
  configured OrbitControls, `textures` registry). Loaded lazily via dynamic
  import when the user first switches to 3D; disposed on switching away.
  Three.js must not be imported outside this directory.
```

Add a new section after "Orbital Model":

```md
### 3D view mode

The toolbar mode switcher is `[ Schematic | To Scale | 3D ]` (`ViewMode =
ScaleMode | 'threeD'` in `src/sim/types.ts`). The two 2D modes render to the
2D canvas exactly as before; 3D renders to a second WebGL canvas (a canvas
can hold only one context type).

- Positions come from `snapshot3D()` / `orbitPaths3D()` / `cometBody3D()` /
  `cometPath3D()` on `Simulation`, which lift the in-plane Keplerian solve
  into ecliptic 3D via `orbitalPlaneToEcliptic` (`src/sim/orbit3d.ts`) using
  per-body `inclinationRad` + `ascendingNodeRad` (J2000 / SBDB values in
  `data.ts`; ω is always derived as ϖ − Ω, never stored).
- Comets in 3D use their real inclination — no mean-anomaly negation; the 2D
  modes keep using the `retrograde` flag. Selecting a comet in 3D stays in 3D
  (only schematic force-switches to To Scale).
- Moons are a deliberate stylization: ecliptic-parallel rings at the parent's
  z (no per-moon elements). The belt gets per-asteroid random i ≤ 8° and Ω.
- Navigation: Three `OrbitControls` (damping, min/max distance,
  zoom-to-cursor, 1-finger rotate / 2-finger pinch-pan, double-click
  re-centers the Sun).
- No text labels in 3D (v1); bodies without a texture render flat-colored.
- Textures: `public/textures/` (Solar System Scope, CC BY 4.0, attributed in
  README). Meshes show their flat color until the map loads.
```

- [ ] **Step 2: Full automated verification**

Run: `npm test` — expected: all suites pass.
Run: `npm run build` — expected: clean; note the separate lazy chunk for `render3d` in the Vite output.

- [ ] **Step 3: Manual verification (dev server)**

Run: `npm run dev`, open the app, then check:

1. Schematic and To Scale look and behave exactly as before (pan, pinch/wheel zoom, comets, date seek).
2. Switch to **3D**: textured Sun/planets appear (flat colors first frame(s), textures pop in), orbit guides are visibly tilted (Pluto's 17° stands out), belt is a slightly thickened disk.
3. Mouse: left-drag orbits (no pole flip), wheel zooms toward the cursor, right-drag pans, double-click re-centers, motion glides (damping).
4. Touch (DevTools device emulation): 1-finger rotates, 2-finger pinch zooms, 2-finger drag pans.
5. Comets ON → pick Halley: steeply tilted green path, comet with anti-sunward tail, camera framed on the orbit; "Jump to perihelion" seeks and pauses. Pick Borisov: red path.
6. Switch 3D → Schematic → 3D: no console errors or WebGL context warnings (renderer disposed and recreated).
7. Speed controls and date picker work identically in 3D.

If anything fails, fix it (updating the relevant task's module) before committing.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document the 3D view mode in AGENTS.md"
```
