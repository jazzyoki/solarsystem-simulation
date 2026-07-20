# Touch Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add touch pan and pinch-zoom support to the solar system simulation by extending the existing pointer-event pipeline.

**Architecture:** A new testable class, `PointerInteraction`, tracks active pointer positions and computes one-finger pan, two-finger pinch zoom, and two-finger pan. `useSimulation.ts` delegates pointer events to this class. `Camera` requires no changes because its existing `panBy` and `zoomAt` methods already provide the needed primitives. CSS `touch-action: none` prevents the browser from scrolling or zooming the page on the canvas.

**Tech Stack:** TypeScript, React, Vite, Canvas 2D, Vitest.

## Global Constraints

- React ^18.3.1, TypeScript ^5.6.3, Vite ^5.4.11, Vitest ^2.1.8.
- No new runtime dependencies.
- `src/sim/` stays pure; input handling is UI wiring and remains in `src/hooks/`.
- Keep mouse behavior unchanged: wheel zoom at cursor, left-button drag pan.
- Follow existing test patterns: numeric assertions with `toBeCloseTo`, Canvas mocks where needed.
- Browser support: modern touch-capable browsers that implement Pointer Events Level 2.

## File Structure

- **Create** `src/hooks/pointerInteraction.ts` — pure state machine for pointer gestures.
- **Create** `src/hooks/pointerInteraction.test.ts` — unit tests for pan, pinch, and two-finger pan.
- **Modify** `src/hooks/useSimulation.ts` — replace single-pointer drag state with `PointerInteraction`.
- **Modify** `src/styles.css` — add `touch-action: none` to `.scene`.

## Task 1: Add `touch-action: none` to the canvas CSS

**Files:**
- Modify: `src/styles.css:16-23`
- Test: manual verification in browser DevTools mobile emulator

**Interfaces:**
- No shared interfaces.

- [ ] **Step 1: Edit `.scene` rule**

```css
.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
}
```

- [ ] **Step 2: Run the dev server and open mobile emulator**

```bash
npm run dev
```

In the browser, switch to a mobile device emulator. Try dragging on the canvas with the mouse while in touch emulation. The page should not scroll.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: prevent browser touch gestures on simulation canvas"
```

## Task 2: Write failing unit tests for `PointerInteraction`

**Files:**
- Create: `src/hooks/pointerInteraction.test.ts`
- Depends on: `src/render/camera.ts` (exists)

**Interfaces:**
- Declares expectations for a new module that does not yet exist:

```ts
export interface PointerPoint {
  x: number;
  y: number;
}

export class PointerInteraction {
  constructor(camera: Camera);
  pointerDown(id: number, point: PointerPoint): void;
  pointerMove(id: number, point: PointerPoint): void;
  pointerUp(id: number): void;
  activeCount(): number;
}
```

- [ ] **Step 1: Create the test file**

Create `src/hooks/pointerInteraction.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Camera } from '../render/camera';
import { PointerInteraction } from './pointerInteraction';

function freshCamera(): Camera {
  const camera = new Camera();
  camera.centerX = 400;
  camera.centerY = 300;
  camera.scale = 2;
  return camera;
}

