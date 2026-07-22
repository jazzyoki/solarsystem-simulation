# Mobile Portrait Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On screens ≤ 640px wide, collapse the toolbar's speed and scale-mode button groups into native `<select>` dropdowns and move the date + Today controls to the bottom-right, so the portrait-phone UI fits one row and no elements overlap — while leaving the desktop layout byte-for-byte unchanged.

**Architecture:** `Toolbar` renders BOTH the existing button groups and a `<select>` for speed and one for mode; CSS shows exactly one form per breakpoint. All four forms call the same existing handlers, so no component logic changes. The date repositioning and dropdown swap are driven entirely by a single `@media (max-width: 640px)` block. No JS viewport detection.

**Tech Stack:** React 18 + TypeScript, plain CSS (`src/styles.css`), Vitest + @testing-library/react.

## Global Constraints

- Single breakpoint: `@media (max-width: 640px)`.
- Desktop (wider) layout must be unchanged — verify no default (non-media) rule alters current appearance. The mobile `<select>`s are `display: none` by default; the button-group wrappers use `display: contents` so the buttons remain direct flex participants exactly as today.
- No new controls, icons, hamburger menu, or JS/matchMedia viewport detection.
- No behavior change: speed/mode/pause/comets handlers and the simulation are untouched.
- Tests: `@testing-library/react` + `vitest`, matching `src/ui/Toolbar.test.tsx`. Both button and dropdown forms coexist in the DOM (jsdom applies no external CSS), so existing button tests must remain green.
- Existing toolbar colors: bg `#1b2340`, border `#34406e`, text `#cfd8ff`, radius `4px`, `font: 13px system-ui, sans-serif`.
- Commit each task independently; run `npm test` before committing.

---

### Task 1: Toolbar speed & mode dropdowns (mobile forms + base CSS)

Add a native `<select>` for speed and one for mode alongside the existing button groups, wrapped so CSS can toggle each form. Base CSS hides the selects and keeps the button groups as flex participants, so **desktop is unchanged**. The media query that actually swaps them on mobile is Task 2 — after this task, desktop looks identical and the selects are present-but-hidden.

**Files:**
- Modify: `src/ui/Toolbar.tsx`
- Modify: `src/ui/Toolbar.test.tsx`
- Modify: `src/styles.css`
- Test: `src/ui/Toolbar.test.tsx`

