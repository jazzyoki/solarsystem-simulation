import * as THREE from 'three';
import type { Vec3 } from '../sim/types';

const ORBIT_GUIDE_COLOR = 0xffffff;
const ORBIT_GUIDE_OPACITY = 0.15;
const COMET_GREEN = 0x5adc82;
const COMET_RED = 0xf05a5a;
const COMET_PATH_OPACITY = 0.85;

function lineGeometry(points: Vec3[]): THREE.BufferGeometry {
  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/** Faint closed guide loop for a planet orbit. */
export function createOrbitLine(points: Vec3[]): THREE.LineLoop {
  return new THREE.LineLoop(
    lineGeometry(points),
    new THREE.LineBasicMaterial({
      color: ORBIT_GUIDE_COLOR,
      transparent: true,
      opacity: ORBIT_GUIDE_OPACITY,
    }),
  );
}

/** Open comet path; green = bound orbit, red = unbound (educational cue). */
export function createCometPathLine(points: Vec3[], color: 'green' | 'red'): THREE.Line {
  return new THREE.Line(
    lineGeometry(points),
    new THREE.LineBasicMaterial({
      color: color === 'red' ? COMET_RED : COMET_GREEN,
      transparent: true,
      opacity: COMET_PATH_OPACITY,
    }),
  );
}
