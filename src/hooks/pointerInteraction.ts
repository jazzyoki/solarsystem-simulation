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
  private primaryIds: number[] = [];
  private previousPanPoint: PointerPoint | null = null;
  private previousPinch: PinchState | null = null;

  constructor(camera: Camera) {
    this.camera = camera;
  }

  activeCount(): number {
    return this.pointers.size;
  }

  private activePrimaryPoints(): PointerPoint[] {
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
    this.previousPinch = {
      span: distance(points[0], points[1]),
      midpoint: midpoint(points[0], points[1]),
    };
  }

  pointerDown(id: number, point: PointerPoint): void {
    this.pointers.set(id, point);
    if (this.primaryIds.length < 2 && !this.primaryIds.includes(id)) {
      this.primaryIds.push(id);
    }

    const primaries = this.activePrimaryPoints();

    if (primaries.length === 1) {
      this.previousPanPoint = { ...point };
      this.previousPinch = null;
    } else if (primaries.length === 2) {
      this.beginPinch(primaries as [PointerPoint, PointerPoint]);
      this.previousPanPoint = null;
    }
  }

  pointerMove(id: number, point: PointerPoint): void {
    if (!this.pointers.has(id)) return;

    this.pointers.set(id, point);

    if (!this.primaryIds.includes(id)) return;

    const primaries = this.activePrimaryPoints();
    const count = primaries.length;

    if (count === 1 && this.previousPanPoint) {
      this.camera.panBy(point.x - this.previousPanPoint.x, point.y - this.previousPanPoint.y);
      this.previousPanPoint = { ...point };
    } else if (count === 2 && this.previousPinch) {
      const currentSpan = distance(primaries[0], primaries[1]);
      const currentMid = midpoint(primaries[0], primaries[1]);

      // Pan first so the previous midpoint maps to the current midpoint,
      // then zoom about the current midpoint. This ordering keeps the
      // pinch/pan transform exact across sequential pointer events.
      this.camera.panBy(
        currentMid.x - this.previousPinch.midpoint.x,
        currentMid.y - this.previousPinch.midpoint.y,
      );
      if (currentSpan > 0) {
        this.camera.zoomAt(currentMid, currentSpan / this.previousPinch.span);
      }

      this.previousPinch = { span: currentSpan, midpoint: currentMid };
    }
  }

  pointerUp(id: number): void {
    this.pointers.delete(id);
    this.primaryIds = this.primaryIds.filter((primaryId) => primaryId !== id);

    const primaries = this.activePrimaryPoints();
    const count = primaries.length;

    if (count === 0) {
      this.previousPanPoint = null;
      this.previousPinch = null;
    } else if (count === 1) {
      this.previousPanPoint = { ...primaries[0] };
      this.previousPinch = null;
    } else if (count === 2) {
      this.beginPinch(primaries as [PointerPoint, PointerPoint]);
      this.previousPanPoint = null;
    }
  }
}