describe('PointerInteraction', () => {
  it('pans with one finger', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 100, y: 100 });
    pi.pointerMove(1, { x: 130, y: 120 });

    expect(camera.centerX).toBeCloseTo(430);
    expect(camera.centerY).toBeCloseTo(320);
  });

  it('does nothing before pointerDown', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerMove(1, { x: 50, y: 50 });

    expect(camera.centerX).toBeCloseTo(400);
    expect(camera.centerY).toBeCloseTo(300);
  });

  it('pinch-zooms about the midpoint', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 300, y: 300 });
    pi.pointerDown(2, { x: 500, y: 300 });
    pi.pointerMove(2, { x: 600, y: 300 });

    expect(camera.scale).toBeCloseTo(3);
    expect(camera.centerX).toBeCloseTo(400);
    expect(camera.centerY).toBeCloseTo(300);
  });

  it('pans while pinching', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 300, y: 300 });
    pi.pointerDown(2, { x: 500, y: 300 });
    pi.pointerMove(1, { x: 310, y: 300 });
    pi.pointerMove(2, { x: 510, y: 300 });

    expect(camera.centerX).toBeCloseTo(410);
    expect(camera.centerY).toBeCloseTo(300);
    expect(camera.scale).toBeCloseTo(2);
  });

  it('resumes single-finger pan after lifting one finger', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 100, y: 100 });
    pi.pointerDown(2, { x: 200, y: 100 });
    pi.pointerUp(2);
    pi.pointerMove(1, { x: 120, y: 130 });

    expect(camera.centerX).toBeCloseTo(420);
    expect(camera.centerY).toBeCloseTo(330);
  });

  it('ignores a third pointer', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 300, y: 300 });
    pi.pointerDown(2, { x: 500, y: 300 });
    pi.pointerDown(3, { x: 400, y: 100 });
    pi.pointerMove(3, { x: 400, y: 400 });

    expect(camera.scale).toBeCloseTo(2);
    expect(camera.centerX).toBeCloseTo(400);
    expect(camera.centerY).toBeCloseTo(300);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- src/hooks/pointerInteraction.test.ts
```

Expected: FAIL with a module-not-found error for `./pointerInteraction`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/hooks/pointerInteraction.test.ts
git commit -m "test: add failing tests for touch pointer gestures"
```

## Task 3: Implement `PointerInteraction`

**Files:**
- Create: `src/hooks/pointerInteraction.ts`
- Modify: none
- Test: `src/hooks/pointerInteraction.test.ts` (now passes)

**Interfaces:**
- Consumes: `Camera` from `src/render/camera.ts`.
- Produces: the public interface declared in Task 2.

- [ ] **Step 1: Write the module**

Create `src/hooks/pointerInteraction.ts`:

```ts
import { Camera } from '../render/camera';

export interface PointerPoint {
  x: number;
  y: number;
}

interface PinchState {
  span: number;
  midpoint: PointerPoint;
}

function distance(a: PointerPoint, b: PointerPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function midpoint(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export class PointerInteraction {
  private camera: Camera;
  private pointers = new Map<number, PointerPoint>();
  private previousPanPoint: PointerPoint | null = null;
  private previousPinch: PinchState | null = null;

  constructor(camera: Camera) {
    this.camera = camera;
  }

  activeCount(): number {
    return this.pointers.size;
  }

  pointerDown(id: number, point: PointerPoint): void {
    this.pointers.set(id, point);
    const count = this.pointers.size;

    if (count === 1) {
      this.previousPanPoint = { ...point };
      this.previousPinch = null;
    } else if (count === 2) {
      const points = Array.from(this.pointers.values());
      this.previousPinch = {
        span: distance(points[0], points[1]),
        midpoint: midpoint(points[0], points[1]),
      };
      this.previousPanPoint = null;
    }
  }

  pointerMove(id: number, point: PointerPoint): void {
    if (!this.pointers.has(id)) return;

    this.pointers.set(id, point);
    const count = this.pointers.size;

    if (count === 1 && this.previousPanPoint) {
      this.camera.panBy(point.x - this.previousPanPoint.x, point.y - this.previousPanPoint.y);
      this.previousPanPoint = { ...point };
    } else if (count === 2 && this.previousPinch) {
      const points = Array.from(this.pointers.values());
      const currentSpan = distance(points[0], points[1]);
      const currentMid = midpoint(points[0], points[1]);

      if (currentSpan > 0) {
        this.camera.zoomAt(currentMid, currentSpan / this.previousPinch.span);
      }
      this.camera.panBy(
        currentMid.x - this.previousPinch.midpoint.x,
        currentMid.y - this.previousPinch.midpoint.y,
      );

      this.previousPinch = { span: currentSpan, midpoint: currentMid };
    }
  }

  pointerUp(id: number): void {
    this.pointers.delete(id);
    const count = this.pointers.size;

    if (count === 0) {
      this.previousPanPoint = null;
      this.previousPinch = null;
    } else if (count === 1) {
      const remaining = Array.from(this.pointers.values())[0];
      this.previousPanPoint = { ...remaining };
      this.previousPinch = null;
    } else if (count === 2) {
      const points = Array.from(this.pointers.values());
      this.previousPinch = {
        span: distance(points[0], points[1]),
        midpoint: midpoint(points[0], points[1]),
      };
      this.previousPanPoint = null;
    }
  }
}
```

