import { describe, expect, it } from 'vitest';
import { Camera } from './camera';

describe('Camera', () => {
  it('maps world to screen with a y-axis flip at defaults', () => {
    const cam = new Camera();
    expect(cam.worldToScreen({ x: 2, y: 3 })).toEqual({ x: 2, y: -3 });
  });

  it('round-trips world <-> screen', () => {
    const cam = new Camera();
    cam.scale = 2;
    cam.centerX = 100;
    cam.centerY = 50;
    const s = cam.worldToScreen({ x: 7, y: -4 });
    const w = cam.screenToWorld(s);
    expect(w.x).toBeCloseTo(7, 10);
    expect(w.y).toBeCloseTo(-4, 10);
  });

  it('zoomAt keeps the anchored screen point fixed', () => {
    const cam = new Camera();
    const anchor = { x: 100, y: 50 };
    const before = cam.screenToWorld(anchor);
    cam.zoomAt(anchor, 2);
    const after = cam.screenToWorld(anchor);
    expect(cam.scale).toBe(2);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('panBy shifts the view', () => {
    const cam = new Camera();
    cam.panBy(10, -5);
    expect(cam.worldToScreen({ x: 0, y: 0 })).toEqual({ x: 10, y: -5 });
  });

  it('fitToView centers and scales to fit the radius with margin', () => {
    const cam = new Camera();
    cam.fitToView(1000, 800, 600);
    expect(cam.centerX).toBe(400);
    expect(cam.centerY).toBe(300);
    expect(cam.scale).toBeCloseTo(300 / 1050, 10);
  });
});
