import { describe, expect, it, vi } from 'vitest';
import { PLANETS } from '../sim/data';
import { Simulation } from '../sim/simulation';
import { Camera } from './camera';
import { drawScene } from './drawScene';

function createMockCtx() {
  const fns = {
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  return Object.assign(
    { fillStyle: '', strokeStyle: '', font: '', lineWidth: 0 },
    fns,
  ) as unknown as CanvasRenderingContext2D;
}

describe('drawScene', () => {
  it('draws the background, every body, all guides, and 8 planet labels', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(1025, 800, 600);
    const ctx = createMockCtx();

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600);

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    // 107 bodies + 1 sun glow + 8 planet orbit guides + 6 moon bubble guides
    expect(ctx.arc).toHaveBeenCalledTimes(122);
    expect(ctx.fillText).toHaveBeenCalledTimes(8);
    expect(vi.mocked(ctx.fillText).mock.calls.map((c) => c[0])).toEqual(
      PLANETS.map((p) => p.name),
    );
  });
});
