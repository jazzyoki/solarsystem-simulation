import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawScene } from '../render/drawScene';
import { useSimulation } from './useSimulation';
import { Simulation } from '../sim/simulation';

vi.mock('../render/drawScene', () => ({ drawScene: vi.fn() }));
const { renderer } = vi.hoisted(() => ({ renderer: {
  setSize: vi.fn(), resetView: vi.fn(), setFocus: vi.fn(),
  setSpinEnabled: vi.fn(), sync: vi.fn(), render: vi.fn(), dispose: vi.fn(),
} }));
vi.mock('../render3d', () => ({
  ThreeRenderer: class { constructor() { Object.assign(this, renderer); } },
  buildBelt3d: () => [],
}));

let state: ReturnType<typeof useSimulation>;
let nextFrame: FrameRequestCallback;
let onResize: () => void;
let width: number;
let height: number;
let now: number;
function Harness() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const canvas3d = useRef<HTMLCanvasElement>(null);
  state = useSimulation(canvas, canvas3d);
  return <div><canvas ref={canvas} /><canvas ref={canvas3d} /></div>;
}
function frame() {
  act(() => { now += 16; nextFrame(now); });
}
function lastDraw() {
  return vi.mocked(drawScene).mock.calls.at(-1)!;
}

beforeEach(() => {
  vi.clearAllMocks();
  width = 1200;
  height = 800;
  now = performance.now();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { onResize = callback; }
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('comet mode transitions', () => {
  it('clears a selected comet when entering Schematic', () => {
    render(<Harness />);
    act(() => { state.setCometsEnabled(true); state.selectComet('Halley'); });
    frame();
    expect(state.mode).toBe('toScale');
    expect(lastDraw()[8]).not.toBeNull();
    act(() => state.setMode('schematic'));
    frame();
    expect(state.selectedComet).toBeNull();
    expect(state.cometsEnabled).toBe(true);
    expect(lastDraw()[7]![0].kind).toBe('circle');
    expect(lastDraw()[8]).toBeNull();
    expect(lastDraw()[1].bodies.some(body => body.kind === 'comet')).toBe(false);
  });

  it('discards pending comet framing when Schematic is requested before a frame', () => {
    render(<Harness />);
    frame();
    const scale = lastDraw()[3].scale;
    act(() => { state.setCometsEnabled(true); state.selectComet('Halley'); });
    act(() => state.setMode('schematic'));
    frame();
    expect(state.selectedComet).toBeNull();
    expect(lastDraw()[3].scale).toBe(scale);
    expect(lastDraw()[8]).toBeNull();
  });
});

describe('viewport resizing', () => {
  it('keeps the Sun centered when the viewport shrinks', () => {
    render(<Harness />);
    frame();
    const camera = lastDraw()[3];
    const scale = camera.scale;
    width = 390;
    height = 844;
    act(() => onResize());
    frame();
    expect(camera.worldToScreen({ x: 0, y: 0 })).toEqual({ x: 195, y: 422 });
    expect(camera.scale).toBe(scale);
  });

  it('preserves a panned world center across a temporary zero-size container', () => {
    render(<Harness />);
    frame();
    const camera = lastDraw()[3];
    camera.panBy(80, -40);
    camera.zoomAt({ x: 600, y: 400 }, 2);
    const center = camera.screenToWorld({ x: 600, y: 400 });
    const scale = camera.scale;
    width = 0;
    height = 0;
    act(() => onResize());
    width = 390;
    height = 844;
    act(() => onResize());
    frame();
    const resizedCenter = camera.screenToWorld({ x: 195, y: 422 });
    expect(resizedCenter.x).toBeCloseTo(center.x, 10);
    expect(resizedCenter.y).toBeCloseTo(center.y, 10);
    expect(camera.scale).toBe(scale);
  });
});

async function enter3D() {
  act(() => state.setMode('threeD'));
  frame();
  await act(async () => { await vi.dynamicImportSettled(); });
  frame();
}

describe('Sun navigation', () => {
  it('focuses the Sun as a body without resetting to the full-system view', async () => {
    render(<Harness />);
    await enter3D();
    renderer.resetView.mockClear();
    act(() => state.selectBody('Sun'));
    frame();
    expect(renderer.setFocus).toHaveBeenLastCalledWith('Sun');
    expect(state.focusedBody).toBe('Sun');
    expect(renderer.resetView).not.toHaveBeenCalled();
    frame();
    expect(renderer.setFocus).toHaveBeenLastCalledWith('Sun');
    expect(renderer.resetView).not.toHaveBeenCalled();
  });

  it('switches from a planet to the Sun without letting queued comet framing take over', async () => {
    render(<Harness />);
    await enter3D();
    act(() => state.selectBody('Earth'));
    frame();
    expect(renderer.setFocus).toHaveBeenLastCalledWith('Earth');
    renderer.resetView.mockClear();
    act(() => { state.setCometsEnabled(true); state.selectComet('Halley'); });
    act(() => state.selectBody('Sun'));
    frame();
    expect(renderer.setFocus).toHaveBeenLastCalledWith('Sun');
    expect(state.focusedBody).toBe('Sun');
    expect(renderer.resetView).not.toHaveBeenCalled();
    frame();
    expect(renderer.resetView).not.toHaveBeenCalled();
  });

  it('returns to the overview when the empty picker option releases the Sun', async () => {
    render(<Harness />);
    await enter3D();
    act(() => state.selectBody('Sun'));
    frame();
    renderer.resetView.mockClear();
    act(() => state.selectBody(null));
    frame();
    expect(state.focusedBody).toBeNull();
    expect(renderer.setFocus).toHaveBeenLastCalledWith(null);
    expect(renderer.resetView).toHaveBeenCalledTimes(1);
    expect(renderer.resetView).toHaveBeenLastCalledWith(new Simulation().extent('toScale'));
  });
});
