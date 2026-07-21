# Today Button and Startup-on-Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start the simulation on today's date (running), and add a "Today" button next to the date that seeks to today and pauses.

**Architecture:** Add a pure `timestampToSimDays` converter. Initialize the clock and displayed date to today at startup in `useSimulation`, and add a `goToToday` action (which reuses the pausing `seekToDate`). Add a "Today" button to `DateDisplay` (wrapped with the date control in a flex container) and wire `goToToday` through `App`.

**Tech Stack:** TypeScript 5.6, React 18, Vite 5, Vitest 2, `@testing-library/react`. No new dependencies.

## Global Constraints

From the approved spec `docs/superpowers/specs/2026-07-21-today-button-and-startup-design.md`:

- Startup: initialize to today's date and keep running (`paused = false`).
- The Today button pauses (it reuses `seekToDate`, which pauses).
- "Today" is the current **UTC** date at 00:00 (matches the displayed UTC date).
- Keep `src/sim/` pure: the timestamp→`simDays` conversion is a pure function taking an explicit ms argument; the impure `Date.now()` read stays in the React/hook layer only.
- No new runtime dependencies.
- Follow strict red-green TDD: run each new test and observe the expected failure before writing production code. Commit each task independently.

---

## File Structure

**Modified:**
- `src/sim/formatDate.ts` — add the pure `timestampToSimDays` converter.
- `src/sim/formatDate.test.ts` — tests for the converter.
- `src/hooks/useSimulation.ts` — start the clock/date on today; add and return `goToToday`.
- `src/hooks/useSimulation.test.tsx` — startup-on-today and `goToToday` tests.
- `src/ui/DateDisplay.tsx` — add the Today button and the `onToday` prop; wrap in a container.
- `src/ui/DateDisplay.test.tsx` — Today-button test; existing tests pass the new prop.
- `src/App.tsx` — wire `onToday={goToToday}`.
- `src/styles.css` — `.date-controls` container, static `.date-display`/`.date-input`, `.today-button`.

No new files.

**Task ordering note:** Task 2 adds `goToToday` to the hook while `App` still renders the current `DateDisplay` (unchanged props), so everything compiles. Task 3 changes `DateDisplay` to require `onToday` **and** updates `App` to pass it in the same commit, so no intermediate commit is left non-compiling.

---

### Task 1: Pure timestamp-to-simDays converter

**Files:**
- Modify: `src/sim/formatDate.ts`
- Test: `src/sim/formatDate.test.ts`

**Interfaces:**
- Consumes: the existing `EPOCH_MS` and `MS_PER_DAY` module constants.
- Produces: `timestampToSimDays(nowMs: number): number` — integer day-offset for the UTC date containing `nowMs`.

- [ ] **Step 1: Add failing tests for the converter**

In `src/sim/formatDate.test.ts`, change the import line to:

```ts
import { dateInputToSimDays, formatSimDate, timestampToSimDays } from './formatDate';
```

Add this describe block after the existing `describe('dateInputToSimDays', ...)` block:

```ts
describe('timestampToSimDays', () => {
  it('maps the epoch instant to 0', () => {
    expect(timestampToSimDays(Date.UTC(2026, 0, 1, 0, 0, 0))).toBe(0);
  });

  it('floors to the UTC day (later time same day still maps to that day)', () => {
    expect(timestampToSimDays(Date.UTC(2026, 0, 1, 23, 59, 59))).toBe(0);
  });

  it('maps a known day to its offset', () => {
    // 2026-07-21 is 201 days after 2026-01-01.
    expect(timestampToSimDays(Date.UTC(2026, 6, 21, 12, 0, 0))).toBe(201);
    expect(formatSimDate(201)).toBe('2026-07-21');
  });

  it('produces a negative offset for an instant before the epoch', () => {
    expect(timestampToSimDays(Date.UTC(2025, 11, 31, 12, 0, 0))).toBe(-1);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/sim/formatDate.test.ts
```

Expected: FAIL — `timestampToSimDays` is not exported.

- [ ] **Step 3: Implement the converter**

In `src/sim/formatDate.ts`, add this function below `dateInputToSimDays` (keep everything else unchanged):

```ts
/** Integer day-offset from the epoch for the UTC date containing `nowMs` (00:00 UTC). */
export function timestampToSimDays(nowMs: number): number {
  return Math.floor((nowMs - EPOCH_MS) / MS_PER_DAY);
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
npm test -- src/sim/formatDate.test.ts
```

Expected: PASS (all `formatDate` tests, including the 4 new ones).

