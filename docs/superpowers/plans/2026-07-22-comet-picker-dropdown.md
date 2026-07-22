# Comet Picker Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the comet picker's always-open list of 15 comets with a native `<select>` dropdown that collapses after selection and shows the chosen comet in its closed control — mirroring the mobile speed selector and freeing screen space.

**Architecture:** Presentational change to `CometPicker` only. The `<select>` calls the same `onSelect`/`onJumpToPerihelion` handlers the list buttons did, so `App.tsx` and `useSimulation` are untouched — focus/framing/deselect behavior is preserved. CSS is simplified from a scrollable panel to a compact row.

**Tech Stack:** React 18 + TypeScript, plain CSS, Vitest + @testing-library/react.

## Global Constraints

- No changes to `App.tsx` or `src/hooks/useSimulation.ts` — `CometPickerProps` is unchanged (`comets`, `selected`, `onSelect`, `onJumpToPerihelion`).
- Native `<select>` (consistent with the speed/mode selectors); no custom dropdown.
- Placeholder option `Select a comet…` has empty value and is the deselect path → `onSelect(null)`.
- Preserve ISON's `— historical` label suffix for a comet whose `note === 'historical'`.
- Toolbar control colors: bg `#1b2340`, border `#34406e`, text `#cfd8ff`, radius `4px`, `font: 13px system-ui, sans-serif`, `color-scheme: dark` on the select.
- Tests: `@testing-library/react` + `vitest`, matching the existing `src/ui/CometPicker.test.tsx` style.
- Commit the task independently; run `npm test` and `npm run build` before committing.

---

### Task 1: Comet picker as a collapsing dropdown

Rewrite `CometPicker` to render a native `<select>` plus the existing Jump-to-perihelion button, replace its tests for the select, and simplify the CSS.

**Files:**
- Modify: `src/ui/CometPicker.tsx`
- Modify (replace test bodies): `src/ui/CometPicker.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: unchanged `CometPickerProps`.
- Produces: a `<select className="comet-select" aria-label="Comet">` with a placeholder option and one option per comet; the `.perihelion-button` when `selected` is truthy. No prop or handler-signature changes.

- [ ] **Step 1: Replace the test file with select-based tests (failing)**

Replace the entire contents of `src/ui/CometPicker.test.tsx` with:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CometPicker } from './CometPicker';

const comets = [
  { name: 'Halley', designation: '1P' },
  { name: 'Encke', designation: '2P' },
];

describe('CometPicker', () => {
  it('renders a dropdown with a placeholder plus every comet', () => {
    render(<CometPicker comets={comets} selected={null} onSelect={vi.fn()} onJumpToPerihelion={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Comet' }) as HTMLSelectElement;
    expect(select.querySelectorAll('option')).toHaveLength(comets.length + 1);
    expect(screen.getByRole('option', { name: /Halley/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Encke/ })).toBeTruthy();
  });

  it('reflects the selected comet as the dropdown value', () => {
    render(<CometPicker comets={comets} selected={'Halley'} onSelect={vi.fn()} onJumpToPerihelion={vi.fn()} />);
    expect((screen.getByRole('combobox', { name: 'Comet' }) as HTMLSelectElement).value).toBe('Halley');
  });

  it('calls onSelect with the comet name when one is chosen', () => {
    const onSelect = vi.fn();
    render(<CometPicker comets={comets} selected={null} onSelect={onSelect} onJumpToPerihelion={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Comet' }), { target: { value: 'Halley' } });
    expect(onSelect).toHaveBeenCalledWith('Halley');
  });

  it('calls onSelect(null) when the placeholder is chosen', () => {
    const onSelect = vi.fn();
    render(<CometPicker comets={comets} selected={'Halley'} onSelect={onSelect} onJumpToPerihelion={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Comet' }), { target: { value: '' } });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('flags a comet with a historical note in its option label', () => {
    const flagged = [
      { name: 'ISON', designation: 'C/2012 S1', note: 'historical' },
      { name: 'Halley', designation: '1P' },
    ];
    render(<CometPicker comets={flagged} selected={null} onSelect={vi.fn()} onJumpToPerihelion={vi.fn()} />);
    expect(screen.getByRole('option', { name: /ISON/ }).textContent).toContain('historical');
    expect(screen.getByRole('option', { name: /Halley/ }).textContent).not.toContain('historical');
  });

  it('shows the jump-to-perihelion button only when a comet is selected', () => {
    const onJump = vi.fn();
    const { rerender } = render(
      <CometPicker comets={comets} selected={null} onSelect={vi.fn()} onJumpToPerihelion={onJump} />,
    );
    expect(screen.queryByRole('button', { name: /perihelion/i })).toBeNull();
    rerender(<CometPicker comets={comets} selected={'Halley'} onSelect={vi.fn()} onJumpToPerihelion={onJump} />);
    fireEvent.click(screen.getByRole('button', { name: /perihelion/i }));
    expect(onJump).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- CometPicker`