- [ ] **Step 2: Run the tests to confirm they pass**

```bash
npm test -- src/hooks/pointerInteraction.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/pointerInteraction.ts
git commit -m "feat: add pointer gesture state machine for touch pan and pinch"
```

## Task 4: Wire `PointerInteraction` into `useSimulation.ts`

**Files:**
- Modify: `src/hooks/useSimulation.ts:51-81`
- Test: full suite `npm test`

**Interfaces:**
- Consumes: `PointerInteraction` from `src/hooks/pointerInteraction.ts`.
- Produces: updated pointer event handlers in `useSimulation.ts`.

- [ ] **Step 1: Replace the pointer drag logic**

In `src/hooks/useSimulation.ts`:

1. Import the new class near the top:

```ts
import { PointerInteraction } from './pointerInteraction';
```

2. After creating the `Camera`, create a `PointerInteraction`:

```ts
const camera = new Camera();
const pointerInteraction = new PointerInteraction(camera);
```

3. Remove the old single-pointer state (`dragging`, `lastX`, `lastY`) and replace the pointer handlers:

```ts
const toCanvasPoint = (e: PointerEvent) => {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
};

const onPointerDown = (e: PointerEvent) => {
  if (e.button !== 0) return;
  pointerInteraction.pointerDown(e.pointerId, toCanvasPoint(e));
  canvas.setPointerCapture(e.pointerId);
};

const onPointerMove = (e: PointerEvent) => {
  if (pointerInteraction.activeCount() === 0) return;
  pointerInteraction.pointerMove(e.pointerId, toCanvasPoint(e));
};

const onPointerUp = (e: PointerEvent) => {
  pointerInteraction.pointerUp(e.pointerId);
};

const onPointerCancel = (e: PointerEvent) => {
  pointerInteraction.pointerUp(e.pointerId);
};
```

4. Update the cleanup listener list. It should still remove `pointerdown`, `pointermove`, `pointerup`, and `pointercancel`. Keep the `wheel` listener unchanged.

Before:

```ts
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
const endDrag = () => {
  dragging = false;
};
```

After the edits, only the new handlers should remain for pointer events.

- [ ] **Step 2: Type-check and run the full test suite**

```bash
npm run build
```

Expected: build succeeds.

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Manual verification on device or emulator**

Run `npm run dev`, open the page on a touch device or in DevTools mobile emulator, and verify:

1. One-finger drag pans the solar system.
2. Two-finger pinch zooms in and out centered between the fingers.
3. Moving both fingers together pans while maintaining whatever zoom level exists.
4. Mouse wheel and mouse drag on desktop still work.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSimulation.ts
git commit -m "feat: wire pointer gestures into useSimulation for touch support"
```

## Self-Review

- **Spec coverage check:**
  - One-finger pan → Task 3 implementation + Task 2 test.
  - Two-finger pinch zoom → Task 3 implementation + Task 2 test.
  - Two-finger pan → Task 3 implementation + Task 2 test.
  - `touch-action: none` → Task 1.
  - `Camera` unchanged → no task; confirmed no edits needed.
  - Mouse behavior preserved → Task 4 keeps wheel logic and pointer logic for left button.

- **Placeholder scan:** No TBD, TODO, or vague instructions. Each step includes exact code or command.

- **Type consistency check:**
  - `PointerPoint` is `{ x: number; y: number }` in both spec and plan.
  - `PointerInteraction` methods have the same signatures in Task 2 and Task 3.
  - `useSimulation.ts` calls `pointerInteraction.pointerDown/Move/Up` consistent with the class.

No plan changes needed.
