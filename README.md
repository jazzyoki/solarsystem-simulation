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

A sample `nginx.conf` is provided in the project root. It serves the Vite production build from `dist/` on port `5199` with gzip compression and SPA fallback routing.

### Example configuration

```nginx
server {
    listen 5199;
    server_name localhost;

    root /var/www/solarsystem-simulation/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|otf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Usage

```bash
# Build the production bundle
npm run build

# Test the nginx configuration
nginx -t -c /path/to/nginx.conf

# Start nginx with the provided config
nginx -c /path/to/nginx.conf
```

Then open `http://localhost:5199`.

## Implementation Notes

- The `Simulation` class advances simulated days and produces a snapshot of body positions.
- `Camera` maps world coordinates to screen coordinates.
- `drawScene` renders orbit guides, the asteroid belt, bodies, and labels.
- Moon visibility and labels use a screen-coverage threshold so detail appears only when planets are large enough to see clearly.
