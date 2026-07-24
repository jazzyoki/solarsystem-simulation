import { useEffect, useRef, useState } from 'react';
import { buildAsteroidBelt } from '../render/asteroidBelt';
import { Camera } from '../render/camera';
import { drawScene } from '../render/drawScene';
import { PointerInteraction } from './pointerInteraction';
import type { SpeedMultiplier } from '../sim/clock';
import { ASTEROID_BELT, COMETS } from '../sim/data';
import { formatSimDate, timestampToSimDays } from '../sim/formatDate';
import { Simulation } from '../sim/simulation';
import type { CometPath3DRender } from '../sim/simulation';
import type { ViewMode } from '../sim/types';
import type { ThreeRenderer } from '../render3d';

const DATE_UPDATE_INTERVAL_FRAMES = 15;

export function useSimulation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  canvas3dRef?: React.RefObject<HTMLCanvasElement | null>,
) {
  const [multiplier, setMultiplierState] = useState<SpeedMultiplier>(1);
  const [paused, setPaused] = useState(false);
  const [mode, setModeState] = useState<ViewMode>('schematic');
  const [date, setDate] = useState(() => formatSimDate(timestampToSimDays(Date.now())));
  const [cometsEnabled, setCometsEnabledState] = useState(false);
  const [selectedComet, setSelectedComet] = useState<string | null>(null);
  const simRef = useRef<Simulation | null>(null);
  const applyModeRef = useRef<(m: ViewMode) => void>(() => {});
  const cometsEnabledRef = useRef(false);
  const selectedCometRef = useRef<string | null>(null);
  const pendingCometFrameRef = useRef<string | null>(null);
  const pendingResetFrameRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sim = new Simulation();
    sim.clock.setSimDays(timestampToSimDays(Date.now()));
    simRef.current = sim;
    const camera = new Camera();
    const pointerInteraction = new PointerInteraction(camera);
    const canvas3d = canvas3dRef?.current ?? null;

    let currentMode: ViewMode = 'schematic';
    let asteroids = buildAsteroidBelt(
      sim.layout,
      ASTEROID_BELT.seed,
      ASTEROID_BELT.count,
      currentMode,
    );
    let pendingMode: ViewMode | null = null;
    let threeRenderer: ThreeRenderer | null = null;
    let threeLoading = false;
    let disposed = false;
    applyModeRef.current = (m: ViewMode) => {
      pendingMode = m;
    };

    let width = 0;
    let height = 0;
    let fitted = false;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!fitted && width > 0 && height > 0 && currentMode !== 'threeD') {
        const scaleMode = currentMode;
        camera.fitToView(sim.extent(scaleMode), width, height);
        fitted = true;
      }
      threeRenderer?.setSize(width, height, dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      camera.zoomAt(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        e.deltaY < 0 ? 1.1 : 1 / 1.1,
      );
    };
    const toCanvasPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerInteraction.pointerDown(e.pointerId, toCanvasPoint(e));
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerInteraction.activeCount() === 0) return;
      pointerInteraction.pointerMove(e.pointerId, toCanvasPoint(e));
    };

    const onPointerUp = (e: PointerEvent) => {
      pointerInteraction.pointerUp(e.pointerId);
    };

    const onPointerCancel = (e: PointerEvent) => {
      pointerInteraction.pointerUp(e.pointerId);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    let rafId = 0;
    let lastTime = performance.now();
    let framesSinceDateUpdate = 0;
    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      sim.advance(dt);
      if (pendingMode !== null && width > 0 && height > 0) {
        currentMode = pendingMode;
        pendingMode = null;
        if (currentMode !== 'threeD') {
          asteroids = buildAsteroidBelt(
            sim.layout,
            ASTEROID_BELT.seed,
            ASTEROID_BELT.count,
            currentMode,
          );
          camera.fitToView(sim.extent(currentMode), width, height);
        } else {
          threeRenderer?.resetView(sim.extent('toScale'));
        }
      }
      if (currentMode === 'threeD') {
        if (!threeRenderer && !threeLoading && canvas3d) {
          threeLoading = true;
          void import('../render3d').then((m) => {
            if (disposed) return;
            const belt = m.buildBelt3d(sim.layout, ASTEROID_BELT.seed, ASTEROID_BELT.count);
            threeRenderer = new m.ThreeRenderer(
              canvas3d,
              sim.orbitPaths3D(),
              belt,
              sim.extent('toScale'),
            );
            threeRenderer.setSize(width, height, window.devicePixelRatio || 1);
            threeLoading = false;
          });
        }
        if (threeRenderer) {
          const frameComet3d = pendingCometFrameRef.current;
          if (frameComet3d !== null) {
            pendingCometFrameRef.current = null;
            const extent = sim.cometExtent(frameComet3d);
            if (extent > 0) threeRenderer.resetView(extent);
          }
          if (pendingResetFrameRef.current) {
            pendingResetFrameRef.current = false;
            threeRenderer.resetView(sim.extent('toScale'));
          }
          const snap3 = sim.snapshot3D();
          const cometName =
            cometsEnabledRef.current && selectedCometRef.current
              ? selectedCometRef.current
              : null;
          let path3: CometPath3DRender | null = null;
          if (cometName) {
            path3 = sim.cometPath3D(cometName);
            const body3 = sim.cometBody3D(cometName);
            if (body3) snap3.bodies.push(body3);
          }
          threeRenderer.sync(snap3, path3, cometName);
          threeRenderer.render();
        }
      } else {
        if (threeRenderer) {
          threeRenderer.dispose();
          threeRenderer = null;
        }
        const scaleMode = currentMode;
        const frameComet = pendingCometFrameRef.current;
        if (frameComet !== null && width > 0 && height > 0) {
          pendingCometFrameRef.current = null;
          const extent = sim.cometExtent(frameComet);
          if (extent > 0) camera.fitToView(extent, width, height);
        }
        if (pendingResetFrameRef.current && width > 0 && height > 0) {
          pendingResetFrameRef.current = false;
          camera.fitToView(sim.extent(scaleMode), width, height);
        }
        const cometPathRender = selectedCometRef.current && cometsEnabledRef.current
          ? sim.cometPath(selectedCometRef.current)
          : null;
        const snapshot = sim.snapshot(scaleMode);
        if (cometPathRender && selectedCometRef.current) {
          const body = sim.cometBody(selectedCometRef.current);
          if (body) snapshot.bodies.push(body);
        }
        drawScene(
          ctx,
          snapshot,
          sim.layout,
          camera,
          width,
          height,
          asteroids,
          sim.orbitPaths(scaleMode),
          cometPathRender,
        );
      }
      if (++framesSinceDateUpdate >= DATE_UPDATE_INTERVAL_FRAMES) {
        framesSinceDateUpdate = 0;
        setDate(formatSimDate(sim.clock.simDays));
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      disposed = true;
      threeRenderer?.dispose();
      threeRenderer = null;
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [canvasRef, canvas3dRef]);

  const setMultiplier = (m: SpeedMultiplier) => {
    simRef.current?.clock.setMultiplier(m);
    setMultiplierState(m);
  };

  const togglePause = () => {
    const clock = simRef.current?.clock;
    if (!clock) return;
    clock.setPaused(!clock.paused);
    setPaused(clock.paused);
  };

  const setMode = (m: ViewMode) => {
    applyModeRef.current(m);
    setModeState(m);
  };

  const seekToDate = (simDays: number) => {
    const clock = simRef.current?.clock;
    if (!clock) return;
    clock.setSimDays(simDays);
    clock.setPaused(true);
    setPaused(true);
    setDate(formatSimDate(simDays));
  };

  const goToToday = () => {
    seekToDate(timestampToSimDays(Date.now()));
  };

  const setCometsEnabled = (on: boolean) => {
    cometsEnabledRef.current = on;
    setCometsEnabledState(on);
    if (!on) {
      selectedCometRef.current = null;
      setSelectedComet(null);
      pendingResetFrameRef.current = true;
    }
  };

  const selectComet = (name: string | null) => {
    selectedCometRef.current = name;
    setSelectedComet(name);
    if (name) {
      if (mode === 'schematic') {
        applyModeRef.current('toScale');
        setModeState('toScale');
      }
      pendingCometFrameRef.current = name;
    } else {
      pendingResetFrameRef.current = true;
    }
  };

  const jumpToPerihelion = () => {
    const name = selectedCometRef.current;
    if (!name) return;
    const comet = COMETS.find((c) => c.name === name);
    if (comet) seekToDate(comet.perihelionTimeSimDays);
  };

  return {
    multiplier, paused, mode, date, setMultiplier, togglePause, setMode,
    seekToDate, goToToday,
    cometsEnabled, selectedComet, setCometsEnabled, selectComet, jumpToPerihelion,
  };
}
