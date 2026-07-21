# Clickable Date Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the top-right simulation date a clickable control that opens a native date picker; choosing a date jumps the simulation to that date at 00:00 UTC and pauses it.

**Architecture:** Add a pure `YYYY-MM-DD → simDays` converter and a `SimClock.setSimDays` setter, expose a `seekToDate` action from `useSimulation` that sets the clock and pauses, and turn `DateDisplay` into a click-to-reveal native `<input type="date">`. The React layer wires the picked string through the pure converter into `seekToDate`.

**Tech Stack:** TypeScript 5.6, React 18, Vite 5, Vitest 2, `@testing-library/react`. Native `<input type="date">` — no new dependencies.

## Global Constraints

From the approved spec `docs/superpowers/specs/2026-07-21-clickable-date-picker-design.md`:

- Date-only: display and picker are whole-date; a picked date is interpreted at `00:00 UTC`, so `simDays` is an integer day-offset. `formatSimDate` and its `YYYY-MM-DD` output are unchanged.
- Native `<input type="date">` only — no custom calendar, no runtime dependencies.
- Click-to-reveal: the date renders as a button and becomes an input only while editing.
- Selecting a date pauses the simulation; the user resumes manually. No auto-resume.
- No date range limits; dates before the `2026-01-01 00:00 UTC` epoch (negative `simDays`) are allowed.
- Keep `src/sim/` pure (no DOM/React/Canvas/network).
- Follow strict red-green TDD: run each new test and observe the expected failure before writing production code. Commit each task independently.

---

## File Structure

**Modified:**
- `src/sim/formatDate.ts` — add the pure `dateInputToSimDays` converter.
- `src/sim/formatDate.test.ts` — tests for the converter.
- `src/sim/clock.ts` — add `SimClock.setSimDays`.
- `src/sim/clock.test.ts` — test for the setter.
- `src/ui/DateDisplay.tsx` — click-to-reveal button + native date input.
- `src/ui/DateDisplay.test.tsx` — interactive behavior tests (replaces the single existing test).
- `src/hooks/useSimulation.ts` — add and return `seekToDate`.
- `src/App.tsx` — wire `onSelectDate` through the converter into `seekToDate`.
- `src/styles.css` — button reset/hover and `.date-input` styling.

No new files; the existing boundaries fit the change.

---

### Task 1: Pure date-string to simDays converter

**Files:**
- Modify: `src/sim/formatDate.ts:1-11`
- Test: `src/sim/formatDate.test.ts:1-30`

**Interfaces:**
- Consumes: the existing `EPOCH_MS` and `MS_PER_DAY` module constants.
- Produces: `dateInputToSimDays(value: string): number` — integer day-offset from the epoch for a `YYYY-MM-DD` date at 00:00 UTC.

- [ ] **Step 1: Add failing tests for the converter**

In `src/sim/formatDate.test.ts`, change the import line to:

```ts
import { dateInputToSimDays, formatSimDate } from './formatDate';
```

Add this describe block after the existing `describe('formatSimDate', ...)` block:

```ts
describe('dateInputToSimDays', () => {
  it('maps the epoch date to 0', () => {
    expect(dateInputToSimDays('2026-01-01')).toBe(0);
  });

  it('maps the next day to 1', () => {
    expect(dateInputToSimDays('2026-01-02')).toBe(1);
  });

  it('handles the 2028 leap day', () => {
    expect(dateInputToSimDays('2028-02-29')).toBe(789);
  });

  it('is the inverse of formatSimDate', () => {
    for (const days of [0, 1, 31, 789, 1096, 10000]) {
      expect(dateInputToSimDays(formatSimDate(days))).toBe(days);
    }
  });

  it('produces negative offsets for dates before the epoch', () => {
    expect(dateInputToSimDays('2025-12-31')).toBe(-1);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/sim/formatDate.test.ts
```

Expected: FAIL — `dateInputToSimDays` is not exported.

- [ ] **Step 3: Implement the converter**

In `src/sim/formatDate.ts`, add this function below the existing `formatSimDate` function (keep the constants and `formatSimDate` unchanged):

```ts
/** Integer day-offset from the epoch for a YYYY-MM-DD date at 00:00 UTC. */
export function dateInputToSimDays(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return (Date.UTC(year, month - 1, day) - EPOCH_MS) / MS_PER_DAY;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
npm test -- src/sim/formatDate.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/formatDate.ts src/sim/formatDate.test.ts
git commit -m "feat: add date-string to simDays converter"
```

---

