import type { Layout } from '../sim/layout';
import { MOONS } from '../sim/data';
import type { CometPathRender, OrbitPath, Snapshot } from '../sim/simulation';
import type { Camera } from './camera';
import { drawAsteroidBelt, type AsteroidState } from './asteroidBelt';
import { labelOpacity, moonOpacity, type ViewportSize } from './visibility';

const BACKGROUND = '#0a0e1a';
const ORBIT_GUIDE = 'rgba(255, 255, 255, 0.08)';
const BUBBLE_GUIDE = 'rgba(255, 255, 255, 0.05)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.75)';
const LABEL_FONT = '11px system-ui, sans-serif';
const COMET_PATH_GREEN = 'rgba(90, 220, 130, 0.8)';
const COMET_PATH_RED = 'rgba(240, 90, 90, 0.85)';
const COMET_TAIL = 'rgba(220, 240, 255, 0.5)';

const moonParent = new Map(MOONS.map((m) => [m.name, m.parent]));

export function drawScene(
  ctx: CanvasRenderingContext2D,
  snap: Snapshot,
  layout: Layout,
  camera: Camera,
  viewportW: number,
  viewportH: number,
  asteroids: AsteroidState[] = [],
  orbitPaths: OrbitPath[] = [],
  cometPath: CometPathRender | null = null,
): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, viewportW, viewportH);

  const origin = camera.worldToScreen({ x: 0, y: 0 });
  const viewport: ViewportSize = { width: viewportW, height: viewportH };

  // Orbit guides: circles (schematic) or rotated ellipses (to-scale).
  ctx.strokeStyle = ORBIT_GUIDE;
  ctx.lineWidth = 1;
  for (const path of orbitPaths) {
    ctx.beginPath();
    if (path.kind === 'circle') {
      ctx.arc(origin.x, origin.y, path.radius * camera.scale, 0, Math.PI * 2);
    } else {
      const center = camera.worldToScreen({ x: path.centerX, y: path.centerY });
      // World angles are CCW (y-up); the camera flips y, so screen rotation = -rotationRad.
      ctx.ellipse(
        center.x,
        center.y,
        path.semiMajorAxis * camera.scale,
        path.semiMinorAxis * camera.scale,
        -path.rotationRad,
        0,
        Math.PI * 2,
      );
    }
    ctx.stroke();
  }

  // Focused comet's path: a green (elliptical) or red (hyperbolic) polyline.
  if (cometPath && cometPath.points.length > 1) {
    ctx.strokeStyle = cometPath.color === 'red' ? COMET_PATH_RED : COMET_PATH_GREEN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    cometPath.points.forEach((pt, i) => {
      const s = camera.worldToScreen(pt);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
  }

  // Asteroid belt behind planets.
  if (asteroids.length > 0) {
    drawAsteroidBelt(ctx, asteroids, camera, snap.simDays);
  }

  let currentMoonOpacity = 0;
  let currentLabelOpacity = 0;

  for (const body of snap.bodies) {
    const parentName = body.kind === 'planet' ? body.name : moonParent.get(body.name);
    if (parentName) {
      const bubbleDiameter = layout.planets[parentName].bubbleRadius * camera.scale * 2;
      currentMoonOpacity = moonOpacity(bubbleDiameter, viewport);
      currentLabelOpacity = labelOpacity(bubbleDiameter, viewport);
    }

    // Moon bodies are fully transparent at this zoom level; skip them.
    if (body.kind === 'moon' && currentMoonOpacity <= 0) continue;

    const p = camera.worldToScreen(body);
    const r = Math.max(body.bodyRadius * camera.scale, body.kind === 'moon' ? 0.75 : 1.5);

    if (body.kind === 'comet') {
      // Anti-sunward tail: from the comet, directly away from the Sun (origin).
      const len = Math.hypot(body.x, body.y) || 1;
      const tailWorld = { x: body.x + (body.x / len) * 40, y: body.y + (body.y / len) * 40 };
      const tail = camera.worldToScreen(tailWorld);
      ctx.strokeStyle = COMET_TAIL;
      ctx.lineWidth = Math.max(r * 0.8, 1);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tail.x, tail.y);
      ctx.stroke();

      ctx.fillStyle = body.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = LABEL_COLOR;
      ctx.font = LABEL_FONT;
      ctx.fillText(body.name, p.x + r + 4, p.y - r - 4);
      continue;
    }

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
