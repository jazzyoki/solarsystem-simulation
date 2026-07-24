# 3D Planet Jump List & Time-Scale Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3D-only planet jump list that flies to and follows a chosen planet, a time-scale label beside the speed selector, and make the speed + mode selectors permanent dropdowns.

**Architecture:** Three independent UI/navigation additions on top of existing patterns. A new `PlanetPicker` component mirrors `CometPicker`; the hook tracks a `focusedBody` via a ref (like `selectedComet`) and passes it to `ThreeRenderer.setFocus()` each 3D frame; the renderer frames the body once, then follows it by translating camera + target by the body's per-frame delta. A pure `timeScaleLabel` helper feeds a toolbar span. The already-present mobile `<select>`s become the only speed/mode controls.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + @testing-library/react, Three.js (behind `src/render3d/` only).

## Global Constraints

- `src/sim/` stays pure — no Canvas/React/Three/DOM/`Date.now()` there. (This plan does not touch `src/sim/`.)
- Three.js must not be imported outside `src/render3d/`.
- `1x = 1 simulated Earth day per real second` (`SimClock.advance`) — the basis for the time-scale labels.
- `SpeedMultiplier` values are exactly `0.5 | 1 | 10 | 100 | 1000` (`src/sim/clock.ts`).
- Commit after each task. Repo commit identity is `jazzyoki <jazzyoki@hotmail.de>` (already set repo-locally).
- Test runner: `npx vitest run <file>` for one file; `npm test` for all; `npm run build` type-checks (`tsc --noEmit && vite build`).

---

## File Structure

- **Create** `src/ui/timeScale.ts` — pure `timeScaleLabel(multiplier)` helper.
- **Create** `src/ui/timeScale.test.ts` — its unit test.
- **Create** `src/ui/PlanetPicker.tsx` — the 3D planet jump `<select>`.
- **Create** `src/ui/PlanetPicker.test.tsx` — its component test.
- **Modify** `src/ui/Toolbar.tsx` — drop button groups, always render dropdowns, add time-scale span.
- **Modify** `src/ui/Toolbar.test.tsx` — retarget button-group tests to dropdowns, assert the label.
- **Modify** `src/styles.css` — always-visible dropdowns, `.picker-column`, `.planet-select`, `.time-scale`.
- **Modify** `src/render3d/controls.ts` — optional `onDoubleClick` callback.
- **Modify** `src/render3d/ThreeRenderer.ts` — `setFocus()`, follow-camera, `onFocusCleared`.
- **Modify** `src/hooks/useSimulation.ts` — `focusedBody` state/ref, `selectBody`, per-frame `setFocus`, clear-on-mode-change, wire `onFocusCleared`.
- **Modify** `src/App.tsx` — render `PlanetPicker` (3D only) + `CometPicker` in a shared `.picker-column`.

---

### Task 1: Time-scale label helper

**Files:**
- Create: `src/ui/timeScale.ts`
- Test: `src/ui/timeScale.test.ts`

**Interfaces:**
- Consumes: `SpeedMultiplier` from `src/sim/clock.ts`.
- Produces: `timeScaleLabel(multiplier: SpeedMultiplier): string`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/timeScale.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { timeScaleLabel } from './timeScale';

