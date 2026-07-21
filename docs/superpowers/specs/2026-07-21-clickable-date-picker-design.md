# Clickable Date Picker Design

**Status:** Approved

## Goal

Make the top-right simulation date selectable. Clicking or tapping it opens a native date picker; choosing a date sets the simulation to that date (00:00 UTC) and pauses it.

## Background

The top-right display currently shows the simulation date only, formatted `YYYY-MM-DD` by `formatSimDate(simDays)` (`src/sim/formatDate.ts`). There is no time-of-day shown. The simulation is driven by `simDays`, a floating-point number of days since the epoch `2026-01-01 00:00 UTC`. `SimClock` (`src/sim/clock.ts`) owns `simDays`, `paused`, and `multiplier`; it exposes `advance`, `setMultiplier`, and `setPaused`, but no way to jump to a specific `simDays`.

## Decisions

- **Date-only.** The display and the picker are whole-date only. A picked date is interpreted at `00:00 UTC`, making the resulting `simDays` an integer day-offset from the epoch. `formatSimDate` and its output format are unchanged.
- **Native control.** Use `<input type="date">` — tap-friendly, accessible, no runtime dependencies. No custom calendar.
- **Click-to-reveal.** The date normally renders as a button showing the plain date text (unchanged look). It becomes an input only while editing.
- **Pause on selection.** Selecting a date pauses the simulation. The user resumes manually with the existing Pause/Resume button. No auto-resume.
- **No range limits.** Any date is allowed. Dates before the epoch produce negative `simDays`, which the existing orbital math already handles.

## Components and Interfaces

Each unit is small, has one responsibility, and is testable in isolation.

### `src/sim/formatDate.ts` (modify)

Add one pure function; keep `formatSimDate` and the `EPOCH_MS` / `MS_PER_DAY` constants unchanged.

```ts
/** Integer day-offset from the epoch for a YYYY-MM-DD date at 00:00 UTC. */
export function dateInputToSimDays(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return (Date.UTC(year, month - 1, day) - EPOCH_MS) / MS_PER_DAY;
}
```

The reverse direction (current `simDays` → the input's `value`) reuses `formatSimDate`, since the native date input's value format is the same `YYYY-MM-DD`. No second formatter is added.

The function assumes a well-formed `YYYY-MM-DD` string; callers guard against empty/invalid input (see `DateDisplay`).

### `src/sim/clock.ts` (modify)

Add a setter to `SimClock`:

```ts
setSimDays(days: number): void {
  this.simDays = days;
}
```

### `src/hooks/useSimulation.ts` (modify)

Add `seekToDate` and include it in the returned object:

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

It sets the clock's `simDays`, pauses both the clock and the React `paused` state (so the toolbar button shows "Resume"), and refreshes the displayed date immediately rather than waiting for the next periodic date-update frame. Because the clock is paused, `advance()` is a no-op and the seeked `simDays` persists; the render loop draws the new positions on the next frame.

### `src/ui/DateDisplay.tsx` (modify)

New props and behavior:

```ts
interface DateDisplayProps {
  date: string;                          // current YYYY-MM-DD (button label and input value)
  onSelectDate: (value: string) => void; // called with the picked YYYY-MM-DD
}
```

- Internal `editing` boolean state (default `false`).
- Not editing: render a `<button className="date-display">` showing `date`; `onClick` sets `editing = true`.
- Editing: render `<input type="date" className="date-input" defaultValue={date} autoFocus>`.
  - On mount/focus, call `input.showPicker()` if it exists, wrapped in a guard/try-catch (jsdom and older browsers lack it; it can throw without user activation).
  - `onChange`: if the value is non-empty, call `onSelectDate(value)` and set `editing = false`. Empty value is ignored (no call).
  - `onBlur` and `onKeyDown` Escape: set `editing = false` without calling `onSelectDate` (revert).

The interactive button carries an accessible name (e.g. `aria-label="Simulation date, click to change"`). The previous continuous `aria-live` announcements are dropped: while running, the date changed several times per second, which is announcement spam; the value remains readable on demand from the button.

### `src/App.tsx` (modify)

Destructure `seekToDate` from the hook and wire the conversion at the boundary:

```tsx
onSelectDate={(value) => seekToDate(dateInputToSimDays(value))}
```

`DateDisplay` stays pure UI (emits the string); the string→`simDays` conversion uses the pure `dateInputToSimDays`; the hook's API stays in `simDays` terms.

### `src/styles.css` (modify)

- `.date-display` as a `<button>`: same colors/typography/position as today, plus `cursor: pointer`, a hover state, and a reset of default button borders/background so it looks identical to the current text.
- `.date-input`: match the dark UI (same font, padding, background, border-radius) and set `color-scheme: dark` so the native calendar icon and popup render in dark theme.

## Data Flow

1. User clicks/taps the date button → `editing = true` → input renders, focuses, opens the native picker.
2. User picks a date → input `onChange` fires with `value` (`YYYY-MM-DD`).
3. `onSelectDate(value)` → App → `seekToDate(dateInputToSimDays(value))`.
4. `seekToDate` sets `clock.simDays`, pauses clock + React state, updates the displayed date.
5. Re-render: date button shows the new date, the toolbar shows "Resume"; the canvas draws the new positions on the next animation frame.

## Error Handling

- Empty/cleared input value: `DateDisplay` does not call `onSelectDate`; no seek occurs.
- `dateInputToSimDays` assumes a valid `YYYY-MM-DD`; it is only ever called with the input's committed non-empty value.
- `showPicker` absence or failure is swallowed by the guard; the input still works via normal focus/click.

## Testing

- `src/sim/formatDate.test.ts`: `dateInputToSimDays` — epoch (`2026-01-01` → 0), next day (`2026-01-02` → 1), a leap date (`2028-02-29`), and a round-trip `formatSimDate(dateInputToSimDays(v)) === v`.
- `src/sim/clock.test.ts`: `setSimDays` assigns the value.
- `src/ui/DateDisplay.test.tsx`: clicking the button reveals the date input; a `change` event with a value calls `onSelectDate` with that value and hides the input; Escape and blur revert to the button without calling `onSelectDate`; an empty-value `change` does not call `onSelectDate`.
- `seekToDate` (clock set + pause + date refresh) is covered by the `setSimDays` and `dateInputToSimDays` unit tests plus a manual/headless verification, because the hook's return value is not observable in the existing test harness (the pointer-input test renders a wrapper that ignores it).

## Out of Scope

- Time-of-day selection (date-only per decision).
- Date range limits / validation beyond well-formedness.
- Auto-resume after seeking.
