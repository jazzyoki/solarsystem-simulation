# Solar System Simulation

A browser-based, stylized solar system visualization built with React, TypeScript, and Vite — two 2D Canvas views plus a Three.js-powered 3D mode.

## Features

- Top-down 2D view of the Sun, eight planets (plus Pluto), and their moons.
- Smooth zoom and pan via mouse wheel and drag (with touch pointer support).
- Moons and moon labels fade in as you zoom in on a planet.
- Stylized asteroid belt between Mars and Jupiter.
- Adjustable simulation speed and pause/resume controls.
- **Schematic / To Scale / 3D mode switcher.** _Schematic_ places planets on evenly spaced circular orbits at constant angular speed; _To Scale_ uses real J2000 elliptical orbits (Sun at a focus), true semi-major-axis spacing, and Keplerian variable angular velocity (faster at perihelion). Both modes agree on each planet's longitude at the epoch, so switching never jumps a planet or resets the clock.
- **3D mode.** Renders the system with WebGL (Three.js): planets and comets on their real inclined orbits (J2000 inclination + ascending node — Pluto's 17° tilt is unmistakable), texture-mapped Sun, planets, and Moon with a Saturn ring, and an asteroid belt with realistic inclination scatter. Navigate with orbit-around-the-Sun controls: drag to rotate, wheel to zoom toward the cursor, right-drag to pan, double-click to re-center (touch: 1-finger rotate, 2-finger pinch/pan). The Three.js renderer loads lazily on first use, so the 2D experience pays no bundle cost.
- **Real 2026 starting positions.** Planets are initialized from JPL Horizons heliocentric ecliptic longitudes at the 2026-01-01 epoch (Earth's Moon from its geocentric longitude).
- **Starts on today's date.** On launch the clock seeds to today's UTC date and keeps running, so you first see today's constellation.
- **Clickable date + date picker.** Click the date to reveal a native date input; picking a date seeks the simulation to that date at 00:00 UTC and pauses.
- **"Today" button** beside the date seeks back to today's UTC date and pauses.
- **Comets.** Turn on the "Comets" toggle in the toolbar to reveal a picker of 15 famous comets. Pick one to focus it — from Schematic the view switches to To Scale (in 3D mode it stays 3D, showing the comet's real inclined orbit) and frames the comet's orbit (a full ellipse for short-period comets; a near-Sun arc for long-period and interstellar ones), drawing its path and an exaggerated, labeled comet body (with tail) at its real position for the current simulated date. Path color tells you what kind of orbit it is: **green** means the comet is bound and returns periodically; **red** means it's on an unbound, one-time pass through the inner solar system (including interstellar visitors like 'Oumuamua and Borisov). Use **"Jump to perihelion"** to seek the clock straight to the comet's closest approach to the Sun.

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

## Production Deployment

Pushing to `main` builds, tests, and deploys the static Vite output through the
GitHub Actions workflow. The Debian server only needs Nginx and an SSH account
with passwordless `sudo`; it does not run Vite or require Node.js.

The server checkout must be located at `~/dev/solar-system-simulation`. Add
these GitHub Actions repository secrets:

- `DEPLOY_HOST`: server hostname or IP address
- `DEPLOY_USER`: SSH account that owns the checkout
- `DEPLOY_SSH_KEY`: private key authorized for that account
- `DEPLOY_KNOWN_HOSTS`: pinned server host key, generated with
  `ssh-keyscan -H <DEPLOY_HOST>` from a trusted network

Each deployment uploads the built `dist/` assets into
`~/dev/solar-system-simulation/.deploy/releases/<commit SHA>/`, then atomically
updates `.deploy/current`. Nginx serves that symlink on port `5199` for
`solar.yokicloud.net`, replacing the former proxy to the Vite development server.

The workflow validates the Nginx configuration before reloading it. If the
build or upload fails, the previously deployed release remains active.

## Implementation Notes

- The `Simulation` class advances simulated days and produces a mode-aware snapshot of body positions (`snapshot(mode)`, `orbitPaths(mode)`, `extent(mode)`).
- Schematic mode uses constant-speed circular motion offset by the 2026 epoch phase. To Scale mode solves Kepler's equation (`M = E − e·sin(E)`) via Newton–Raphson (`src/sim/kepler.ts`) and places bodies on real elliptical orbits (`src/sim/ellipticalOrbit.ts`); both derive the epoch mean anomaly from the same stored epoch longitude so day-0 positions match.
- `SimClock` tracks simulated days; `setSimDays` seeks the clock, and `formatDate.ts` converts between a `YYYY-MM-DD` string / real timestamp and integer `simDays` (`dateInputToSimDays`, `timestampToSimDays`). The impure `Date.now()` read lives in the hook so `src/sim/` stays pure.
- 3D mode lifts the same in-plane Keplerian solve into ecliptic 3D via the classic `Rz(Ω)·Rx(i)·Rz(ω)` rotation (`src/sim/orbit3d.ts`), so 2D and 3D always agree on each body's orbital phase. Comets use their real inclinations in 3D (retrograde motion emerges naturally from `i > 90°`).
- All Three.js code lives in `src/render3d/` and ships as a separate code-split chunk, dynamically imported when the user first switches to 3D and fully disposed on switching away. The 2D and 3D views use two stacked `<canvas>` elements (a canvas can hold only one context type).
- `Camera` maps world coordinates to screen coordinates; switching modes re-fits the camera and rebuilds the belt while preserving the clock and date.
- `drawScene` renders orbit guides (circles or rotated ellipses per mode), the asteroid belt, bodies, and labels.
- Moon visibility and labels use a screen-coverage threshold so detail appears only when planets are large enough to see clearly.

> Note: positions are the model's propagation (Keplerian in To Scale, stylized circular in Schematic), not a precise ephemeris.

## Textures

Planet, Sun, and Moon texture maps in `public/textures/` are from
[Solar System Scope](https://www.solarsystemscope.com/textures/), licensed
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