describe('timeScaleLabel', () => {
  it('maps every speed multiplier to its real-time scale', () => {
    expect(timeScaleLabel(0.5)).toBe('1s = ½ day');
    expect(timeScaleLabel(1)).toBe('1s = 1 day');
    expect(timeScaleLabel(10)).toBe('1s = 10 days');
    expect(timeScaleLabel(100)).toBe('1s = 100 days');
    expect(timeScaleLabel(1000)).toBe('1s = 1000 days');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/timeScale.test.ts`
Expected: FAIL — cannot resolve `./timeScale` / `timeScaleLabel` is not a function.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/timeScale.ts`:

```ts
import type { SpeedMultiplier } from '../sim/clock';

/**
 * Human-readable time scale for a speed multiplier. The clock advances
 * 1 sim day per real second at 1x (SimClock.advance), so the multiplier IS
 * the number of sim days per real second.
 */
export function timeScaleLabel(multiplier: SpeedMultiplier): string {
  if (multiplier === 0.5) return '1s = ½ day';
  if (multiplier === 1) return '1s = 1 day';
  return `1s = ${multiplier} days`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/timeScale.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add src/ui/timeScale.ts src/ui/timeScale.test.ts
git commit -m "feat: add timeScaleLabel helper for speed multipliers"
```

---

### Task 2: PlanetPicker component

**Files:**
- Create: `src/ui/PlanetPicker.tsx`
- Test: `src/ui/PlanetPicker.test.tsx`

**Interfaces:**
- Produces: `PlanetPicker` React component with props
  `{ planets: string[]; selected: string | null; onSelect: (name: string | null) => void }`.
  Renders a `<select aria-label="Planet">` with a leading placeholder option
  (value `''`) then one option per name (option value = the name). `onSelect`
  is called with the chosen name, or `null` when the placeholder is chosen.

- [ ] **Step 1: Write the failing test**

Create `src/ui/PlanetPicker.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanetPicker } from './PlanetPicker';

const planets = ['Sun', 'Mercury', 'Earth', 'Jupiter', 'Pluto'];

describe('PlanetPicker', () => {
  it('renders a dropdown with a placeholder plus every planet', () => {
    render(<PlanetPicker planets={planets} selected={null} onSelect={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Planet' }) as HTMLSelectElement;
    expect(select.querySelectorAll('option')).toHaveLength(planets.length + 1);
    expect(screen.getByRole('option', { name: 'Sun' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Jupiter' })).toBeTruthy();
  });

  it('reflects the selected planet as the dropdown value', () => {
    render(<PlanetPicker planets={planets} selected={'Jupiter'} onSelect={vi.fn()} />);
    expect((screen.getByRole('combobox', { name: 'Planet' }) as HTMLSelectElement).value).toBe('Jupiter');
  });

  it('calls onSelect with the planet name when one is chosen', () => {
    const onSelect = vi.fn();
    render(<PlanetPicker planets={planets} selected={null} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Planet' }), { target: { value: 'Jupiter' } });
    expect(onSelect).toHaveBeenCalledWith('Jupiter');
  });

  it('calls onSelect(null) when the placeholder is chosen', () => {
    const onSelect = vi.fn();
    render(<PlanetPicker planets={planets} selected={'Jupiter'} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Planet' }), { target: { value: '' } });
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/PlanetPicker.test.tsx`
Expected: FAIL — cannot resolve `./PlanetPicker`.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/PlanetPicker.tsx`:

```tsx
interface PlanetPickerProps {
  planets: string[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}

export function PlanetPicker({ planets, selected, onSelect }: PlanetPickerProps) {
  return (
    <div className="planet-picker">
      <select
        className="planet-select"
        aria-label="Planet"
        value={selected ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">Jump to planet…</option>
        {planets.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/PlanetPicker.test.tsx`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/ui/PlanetPicker.tsx src/ui/PlanetPicker.test.tsx
git commit -m "feat: add PlanetPicker dropdown component"
```

---

### Task 3: Toolbar — always-dropdown speed/mode + time-scale label

**Files:**
- Modify: `src/ui/Toolbar.tsx`
- Modify: `src/ui/Toolbar.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `timeScaleLabel` from Task 1. `ToolbarProps` is unchanged.
- Produces: A toolbar rendering `[speed select][time-scale span][Pause] | [mode select] | [Comets]`, with NO speed/mode button groups.

- [ ] **Step 1: Update the tests first**

Replace the entire body of `src/ui/Toolbar.test.tsx` with the version below. It drops the speed/mode *button* assertions (those controls no longer exist), keeps the dropdown + Comets assertions, and adds a time-scale label assertion.

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toolbar, type ToolbarProps } from './Toolbar';

function renderToolbar(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    multiplier: 1,
    paused: false,
    mode: 'schematic',
    onSelectSpeed: vi.fn(),
    onTogglePause: vi.fn(),
    onSelectMode: vi.fn(),
    cometsEnabled: false,
    onToggleComets: vi.fn(),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe('Toolbar', () => {
  it('renders a speed dropdown reflecting the multiplier and fires onSelectSpeed on change', () => {
    const props = renderToolbar({ multiplier: 100 });
    const select = screen.getByRole('combobox', { name: 'Speed' }) as HTMLSelectElement;
    expect(select.value).toBe('100');
    expect(select.querySelectorAll('option')).toHaveLength(5);
    fireEvent.change(select, { target: { value: '0.5' } });
    expect(props.onSelectSpeed).toHaveBeenCalledWith(0.5);
  });

  it('renders a mode dropdown reflecting the mode and fires onSelectMode on change', () => {
    const props = renderToolbar({ mode: 'toScale' });
    const select = screen.getByRole('combobox', { name: 'Scale mode' }) as HTMLSelectElement;
    expect(select.value).toBe('toScale');
    expect(select.querySelectorAll('option')).toHaveLength(3);
    fireEvent.change(select, { target: { value: 'schematic' } });
    expect(props.onSelectMode).toHaveBeenCalledWith('schematic');
  });

  it('shows the time-scale label for the current multiplier', () => {
    renderToolbar({ multiplier: 10 });
    expect(screen.getByText('1s = 10 days')).toBeTruthy();
  });

  it('shows Resume while paused and toggles on click', () => {
    const props = renderToolbar({ paused: true });
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(props.onTogglePause).toHaveBeenCalledTimes(1);
  });

  it('renders the Comets toggle and reflects its state', () => {
    renderToolbar({ cometsEnabled: true });
    expect(screen.getByRole('button', { name: 'Comets' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onToggleComets when the Comets button is clicked', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Comets' }));
    expect(props.onToggleComets).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/Toolbar.test.tsx`
Expected: FAIL — the "time-scale label" test fails (`getByText('1s = 10 days')` finds nothing) because the label is not rendered yet.

- [ ] **Step 3: Rewrite `Toolbar.tsx`**

Replace the whole file `src/ui/Toolbar.tsx` with:

```tsx
import type { SpeedMultiplier } from '../sim/clock';
import type { ViewMode } from '../sim/types';
import { timeScaleLabel } from './timeScale';

export interface ToolbarProps {
  multiplier: SpeedMultiplier;
  paused: boolean;
  mode: ViewMode;
  onSelectSpeed: (m: SpeedMultiplier) => void;
  onTogglePause: () => void;
  onSelectMode: (mode: ViewMode) => void;
  cometsEnabled: boolean;
  onToggleComets: () => void;
}

const SPEEDS: SpeedMultiplier[] = [0.5, 1, 10, 100, 1000];
const MODES: { value: ViewMode; label: string }[] = [
  { value: 'schematic', label: 'Schematic' },
  { value: 'toScale', label: 'To Scale' },
  { value: 'threeD', label: '3D' },
];

export function Toolbar({
  multiplier,
  paused,
  mode,
  onSelectSpeed,
  onTogglePause,
  onSelectMode,
  cometsEnabled,
  onToggleComets,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <select
        className="speed-select"
        aria-label="Speed"
        value={multiplier}
        onChange={(e) => onSelectSpeed(Number(e.target.value) as SpeedMultiplier)}
      >
        {SPEEDS.map((speed) => (
          <option key={speed} value={speed}>
            {speed}x
          </option>
        ))}
      </select>
      <span className="time-scale">{timeScaleLabel(multiplier)}</span>
      <button type="button" aria-pressed={paused} onClick={onTogglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <span className="toolbar-separator" aria-hidden="true" />
      <select
        className="mode-select"
        aria-label="Scale mode"
        value={mode}
        onChange={(e) => onSelectMode(e.target.value as ViewMode)}
      >
        {MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <span className="toolbar-separator" aria-hidden="true" />
      <button
        type="button"
        className={cometsEnabled ? 'active' : ''}
        aria-pressed={cometsEnabled}
        onClick={onToggleComets}
      >
        Comets
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Update the CSS**

In `src/styles.css`:

(a) Delete the `.speed-buttons, .mode-buttons { display: contents; }` rule (lines around 69–74, including its leading comment).

(b) Change the `.speed-select, .mode-select` rule so it is visible by default — replace `display: none;` with `display: inline-block;`. The rest of that rule (background/color/border/etc.) stays.

(c) Delete the `.speed-buttons, .mode-buttons,` lines from the `@media (max-width: 640px)` block AND the `.speed-select, .mode-select { display: inline-block; }` rule inside that media query (both are now redundant). Keep `.toolbar-separator { display: none; }` inside the media query, and keep the mobile date-controls rules.

(d) Add a `.time-scale` rule near the toolbar styles:

```css
.time-scale {
  color: #9fb0e0;
  font: 12px system-ui, sans-serif;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run tests + build to verify they pass**

Run: `npx vitest run src/ui/Toolbar.test.tsx`
Expected: PASS (6 passed).

Run: `npm run build`
Expected: type-check + build succeed with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Toolbar.tsx src/ui/Toolbar.test.tsx src/styles.css
git commit -m "feat: make speed/mode selectors always dropdowns with time-scale label"
```

---

### Task 4: ThreeRenderer focus + follow-camera

**Files:**
- Modify: `src/render3d/controls.ts`
- Modify: `src/render3d/ThreeRenderer.ts`

**Interfaces:**
- Consumes: `Snapshot3D` (already imported in `ThreeRenderer.ts`); each `BodySnapshot3D` has `name: string`, `x/y/z: number`, `bodyRadius: number`.
- Produces:
  - `createControls(camera, canvas, onDoubleClick?: () => void): ControlsHandle` — the callback fires on `dblclick` after the target is recentered.
  - `new ThreeRenderer(canvas, orbitPaths, belt, extent, onFocusCleared?: () => void)`.
  - `ThreeRenderer.setFocus(name: string | null): void` — request focus; applied on the next `sync()`. `null` releases to the overview.

- [ ] **Step 1: Add the `onDoubleClick` hook to `controls.ts`**

In `src/render3d/controls.ts`, change the signature and the `dblclick` handler:

```ts
export function createControls(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLElement,
  onDoubleClick?: () => void,
): ControlsHandle {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 40;
  controls.maxDistance = 60000;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  const onDblClick = () => {
    controls.target.set(0, 0, 0);
    onDoubleClick?.();
  };
  canvas.addEventListener('dblclick', onDblClick);
  return {
    controls,
    dispose() {
      canvas.removeEventListener('dblclick', onDblClick);
      controls.dispose();
    },
  };
}
```

- [ ] **Step 2: Add focus state + constructor callback to `ThreeRenderer`**

In `src/render3d/ThreeRenderer.ts`, add fields near the other private fields (after `private tailLine: THREE.Line;`):

```ts
  private overviewExtent: number;
  private onFocusCleared?: () => void;
  private requestedFocus: string | null = null;
  private appliedFocus: string | null = null;
  private lastFocusPos: THREE.Vector3 | null = null;
```

Change the constructor signature and body. Update the first line and the `createControls` call, and store the new values (the rest of the constructor body is unchanged):

```ts
  constructor(
    canvas: HTMLCanvasElement,
    orbitPaths: Vec3[][],
    belt: BeltAsteroid3D[],
    extent: number,
    onFocusCleared?: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.scene.background = new THREE.Color(BACKGROUND);
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, CAMERA_NEAR, CAMERA_FAR);
    this.camera.up.set(0, 0, 1);
    this.overviewExtent = extent;
    this.onFocusCleared = onFocusCleared;
    this.controlsHandle = createControls(this.camera, canvas, () => {
      // A double-click recenters the Sun; if we were following a body, drop the
      // follow and let the UI reset its dropdown to the placeholder.
      if (this.appliedFocus !== null || this.requestedFocus !== null) {
        this.requestedFocus = null;
        this.onFocusCleared?.();
      }
    });
    // ...rest of constructor unchanged (lights, orbit lines, belt, tail, resetView)...
```

- [ ] **Step 3: Add `setFocus` and the follow logic**

In `src/render3d/ThreeRenderer.ts`, add a `setFocus` method (put it right after `resetView`):

```ts
  /** Request the camera to frame + follow a body by name; null releases. */
  setFocus(name: string | null): void {
    this.requestedFocus = name;
  }

  /** Frames a body once (new focus) or follows it (continuing focus). */
  private updateFocus(snap: Snapshot3D): void {
    if (this.requestedFocus === this.appliedFocus) {
      if (this.appliedFocus !== null && this.lastFocusPos !== null) {
        const body = snap.bodies.find((b) => b.name === this.appliedFocus);
        if (body) {
          const pos = new THREE.Vector3(body.x, body.y, body.z);
          const delta = pos.clone().sub(this.lastFocusPos);
          this.controls.target.add(delta);
          this.camera.position.add(delta);
          this.lastFocusPos.copy(pos);
        }
      }
      return;
    }
    // Transition to a new focus target.
    if (this.requestedFocus === null) {
      this.resetView(this.overviewExtent);
      this.lastFocusPos = null;
    } else {
      const body = snap.bodies.find((b) => b.name === this.requestedFocus);
      if (!body) return; // body absent this frame; retry next frame
      const pos = new THREE.Vector3(body.x, body.y, body.z);
      const dist = Math.max(this.controls.minDistance * 1.5, body.bodyRadius * 8);
      this.controls.target.copy(pos);
      // ~30° above the ecliptic, matching resetView's framing convention.
      this.camera.position.set(pos.x, pos.y - dist * 0.86, pos.z + dist * 0.5);
      this.camera.lookAt(pos);
      this.lastFocusPos = pos.clone();
    }
    this.appliedFocus = this.requestedFocus;
  }
```

- [ ] **Step 4: Call `updateFocus` at the end of `sync`**

In `src/render3d/ThreeRenderer.ts`, at the very end of the `sync(...)` method (after `updateBeltPositions(this.beltPoints, this.belt, snap.simDays);`), add:

```ts
    this.updateFocus(snap);
```

- [ ] **Step 5: Verify it type-checks and existing tests still pass**

Run: `npm run build`
Expected: type-check + build succeed with no errors.

Run: `npm test`
Expected: all existing tests pass (no test targets the renderer directly).

- [ ] **Step 6: Commit**

```bash
git add src/render3d/controls.ts src/render3d/ThreeRenderer.ts
git commit -m "feat: add frame-and-follow focus to the 3D renderer"
```

---

### Task 5: Hook wiring — focusedBody state + per-frame focus

**Files:**
- Modify: `src/hooks/useSimulation.ts`

**Interfaces:**
- Consumes: `ThreeRenderer.setFocus`, the `onFocusCleared` constructor arg (Task 4).
- Produces: `useSimulation` returns additionally `focusedBody: string | null` and `selectBody: (name: string | null) => void`. `selectBody('Sun')` is treated as release (stored as `null`).

- [ ] **Step 1: Add focus state and ref**

In `src/hooks/useSimulation.ts`, after the `selectedComet` state/ref declarations (around lines 25 and 29), add:

```ts
  const [focusedBody, setFocusedBody] = useState<string | null>(null);
  const focusedBodyRef = useRef<string | null>(null);
```

- [ ] **Step 2: Clear focus when leaving 3D**

In the RAF loop's mode-switch block, inside the `if (currentMode !== 'threeD') { ... }` branch (the one that rebuilds asteroids and calls `camera.fitToView`, around lines 134–141), add focus clearing at the top of that branch:

```ts
        if (currentMode !== 'threeD') {
          focusedBodyRef.current = null;
          setFocusedBody(null);
          asteroids = buildAsteroidBelt(
            sim.layout,
            ASTEROID_BELT.seed,
            ASTEROID_BELT.count,
            currentMode,
          );
          camera.fitToView(sim.extent(currentMode), width, height);
        } else {
```

- [ ] **Step 3: Pass `onFocusCleared` into the ThreeRenderer constructor**

In the `void import('../render3d').then(...)` block, find the `threeRenderer = new m.ThreeRenderer(canvas3d, ...)` call. It currently passes `(canvas3d, orbitPaths, belt, extent)`. Add a fifth argument — the focus-cleared callback:

```ts
              threeRenderer = new m.ThreeRenderer(
                canvas3d,
                sim.orbitPaths3D(),
                belt,
                sim.extent('toScale'),
                () => {
                  focusedBodyRef.current = null;
                  setFocusedBody(null);
                },
              );
```

(Keep the existing argument expressions for orbit paths / belt / extent exactly as they already are in the file; only the trailing callback argument is new.)

- [ ] **Step 4: Push the current focus into the renderer each 3D frame**

In the `if (threeRenderer) { ... }` block, immediately before the `threeRenderer.sync(snap3, path3, cometName);` call, add:

```ts
          threeRenderer.setFocus(focusedBodyRef.current);
```

- [ ] **Step 5: Add the `selectBody` action and export it**

Near the other actions (after `selectComet`, around line 303), add:

```ts
  const selectBody = (name: string | null) => {
    const focus = name === 'Sun' ? null : name;
    focusedBodyRef.current = focus;
    setFocusedBody(focus);
  };
```

Then extend the returned object (around line 312) to include the new values:

```ts
  return {
    multiplier, paused, mode, date, setMultiplier, togglePause, setMode,
    seekToDate, goToToday,
    cometsEnabled, selectedComet, setCometsEnabled, selectComet, jumpToPerihelion,
    focusedBody, selectBody,
  };
```

- [ ] **Step 6: Verify it type-checks and tests pass**

Run: `npm run build`
Expected: type-check + build succeed with no errors.

Run: `npm test`
Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useSimulation.ts
git commit -m "feat: track focused body in useSimulation and drive 3D focus"
```

---

### Task 6: App integration — shared picker column

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `PlanetPicker` (Task 2), `focusedBody` / `selectBody` (Task 5), `PLANETS` from `src/sim/data.ts` (each element has `name: string`; the array already includes Pluto).
- Produces: The final wired UI. `PlanetPicker` appears only in 3D; both pickers stack in one `.picker-column`.

- [ ] **Step 1: Wire `App.tsx`**

Replace `src/App.tsx` with:

```tsx
import { useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { COMETS, PLANETS } from './sim/data';
import { dateInputToSimDays } from './sim/formatDate';
import { CometPicker } from './ui/CometPicker';
import { DateDisplay } from './ui/DateDisplay';
import { PlanetPicker } from './ui/PlanetPicker';
import { Toolbar } from './ui/Toolbar';

const FOCUSABLE_BODIES = ['Sun', ...PLANETS.map((p) => p.name)];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
  const {
    multiplier,
    paused,
    mode,
    date,
    setMultiplier,
    togglePause,
    setMode,
    seekToDate,
    goToToday,
    cometsEnabled,
    selectedComet,
    setCometsEnabled,
    selectComet,
    jumpToPerihelion,
    focusedBody,
    selectBody,
  } = useSimulation(canvasRef, canvas3dRef);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" hidden={mode === 'threeD'} />
      <canvas ref={canvas3dRef} className="scene" hidden={mode !== 'threeD'} />
      <Toolbar
        multiplier={multiplier}
        paused={paused}
        mode={mode}
        onSelectSpeed={setMultiplier}
        onTogglePause={togglePause}
        onSelectMode={setMode}
        cometsEnabled={cometsEnabled}
        onToggleComets={() => setCometsEnabled(!cometsEnabled)}
      />
      <div className="picker-column">
        {mode === 'threeD' && (
          <PlanetPicker planets={FOCUSABLE_BODIES} selected={focusedBody} onSelect={selectBody} />
        )}
        {cometsEnabled && (
          <CometPicker
            comets={COMETS.map((c) => ({ name: c.name, designation: c.designation, note: c.note }))}
            selected={selectedComet}
            onSelect={selectComet}
            onJumpToPerihelion={jumpToPerihelion}
          />
        )}
      </div>
      <DateDisplay
        date={date}
        onSelectDate={(value) => seekToDate(dateInputToSimDays(value))}
        onToday={goToToday}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update the CSS for the shared column + planet select**

In `src/styles.css`:

(a) Change the `.comet-picker` rule: remove `position: absolute; top: 52px; left: 12px;` (the column now positions it). Keep the flex/gap/align/flex-wrap properties. The rule becomes:

```css
.comet-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
```

(b) Add the column container and planet-picker rules (near the comet-picker styles):

```css
.picker-column {
  position: absolute;
  top: 52px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.planet-picker {
  display: flex;
  gap: 6px;
  align-items: center;
}

.planet-select {
  background: #1b2340;
  color: #cfd8ff;
  border: 1px solid #34406e;
  border-radius: 4px;
  padding: 6px 10px;
  font: 13px system-ui, sans-serif;
  cursor: pointer;
  color-scheme: dark;
}
```

- [ ] **Step 3: Verify build + full test suite**

Run: `npm run build`
Expected: type-check + build succeed with no errors.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Manual verification (run the app)**

Run: `npm run dev`, open the URL, and confirm:
1. Desktop toolbar shows `[speed ▾] 1s = 1 day [Pause] | [mode ▾] | [Comets]` — no button rows.
2. Changing the speed dropdown updates the `1s = … day(s)` label.
3. Switch to **3D**: a "Jump to planet…" dropdown appears at top-left. Pick **Jupiter** → camera flies to and centers Jupiter; let the clock run at 100x → Jupiter stays centered.
4. Pick **Sun** (or double-click the scene) → returns to the Sun-centered overview and the dropdown resets.
5. Enable **Comets** while in 3D → planet picker and comet picker stack without overlapping.
6. Switch away from 3D → planet picker disappears and focus resets.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/styles.css
git commit -m "feat: show 3D planet jump list alongside comet picker"
```

---

## Self-Review Notes

- **Spec coverage:** Feature 1 → Tasks 2 (picker), 4 (follow-camera + double-click release), 5 (state/wiring), 6 (3D-only rendering + Sun release). Feature 2 → Tasks 1 + 3. Feature 3 → Task 3. Shared picker column → Task 6. Double-click release, mode-change clear, and Sun-as-release are all covered.
- **Type consistency:** `setFocus(name: string | null)`, `selectBody(name: string | null)`, `PlanetPicker.onSelect(name: string | null)`, and `onFocusCleared: () => void` are used identically across Tasks 2, 4, 5, 6. `FOCUSABLE_BODIES = ['Sun', ...PLANETS]` matches the "Sun + 8 planets + Pluto = 10 entries" from the spec (PLANETS already contains Pluto).
- **No unit test for follow-camera:** intentional and stated in the spec — WebGL math is verified by the manual run in Task 6, consistent with the rest of `src/render3d/`.
