# Real-Time Speed Scales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redefine the simulation speed multiplier as simulated seconds per real second (so `1×` is real time) and replace the five old speeds with nine human-readable scales from `1s = 20 min` to `1s = 3 years`.

**Architecture:** `SimClock` keeps `simDays` as its internal unit; only `advance()` changes, dividing by `SECONDS_PER_DAY`. A single ordered constant `SPEED_MULTIPLIERS` in `src/sim/clock.ts` is the source of truth for both the `SpeedMultiplier` union type and the dropdown contents, replacing the duplicate list that lives in `Toolbar.tsx` today. `src/ui/timeScale.ts` owns both display strings so the toolbar holds no time knowledge.

**Tech Stack:** TypeScript, React 18, Vite, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-25-real-time-speed-scales-design.md`

## Global Constraints

- The multiplier means **simulated seconds per real second**. `1×` is real time; `86_400×` advances one simulated day per real second.
- The nine speeds, in this exact order: `1_200`, `3_600`, `21_600`, `43_200`, `86_400`, `2_592_000`, `7_776_000`, `31_536_000`, `94_608_000`.
- A month is **30 days**, a year is **365 days**.
- Default speed is `86_400` (`1s = 24 h`) — identical motion to the old `1×` default.
- Dropdown option text is the human-readable scale (`1s = 24 h`); the `.time-scale` span beside it shows the grouped multiplier (`86,400×`, using the `×` character U+00D7, not the letter `x`).
- `SPEED_MULTIPLIERS` must be the only list of speeds in the codebase.
- No CSS changes, no toolbar layout changes, no new props, no change to `MAX_FRAME_DT_SECONDS`.
- `tsconfig.json` has `"include": ["src"]`, so `npm run build` type-checks test files too. Test code must compile under `strict`; never use a value outside the union (e.g. `setMultiplier(1)` will not compile).
- Run tests with `npm test` (Vitest, single run). Run `npm run build` (`tsc --noEmit && vite build`) before the final commit of each task.

---

### Task 1: Real-time speed model end to end

This task is atomic on purpose: changing the `SpeedMultiplier` union invalidates every existing speed literal at once (`Toolbar`'s local `SPEEDS` array, the hook's initial state, and three test files). Splitting it would leave the suite red at a task boundary. Mid-task red is expected and correct — that's the TDD cycle — but the task ends with `npm test` and `npm run build` both clean.

**Files:**
- Modify: `src/sim/clock.ts` (whole file)
- Modify: `src/sim/clock.test.ts` (whole file)
- Modify: `src/ui/timeScale.ts` (whole file)
- Modify: `src/ui/timeScale.test.ts` (whole file)
- Modify: `src/ui/Toolbar.tsx:1-3,16,41-47`
- Modify: `src/ui/Toolbar.test.tsx:7,22-29,40-43`
- Modify: `src/hooks/useSimulation.ts:6,20`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `SPEED_MULTIPLIERS: readonly [1200, 3600, 21600, 43200, 86400, 2592000, 7776000, 31536000, 94608000]` (from `src/sim/clock.ts`)
  - `type SpeedMultiplier = (typeof SPEED_MULTIPLIERS)[number]`
  - `DEFAULT_SPEED_MULTIPLIER: SpeedMultiplier` = `86_400`
  - `timeScaleLabel(multiplier: SpeedMultiplier): string` → `'1s = 24 h'` (from `src/ui/timeScale.ts`)
  - `speedMultiplierLabel(multiplier: SpeedMultiplier): string` → `'86,400×'` (from `src/ui/timeScale.ts`)
  - `SimClock.advance`, `setMultiplier`, `setPaused`, `setSimDays` keep their existing signatures.

- [ ] **Step 1: Rewrite the clock test for the new unit**

Replace the whole of `src/sim/clock.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED_MULTIPLIER, SimClock, SPEED_MULTIPLIERS } from './clock';

