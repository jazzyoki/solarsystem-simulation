# Additional Time Scales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `0.5x` and `10x` speed options alongside the existing `1x / 100x / 1000x` time scales in the solar system simulation.

**Architecture:** Extend the compile-time `SpeedMultiplier` union from `1 | 100 | 1000` to `0.5 | 1 | 10 | 100 | 1000`; update the `Toolbar` speed array and the two corresponding test files. No other modules change because they already pass `SpeedMultiplier` through unchanged.

**Tech Stack:** Vite 5, React 18, TypeScript 5 (strict), Vitest 2, React Testing Library.

## Global Constraints

- 1x remains `1 simulated Earth day per real second`.
- New speeds must use the exact values `0.5` and `10`.
- Speed buttons must appear in order: `0.5x`, `1x`, `10x`, `100x`, `1000x`.
- `SpeedMultiplier` type must remain a branded union (do not loosen to `number`).
- Runtime dependencies remain `react` + `react-dom` only.
- TypeScript `strict: true`.
- Tests colocated with source.
- Commit after every task.

---

### Task 1: Extend SimClock type and clock tests

**Files:**
- Modify: `src/sim/clock.ts:1`
- Modify: `src/sim/clock.test.ts:18-26`
- Test: `src/sim/clock.test.ts`

**Interfaces:**
- Consumes: existing `SimClock` behavior (clamped advance, pause, multiplier).
- Produces: `export type SpeedMultiplier = 0.5 | 1 | 10 | 100 | 1000`.

- [ ] **Step 1: Write the failing test update**

Update the multiplier-proportion test in `src/sim/clock.test.ts` to cover `0.5x` and `10x`:

```ts
import { describe, expect, it } from 'vitest';
import { SimClock } from './clock';

describe('SimClock', () => {
  it('starts at day 0, 1x, unpaused', () => {
    const c = new SimClock();
    expect(c.simDays).toBe(0);
    expect(c.multiplier).toBe(1);
    expect(c.paused).toBe(false);
  });

  it('advances 1 day per real second at 1x for frame dt below the cap', () => {
    const c = new SimClock();
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.1, 10);
  });

  it('advances proportionally to the multiplier for frame dt below the cap', () => {
    const c = new SimClock();
    c.setMultiplier(0.5);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.05, 10);
    c.setMultiplier(10);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(1.05, 10);
    c.setMultiplier(100);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(11.05, 10);
    c.setMultiplier(1000);
    c.advance(0.016);
    expect(c.simDays).toBeCloseTo(27.05, 10);
  });

  it('does not advance while paused', () => {
    const c = new SimClock();
    c.setPaused(true);
    c.advance(1);
    expect(c.simDays).toBe(0);
    c.setPaused(false);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.1, 10);
  });

  it('clamps huge frame deltas to 0.25 s', () => {
    const c = new SimClock();
    c.advance(10);
    expect(c.simDays).toBeCloseTo(0.25, 10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/sim/clock.test.ts`
Expected: FAIL with a TypeScript/type error such as `Type '0.5' is not assignable to type 'SpeedMultiplier'`.

- [ ] **Step 3: Update the implementation**

In `src/sim/clock.ts`, change line 1 from:

```ts
export type SpeedMultiplier = 1 | 100 | 1000;
```

to:

```ts
export type SpeedMultiplier = 0.5 | 1 | 10 | 100 | 1000;
```

No other code in `clock.ts` changes.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/sim/clock.test.ts && npx tsc --noEmit`
Expected:
```
Test Files  1 passed (1)
Tests  5 passed (5)
```
and `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/clock.ts src/sim/clock.test.ts
git commit -m "feat: add 0.5x and 10x speed multipliers to clock type"
```

---

### Task 2: Update Toolbar with five speeds and tests

**Files:**
- Modify: `src/ui/Toolbar.tsx:10`
- Modify: `src/ui/Toolbar.test.tsx:18-29, 33-34`
- Test: `src/ui/Toolbar.test.tsx`

**Interfaces:**
- Consumes: `SpeedMultiplier` (now `0.5 | 1 | 10 | 100 | 1000` from Task 1).
- Produces: `Toolbar` renders buttons `0.5x`, `1x`, `10x`, `100x`, `1000x` and calls `onSelectSpeed` with the correct numeric literal.

- [ ] **Step 1: Write the failing test update**

Replace the contents of `src/ui/Toolbar.test.tsx` with the updated version that expects all five speed buttons:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toolbar, type ToolbarProps } from './Toolbar';

function renderToolbar(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    multiplier: 1,
    paused: false,
    onSelectSpeed: vi.fn(),
    onTogglePause: vi.fn(),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

describe('Toolbar', () => {
  it('renders all five speed buttons and pause', () => {
    renderToolbar();
    for (const label of ['0.5x', '1x', '10x', '100x', '1000x', 'Pause']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('marks the active speed', () => {
    renderToolbar({ multiplier: 10 });
    expect(screen.getByRole('button', { name: '10x' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '1x' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onSelectSpeed when a speed button is clicked', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: '0.5x' }));
    expect(props.onSelectSpeed).toHaveBeenCalledWith(0.5);
    fireEvent.click(screen.getByRole('button', { name: '10x' }));
    expect(props.onSelectSpeed).toHaveBeenCalledWith(10);
  });

  it('shows Resume while paused and toggles on click', () => {
    const props = renderToolbar({ paused: true });
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(props.onTogglePause).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/Toolbar.test.tsx`
Expected: FAIL — the updated test cannot find buttons `0.5x` and `10x` because the current `SPEEDS` array only contains `[1, 100, 1000]`.

- [ ] **Step 3: Update the implementation**

In `src/ui/Toolbar.tsx`, change line 10 from:

```ts
const SPEEDS: SpeedMultiplier[] = [1, 100, 1000];
```

to:

```ts
const SPEEDS: SpeedMultiplier[] = [0.5, 1, 10, 100, 1000];
```

No other code in `Toolbar.tsx` changes; `{speed}x` already renders `0.5x` correctly.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/Toolbar.test.tsx && npx tsc --noEmit`
Expected:
```
Test Files  1 passed (1)
Tests  4 passed (4)
```
and `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Toolbar.tsx src/ui/Toolbar.test.tsx
git commit -m "feat: render 0.5x and 10x speed buttons in toolbar"
```

---

### Task 3: Final verification

**Files:**
- Run: all existing tests, typecheck, production build.

**Interfaces:**
- Consumes: updated `SpeedMultiplier` everywhere; `App`/`useSimulation` unchanged but must typecheck.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected:
```
Test Files  10 passed (10)
Tests  48 passed (48)
```

- [ ] **Step 2: Typecheck and production build**

Run: `npm run build`
Expected: `tsc --noEmit` clean, Vite prints build success.

- [ ] **Step 3: Visual smoke check (optional)**

With the dev server already running at `http://localhost:5173/` (started earlier), refresh the page and confirm the toolbar shows `0.5x 1x 10x 100x 1000x Pause` in that order, and that clicking `0.5x` slows the date readout to roughly 0.5 days per real second.

- [ ] **Step 4: Commit anything remaining**

If any additional fixes were needed during verification, commit them. If not, no commit required for this task.

---

## Definition of done

- Toolbar displays five speed buttons in order: `0.5x`, `1x`, `10x`, `100x`, `1000x`, plus Pause.
- Each button sets the correct multiplier.
- `npm test` passes with 10 test files / 48 tests.
- `npm run build` remains clean.
