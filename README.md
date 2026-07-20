# Solar System Simulation

A browser-based, stylized solar system visualization built with React, TypeScript, and Vite.

## Features

- Top-down view of the Sun, eight planets, and their moons.
- Smooth zoom and pan via mouse wheel and drag.
- Moons and moon labels fade in as you zoom in on a planet.
- Stylized asteroid belt between Mars and Jupiter.
- Adjustable simulation speed and pause/resume controls.

## Getting Started

```bash
npm install
npm run dev
```

Open the URL shown in your terminal (usually `http://localhost:5173`).

## Scripts

- `npm run dev` — start the Vite dev server
- `npm test` — run the Vitest test suite
- `npm run build` — type-check and build for production

## Implementation Notes

- The `Simulation` class advances simulated days and produces a snapshot of body positions.
- `Camera` maps world coordinates to screen coordinates.
- `drawScene` renders orbit guides, the asteroid belt, bodies, and labels.
- Moon visibility and labels use a screen-coverage threshold so detail appears only when planets are large enough to see clearly.
