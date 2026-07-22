# Comets Toggle Design

## Summary

Add an optional **Comets** layer to the simulation. A toolbar toggle (off by
default) reveals a picker of the 15 most recognizable comets. Selecting one
auto-frames its orbit, draws its path, and places an exaggerated comet body at
its real position for the current sim date, moving as the clock advances.

Comets reuse the existing Keplerian to-scale machinery. Bound comets (closed
ellipses) are drawn **green**; unbound comets (hyperbolic / near-parabolic open
paths) are drawn **red** — an educational cue that green comets return and red
comets pass through once. A "jump to perihelion" action seeks the clock to the
selected comet's most dramatic near-Sun moment.

The simulation stays 2D and ecliptic. Each comet's orbit is flattened into the
ecliptic plane using its longitude of perihelion — the same simplification the
planets already use. This is a deliberate, documented approximation.

## Goals

- A toggle that adds comets without changing any existing behavior when off.
- 15 famous comets, scored by public recognition, spanning short-period,
  long-period, and hyperbolic/interstellar classes.
- Correct heliocentric position for each comet at any sim date, driven by the
  existing clock, speed, and date controls.
- Auto-framing so each comet's wildly different orbit size is viewable.
- Green = bound orbit, red = unbound orbit.

## Non-Goals

- Full 3D orbits or true foreshortened projection of inclined orbits.
- Physically-modeled comet tails, comae, brightness, or fragmentation.
- Shoemaker–Levy 9 (no heliocentric orbit — it orbited and struck Jupiter).
- Showing all 15 comets simultaneously (one focused comet at a time).
- Orbital perturbations, non-gravitational forces, or ephemeris-grade accuracy
  away from perihelion.

## The 15 Comets

Scored on public recognition: Great-Comet / naked-eye status, modern media
events, spacecraft-mission fame, meteor-shower parentage, and recent news.

| # | Comet | Designation | Class | Path color | Render style |
|---|---|---|---|---|---|
| 1 | Halley | 1P | Short-period | green | full ellipse |
| 2 | Encke | 2P | Short-period | green | full ellipse |
| 3 | Churyumov–Gerasimenko (Rosetta) | 67P | Short-period | green | full ellipse |
| 4 | Wild 2 (Stardust) | 81P | Short-period | green | full ellipse |
| 5 | Swift–Tuttle (Perseids) | 109P | Short-period | green | full ellipse |
| 6 | Tempel–Tuttle (Leonids) | 55P | Short-period | green | full ellipse |
| 7 | Hale-Bopp | C/1995 O1 | Long-period | green | perihelion arc |
| 8 | NEOWISE | C/2020 F3 | Long-period | green | perihelion arc |
| 9 | Hyakutake | C/1996 B2 | Long-period | green | perihelion arc |
| 10 | McNaught | C/2006 P1 | Near-parabolic | red | open path |
| 11 | Tsuchinshan–ATLAS | C/2023 A3 | Near-parabolic | red | open path |
| 12 | ISON (destroyed 2013) | C/2012 S1 | Near-parabolic | red | open path |
| 13 | 'Oumuamua | 1I | Hyperbolic | red | open path |
| 14 | Borisov | 2I | Hyperbolic | red | open path |
| 15 | 3I/ATLAS | 3I | Hyperbolic | red | open path |

**Excluded:** Shoemaker–Levy 9 (Jupiter-bound, no heliocentric solution);
Holmes, PanSTARRS, Lovejoy, Borrelly (lower recognition).

**Historical flag:** ISON disintegrated at its 2013 perihelion and no longer
exists. Its path is still shown, marked "historical."

### Reference orbital elements

Values below are the rounded reference set from JPL SBDB (retrieved
2026-07-22), sufficient for review. **Implementation must pull full-precision
elements** from the SBDB API with `&full-prec=true` for each designation, per
the project's high-precision data convention.

| Comet | e | a (AU) | q (AU) | i (°) | ω (°) | Ω (°) | Tp (JD) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Halley (1P) | 0.968 | 17.9 | 0.575 | 162 | 112 | 59.1 | 2446469.97 |
| Encke (2P) | 0.848 | 2.22 | 0.338 | 11.4 | 187 | 334 | 2460239.65 |
| 67P | 0.641 | 3.46 | 1.24 | 7.04 | 12.8 | 50.1 | 2457247.59 |
| Wild 2 (81P) | 0.537 | 3.45 | 1.60 | 3.24 | 41.7 | 136 | 2459929.29 |
| Swift–Tuttle (109P) | 0.963 | 26.1 | 0.960 | 113 | 153 | 139 | 2448968.50 |
| Tempel–Tuttle (55P) | 0.906 | 10.3 | 0.976 | 162 | 173 | 235 | 2450872.60 |
| Hale-Bopp (C/1995 O1) | 0.995 | 177 | 0.891 | 89.3 | 130 | 283 | 2450537.14 |
| NEOWISE (C/2020 F3) | 0.999 | 358 | 0.295 | 129 | 37.3 | 61.0 | 2459034.18 |
| Hyakutake (C/1996 B2) | 0.9999 | 2120 | 0.230 | 125 | 130 | 188 | 2450204.89 |
| McNaught (C/2006 P1) | 1.00002 | −9070 | 0.171 | 77.8 | 156 | 267 | 2454113.30 |
| Tsuchinshan–ATLAS (C/2023 A3) | ≈1.0 | −4110 | 0.391 | 139 | 308 | 21.6 | 2460581.24 |
| ISON (C/2012 S1) | ≈1.0 | −2450 | 0.0125 | 62.2 | 346 | 296 | 2456625.27 |
| 'Oumuamua (1I) | 1.20 | −1.27 | 0.256 | 123 | 242 | 24.6 | 2458006.01 |
| Borisov (2I) | 3.36 | −0.851 | 2.01 | 44.1 | 209 | 308 | 2458826.05 |
| 3I/ATLAS (3I) | 6.14 | −0.264 | 1.36 | 175 | 128 | 322 | 2460977.99 |

