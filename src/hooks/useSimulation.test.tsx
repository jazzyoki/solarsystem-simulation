import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AXIAL_SPIN_CUTOFF_MULTIPLIER, SimClock } from '../sim/clock';
import { Camera } from '../render/camera';
import { useSimulation } from './useSimulation';

vi.mock('../render/drawScene', () => ({ drawScene: vi.fn() }));

// Shared with the `../render3d` mock factory below via vi.hoisted, since
// factories can't close over ordinary top-level `let`/`const` bindings.
const { spinGatingCalls } = vi.hoisted(() => ({ spinGatingCalls: [] as string[] }));

vi.mock('../render3d', () => {
  class StubThreeRenderer {
    setSize() {}
    resetView() {}
    setFocus() {}
    setSpinEnabled(enabled: boolean) {
      spinGatingCalls.push(enabled ? 'setSpinEnabled:true' : 'setSpinEnabled:false');
    }
    sync() {
      spinGatingCalls.push('sync');
    }
    render() {}
    dispose() {}
  }
  return { ThreeRenderer: StubThreeRenderer, buildBelt3d: () => [] };
});

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

function pointerEvent(
  type: string,
  { pointerId, pointerType, ...init }: MouseEventInit & { pointerId: number; pointerType: string },
): Event {
  const event = new MouseEvent(type, init);
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  return event;
}

function TestSimulation() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useSimulation(canvasRef);
  return <canvas ref={canvasRef} />;
}

describe('useSimulation pointer input', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).setPointerCapture;
  });

  it('pans for touch contact even when pointerdown reports no changed button', () => {
    const panBy = vi.spyOn(Camera.prototype, 'panBy');
    const { container } = render(<TestSimulation />);
    const canvas = container.querySelector('canvas')!;

    canvas.dispatchEvent(
      pointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'touch',
        button: -1,
        clientX: 100,
        clientY: 100,
      }),
    );
    canvas.dispatchEvent(
      pointerEvent('pointermove', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 130,
        clientY: 120,
      }),
    );

    expect(panBy).toHaveBeenCalledWith(30, 20);
  });

  it('seekToDate pauses simulation and updates date', () => {
    let hookState: any;

    function TestSeekToDate() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef);
      return <canvas ref={canvasRef} />;
    }

    render(<TestSeekToDate />);

    act(() => {
      hookState.seekToDate(789);
    });

    expect(hookState.paused).toBe(true);
    expect(hookState.date).toBe('2028-02-29');
  });

  it('starts on today\'s UTC date and running', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 6, 21, 12, 0, 0));
    let hookState: any;

    function TestStartup() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef);
      return <canvas ref={canvasRef} />;
    }

    render(<TestStartup />);

    expect(hookState.date).toBe('2026-07-21');
    expect(hookState.paused).toBe(false);
  });

  it('goToToday seeks to today and pauses', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 6, 21, 12, 0, 0));
    let hookState: any;

    function TestToday() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef);
      return <canvas ref={canvasRef} />;
    }

    render(<TestToday />);

    act(() => {
      hookState.goToToday();
    });

    expect(hookState.date).toBe('2026-07-21');
    expect(hookState.paused).toBe(true);
  });

  it('seeds clock to today at startup', () => {
    const setSimDaysSpy = vi.spyOn(SimClock.prototype, 'setSimDays');
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 6, 21, 12, 0, 0));

    render(<TestSimulation />);

    expect(setSimDaysSpy).toHaveBeenCalledWith(201);
  });

  it('defaults comets off with no selection', () => {
    let hookState: any;

    function TestDefaults() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef);
      return <canvas ref={canvasRef} />;
    }

    render(<TestDefaults />);

    expect(hookState.cometsEnabled).toBe(false);
    expect(hookState.selectedComet).toBeNull();
  });

  it('selecting a comet switches to to-scale mode', () => {
    let hookState: any;

    function TestSelectComet() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef);
      return <canvas ref={canvasRef} />;
    }

    render(<TestSelectComet />);

    act(() => {
      hookState.selectComet('Halley');
    });

    expect(hookState.mode).toBe('toScale');
    expect(hookState.selectedComet).toBe('Halley');
  });

  it('deselecting a comet clears the selection (restoring planet-scale framing)', () => {
    let hookState: any;

    function TestDeselectComet() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef);
      return <canvas ref={canvasRef} />;
    }

    render(<TestDeselectComet />);

    act(() => {
      hookState.selectComet('Halley');
    });
    expect(hookState.selectedComet).toBe('Halley');

    act(() => {
      hookState.selectComet(null);
    });

    expect(hookState.selectedComet).toBeNull();
  });

  it('jumpToPerihelion seeks to the comet Tp and pauses', () => {
    let hookState: any;

    function TestJumpToPerihelion() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef);
      return <canvas ref={canvasRef} />;
    }

    render(<TestJumpToPerihelion />);

    act(() => {
      hookState.selectComet('Encke');
    });
    act(() => {
      hookState.jumpToPerihelion();
    });

    expect(hookState.paused).toBe(true);
  });

  it('accepts the threeD view mode', () => {
    let hookState: any;

    function TestThreeD() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef, canvas3dRef);
      return (
        <>
          <canvas ref={canvasRef} />
          <canvas ref={canvas3dRef} />
        </>
      );
    }

    render(<TestThreeD />);

    act(() => {
      hookState.setMode('threeD');
    });

    expect(hookState.mode).toBe('threeD');
  });

  it('selecting a comet keeps 3D mode (no forced switch to to-scale)', () => {
    let hookState: any;

    function TestCometIn3D() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef, canvas3dRef);
      return (
        <>
          <canvas ref={canvasRef} />
          <canvas ref={canvas3dRef} />
        </>
      );
    }

    render(<TestCometIn3D />);

    act(() => {
      hookState.setMode('threeD');
    });
    act(() => {
      hookState.selectComet('Halley');
    });

    expect(hookState.mode).toBe('threeD');
    expect(hookState.selectedComet).toBe('Halley');
  });
});

