# Comet Picker Dropdown Design

## Summary

Replace the comet picker's always-open list of 15 comets with a native
`<select>` dropdown that collapses after a comet is chosen and shows the
selected comet in its closed control — mirroring the mobile speed selector.
This frees the screen space the open list currently occupies (especially on
narrow portrait phones, where the list fills a tall left panel).

The change is confined to the picker's presentation. The "Jump to perihelion"
button, all handler wiring, and the focus/framing behavior in the hook are
unchanged.

## Goals

- The comet picker is a collapsed dropdown by default; opening it lists the 15
  comets; picking one collapses it and shows that comet in the closed control.
- A placeholder option (`Select a comet…`) represents the no-selection state and
  is also the deselect path.
- Applies at all screen sizes (no desktop list to preserve; one consistent
  form).
- No change to selection behavior: choosing a comet still auto-switches to To
  Scale, auto-frames the orbit, and deselecting restores planet-scale framing —
  all via the existing hook, unchanged.

## Non-Goals

- No change to `App.tsx` or `useSimulation` (props and handlers are unchanged).
- No change to how the toolbar "Comets" toggle reveals/hides the picker.
- No new controls beyond the placeholder option.
- No custom-styled dropdown; use the native `<select>` (consistent with the
  speed/mode selectors).

## Component: `CometPicker` (`src/ui/CometPicker.tsx`)

Props are **unchanged**:

```ts
interface CometOption { name: string; designation: string; note?: string; }
interface CometPickerProps {
  comets: CometOption[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  onJumpToPerihelion: () => void;
}
```

Render:

- A native `<select className="comet-select" aria-label="Comet">`:
  - `value={selected ?? ''}` (controlled).
  - `onChange={(e) => onSelect(e.target.value || null)}` — empty string
    (placeholder) maps to `null` (deselect); any other value is a comet name.
  - First child: `<option value="">Select a comet…</option>` (placeholder /
    none).
  - One `<option key={c.name} value={c.name}>` per comet, label
    `` `${c.name} (${c.designation})` `` with `' — historical'` appended when
    `c.note === 'historical'` (preserves ISON's flag).
- The **Jump to perihelion** button is rendered only when `selected` is truthy,
  beside the select, unchanged in behavior:
  `<button type="button" className="perihelion-button" onClick={onJumpToPerihelion}>Jump to perihelion</button>`.

The `.comet-list` `<ul>` and its per-comet `<button>`s are removed.

## Styles (`src/styles.css`)

- Add `.comet-select` styled to match the toolbar controls / other selects
  (background `#1b2340`, border `#34406e`, text `#cfd8ff`, radius `4px`,
  `font: 13px system-ui, sans-serif`, `color-scheme: dark`).
- Simplify `.comet-picker` to a compact row containing the select and the
  optional button: keep its absolute position (`top: 52px; left: 12px`), use
  `display: flex; gap: 6px; align-items: center` (allow wrapping so the button
  can drop below the select on very narrow widths). Remove `max-height: 60vh`
  and `overflow-y: auto` — a native dropdown manages its own scrolling.
- Remove the `.comet-list` and `.comet-picker button` (list-item button) rules
  that no longer apply. Keep `.perihelion-button`.
- Remove the mobile override `@media (max-width: 640px) { .comet-picker {
  max-height: 50vh; } }` — no longer needed once the list is a dropdown.

## Behavior (unchanged wiring)

- Opening the dropdown and choosing a comet fires `onSelect(name)` — the same
  call the old list buttons made — so the hook still switches to To Scale,
  frames the orbit, and draws the path/body.
- Choosing `Select a comet…` fires `onSelect(null)`, the existing deselect path
  (restores planet-scale framing).
- Selecting collapses the dropdown natively; the closed control shows the chosen
  comet.

## Testing (`src/ui/CometPicker.test.tsx`)

Rewritten for the `<select>` (jsdom + @testing-library/react, existing style):

- Renders a combobox (`aria-label="Comet"`) with the placeholder plus one option
  per comet (option count = comets + 1); the value reflects `selected`.
- `fireEvent.change` to a comet's value fires `onSelect` with that comet name.
- `fireEvent.change` to the placeholder (empty value) fires `onSelect(null)`.
- The ISON-style option (a comet with `note: 'historical'`) renders a label
  containing `historical`; a comet without a note does not.
- The Jump-to-perihelion button is absent when `selected` is `null` and present
  when a comet is selected; clicking it fires `onJumpToPerihelion`.

## Risks & Mitigations

- **Deselect discoverability:** the placeholder doubles as "none". Its label
  `Select a comet…` communicates the empty state; choosing it clears the
  selection. Acceptable and matches common dropdown convention.
- **Native select look varies by OS:** intended and consistent with the existing
  speed/mode selectors; only the closed control's colors are matched to the
  toolbar.
