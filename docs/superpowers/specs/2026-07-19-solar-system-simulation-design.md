# Solar System Simulation — Design Spec

- **Date:** 2026-07-19
- **Status:** Approved design, ready for implementation planning

## Summary

A webpage showing a top-down 2D simulation of the solar system: 8 planets orbiting
the sun and 98 moons orbiting their planets. Distances and body sizes are **not** to
scale, but **orbital timing is exactly to scale** (all periods are real values in
days). The user selects time acceleration of 1x, 100x, or 1000x, where **1x = 1
Earth day of simulated time per real second**.

## Functional Requirements

1. Sun at the center; 8 planets on circular, coplanar orbits; 98 moons on circular
   orbits around their parent planets.
2. Orbital periods are real sidereal periods in days (tables below). Relative timing
   is exact; orbit radii and body sizes are stylized (layout algorithm below).
3. **Retrograde moons orbit backwards**: negative period = retrograde (e.g. Triton
   −5.8769 d, Phoebe −550.30 d). This falls out of the angle formula for free.
4. Speed selector with exactly three options: **1x, 100x, 1000x** (1x = 1 sim day /
   real second). Default: 1x.
5. **Pause / resume** button. Default: running.
6. **Simulated date display**: epoch is J2000 = 2000-01-01 12:00 UTC, shown as
   `YYYY-MM-DD`, advancing with sim time.
7. **Planet labels**: planet names drawn next to planets (moons are not labeled).
8. **Zoom & pan**: mouse wheel zooms toward the cursor (×1.1 per wheel notch);
   drag pans. Initial view fits the whole system (outermost moon bubble plus
   ~5% margin).
9. All bodies start at angle 0 (aligned) at the epoch — deterministic and testable.

### Moon roster (counts as of July 2026)

| Planet | Moons shown | Actual known count | Selection rule |
|---|---|---|---|
| Mercury | 0 | 0 | — |
| Venus | 0 | 0 | — |
| Earth | 1 | 1 | all |
| Mars | 2 | 2 | all |
| Jupiter | 20 | 115 | 20 named moons with shortest orbital periods |
| Saturn | 30 | 293 | 30 named moons with shortest orbital periods |
| Uranus | 29 | 29 | all |
| Neptune | 16 | 16 | all |

## Non-Goals (YAGNI)

- True-scale distances, sizes, elliptical orbits, inclinations, axial tilts
- Orbit trails, moon labels, textures/images, sounds, 3D
- Touch gestures (mouse-only zoom/pan is acceptable)
- Adjustable base rate, date scrubbing, saving state

## Architecture

Vite + React + TypeScript. Three layers with a strict one-way dependency rule
(UI → render → sim; `src/sim` imports nothing from the other layers and no DOM/React):

- **`src/sim/`** — pure TypeScript: data tables, simulation clock, orbital math,
  layout computation, date formatting. Fully unit-tested (Vitest, strict TDD).
- **`src/render/`** — Canvas 2D drawing + camera (zoom/pan). Paints a snapshot
  produced by the sim core; contains no physics.
- **`src/ui/` + `src/App.tsx`** — React: toolbar (1x/100x/1000x, pause) and date
  readout. A `useSimulation` hook owns the `requestAnimationFrame` loop and pushes
  only cheap state into React (speed, paused, date string, updated at most ~4×/s),
  so React never re-renders 60×/s.

### File structure

