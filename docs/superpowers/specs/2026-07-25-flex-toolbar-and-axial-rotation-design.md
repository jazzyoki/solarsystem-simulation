# Flex Toolbar Layout + 3D Axial Rotation — Design Spec

- **Date:** 2026-07-25
- **Status:** Approved design, ready for implementation planning

## Summary

Two independent changes, implemented as separate tasks:

**Part A — Flex toolbar layout.** The toolbar row grew when the speed dropdown
started showing `1s = 3 months` instead of `1000x`, and `.toolbar` is an
absolutely positioned flex row with no `flex-wrap`, so on a narrow phone it can
run off-screen. Let it wrap, and stop `.picker-column` from colliding with a
two-row toolbar by moving both into one positioned stack container.

**Part B — 3D axial rotation.** Planets, Pluto, and the Sun rotate about their
own axes in the 3D view, at their real sidereal rates and real axial tilts,
whenever the speed scale is below `1s = 1 month`. Above that the spin would
strobe, so it freezes.

---

## Part A — Flex toolbar layout

### Requirements

1. `.toolbar` wraps to additional rows when it does not fit, at any viewport
   width (not only inside the `@media (max-width: 640px)` block).
2. `.picker-column` always sits below the toolbar, however many rows it has.
   Its hardcoded `top: 52px` — which assumes a one-row toolbar — is removed.
3. Panning/zooming the 2D canvas and orbiting the 3D canvas must still work
   everywhere the new container's bounding box overlaps empty space.
4. On a wide desktop viewport the toolbar still renders as a single row and the
   picker column's position changes by no more than ~1px.

### Architecture

A new `.left-stack` wrapper in `src/App.tsx` holds `<Toolbar>` and the existing
`.picker-column` div. The wrapper owns the absolute position; its two children
become in-flow.

```css
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

.picker-column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  pointer-events: auto;
}
```

Three details are load-bearing:

- `max-width` is what forces the wrap. Without it the shrink-to-fit stack keeps
  growing past the viewport edge.
- `align-items: flex-start` keeps both children at their current shrink-to-fit
  widths. The default `stretch` would widen the pickers to the toolbar's width.
- The `pointer-events: none` / `auto` pair is required, not cosmetic. The
  stack's bounding box is now the union of both children, so a transparent
  container would swallow canvas drags in the empty area beside the narrower
  picker column.

`.toolbar` and `.picker-column` each lose `position: absolute`, `top`, and
`left`. The `@media (max-width: 640px)` block needs no change: it only hides
`.toolbar-separator` and repositions `.date-controls`.

### Non-Goals

- No change to what the toolbar contains, or to any component's props.
- No change to `.date-controls`, which is positioned independently on the right.
- No responsive breakpoint work beyond the wrap.

---

## Part B — 3D axial rotation

### Requirements

1. In the 3D view, the Sun and all nine planets (including Pluto) rotate about
   their own axes. Moons and comets do not.
2. Rotation rate is each body's real sidereal rotation period.
3. Each body is tilted by its real axial obliquity. The tilt is static geometry
   and applies at **every** speed — Uranus lies on its side even when the spin
   is frozen.
4. Spin is active only while the speed multiplier is **below** `2_592_000`
   (`1s = 1 month`) — i.e. for the five scales `1s = 20 min` through
   `1s = 24 h`.
5. At or above that multiplier the spin **freezes at its last angle**; it does
   not snap to zero. Dropping back below the cutoff resumes from the angle the
   date now implies, which is a one-frame jump — accepted, because the angle is
   derived from `simDays` rather than accumulated.
6. The spin angle is a pure function of `simDays`, never an accumulator, so
   seeking to a date, pausing, or switching view modes always yields the same
   orientation for the same date.
7. Saturn's ring keeps its present on-screen orientation, and does not spin
   with the planet.

### Rotation data

`PlanetSpec` gains two fields; the `SUN` constant gains the same two.

**`rotationPeriodDays` is always positive.** Retrograde spin is expressed
*only* through obliquity > 90°, per the IAU convention. This is a deliberate
departure from the repo's orbital convention, where `MoonSpec.periodDays` is
signed and a negative value means retrograde. Carrying that convention into
rotation would double-count: Venus would get both a negative period and its
177.36° obliquity, the two would cancel, and Venus would spin the wrong way.