- [ ] **Step 5: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/formatDate.ts src/sim/formatDate.test.ts
git commit -m "feat: add timestamp-to-simDays converter"
```

---

### Task 2: Start on today and add goToToday in the hook

**Files:**
- Modify: `src/hooks/useSimulation.ts`
- Test: `src/hooks/useSimulation.test.tsx`

**Interfaces:**
- Consumes: `timestampToSimDays` (Task 1); the existing `seekToDate` and `formatSimDate`.
- Produces: `useSimulation(...)` now starts the clock/date on today (running) and returns `goToToday(): void` (seeks to today and pauses).

- [ ] **Step 1: Add failing tests for startup-on-today and goToToday**

In `src/hooks/useSimulation.test.tsx`, add these two tests inside the existing `describe('useSimulation pointer input', ...)` block (the `beforeEach`/`afterEach` and `act`/`render`/`useRef`/`vi` imports already exist; `vi.restoreAllMocks()` in `afterEach` restores the `Date.now` spy):

```ts
it('starts on today\'s UTC date and running', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 6, 21, 12, 0, 0));
  let hookState: any;

  function TestStartup() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    hookState = useSimulation(canvasRef);
    return <canvas ref={canvasRef} />;
  }

  render(<TestStartup />);

  expect(hookState.date).toBe('2026-07-21');
  expect(hookState.paused).toBe(false);
});

it('goToToday seeks to today and pauses', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 6, 21, 12, 0, 0));
  let hookState: any;

  function TestToday() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    hookState = useSimulation(canvasRef);
    return <canvas ref={canvasRef} />;
  }

  render(<TestToday />);

  act(() => {
    hookState.goToToday();
  });

  expect(hookState.date).toBe('2026-07-21');
  expect(hookState.paused).toBe(true);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/hooks/useSimulation.test.tsx
```

Expected: FAIL — the initial `date` is still `2026-01-01` (not today), and `goToToday` is `undefined`.

- [ ] **Step 3: Import the converter and initialize the date state to today**

In `src/hooks/useSimulation.ts`, change the `formatSimDate` import to also import the converter:

```ts
import { formatSimDate, timestampToSimDays } from '../sim/formatDate';
```

Change the `date` state initializer from `formatSimDate(0)` to today:

```ts
  const [date, setDate] = useState(() => formatSimDate(timestampToSimDays(Date.now())));
```

- [ ] **Step 4: Set the clock to today at startup**

In `src/hooks/useSimulation.ts`, inside the effect, set the clock right after the simulation is created. Change:

```ts
    const sim = new Simulation();
    simRef.current = sim;
```

to:

```ts
    const sim = new Simulation();
    sim.clock.setSimDays(timestampToSimDays(Date.now()));
    simRef.current = sim;
```

Do not pause — the default `paused = false` keeps it running from today.

- [ ] **Step 5: Add and return `goToToday`**

In `src/hooks/useSimulation.ts`, add this function just after the existing `seekToDate` definition:

```ts
  const goToToday = () => {
    seekToDate(timestampToSimDays(Date.now()));
  };
```

Change the hook's return statement to include it:

```ts
  return { multiplier, paused, mode, date, setMultiplier, togglePause, setMode, seekToDate, goToToday };
```

- [ ] **Step 6: Run the hook tests and the full suite**

Run:

```bash
npm test -- src/hooks/useSimulation.test.tsx && npm test
```

Expected: PASS. The pointer-input and `seekToDate` tests are unaffected (the `seekToDate(789)` test overrides the clock/date regardless of the startup value).

- [ ] **Step 7: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS. `App` still renders `<DateDisplay date={date} onSelectDate={...} />` with the current props, so it compiles even though the hook now also returns `goToToday`.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useSimulation.ts src/hooks/useSimulation.test.tsx
git commit -m "feat: start on today's date and add goToToday"
```

---

### Task 3: Today button in DateDisplay, wired through App, styled

**Files:**
- Modify: `src/ui/DateDisplay.tsx`
- Test: `src/ui/DateDisplay.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `goToToday` from the hook (Task 2); the existing `seekToDate` + `dateInputToSimDays`.
- Produces: `DateDisplay` with props `{ date: string; onSelectDate: (value: string) => void; onToday: () => void }`, rendering a "Today" button beside the date.

- [ ] **Step 1: Replace the DateDisplay test file (add the Today-button test and the new prop)**

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
    render(<DateDisplay date="2026-07-21" onSelectDate={vi.fn()} onToday={vi.fn()} />);
    expect(screen.getByRole('button', { name: /simulation date/i }).textContent).toBe('2026-07-21');
  });

  it('reveals a date input seeded with the current date when clicked', () => {
    render(<DateDisplay date="2026-07-21" onSelectDate={vi.fn()} onToday={vi.fn()} />);
    const input = openEditor();
    expect(input).toBeTruthy();
    expect(input.value).toBe('2026-07-21');
  });

  it('calls onSelectDate with the picked value and returns to the button', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} onToday={vi.fn()} />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: '2027-03-15' } });
    expect(onSelectDate).toHaveBeenCalledWith('2027-03-15');
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByRole('button', { name: /simulation date/i })).toBeTruthy();
  });

  it('ignores an empty value', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} onToday={vi.fn()} />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: '' } });
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it('reverts on Escape without selecting', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} onToday={vi.fn()} />);
    const input = openEditor();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSelectDate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /simulation date/i })).toBeTruthy();
  });

  it('reverts on blur without selecting', () => {
    const onSelectDate = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={onSelectDate} onToday={vi.fn()} />);
    const input = openEditor();
    fireEvent.blur(input);
    expect(onSelectDate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /simulation date/i })).toBeTruthy();
  });

  it('renders a Today button that calls onToday when clicked', () => {
    const onToday = vi.fn();
    render(<DateDisplay date="2026-07-21" onSelectDate={vi.fn()} onToday={onToday} />);
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onToday).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/ui/DateDisplay.test.tsx
```

