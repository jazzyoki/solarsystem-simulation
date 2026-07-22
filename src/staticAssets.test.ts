import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

  it.each(['artwork/social-preview.svg', 'public/favicon.svg'])('points the comet tail away from the Sun in %s', (path) => {
    const svg = readFileSync(join(process.cwd(), path), 'utf8');
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const sun = document.querySelector('[data-body="sun"]');
    const comet = document.querySelector('[data-body="comet"]');
    const tail = document.querySelector('[data-comet-tail]');

    if (!sun || !comet || !tail) throw new Error('Comet geometry markers are missing');

    const sunX = Number(sun.getAttribute('cx'));
    const sunY = Number(sun.getAttribute('cy'));
    const cometX = Number(comet.getAttribute('cx'));
    const cometY = Number(comet.getAttribute('cy'));
    const tailStart = tail.getAttribute('d')?.match(/^M\s*([\d.]+)\s+([\d.]+)/);

    if (!tailStart) throw new Error('Comet tail must start with an absolute move');

    const distanceFromSun = (x: number, y: number) => Math.hypot(x - sunX, y - sunY);
    expect(distanceFromSun(Number(tailStart[1]), Number(tailStart[2]))).toBeGreaterThan(
      distanceFromSun(cometX, cometY),
    );
    expect(tail.getAttribute('d')?.trim().endsWith(`${cometX} ${cometY}`)).toBe(true);
  });

  it('reproduces the committed preview without relying on host fonts', () => {
    const root = process.cwd();
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'social-preview-'));
    const output = join(temporaryDirectory, 'social-preview.png');
    const fontConfig = join(temporaryDirectory, 'fonts.conf');
    writeFileSync(fontConfig, '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig/>');

    try {
      execFileSync(process.execPath, [join(root, 'scripts/render-social-preview.mjs'), output], {
        cwd: root,
        env: { ...process.env, FONTCONFIG_FILE: fontConfig },
        stdio: 'pipe',
      });
      expect(readFileSync(output)).toEqual(readFileSync(join(root, 'public/social-preview.png')));
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
