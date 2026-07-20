import { describe, expect, it, vi, type Mock } from 'vitest';
import { MOON_STYLE, PLANETS } from '../sim/data';
import { Simulation } from '../sim/simulation';
import { Camera } from './camera';
import { drawScene } from './drawScene';
import { moonOpacity } from './visibility';

type MockCtx = CanvasRenderingContext2D & {
  globalAlphaSetter: Mock<(v: number) => void>;
};

function createMockCtx(): MockCtx {
  const fns = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  const ctx = Object.assign(
    { fillStyle: '', strokeStyle: '', font: '', lineWidth: 0 },
    fns,
  ) as unknown as MockCtx;

  const globalAlphaSetter = vi.fn((v: number) => {}) as Mock<(v: number) => void>;
  Object.defineProperty(ctx, 'globalAlpha', {
    get() {
      const calls = globalAlphaSetter.mock.calls;
      return calls.length > 0 ? calls[calls.length - 1][0] : 1;
    },
    set(v: number) {
      globalAlphaSetter(v);
    },
    enumerable: true,
    configurable: true,
  });
  ctx.globalAlphaSetter = globalAlphaSetter;

  return ctx;
}

describe('drawScene', () => {
  it('draws the background, planets (not moons), guides, and planet labels when zoomed out', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(1025, 800, 600);
    const ctx = createMockCtx();

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600);

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    // 9 bodies (sun + 8 planets) + 1 sun glow + 8 planet orbit guides + 6 moon bubble guides
    expect(ctx.arc).toHaveBeenCalledTimes(24);
    // Only planet labels; moon labels are hidden at this zoom.
    expect(ctx.fillText).toHaveBeenCalledTimes(8);
    expect(vi.mocked(ctx.fillText).mock.calls.map((c) => c[0])).toEqual(
      PLANETS.map((p) => p.name),
    );
  });

  it('shows moons and moon labels when zoomed in enough', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(80, 800, 600);
    camera.scale *= 8;
    const ctx = createMockCtx();

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600);

    // 107 bodies + 1 sun glow + 8 orbit guides + 6 moon bubble guides.
    expect(ctx.arc).toHaveBeenCalledTimes(122);
    expect(vi.mocked(ctx.fillText).mock.calls.some((c) => c[0] === 'Moon')).toBe(true);

    // Find the Moon body arc and verify it is wrapped in save()/restore()
    // with globalAlpha set between them.
    const expectedMoonRadius = Math.max(MOON_STYLE.bodyRadius * camera.scale, 0.75);
    const moonArcIndex = vi.mocked(ctx.arc).mock.calls.findIndex(
      (c) => typeof c[2] === 'number' && Math.abs(c[2] - expectedMoonRadius) < 1e-9,
    );
    expect(moonArcIndex).toBeGreaterThanOrEqual(0);

    const moonArcOrder = vi.mocked(ctx.arc).mock.invocationCallOrder[moonArcIndex];
    const saveOrder = Math.max(
      ...vi.mocked(ctx.save).mock.invocationCallOrder.filter((o) => o < moonArcOrder),
    );
    const restoreOrder = Math.min(
      ...vi.mocked(ctx.restore).mock.invocationCallOrder.filter((o) => o > moonArcOrder),
    );

    expect(saveOrder).toBeGreaterThan(0);
    expect(restoreOrder).toBeGreaterThan(saveOrder);

    const alphaCallIndex = ctx.globalAlphaSetter.mock.invocationCallOrder.findIndex(
      (o) => o > saveOrder && o < moonArcOrder,
    );
    expect(alphaCallIndex).toBeGreaterThanOrEqual(0);

    const alphaValue = ctx.globalAlphaSetter.mock.calls[alphaCallIndex][0];
    expect(alphaValue).toBeGreaterThan(0);

    const expectedOpacity = moonOpacity(
      sim.layout.planets['Earth'].bubbleRadius * camera.scale * 2,
      { width: 800, height: 600 },
    );
    expect(alphaValue).toBeCloseTo(expectedOpacity, 10);
  });
});
