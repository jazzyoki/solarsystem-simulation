import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Simulation } from '../sim/simulation';
import { COMETS } from '../sim/data';
import type { Vec3 } from '../sim/types';
import { ThreeRenderer } from './ThreeRenderer';

const { draw } = vi.hoisted(() => ({ draw: vi.fn() }));
vi.mock('three', async (importOriginal) => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: class {
    setPixelRatio() {}
    setSize() {}
    render = draw;
    dispose() {}
  },
}));

const sim = new Simulation();
const renderers: ThreeRenderer[] = [];
afterEach(() => { renderers.splice(0).forEach((r) => r.dispose()); draw.mockClear(); });
function create() {
  const renderer = new ThreeRenderer(document.createElement('canvas'), sim.orbitPaths3D(), [], sim.extent('toScale'));
  renderers.push(renderer);
  return renderer;
}
function cameraFrom(renderer: ThreeRenderer) {
  renderer.render();
  const camera = draw.mock.lastCall![1] as THREE.PerspectiveCamera;
  camera.updateMatrixWorld(true);
  return camera;
}
function expectVisible(camera: THREE.PerspectiveCamera, points: Vec3[]) {
  const clipped = points.filter((p) => {
    const projected = new THREE.Vector3(p.x, p.y, p.z).project(camera);
    return Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || Math.abs(projected.z) > 1;
  });
  expect(clipped).toHaveLength(0);
}

describe('3D viewport framing with actual camera projection', () => {
  it.each([[390, 844], [1440, 900], [120, 1000], [40, 1000]])('initially fits all planet paths at %dx%d', (w, h) => {
    const renderer = create();
    renderer.setSize(w, h, 1);
    expectVisible(cameraFrom(renderer), sim.orbitPaths3D().flat());
  });

  it.each([[390, 844], [1440, 900]])('explicitly fits every comet path at %dx%d', (w, h) => {
    const renderer = create();
    renderer.setSize(w, h, 1);
    for (const comet of COMETS) {
      renderer.resetView(sim.cometExtent(comet.name));
      expectVisible(cameraFrom(renderer), sim.cometPath3D(comet.name)!.points);
    }
  });

  it('waits for a nonzero viewport before the initial fit', () => {
    const renderer = create();
    renderer.setSize(0, 0, 1);
    renderer.setSize(390, 844, 1);
    expectVisible(cameraFrom(renderer), sim.orbitPaths3D().flat());
  });

  it('preserves navigation on later resizes and fits again on explicit reset', () => {
    const renderer = create();
    renderer.setSize(1440, 900, 1);
    const camera = cameraFrom(renderer);
    camera.position.multiplyScalar(0.6).add(new THREE.Vector3(70, 80, 90));
    const position = camera.position.clone();
    renderer.setSize(390, 844, 2);
    expect(camera.position.distanceTo(position)).toBe(0);
    renderer.resetView(sim.extent('toScale'));
    expectVisible(cameraFrom(renderer), sim.orbitPaths3D().flat());
  });
});