| Body    | `rotationPeriodDays` | Obliquity (°) | Spin sense           |
|---------|---------------------:|--------------:|----------------------|
| Sun     |                25.38 |          7.25 | prograde             |
| Mercury |               58.646 |         0.034 | prograde             |
| Venus   |              243.025 |        177.36 | retrograde (via tilt)|
| Earth   |              0.99727 |         23.44 | prograde             |
| Mars    |              1.02596 |         25.19 | prograde             |
| Jupiter |              0.41354 |          3.13 | prograde             |
| Saturn  |              0.44401 |         26.73 | prograde             |
| Uranus  |              0.71833 |         97.77 | retrograde (via tilt)|
| Neptune |              0.67125 |         28.32 | prograde             |
| Pluto   |              6.38723 |        122.53 | retrograde (via tilt)|

Two acknowledged stylizations, both consistent with what the renderer already
does:

- Obliquity is defined relative to each body's *orbital* plane but applied here
  relative to the ecliptic. The two differ by the orbital inclination — ≤ 7°
  for everything except Pluto's 17°.
- The tilt direction is toward world +x rather than the true node longitude.
  This is exactly the stylization `src/render3d/bodies.ts:64` already uses for
  Saturn's ring.

Saturn's ring tilt changes from the current hardcoded 26.7° to the real 26.73°
— visually indistinguishable.

### Architecture

**`src/sim/rotation.ts`** (new). One pure function:

```ts
axialSpinRad(simDays: number, rotationPeriodDays: number): number
```

Returns `2π · simDays / rotationPeriodDays` wrapped into `[0, 2π)`, and `0`
when the period is `0`. The wrap must handle negative `simDays` (dates before
the 2026 epoch) without returning a negative angle. A missing guard on a `0`
period would yield `NaN`, which silently makes a body disappear.

**`BodySnapshot3D`** (`src/sim/simulation.ts`) gains `spinRad: number` and
`obliquityRad: number`, both **required** — TypeScript then names every
construction site that needs updating. `snapshot3D()` populates them for the
Sun and the planets and passes `0` for moons. `cometBody3D()` is a separate
construction site and also passes `0` for both. The 2D `BodySnapshot` is
untouched, so nothing under `src/render/` changes.

Both fields are per-body static-plus-dynamic data sent every frame, matching
how `bodyRadius` and `color` are already delivered.

**Scene graph** (`src/render3d/bodies.ts`). No new node — the existing group
carries the tilt:

```
group  (position per frame; rotation.x = obliquityRad, set once at creation)
├── sphere mesh   rotation.z = spinRad per frame   ← the only thing that spins
├── Saturn ring   tilted with the group, never spun
└── sun glow      sprite; always billboarded, so the tilt is a no-op for it
```

`createBodyObject` sets `group.rotation.x = body.obliquityRad` and deletes both
`mesh.rotation.x = SATURN_RING_TILT_RAD` and the `SATURN_RING_TILT_RAD`
constant, since the group's tilt now supplies it. Child order is unchanged, so
the existing `children[0]` / `children[1]` assertions in
`sceneObjects.test.ts` keep holding.

`bodies.ts` also exports `applyBodySpin(group, spinRad)`, a one-liner that
writes `rotation.z` on the group's first child (the sphere mesh, per the child
order above). It exists so the spin application is testable in jsdom:
`ThreeRenderer` cannot be instantiated there because it needs a real WebGL
context.

**The cutoff** lives in `src/sim/clock.ts`, beside the speeds:

```ts
export const AXIAL_SPIN_MAX_MULTIPLIER = 2_592_000;
export function axialSpinEnabled(m: SpeedMultiplier): boolean {
  return m < AXIAL_SPIN_MAX_MULTIPLIER;
}
```

**`ThreeRenderer`** gains `setSpinEnabled(enabled: boolean)`, mirroring the
existing `setFocus(name)`. `sync()` calls `applyBodySpin` only when enabled;
skipping the write is what makes the spin freeze in place rather than reset.
The renderer never learns what a multiplier is — the sim decides, the renderer
applies.

**`useSimulation`**'s RAF loop calls
`threeRenderer.setSpinEnabled(axialSpinEnabled(sim.clock.multiplier))` in the
3D branch, alongside the existing `setFocus` call. Pausing needs no special
case: `simDays` stops changing, so the angle stops changing.

### Why the cutoff sits at `1s = 1 month`

