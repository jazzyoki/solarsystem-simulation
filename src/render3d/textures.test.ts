// @vitest-environment node

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BODY_TEXTURE_FILES, SATURN_RING_FILE, saturnRingUrl, textureUrl } from './textures';

const texturesDir = fileURLToPath(new URL('../../public/textures/', import.meta.url));

describe('texture registry', () => {
  it('maps the sun, the 8 planets, and the Moon', () => {
    expect(Object.keys(BODY_TEXTURE_FILES).sort()).toEqual([
      'Earth', 'Jupiter', 'Mars', 'Mercury', 'Moon',
      'Neptune', 'Saturn', 'Sun', 'Uranus', 'Venus',
    ]);
  });

  it('builds URLs under /textures and returns null for unmapped bodies', () => {
    expect(textureUrl('Earth')).toBe('/textures/2k_earth_daymap.jpg');
    expect(saturnRingUrl()).toBe('/textures/2k_saturn_ring_alpha.png');
    expect(textureUrl('Pluto')).toBeNull();
    expect(textureUrl('Halley')).toBeNull();
  });

  it('has every registered file on disk', () => {
    for (const [name, file] of Object.entries(BODY_TEXTURE_FILES)) {
      expect(existsSync(texturesDir + file), `${name}: ${file}`).toBe(true);
    }
    expect(existsSync(texturesDir + SATURN_RING_FILE)).toBe(true);
  });
});
