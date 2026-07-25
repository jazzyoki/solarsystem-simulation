# Real-Time Speed Scales — Design Spec

- **Date:** 2026-07-25
- **Status:** Approved design, ready for implementation planning

## Summary

Redefine the simulation speed multiplier as **simulated seconds per real
second**, so `1×` means real time, `60×` means `1s = 1 min`, and `3600×` means
`1s = 1 h`. The old model — where `1×` meant one simulated *day* per real
second — read as "normal speed" but ran ~86,400 times faster than real time,
which confused users.

The speed dropdown lists nine human-readable scales from `1s = 20 min` to
`1s = 3 years`; the raw multiplier moves to the label beside it.

## Requirements

1. `SpeedMultiplier` means simulated seconds per real second.

2. The dropdown offers exactly these nine scales, in this order:

   | Dropdown label   | Multiplier   | Sim days / real sec |
   |------------------|-------------:|--------------------:|
   | `1s = 20 min`    |    1,200×    |              0.0139 |
   | `1s = 1 h`       |    3,600×    |              0.0417 |
   | `1s = 6 h`       |   21,600×    |                0.25 |
   | `1s = 12 h`      |   43,200×    |                 0.5 |
   | `1s = 24 h`      |   86,400×    |                   1 |
   | `1s = 1 month`   | 2,592,000×   |                  30 |
   | `1s = 3 months`  | 7,776,000×   |                  90 |
   | `1s = 1 year`    | 31,536,000×  |                 365 |
   | `1s = 3 years`   | 94,608,000×  |                1095 |

3. A month is **30 days** and a year is **365 days**. Round numbers were chosen
   over calendar-accurate lengths (30.4375 / 365.25) for legible multipliers.

4. The default on startup is `1s = 24 h` (86,400×) — identical motion to the
   old `1×` default, so nothing about the opening view changes.

5. The dropdown option text is the human-readable scale (`1s = 24 h`). The
   existing `.time-scale` span beside it shows the grouped multiplier
   (`86,400×`).

6. `SPEED_MULTIPLIERS` in `src/sim/clock.ts` is the single source of truth for
   both the union type and the dropdown contents. `Toolbar`'s local `SPEEDS`
   array is deleted — today the union and that array are separate lists that
   can silently drift apart.

7. No change to `simDays` as the internal clock unit, so `Simulation`,
   `formatDate`, the orbital math, and both renderers are untouched.

## Non-Goals

- No custom/free-form speed input.
- No persistence of the selected speed (there is none today).
- No toolbar layout or CSS changes — the label span already exists in place.
- No change to `MAX_FRAME_DT_SECONDS` or the tab-switch clamp.

## Architecture

### `src/sim/clock.ts`

```ts
export const SPEED_MULTIPLIERS = [
  1_200, 3_600, 21_600, 43_200, 86_400,
  2_592_000, 7_776_000, 31_536_000, 94_608_000,
] as const;

export type SpeedMultiplier = (typeof SPEED_MULTIPLIERS)[number];
export const DEFAULT_SPEED_MULTIPLIER: SpeedMultiplier = 86_400;
const SECONDS_PER_DAY = 86_400;
```

- `advance()` becomes `this.simDays += dt * this.multiplier / SECONDS_PER_DAY`.
- `multiplier` initializes to `DEFAULT_SPEED_MULTIPLIER`.
- The class doc-comment changes from "1x = 1 simulated Earth day per real
  second" to "the multiplier is simulated seconds per real second; 1× is real
  time".
- Clamping via `MAX_FRAME_DT_SECONDS` is unchanged.

### `src/ui/timeScale.ts`

One ordered table of `{ multiplier, label }` covering all nine entries,
exposing two formatters so the toolbar holds no time knowledge:

- `timeScaleLabel(m)` → `'1s = 24 h'` (dropdown option text)
- `speedMultiplierLabel(m)` → `'86,400×'` (side span; `toLocaleString('en-US')`
  for digit grouping)

### `src/ui/Toolbar.tsx`

- Deletes the local `SPEEDS` constant; maps `SPEED_MULTIPLIERS` instead.
- Option text becomes `timeScaleLabel(speed)`.
- The `.time-scale` span switches from `timeScaleLabel` to
  `speedMultiplierLabel`.
- No prop signature changes.

### `src/hooks/useSimulation.ts`

`useState<SpeedMultiplier>(1)` becomes
`useState<SpeedMultiplier>(DEFAULT_SPEED_MULTIPLIER)`. Nothing else —
`setMultiplier` already passes its argument straight through to the clock.

### Unchanged

`src/App.tsx`, `src/sim/simulation.ts`, `src/sim/formatDate.ts`, the orbital
math modules, and both renderers only ever see `simDays`.

## Error handling

None to add. The union type makes an invalid speed unrepresentable at compile
time, `SPEED_MULTIPLIERS` is the only source of dropdown options, and the
existing frame clamp already bounds the worst case: 0.25 s at 1095 days/s ≈ 274
sim days per frame, the same order as today's top speed (0.25 s × 1000 d/s =
250). Peak speed is effectively unchanged, so no new frame-stepping artifacts.

## Testing strategy

TDD with Vitest, in the three existing test files.

**`src/sim/clock.test.ts`**

- Default state asserts `multiplier === 86_400`.
- `advance(0.1)` at the default yields `0.1` sim days — day-per-second behavior
  preserved, now expressed as 86,400×.
- Proportionality across the range: `1_200×` over `0.1 s` → `0.0013889` days;
  `43_200×` → `0.05`; `94_608_000×` over `0.016 s` → `17.52` days.
- New test: the multiplier is simulated *seconds* per real second — at
  `1_200×`, `advance(0.1)` yields exactly 120 simulated seconds. This pins the
  contract the refactor exists to establish. (It is asserted at `1_200×` rather
  than at `1×` because `tsconfig.json` includes `src`, so `npm run build`
  type-checks the tests and `setMultiplier(1)` would not compile — `1` is not a
  member of the union.)
- Pause, clamp, and `setSimDays` tests unchanged.

**`src/ui/timeScale.test.ts`**

- All nine `timeScaleLabel` outputs, `'1s = 20 min'` through `'1s = 3 years'`.
- `speedMultiplierLabel` grouping: `86_400 → '86,400×'`,
  `94_608_000 → '94,608,000×'`.
- Table-integrity test: every entry in `SPEED_MULTIPLIERS` has a label and the
  label table has no extras — this is what stops the two lists drifting.

**`src/ui/Toolbar.test.tsx`**

- Option count `5 → 9`.
- Fixture multiplier and change-event values move to real members of the new
  set.
- The label test asserts the side span shows `'86,400×'` while the selected
  option reads `'1s = 24 h'`.

## Documentation

`README.md:11` ("Adjustable simulation speed and pause/resume controls") gains
a sentence naming the real-time-based model, since the old `1× = 1 day`
convention is precisely what confused users. `AGENTS.md` has no time-model
statement to correct.

## Acceptance criteria

- The speed dropdown shows the nine scales in the order above, defaulting to
  `1s = 24 h`.
- The span beside it shows the grouped multiplier for the current selection.
- Selecting a scale advances the clock at the corresponding sim-days rate.
- `SPEED_MULTIPLIERS` is the only list of speeds in the codebase.
- `npm test` passes.
- `npm run build` is clean.
