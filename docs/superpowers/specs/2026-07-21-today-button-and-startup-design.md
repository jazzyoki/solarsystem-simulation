# Today Button and Startup-on-Today Design

**Status:** Approved

## Goal

Add a "Today" button next to the simulation date that jumps the view to today's date, and start the simulation on today's date at launch instead of the 2026-01-01 epoch, so the user immediately sees the current constellation.

## Background

The simulation is driven by `simDays`, a floating-point number of days since the epoch `2026-01-01 00:00 UTC`. `SimClock` starts at `simDays = 0`. `useSimulation` initializes its `date` state to `formatSimDate(0)` and runs the animation loop immediately (`paused = false`). `seekToDate(simDays)` (added with the date picker) sets the clock's `simDays`, pauses (clock + React state), and refreshes the displayed date. `DateDisplay` is a click-to-reveal control: a button showing the date that becomes a native `<input type="date">` while editing. `formatDate.ts` defines `EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0)` and `MS_PER_DAY = 86_400_000`, plus `formatSimDate(simDays)` and `dateInputToSimDays(value)`.

## Decisions

- **Start running from today.** On launch the clock initializes to today's date and keeps running (default play state). The first paint shows today's constellation.
- **Today button pauses.** Clicking "Today" reuses `seekToDate`, which pauses — consistent with how picking a date already behaves. (Chosen over keeping it running.)
- **UTC "today".** "Today" is the current UTC date at 00:00, matching the UTC date the display already shows, avoiding an off-by-one near local midnight.
- **Purity boundary.** The conversion from a timestamp to `simDays` is a pure function taking an explicit millisecond argument; the impure `Date.now()` read happens only at the React/hook boundary, never in `src/sim/`.

## Accuracy Note

"Today's constellation" means the model's positions, not a precise ephemeris: real Keplerian propagation from the 2026 epoch in To-Scale mode (reasonably accurate a few hundred days out), and stylized constant-rate circular motion in Schematic mode. This is inherent to the existing simulation; this feature only changes the starting date.

## Components and Interfaces

### `src/sim/formatDate.ts` (modify)

Add one pure function; keep the constants, `formatSimDate`, and `dateInputToSimDays` unchanged.

```ts
/** Integer day-offset from the epoch for the UTC date containing `nowMs` (00:00 UTC). */
export function timestampToSimDays(nowMs: number): number {
  return Math.floor((nowMs - EPOCH_MS) / MS_PER_DAY);
}
```

`Math.floor` yields the whole-day offset of the UTC calendar day containing the instant (works for pre-epoch instants too, e.g. an instant on 2025-12-31 → -1). It is consistent with `dateInputToSimDays(formatSimDate(n))` for any integer `n`.

### `src/hooks/useSimulation.ts` (modify)

- Initialize the `date` state to today's date:

```ts
const [date, setDate] = useState(() => formatSimDate(timestampToSimDays(Date.now())));
```

- Inside the effect, set the clock to today immediately after creating the simulation (leave `paused` at its default `false`, so it runs):

```ts
const sim = new Simulation();
sim.clock.setSimDays(timestampToSimDays(Date.now()));
simRef.current = sim;
```

- Add and return a `goToToday` action that seeks to today (which pauses, via `seekToDate`):

```ts
const goToToday = () => {
  seekToDate(timestampToSimDays(Date.now()));
};
```

`goToToday` is included in the hook's returned object alongside the existing values.

### `src/ui/DateDisplay.tsx` (modify)

Add an `onToday` prop and render the date control and a Today button together in a container. The date part still swaps between button and input while editing; the Today button is always visible.

```ts
interface DateDisplayProps {
  date: string;
  onSelectDate: (value: string) => void;
  onToday: () => void;
}
```

Structure (the `useEffect` focus/`showPicker` logic and the input's change/blur/escape handlers are unchanged from the current component):

```tsx
return (
  <div className="date-controls">
    {editing ? (
      <input
        ref={inputRef}
        type="date"
        className="date-input"
        defaultValue={date}
        aria-label="Simulation date"
        onChange={/* unchanged: ignore empty, else onSelectDate(value) + setEditing(false) */}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
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
```

### `src/App.tsx` (modify)

Destructure `goToToday` from the hook and pass it through:

```tsx
<DateDisplay
  date={date}
  onSelectDate={(value) => seekToDate(dateInputToSimDays(value))}
  onToday={goToToday}
/>
```

### `src/styles.css` (modify)

- Add `.date-controls`: absolute, top-right, `display: flex; gap; align-items` — this now owns the top-right positioning.
- Remove the `position/top/right` from `.date-display` and `.date-input` (the container positions them); keep their colors/typography/padding.
- Add `.today-button` styled like the toolbar buttons (dark background, border, hover), matching the existing control aesthetic and the date button's height.

## Data Flow

- **Startup:** `Date.now()` → `timestampToSimDays` → clock `simDays` and `date` state = today; loop runs from today.
- **Today click:** `onToday` → `goToToday` → `seekToDate(timestampToSimDays(Date.now()))` → clock set, paused (clock + React), date refreshed; re-render shows today and "Resume".

## Testing

- `src/sim/formatDate.test.ts`: `timestampToSimDays` — the epoch instant → 0; a later time on the same UTC day → 0; a known day (`Date.UTC(2026, 6, 21, 12, 0, 0)` → 201, i.e. 2026-07-21); a pre-epoch instant (`Date.UTC(2025, 11, 31, 12, 0, 0)` → -1).
- `src/ui/DateDisplay.test.tsx`: a "Today" button renders and calls `onToday` when clicked; existing tests updated to pass the new `onToday` prop (queries remain unambiguous because they filter by accessible name).
- `src/hooks/useSimulation.test.tsx`: with `Date.now` stubbed to a fixed instant, the hook's initial `date` equals that day's formatted date and `paused` is `false`; calling `goToToday()` sets the date to that day and sets `paused` to `true`.

## Out of Scope

- Local-timezone "today" (UTC only).
- Any change to orbital accuracy or the ephemeris model.
- Auto-updating "today" if the app is left open past midnight.
