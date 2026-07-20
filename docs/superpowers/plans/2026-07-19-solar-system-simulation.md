# Solar System Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. If working in an isolated worktree, it should have been created via the `superpowers:using-git-worktrees` skill at execution time.

**Goal:** Build a webpage showing a stylized solar system — 8 planets and 98 moons on circular orbits whose periods are exactly to scale — with 1x/100x/1000x time acceleration (1x = 1 sim day per real second), pause, a simulated date readout, planet labels, and zoom/pan.

**Architecture:** Vite + React + TypeScript, three layers with one-way dependencies (UI → render → sim). `src/sim/` is pure TypeScript (data, clock, orbital math, layout, date formatting) fully unit-tested via TDD. `src/render/` paints sim snapshots onto a Canvas 2D element and owns the zoom/pan camera. React owns only the toolbar and date readout; a `useSimulation` hook runs the rAF loop and pushes state into React at low frequency.

**Tech Stack:** Vite 5, React 18, TypeScript 5 (strict), Vitest 2 + React Testing Library (jsdom), Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-07-19-solar-system-simulation-design.md` — data tables are copied verbatim from there.

## Global Constraints

- 1x speed = 1 simulated Earth day per real second; speed options are exactly `1`, `100`, `1000`; default 1x, running (unpaused).
- Epoch is J2000 = 2000-01-01 12:00 UTC; all bodies start at angle 0 (aligned) at epoch.
- Frame dt is clamped to ≤ 0.25 s inside `SimClock.advance`.
- Negative orbital period = retrograde orbit (e.g. Triton −5.8769 d).
- Moon counts per planet: Mercury 0, Venus 0, Earth 1, Mars 2, Jupiter 20, Saturn 30, Uranus 29, Neptune 16 (98 moons; 107 bodies total including the sun).
- Orbital period values are copied verbatim from the spec's data tables — do not invent or "improve" them.
- Runtime dependencies: `react`, `react-dom` only. No other runtime deps.
- TypeScript `strict: true`. Tests colocated with source (`src/**/*.test.ts(x)`).
- Commit at the end of every task with the given message.
- Environment note: `npm install` may print a warning about esbuild's blocked postinstall script — harmless, verified working on Node 24.

## File Structure

```
index.html                        Task 10 — app entry page
package.json  tsconfig.json       Task 1 — toolchain (verified: install, tsc, vitest, RTL, vite build)
vite.config.ts                    Task 1 — vite + vitest config (jsdom, globals)
src/main.tsx                      Task 10 — React bootstrap
src/App.tsx                       Task 10 — layout: canvas + Toolbar + DateDisplay
src/styles.css                    Task 10 — dark theme, full-viewport canvas
src/sim/types.ts                  Task 1  — PlanetSpec, MoonSpec, BodyPosition
src/sim/orbits.ts                 Task 1  — angleAt, orbitalPosition (pure math)
src/sim/clock.ts                  Task 2  — SimClock (sim days, multiplier, pause, dt clamp)
src/sim/data.ts                   Task 3  — SUN, MOON_STYLE, PLANETS (8), MOONS (98)
src/sim/layout.ts                 Task 4  — computeLayout (stylized orbit radii, moon bubbles)
src/sim/formatDate.ts             Task 5  — formatSimDate (J2000 + simDays -> YYYY-MM-DD, UTC)
src/sim/simulation.ts             Task 6  — Simulation facade (clock + layout -> Snapshot)
src/render/camera.ts              Task 7  — Camera (world<->screen, zoomAt, panBy, fitToView)
src/render/drawScene.ts           Task 9  — drawScene (paints a Snapshot through a Camera)
src/ui/Toolbar.tsx                Task 8  — speed buttons + pause
src/ui/DateDisplay.tsx            Task 10 — date readout
src/hooks/useSimulation.ts        Task 10 — rAF loop, canvas sizing, wheel/drag input
```

---

### Task 1: Toolchain scaffold + orbital math

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`
- Create: `src/sim/types.ts`
- Create: `src/sim/orbits.ts`
- Test: `src/sim/orbits.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `interface PlanetSpec { name: string; periodDays: number; bodyRadius: number; color: string }`
  - `interface MoonSpec { name: string; parent: string; periodDays: number }`
  - `interface BodyPosition { x: number; y: number }`
  - `function angleAt(periodDays: number, simDays: number): number`
  - `function orbitalPosition(cx: number, cy: number, radius: number, angle: number): BodyPosition`
  - Test command: `npm test` (vitest run); typecheck: `npx tsc --noEmit`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "solar-system-simulation",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^24.1.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json` and `vite.config.ts`**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 3: Install dependencies**