### Task 2: SimClock.setSimDays setter

**Files:**
- Modify: `src/sim/clock.ts:6-25`
- Test: `src/sim/clock.test.ts:1-49`

**Interfaces:**
- Consumes: the existing `SimClock` class with its `simDays` field.
- Produces: `SimClock.setSimDays(days: number): void` — assigns `simDays`.

- [ ] **Step 1: Add a failing test for the setter**

Add this test inside `describe('SimClock', ...)` in `src/sim/clock.test.ts`:

```ts
it('jumps to an explicit simDays value', () => {
  const c = new SimClock();
  c.setSimDays(789);
  expect(c.simDays).toBe(789);
  c.setSimDays(-1);
  expect(c.simDays).toBe(-1);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/sim/clock.test.ts
```

Expected: FAIL — `setSimDays` is not a function.

- [ ] **Step 3: Implement the setter**

In `src/sim/clock.ts`, add this method to `SimClock` after `setPaused`:

```ts
  setSimDays(days: number): void {
    this.simDays = days;
  }
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
npm test -- src/sim/clock.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/clock.ts src/sim/clock.test.ts
git commit -m "feat: add SimClock.setSimDays"
```

---

### Task 3: Clickable DateDisplay with native date input

**Files:**
- Modify: `src/ui/DateDisplay.tsx:1-11`
- Test: `src/ui/DateDisplay.test.tsx:1-10`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `DateDisplay` component with props `{ date: string; onSelectDate: (value: string) => void }`. `onSelectDate` is called with the picked `YYYY-MM-DD` string.

- [ ] **Step 1: Replace the test file with interactive-behavior tests**

Replace the entire contents of `src/ui/DateDisplay.test.tsx` with:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateDisplay } from './DateDisplay';

function openEditor() {
  fireEvent.click(screen.getByRole('button', { name: /simulation date/i }));
  return document.querySelector('input[type="date"]') as HTMLInputElement;
}