```
index.html
package.json  vite.config.ts  tsconfig.json
src/main.tsx                       bootstrap
src/App.tsx                        layout: canvas + toolbar + date display
src/styles.css                     dark theme, full-viewport canvas
src/sim/types.ts                   PlanetSpec, MoonSpec, Layout types
src/sim/data.ts                    all planet & moon tables (verbatim from spec)
src/sim/clock.ts                   SimClock
src/sim/orbits.ts                  angleAt, orbitalPosition
src/sim/layout.ts                  computeLayout (stylized orbit radii)
src/sim/simulation.ts              Simulation facade (clock + layout + positions)
src/sim/formatDate.ts              formatSimDate
src/render/camera.ts               Camera (worldToScreen, zoomAt, panBy, fitToView)
src/render/drawScene.ts            drawScene(ctx, snapshot, layout, camera, viewport)
src/ui/Toolbar.tsx                 speed buttons + pause
src/ui/DateDisplay.tsx             date readout
src/hooks/useSimulation.ts         rAF loop, canvas sizing, mouse input
tests colocated:                   src/sim/*.test.ts, src/render/camera.test.ts,
                                   src/ui/Toolbar.test.tsx
```

### Locked interfaces

```ts
// types.ts
interface PlanetSpec { name: string; periodDays: number; bodyRadius: number; color: string }
interface MoonSpec   { name: string; parent: string; periodDays: number } // negative = retrograde
interface BodyPosition { x: number; y: number } // world units (px at zoom 1)

// clock.ts
class SimClock {
  simDays: number
  paused: boolean
  multiplier: 1 | 100 | 1000
  advance(realDtSeconds: number): void  // simDays += min(dt, 0.25) * multiplier; no-op if paused
  setMultiplier(m: 1 | 100 | 1000): void
  setPaused(p: boolean): void
}

// orbits.ts
function angleAt(periodDays: number, simDays: number): number // 2π * simDays / periodDays
function orbitalPosition(cx: number, cy: number, radius: number, angle: number): BodyPosition

// layout.ts
interface LayoutEntry { orbitRadius: number; bubbleRadius: number }
interface Layout { planets: Record<string, LayoutEntry>; moons: Record<string, number> } // moon name -> orbit radius around parent
function computeLayout(planets: PlanetSpec[], moons: MoonSpec[]): Layout

// formatDate.ts
function formatSimDate(simDays: number): string // UTC, epoch 2000-01-01 -> "2000-01-01"

// simulation.ts
interface BodySnapshot { name: string; x: number; y: number; bodyRadius: number; color: string; kind: 'sun' | 'planet' | 'moon' }
interface Snapshot { simDays: number; bodies: BodySnapshot[] }
class Simulation {
  constructor()
  clock: SimClock
  layout: Layout
  advance(realDtSeconds: number): void
  snapshot(): Snapshot  // sun at (0,0); planets on their orbit radii; moons relative to parent position
}

// camera.ts
class Camera {
  scale: number; offsetX: number; offsetY: number
  worldToScreen(p: BodyPosition): BodyPosition
  screenToWorld(p: BodyPosition): BodyPosition
  zoomAt(screenPoint: BodyPosition, factor: number): void // keeps screenPoint fixed
  panBy(dx: number, dy: number): void
  fitToView(worldRadius: number, viewportW: number, viewportH: number): void
}

// drawScene.ts
function drawScene(ctx: CanvasRenderingContext2D, snap: Snapshot, layout: Layout, camera: Camera, w: number, h: number): void
```

## Time model

- 1x = 1 Earth day per real second ⇒ `simDays += realDtSeconds * multiplier`.
- Frame dt clamped to ≤ 0.25 s so returning from a background tab doesn't warp time.
- Known consequence: fast moons are fast (Phobos, 0.319 d, laps Mars in ~0.3 s at
  1x) and slow irregulars crawl (S/2021 N 1, −10 036.65 d). Ratios stay exact.

## Layout algorithm (stylized, deterministic)

- Planet display radii (px at zoom 1): Mercury 4, Venus 6, Earth 6, Mars 5,
  Jupiter 14, Saturn 12, Uranus 9, Neptune 9. Sun radius 22. All moons: 1.5 px dots.
- Moon rings: each planet's moons sorted by |period| ascending; moon *i* (0-based)
  orbits at `planetBodyRadius + 6 + i * 3` px from its planet's center.
