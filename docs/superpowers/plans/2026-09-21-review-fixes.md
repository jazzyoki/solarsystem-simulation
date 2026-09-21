# Review Fixes Implementation Plan

> Execute tasks with focused regression tests and independent review before completion.

**Goal:** Correct all eight reproduced review findings in `fix/review-findings`.

**Architecture:** Retain pure simulation and separate 2D/3D renderers. Extract
projection-based framing to a small tested 3D helper; retain the hook's public API.

**Tech Stack:** React, TypeScript, Vite, Three.js, Vitest.

## Global constraints

- Keep `src/sim/` pure and Three.js imports under `src/render3d/`.
- Preserve epoch alignment, orbital data, clock state on mode switches, and
  seek-pauses behavior.
- Commit each issue independently; no merge, push or deploy in this task.

## Tasks

Each task follows: write regression, run it and confirm the expected failure,
implement the specified correction, run the focused suite, review diff, commit.

- [x] Hyperbolic solve: `src/sim/hyperbolicOrbit.ts`, its test and
  `cometOrbit.test.ts`/`orbit3d.test.ts`. Assert the inverse relation for
  `e=1.0000051` and signed H near 0.158; assert ISON radius ~30.816552 AU at
  simDays 263. Use a monotonic positive bracket, bounded Newton updates and
  midpoint fallback; restore input sign on return. Run `npm test -- src/sim`.
- [x] Deployment: `.github/workflows/deploy.yml`, `tests/deployment.test.mjs`,
  `README.md`. Change branch expectation/trigger from `main` to `master`.
  Run `npm test -- tests/deployment.test.mjs`.
- [x] Pinch/camera validity: `src/hooks/pointerInteraction.ts` and tests,
  `src/render/camera.ts` and tests. Reproduce coincident pointers followed by
  separation, require finite state and recovery; guard both spans and reject
  invalid candidate zoom transforms. Run both matching test files.
- [x] 3D framing: new `src/render3d/framing.ts` and test, integrate with
  `ThreeRenderer.ts`. Fit radius with `radius / sin(minHalfFov)` and margin,
  orient along existing `(0,-1.2,0.7)` direction. Test projected planet and
  comet paths at portrait/landscape aspects and ensure initial setSize frames
  using the real viewport. Run `npm test -- src/render3d`.
- [x] Schematic comet transition: `src/hooks/useSimulation.ts` and integration
  tests. Select Halley, run frame, switch Schematic, run frame; assert circle
  guides, null comet path and no comet body/selection. Clear pending selection
  commands and defensively exclude comet rendering in Schematic.
- [x] Resize: hook and integration tests. Resize 1200x800 to 390x844; assert
  the center world point and zoom survive. Test panned view and zero-size
  intermediate. Keep previous positive dimensions and pan by half size delta.
- [x] Sun selection: hook and integration tests. Enter 3D, pan, select Sun;
  request overview reset even if focusedBody was already null. Clear follow
  request before applying the reset. Assert repeated Sun selections reset too.
- [x] Historical dates: `src/sim/formatDate.ts` and tests. Roundtrip
  `0001-01-01`, `0099-01-01`, `0100-01-01`, `0999-01-01`; cover early leap
  dates. Set full year explicitly and pad positive years to four digits.

## Completion

- [x] Independent review of branch diff and all eight acceptance criteria.
- [x] `npm test` and `npm run build`; clean worktree and per-task commits.

Final verification: 31 test files / 276 tests passed; production build passed.
Independent review found no critical or important issues. The eight fixes are
committed separately (`d0a11bb` through `2394bee`); the original master checkout
remains at `81691ad`. Worktree retained for review, without merge or push.