Expected: FAIL — there is no "Today" button yet, and TypeScript flags the missing `onToday` prop.

- [ ] **Step 3: Add the Today button and container to DateDisplay**

Replace the entire contents of `src/ui/DateDisplay.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';

interface DateDisplayProps {
  date: string;
  onSelectDate: (value: string) => void;
  onToday: () => void;
}

export function DateDisplay({ date, onSelectDate, onToday }: DateDisplayProps) {
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

  return (
    <div className="date-controls">
      {editing ? (
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
      ) : (
        <button
          type="button"
          className="date-display"
          aria-label="Simulation date, click to change"
          onClick={() => setEditing(true)}
        >
          {date}
        </button>
      )}
      <button type="button" className="today-button" onClick={onToday}>
        Today
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the DateDisplay tests and verify they pass**

Run:

```bash
npm test -- src/ui/DateDisplay.test.tsx
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Wire `onToday` in App**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { dateInputToSimDays } from './sim/formatDate';
import { DateDisplay } from './ui/DateDisplay';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { multiplier, paused, mode, date, setMultiplier, togglePause, setMode, seekToDate, goToToday } =
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
      <DateDisplay
        date={date}
        onSelectDate={(value) => seekToDate(dateInputToSimDays(value))}
        onToday={goToToday}
      />
    </div>
  );
}
```

- [ ] **Step 6: Style the container, date element, and Today button**

In `src/styles.css`, replace the existing `.date-display`, `.date-display:hover`, and `.date-input` rules (the three blocks spanning from `.date-display {` through the end of the `.date-input { ... }` block) with:

```css
.date-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  align-items: stretch;
}

.date-display {
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
  color: #cfd8ff;
  font: 14px/1.2 ui-monospace, monospace;
  background: #1b2340;
  border: 1px solid #34406e;
  border-radius: 4px;
  padding: 5px 9px;
  color-scheme: dark;
}

.today-button {
  background: #1b2340;
  color: #cfd8ff;
  border: 1px solid #34406e;
  border-radius: 4px;
  padding: 6px 10px;
  font: 13px system-ui, sans-serif;
  cursor: pointer;
}

.today-button:hover {
  background: #26305a;
}
```

- [ ] **Step 7: Run the full suite, type-check, and build**

Run:

```bash
npm test && npx tsc --noEmit && npm run build
```

Expected: all tests pass; no type errors; the production build completes.

- [ ] **Step 8: Commit**

```bash
git add src/ui/DateDisplay.tsx src/ui/DateDisplay.test.tsx src/App.tsx src/styles.css
git commit -m "feat: add Today button beside the date"
```

- [ ] **Step 9: Manually verify in the browser**

Run:

```bash
npm run dev
```

Open the local Vite URL and verify:

1. On load, the top-right date shows **today's date** (not 2026-01-01) and the simulation is running (planets animate; the button reads "Pause").
2. A **"Today"** button sits next to the date, styled like the other controls.
3. Change the speed and let time advance, or pick a different date; then click **Today** — the view jumps back to today's constellation and the simulation **pauses** (button reads "Resume").
4. The date picker (click the date), Escape/blur revert, speed controls, pause/resume, zoom, pan, and the Schematic/To Scale switch all still work.

Stop the dev server after verification. No commit is needed unless a defect is found; if one is found, add a failing regression test before the fix and commit that fix separately.

---

## Completion Checklist

- `timestampToSimDays` returns the integer day-offset for the UTC date of a given instant.
- The clock and the displayed date start on today (UTC), running.
- `goToToday` seeks to today and pauses (via `seekToDate`).
- `DateDisplay` renders a "Today" button beside the date and calls `onToday`; `onSelectDate` behavior is unchanged.
- `App` passes `goToToday` as `onToday`.
- The top-right controls sit in a flex container; the Today button matches the control aesthetic.
- Full suite, type check, and production build pass; manual browser check confirms startup-on-today and Today-pauses.
