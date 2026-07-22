# Solar System Simulation

A browser-based, stylized solar system visualization built with React, TypeScript, and Vite.

## Features

- Top-down view of the Sun, eight planets, and their moons.
- Smooth zoom and pan via mouse wheel and drag (with touch pointer support).
- Moons and moon labels fade in as you zoom in on a planet.
- Stylized asteroid belt between Mars and Jupiter.
- Adjustable simulation speed and pause/resume controls.
- **Schematic / To Scale mode switcher.** _Schematic_ places planets on evenly spaced circular orbits at constant angular speed; _To Scale_ uses real J2000 elliptical orbits (Sun at a focus), true semi-major-axis spacing, and Keplerian variable angular velocity (faster at perihelion). Both modes agree on each planet's longitude at the epoch, so switching never jumps a planet or resets the clock.
- **Real 2026 starting positions.** Planets are initialized from JPL Horizons heliocentric ecliptic longitudes at the 2026-01-01 epoch (Earth's Moon from its geocentric longitude).
- **Starts on today's date.** On launch the clock seeds to today's UTC date and keeps running, so you first see today's constellation.
- **Clickable date + date picker.** Click the date to reveal a native date input; picking a date seeks the simulation to that date at 00:00 UTC and pauses.
- **"Today" button** beside the date seeks back to today's UTC date and pauses.
- **Comets.** Turn on the "Comets" toggle in the toolbar to reveal a picker of 15 famous comets. Pick one to focus it — the view switches to To Scale and frames the comet's full orbit, drawing its path and an exaggerated, labeled comet body (with tail) at its real position for the current simulated date. Path color tells you what kind of orbit it is: **green** means the comet is bound and returns periodically; **red** means it's on an unbound, one-time pass through the inner solar system (including interstellar visitors like 'Oumuamua and Borisov). Use **"Jump to perihelion"** to seek the clock straight to the comet's closest approach to the Sun.

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

## Deploying with Nginx

A sample `nginx.conf` is provided in the project root. It reverse-proxies requests from port `5199` to the Vite dev server on port `5173`, including WebSocket support for Hot Module Replacement (HMR).

### Example configuration

```nginx
server {
    listen 5199;
    server_name localhost;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support required for Vite HMR
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Usage

```bash
# 1. Start the Vite dev server
npm run dev

# 2. In another terminal, test and start nginx
nginx -t -c /path/to/nginx.conf
nginx -c /path/to/nginx.conf
```

Then open `http://localhost:5199`.

## Implementation Notes

- The `Simulation` class advances simulated days and produces a mode-aware snapshot of body positions (`snapshot(mode)`, `orbitPaths(mode)`, `extent(mode)`).
- Schematic mode uses constant-speed circular motion offset by the 2026 epoch phase. To Scale mode solves Kepler's equation (`M = E − e·sin(E)`) via Newton–Raphson (`src/sim/kepler.ts`) and places bodies on real elliptical orbits (`src/sim/ellipticalOrbit.ts`); both derive the epoch mean anomaly from the same stored epoch longitude so day-0 positions match.
- `SimClock` tracks simulated days; `setSimDays` seeks the clock, and `formatDate.ts` converts between a `YYYY-MM-DD` string / real timestamp and integer `simDays` (`dateInputToSimDays`, `timestampToSimDays`). The impure `Date.now()` read lives in the hook so `src/sim/` stays pure.
- `Camera` maps world coordinates to screen coordinates; switching modes re-fits the camera and rebuilds the belt while preserving the clock and date.
- `drawScene` renders orbit guides (circles or rotated ellipses per mode), the asteroid belt, bodies, and labels.
- Moon visibility and labels use a screen-coverage threshold so detail appears only when planets are large enough to see clearly.

> Note: positions are the model's propagation (Keplerian in To Scale, stylized circular in Schematic), not a precise ephemeris.