**Interfaces:**
- Consumes: existing `ToolbarProps` (`multiplier`, `mode`, `onSelectSpeed`, `onSelectMode`, …) — unchanged.
- Produces: two `<select>` elements with accessible names `"Speed"` and `"Scale mode"`, and wrapper classes `.speed-buttons` / `.mode-buttons` around the existing button groups. No prop changes.

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/Toolbar.test.tsx` inside the `describe('Toolbar', …)` block:

```tsx
  it('renders a speed dropdown reflecting the multiplier and fires onSelectSpeed on change', () => {
    const props = renderToolbar({ multiplier: 100 });
    const select = screen.getByRole('combobox', { name: 'Speed' }) as HTMLSelectElement;
    expect(select.value).toBe('100');
    expect(select.querySelectorAll('option')).toHaveLength(5);
    fireEvent.change(select, { target: { value: '0.5' } });
    expect(props.onSelectSpeed).toHaveBeenCalledWith(0.5);
  });

  it('renders a mode dropdown reflecting the mode and fires onSelectMode on change', () => {
    const props = renderToolbar({ mode: 'toScale' });
    const select = screen.getByRole('combobox', { name: 'Scale mode' }) as HTMLSelectElement;
    expect(select.value).toBe('toScale');
    expect(select.querySelectorAll('option')).toHaveLength(2);
    fireEvent.change(select, { target: { value: 'schematic' } });
    expect(props.onSelectMode).toHaveBeenCalledWith('schematic');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Toolbar`
Expected: FAIL — no `combobox` with name "Speed"/"Scale mode" exists yet.

- [ ] **Step 3: Add the dropdowns and wrappers in `Toolbar.tsx`**

Replace the `return (...)` body of the `Toolbar` component (lines 31–69) with:

```tsx
  return (
    <div className="toolbar">
      <div className="speed-buttons">
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={speed === multiplier ? 'active' : ''}
            aria-pressed={speed === multiplier}
            onClick={() => onSelectSpeed(speed)}
          >
            {speed}x
          </button>
        ))}
      </div>
      <select
        className="speed-select"
        aria-label="Speed"
        value={multiplier}
        onChange={(e) => onSelectSpeed(Number(e.target.value) as SpeedMultiplier)}
      >
        {SPEEDS.map((speed) => (
          <option key={speed} value={speed}>
            {speed}x
          </option>
        ))}
      </select>
      <button type="button" aria-pressed={paused} onClick={onTogglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <span className="toolbar-separator" aria-hidden="true" />
      <div className="mode-buttons">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            className={m.value === mode ? 'active' : ''}
            aria-pressed={m.value === mode}
            onClick={() => onSelectMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <select
        className="mode-select"
        aria-label="Scale mode"
        value={mode}
        onChange={(e) => onSelectMode(e.target.value as ScaleMode)}
      >
        {MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <span className="toolbar-separator" aria-hidden="true" />
      <button
        type="button"
        className={cometsEnabled ? 'active' : ''}
        aria-pressed={cometsEnabled}
        onClick={onToggleComets}
      >
        Comets
      </button>
    </div>
  );
```

(`SpeedMultiplier` and `ScaleMode` are already imported at the top of the file.)

- [ ] **Step 4: Add base CSS so desktop is unchanged and selects are hidden**

Append to `src/styles.css` (after the existing `.toolbar-separator` rule, or anywhere in the top-level rules — NOT inside a media query):

```css
/* Button-group wrappers generate no box, so the buttons stay direct flex
   participants of .toolbar — desktop layout is identical to before. */
.speed-buttons,
.mode-buttons {
  display: contents;
}

/* Mobile-only dropdowns: hidden by default; the media query reveals them. */
.speed-select,
.mode-select {
  display: none;
  background: #1b2340;
  color: #cfd8ff;
  border: 1px solid #34406e;
  border-radius: 4px;
  padding: 6px 10px;
  font: 13px system-ui, sans-serif;
  cursor: pointer;
  color-scheme: dark;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- Toolbar`
Expected: PASS — the two new dropdown tests plus all existing button tests (buttons still render; jsdom applies no external CSS so both forms are present).

- [ ] **Step 6: Commit**

```bash
git add src/ui/Toolbar.tsx src/ui/Toolbar.test.tsx src/styles.css
git commit -m "feat: add mobile speed/mode dropdowns to the toolbar (hidden on desktop)"
```

---

### Task 2: Responsive layout (media query)

Add the single `@media (max-width: 640px)` block that swaps button groups for dropdowns, moves the date controls to the bottom-right, and caps the comet picker height. Pure CSS; no automated layout test is possible in jsdom, so this task ends with a documented manual verification.

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: the classes `.speed-buttons`, `.mode-buttons`, `.speed-select`, `.mode-select` (Task 1); existing `.toolbar-separator`, `.date-controls`, `.comet-picker`.
- Produces: mobile layout. No JS/exported surface.

- [ ] **Step 1: Add the media query**

Append to the end of `src/styles.css`:

```css
@media (max-width: 640px) {
  /* Collapse the button groups (and their separators) in favor of dropdowns. */
  .speed-buttons,
  .mode-buttons,
  .toolbar-separator {
    display: none;
  }

  .speed-select,
  .mode-select {
    display: inline-block;
  }

  /* Move the date + Today controls out of the toolbar's way, to the
     bottom-right, clearing any home-indicator / gesture inset. */
  .date-controls {
    top: auto;
    bottom: calc(12px + env(safe-area-inset-bottom));
    right: 12px;
  }

  /* Keep a long comet list from running under the bottom date controls. */
  .comet-picker {
    max-height: 50vh;
  }
}
```

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: PASS (tsc + vite build succeed; CSS is bundled).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — no test regressions (this task is CSS-only).

- [ ] **Step 4: Manual verification (documented — no jsdom layout engine)**

Start the dev server (`npm run dev`) and, in the browser at a ≤640px-wide viewport (or device-emulation portrait phone), confirm:
- The toolbar is a single row: `[Speed ▾] [Mode ▾] [Pause] [Comets]` — no wrap, no horizontal overflow.
- The speed dropdown shows `0.5x … 1000x` and reflects/sets the speed; the mode dropdown shows Schematic / To Scale and reflects/sets the mode.
- The date + Today controls sit at the bottom-right and do not overlap the toolbar; tapping the date opens the native picker.
- With Comets on, the picker does not overlap the toolbar above or the date controls below.
- Widen the window past 640px: the desktop layout returns exactly as before (buttons back, date top-right).

Record the result in the task report. If any check fails, adjust the media-query values and re-verify before reporting DONE.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "feat: responsive mobile layout — dropdowns and bottom-right date under 640px"
```

---

## Self-Review

**Spec coverage:**
- ≤640px breakpoint → Global Constraints + Task 2. ✓
- Speed → dropdown; Mode → dropdown → Task 1 (markup) + Task 2 (swap). ✓
- Pause + Comets stay buttons → Task 1 (left as buttons). ✓
- Date + Today → bottom-right with safe-area → Task 2. ✓
- Render-both + CSS toggle (no JS detection) → Task 1 (both forms) + Task 2 (media query). ✓
- Desktop unchanged → Task 1 base CSS (`display:contents` wrappers, selects `display:none`); verified in Task 2 Step 4. ✓
- Native `<select>`, dark styling → Task 1 CSS. ✓
- Comet picker max-height on mobile → Task 2. ✓
- Separators hidden on mobile → Task 2. ✓
- Testing: `Toolbar` select tests + existing button tests green (Task 1); layout by manual inspection stated honestly (Task 2 Step 4). ✓

**Placeholder scan:** No TBD/TODO. All code (TSX, CSS, tests) is provided in full. The one tunable (`max-height: 50vh`) has a concrete starting value.

**Type consistency:** `onSelectSpeed(Number(...) as SpeedMultiplier)` and `onSelectMode(value as ScaleMode)` match the existing `ToolbarProps` handler signatures. Class names `.speed-buttons`/`.mode-buttons`/`.speed-select`/`.mode-select` and the accessible names `"Speed"`/`"Scale mode"` are used identically in Tasks 1 and 2 and their tests.