- Moon bubble radius per planet: `bodyRadius + 6 + (n - 1) * 3 + 3` (0 if n = 0).
- Planet orbit radii accumulate outward so moon systems never overlap neighbor
  orbits: `R(Mercury) = 80`; `R(pᵢ) = R(pᵢ₋₁) + bubble(pᵢ₋₁) + bubble(pᵢ) + 25`.
- Invariant (tested): for every adjacent pair, `R(pᵢ) − bubble(pᵢ) >
  R(pᵢ₋₁) + bubble(pᵢ₋₁)`.

## Rendering

Draw order per frame: dark background (`#0a0e1a`) → planet orbit guide circles
(faint, `#ffffff14`) → sun (radial glow + disc `#ffcc33`) → for each planet: moon
guide circles (faint), planet disc (`color`), planet label (`11px sans-serif`,
constant screen size, offset up-right), moon dots (`#bbbbbb`). Canvas resizes with
`ResizeObserver`; devicePixelRatio-aware.

## UI

Toolbar top-left: buttons `1x`, `100x`, `1000x` (active one highlighted), then
`Pause`/`Resume`. Date readout top-right: `2000-01-01`. Dark theme.

## Error handling & edge cases

- dt clamp (tab switch) as above.
- Canvas resize via `ResizeObserver`; initial camera `fitToView` on outermost orbit.
- Data validation tests guard: no zero periods, every moon's parent exists, names
  unique, exact counts per planet (0/0/1/2/20/30/29/16).

## Testing strategy (Vitest + React Testing Library, strict TDD)

- `clock.test.ts`: advance at 1x adds 1.0 day per real second; at 1000x adds 1000;
  paused adds 0; dt > 0.25 s is clamped; `setMultiplier`/`setPaused`.
- `orbits.test.ts`: `angleAt` at ¼/½/full period; negative period → negative angle
  (retrograde); `orbitalPosition` distance from center equals radius.
- `layout.test.ts`: orbit radii strictly increasing; bubble non-overlap invariant;
  moon rings ordered by |period|.
- `data.test.ts`: counts per planet, parents exist, names unique, periods ≠ 0.
- `formatDate.test.ts`: epoch → `2000-01-01`; +1 → `2000-01-02`; +366 → `2001-01-01`
  (2000 is a leap year); large values.
- `camera.test.ts`: world↔screen round trip; `zoomAt` keeps anchor fixed; `panBy`.
- `simulation.test.ts`: after advancing 365.256 days, Earth's angle ≡ 0 (mod 2π);
  snapshot contains 107 bodies; moon position is relative to moving parent.
- `Toolbar.test.tsx`: renders 4 buttons; clicking `100x` calls back with 100;
  pause toggles label Pause/Resume.

## Acceptance criteria

- `npm run dev` shows the full system; planets visibly orbit the sun, moons orbit
  planets; Mercury laps Earth ~4.15× per Earth year (87.969 vs 365.256 days).
- Speed buttons change the rate 100-fold each; date readout advances ~1 day/s at 1x.
- Pause freezes all motion and the date; resume continues.
- Wheel zoom (anchored at cursor) and drag pan work; labels stay legible.
- `npm test` green.

## Data tables

Orbital periods are sidereal periods in days; irregular-moon values are JPL mean
elements (they vary slowly in reality — fine for this purpose). Sources: Wikipedia
moon tables (July 2026), which cite JPL integrations. Negative = retrograde.

### Planets

| Name | Period (days) | Body radius (px) | Color |
|---|---|---|---|
| Mercury | 87.9691 | 4 | `#9c8e82` |
| Venus | 224.701 | 6 | `#e3bb76` |
| Earth | 365.256 | 6 | `#4d9de0` |
| Mars | 686.980 | 5 | `#c1440e` |
| Jupiter | 4332.589 | 14 | `#d8a25e` |
| Saturn | 10759.22 | 12 | `#e0c38b` |
| Uranus | 30688.5 | 9 | `#7dd3d8` |
| Neptune | 60182 | 9 | `#5b7fd4` |

### Moons of Earth (1) and Mars (2)