describe('SimClock', () => {
  it('starts at day 0, at the default speed, unpaused', () => {
    const c = new SimClock();
    expect(c.simDays).toBe(0);
    expect(c.multiplier).toBe(86_400);
    expect(DEFAULT_SPEED_MULTIPLIER).toBe(86_400);
    expect(c.paused).toBe(false);
  });

  it('treats the multiplier as simulated seconds per real second', () => {
    const c = new SimClock();
    c.setMultiplier(1_200);
    c.advance(0.1); // 0.1 real s x 1200 = 120 simulated seconds
    expect(c.simDays * 86_400).toBeCloseTo(120, 6);
  });

  it('advances 1 day per real second at 86,400x for frame dt below the cap', () => {
    const c = new SimClock();
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.1, 10);
  });

  it('advances proportionally to the multiplier for frame dt below the cap', () => {
    const c = new SimClock();
    c.setMultiplier(1_200);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.0013889, 7);
    c.setMultiplier(43_200);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(0.0513889, 7);
    c.setMultiplier(2_592_000);
    c.advance(0.1);
    expect(c.simDays).toBeCloseTo(3.0513889, 7);
    c.setMultiplier(94_608_000);
    c.advance(0.016);
    expect(c.simDays).toBeCloseTo(20.5713889, 7);
  });

  it('exposes the nine speed options in ascending order', () => {
    expect(SPEED_MULTIPLIERS).toEqual([
      1_200, 3_600, 21_600, 43_200, 86_400,
      2_592_000, 7_776_000, 31_536_000, 94_608_000,
    ]);
    expect(SPEED_MULTIPLIERS).toContain(DEFAULT_SPEED_MULTIPLIER);
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

  it('jumps to an explicit simDays value', () => {
    const c = new SimClock();
    c.setSimDays(789);
    expect(c.simDays).toBe(789);
    c.setSimDays(-1);
    expect(c.simDays).toBe(-1);
  });
});
```

The cumulative expectations in the proportionality test are: `0.1×1200/86400 = 0.00138889`; `+0.1×43200/86400 = 0.05` → `0.05138889`; `+0.1×2592000/86400 = 3` → `3.05138889`; `+0.016×94608000/86400 = 17.52` → `20.57138889`.

- [ ] **Step 2: Run the clock tests to verify they fail**

Run: `npm test -- src/sim/clock.test.ts`
Expected: FAIL — `SPEED_MULTIPLIERS` and `DEFAULT_SPEED_MULTIPLIER` are not exported from `./clock`, and the default-multiplier assertion sees `1`.

- [ ] **Step 3: Implement the new clock**

Replace the whole of `src/sim/clock.ts` with:

```ts
/**
 * Speed options, in dropdown order: simulated seconds per real second.
 * 1x would be real time; 86_400x advances one simulated day per real second.
 *
 * This array is the single source of truth for both the SpeedMultiplier union
 * and the toolbar dropdown contents — never duplicate the list elsewhere.
 */
export const SPEED_MULTIPLIERS = [
  1_200, // 1s = 20 min
  3_600, // 1s = 1 h
  21_600, // 1s = 6 h
  43_200, // 1s = 12 h
  86_400, // 1s = 24 h
  2_592_000, // 1s = 1 month (30 d)
  7_776_000, // 1s = 3 months (90 d)
  31_536_000, // 1s = 1 year (365 d)
  94_608_000, // 1s = 3 years (1095 d)
] as const;

export type SpeedMultiplier = (typeof SPEED_MULTIPLIERS)[number];

/** 1s = 24 h — one simulated day per real second. */
export const DEFAULT_SPEED_MULTIPLIER: SpeedMultiplier = 86_400;

const SECONDS_PER_DAY = 86_400;

/** Max real seconds consumed per advance() call (tab-switch guard). */
export const MAX_FRAME_DT_SECONDS = 0.25;

export class SimClock {
  simDays = 0;
  paused = false;
  multiplier: SpeedMultiplier = DEFAULT_SPEED_MULTIPLIER;

  /** The multiplier is simulated seconds per real second; 1x is real time. */
  advance(realDtSeconds: number): void {
    if (this.paused) return;
    const dt = Math.min(realDtSeconds, MAX_FRAME_DT_SECONDS);
    this.simDays += (dt * this.multiplier) / SECONDS_PER_DAY;
  }

