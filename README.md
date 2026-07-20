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

- The `Simulation` class advances simulated days and produces a snapshot of body positions.
- `Camera` maps world coordinates to screen coordinates.
- `drawScene` renders orbit guides, the asteroid belt, bodies, and labels.
- Moon visibility and labels use a screen-coverage threshold so detail appears only when planets are large enough to see clearly.