| Name | Parent | Period (days) |
|---|---|---|
| Moon | Earth | 27.3217 |
| Phobos | Mars | 0.31891 |
| Deimos | Mars | 1.26244 |

### Moons of Jupiter (20)

| Name | Period (days) | | Name | Period (days) |
|---|---|---|---|---|
| Metis | 0.2959 | | Ersa | 248.62 |
| Adrastea | 0.2994 | | Himalia | 249.91 |
| Amalthea | 0.4990 | | Pandia | 251.23 |
| Thebe | 0.6753 | | Lysithea | 258.50 |
| Io | 1.7693 | | Elara | 258.89 |
| Europa | 3.5504 | | Dia | 277.25 |
| Ganymede | 7.1556 | | Carpo | 454.40 |
| Callisto | 16.690 | | Valetudo | 522.07 |
| Themisto | 129.97 | | Euporie | −546.18 |
| Leda | 240.33 | | Eupheme | −611.32 |

### Moons of Saturn (30)

| Name | Period (days) | | Name | Period (days) |
|---|---|---|---|---|
| Pan | 0.57505 | | Telesto | 1.88780 |
| Daphnis | 0.59408 | | Calypso | 1.88780 |
| Atlas | 0.60460 | | Helene | 2.73692 |
| Prometheus | 0.61588 | | Polydeuces | 2.73692 |
| Pandora | 0.63137 | | Dione | 2.73692 |
| Epimetheus | 0.69701 | | Rhea | 4.51750 |
| Janus | 0.69735 | | Titan | 15.9454 |
| Aegaeon | 0.80812 | | Hyperion | 21.2767 |
| Mimas | 0.94242 | | Iapetus | 79.3310 |
| Methone | 1.00955 | | Kiviuq | 448.91 |
| Anthe | 1.03890 | | Ijiraq | 451.12 |
| Pallene | 1.15606 | | Phoebe | −550.30 |
| Enceladus | 1.37022 | | Paaliaq | 685.72 |
| Tethys | 1.88780 | | Skathi | −725.73 |
| Telesto | 1.88780 | | Albiorix | 779.07 |
| — | — | | Bebhionn | 829.64 |

### Moons of Uranus (29)

| Name | Period (days) | | Name | Period (days) |
|---|---|---|---|---|
| Cordelia | 0.3347 | | Ariel | 2.5204 |
| Ophelia | 0.3764 | | Umbriel | 4.1442 |
| S/2025 U 1 | 0.4201 | | Titania | 8.7059 |
| Bianca | 0.4347 | | Oberon | 13.463 |
| Cressida | 0.4639 | | Francisco | −267 |
| Desdemona | 0.4736 | | Caliban | −580 |
| Juliet | 0.4931 | | Stephano | −677 |
| Portia | 0.5132 | | S/2023 U 1 | −681 |
| Rosalind | 0.5583 | | Trinculo | −749 |
| Cupid | 0.6125 | | Sycorax | −1286 |
| Belinda | 0.6236 | | Margaret | 1655 |
| Perdita | 0.6382 | | Prospero | −1974 |
| Puck | 0.7618 | | Setebos | −2215 |
| Mab | 0.9229 | | Ferdinand | −2788 |
| Miranda | 1.4135 | | — | — |

### Moons of Neptune (16)

| Name | Period (days) | | Name | Period (days) |
|---|---|---|---|---|
| Naiad | 0.2944 | | Nereid | 360.14 |
| Thalassa | 0.3115 | | Halimede | −1879.08 |
| Despina | 0.3347 | | Sao | 2912.72 |
| Galatea | 0.4287 | | S/2002 N 5 | 3156.55 |
| Larissa | 0.5547 | | Laomedeia | 3171.33 |
| Hippocamp | 0.9504 | | Psamathe | −9149.51 |
| Proteus | 1.1223 | | Neso | −9794.71 |
| Triton | −5.8769 | | S/2021 N 1 | −10036.65 |