describe('DateDisplay', () => {
  it('renders the date on a button', () => {
    render(<DateDisplay date="2026-07-21" onSelectDate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /simulation date/i }).textContent).toBe('2026-07-21');
  });

  it('reveals a date input seeded with the current date when clicked', () => {
    render(<DateDisplay date="2026-07-21" onSelectDate={vi.fn()} />);
    const input = openEditor();
    expect(input).toBeTruthy();
    expect(input.value).toBe('2026-07-21');
  });

  it('calls onSelectDate with the picked value and returns to the button', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: '2027-03-15' } });
    expect(onSelectDate).toHaveBeenCalledWith('2027-03-15');
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByRole('button', { name: /simulation date/i })).toBeTruthy();
  });

  it('ignores an empty value', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: '' } });
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it('reverts on Escape without selecting', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} />);
    const input = openEditor();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSelectDate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /simulation date/i })).toBeTruthy();
  });

  it('reverts on blur without selecting', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} />);
    const input = openEditor();
    fireEvent.blur(input);
    expect(onSelectDate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /simulation date/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/ui/DateDisplay.test.tsx
```

Expected: FAIL — `DateDisplay` renders a `div`, not a button, and has no editing behavior; TypeScript also flags the missing `onSelectDate` prop.

- [ ] **Step 3: Implement the interactive component**

Replace the entire contents of `src/ui/DateDisplay.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';

interface DateDisplayProps {
  date: string;
  onSelectDate: (value: string) => void;
}

export function DateDisplay({ date, onSelectDate }: DateDisplayProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // showPicker can throw without user activation; the input still works.
      }
    }
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className="date-display"
        aria-label="Simulation date, click to change"
        onClick={() => setEditing(true)}
      >
        {date}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="date"
      className="date-input"
      defaultValue={date}
      aria-label="Simulation date"
      onChange={(e) => {
        const value = e.target.value;
        if (!value) return;
        onSelectDate(value);
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
npm test -- src/ui/DateDisplay.test.tsx
```

Expected: PASS, 6 tests. (In jsdom, `input.showPicker` is absent, so the guard skips it and the tests run without error.)

- [ ] **Step 5: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/DateDisplay.tsx src/ui/DateDisplay.test.tsx
git commit -m "feat: make the date display a click-to-reveal date picker"
```

---

### Task 4: Wire seekToDate through the hook, App, and styles

**Files:**
- Modify: `src/hooks/useSimulation.ts:117-129`
- Modify: `src/App.tsx:1-22`
- Modify: `src/styles.css:65-74`

**Interfaces:**
- Consumes: `SimClock.setSimDays` (Task 2), `dateInputToSimDays` (Task 1), the `DateDisplay` `onSelectDate` prop (Task 3), and the existing `formatSimDate`.
- Produces: `useSimulation(...).seekToDate(simDays: number): void` — sets the clock's `simDays`, pauses, and refreshes the displayed date.

- [ ] **Step 1: Add `seekToDate` to the hook and return it**

In `src/hooks/useSimulation.ts`, add this function just after the existing `togglePause` definition (near the end of the hook, before the `return`):

```ts
  const seekToDate = (simDays: number) => {
    const clock = simRef.current?.clock;
    if (!clock) return;
    clock.setSimDays(simDays);
    clock.setPaused(true);
    setPaused(true);
    setDate(formatSimDate(simDays));
  };
```

Then change the hook's return statement to include it:

```ts
  return { multiplier, paused, mode, date, setMultiplier, togglePause, setMode, seekToDate };
```

(`formatSimDate` is already imported at the top of this file; no new import is needed.)

- [ ] **Step 2: Verify the hook still type-checks and its test still passes**

Run:

```bash
npx tsc --noEmit && npm test -- src/hooks/useSimulation.test.tsx
```

Expected: PASS. The existing pointer-input test ignores the hook's return value, so adding `seekToDate` does not affect it.

- [ ] **Step 3: Wire `onSelectDate` in App**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { dateInputToSimDays } from './sim/formatDate';
import { DateDisplay } from './ui/DateDisplay';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { multiplier, paused, mode, date, setMultiplier, togglePause, setMode, seekToDate } =
    useSimulation(canvasRef);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" />
      <Toolbar
        multiplier={multiplier}
        paused={paused}
        mode={mode}
        onSelectSpeed={setMultiplier}
        onTogglePause={togglePause}
        onSelectMode={setMode}
      />
      <DateDisplay date={date} onSelectDate={(value) => seekToDate(dateInputToSimDays(value))} />
    </div>
  );
}
```

- [ ] **Step 4: Style the button and the date input**

In `src/styles.css`, replace the existing `.date-display` rule (the block starting at `.date-display {`) with:

```css
.date-display {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #cfd8ff;
  font: 14px/1.2 ui-monospace, monospace;
  background: rgba(27, 35, 64, 0.8);
  padding: 6px 10px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.date-display:hover {
  background: rgba(38, 48, 90, 0.9);
}

.date-input {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #cfd8ff;
  font: 14px/1.2 ui-monospace, monospace;
  background: #1b2340;
  border: 1px solid #34406e;
  border-radius: 4px;
  padding: 5px 9px;
  color-scheme: dark;
}
```

- [ ] **Step 5: Run the full suite, type-check, and build**

Run:

```bash
npm test && npx tsc --noEmit && npm run build
```

Expected: all tests pass; no type errors; the production build completes.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSimulation.ts src/App.tsx src/styles.css
git commit -m "feat: seek the simulation to a picked date and pause"
```

- [ ] **Step 7: Manually verify in the browser**

Run:

```bash
npm run dev
```

Open the local Vite URL and verify:

1. The top-right date looks the same as before but is now clickable (pointer cursor, hover highlight).
2. Clicking/tapping it reveals a native date input seeded with the current date, and the calendar opens.
3. Picking a date jumps the planets to that date's positions, updates the top-right to the chosen date, and the toolbar button switches to "Resume" (simulation paused).
4. Clicking "Resume" continues the simulation from the chosen date.
5. Opening the picker and pressing Escape (or clicking away) restores the date button without changing anything.
6. Speed controls, pause/resume, zoom, pan, and the Schematic/To Scale switch still work, and a picked date is respected in both scale modes.

Stop the dev server after verification. No commit is needed unless a defect is found; if one is found, add a failing regression test before the fix and commit that fix separately.

---

## Completion Checklist

- `dateInputToSimDays` converts `YYYY-MM-DD` (00:00 UTC) to an integer day-offset and is the inverse of `formatSimDate`.
- `SimClock.setSimDays` jumps the clock to an explicit value.
- `DateDisplay` is a click-to-reveal native date picker: reverts on Escape/blur, ignores empty values, and emits the picked string.
- `useSimulation.seekToDate` sets the clock, pauses (clock + React state), and refreshes the displayed date.
- `App` converts the picked string and calls `seekToDate`.
- The button and input match the dark UI; the native calendar renders in dark theme.
- Full suite, type check, and production build pass; manual browser check confirms seek-and-pause.
