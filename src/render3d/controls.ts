import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Handle to controls and their cleanup.
 */
export interface ControlsHandle {
  controls: OrbitControls;
  dispose(): void;
}

/**
 * Orbit-around-target navigation, configured per the design spec:
 * damping/inertia, distance clamps, zoom-to-cursor, screen-space pan, and
 * standard touch gestures (1-finger rotate, 2-finger pinch-zoom + pan).
 * Double-click re-centers the focus on the Sun. The returned handle must be
 * disposed to remove all listeners and resources.
 */
export function createControls(camera: THREE.PerspectiveCamera, canvas: HTMLElement): ControlsHandle {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 40;
  controls.maxDistance = 60000;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  const onDblClick = () => {
    controls.target.set(0, 0, 0);
  };
  canvas.addEventListener('dblclick', onDblClick);
  return {
    controls,
    dispose() {
      canvas.removeEventListener('dblclick', onDblClick);
      controls.dispose();
    },
  };
}
