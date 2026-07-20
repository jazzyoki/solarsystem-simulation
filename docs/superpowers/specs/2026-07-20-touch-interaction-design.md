# Touch Interaction Design

**Goal:** Make the solar system simulation usable on mobile browsers by adding touch gesture support for panning and zooming, mirroring the existing mouse interaction model.

**Architecture:** Extend the existing pointer event pipeline in `src/hooks/useSimulation.ts` to track multiple active pointers. Extract the multi-pointer state machine into a small testable module `src/hooks/pointerInteraction.ts`. The new module manages active pointer positions, computes gesture deltas, and invokes `Camera` methods (`panBy`, `zoomAt`). `Camera` itself needs no changes because the existing `panBy` and `zoomAt` abstractions already work for all input sources.

**Tech Stack:** TypeScript, React, Vite, Canvas 2D, Vitest.

## Global Constraints

- React ^18.3.1, TypeScript ^5.6.3, Vite ^5.4.11, Vitest ^2.1.8.
- No new runtime dependencies.
- `src/sim/` stays pure; input handling is UI wiring and remains in `src/hooks/`.
- Keep mouse behavior unchanged (wheel zoom, left-button drag pan).
- Follow existing test patterns: test helper functions with numeric assertions and render tests with mocked `CanvasRenderingContext2D` where needed.
- Browser support: modern touch-capable browsers that implement Pointer Events Level 2 (iOS Safari 13+, Chrome Android).

## Supported Gestures

| Gesture | Input | Camera action |
|---------|-------|---------------|
| One-finger drag | Touch | Pan. |
| Two-finger pinch/spread | Touch | Zoom about the midpoint of the two touches, based on change in finger separation. |
| Two-finger drag | Touch | Pan while pinching, using midpoint movement. |
| Mouse drag | Mouse | Pan (existing). |
| Wheel | Mouse | Zoom at cursor (existing). |

## Implementation

### 1. Prevent browser gestures on the canvas

Update `src/App.css` (or the relevant stylesheet for `.scene`):

```css
.scene {
  touch-action: none;
}
```

This stops the browser from scrolling, pull-to-refresh, or pinch-zooming the page while the user interacts with the simulation.

### 2. Extract pointer gesture state machine

Create `src/hooks/pointerInteraction.ts`.

Public shape:

```ts
import type { Camera } from '../render/camera';

export interface PointerPoint {
  x: number;
  y: number;
}

export class PointerInteraction {
  constructor(camera: Camera);

  /** Call on `pointerdown`. Expects canvas-relative coordinates. */
  pointerDown(id: number, point: PointerPoint): void;

  /** Call on `pointermove`. Expects canvas-relative coordinates. */
  pointerMove(id: number, point: PointerPoint): void;

  /** Call on `pointerup` / `pointercancel` / `pointerleave` for the canvas. */
  pointerUp(id: number): void;

  /** Total number of pointers currently tracked by the canvas (including ignored extras). */
  activeCount(): number;
}
```

Behavior:

- Internally store pointers in a `Map<number, PointerPoint>` keyed by pointer id, and keep an ordered list of the first two pointer IDs to arrive (`primaryIds`). Only the primary pointers drive pan/pinch gestures; additional pointers are ignored for gesture purposes but are still tracked so they can be released cleanly.
- On every change, compute:
  - If count === 1: pan by the delta of the remaining pointer since the previous frame.
  - If count === 2: compute span and midpoint of the two primary pointers. Initialize a `previousSpan` and `previousMidpoint` when the second primary arrives. On subsequent moves:
    - `panBy(currentMidpoint.x - previousMidpoint.x, currentMidpoint.y - previousMidpoint.y)`.
    - `zoomAt(currentMidpoint, currentSpan / previousSpan)`.
    - Update `previousSpan` and `previousMidpoint` after applying.
    
  Panning before zooming maps the previous midpoint onto the current midpoint first, so the scale is applied about the correct current midpoint and the transform stays exact across sequential pointer events.
