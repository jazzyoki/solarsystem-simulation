# Additional Time Scales — Design Spec

- **Date:** 2026-07-20
- **Status:** Approved design, ready for implementation planning

## Summary

Add two more speed options to the existing solar system simulation: **0.5x**
and **10x**. The original **1x / 100x / 1000x** speeds remain.

## Requirements

1. Speed buttons, in order: `0.5x`, `1x`, `10x`, `100x`, `1000x`.
2. Time-model unchanged: `1x = 1 simulated Earth day per real second`.
3. `0.5x = 0.5 simulated days per real second` (12 sim hours / sec).
4. `10x = 10 simulated days per real second`.
5. The `SpeedMultiplier` type changes from `1 | 100 | 1000` to
   `0.5 | 1 | 10 | 100 | 1000`.
6. All existing consumers of `SpeedMultiplier` (`Toolbar`, `useSimulation`,
   `SimClock`) continue to work with no API change beyond the type.
7. Update existing tests:
   - `clock.test.ts`: multiplier behavior covers 0.5x and 10x as well as the
     existing 1x/100x/1000x; clamp tests unchanged.
   - `Toolbar.test.tsx`: buttons render for all five speeds; active state and
     callbacks work for 0.5x and 10x.

## Non-Goals

- Do not add configurable/custom speed input.
- Do not change the underlying time-model semantics.
- Do not add new UI layout beyond the extra two buttons.

## Architecture

A minimal, type-safe change across three files:

- `src/sim/clock.ts` — widen `SpeedMultiplier` union.
- `src/ui/Toolbar.tsx` — replace `SPEEDS` constant with `[0.5, 1, 10, 100, 1000]`;
  display label still generated as `${speed}x`, producing `0.5x` naturally.
- `src/sim/clock.test.ts` and `src/ui/Toolbar.test.tsx` — adjust/add cases.

No `useSimulation`, `App`, or other sim modules need changes because they
already pass `SpeedMultiplier` through unchanged.

## Testing strategy

- TDD with Vitest.
- Clock tests: assert 0.5x and 10x advance correctly for frame dt below the
  0.25 s clamp.
- Toolbar tests: assert all five buttons render, selecting 0.5x or 10x invokes
  the callback with the correct value, and `aria-pressed` reflects the active
  speed.

## Acceptance criteria

- All five speed buttons appear in the toolbar in the order specified.
- Clicking each sets the simulation to the corresponding rate.
- `npm test` passes with updated tests.
- `npm run build` remains clean.
