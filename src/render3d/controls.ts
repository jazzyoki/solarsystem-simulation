import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Orbit-around-target navigation, configured per the design spec:
 * damping/inertia, distance clamps, zoom-to-cursor, screen-space pan, and
 * standard touch gestures (1-finger rotate, 2-finger pinch-zoom + pan).
 * Double-click re-centers the focus on the Sun.
 */
export function createControls(camera: THREE.PerspectiveCamera, canvas: HTMLElement): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 40;
  controls.maxDistance = 60000;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  canvas.addEventListener('dblclick', () => {
    controls.target.set(0, 0, 0);
  });
  return controls;
}
