# Solar System Simulation — Agent Notes

## Project Overview

React + TypeScript + Vite canvas application that visualizes a stylized solar system: planet orbits, moons, an asteroid belt, and simulation-speed controls. Supports a **Schematic / To Scale** mode switcher (circular vs. real Keplerian elliptical orbits), real 2026-epoch starting positions, and a clickable date UI (date picker + "Today" button) that seeks and pauses the simulation.

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

- `src/sim/` — pure orbital math and state. Circular orbits (`orbits.ts`), Keplerian elliptical orbits (`kepler.ts`, `ellipticalOrbit.ts`), planet/moon + J2000 element data and `AU_TO_WORLD` (`data.ts`), layout, `SimClock` (`clock.ts`), mode-aware `Simulation` (`simulation.ts`), date⇄simDays conversion (`formatDate.ts`), and shared types incl. `ScaleMode` (`types.ts`).
- `src/render/` — Canvas 2D rendering logic (`drawScene`, `Camera`, `visibility`, `asteroidBelt`); `drawScene` draws circle or rotated-ellipse orbit guides per mode.
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

## Conventions

- Keep `src/sim/` pure: it computes positions only; it knows nothing about the Canvas API, React, or screen state. Impure reads (e.g. `Date.now()`) belong in the hook, not in `src/sim/`.
- Both scale modes must agree on each planet's longitude at `simDays = 0` — derive the epoch mean anomaly from the stored epoch longitude so switching modes never jumps an angle or resets the clock.
- Seeking to a date (date picker or "Today") pauses the simulation; the user resumes manually. Startup, by contrast, seeds to today and keeps running.
- Put visual concerns (opacity, colors, labels, belts) in `src/render/`.
- Follow existing test style: mock `CanvasRenderingContext2D` for render tests, use `toBeCloseTo` for floating-point assertions.
- Commit each task independently. Do not rewrite public history.
- If a task needs design changes, pause and update the spec before coding.
