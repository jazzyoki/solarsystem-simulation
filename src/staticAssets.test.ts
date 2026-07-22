import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('static sharing assets', () => {
  it('provides a 1200 x 630 PNG social preview', () => {
    const png = readFileSync(join(process.cwd(), 'public/social-preview.png'));

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('provides a scalable favicon with the compact solar-system artwork', () => {
    const svg = readFileSync(join(process.cwd(), 'public/favicon.svg'), 'utf8');
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');

    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(document.querySelector('[aria-label="Micro Solar System Simulation"]')).not.toBeNull();
  });
});
