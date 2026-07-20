import { Camera } from '../render/camera';

export interface PointerPoint {
  x: number;
  y: number;
}

interface PinchState {
  span: number;
  midpoint: PointerPoint;
}

function distance(a: PointerPoint, b: PointerPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function midpoint(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export class PointerInteraction {
  private camera: Camera;
  private pointers = new Map<number, PointerPoint>();
  private previousPanPoint: PointerPoint | null = null;
  private previousPinch: PinchState | null = null;

  constructor(camera: Camera) {
    this.camera = camera;
  }

  activeCount(): number {
    return this.pointers.size;
  }

  pointerDown(id: number, point: PointerPoint): void {
    this.pointers.set(id, point);
    const count = this.pointers.size;

    if (count === 1) {
      this.previousPanPoint = { ...point };
      this.previousPinch = null;
    } else if (count === 2) {
      const points = Array.from(this.pointers.values());
      this.previousPinch = {
        span: distance(points[0], points[1]),
        midpoint: midpoint(points[0], points[1]),
      };
      this.previousPanPoint = null;
    }
  }

  pointerMove(id: number, point: PointerPoint): void {
    if (!this.pointers.has(id)) return;

    this.pointers.set(id, point);
    const count = this.pointers.size;

    if (count === 1 && this.previousPanPoint) {
      this.camera.panBy(point.x - this.previousPanPoint.x, point.y - this.previousPanPoint.y);
      this.previousPanPoint = { ...point };
    } else if (count === 2 && this.previousPinch) {
      const points = Array.from(this.pointers.values());
      const currentSpan = distance(points[0], points[1]);
      const currentMid = midpoint(points[0], points[1]);

      const factor = currentSpan / this.previousPinch.span;

      if (currentSpan > 0) {
        this.camera.zoomAt(currentMid, factor);
      }
      this.camera.panBy(
        (currentMid.x - this.previousPinch.midpoint.x) * (2 - factor),
        (currentMid.y - this.previousPinch.midpoint.y) * (2 - factor),
      );

      this.previousPinch = { span: currentSpan, midpoint: currentMid };
    }
  }

  pointerUp(id: number): void {
    this.pointers.delete(id);
    const count = this.pointers.size;

    if (count === 0) {
      this.previousPanPoint = null;
      this.previousPinch = null;
    } else if (count === 1) {
      const remaining = Array.from(this.pointers.values())[0];
      this.previousPanPoint = { ...remaining };
      this.previousPinch = null;
    } else if (count === 2) {
      const points = Array.from(this.pointers.values());
      this.previousPinch = {
        span: distance(points[0], points[1]),
        midpoint: midpoint(points[0], points[1]),
      };
      this.previousPanPoint = null;
    }
  }
}
