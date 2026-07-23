import { describe, expect, it, vi, type Mock } from 'vitest';
import { MOON_STYLE, PLANETS } from '../sim/data';
import { Simulation } from '../sim/simulation';
import { Camera } from './camera';
import { drawScene } from './drawScene';
import { moonOpacity } from './visibility';

type MockCtx = CanvasRenderingContext2D & {
  globalAlphaSetter: Mock<(v: number) => void>;
  strokeStyleSetter: Mock<(v: unknown) => void>;
};

function createMockCtx(): MockCtx {
  const fns = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  const ctx = Object.assign(
    { fillStyle: '', font: '', lineWidth: 0 },
    fns,
  ) as unknown as MockCtx;

  const globalAlphaSetter = vi.fn() as Mock<(v: number) => void>;
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

  // Track every value assigned to strokeStyle (not just the last one) so tests
  // can verify the comet path / tail were stroked with the correct color, even
  // though later drawing steps overwrite the property afterward.
  const strokeStyleSetter = vi.fn() as Mock<(v: unknown) => void>;
  Object.defineProperty(ctx, 'strokeStyle', {
    get() {
      const calls = strokeStyleSetter.mock.calls;
      return calls.length > 0 ? calls[calls.length - 1][0] : '';
    },
    set(v: unknown) {
      strokeStyleSetter(v);
    },
    enumerable: true,
    configurable: true,
  });
  ctx.strokeStyleSetter = strokeStyleSetter;

  return ctx;
}

describe('drawScene', () => {
  it('draws the background, planets (not moons), guides, and planet labels when zoomed out', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(1025, 800, 600);
    const ctx = createMockCtx();

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600, [], sim.orbitPaths());

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    // 10 bodies (sun + 9 major bodies) + 1 sun glow + 9 orbit guides + 7 moon bubble guides
    expect(ctx.arc).toHaveBeenCalledTimes(27);
    // Only major-body labels; moon labels are hidden at this zoom.
    expect(ctx.fillText).toHaveBeenCalledTimes(9);
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

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600, [], sim.orbitPaths());

    // 109 bodies + 1 sun glow + 9 orbit guides + 7 moon bubble guides.
    expect(ctx.arc).toHaveBeenCalledTimes(126);
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

  it('draws the asteroid belt when asteroids are passed', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(80, 800, 600);
    const ctx = createMockCtx();
    const belt = Array.from({ length: 400 }, (_, i) => ({
      radius: 1,
      orbitRadius: 250 + i,
      angleOffset: 0,
      periodDays: 1000,
    }));

    drawScene(ctx, sim.snapshot(), sim.layout, camera, 800, 600, belt, sim.orbitPaths());

    expect(ctx.arc).toHaveBeenCalledTimes(526); // 126 + 400 belt asteroids
  });

  it('draws rotated ellipse guides in to-scale mode', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(sim.extent('toScale'), 800, 600);
    const ctx = createMockCtx();

    drawScene(
      ctx,
      sim.snapshot('toScale'),
      sim.layout,
      camera,
      800,
      600,
      [],
      sim.orbitPaths('toScale'),
    );

    // One ellipse per major body; no circular orbit guides.
    expect(ctx.ellipse).toHaveBeenCalledTimes(9);
    // 10 bodies + 1 sun glow + 7 moon bubble guides, no orbit circles.
    expect(ctx.arc).toHaveBeenCalledTimes(18);
  });

  it('strokes the comet path in its class color', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(1000, 800, 600);
    const ctx = createMockCtx();
    const snap = { simDays: 0, bodies: [] };
    const cometPath = {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      color: 'red' as const,
    };

    drawScene(ctx, snap, sim.layout, camera, 800, 600, [], [], cometPath);

    // No orbit guides, asteroids, or bodies in this snapshot, so the only
    // stroke() call comes from drawing the comet path.
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    const strokeColors = ctx.strokeStyleSetter.mock.calls.map((c) => c[0]);
    expect(strokeColors).toContain('rgba(240, 90, 90, 0.85)');
    // moveTo for the first point, lineTo for each subsequent point.
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
  });

  it('strokes the comet path in green for non-hyperbolic classes', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(1000, 800, 600);
    const ctx = createMockCtx();
    const snap = { simDays: 0, bodies: [] };
    const cometPath = {
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
      color: 'green' as const,
    };

    drawScene(ctx, snap, sim.layout, camera, 800, 600, [], [], cometPath);

    const strokeColors = ctx.strokeStyleSetter.mock.calls.map((c) => c[0]);
    expect(strokeColors).toContain('rgba(90, 220, 130, 0.8)');
  });

  it('does not draw a comet path with fewer than 2 points', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(1000, 800, 600);
    const ctx = createMockCtx();
    const snap = { simDays: 0, bodies: [] };
    const cometPath = { points: [{ x: 0, y: 0 }], color: 'red' as const };

    drawScene(ctx, snap, sim.layout, camera, 800, 600, [], [], cometPath);

    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws a comet body with an anti-sunward tail and label', () => {
    const sim = new Simulation();
    const camera = new Camera();
    camera.fitToView(1000, 800, 600);
    const ctx = createMockCtx();
    const snap = {
      simDays: 0,
      bodies: [
        {
          name: 'Halley',
          x: 90,
          y: 0,
          bodyRadius: 3,
          color: '#dbeeff',
          kind: 'comet' as const,
        },
      ],
    };

    drawScene(ctx, snap, sim.layout, camera, 800, 600, [], [], null);

    // The exaggerated dot: one arc, filled with the comet's own color.
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    const expectedRadius = Math.max(3 * camera.scale, 1.5);
    const expectedCenter = camera.worldToScreen({ x: 90, y: 0 });
    expect(ctx.arc).toHaveBeenCalledWith(
      expectedCenter.x,
      expectedCenter.y,
      expectedRadius,
      0,
      Math.PI * 2,
    );

    // Label with the comet's name, offset from the dot.
    expect(vi.mocked(ctx.fillText).mock.calls).toContainEqual([
      'Halley',
      expectedCenter.x + expectedRadius + 4,
      expectedCenter.y - expectedRadius - 4,
    ]);

    // Anti-sunward tail: stroked in the tail color, pointing away from the
    // origin (the Sun) along the comet's own direction vector. Tail length is
    // in screen px (longer near the Sun, clamped): tailPx = min(60, max(12,
    // 90000 / helioDistance)). At helioDistance = 90, that clamps to 60px.
    const strokeColors = ctx.strokeStyleSetter.mock.calls.map((c) => c[0]);
    expect(strokeColors).toContain('rgba(220, 240, 255, 0.5)');
    const tailPx = 60;
    const expectedTailEnd = { x: expectedCenter.x + tailPx, y: expectedCenter.y };
    expect(vi.mocked(ctx.lineTo).mock.calls).toContainEqual([
      expectedTailEnd.x,
      expectedTailEnd.y,
    ]);
    // Anti-sunward: the tail moves in +x on screen, matching the comet's own
    // +x direction from the origin (away from the Sun), not toward it.
    expect(expectedTailEnd.x).toBeGreaterThan(expectedCenter.x);
  });
});
