import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../sim/layout';
import { ASTEROID_BELT, MOONS, PLANETS } from '../sim/data';
import type { BodySnapshot3D } from '../sim/simulation';
import { createBodyObject } from './bodies';
import { createCometPathLine, createOrbitLine } from './orbits';
import {
  BELT_MAX_INCLINATION_RAD,
  buildBelt3d,
  createBeltPoints,
  updateBeltPositions,
} from './belt';

const layout = computeLayout(PLANETS, MOONS);

const mars: BodySnapshot3D = {
  name: 'Mars', x: 0, y: 0, z: 0, bodyRadius: 5, color: '#c1440e', kind: 'planet',
};
const saturn: BodySnapshot3D = {
  name: 'Saturn', x: 0, y: 0, z: 0, bodyRadius: 12, color: '#e0c38b', kind: 'planet',
};

describe('createBodyObject', () => {
  it('wraps a sphere of the body radius in a named group', () => {
    const group = createBodyObject(mars, new THREE.TextureLoader());
    expect(group.name).toBe('Mars');
    const mesh = group.children[0] as THREE.Mesh;
    expect((mesh.geometry as THREE.SphereGeometry).parameters.radius).toBe(5);
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it('gives Saturn a ring child', () => {
    const group = createBodyObject(saturn, new THREE.TextureLoader());
    expect(group.children.length).toBe(2);
    const ring = group.children[1] as THREE.Mesh;
    expect(ring.geometry).toBeInstanceOf(THREE.RingGeometry);
  });

  it('uses an unlit material for sun and comet bodies', () => {
    const comet: BodySnapshot3D = {
      name: 'Halley', x: 0, y: 0, z: 0, bodyRadius: 3, color: '#dbeeff', kind: 'comet',
    };
    const mesh = createBodyObject(comet, new THREE.TextureLoader()).children[0] as THREE.Mesh;
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
  });
});

describe('orbit lines', () => {
  const points = [
    { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0.2 }, { x: -1, y: 0, z: 0 }, { x: 0, y: -1, z: -0.2 },
  ];

  it('createOrbitLine builds a closed loop with one vertex per point', () => {
    const line = createOrbitLine(points);
    expect(line).toBeInstanceOf(THREE.LineLoop);
    expect(line.geometry.getAttribute('position').count).toBe(4);
  });

  it('createCometPathLine colors bound green and unbound red', () => {
    const green = createCometPathLine(points, 'green');
    const red = createCometPathLine(points, 'red');
    expect((green.material as THREE.LineBasicMaterial).color.getHexString()).toBe('5adc82');
    expect((red.material as THREE.LineBasicMaterial).color.getHexString()).toBe('f05a5a');
  });
});

describe('belt', () => {
  it('is deterministic for a seed and stays inside the to-scale band', () => {
    const a = buildBelt3d(layout, ASTEROID_BELT.seed, 50);
    const b = buildBelt3d(layout, ASTEROID_BELT.seed, 50);
    expect(a).toEqual(b);
    const { inner, outer } = ASTEROID_BELT.getRadii(layout, 'toScale');
    for (const ast of a) {
      expect(ast.orbitRadius).toBeGreaterThanOrEqual(inner);
      expect(ast.orbitRadius).toBeLessThanOrEqual(outer);
      expect(ast.inclinationRad).toBeGreaterThanOrEqual(0);
      expect(ast.inclinationRad).toBeLessThanOrEqual(BELT_MAX_INCLINATION_RAD);
    }
  });

  it('updateBeltPositions writes bounded 3D positions for every asteroid', () => {
    const belt = buildBelt3d(layout, ASTEROID_BELT.seed, 25);
    const points = createBeltPoints(25);
    updateBeltPositions(points, belt, 1234);
    const attr = points.geometry.getAttribute('position');
    for (let i = 0; i < 25; i++) {
      const x = attr.getX(i);
      const y = attr.getY(i);
      const z = attr.getZ(i);
      expect(Math.hypot(x, y, z)).toBeCloseTo(belt[i].orbitRadius, 4);
      expect(Math.abs(z)).toBeLessThanOrEqual(
        belt[i].orbitRadius * Math.sin(belt[i].inclinationRad) + 1e-9,
      );
    }
  });
});
