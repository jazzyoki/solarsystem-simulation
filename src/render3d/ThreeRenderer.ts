import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BodySnapshot3D, CometPath3DRender, Snapshot3D } from '../sim/simulation';
import type { Vec3 } from '../sim/types';
import { createBodyObject } from './bodies';
import { createBeltPoints, updateBeltPositions, type BeltAsteroid3D } from './belt';
import { createControls } from './controls';
import { createCometPathLine, createOrbitLine } from './orbits';

const BACKGROUND = 0x0a0e1a;
const AMBIENT_COLOR = 0x333344;
const AMBIENT_INTENSITY = 1.2;
const SUN_LIGHT_INTENSITY = 2.5;
const CAMERA_FOV_DEG = 50;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 200000;
const TAIL_COLOR = 0xdcf0ff;
const TAIL_OPACITY = 0.5;
const TAIL_MIN_WORLD = 30;
const TAIL_MAX_WORLD = 200;
const TAIL_SCALE = 20000;

/**
 * Imperative WebGL backend for the 3D view mode. Mirrors drawScene's role:
 * one sync() + render() per RAF tick. World axes match the sim (x/y ecliptic,
 * z north); the camera is z-up.
 */
export class ThreeRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private loader = new THREE.TextureLoader();
  private bodyObjects = new Map<string, THREE.Group>();
  private belt: BeltAsteroid3D[];
  private beltPoints: THREE.Points;
  private cometLine: { key: string; line: THREE.Line } | null = null;
  private tailLine: THREE.Line;

  constructor(canvas: HTMLCanvasElement, orbitPaths: Vec3[][], belt: BeltAsteroid3D[], extent: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.scene.background = new THREE.Color(BACKGROUND);
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, CAMERA_NEAR, CAMERA_FAR);
    this.camera.up.set(0, 0, 1);
    this.controls = createControls(this.camera, canvas);

    this.scene.add(new THREE.AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY));
    // decay 0: stylized — planets stay lit at real distances.
    this.scene.add(new THREE.PointLight(0xffffff, SUN_LIGHT_INTENSITY, 0, 0));

    for (const path of orbitPaths) this.scene.add(createOrbitLine(path));

    this.belt = belt;
    this.beltPoints = createBeltPoints(belt.length);
    this.scene.add(this.beltPoints);

    const tailGeometry = new THREE.BufferGeometry();
    tailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tailLine = new THREE.Line(
      tailGeometry,
      new THREE.LineBasicMaterial({ color: TAIL_COLOR, transparent: true, opacity: TAIL_OPACITY }),
    );
    this.tailLine.visible = false;
    this.tailLine.frustumCulled = false;
    this.scene.add(this.tailLine);

    this.resetView(extent);
  }

  setSize(width: number, height: number, dpr: number): void {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  /** Frames a world radius: focus on the Sun, ~30° above the ecliptic. */
  resetView(extent: number): void {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, -extent * 1.2, extent * 0.7);
    this.camera.lookAt(0, 0, 0);
  }

  sync(snap: Snapshot3D, cometPath: CometPath3DRender | null, cometKey: string | null): void {
    const seen = new Set<string>();
    let comet: BodySnapshot3D | null = null;
    for (const body of snap.bodies) {
      seen.add(body.name);
      let obj = this.bodyObjects.get(body.name);
      if (!obj) {
        obj = createBodyObject(body, this.loader);
        this.bodyObjects.set(body.name, obj);
        this.scene.add(obj);
      }
      obj.visible = true;
      obj.position.set(body.x, body.y, body.z);
      if (body.kind === 'comet') comet = body;
    }
    for (const [name, obj] of this.bodyObjects) {
      if (!seen.has(name)) obj.visible = false;
    }

    this.tailLine.visible = comet !== null;
    if (comet) this.updateTail(comet);

    if (this.cometLine && (!cometPath || this.cometLine.key !== cometKey)) {
      this.scene.remove(this.cometLine.line);
      this.cometLine.line.geometry.dispose();
      (this.cometLine.line.material as THREE.Material).dispose();
      this.cometLine = null;
    }
    if (cometPath && cometKey && !this.cometLine) {
      const line = createCometPathLine(cometPath.points, cometPath.color);
      this.cometLine = { key: cometKey, line };
      this.scene.add(line);
    }

    updateBeltPositions(this.beltPoints, this.belt, snap.simDays);
  }

  private updateTail(comet: BodySnapshot3D): void {
    const r = Math.hypot(comet.x, comet.y, comet.z) || 1;
    const len = Math.max(TAIL_MIN_WORLD, Math.min(TAIL_MAX_WORLD, TAIL_SCALE / r));
    const attr = this.tailLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.setXYZ(0, comet.x, comet.y, comet.z);
    attr.setXYZ(
      1,
      comet.x + (comet.x / r) * len,
      comet.y + (comet.y / r) * len,
      comet.z + (comet.z / r) * len,
    );
    attr.needsUpdate = true;
  }

  render(): void {
    this.controls.update(); // damping needs a per-frame tick
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.controls.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as Partial<THREE.Mesh> & THREE.Object3D;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => disposeMaterial(m));
      else if (material) disposeMaterial(material);
    });
    this.renderer.dispose();
  }
}

function disposeMaterial(material: THREE.Material): void {
  const mapped = material as THREE.Material & { map?: THREE.Texture | null };
  mapped.map?.dispose();
  material.dispose();
}
