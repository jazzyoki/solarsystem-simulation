import { describe, expect, it } from 'vitest';
import { Camera } from '../render/camera';
import { PointerInteraction } from './pointerInteraction';

function freshCamera(): Camera {
  const camera = new Camera();
  camera.centerX = 400;
  camera.centerY = 300;
  camera.scale = 2;
  return camera;
}

describe('PointerInteraction', () => {
  it('pans with one finger', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 100, y: 100 });
    pi.pointerMove(1, { x: 130, y: 120 });

    expect(camera.centerX).toBeCloseTo(430);
    expect(camera.centerY).toBeCloseTo(320);
  });

  it('does nothing before pointerDown', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerMove(1, { x: 50, y: 50 });

    expect(camera.centerX).toBeCloseTo(400);
    expect(camera.centerY).toBeCloseTo(300);
  });

  it('pinch-zooms about the midpoint', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 300, y: 300 });
    pi.pointerDown(2, { x: 500, y: 300 });
    pi.pointerMove(1, { x: 250, y: 300 });
    pi.pointerMove(2, { x: 550, y: 300 });

    expect(camera.scale).toBeCloseTo(3);
    expect(camera.centerX).toBeCloseTo(400);
    expect(camera.centerY).toBeCloseTo(300);
  });

  it('pans while pinching', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 300, y: 300 });
    pi.pointerDown(2, { x: 500, y: 300 });
    pi.pointerMove(1, { x: 310, y: 300 });
    pi.pointerMove(2, { x: 510, y: 300 });

    expect(camera.centerX).toBeCloseTo(410);
    expect(camera.centerY).toBeCloseTo(300);
    expect(camera.scale).toBeCloseTo(2);
  });

  it('resumes single-finger pan after lifting one finger', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 100, y: 100 });
    pi.pointerDown(2, { x: 200, y: 100 });
    pi.pointerUp(2);
    pi.pointerMove(1, { x: 120, y: 130 });

    expect(camera.centerX).toBeCloseTo(420);
    expect(camera.centerY).toBeCloseTo(330);
  });

  it('ignores a third pointer', () => {
    const camera = freshCamera();
    const pi = new PointerInteraction(camera);

    pi.pointerDown(1, { x: 300, y: 300 });
    pi.pointerDown(2, { x: 500, y: 300 });
    pi.pointerDown(3, { x: 400, y: 100 });
    pi.pointerMove(3, { x: 400, y: 400 });

    expect(camera.scale).toBeCloseTo(2);
    expect(camera.centerX).toBeCloseTo(400);
    expect(camera.centerY).toBeCloseTo(300);
  });
});
