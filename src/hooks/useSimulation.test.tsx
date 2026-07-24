import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimClock } from '../sim/clock';
import { Camera } from '../render/camera';
import { useSimulation } from './useSimulation';

vi.mock('../render/drawScene', () => ({ drawScene: vi.fn() }));

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