  setMultiplier(m: SpeedMultiplier): void {
    this.multiplier = m;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  setSimDays(days: number): void {
    this.simDays = days;
  }
}
```

- [ ] **Step 4: Run the clock tests to verify they pass**

Run: `npm test -- src/sim/clock.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Rewrite the time-scale label test**

Replace the whole of `src/ui/timeScale.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { SPEED_MULTIPLIERS } from '../sim/clock';
import { speedMultiplierLabel, timeScaleLabel } from './timeScale';

describe('timeScaleLabel', () => {
  it('maps every speed multiplier to its human-readable scale', () => {
    expect(timeScaleLabel(1_200)).toBe('1s = 20 min');
    expect(timeScaleLabel(3_600)).toBe('1s = 1 h');
    expect(timeScaleLabel(21_600)).toBe('1s = 6 h');
    expect(timeScaleLabel(43_200)).toBe('1s = 12 h');
    expect(timeScaleLabel(86_400)).toBe('1s = 24 h');
    expect(timeScaleLabel(2_592_000)).toBe('1s = 1 month');
    expect(timeScaleLabel(7_776_000)).toBe('1s = 3 months');
    expect(timeScaleLabel(31_536_000)).toBe('1s = 1 year');
    expect(timeScaleLabel(94_608_000)).toBe('1s = 3 years');
  });

  it('gives every speed option a distinct, non-empty label', () => {
    const labels = SPEED_MULTIPLIERS.map(timeScaleLabel);
    expect(labels.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(SPEED_MULTIPLIERS.length);
  });
});

describe('speedMultiplierLabel', () => {
  it('formats the multiplier with digit grouping', () => {
    expect(speedMultiplierLabel(1_200)).toBe('1,200×');
    expect(speedMultiplierLabel(86_400)).toBe('86,400×');
    expect(speedMultiplierLabel(94_608_000)).toBe('94,608,000×');
  });
});
```

- [ ] **Step 6: Run the time-scale tests to verify they fail**

Run: `npm test -- src/ui/timeScale.test.ts`
Expected: FAIL — `speedMultiplierLabel` is not exported, and `timeScaleLabel(1_200)` returns `'1s = 1200 days'`.

- [ ] **Step 7: Implement the label module**

Replace the whole of `src/ui/timeScale.ts` with:

```ts
import type { SpeedMultiplier } from '../sim/clock';

/**
 * Human-readable scale per speed option. Typing this as a full Record over
 * SpeedMultiplier makes a missing or stray entry a compile error, so this
 * table cannot drift from SPEED_MULTIPLIERS.
 */
const SCALE_LABELS: Record<SpeedMultiplier, string> = {
  1200: '1s = 20 min',
  3600: '1s = 1 h',
  21600: '1s = 6 h',
  43200: '1s = 12 h',
  86400: '1s = 24 h',
  2592000: '1s = 1 month',
  7776000: '1s = 3 months',
  31536000: '1s = 1 year',
  94608000: '1s = 3 years',
};

/** Dropdown text for a speed, e.g. '1s = 24 h'. */
export function timeScaleLabel(multiplier: SpeedMultiplier): string {
  return SCALE_LABELS[multiplier];
}

/** Raw speed factor for a speed, e.g. '86,400x' (U+00D7 multiplication sign). */
export function speedMultiplierLabel(multiplier: SpeedMultiplier): string {
  return `${multiplier.toLocaleString('en-US')}×`;
}
```

- [ ] **Step 8: Run the time-scale tests to verify they pass**

Run: `npm test -- src/ui/timeScale.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 9: Update the toolbar test for the new speeds**

In `src/ui/Toolbar.test.tsx`, change the fixture default on line 7:

```tsx
    multiplier: 86_400,
```

Replace the first test (lines 22-29) with:

```tsx
  it('renders a speed dropdown reflecting the multiplier and fires onSelectSpeed on change', () => {
    const props = renderToolbar({ multiplier: 2_592_000 });
    const select = screen.getByRole('combobox', { name: 'Speed' }) as HTMLSelectElement;
    expect(select.value).toBe('2592000');
    expect(select.querySelectorAll('option')).toHaveLength(9);
    fireEvent.change(select, { target: { value: '1200' } });
    expect(props.onSelectSpeed).toHaveBeenCalledWith(1_200);
  });
```

Replace the label test (lines 40-43) with:

```tsx
  it('shows the human-readable scale in the dropdown and the factor beside it', () => {
    renderToolbar({ multiplier: 31_536_000 });
    const select = screen.getByRole('combobox', { name: 'Speed' }) as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toBe('1s = 1 year');
    expect(screen.getByText('31,536,000×')).toBeTruthy();
  });
```

Leave the mode-dropdown, pause, and comets tests untouched.

- [ ] **Step 10: Run the toolbar tests to verify they fail**

Run: `npm test -- src/ui/Toolbar.test.tsx`
Expected: FAIL — the dropdown still renders 5 options built from the old local `SPEEDS` array, and the span still shows a `1s = ...` string.

- [ ] **Step 11: Wire the toolbar and the hook to the new source of truth**

In `src/ui/Toolbar.tsx`, replace the imports on lines 1-3:

```tsx
import { SPEED_MULTIPLIERS, type SpeedMultiplier } from '../sim/clock';
import type { ViewMode } from '../sim/types';
import { speedMultiplierLabel, timeScaleLabel } from './timeScale';
```

Delete the local `SPEEDS` constant (line 16) entirely. Then replace the options loop and the label span (lines 41-47):

```tsx
        {SPEED_MULTIPLIERS.map((speed) => (
          <option key={speed} value={speed}>
            {timeScaleLabel(speed)}
          </option>
        ))}
      </select>
      <span className="time-scale">{speedMultiplierLabel(multiplier)}</span>
```

In `src/hooks/useSimulation.ts`, replace the type-only import on line 6:

```ts
import { DEFAULT_SPEED_MULTIPLIER, type SpeedMultiplier } from '../sim/clock';
```

and the initial state on line 20:

```ts
  const [multiplier, setMultiplierState] = useState<SpeedMultiplier>(DEFAULT_SPEED_MULTIPLIER);
```

- [ ] **Step 12: Run the full test suite**

Run: `npm test`
Expected: PASS — every suite green, including `Toolbar.test.tsx` (6 tests).

- [ ] **Step 13: Type-check and build**

Run: `npm run build`
Expected: clean — no `tsc` errors (this also type-checks the test files) and a successful Vite build.

- [ ] **Step 14: Commit**

```bash
git add src/sim/clock.ts src/sim/clock.test.ts src/ui/timeScale.ts src/ui/timeScale.test.ts src/ui/Toolbar.tsx src/ui/Toolbar.test.tsx src/hooks/useSimulation.ts
git commit -m "feat: make simulation speed real-time based with nine clear scales"
```

---

### Task 2: Document the new time model

**Files:**
- Modify: `README.md:11`

**Interfaces:**
- Consumes: the nine scales and the `1s = 24 h` default from Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace the speed feature bullet**

In `README.md`, replace line 11:

```markdown
- Adjustable simulation speed and pause/resume controls.
```

with:

```markdown
- **Real-time-based speed control.** The speed factor is simulated seconds per real second, so the scale is always explicit: pick from `1s = 20 min`, `1 h`, `6 h`, `12 h`, `24 h` (the default, 86,400×), `1 month`, `3 months`, `1 year`, or `3 years`. Months are 30 days and years 365 days. Pause/resume sits beside it.
```

- [ ] **Step 2: Verify the suite and build are still clean**

Run: `npm test && npm run build`
Expected: PASS and a clean build (a README edit touches no code, so this is a regression guard before committing).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe the real-time-based speed scales"
```

---

## Manual verification

After both tasks, run `npm run dev` and confirm in the browser:

1. The toolbar opens on `1s = 24 h` with `86,400×` beside it, and planets move exactly as they did before the change.
2. The dropdown lists all nine scales in order, from `1s = 20 min` to `1s = 3 years`.
3. Picking `1s = 1 month` visibly speeds the system up (Earth laps in roughly 12 s); the span updates to `2,592,000×`.
4. At `1s = 20 min` motion is nearly imperceptible — expected, not a bug.
5. Pause/resume, the date picker, "Today", and the comet picker still behave as before.
