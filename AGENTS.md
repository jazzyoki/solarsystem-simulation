# Solar System Simulation — Agent Notes

## Project Overview

React + TypeScript + Vite canvas application that visualizes a stylized solar system: planet orbits, moons, an asteroid belt, and simulation-speed controls. Supports a **Schematic / To Scale** mode switcher (circular vs. real Keplerian elliptical orbits), a **3D view mode** (Three.js WebGL renderer with real orbital inclinations and orbit-around-target navigation), real 2026-epoch starting positions, and a clickable date UI (date picker + "Today" button) that seeks and pauses the simulation.

## Quick Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests (Vitest)
npm test

# Type check + production build
npm run build
```

## Directory Structure

- `src/sim/` — pure orbital math and state. Circular orbits (`orbits.ts`), Keplerian elliptical orbits (`kepler.ts`, `ellipticalOrbit.ts`), 3D transform and position computation for the 3D view mode (`orbit3d.ts`, lifting Keplerian 2D to ecliptic 3D via `Rz(Ω)·Rx(i)·Rz(ω)`, incl. comet 3D positions/paths), planet/moon + J2000 element data and `AU_TO_WORLD` (`data.ts`), layout, `SimClock` (`clock.ts`), mode-aware `Simulation` (`simulation.ts`), date⇄simDays conversion (`formatDate.ts`), and shared types incl. `ScaleMode` (`types.ts`).
- `src/render/` — Canvas 2D rendering logic (`drawScene`, `Camera`, `visibility`, `asteroidBelt`); `drawScene` draws circle or rotated-ellipse orbit guides per mode.
- `src/render3d/` — Three.js WebGL backend for the 3D view mode (`ThreeRenderer`,
  `bodies` incl. textures + Saturn ring, `orbits`, `belt`, `controls` =
  configured OrbitControls, `textures` registry). Loaded lazily via dynamic
  import when the user first switches to 3D; disposed on switching away.
  Three.js must not be imported outside this directory.
- `src/hooks/` — React hooks that wire simulation + rendering into the UI (`useSimulation`: mode switch, `seekToDate`, `goToToday`, startup-on-today; `pointerInteraction`: mouse/touch pan+zoom).
- `src/ui/` — `Toolbar` (speed, pause/resume, mode switcher) and `DateDisplay` (clickable date → native date picker + "Today" button) React components.
- `docs/superpowers/specs/` — approved design specs.
- `docs/superpowers/plans/` — implementation plans.

## Orbital Model

Two motion models share one epoch (2026-01-01 00:00 UTC, `simDays = 0`) and one set of per-planet data in `src/sim/data.ts`:

- **Schematic** (`orbits.ts`): each planet moves at constant angular speed `2π / periodDays` on an evenly spaced circular orbit, starting at its `epochAngleRad` (epoch true longitude). Negative `periodDays` denotes retrograde motion.
- **To Scale** (`kepler.ts` + `ellipticalOrbit.ts`): real J2000 elliptical orbits with the Sun at a focus, radially spaced by `semiMajorAxisAu × AU_TO_WORLD` (`AU_TO_WORLD = 150`).
  - Mean anomaly advances linearly: `M(t) = M₀ + 2π·t / periodDays`.
  - `M₀` (epoch mean anomaly) is **derived from** `epochAngleRad` so both modes agree on each planet's longitude at `simDays = 0` — never store it separately.
  - Kepler's equation `M = E − e·sin(E)` is solved for eccentric anomaly `E` by Newton–Raphson (`kepler.ts`), then converted to true anomaly and a position on the ellipse oriented by `perihelionLongitudeRad` (ϖ). This yields variable angular velocity (fast at perihelion, slow at aphelion).

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

### Planet orbital elements (`PLANETS` in `src/sim/data.ts`)

| Planet  | periodDays | epochAngleRad (°) | a (AU)      | e          | ϖ perihelion (°) |
|---------|-----------:|------------------:|------------:|-----------:|-----------------:|
| Mercury |    87.9691 |     242.262456669 |  0.38709927 | 0.20563593 |      77.45779628 |
| Venus   |    224.701 |     277.021284224 |  0.72333566 | 0.00677672 |     131.60246718 |
| Earth   |    365.256 |     100.209656729 |  1.00000261 | 0.01671123 |     102.93768193 |
| Mars    |     686.98 |     283.796552295 |  1.52371034 |  0.0933941 |     336.05637041 |
| Jupiter |   4332.589 |     108.967359114 |    5.202887 | 0.04838624 |      14.72847983 |
| Saturn  |   10759.22 |       1.552905047 |  9.53667594 | 0.05386179 |      92.59887831 |
| Uranus  |    30688.5 |      59.539656457 | 19.18916464 | 0.04725744 |      170.9542763 |
| Neptune |      60182 |       0.995246704 | 30.06992276 | 0.00859048 |      44.96476227 |

Angles are stored in radians (`× DEG_TO_RAD`); degrees shown here for readability. `epochAngleRad` comes from JPL Horizons heliocentric ecliptic longitudes at the 2026 epoch; `a`, `e`, `ϖ` are J2000 elements.

Moons (`MOONS`) carry only `parent` + `periodDays` (negative = retrograde); all sit at zero epoch phase except Earth's Moon, which has an `epochAngleRad` from its JPL geocentric longitude. Moons always render as schematic circular orbits around their parent. The asteroid belt (`ASTEROID_BELT.getRadii`) computes its inner/outer radii per mode — from Mars aphelion / Jupiter perihelion in to-scale mode, from layout orbit radii in schematic.

### Comets

A toolbar "Comets" toggle (off by default) reveals a `CometPicker` (`src/ui/CometPicker.tsx`) listing 15 famous comets (`COMETS` in `src/sim/data.ts`, typed as `CometSpec[]` in `src/sim/types.ts`). Selecting one focuses it: the hook auto-switches scale mode to **To Scale** (comet orbits are only meaningful at real scale), auto-frames the camera on the comet's `cometExtent` via a one-shot `pendingCometFrameRef`, and starts drawing the comet's path plus an exaggerated body (`bodyRadius` far larger than real, for visibility) with an anti-sunward tail and label, at the comet's real heliocentric position for the current sim date — it moves with the clock like any other body. A "Jump to perihelion" button seeks the clock to the comet's `perihelionTimeSimDays` and pauses (same seek-pauses convention as the date picker). Turning Comets off, or deselecting, clears the selection; `cometPath`/`cometBody` are `null` whenever nothing is selected or the toggle is off, so disabled comets have zero effect on existing rendering.

Comets come in three classes (`CometSpec.cometClass`) across the 15 entries in `COMETS` (6 short-period, 3 long-period, 6 hyperbolic):

- **`short`** — short-period, elliptical, drawn as a full closed ellipse (`nuMax = π` in the path sampler).
- **`long`** — long-period, elliptical (`e < 1`) but with `a` far too large to draw a full ellipse usefully; the path is clipped to the perihelion arc where `r <= COMET_PATH_WINDOW_AU` (35 AU).
- **`hyperbolic`** — unbound (`e >= 1`), including interstellar objects (e.g. Borisov); the path is an open arc clipped to the same radius window and, additionally, stopped just inside the true-anomaly asymptote (`nuInf = acos(-1/e)`, minus a small epsilon) since the curve never closes.

Path color is a deliberate educational cue: **green = bound orbit** (`short` or `long` — the comet returns), **red = unbound** (`hyperbolic` — a one-time pass). This is computed in `Simulation.cometPath` (`src/sim/simulation.ts`) as `CometPathRender { points; color: 'green' | 'red' }`. The comet body itself does not follow this cue — every comet renders in the same fixed icy color, `COMET_COLOR = '#dbeeff'` (`src/sim/data.ts`), regardless of class; only the orbit path is green or red.

Orbit math lives entirely in `src/sim/`:

- **`kepler.ts`** — the existing planet Kepler solver (`M = E − e·sin(E)`) is hardened with a Newton+bisection fallback so it stays convergent at the high eccentricities comets have (vs. planets' near-circular orbits).
- **`hyperbolicOrbit.ts`** (new) — solves the hyperbolic Kepler equation `M = e·sinh(H) − H` for the hyperbolic anomaly `H` via Newton–Raphson (seeded from `asinh(M/e)`), then converts `H` to true anomaly.
- **`cometOrbit.ts`** (new) — `cometPositionAu` and `cometPathAu`. Mean motion is unified across all comet classes via Gauss's gravitational constant, `n = k / |a|^1.5` (`GAUSS_K = 0.01720209895` AU^1.5/day, `|a|` so the same formula works for hyperbolic `a < 0`) — no stored per-comet period. Position is parameterized by time of perihelion passage rather than epoch mean anomaly: `M(t) = n · (simDays − Tp)`, where `Tp` is stored as `perihelionTimeSimDays = Tp_JD − 2461041.5` (JD converted into the sim's day-0 epoch). `M` is negated for `retrograde` comets (inclination > 90°) to reverse ecliptic motion.
  - **Radius uses the polar conic form** `r = q(1+e) / (1 + e·cos(ν))` — anchored on the stored perihelion distance `q`, not on `a(1−e)` — so the comet marker always sits exactly on its own drawn path. This is a deliberate refinement: `a`, `e`, and `q` are independently-sourced, rounded JPL elements that don't satisfy `a(1−e) = q` to full precision, so computing radius from `a` instead of `q` would visibly detach the body from the path near perihelion.
  - The path sampler (`cometPathAu`) builds a polyline symmetric in true anomaly about perihelion, windowed per class as described above, using `COMET_PATH_SEGMENTS = 128` segments.

**2D ecliptic simplification.** Like the existing planet model, comet orbits are flattened into the shared ecliptic plane: `perihelionLongitudeRad` stores the longitude of perihelion `ϖ = Ω + ω` directly (no separate inclination term applied to position), and high-inclination comets (`i > 90°`, e.g. Halley) are simply flagged `retrograde` to reverse their direction of travel along the ecliptic-projected path. This matches the planets' existing stylization — a schematic approximation of true 3D orbits, not ephemeris-grade — so comet paths, like planet orbits, should not be read as precise sky positions.

Orbital elements are sourced from the JPL Small-Body Database. Comet ISON is flagged `note: 'historical'` (it was destroyed during its 2013 perihelion passage and is included for its instructive hyperbolic/near-parabolic path, not as an object still observable today). Shoemaker-Levy 9 is intentionally excluded from `COMETS` — it had no independent heliocentric orbit, having been a fragmented body in Jovian orbit at the time of its 1994 impact.

## Conventions

- Keep `src/sim/` pure: it computes positions only; it knows nothing about the Canvas API, React, or screen state. Impure reads (e.g. `Date.now()`) belong in the hook, not in `src/sim/`.
- Both scale modes must agree on each planet's longitude at `simDays = 0` — derive the epoch mean anomaly from the stored epoch longitude so switching modes never jumps an angle or resets the clock.
- Seeking to a date (date picker or "Today") pauses the simulation; the user resumes manually. Startup, by contrast, seeds to today and keeps running.
- Put visual concerns (opacity, colors, labels, belts) in `src/render/`.
- Follow existing test style: mock `CanvasRenderingContext2D` for render tests, use `toBeCloseTo` for floating-point assertions.
- Commit each task independently. Do not rewrite public history.
- If a task needs design changes, pause and update the spec before coding.
