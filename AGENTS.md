# Solar System Simulation — Agent Notes

## Project Overview

React + TypeScript + Vite canvas application that visualizes a stylized solar system: planet orbits, moons, an asteroid belt, and simulation-speed controls.

## Quick Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests (Vitest)
npm test

# Type check + production build
npm run build
```

## Directory Structure

- `src/sim/` — orbital math, planet/moon data, layout calculations, simulation clock.
- `src/render/` — Canvas 2D rendering logic (`drawScene`, `Camera`, `visibility`, `asteroidBelt`).
- `src/hooks/` — React hooks that wire simulation + rendering into the UI.
- `src/ui/` — Toolbar and DateDisplay React components.
- `docs/superpowers/specs/` — approved design specs.
- `docs/superpowers/plans/` — implementation plans.

## Conventions

- Keep `src/sim/` pure: it computes positions only; it knows nothing about the Canvas API or screen state.
- Put visual concerns (opacity, colors, labels, belts) in `src/render/`.
- Follow existing test style: mock `CanvasRenderingContext2D` for render tests, use `toBeCloseTo` for floating-point assertions.
- Commit each task independently. Do not rewrite public history.
- If a task needs design changes, pause and update the spec before coding.