| Scale                       | Earth          | Jupiter (fastest)                   |
|-----------------------------|----------------|-------------------------------------|
| `1s = 20 min`               | 1 turn / 72 s  | 1 turn / 30 s                       |
| `1s = 24 h` (last enabled)  | 1 turn / s     | 2.4 turns / s — 14.5°/frame at 60fps|
| `1s = 1 month` (disabled)   | 30 turns / s   | 72 turns / s — pure strobing        |

### Non-Goals

- No rotation for moons or comets. Moons render at 1.5 world units — a few
  pixels at normal zoom — and would need new `MoonSpec` fields.
- No axial rotation in the 2D views, which draw flat discs.
- No day/night terminator, no per-body texture longitude calibration: the spin
  starts from the texture's own zero meridian at `simDays = 0`.
- No precession, no differential (latitude-dependent) solar rotation.
- No UI affordance for toggling rotation; the speed scale governs it.

---

## Error handling

The only failure mode is bad data — a zero or missing rotation period —
absorbed by `axialSpinRad` returning `0` and caught at commit time by the data
tests. No new async work and no new disposable resources: the tilt is set on an
object `ThreeRenderer.dispose()` already traverses.

## Testing strategy

TDD with Vitest.

**`src/sim/rotation.test.ts`** (new) — `axialSpinRad`: `0` at `simDays = 0`; a
quarter period gives `π/2`; a whole period wraps to `~0`, not `2π`; negative
`simDays` wraps into `[0, 2π)`; a `0` period returns `0`, not `NaN`.

**`src/sim/data.test.ts`** — extends the existing per-planet tables: every
`rotationPeriodDays` is finite and strictly positive (this is what enforces the
"retrograde lives in obliquity only" convention against a future edit); every
`obliquityRad` is within `[0, π]`; Venus, Uranus, and Pluto have obliquity
> 90° and no other body does.

**`src/sim/clock.test.ts`** — `axialSpinEnabled` driven from
`SPEED_MULTIPLIERS`: true for exactly the first five entries, false for the
last four, with the boundary asserted explicitly (`86_400` true, `2_592_000`
false).

**`src/sim/simulation.test.ts`** — `snapshot3D()` reports `spinRad = 0` for
every body at `simDays = 0`; at a quarter of Earth's rotation period Earth's
`spinRad ≈ π/2` while Jupiter's differs, proving the rate is per-body; moons
and comets report `0` for both new fields; `obliquityRad` matches the data
(Uranus ≈ 97.77°).

**`src/render3d/sceneObjects.test.ts`** — the Mars fixture's group carries
`rotation.x === obliquityRad`; Saturn's ring child has `rotation.x === 0` while
its group carries the tilt; `applyBodySpin` writes the sphere's `rotation.z`
and leaves the ring untouched; the existing pole-at-`+Z` and child-order tests
stay green unchanged.

### What tests do not cover

Stated plainly rather than papered over with tests that only appear to cover
it:

- The `if (spinEnabled)` gate in `sync()` — a one-line branch inside a class
  that cannot be instantiated without WebGL.
- All of Part A. jsdom performs no layout and does not compute
  `pointer-events`, so neither the wrap nor the drag-through behavior is
  assertable.

### Manual verification

1. At ~360px viewport width the toolbar wraps to two rows and the picker column
   sits below it, not under it.
2. Dragging the canvas in the empty area beside the picker column still pans in
   2D and orbits in 3D.
3. On a wide desktop viewport the toolbar is one row and nothing has visibly
   moved.
4. In 3D at `1s = 24 h`, Earth turns about once per second; Uranus is visibly
   on its side; Venus turns the opposite way to Earth.
5. At `1s = 1 month` the spin freezes while orbital motion continues.
6. Seeking away from a date and back reproduces the same orientations.

## Acceptance criteria

- The toolbar wraps instead of overflowing at narrow widths, and the picker
  column clears it at any row count.
- Canvas drag/zoom still works beside the picker column in both 2D and 3D.
- In 3D below `1s = 1 month`, the Sun and all nine planets spin at their real
  sidereal rates about their real tilts; at or above it the spin is frozen.
- Saturn's ring stays tilted and does not spin.
- `npm test` passes (excluding the pre-existing, unrelated
  `src/staticAssets.test.ts` font-rendering failure).
- `npm run build` is clean.
