import * as THREE from 'three';
import type { BodySnapshot3D } from '../sim/simulation';
import { saturnRingUrl, textureUrl } from './textures';

const SPHERE_WIDTH_SEGMENTS = 32;
const SPHERE_HEIGHT_SEGMENTS = 16;
const SATURN_RING_INNER_FACTOR = 1.24;
const SATURN_RING_OUTER_FACTOR = 2.27;
const SATURN_RING_TILT_RAD = (26.7 * Math.PI) / 180;
const SUN_GLOW_SCALE = 6;

type BodyMaterial = THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;

function applyTexture(material: BodyMaterial, url: string, loader: THREE.TextureLoader): void {
  loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    material.map = tex;
    material.color.set('#ffffff'); // stop tinting once the real map arrives
    material.needsUpdate = true;
  });
}

/** Soft additive-looking glow sprite behind the sun (canvas radial gradient). */
function createSunGlow(radius: number): THREE.Sprite {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 204, 51, 0.5)');
    g.addColorStop(1, 'rgba(255, 204, 51, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    material.map = new THREE.CanvasTexture(canvas);
  }
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(radius * SUN_GLOW_SCALE);
  return sprite;
}

function createSaturnRing(bodyRadius: number, loader: THREE.TextureLoader): THREE.Mesh {
  const inner = bodyRadius * SATURN_RING_INNER_FACTOR;
  const outer = bodyRadius * SATURN_RING_OUTER_FACTOR;
  const geometry = new THREE.RingGeometry(inner, outer, 64);
  // Remap UVs so u runs radially — ring alpha maps are radial strips.
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 1);
  }
  const material = new THREE.MeshBasicMaterial({
    color: '#e0c38b',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
  applyTexture(material, saturnRingUrl(), loader);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = SATURN_RING_TILT_RAD;
  return mesh;
}

/**
 * Sphere (+ glow for the Sun, + ring for Saturn) in a group named after the
 * body. Renders immediately in the body's flat color; swaps to its texture
 * map when the async load completes.
 */
export function createBodyObject(body: BodySnapshot3D, loader: THREE.TextureLoader): THREE.Group {
  const geometry = new THREE.SphereGeometry(
    body.bodyRadius,
    SPHERE_WIDTH_SEGMENTS,
    SPHERE_HEIGHT_SEGMENTS,
  );
  const unlit = body.kind === 'sun' || body.kind === 'comet';
  const material: BodyMaterial = unlit
    ? new THREE.MeshBasicMaterial({ color: body.color })
    : new THREE.MeshStandardMaterial({ color: body.color, roughness: 1, metalness: 0 });
  const url = textureUrl(body.name);
  if (url) applyTexture(material, url, loader);

  const group = new THREE.Group();
  group.name = body.name;
  group.add(new THREE.Mesh(geometry, material));
  if (body.kind === 'sun') group.add(createSunGlow(body.bodyRadius));
  if (body.name === 'Saturn') group.add(createSaturnRing(body.bodyRadius, loader));
  return group;
}