describe('useSimulation 3D spin-gating wiring', () => {
  // Unlike the pointer-input describe above, this suite needs the RAF loop
  // body to actually run (to reach the threeD branch that awaits the lazy
  // `../render3d` import), so requestAnimationFrame captures its callback
  // instead of no-opping, and the size source needs a non-zero client rect
  // so the loop's `width > 0 && height > 0` gate lets the pending mode
  // switch through.
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    spinGatingCalls.length = 0;
    rafCallback = null;
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        rafCallback = cb;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 600,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
  });

  it('sets spin-enabled from the current multiplier before sync, each frame, and toggles at the speed cutoff', async () => {
    let hookState: any;

    function TestSpinWiring() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
      hookState = useSimulation(canvasRef, canvas3dRef);
      return (
        <>
          <canvas ref={canvasRef} />
          <canvas ref={canvas3dRef} />
        </>
      );
    }

    render(<TestSpinWiring />);

    act(() => {
      hookState.setMode('threeD');
    });

    // Drive frames while flushing microtasks: the first frame picks up the
    // pending mode switch and kicks off the lazy `../render3d` import, whose
    // `.then()` (which constructs the stub ThreeRenderer) resolves a
    // microtask or two later. Once it does, the next frame reaches the
    // `if (threeRenderer)` branch and records setSpinEnabled/sync calls.
    await act(async () => {
      for (let i = 0; i < 10 && spinGatingCalls.length === 0; i++) {
        rafCallback?.(i * 16);
        await Promise.resolve();
      }
    });

    // Default multiplier (86_400, "1s = 24 h") is below the cutoff, so spin
    // should be enabled, and it must be set before sync() runs each frame.
    expect(spinGatingCalls.length).toBeGreaterThan(0);
    const firstSpinIdx = spinGatingCalls.indexOf('setSpinEnabled:true');
    const firstSyncIdx = spinGatingCalls.indexOf('sync');
    expect(firstSpinIdx).toBeGreaterThanOrEqual(0);
    expect(firstSyncIdx).toBeGreaterThan(firstSpinIdx);

    // Now select a multiplier at the cutoff: spin must switch to disabled.
    spinGatingCalls.length = 0;
    act(() => {
      hookState.setMultiplier(AXIAL_SPIN_CUTOFF_MULTIPLIER);
    });
    act(() => {
      rafCallback?.(999);
    });

    expect(spinGatingCalls[0]).toBe('setSpinEnabled:false');
    expect(spinGatingCalls).toContain('sync');
    expect(spinGatingCalls.indexOf('setSpinEnabled:false')).toBeLessThan(
      spinGatingCalls.indexOf('sync'),
    );
  });
});