Expected: FAIL — the current component renders list `<button>`s, so there is no `combobox` named "Comet".

- [ ] **Step 3: Rewrite `CometPicker.tsx` as a select**

Replace the entire contents of `src/ui/CometPicker.tsx` with:

```tsx
interface CometOption {
  name: string;
  designation: string;
  note?: string;
}

interface CometPickerProps {
  comets: CometOption[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  onJumpToPerihelion: () => void;
}

function optionLabel(comet: CometOption): string {
  const base = `${comet.name} (${comet.designation})`;
  return comet.note === 'historical' ? `${base} — historical` : base;
}

export function CometPicker({ comets, selected, onSelect, onJumpToPerihelion }: CometPickerProps) {
  return (
    <div className="comet-picker">
      <select
        className="comet-select"
        aria-label="Comet"
        value={selected ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">Select a comet…</option>
        {comets.map((comet) => (
          <option key={comet.name} value={comet.name}>
            {optionLabel(comet)}
          </option>
        ))}
      </select>
      {selected && (
        <button type="button" className="perihelion-button" onClick={onJumpToPerihelion}>
          Jump to perihelion
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Simplify the comet CSS**

In `src/styles.css`, replace the block from `.comet-picker {` through the `.perihelion-button { ... }` rule (currently lines 133–181: the `.comet-picker`, `.comet-list`, `.comet-picker button`, `.comet-picker button:hover`, `.comet-picker button.active`, and `.perihelion-button` rules) with exactly:

```css
.comet-picker {
  position: absolute;
  top: 52px;
  left: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.comet-select {
  background: #1b2340;
  color: #cfd8ff;
  border: 1px solid #34406e;
  border-radius: 4px;
  padding: 6px 10px;
  font: 13px system-ui, sans-serif;
  cursor: pointer;
  color-scheme: dark;
}

.perihelion-button {
  background: #1b2340;
  color: #cfd8ff;
  border: 1px solid #34406e;
  border-radius: 4px;
  padding: 6px 10px;
  font: 13px system-ui, sans-serif;
  cursor: pointer;
}

.perihelion-button:hover {
  background: #26305a;
}
```

- [ ] **Step 5: Remove the now-unneeded mobile comet-picker override**

In `src/styles.css`, inside the `@media (max-width: 640px)` block, delete the trailing rule (and its comment):

```css
  /* Keep a long comet list from running under the bottom date controls. */
  .comet-picker {
    max-height: 50vh;
  }
```

The media query keeps only the speed/mode-dropdown and `.date-controls` rules. (The picker no longer needs a height cap — it's a native dropdown that manages its own scrolling.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- CometPicker`
Expected: PASS — all six select-based tests.

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build`
Expected: full suite PASS; `tsc --noEmit` + vite build succeed.

- [ ] **Step 8: Commit**

```bash
git add src/ui/CometPicker.tsx src/ui/CometPicker.test.tsx src/styles.css
git commit -m "feat: collapse the comet picker into a dropdown"
```

---

## Self-Review

**Spec coverage:**
- Comet picker becomes a collapsing native `<select>` → Step 3. ✓
- Placeholder `Select a comet…` = deselect (`onSelect(null)`) → Step 3 (`e.target.value || null`), Step 1 test. ✓
- Applies at all sizes; removes the mobile height override → Step 5. ✓
- No `App.tsx`/`useSimulation` change → Global Constraints; props unchanged in Step 3. ✓
- ISON `— historical` preserved → Step 3 (`optionLabel`), Step 1 test. ✓
- Jump-to-perihelion unchanged, shown only when selected → Step 3, Step 1 test. ✓
- CSS simplified to a compact row, `.comet-list`/list-button rules removed → Step 4. ✓
- `.comet-select` styled to match controls → Step 4. ✓
- Tests rewritten for the select (options count, value reflects selected, change→onSelect(name), change-to-placeholder→onSelect(null), historical label, jump button visibility) → Step 1. ✓

**Placeholder scan:** No TBD/TODO. All TSX, CSS, and test code is provided in full. ("Select a comet…" is a UI placeholder string, not an unfinished spec item.)

**Type consistency:** `CometPickerProps` and `CometOption` are unchanged from the current file. `onSelect(e.target.value || null)` matches the `(name: string | null) => void` signature. The `aria-label="Comet"` and class names `.comet-select` / `.perihelion-button` are used identically in the component (Step 3), CSS (Step 4), and tests (Step 1).
