# Mobile Portrait Layout Design

## Summary

Fix the cramped, overlapping UI on narrow (portrait phone) screens. The top
toolbar currently packs ~10 controls into one flex row that overflows the
viewport and collides with the top-right date controls; the comet picker can
also overlap a wrapped toolbar.

On screens **≤ 640px wide**, reorganize:

- **Speed** selection and **scale-mode** selection each collapse into a native
  `<select>` dropdown, replacing their button groups.
- **Pause** and **Comets** remain single buttons.
- The **date + Today** controls move from the top-right to the **bottom-right**,
  clear of the toolbar.

Wider screens are **unchanged** — the entire redesign lives behind a single
`@media (max-width: 640px)` query. Behavior is identical everywhere; this is a
presentational change plus a small markup addition.

## Goals

- Top toolbar fits one row on a ~360px-wide portrait phone: `[Speed ▾]
  [Mode ▾] [Pause] [Comets]`.
- No UI element overflows the viewport or overlaps another in portrait.
- Desktop layout byte-for-byte unchanged.
- No change to any control's behavior or the simulation.

## Non-Goals

- No redesign of the desktop layout.
- No new controls, icons, or a hamburger/overflow menu.
- No JS-based viewport detection or resize listeners.
- No change to the comet picker's contents or interaction (only a mobile
  max-height touch-up).

## Breakpoint & Strategy

- **Single breakpoint:** `@media (max-width: 640px)`. Covers phones in portrait
  and narrow desktop windows; the trigger is viewport width, matching how the
  layout actually reflows.
- **Render-both, CSS-toggle:** `Toolbar` renders *both* the existing button
  groups *and* a `<select>` for speed and a `<select>` for mode. CSS shows only
  one form per breakpoint via `display`. Both forms call the same handlers
  (`onSelectSpeed`, `onSelectMode`), so no component logic changes and the
  hidden set is removed from the accessibility tree. This avoids any
  JS/matchMedia viewport detection.

## Components

### `Toolbar` (`src/ui/Toolbar.tsx`)

Markup additions (props unchanged: `multiplier`, `paused`, `mode`,
`cometsEnabled`, and the existing handlers):

- A **speed `<select>`** (`class="speed-select"`) with options `0.5, 1, 10,
  100, 1000` labeled `0.5×, 1×, 10×, 100×, 1000×`; `value={multiplier}`;
  `onChange` calls `onSelectSpeed(Number(value) as SpeedMultiplier)`. Rendered
  adjacent to the existing speed button group.
- A **mode `<select>`** (`class="mode-select"`) with options `schematic` /
  `toScale` labeled `Schematic` / `To Scale`; `value={mode}`; `onChange` calls
  `onSelectMode(value as ScaleMode)`. Rendered adjacent to the existing mode
  button group.
- Wrap the existing speed buttons in a container (`class="speed-buttons"`) and
  the existing mode buttons in `class="mode-buttons"` so CSS can hide each group
  as a unit.
- **Pause** and **Comets** buttons are unchanged and shared across breakpoints.

Flex order within `.toolbar`: speed group + speed-select, mode group +
mode-select, Pause, Comets. Because each `<select>` sits next to its button
group and only one of the pair is visible per breakpoint, the visual order is
correct at both sizes.

`<select>` styling matches the toolbar buttons (same background `#1b2340`,
border `#34406e`, text `#cfd8ff`, radius, padding, font) with
`color-scheme: dark` so the native dropdown renders dark.

### `DateDisplay` (`src/ui/DateDisplay.tsx`)

**No component change.** Repositioning is pure CSS on the existing
`.date-controls` container.

## Styles (`src/styles.css`)

1. **Default (desktop) rules:** hide the mobile dropdowns —
   `.speed-select, .mode-select { display: none; }`. Everything else stays as
   today.
2. **Inside `@media (max-width: 640px)`:**
   - Hide the desktop button groups: `.speed-buttons, .mode-buttons { display:
     none; }`.
   - Show the dropdowns: `.speed-select, .mode-select { display: inline-block; }`
     (styled to match buttons).
   - Move date controls to bottom-right:
     ```css
     .date-controls {
       top: auto;
       bottom: calc(12px + env(safe-area-inset-bottom));
       right: 12px;
     }
     ```
   - Cap the comet picker so a long list cannot run under the bottom date bar,
     e.g. `.comet-picker { max-height: 50vh; }` (tunable during implementation).

The `.toolbar-separator` elements between groups may be hidden on mobile
(`display: none`) since dropdowns don't need visual separators; this is a minor
polish decision left to implementation.

## Testing

- **`Toolbar` component tests** (jsdom, existing style):
  - The speed `<select>` renders with all five options and its value reflects
    `multiplier`; `change` fires `onSelectSpeed` with the numeric value.
  - The mode `<select>` renders both options and its value reflects `mode`;
    `change` fires `onSelectMode` with the string value.
  - The existing speed/mode/pause/comets **button** tests remain green (both
    forms coexist in the DOM; visibility is CSS-only).
- **Layout / media-query behavior** cannot be meaningfully unit-tested in jsdom
  (no layout engine). It is verified by manual inspection at a ≤640px viewport
  (dropdowns replace buttons, one-row toolbar, date at bottom-right, no
  overlap). This is stated explicitly rather than covered by a fake test.

## Risks & Mitigations

- **Duplicate controls in the DOM** (button + select for the same action):
  mitigated because exactly one is `display:none` per breakpoint, so only one is
  visible and only one is in the accessibility tree.
- **Native `<select>` look differs by OS:** acceptable and intended — the native
  picker is the most usable, accessible mobile control; we only match the closed
  control's colors to the toolbar.
- **Bottom controls under a home indicator:** mitigated with
  `env(safe-area-inset-bottom)`.
