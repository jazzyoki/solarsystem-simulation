# 3D Rendering Mode — Design

**Date:** 2026-07-24
**Status:** Approved (pending implementation plan)

## Summary

Add a third view mode to the solar-system simulation that renders the system in
true 3D — real orbital inclinations and ascending nodes, textured planetary
bodies, and an orbit-around-target navigation camera for mouse and touch. The
existing 2D **Schematic** and **To Scale** modes are unchanged; a new **3D**
entry in the mode switcher activates a WebGL (Three.js) renderer.

## Goals

- A `[ Schematic | To Scale | 3D ]` mode switcher. The first two use the
  existing 2D Canvas renderer, byte-for-byte unchanged. **3D** switches to a
  Three.js WebGL renderer with real inclinations.
- True 3D Keplerian orbits: planets, comets, and the asteroid belt tilted by
  their real inclination `i` and longitude of ascending node `Ω`.
- Textured spheres for the Sun, planets, Earth's Moon, and Pluto/Charon, with a
  Saturn ring; each falls back to its existing flat color until its texture
  loads.
- Orbit-around-target camera with best-practice mouse and touch navigation.

## Non-Goals (v1)

- Click-to-focus / follow-a-body camera retargeting (raycasting/picking).
- Per-moon real orbital planes — moons stay in a plane parallel to the ecliptic
  around their parent (consistent with today's schematic moon rings).
- Surface detail beyond diffuse maps (no normal/specular/night-lights/atmospheres).
- Animated 2D↔3D camera transitions — the two renderers swap by canvas.

## Tech Stack Context

React 18 + TypeScript + Vite. Current rendering is Canvas 2D. The codebase has
clean layering that this design preserves:

- `src/sim/` — pure orbital math, outputs positions only; no Canvas/React/Three
  awareness.
- `src/render/` — 2D Canvas renderer (`drawScene`, `Camera`, `visibility`,
  `asteroidBelt`).
- `src/hooks/` — `useSimulation` (RAF loop wiring sim → render),
  `pointerInteraction` (2D pan/pinch-zoom).

New dependency: `three` + `@types/three`.

## Architecture

### Mode type

`ScaleMode` becomes `'schematic' | 'toScale' | 'threeD'`. `useSimulation`
branches on the mode to pick the render backend and (for 3D) the 3D snapshot.

### Module layout

```
src/sim/
  types.ts          + inclinationRad, ascendingNodeRad on PlanetSpec & CometSpec
  data.ts           + those values for the 8 planets, comets, and Pluto/Charon
  orbit3d.ts        NEW — pure: (elements, simDays) -> {x,y,z}
  simulation.ts     + snapshot3D(), orbitPaths3D(), comet 3D paths/positions

src/render3d/       NEW — the WebGL backend (mirrors src/render/'s role)
  ThreeRenderer.ts  scene / camera / renderer lifecycle; sync(snapshot3D) per frame
  bodies.ts         sphere meshes; texture load + color fallback; Sun light + glow
  orbits.ts         tilted ellipse/line geometry for planet & comet paths
  belt.ts           asteroid ring distributed in the inclined band
  controls.ts       thin wrapper configuring Three OrbitControls
  textures.ts       texture registry + async loader with per-body fallback

src/render/         UNCHANGED — the 2D Canvas path stays exactly as-is
```

`src/sim/` stays pure — `orbit3d.ts` imports no Three.js. Three.js is imported
only under `src/render3d/`.

### Renderer lifecycle / canvas swap

A single `<canvas>` cannot hold both a `2d` and a `webgl` context, so the app
renders **two canvas elements** and shows exactly one:

- Switching to **3D** reveals the WebGL canvas and constructs `ThreeRenderer`
  (scene, camera, `OrbitControls`, meshes, texture loads).
- Switching away disposes Three resources (geometries, materials, textures,
  renderer, controls) and reveals the 2D canvas.
- The RAF loop calls either `drawScene(...)` (2D modes) or
  `threeRenderer.sync(snapshot3D, ...)` (3D) based on `currentMode`.

## 3D Orbital Math (`orbit3d.ts`)

Reuses the existing Keplerian solve, which already yields, in the orbital plane,
a radius `r` and true anomaly `ν`. The 3D lift rotates that point by the three
element angles into the ecliptic frame:

```
p_orbital = (r·cos ν, r·sin ν, 0)
p_3d = Rz(Ω) · Rx(i) · Rz(ω) · p_orbital          where ω = ϖ − Ω
```

- Output is `{x, y, z}` in the same world units as the 2D path (`× AU_TO_WORLD`);
  `AU_TO_WORLD` and the Kepler solvers are reused unchanged. `z` is north of the
  ecliptic.
- **Data addition:** planets currently store only the combined longitude of
  perihelion `ϖ = Ω + ω`. 3D needs `inclinationRad` (`i`) and
  `ascendingNodeRad` (`Ω`) as separate fields; `ω` is derived as `ϖ − Ω`. Added
  to `PlanetSpec` and `CometSpec`, stored in radians like existing angles.
- **Comets** get the same transform using their real `i`/`Ω`. Real inclination
  supersedes the `retrograde` flag in 3D (`i > 90°` produces retrograde motion
  naturally); the `retrograde` flag continues to drive the 2D modes so nothing
  regresses.
- **Moons** orbit in a plane parallel to the ecliptic around their parent
  (`z = parent.z`), a deliberate stylization; no per-moon `i`/`Ω`.

### Data sourcing

Planet `i` and `Ω` from JPL J2000 orbital elements; comet and Pluto/Charon
values from the JPL Small-Body Database entries already cited in `AGENTS.md`.

## Navigation UX (mouse + touch)

Camera model: **orbit-around-target** (turntable) looking at a focus point (Sun
at the origin by default), positioned by spherical coords `(radius, azimuth,
polar)`. Implemented with **Three.js `OrbitControls`** (from
`three/examples/jsm/controls/OrbitControls`), configured rather than hand-rolled.

**Mouse**

| Input | Action | Detail |
|---|---|---|
| Left-drag | Orbit (azimuth + polar) | Polar clamped to `[ε, π−ε]` so the view can't flip through the poles |
| Wheel | Dolly / zoom | Zoom toward the cursor ray; exponential step; clamp `radius` to `[min, max]` |
| Right-drag (or Shift+left) | Pan focus | Screen-plane translation of the target; speed scaled by distance |
| Double-click | Reset focus to Sun | Re-orientation escape hatch |

**Touch**

| Gesture | Action | Detail |
|---|---|---|
| 1-finger drag | Orbit | Same clamps as mouse |
| 2-finger pinch | Zoom | About the pinch midpoint |
| 2-finger drag | Pan focus | Disambiguated from pinch by tracking span change and midpoint translation together |

**Cross-cutting best practices** (mostly provided by `OrbitControls`):

- **Damping / inertia** — `enableDamping = true`; camera eases toward target
  spherical coords each frame. Biggest "feels professional" factor.
- **`touch-action: none`** on the canvas + `preventDefault` so the browser never
  hijacks gestures for scroll/pinch-zoom.
- **Unified Pointer Events** — one pointer path for mouse and touch.
- **Distance-adaptive speed** — pan/dolly speed scales with `radius`.
- **`pointercancel` + pointer capture** handled.

`OrbitControls` configuration: `enableDamping`, `minDistance`/`maxDistance`,
`screenSpacePanning`, zoom-to-cursor, and `touches = { ONE: ROTATE, TWO:
DOLLY_PAN }`.

## Textures & Assets

- **Source:** Solar System Scope maps (CC-BY-4.0) or NASA imagery (public
  domain) — equirectangular diffuse maps for Sun, 8 planets, Earth's Moon,
  Pluto/Charon, plus a Saturn ring alpha map. ~1–2K resolution to bound bundle
  size. CC-BY source attributed in the README.
- **Loading:** `textures.ts` registers one map per body, loaded via
  `THREE.TextureLoader`. Each mesh renders immediately in its existing flat
  color (from `data.ts`) and swaps to its texture on load — the scene is never
  blank and first paint is not gated on async loads.
- **Lighting:** the Sun is an emissive material + a point light at the origin;
  planets use `MeshStandardMaterial` lit by it. Saturn gets a ring mesh with the
  alpha map.
- **CSP:** static site behind nginx; textures are bundled, same-origin assets
  (Vite-fingerprinted) — no external-host / CSP concerns.

## Scene Content (v1)

All existing bodies appear in 3D:

- **Planets + tilted orbits** — 8 textured planet spheres on real inclined
  Keplerian orbit paths; textured Sun as light source.
- **Moons** — around parents in an ecliptic-parallel plane (see math section).
- **Asteroid belt** — points/instanced ring distributed in the inclined band
  between Mars aphelion and Jupiter perihelion.
- **Comets** — real 3D inclined orbits, using the same `orbit3d` transform; the
  existing green/red bound/unbound path cue carries over.

## Testing

Following the existing convention (test pure logic; mock or skip the drawing
surface):

- `orbit3d.test.ts` (new) — the correctness core:
  1. With `i = 0, Ω = 0`, 3D output collapses to exactly the existing 2D `(x, y)`
     with `z ≈ 0` (proves the lift is a strict superset).
  2. The body crosses `z = 0` at the ascending node.
  3. Maximum `|z|` matches `r·sin(i)` at the expected point.
  All `toBeCloseTo`, matching existing style.
- `simulation.test.ts` — extend for `snapshot3D()` / `orbitPaths3D()` shape and
  presence of `z`.
- `ThreeRenderer` is **not** unit-tested against a GPU (WebGL can't run in
  jsdom); it stays a thin imperative shell over the tested math. Pure helpers
  (spherical↔cartesian, texture registry lookup) get isolated unit tests.
- End-to-end verification by running the app (`npm run dev` / verify skill).

## Conventions Preserved

- `src/sim/` stays pure — `orbit3d.ts` computes positions only.
- Both existing 2D modes agree on longitude at `simDays = 0` and are unchanged.
- Visual concerns (meshes, textures, lighting, controls) live under
  `src/render3d/`.
- Commit each task independently; update this spec before coding if a task needs
  design changes.
