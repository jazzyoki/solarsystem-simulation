import * as THREE from 'three';
import { ASTEROID_BELT } from '../sim/data';
import type { Layout } from '../sim/layout';
import { angleAt } from '../sim/orbits';
import { orbitalPlaneToEcliptic } from '../sim/orbit3d';
import { mulberry32 } from '../render/asteroidBelt';

/** Real main-belt objects mostly sit below ~8° inclination. */
export const BELT_MAX_INCLINATION_RAD = (8 * Math.PI) / 180;

export interface BeltAsteroid3D {
  orbitRadius: number;
  angleOffset: number;
  periodDays: number;
  inclinationRad: number;
  ascendingNodeRad: number;
}

/** Deterministic 3D belt in the to-scale band between Mars and Jupiter. */
export function buildBelt3d(layout: Layout, seed: number, count: number): BeltAsteroid3D[] {
  const rand = mulberry32(seed);
  const { inner, outer } = ASTEROID_BELT.getRadii(layout, 'toScale');
  const belt: BeltAsteroid3D[] = [];
  for (let i = 0; i < count; i++) {
    belt.push({
      orbitRadius: inner + rand() * (outer - inner),
      angleOffset: rand() * Math.PI * 2,
      periodDays: 1200 + rand() * 800,
      inclinationRad: rand() * BELT_MAX_INCLINATION_RAD,
      ascendingNodeRad: rand() * Math.PI * 2,
    });
  }
  return belt;
}

export function createBeltPoints(count: number): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const material = new THREE.PointsMaterial({
    color: 0xaaaabe,
    transparent: true,
    opacity: 0.45,
    size: 2,
    sizeAttenuation: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // positions change every frame; skip bounds upkeep
  return points;
}

export function updateBeltPositions(
  points: THREE.Points,
  belt: BeltAsteroid3D[],
  simDays: number,
): void {
  const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
  belt.forEach((a, i) => {
    const angle = a.angleOffset + angleAt(a.periodDays, simDays);
    const p = orbitalPlaneToEcliptic(
      {
        inclinationRad: a.inclinationRad,
        ascendingNodeRad: a.ascendingNodeRad,
        perihelionLongitudeRad: a.ascendingNodeRad, // ω = 0: circular, phase-only orbit
      },
      a.orbitRadius,
      angle,
    );
    attr.setXYZ(i, p.x, p.y, p.z);
  });
  attr.needsUpdate = true;
}
