import { useEffect, useRef, useState } from 'react';
import { buildAsteroidBelt } from '../render/asteroidBelt';
import { Camera } from '../render/camera';
import { drawScene } from '../render/drawScene';
import { PointerInteraction } from './pointerInteraction';
import type { SpeedMultiplier } from '../sim/clock';
import { ASTEROID_BELT, COMETS } from '../sim/data';
import { formatSimDate, timestampToSimDays } from '../sim/formatDate';
import { Simulation } from '../sim/simulation';
import type { ScaleMode } from '../sim/types';

const DATE_UPDATE_INTERVAL_FRAMES = 15;

export function useSimulation(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [multiplier, setMultiplierState] = useState<SpeedMultiplier>(1);
  const [paused, setPaused] = useState(false);
  const [mode, setModeState] = useState<ScaleMode>('schematic');
  const [date, setDate] = useState(() => formatSimDate(timestampToSimDays(Date.now())));
  const [cometsEnabled, setCometsEnabledState] = useState(false);
  const [selectedComet, setSelectedComet] = useState<string | null>(null);
  const simRef = useRef<Simulation | null>(null);
  const applyModeRef = useRef<(m: ScaleMode) => void>(() => {});
  const cometsEnabledRef = useRef(false);
  const selectedCometRef = useRef<string | null>(null);
  const pendingCometFrameRef = useRef<string | null>(null);

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

    let currentMode: ScaleMode = 'schematic';
    let asteroids = buildAsteroidBelt(
      sim.layout,
      ASTEROID_BELT.seed,
      ASTEROID_BELT.count,
      currentMode,
    );
    let pendingMode: ScaleMode | null = null;
    applyModeRef.current = (m: ScaleMode) => {
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
      if (!fitted && width > 0 && height > 0) {
        camera.fitToView(sim.extent(currentMode), width, height);
        fitted = true;
      }
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
        asteroids = buildAsteroidBelt(
          sim.layout,
          ASTEROID_BELT.seed,
          ASTEROID_BELT.count,
          currentMode,
        );
        camera.fitToView(sim.extent(currentMode), width, height);
      }
      const frameComet = pendingCometFrameRef.current;
      if (frameComet !== null && width > 0 && height > 0) {
        pendingCometFrameRef.current = null;
        const extent = sim.cometExtent(frameComet);
        if (extent > 0) camera.fitToView(extent, width, height);
      }
      const cometPathRender = selectedCometRef.current && cometsEnabledRef.current
        ? sim.cometPath(selectedCometRef.current)
        : null;
      const snapshot = sim.snapshot(currentMode);
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
        sim.orbitPaths(currentMode),
        cometPathRender,
      );
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
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [canvasRef]);

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

  const setMode = (m: ScaleMode) => {
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
    }
  };

  const selectComet = (name: string | null) => {
    selectedCometRef.current = name;
    setSelectedComet(name);
    if (name) {
      applyModeRef.current('toScale');
      setModeState('toScale');
      pendingCometFrameRef.current = name;
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