- When count drops from 2 → 1, reset `previousSpan` and `previousMidpoint` so the next two-finger pinch starts fresh.
- For one-finger pan, store the previous pointer position per pointer id to compute `deltaX/deltaY`. This naturally handles transitions such as lift one finger of a two-finger pinch → continue panning with the remaining finger.
- Ignore pressure/tangential details; only `x` and `y` matter.

Canvas-relative coordinates: `useSimulation.ts` already reads `canvas.getBoundingClientRect()` to convert mouse coordinates. The same conversion will be applied to all pointer coordinates before passing them to `PointerInteraction`.

### 3. Wire PointerInteraction into useSimulation

Modify `src/hooks/useSimulation.ts`:

- After creating the `Camera`, create a `PointerInteraction` instance.
- Replace the existing single-pointer drag state (`dragging`, `lastX`, `lastY`) with calls to `pointerInteraction.pointerDown/Move/Up`.
- Still handle mouse wheel zoom directly (it is not a pointer gesture).
- Keep `setPointerCapture(e.pointerId)` on `pointerdown` so move/up events continue to fire even if the pointer leaves the canvas.

Event listener refactor:

- `onPointerDown`: convert coordinate, call `pointerDown`, call `canvas.setPointerCapture(id)`.
- `onPointerMove`: convert coordinate, call `pointerMove`.
- `onPointerUp/Cancel`: call `pointerUp`.

No other cleanup is required; the `PointerInteraction` instance lives alongside the `Camera` inside the effect.

### 4. Camera behavior remains unchanged

`Camera.panBy` and `Camera.zoomAt` already provide the exact operations needed.

- `panBy(dx, dy)` shifts the view.
- `zoomAt(screenPoint, factor)` zooms while keeping the chosen screen point visually fixed.

The touch midpoint is a screen point, so `zoomAt` applies it directly.

## Testing

Create `src/hooks/pointerInteraction.test.ts`.

Use a real `Camera` instance to test visible outcomes:

- One-finger pan: assert `centerX/centerY` change by the drag delta.
- Two-finger pinch: assert `scale` changes by the expected factor and midpoint stays fixed (the midpoint world point should map back to roughly the same screen point).
- Two-finger drag: assert `centerX/centerY` change by the midpoint delta.
- Lift one finger during pinch: assert pan resumes cleanly with no residual pinch state.
- Lift everything: assert no further camera changes until a new down.

Keep tests deterministic by directly calling `pointerDown`/`pointerMove`/`pointerUp` without synthetic browser events.

Add a render-level test if needed to verify the CSS `touch-action: none` class is on the canvas, though that is a React component test rather than a canvas test.

## Edge Cases & Decisions

- **Right-click menu:** The existing code does not prevent the context menu. We will leave this unchanged; desktop users can still use the context menu. If desired later, a single `contextmenu` prevent can be added.
- **Mouse with multiple buttons:** Only the primary mouse button should initiate pan. The existing code does not check this, but we will add a guard (`e.button === 0 || e.button === -1` for touch/stylus; `-1` is used by some Pointer Events for non-primary controls). This is a minor behavior improvement and does not alter left-click behavior.
- **Mid-frame pointer count change:** The state machine only applies deltas when it has a valid previous state for the current pointer count. A sudden jump from 1 → 2 pointers initializes previous span/midpoint from the first two-down frame, so no spurious zoom occurs.
- **Performance:** The work per pointer move is O(1) and uses no allocations beyond updating map entries.
- **Accessibility / alternative input:** The design also benefits mouse users who accidentally lift and re-press, because state is tracked per pointer id.

## Out of Scope

- Double-tap to zoom or single-tap to recenter.
- Inertial scrolling after release.
- On-screen zoom buttons.
- Keyboard shortcuts.
- Concurrent dragging and wheel interaction (wheel still handles its own events).
