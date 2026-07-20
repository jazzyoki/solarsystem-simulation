import { Camera } from '../render/camera';

export interface PointerPoint {
  x: number;
  y: number;
}

interface PinchStart {
  span: number;
  midpoint: PointerPoint;
  worldPoint: PointerPoint;
  scale: number;
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
  private primaryIds: number[] = [];
  private previousPanPoint: PointerPoint | null = null;
  private pinchStart: PinchStart | null = null;

  constructor(camera: Camera) {
    this.camera = camera;
  }

  activeCount(): number {
    return this.pointers.size;
  }

  private activePrimary(): PointerPoint[] {
    const points: PointerPoint[] = [];
    for (const id of this.primaryIds) {
      const point = this.pointers.get(id);
      if (point !== undefined) {
        points.push(point);
      }
    }
    return points;
  }

  private beginPinch(points: [PointerPoint, PointerPoint]): void {
    const mid = midpoint(points[0], points[1]);
    this.pinchStart = {
      span: distance(points[0], points[1]),
      midpoint: mid,
      worldPoint: this.camera.screenToWorld(mid),
      scale: this.camera.scale,
    };
  }

  private applyPinch(points: [PointerPoint, PointerPoint]): void {
    if (!this.pinchStart) return;

    const currentSpan = distance(points[0], points[1]);
    const currentMid = midpoint(points[0], points[1]);
    const factor = this.pinchStart.span > 0 ? currentSpan / this.pinchStart.span : 1;
    this.camera.scale = this.pinchStart.scale * factor;
    this.camera.centerX = currentMid.x - this.pinchStart.worldPoint.x * this.camera.scale;
    this.camera.centerY = currentMid.y + this.pinchStart.worldPoint.y * this.camera.scale;
  }

  pointerDown(id: number, point: PointerPoint): void {
    this.pointers.set(id, point);
    if (this.primaryIds.length < 2) {
      this.primaryIds.push(id);
    }

    const primaries = this.activePrimary();

    if (primaries.length === 1) {
      this.previousPanPoint = { ...point };
      this.pinchStart = null;
    } else if (primaries.length === 2) {
      this.beginPinch(primaries as [PointerPoint, PointerPoint]);
      this.previousPanPoint = null;
    }
  }

  pointerMove(id: number, point: PointerPoint): void {
    if (!this.pointers.has(id)) return;

    this.pointers.set(id, point);

    if (!this.primaryIds.includes(id)) return;

    const primaries = this.activePrimary();
    const count = primaries.length;

    if (count === 1 && this.previousPanPoint) {
      this.camera.panBy(point.x - this.previousPanPoint.x, point.y - this.previousPanPoint.y);
      this.previousPanPoint = { ...point };
    } else if (count === 2) {
      this.applyPinch(primaries as [PointerPoint, PointerPoint]);
    }
  }

  pointerUp(id: number): void {
    this.pointers.delete(id);
    this.primaryIds = this.primaryIds.filter((primaryId) => primaryId !== id);

    const primaries = this.activePrimary();
    const count = primaries.length;

    if (count === 0) {
      this.previousPanPoint = null;
      this.pinchStart = null;
    } else if (count === 1) {
      this.previousPanPoint = { ...primaries[0] };
      this.pinchStart = null;
    } else if (count === 2) {
      this.beginPinch(primaries as [PointerPoint, PointerPoint]);
      this.previousPanPoint = null;
    }
  }
}
