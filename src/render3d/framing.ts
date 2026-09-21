import * as THREE from 'three';

/** Fit a Sun-centered bounding sphere, including its depth, with 10% margin. */
export function frameBoundingSphere(camera: THREE.PerspectiveCamera, radius: number): number {
  const verticalHalfFov = THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
  const distance = radius * 1.1 / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov));
  camera.position.set(0, -1.2, 0.7).normalize().multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
  camera.far = Math.max(camera.far, distance + radius * 1.1);
  camera.updateProjectionMatrix();
  return distance;
}