Run: `npm install --no-audit --no-fund`
Expected: completes with exit code 0 (a warning about esbuild's blocked postinstall script may appear — harmless).

- [ ] **Step 4: Write `src/sim/types.ts`**

```ts
export interface PlanetSpec {
  name: string;
  /** Sidereal orbital period in days. */
  periodDays: number;
  /** Display radius in world units (px at zoom 1). */
  bodyRadius: number;
  color: string;
}

export interface MoonSpec {
  name: string;
  /** Parent planet name — must match a PlanetSpec.name. */
  parent: string;
  /** Sidereal orbital period in days; negative = retrograde. */
  periodDays: number;
}

export interface BodyPosition {
  x: number;
  y: number;
}
```

- [ ] **Step 5: Write the failing test `src/sim/orbits.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { angleAt, orbitalPosition } from './orbits';

describe('angleAt', () => {
  it('returns 0 at day 0', () => {
    expect(angleAt(100, 0)).toBe(0);
  });

  it('returns π/2 at a quarter period', () => {
    expect(angleAt(100, 25)).toBeCloseTo(Math.PI / 2, 10);
  });

  it('returns π at half a period', () => {
    expect(angleAt(100, 50)).toBeCloseTo(Math.PI, 10);
  });

  it('returns 2π at a full period', () => {
    expect(angleAt(100, 100)).toBeCloseTo(2 * Math.PI, 10);
  });

  it('returns negative angles for retrograde (negative) periods', () => {
    expect(angleAt(-4, 1)).toBeCloseTo(-Math.PI / 2, 10);
  });
});

describe('orbitalPosition', () => {
  it('places the body on the +x axis at angle 0', () => {
    expect(orbitalPosition(10, 20, 5, 0)).toEqual({ x: 15, y: 20 });
  });

  it('keeps the distance from the center equal to the radius', () => {
    const p = orbitalPosition(3, -2, 7, 1.234);
    expect(Math.hypot(p.x - 3, p.y - -2)).toBeCloseTo(7, 10);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/sim/orbits.test.ts`
Expected: FAIL — `Failed to resolve import "./orbits" from "src/sim/orbits.test.ts"`

- [ ] **Step 7: Write `src/sim/orbits.ts`**

```ts
import type { BodyPosition } from './types';

/**
 * Orbit angle in radians after `simDays` days for a body with the given
 * orbital period. Negative period => retrograde (angle decreases).
 */
export function angleAt(periodDays: number, simDays: number): number {
  return (2 * Math.PI * simDays) / periodDays;
}

/** Position on a circular orbit around (cx, cy). Math convention: y-up. */
export function orbitalPosition(cx: number, cy: number, radius: number, angle: number): BodyPosition {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npx vitest run src/sim/orbits.test.ts && npx tsc --noEmit`
Expected: `Test Files  1 passed (1)`, `Tests  7 passed (7)`; tsc exits 0.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts src/sim/
git commit -m "feat: scaffold toolchain and add orbital math"
```

---

### Task 2: Simulation clock

**Files:**
- Create: `src/sim/clock.ts`
- Test: `src/sim/clock.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SpeedMultiplier = 1 | 100 | 1000`
  - `class SimClock { simDays: number; paused: boolean; multiplier: SpeedMultiplier; advance(realDtSeconds: number): void; setMultiplier(m: SpeedMultiplier): void; setPaused(p: boolean): void }`
  - `advance` adds `min(realDtSeconds, 0.25) * multiplier` days; no-op when paused.

- [ ] **Step 1: Write the failing test `src/sim/clock.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { SimClock } from './clock';

describe('SimClock', () => {
  it('starts at day 0, 1x, unpaused', () => {
    const c = new SimClock();
    expect(c.simDays).toBe(0);
    expect(c.multiplier).toBe(1);
    expect(c.paused).toBe(false);
  });

  it('advances 1 day per real second at 1x', () => {
    const c = new SimClock();
    c.advance(1);
    expect(c.simDays).toBeCloseTo(1, 10);
  });

  it('advances proportionally to the multiplier', () => {
    const c = new SimClock();
    c.setMultiplier(100);
    c.advance(0.5);
    expect(c.simDays).toBeCloseTo(50, 10);
    c.setMultiplier(1000);
    c.advance(0.016);
    expect(c.simDays).toBeCloseTo(66, 10);
  });

  it('does not advance while paused', () => {
    const c = new SimClock();
    c.setPaused(true);
    c.advance(1);
    expect(c.simDays).toBe(0);
    c.setPaused(false);
    c.advance(1);
    expect(c.simDays).toBeCloseTo(1, 10);
  });

  it('clamps huge frame deltas to 0.25 s', () => {
    const c = new SimClock();
    c.advance(10);
    expect(c.simDays).toBeCloseTo(0.25, 10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/sim/clock.test.ts`
Expected: FAIL — `Failed to resolve import "./clock"`

- [ ] **Step 3: Write `src/sim/clock.ts`**

```ts
export type SpeedMultiplier = 1 | 100 | 1000;

/** Max real seconds consumed per advance() call (tab-switch guard). */
export const MAX_FRAME_DT_SECONDS = 0.25;

export class SimClock {
  simDays = 0;
  paused = false;
  multiplier: SpeedMultiplier = 1;

  /** 1x = 1 simulated Earth day per real second. */
  advance(realDtSeconds: number): void {
    if (this.paused) return;
    const dt = Math.min(realDtSeconds, MAX_FRAME_DT_SECONDS);
    this.simDays += dt * this.multiplier;
  }

  setMultiplier(m: SpeedMultiplier): void {
    this.multiplier = m;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/sim/clock.test.ts && npx tsc --noEmit`
Expected: `Tests  5 passed (5)`; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/clock.ts src/sim/clock.test.ts
git commit -m "feat: add simulation clock"
```

---

### Task 3: Body data tables

**Files:**
- Create: `src/sim/data.ts`
- Test: `src/sim/data.test.ts`

**Interfaces:**
- Consumes: `PlanetSpec`, `MoonSpec` from `./types` (Task 1).
- Produces:
  - `const SUN = { name: 'Sun', bodyRadius: 22, color: '#ffcc33' }`
  - `const MOON_STYLE = { bodyRadius: 1.5, color: '#bbbbbb' }`
  - `const PLANETS: PlanetSpec[]` — 8 entries, solar order (used by Tasks 4 & 6)
  - `const MOONS: MoonSpec[]` — 98 entries, periods verbatim from spec

- [ ] **Step 1: Write the failing test `src/sim/data.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { MOONS, PLANETS } from './data';

const EXPECTED_MOON_COUNTS: Record<string, number> = {
  Mercury: 0,
  Venus: 0,
  Earth: 1,
  Mars: 2,
  Jupiter: 20,
  Saturn: 30,
  Uranus: 29,
  Neptune: 16,
};

describe('data tables', () => {
  it('has 8 planets in solar order', () => {
    expect(PLANETS.map((p) => p.name)).toEqual([
      'Mercury',
      'Venus',
      'Earth',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
    ]);
  });

  it('has 98 moons', () => {
    expect(MOONS).toHaveLength(98);
  });

  it('has the expected moon count per planet', () => {
    for (const [planet, count] of Object.entries(EXPECTED_MOON_COUNTS)) {
      expect(
        MOONS.filter((m) => m.parent === planet).length,
        planet,
      ).toBe(count);
    }
  });

  it('every moon parent exists', () => {
    const names = new Set(PLANETS.map((p) => p.name));
    for (const m of MOONS) {
      expect(names.has(m.parent), m.name).toBe(true);
    }
  });

  it('all periods are non-zero', () => {
    for (const p of PLANETS) expect(p.periodDays, p.name).not.toBe(0);
    for (const m of MOONS) expect(m.periodDays, m.name).not.toBe(0);
  });

  it('names are unique across planets and moons', () => {
    const all = [...PLANETS.map((p) => p.name), ...MOONS.map((m) => m.name)];
    expect(new Set(all).size).toBe(all.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/sim/data.test.ts`
Expected: FAIL — `Failed to resolve import "./data"`

- [ ] **Step 3: Write `src/sim/data.ts` (periods verbatim from the spec; negative = retrograde)**

```ts
import type { MoonSpec, PlanetSpec } from './types';

export const SUN = { name: 'Sun', bodyRadius: 22, color: '#ffcc33' } as const;
export const MOON_STYLE = { bodyRadius: 1.5, color: '#bbbbbb' } as const;

export const PLANETS: PlanetSpec[] = [
  { name: 'Mercury', periodDays: 87.9691, bodyRadius: 4, color: '#9c8e82' },
  { name: 'Venus', periodDays: 224.701, bodyRadius: 6, color: '#e3bb76' },
  { name: 'Earth', periodDays: 365.256, bodyRadius: 6, color: '#4d9de0' },
  { name: 'Mars', periodDays: 686.98, bodyRadius: 5, color: '#c1440e' },
  { name: 'Jupiter', periodDays: 4332.589, bodyRadius: 14, color: '#d8a25e' },
  { name: 'Saturn', periodDays: 10759.22, bodyRadius: 12, color: '#e0c38b' },
  { name: 'Uranus', periodDays: 30688.5, bodyRadius: 9, color: '#7dd3d8' },
  { name: 'Neptune', periodDays: 60182, bodyRadius: 9, color: '#5b7fd4' },
];

export const MOONS: MoonSpec[] = [
  // Earth (1)
  { name: 'Moon', parent: 'Earth', periodDays: 27.3217 },
  // Mars (2)
  { name: 'Phobos', parent: 'Mars', periodDays: 0.31891 },
  { name: 'Deimos', parent: 'Mars', periodDays: 1.26244 },
  // Jupiter (20)
  { name: 'Metis', parent: 'Jupiter', periodDays: 0.2959 },
  { name: 'Adrastea', parent: 'Jupiter', periodDays: 0.2994 },
  { name: 'Amalthea', parent: 'Jupiter', periodDays: 0.499 },
  { name: 'Thebe', parent: 'Jupiter', periodDays: 0.6753 },
  { name: 'Io', parent: 'Jupiter', periodDays: 1.7693 },
  { name: 'Europa', parent: 'Jupiter', periodDays: 3.5504 },
  { name: 'Ganymede', parent: 'Jupiter', periodDays: 7.1556 },
  { name: 'Callisto', parent: 'Jupiter', periodDays: 16.69 },
  { name: 'Themisto', parent: 'Jupiter', periodDays: 129.97 },
  { name: 'Leda', parent: 'Jupiter', periodDays: 240.33 },
  { name: 'Ersa', parent: 'Jupiter', periodDays: 248.62 },
  { name: 'Himalia', parent: 'Jupiter', periodDays: 249.91 },
  { name: 'Pandia', parent: 'Jupiter', periodDays: 251.23 },
  { name: 'Lysithea', parent: 'Jupiter', periodDays: 258.5 },
  { name: 'Elara', parent: 'Jupiter', periodDays: 258.89 },
  { name: 'Dia', parent: 'Jupiter', periodDays: 277.25 },
  { name: 'Carpo', parent: 'Jupiter', periodDays: 454.4 },
  { name: 'Valetudo', parent: 'Jupiter', periodDays: 522.07 },
  { name: 'Euporie', parent: 'Jupiter', periodDays: -546.18 },
  { name: 'Eupheme', parent: 'Jupiter', periodDays: -611.32 },
  // Saturn (30)
  { name: 'Pan', parent: 'Saturn', periodDays: 0.57505 },
  { name: 'Daphnis', parent: 'Saturn', periodDays: 0.59408 },
  { name: 'Atlas', parent: 'Saturn', periodDays: 0.6046 },
  { name: 'Prometheus', parent: 'Saturn', periodDays: 0.61588 },
  { name: 'Pandora', parent: 'Saturn', periodDays: 0.63137 },
  { name: 'Epimetheus', parent: 'Saturn', periodDays: 0.69701 },
  { name: 'Janus', parent: 'Saturn', periodDays: 0.69735 },
  { name: 'Aegaeon', parent: 'Saturn', periodDays: 0.80812 },
  { name: 'Mimas', parent: 'Saturn', periodDays: 0.94242 },
  { name: 'Methone', parent: 'Saturn', periodDays: 1.00955 },
  { name: 'Anthe', parent: 'Saturn', periodDays: 1.0389 },
  { name: 'Pallene', parent: 'Saturn', periodDays: 1.15606 },
  { name: 'Enceladus', parent: 'Saturn', periodDays: 1.37022 },
  { name: 'Tethys', parent: 'Saturn', periodDays: 1.8878 },
  { name: 'Telesto', parent: 'Saturn', periodDays: 1.8878 },
  { name: 'Calypso', parent: 'Saturn', periodDays: 1.8878 },
  { name: 'Helene', parent: 'Saturn', periodDays: 2.73692 },
  { name: 'Polydeuces', parent: 'Saturn', periodDays: 2.73692 },
  { name: 'Dione', parent: 'Saturn', periodDays: 2.73692 },
  { name: 'Rhea', parent: 'Saturn', periodDays: 4.5175 },
  { name: 'Titan', parent: 'Saturn', periodDays: 15.9454 },
  { name: 'Hyperion', parent: 'Saturn', periodDays: 21.2767 },
  { name: 'Iapetus', parent: 'Saturn', periodDays: 79.331 },
  { name: 'Kiviuq', parent: 'Saturn', periodDays: 448.91 },
  { name: 'Ijiraq', parent: 'Saturn', periodDays: 451.12 },
  { name: 'Phoebe', parent: 'Saturn', periodDays: -550.3 },
  { name: 'Paaliaq', parent: 'Saturn', periodDays: 685.72 },
  { name: 'Skathi', parent: 'Saturn', periodDays: -725.73 },
  { name: 'Albiorix', parent: 'Saturn', periodDays: 779.07 },
  { name: 'Bebhionn', parent: 'Saturn', periodDays: 829.64 },
  // Uranus (29)
  { name: 'Cordelia', parent: 'Uranus', periodDays: 0.3347 },
  { name: 'Ophelia', parent: 'Uranus', periodDays: 0.3764 },
  { name: 'S/2025 U 1', parent: 'Uranus', periodDays: 0.4201 },
  { name: 'Bianca', parent: 'Uranus', periodDays: 0.4347 },
  { name: 'Cressida', parent: 'Uranus', periodDays: 0.4639 },
  { name: 'Desdemona', parent: 'Uranus', periodDays: 0.4736 },
  { name: 'Juliet', parent: 'Uranus', periodDays: 0.4931 },
  { name: 'Portia', parent: 'Uranus', periodDays: 0.5132 },
  { name: 'Rosalind', parent: 'Uranus', periodDays: 0.5583 },
  { name: 'Cupid', parent: 'Uranus', periodDays: 0.6125 },
  { name: 'Belinda', parent: 'Uranus', periodDays: 0.6236 },
  { name: 'Perdita', parent: 'Uranus', periodDays: 0.6382 },
  { name: 'Puck', parent: 'Uranus', periodDays: 0.7618 },
  { name: 'Mab', parent: 'Uranus', periodDays: 0.9229 },
  { name: 'Miranda', parent: 'Uranus', periodDays: 1.4135 },
  { name: 'Ariel', parent: 'Uranus', periodDays: 2.5204 },
  { name: 'Umbriel', parent: 'Uranus', periodDays: 4.1442 },
  { name: 'Titania', parent: 'Uranus', periodDays: 8.7059 },
  { name: 'Oberon', parent: 'Uranus', periodDays: 13.463 },
  { name: 'Francisco', parent: 'Uranus', periodDays: -267 },
  { name: 'Caliban', parent: 'Uranus', periodDays: -580 },
  { name: 'Stephano', parent: 'Uranus', periodDays: -677 },
  { name: 'S/2023 U 1', parent: 'Uranus', periodDays: -681 },
  { name: 'Trinculo', parent: 'Uranus', periodDays: -749 },
  { name: 'Sycorax', parent: 'Uranus', periodDays: -1286 },
  { name: 'Margaret', parent: 'Uranus', periodDays: 1655 },
  { name: 'Prospero', parent: 'Uranus', periodDays: -1974 },
  { name: 'Setebos', parent: 'Uranus', periodDays: -2215 },
  { name: 'Ferdinand', parent: 'Uranus', periodDays: -2788 },
  // Neptune (16)
  { name: 'Naiad', parent: 'Neptune', periodDays: 0.2944 },
  { name: 'Thalassa', parent: 'Neptune', periodDays: 0.3115 },
  { name: 'Despina', parent: 'Neptune', periodDays: 0.3347 },
  { name: 'Galatea', parent: 'Neptune', periodDays: 0.4287 },
  { name: 'Larissa', parent: 'Neptune', periodDays: 0.5547 },
  { name: 'Hippocamp', parent: 'Neptune', periodDays: 0.9504 },
  { name: 'Proteus', parent: 'Neptune', periodDays: 1.1223 },
  { name: 'Triton', parent: 'Neptune', periodDays: -5.8769 },
  { name: 'Nereid', parent: 'Neptune', periodDays: 360.14 },
  { name: 'Halimede', parent: 'Neptune', periodDays: -1879.08 },
  { name: 'Sao', parent: 'Neptune', periodDays: 2912.72 },
  { name: 'S/2002 N 5', parent: 'Neptune', periodDays: 3156.55 },
  { name: 'Laomedeia', parent: 'Neptune', periodDays: 3171.33 },
  { name: 'Psamathe', parent: 'Neptune', periodDays: -9149.51 },
  { name: 'Neso', parent: 'Neptune', periodDays: -9794.71 },
  { name: 'S/2021 N 1', parent: 'Neptune', periodDays: -10036.65 },
];
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/sim/data.test.ts && npx tsc --noEmit`
Expected: `Tests  6 passed (6)`; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/data.ts src/sim/data.test.ts
git commit -m "feat: add planet and moon data tables"
```

---

### Task 4: Layout computation

**Files:**
- Create: `src/sim/layout.ts`
- Test: `src/sim/layout.test.ts`

**Interfaces:**
- Consumes: `PLANETS`, `MOONS` (Task 3).
- Produces:
  - `interface LayoutEntry { orbitRadius: number; bubbleRadius: number }`
  - `interface Layout { planets: Record<string, LayoutEntry>; moons: Record<string, number> }`
  - `function computeLayout(planets: PlanetSpec[], moons: MoonSpec[]): Layout`
  - Algorithm: moons per planet sorted by `|periodDays|` ascending; moon *i* ring = `bodyRadius + 6 + i*3`; bubble = `bodyRadius + 6 + (n-1)*3 + 3` (0 if n=0); `orbitRadius[0] = 80`; `orbitRadius[i] = orbitRadius[i-1] + bubble[i-1] + bubble[i] + 25`.

- [ ] **Step 1: Write the failing test `src/sim/layout.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { MOONS, PLANETS } from './data';
import { computeLayout } from './layout';

const layout = computeLayout(PLANETS, MOONS);
const ordered = PLANETS.map((p) => layout.planets[p.name]);

describe('computeLayout', () => {
  it('gives Mercury the first orbit at radius 80', () => {
    expect(layout.planets.Mercury.orbitRadius).toBe(80);
  });

  it('has strictly increasing orbit radii', () => {
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].orbitRadius).toBeGreaterThan(ordered[i - 1].orbitRadius);
    }
  });

  it('moon bubbles never overlap the neighboring orbit', () => {
    for (let i = 1; i < ordered.length; i++) {
      const prevOuter = ordered[i - 1].orbitRadius + ordered[i - 1].bubbleRadius;
      const inner = ordered[i].orbitRadius - ordered[i].bubbleRadius;
      expect(inner, PLANETS[i].name).toBeGreaterThan(prevOuter);
    }
  });

  it('planets without moons have bubble radius 0', () => {
    expect(layout.planets.Mercury.bubbleRadius).toBe(0);
    expect(layout.planets.Venus.bubbleRadius).toBe(0);
  });

  it("places Earth's single moon at radius 12", () => {
    expect(layout.moons.Moon).toBe(12);
  });

  it('orders moon rings by absolute period', () => {
    // Jupiter bodyRadius 14: first ring = 20, last of 20 = 14 + 6 + 19*3 = 77
    expect(layout.moons.Metis).toBe(20);
    expect(layout.moons.Eupheme).toBe(77);
  });

  it('computes the Saturn bubble for 30 moons', () => {
    expect(layout.planets.Saturn.bubbleRadius).toBe(108);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/sim/layout.test.ts`
Expected: FAIL — `Failed to resolve import "./layout"`

- [ ] **Step 3: Write `src/sim/layout.ts`**

```ts
import type { MoonSpec, PlanetSpec } from './types';

export interface LayoutEntry {
  /** Planet's orbit radius around the sun (world units). */
  orbitRadius: number;
  /** Radius of the planet's moon system (0 when the planet has no moons). */
  bubbleRadius: number;
}

export interface Layout {
  planets: Record<string, LayoutEntry>;
  /** Moon name -> orbit radius around its parent planet (world units). */
  moons: Record<string, number>;
}

const FIRST_ORBIT_RADIUS = 80;
const ORBIT_GAP = 25;
const MOON_RING_START = 6;
const MOON_RING_STEP = 3;

export function computeLayout(planets: PlanetSpec[], moons: MoonSpec[]): Layout {
  const layout: Layout = { planets: {}, moons: {} };
  let previousOrbit = 0;
  let previousBubble = 0;

  planets.forEach((planet, index) => {
    const planetMoons = moons
      .filter((m) => m.parent === planet.name)
      .sort((a, b) => Math.abs(a.periodDays) - Math.abs(b.periodDays));

    const bubble =
      planetMoons.length === 0
        ? 0
        : planet.bodyRadius +
          MOON_RING_START +
          (planetMoons.length - 1) * MOON_RING_STEP +
          MOON_RING_STEP;

    const orbitRadius =
      index === 0 ? FIRST_ORBIT_RADIUS : previousOrbit + previousBubble + bubble + ORBIT_GAP;

    layout.planets[planet.name] = { orbitRadius, bubbleRadius: bubble };
    planetMoons.forEach((moon, i) => {
      layout.moons[moon.name] = planet.bodyRadius + MOON_RING_START + i * MOON_RING_STEP;
    });

    previousOrbit = orbitRadius;
    previousBubble = bubble;
  });

  return layout;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/sim/layout.test.ts && npx tsc --noEmit`
Expected: `Tests  7 passed (7)`; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/layout.ts src/sim/layout.test.ts
git commit -m "feat: add layout computation"
```

---

### Task 5: Simulated date formatting

**Files:**
- Create: `src/sim/formatDate.ts`
- Test: `src/sim/formatDate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `function formatSimDate(simDays: number): string` — J2000 (2000-01-01 12:00 UTC) + simDays, formatted `YYYY-MM-DD` in UTC.

- [ ] **Step 1: Write the failing test `src/sim/formatDate.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatSimDate } from './formatDate';

describe('formatSimDate', () => {
  it('formats the epoch as 2000-01-01', () => {
    expect(formatSimDate(0)).toBe('2000-01-01');
  });

  it('advances one calendar day per sim day', () => {
    expect(formatSimDate(1)).toBe('2000-01-02');
  });

  it('rolls over months', () => {
    expect(formatSimDate(31)).toBe('2000-02-01');
  });

  it('handles leap years (year 2000 had 366 days)', () => {
    expect(formatSimDate(366)).toBe('2001-01-01');
  });

  it('starts at noon, so the date flips at midday', () => {
    expect(formatSimDate(0.4)).toBe('2000-01-01');
    expect(formatSimDate(0.6)).toBe('2000-01-02');
  });

  it('handles large values', () => {
    expect(formatSimDate(10000)).toBe('2027-05-19');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/sim/formatDate.test.ts`
Expected: FAIL — `Failed to resolve import "./formatDate"`

- [ ] **Step 3: Write `src/sim/formatDate.ts`**

```ts
const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // J2000
const MS_PER_DAY = 86_400_000;

/** Formats J2000 + simDays as YYYY-MM-DD (UTC). */
export function formatSimDate(simDays: number): string {
  const d = new Date(EPOCH_MS + simDays * MS_PER_DAY);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/sim/formatDate.test.ts && npx tsc --noEmit`
Expected: `Tests  6 passed (6)`; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/formatDate.ts src/sim/formatDate.test.ts
git commit -m "feat: add simulated date formatting"
```

---

### Task 6: Simulation facade

**Files:**
- Create: `src/sim/simulation.ts`
- Test: `src/sim/simulation.test.ts`

**Interfaces:**
- Consumes: `SimClock` (Task 2), `PLANETS`, `MOONS`, `SUN`, `MOON_STYLE` (Task 3), `computeLayout`, `Layout` (Task 4), `angleAt`, `orbitalPosition` (Task 1).
- Produces:
  - `interface BodySnapshot { name: string; x: number; y: number; bodyRadius: number; color: string; kind: 'sun' | 'planet' | 'moon' }`
  - `interface Snapshot { simDays: number; bodies: BodySnapshot[] }`
  - `class Simulation { readonly clock: SimClock; readonly layout: Layout; advance(realDtSeconds: number): void; snapshot(): Snapshot }` — sun at (0,0); moons positioned relative to their *moving* parent.

- [ ] **Step 1: Write the failing test `src/sim/simulation.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { Simulation } from './simulation';

/** Advances the clock in clamp-safe steps (SimClock clamps a single call to 0.25 s). */
function advanceDays(sim: Simulation, days: number): void {
  let remaining = days;
  while (remaining > 0) {
    const step = Math.min(0.25, remaining);
    sim.advance(step);
    remaining -= step;
  }
}

describe('Simulation', () => {
  it('snapshots 107 bodies (1 sun + 8 planets + 98 moons)', () => {
    expect(new Simulation().snapshot().bodies).toHaveLength(107);
  });

  it('places the sun at the origin', () => {
    const sun = new Simulation().snapshot().bodies[0];
    expect(sun).toMatchObject({ name: 'Sun', x: 0, y: 0, kind: 'sun' });
  });

  it('starts all bodies aligned on the +x axis at day 0', () => {
    for (const b of new Simulation().snapshot().bodies) {
      expect(b.y, b.name).toBeCloseTo(0, 10);
      expect(b.x, b.name).toBeGreaterThanOrEqual(0);
    }
  });

  it('Earth completes exactly one revolution per Earth year', () => {
    const sim = new Simulation();
    advanceDays(sim, 365.256);
    const earth = sim.snapshot().bodies.find((b) => b.name === 'Earth')!;
    const r = sim.layout.planets.Earth.orbitRadius;
    expect(Math.hypot(earth.x, earth.y)).toBeCloseTo(r, 5);
    expect(earth.y).toBeCloseTo(0, 5);
  });

  it("keeps Earth's Moon on its ring around the moving Earth", () => {
    const sim = new Simulation();
    advanceDays(sim, 10);
    const bodies = sim.snapshot().bodies;
    const earth = bodies.find((b) => b.name === 'Earth')!;
    const moon = bodies.find((b) => b.name === 'Moon')!;
    expect(Math.hypot(moon.x - earth.x, moon.y - earth.y)).toBeCloseTo(sim.layout.moons.Moon, 10);
  });

  it('Triton orbits retrograde around Neptune', () => {
    const sim = new Simulation();
    advanceDays(sim, 1);
    const bodies = sim.snapshot().bodies;
    const neptune = bodies.find((b) => b.name === 'Neptune')!;
    const triton = bodies.find((b) => b.name === 'Triton')!;
    const angle = Math.atan2(triton.y - neptune.y, triton.x - neptune.x);
    expect(angle).toBeCloseTo((2 * Math.PI) / -5.8769, 5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/sim/simulation.test.ts`
Expected: FAIL — `Failed to resolve import "./simulation"`

- [ ] **Step 3: Write `src/sim/simulation.ts`**

```ts
import { SimClock } from './clock';
import { MOONS, MOON_STYLE, PLANETS, SUN } from './data';
import { computeLayout, type Layout } from './layout';
import { angleAt, orbitalPosition } from './orbits';

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

export class Simulation {
  readonly clock = new SimClock();
  readonly layout: Layout = computeLayout(PLANETS, MOONS);

  advance(realDtSeconds: number): void {
    this.clock.advance(realDtSeconds);
  }

  snapshot(): Snapshot {
    const { simDays } = this.clock;
    const bodies: BodySnapshot[] = [
      { name: SUN.name, x: 0, y: 0, bodyRadius: SUN.bodyRadius, color: SUN.color, kind: 'sun' },
    ];

    for (const planet of PLANETS) {
      const { orbitRadius } = this.layout.planets[planet.name];
      const pos = orbitalPosition(0, 0, orbitRadius, angleAt(planet.periodDays, simDays));
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
        const mpos = orbitalPosition(pos.x, pos.y, ring, angleAt(moon.periodDays, simDays));
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
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/sim/simulation.test.ts && npx tsc --noEmit`
Expected: `Tests  6 passed (6)`; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/simulation.ts src/sim/simulation.test.ts
git commit -m "feat: add simulation facade"
```

---

### Task 7: Camera

**Files:**
- Create: `src/render/camera.ts`
- Test: `src/render/camera.test.ts`

**Interfaces:**
- Consumes: `BodyPosition` from `../sim/types` (Task 1).
- Produces:
  - `class Camera { scale: number; centerX: number; centerY: number; worldToScreen(p: BodyPosition): BodyPosition; screenToWorld(p: BodyPosition): BodyPosition; zoomAt(screenPoint: BodyPosition, factor: number): void; panBy(dx: number, dy: number): void; fitToView(worldRadius: number, viewportW: number, viewportH: number): void }`
  - World is y-up; screen is y-down (`worldToScreen` flips y so prograde orbits render counterclockwise).

- [ ] **Step 1: Write the failing test `src/render/camera.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { Camera } from './camera';

describe('Camera', () => {
  it('maps world to screen with a y-axis flip at defaults', () => {
    const cam = new Camera();
    expect(cam.worldToScreen({ x: 2, y: 3 })).toEqual({ x: 2, y: -3 });
  });

  it('round-trips world <-> screen', () => {
    const cam = new Camera();
    cam.scale = 2;
    cam.centerX = 100;
    cam.centerY = 50;
    const s = cam.worldToScreen({ x: 7, y: -4 });
    const w = cam.screenToWorld(s);
    expect(w.x).toBeCloseTo(7, 10);
    expect(w.y).toBeCloseTo(-4, 10);
  });

  it('zoomAt keeps the anchored screen point fixed', () => {
    const cam = new Camera();
    const anchor = { x: 100, y: 50 };
    const before = cam.screenToWorld(anchor);
    cam.zoomAt(anchor, 2);
    const after = cam.screenToWorld(anchor);
    expect(cam.scale).toBe(2);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('panBy shifts the view', () => {
    const cam = new Camera();
    cam.panBy(10, -5);
    expect(cam.worldToScreen({ x: 0, y: 0 })).toEqual({ x: 10, y: -5 });
  });

  it('fitToView centers and scales to fit the radius with margin', () => {
    const cam = new Camera();
    cam.fitToView(1000, 800, 600);
    expect(cam.centerX).toBe(400);
    expect(cam.centerY).toBe(300);
    expect(cam.scale).toBeCloseTo(300 / 1050, 10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/camera.test.ts`
Expected: FAIL — `Failed to resolve import "./camera"`

- [ ] **Step 3: Write `src/render/camera.ts`**

```ts
import type { BodyPosition } from '../sim/types';

const FIT_MARGIN = 1.05;

/**
 * Maps between world coordinates (y-up, origin at the sun) and screen
 * coordinates (y-down). `scale` is screen px per world unit; (centerX,
 * centerY) is where the world origin lands on screen.
 */
export class Camera {
  scale = 1;
  centerX = 0;
  centerY = 0;

  worldToScreen(p: BodyPosition): BodyPosition {
    return { x: this.centerX + p.x * this.scale, y: this.centerY - p.y * this.scale };
  }

  screenToWorld(p: BodyPosition): BodyPosition {
    return { x: (p.x - this.centerX) / this.scale, y: (this.centerY - p.y) / this.scale };
  }

  /** Zooms by `factor` while keeping `screenPoint` visually fixed. */
  zoomAt(screenPoint: BodyPosition, factor: number): void {
    const worldPoint = this.screenToWorld(screenPoint);
    this.scale *= factor;
    this.centerX = screenPoint.x - worldPoint.x * this.scale;
    this.centerY = screenPoint.y + worldPoint.y * this.scale;
  }

  panBy(dx: number, dy: number): void {
    this.centerX += dx;
    this.centerY += dy;
  }

  /** Fits a world radius into the viewport, centered, with a small margin. */
  fitToView(worldRadius: number, viewportW: number, viewportH: number): void {
    this.scale = Math.min(viewportW, viewportH) / 2 / (worldRadius * FIT_MARGIN);
    this.centerX = viewportW / 2;
    this.centerY = viewportH / 2;
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/render/camera.test.ts && npx tsc --noEmit`
Expected: `Tests  5 passed (5)`; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/render/camera.ts src/render/camera.test.ts
git commit -m "feat: add camera with zoom and pan"
```

---

### Task 8: Toolbar component

**Files:**
- Create: `src/ui/Toolbar.tsx`
- Test: `src/ui/Toolbar.test.tsx`

**Interfaces:**
- Consumes: `SpeedMultiplier` from `../sim/clock` (Task 2).
- Produces:
  - `function Toolbar(props: { multiplier: SpeedMultiplier; paused: boolean; onSelectSpeed: (m: SpeedMultiplier) => void; onTogglePause: () => void }): JSX.Element`
  - Renders buttons `1x`, `100x`, `1000x` (active has `aria-pressed="true"` and class `active`) and `Pause`/`Resume`.

- [ ] **Step 1: Write the failing test `src/ui/Toolbar.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toolbar, type ToolbarProps } from './Toolbar';

function renderToolbar(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    multiplier: 1,
    paused: false,
    onSelectSpeed: vi.fn(),
    onTogglePause: vi.fn(),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe('Toolbar', () => {
  it('renders the three speed buttons and pause', () => {
    renderToolbar();
    for (const label of ['1x', '100x', '1000x', 'Pause']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('marks the active speed', () => {
    renderToolbar({ multiplier: 100 });
    expect(screen.getByRole('button', { name: '100x' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '1x' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onSelectSpeed when a speed button is clicked', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: '1000x' }));
    expect(props.onSelectSpeed).toHaveBeenCalledWith(1000);
  });

  it('shows Resume while paused and toggles on click', () => {
    const props = renderToolbar({ paused: true });
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(props.onTogglePause).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/Toolbar.test.tsx`
Expected: FAIL — `Failed to resolve import "./Toolbar"`

- [ ] **Step 3: Write `src/ui/Toolbar.tsx`**

```tsx
import type { SpeedMultiplier } from '../sim/clock';

export interface ToolbarProps {
  multiplier: SpeedMultiplier;
  paused: boolean;
  onSelectSpeed: (m: SpeedMultiplier) => void;
  onTogglePause: () => void;
}

const SPEEDS: SpeedMultiplier[] = [1, 100, 1000];

export function Toolbar({ multiplier, paused, onSelectSpeed, onTogglePause }: ToolbarProps) {
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
      <button type="button" onClick={onTogglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/ui/Toolbar.test.tsx && npx tsc --noEmit`
Expected: `Tests  4 passed (4)`; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Toolbar.tsx src/ui/Toolbar.test.tsx
git commit -m "feat: add toolbar component"
```

---

### Task 9: Canvas scene renderer

**Files:**
- Create: `src/render/drawScene.ts`
- Test: `src/render/drawScene.test.ts`

**Interfaces:**
- Consumes: `Camera` (Task 7), `Layout` (Task 4), `Snapshot` (Task 6), `PLANETS` (Task 3).
- Produces:
  - `function drawScene(ctx: CanvasRenderingContext2D, snap: Snapshot, layout: Layout, camera: Camera, viewportW: number, viewportH: number): void`
  - Draw order: background `#0a0e1a` → planet orbit guides (`rgba(255,255,255,0.08)`) → sun glow + bodies → moon bubble guides (`rgba(255,255,255,0.05)`) → planet labels (`11px`, constant screen size).

- [ ] **Step 1: Write the failing test `src/render/drawScene.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { PLANETS } from '../sim/data';
import { Simulation } from '../sim/simulation';
import { Camera } from './camera';
import { drawScene } from './drawScene';

function createMockCtx() {
  const fns = {
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  return Object.assign(
    { fillStyle: '', strokeStyle: '', font: '', lineWidth: 0 },
    fns,
  ) as unknown as CanvasRenderingContext2D;
}

describe('drawScene', () => {
  it('draws the background, every body, all guides, and 8 planet labels', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(1025, 800, 600);
    const ctx = createMockCtx();

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600);

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    // 107 bodies + 1 sun glow + 8 planet orbit guides + 6 moon bubble guides
    expect(ctx.arc).toHaveBeenCalledTimes(122);
    expect(ctx.fillText).toHaveBeenCalledTimes(8);
    expect(vi.mocked(ctx.fillText).mock.calls.map((c) => c[0])).toEqual(
      PLANETS.map((p) => p.name),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/drawScene.test.ts`
Expected: FAIL — `Failed to resolve import "./drawScene"`

- [ ] **Step 3: Write `src/render/drawScene.ts`**

```ts
import type { Layout } from '../sim/layout';
import type { Snapshot } from '../sim/simulation';
import type { Camera } from './camera';

const BACKGROUND = '#0a0e1a';
const ORBIT_GUIDE = 'rgba(255, 255, 255, 0.08)';
const BUBBLE_GUIDE = 'rgba(255, 255, 255, 0.05)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.75)';
const LABEL_FONT = '11px system-ui, sans-serif';

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

  // Planet orbit guides (circles around the sun).
  ctx.strokeStyle = ORBIT_GUIDE;
  ctx.lineWidth = 1;
  for (const body of snap.bodies) {
    if (body.kind !== 'planet') continue;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, layout.planets[body.name].orbitRadius * camera.scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const body of snap.bodies) {
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

    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

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
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/render/drawScene.test.ts && npx tsc --noEmit`
Expected: `Tests  1 passed (1)`; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/render/drawScene.ts src/render/drawScene.test.ts
git commit -m "feat: add canvas scene renderer"
```

---

### Task 10: App wiring + full verification

**Files:**
- Create: `src/ui/DateDisplay.tsx`
- Test: `src/ui/DateDisplay.test.tsx`
- Create: `src/hooks/useSimulation.ts`
- Create: `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `index.html`

**Interfaces:**
- Consumes: everything above — `Simulation` (6), `Camera` (7), `drawScene` (9), `Toolbar` (8), `formatSimDate` (5), `SpeedMultiplier` (2).
- Produces:
  - `function DateDisplay(props: { date: string }): JSX.Element`
  - `function useSimulation(canvasRef: React.RefObject<HTMLCanvasElement | null>): { multiplier: SpeedMultiplier; paused: boolean; date: string; setMultiplier: (m: SpeedMultiplier) => void; togglePause: () => void }`
  - Running app: `npm run dev`

- [ ] **Step 1: Write the failing test `src/ui/DateDisplay.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DateDisplay } from './DateDisplay';

describe('DateDisplay', () => {
  it('renders the date string', () => {
    render(<DateDisplay date="2000-01-01" />);
    expect(screen.getByText('2000-01-01')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/DateDisplay.test.tsx`
Expected: FAIL — `Failed to resolve import "./DateDisplay"`

- [ ] **Step 3: Write `src/ui/DateDisplay.tsx`**

```tsx
interface DateDisplayProps {
  date: string;
}

export function DateDisplay({ date }: DateDisplayProps) {
  return <div className="date-display">{date}</div>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/DateDisplay.test.tsx`
Expected: `Tests  1 passed (1)`

- [ ] **Step 5: Write `src/hooks/useSimulation.ts`**

```ts
import { useEffect, useRef, useState } from 'react';
import { Camera } from '../render/camera';
import { drawScene } from '../render/drawScene';
import type { SpeedMultiplier } from '../sim/clock';
import { formatSimDate } from '../sim/formatDate';
import { Simulation } from '../sim/simulation';

const DATE_UPDATE_INTERVAL_FRAMES = 15;

export function useSimulation(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [multiplier, setMultiplierState] = useState<SpeedMultiplier>(1);
  const [paused, setPaused] = useState(false);
  const [date, setDate] = useState(() => formatSimDate(0));
  const simRef = useRef<Simulation | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sim = new Simulation();
    simRef.current = sim;
    const camera = new Camera();
    const outermost = Math.max(
      ...Object.values(sim.layout.planets).map((e) => e.orbitRadius + e.bubbleRadius),
    );

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
        camera.fitToView(outermost, width, height);
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
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      camera.panBy(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    let rafId = 0;
    let lastTime = performance.now();
    let framesSinceDateUpdate = 0;
    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      sim.advance(dt);
      drawScene(ctx, sim.snapshot(), sim.layout, camera, width, height);
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

  return { multiplier, paused, date, setMultiplier, togglePause };
}
```

- [ ] **Step 6: Write `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `index.html`**

`src/App.tsx`:

```tsx
import { useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { DateDisplay } from './ui/DateDisplay';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { multiplier, paused, date, setMultiplier, togglePause } = useSimulation(canvasRef);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" />
      <Toolbar
        multiplier={multiplier}
        paused={paused}
        onSelectSpeed={setMultiplier}
        onTogglePause={togglePause}
      />
      <DateDisplay date={date} />
    </div>
  );
}
```

`src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/styles.css`:

```css
html,
body,
#root {
  margin: 0;
  height: 100%;
  background: #0a0e1a;
  overflow: hidden;
}

.app {
  position: relative;
  width: 100%;
  height: 100%;
}

.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}

.scene:active {
  cursor: grabbing;
}

.toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 6px;
}

.toolbar button {
  background: #1b2340;
  color: #cfd8ff;
  border: 1px solid #34406e;
  border-radius: 4px;
  padding: 6px 10px;
  font: 13px system-ui, sans-serif;
  cursor: pointer;
}

.toolbar button:hover {
  background: #26305a;
}

.toolbar button.active {
  background: #3d5afe;
  color: #fff;
  border-color: #3d5afe;
}

.date-display {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #cfd8ff;
  font: 14px/1.2 ui-monospace, monospace;
  background: rgba(27, 35, 64, 0.8);
  padding: 6px 10px;
  border-radius: 4px;
}
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Solar System Simulation</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: `Test Files  10 passed (10)`, `Tests  48 passed (48)`

- [ ] **Step 8: Typecheck and production build**

Run: `npm run build`
Expected: `tsc --noEmit` clean, then vite prints `✓ built in ...` with `dist/index.html` and an asset bundle.

- [ ] **Step 9: Dev-server smoke check**

Run:

```bash
npm run dev -- --port 5173 --strictPort &
DEV_PID=$!
sleep 3
curl -s http://localhost:5173/ | grep -o '<title>[^<]*</title>'
kill $DEV_PID
```

Expected output: `<title>Solar System Simulation</title>`

Then open `http://localhost:5173/` in a browser and eyeball: all 8 planets on orbit guides with labels, moon dots clustered around the outer planets, date readout advancing (~1 day/s at 1x), speed buttons change the rate, Pause freezes the scene, wheel zooms toward the cursor, drag pans.

- [ ] **Step 10: Commit**

```bash
git add index.html src/App.tsx src/main.tsx src/styles.css src/hooks/ src/ui/DateDisplay.tsx src/ui/DateDisplay.test.tsx
git commit -m "feat: wire up app shell and simulation loop"
```

---

## Definition of done

- `npm test` — 48/48 passing across 10 files.
- `npm run build` — clean typecheck + production bundle.
- Dev server serves the page; acceptance criteria from the spec hold (planets orbit
  the sun, moons orbit planets, Mercury laps Earth ~4.15× per Earth year, speeds
  1x/100x/1000x, pause, date readout, labels, zoom/pan).