Longitude of perihelion `ϖ = Ω + ω` (used to orient the in-plane ellipse).
`Tp` in simDays = `Tp_JD − 2461041.5` (epoch JD for 2026-01-01 00:00 UTC).
`i > 90°` denotes retrograde motion in the ecliptic projection.

Source: [NASA/JPL Small-Body Database](https://ssd-api.jpl.nasa.gov/doc/sbdb.html)
(`sbdb.api?sstr=<designation>&full-prec=true`).

## Data Model

New `CometSpec` in `src/sim/types.ts`:

```ts
export type CometClass = 'short' | 'long' | 'hyperbolic';

export interface CometSpec {
  name: string;
  designation: string;
  /** Orbital eccentricity (>= 1 for hyperbolic/near-parabolic). */
  eccentricity: number;
  /** Semi-major axis in AU (negative for hyperbolic). */
  semiMajorAxisAu: number;
  /** Perihelion distance q in AU. */
  perihelionDistanceAu: number;
  /** Longitude of perihelion (Omega + omega) in radians. */
  perihelionLongitudeRad: number;
  /** Time of perihelion passage, in simDays (Tp_JD - 2461041.5). */
  perihelionTimeSimDays: number;
  /** True for retrograde (inclination > 90 deg) ecliptic motion. */
  retrograde: boolean;
  cometClass: CometClass;
  /** Display radius in world units (exaggerated for visibility). */
  bodyRadius: number;
  color: string;
  /** Optional flag, e.g. "historical" for ISON. */
  note?: string;
}
```

A `COMETS: CometSpec[]` array lives in `src/sim/data.ts` alongside `PLANETS`.

`cometClass` drives path style and color:

- `short`, `long` → bound ellipse → **green**.
- `hyperbolic` (includes JPL near-parabolic, `e ≈ 1`, negative `a`) → open
  path → **red**.

Comet body size is exaggerated for visibility: larger than a moon
(`MOON_STYLE.bodyRadius = 1.5`), smaller than the smallest planet
(`bodyRadius = 4`). A value near `3` world units is the target; the focused
comet may render slightly larger/brighter.

## Orbital Math

Three additions, all in `src/sim/` and kept pure:

### 1. High-eccentricity Kepler solver (`kepler.ts`)

Replace the `E = M` initial guess in `eccentricAnomalyFromMean` with a
high-eccentricity-safe starter so Newton–Raphson converges for `e` up to
~0.999 (Halley 0.968, Hale-Bopp 0.995). Backward-compatible for planets. The
existing tolerance and iteration cap are retained (raise the cap if needed for
convergence at high `e`).

### 2. Unified mean motion via Gauss's constant

Derive mean motion from the semi-major axis instead of storing a period:

```
n = GAUSS_K / |a|^1.5      GAUSS_K = 0.01720209895  (AU^1.5 / day)
M(t) = n * (simDays - Tp)   (negate for retrograde)
```

For an ellipse this equals `2π / period`, so the planet model is unchanged.
For a hyperbola it yields the hyperbolic mean anomaly directly. At `simDays =
Tp`, `M = 0` and the comet sits at perihelion (distance `q`).

### 3. Hyperbolic branch (`hyperbolicOrbit.ts`, new)

For `e ≥ 1`, solve the hyperbolic Kepler equation:

```
M = e * sinh(H) - H
```

for hyperbolic anomaly `H` (Newton–Raphson), then:

```
true anomaly:  nu = 2 * atan2( sqrt(e+1) * tanh(H/2), sqrt(e-1) )
radius:        r  = a * (1 - e * cosh(H))     (a < 0 => r > 0)
position:      longitude = perihelionLongitudeRad + nu
               (x, y) = r * (cos, sin)(longitude)
```

This covers the interstellar objects and the near-parabolic Great Comets, which
JPL already expresses as `e ≈ 1` with negative `a`.

### Bound comets

Bound comets (`short`, `long`) reuse `ellipticalPositionAu`, but with mean
anomaly computed from `Tp` via the unified `n` above rather than from an epoch
longitude. Long-period comets are positioned identically to short-period ones;
they differ only in how much of the path is drawn (see below).

### 2D ecliptic simplification

The simulation is 2D. Each comet's orbit is drawn as its true in-plane ellipse
oriented by `ϖ = Ω + ω`, flattened into the ecliptic — inclination is not
foreshortened. High-inclination comets (`i > 90°`) are marked `retrograde` so
their ecliptic-projected motion runs the correct direction. This matches the
existing planet model and is an accepted approximation, not ephemeris-grade.

## Path Generation

A `cometPath(spec, simDays)` helper in `src/sim/` returns a world-space
polyline (array of points). The sampled anomaly range depends on class:

- **short** — full orbit (`ν` over `[0, 2π)`); a closed green ellipse.
- **long** — a perihelion-arc window (`ν` over `[−νmax, +νmax]` chosen so the
  drawn segment spans the inner system rather than the full multi-hundred-AU
  ellipse); green.
- **hyperbolic** — an open arc bounded by the asymptotes
  (`cos ν∞ = −1/e`), windowed to the inner system; red.

`drawScene` renders comet paths as polylines (green or red per class), on top
of the existing orbit guides. Short-period ellipses may alternatively use the
native `ctx.ellipse` path already used for planets; the polyline sampler is the
uniform fallback that also serves arcs and open paths.

## Auto-Framing

On selecting a comet, the camera fits to the bounding box of that comet's
sampled path (the same windowed range used for drawing), with padding — reusing
the existing `Camera.fitToView` mechanism. This handles the 0.3 AU → tens-of-AU
range for drawn segments without the user zooming manually. Deselecting (or
turning the layer off) restores the planet-scale framing.

## Interaction & UI

- **Toolbar toggle** "Comets" (off by default), wired like the existing mode
  switcher: state in `useSimulation`, applied via a ref inside the RAF loop.
- **Comet picker**: a new `CometPicker` component (list/dropdown of the 15),
  visible only when the toggle is on. Mirrors existing UI component patterns.
- **Selecting a comet**:
  - If the current scale mode is Schematic, **auto-switch to To Scale** (comet
    orbits are a real-distance concept).
  - Auto-frame the comet's path.
  - Draw its path (green/red) and its exaggerated body at the current-date
    position.
- **Jump to perihelion**: a button on the focused comet seeks the clock to the
  comet's `Tp` (reusing `seekToDate`, which pauses), so the user sees the
  dramatic near-Sun moment. Comets whose `Tp` is far outside a sensible sim
  range still seek correctly; the body appears at perihelion distance `q`.
- **Comet body**: exaggerated dot (~3 world units) with a short anti-sunward
  tail that lengthens near perihelion, plus a label. Focused comet is
  emphasized.

When the toggle is off, no comet code runs in the render path and the scene is
byte-for-byte the prior behavior.

## Simulation Integration

- `Simulation` gains comet awareness: `snapshot()` includes the focused comet
  body when the layer is on; a `cometPath(mode)` / focused-comet accessor
  provides the path for `drawScene`; `extent`/framing accounts for the focused
  comet.
- `useSimulation` gains `cometsEnabled`, `selectedComet`, `setCometsEnabled`,
  `selectComet`, and a `jumpToPerihelion` action, following the existing
  `mode` / `seekToDate` wiring.
- Comet state changes are applied through the RAF-loop ref pattern already used
  for `pendingMode`.

## Testing

Following the existing pure-sim + mocked-`CanvasRenderingContext2D` style:

- **Solver:** upgraded elliptical solver satisfies `M = E − e·sin E` at
  `e = 0.968` and `0.995`; hyperbolic solver satisfies `M = e·sinh H − H` at
  `e = 1.2`, `3.36`, `6.14`.
- **Position:** at `simDays = Tp`, comet distance from Sun ≈ `q`
  (`toBeCloseTo`); one real-date cross-check against JPL for a short-period
  comet within tolerance.
- **Path sampler:** correct point count and endpoints; hyperbolic path stays
  within the asymptote bounds; short-period path closes.
- **Framing:** `extent`/fit for each orbit class produces a sane, non-degenerate
  box.
- **Color mapping:** `short`/`long` → green, `hyperbolic` → red.
- **UI:** toggle off by default; selecting a comet focuses it and auto-switches
  to To Scale; jump-to-perihelion seeks and pauses; picker hidden when off.
- **Data integrity:** exactly 15 comets; all required fields present; class
  tags valid; `retrograde` set iff `i > 90°`.

## Risks & Mitigations

- **High-e / near-parabolic convergence.** Mitigated by the improved solver
  starter and the dedicated hyperbolic branch for `e ≥ 1`; near-parabolic
  comets use the hyperbolic branch, avoiding the ill-conditioned `e ≈ 1`
  elliptical case.
- **Extreme orbit sizes.** Mitigated by per-class path windowing and
  auto-framing; full multi-hundred-AU ellipses are never drawn whole.
- **2D accuracy.** Accepted and documented; consistent with the existing planet
  model.
- **ISON no longer exists.** Shown as historical; flagged in data and UI.
