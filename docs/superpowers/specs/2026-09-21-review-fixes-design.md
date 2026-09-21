# Code review corrections

The user authorized fixing the eight findings reviewed on `81691ad` in an
isolated worktree. This spec records the behavior decisions before implementation.

## Scope and approach

Make focused corrections within the existing simulation, rendering and hook
boundaries. A wholesale controller rewrite and static-path caching are deferred:
neither is required to correct the demonstrated failures.

1. Safeguard the hyperbolic Kepler solve with a bracket and Newton/bisection
   fallback. Preserve odd symmetry and perihelion zero; test the actual ISON
   eccentricity and propagated distances in both 2D and 3D.
2. Trigger deployment on `master`, the repository's actual integration branch,
   and update the deployment documentation and configuration test accordingly.
3. Skip pinch zoom when either touch span is zero or non-finite. Reject camera
   zoom operations that would produce a non-positive or non-finite transform.
4. Frame a bounding sphere using the smaller horizontal/vertical camera
   half-angle, with margin. Reuse a testable helper under `src/render3d/`.
   Apply the initial frame after the viewport aspect is known; explicit reset
   uses current aspect. Keep controls' distance limit large enough for that frame.
5. Explicitly entering Schematic clears the comet selection and pending comet
   frame while leaving the Comets picker available. No comet path/body renders
   in Schematic. Selecting a comet still switches to To Scale.
6. On 2D resize preserve the world point at the viewport center and zoom level;
   initial sizing still fits the overview. Preserve the last nonzero viewport
   dimensions across a temporary zero-size container.
7. Selecting Sun issues an explicit overview reset even when already unfocused.
   It clears follow state; subsequent frames must not restore the old target.
8. Parse historical years through explicit full-year assignment and format
   positive years with at least four digits. Preserve existing UTC day semantics.

## Invariants and verification

- Keep `src/sim/` pure and Three.js imports under `src/render3d/`.
- Preserve epoch alignment, orbital data, clock state on mode switches, and
  seek-pauses behavior.
- Add regression tests that fail on the old implementation, including real RAF
  execution for hook transitions and actual Three.js camera projection checks.
- Run focused tests per fix, then the complete suite and production build.
- Commit each issue independently. Leave the fix branch available for review;
  merging, pushing and deploying are separate actions.
