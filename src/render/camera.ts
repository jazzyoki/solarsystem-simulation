import type { BodyPosition } from '../sim/types';

const FIT_MARGIN = 1.05;

/**
 * Maps between world coordinates (y-up, origin at the sun) and screen
 * coordinates (y-down). `scale` is screen px per world unit; (centerX,
 * centerY) is where the world origin lands on screen.
 */
export class Camera {
  scale = 1;
  centerX = 0;
  centerY = 0;

  worldToScreen(p: BodyPosition): BodyPosition {
    return { x: this.centerX + p.x * this.scale, y: this.centerY - p.y * this.scale };
  }

  screenToWorld(p: BodyPosition): BodyPosition {
    return { x: (p.x - this.centerX) / this.scale, y: (this.centerY - p.y) / this.scale };
  }

  /** Zooms by `factor` while keeping `screenPoint` visually fixed. */
  zoomAt(screenPoint: BodyPosition, factor: number): void {
    if (!(factor > 0) || !Number.isFinite(factor)) return;
    const scale = this.scale * factor;
    if (!(scale > 0) || !Number.isFinite(scale)) return;
    const worldPoint = this.screenToWorld(screenPoint);
    const centerX = screenPoint.x - worldPoint.x * scale;
    const centerY = screenPoint.y + worldPoint.y * scale;
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return;
    this.scale = scale;
    this.centerX = centerX;
    this.centerY = centerY;
  }

  panBy(dx: number, dy: number): void {
    this.centerX += dx;
    this.centerY += dy;
  }

  /** Fits a world radius into the viewport, centered, with a small margin. */
  fitToView(worldRadius: number, viewportW: number, viewportH: number): void {
    this.scale = Math.min(viewportW, viewportH) / 2 / (worldRadius * FIT_MARGIN);
    this.centerX = viewportW / 2;
    this.centerY = viewportH / 2;
  }
}
