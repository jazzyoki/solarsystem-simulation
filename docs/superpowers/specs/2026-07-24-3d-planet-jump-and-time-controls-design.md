# 3D Planet Jump List & Time-Scale Controls — Design

Date: 2026-07-24

## Motivation

With the 3D view mode shipped, some users struggle to navigate to individual
planets — free orbit-around-the-Sun controls make it easy to lose a planet.
This spec adds three related toolbar/navigation improvements:

1. A **planet jump list** (3D mode only) that flies the camera to a chosen
   planet and keeps it centered — mirroring how the comet picker works.
2. A **time-scale label** next to the speed selector (e.g. `1s = 1 day`) so the
   otherwise-abstract `1x / 10x / …` multipliers read in real terms.
3. Making the **speed and mode selectors permanent dropdowns** on desktop, not
   only under the mobile media query.

All three build on existing patterns (`CometPicker`, the ref-based comet
framing in `useSimulation`, the already-present mobile `<select>`s).

## Feature 1 — Planet jump list (3D only, frame + track)

### UI

- New component `src/ui/PlanetPicker.tsx`, structurally a copy of
  `CometPicker.tsx`: a single `<select className="planet-select">` with a
  leading `Select a planet…` placeholder option and an `aria-label="Planet"`.
- Options: **Sun + the 8 planets + Pluto** (10 entries), in Sun→Pluto order.
  Selecting **Sun** (or the empty placeholder) is the *release* — it returns
  to the Sun-centered view. Moons are **out of scope** for v1.
- Rendered by `App.tsx` **only when `mode === 'threeD'`**. In the two 2D modes
  the picker is not mounted.
- The option list is derived from a small static list of focusable body names
  (Sun + planet names, in order) so the picker does not depend on a live
  snapshot.

### State & wiring

- `useSimulation` gains `focusedBody: string | null` React state plus a
  `focusedBodyRef` (mirrors the existing `selectedComet` / `selectedCometRef`
  pattern), exposed as `focusedBody` and `selectBody(name: string | null)`.
- `selectBody('Sun')` and `selectBody(null)` are equivalent (both release);
  `App` maps the picker's empty value and the `Sun` value to the release.
- On **mode change away from `threeD`**, `focusedBody` resets to `null`.

### Renderer follow behavior (`src/render3d/ThreeRenderer.ts`)

The per-frame 3D branch of the render loop calls a new
`ThreeRenderer.setFocus(name: string | null)` immediately before `sync()`,
passing `focusedBodyRef.current`. `setFocus` records the requested focus name;
the actual camera work happens in the frame using the just-synced body
positions.

- **New focus** (focus name changed to a non-null body since last frame):
  locate that body in the current `Snapshot3D`, set `controls.target` to its
  position, and place the camera at a viewing distance derived from the body's
  `bodyRadius` — `dist = max(controls.minDistance * 1.5, bodyRadius * 8)` —
  positioned ~30° above the ecliptic (same framing convention as `resetView`).
  Store `lastFocusPos = bodyPos`.
- **Continuing focus** (same non-null body as last frame): compute
  `delta = bodyPos − lastFocusPos`, add `delta` to **both** `controls.target`
  and `camera.position`, then set `lastFocusPos = bodyPos`. This is a standard
  follow-camera: the planet stays centered at any clock speed while the user's
  own rotate/zoom offset is preserved. (Damping still runs in
  `controls.update()`.)
- **Release** (focus name became `null`/`Sun`): call `resetView(extent)` once
  and clear `lastFocusPos`. `extent` is the current to-scale extent already
  used elsewhere in the loop.

Focus resolution uses body positions from the `Snapshot3D` already computed in
the loop; if the named body is absent from the snapshot, focus is a no-op that
frame (defensive; should not happen for the fixed option set).

### Double-click release

The existing `dblclick` handler in `src/render3d/controls.ts` recenters the
Sun by setting `controls.target` to the origin. With a follow in effect, the
next frame would immediately re-grab the planet, so double-click must also
clear the focus **state**. `ThreeRenderer` accepts an `onFocusCleared`
callback (constructor option or setter); the `dblclick` handler invokes it, and
`useSimulation` wires it to `setFocusedBody(null)` so the dropdown snaps back to
`Sun`/placeholder. The callback runs through React state, so it is safe to call
from the DOM event.

## Feature 2 — Time-scale label

- New pure helper `timeScaleLabel(multiplier: SpeedMultiplier): string` in
  `src/ui/timeScale.ts`, returning `1s = <n> day(s)` where the model is
  `1x = 1 sim day / real second` (`SimClock.advance`). Mapping:

  | multiplier | label            |
  |-----------:|------------------|
  |        0.5 | `1s = ½ day`     |
  |          1 | `1s = 1 day`     |
  |         10 | `1s = 10 days`   |
  |        100 | `1s = 100 days`  |
  |       1000 | `1s = 1000 days` |

- Rendered as `<span className="time-scale">{timeScaleLabel(multiplier)}</span>`
  immediately after the speed `<select>` in `Toolbar`. It is presentational
  and derived from `multiplier`; no ARIA live region.

## Feature 3 — Speed + mode selectors always dropdowns

- In `src/ui/Toolbar.tsx`, remove the `.speed-buttons` and `.mode-buttons`
  button-group markup entirely; always render the `.speed-select` and
  `.mode-select` `<select>` elements (they already exist for mobile).
- Toolbar order becomes:
  `[speed ▾] [time-scale] [Pause] | [mode ▾] | [Comets]`.
- In `src/styles.css`:
  - Make `.speed-select` / `.mode-select` `display: inline-block` at all widths
    (remove the default `display: none`).
  - Delete the now-dead `.speed-buttons` / `.mode-buttons` rules and the
    media-query block that toggled button-groups vs. selects. Keep the
    `.toolbar-separator` desktop styling and its mobile hide, and keep the
    mobile date-controls repositioning.

## Layout — shared left picker column

Because Comets can be enabled while the user also jumps to a planet, both
pickers may be visible at once in 3D. Instead of each picker positioning
itself absolutely (today `.comet-picker` is `position: absolute`), introduce a
single absolutely-positioned container:

- `.picker-column { position: absolute; top: 52px; left: 12px; display: flex;
  flex-direction: column; gap: 6px; align-items: flex-start; }`
- `App` renders inside it: `PlanetPicker` (when `mode === 'threeD'`) then
  `CometPicker` (when `cometsEnabled`).
- `.comet-picker` loses its own absolute positioning and becomes a normal flex
  row inside the column; `.planet-picker` follows the same inline styling as
  `.comet-picker` (reuse the `.comet-select` visual treatment for
  `.planet-select`, or a shared class).

## Testing

- **`timeScaleLabel`** — unit test covering all five multipliers.
- **`PlanetPicker`** — renders the placeholder + 10 options, fires `onSelect`
  with the chosen name and with `null`/`Sun` for release.
- **`Toolbar`** — updated tests assert the speed and mode `<select>`s (not
  button groups) and that the time-scale label text matches the current
  multiplier.
- **Follow-camera math** in `ThreeRenderer` stays behind the WebGL boundary
  and is verified by running the app (consistent with the existing untested
  3D rendering code), not by a unit test.

## Out of scope (v1)

- Jumping to moons or comets from the planet picker (comets keep their own
  picker).
- Labels/reticles on the focused planet in the 3D scene.
- Any planet navigation in the 2D modes.
