import type { Layout } from '../sim/layout';
import type { Snapshot } from '../sim/simulation';
import type { Camera } from './camera';
import { drawAsteroidBelt, type AsteroidState } from './asteroidBelt';
import { labelOpacity, moonOpacity, type ViewportSize } from './visibility';

const BACKGROUND = '#0a0e1a';
const ORBIT_GUIDE = 'rgba(255, 255, 255, 0.08)';
const BUBBLE_GUIDE = 'rgba(255, 255, 255, 0.05)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.75)';
const LABEL_FONT = '11px system-ui, sans-serif';

export function drawScene(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot,
  layout: Layout,
  camera: Camera,
  viewportW: number,
  viewportH: number,
  asteroids: AsteroidState[] = [],
): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, viewportW, viewportH);

  const origin = camera.worldToScreen({ x: 0, y: 0 });
  const viewport: ViewportSize = { width: viewportW, height: viewportH };

  // Planet orbit guides (circles around the sun).
  ctx.strokeStyle = ORBIT_GUIDE;
  ctx.lineWidth = 1;
  for (const body of snap.bodies) {
    if (body.kind !== 'planet') continue;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, layout.planets[body.name].orbitRadius * camera.scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Asteroid belt behind planets.
  if (asteroids.length > 0) {
    drawAsteroidBelt(ctx, asteroids, camera, snap.simDays);
  }

  let currentMoonOpacity = 0;
  let currentLabelOpacity = 0;

  for (const body of snap.bodies) {
    if (body.kind === 'planet') {
      const bubbleDiameter = layout.planets[body.name].bubbleRadius * camera.scale * 2;
      currentMoonOpacity = moonOpacity(bubbleDiameter, viewport);
      currentLabelOpacity = labelOpacity(bubbleDiameter, viewport);
    }

    // Moon bodies are fully transparent at this zoom level; skip them.
    if (body.kind === 'moon' && currentMoonOpacity <= 0) continue;

    const p = camera.worldToScreen(body);
    const r = Math.max(body.bodyRadius * camera.scale, body.kind === 'moon' ? 0.75 : 1.5);

    if (body.kind === 'sun') {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      glow.addColorStop(0, 'rgba(255, 204, 51, 0.5)');
      glow.addColorStop(1, 'rgba(255, 204, 51, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (body.kind === 'moon') {
      ctx.save();
      ctx.globalAlpha = currentMoonOpacity;
    }

    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (body.kind === 'moon') {
      ctx.restore();
    }

    if (body.kind === 'planet') {
      const { bubbleRadius } = layout.planets[body.name];
      if (bubbleRadius > 0) {
        ctx.strokeStyle = BUBBLE_GUIDE;
        ctx.beginPath();
        ctx.arc(p.x, p.y, bubbleRadius * camera.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = LABEL_FONT;
      ctx.fillText(body.name, p.x + r + 4, p.y - r - 4);
    }

    if (body.kind === 'moon' && currentLabelOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = currentLabelOpacity;
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = LABEL_FONT;
      ctx.fillText(body.name, p.x + r + 4, p.y - r - 4);
      ctx.restore();
    }
  }
}
