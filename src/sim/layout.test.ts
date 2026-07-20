import { describe, expect, it } from 'vitest';
import { MOONS, PLANETS } from './data';
import { computeLayout } from './layout';

const layout = computeLayout(PLANETS, MOONS);
const ordered = PLANETS.map((p) => layout.planets[p.name]);

describe('computeLayout', () => {
  it('gives Mercury the first orbit at radius 80', () => {
    expect(layout.planets.Mercury.orbitRadius).toBe(80);
  });

  it('has strictly increasing orbit radii', () => {
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].orbitRadius).toBeGreaterThan(ordered[i - 1].orbitRadius);
    }
  });

  it('moon bubbles never overlap the neighboring orbit', () => {
    for (let i = 1; i < ordered.length; i++) {
      const prevOuter = ordered[i - 1].orbitRadius + ordered[i - 1].bubbleRadius;
      const inner = ordered[i].orbitRadius - ordered[i].bubbleRadius;
      expect(inner, PLANETS[i].name).toBeGreaterThan(prevOuter);
    }
  });

  it('planets without moons have bubble radius 0', () => {
    expect(layout.planets.Mercury.bubbleRadius).toBe(0);
    expect(layout.planets.Venus.bubbleRadius).toBe(0);
  });

  it("places Earth's single moon at radius 12", () => {
    expect(layout.moons.Moon).toBe(12);
  });

  it('orders moon rings by absolute period', () => {
    // Jupiter bodyRadius 14: first ring = 20, last of 20 = 14 + 6 + 19*3 = 77
    expect(layout.moons.Metis).toBe(20);
    expect(layout.moons.Eupheme).toBe(77);
  });

  it('computes the Saturn bubble for 30 moons', () => {
    expect(layout.planets.Saturn.bubbleRadius).toBe(108);
  });
});
