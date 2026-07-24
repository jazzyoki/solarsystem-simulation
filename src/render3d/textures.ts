/** Base URL (under public/) where texture maps live. */
export const TEXTURE_BASE = '/textures';

/**
 * Equirectangular diffuse maps by body name (Solar System Scope, CC BY 4.0).
 * Bodies without an entry render in their flat data.ts color.
 */
export const BODY_TEXTURE_FILES: Record<string, string> = {
  Sun: '2k_sun.jpg',
  Mercury: '2k_mercury.jpg',
  Venus: '2k_venus_atmosphere.jpg',
  Earth: '2k_earth_daymap.jpg',
  Moon: '2k_moon.jpg',
  Mars: '2k_mars.jpg',
  Jupiter: '2k_jupiter.jpg',
  Saturn: '2k_saturn.jpg',
  Uranus: '2k_uranus.jpg',
  Neptune: '2k_neptune.jpg',
};

export const SATURN_RING_FILE = '2k_saturn_ring_alpha.png';

export function textureUrl(bodyName: string): string | null {
  const file = BODY_TEXTURE_FILES[bodyName];
  return file ? `${TEXTURE_BASE}/${file}` : null;
}

export function saturnRingUrl(): string {
  return `${TEXTURE_BASE}/${SATURN_RING_FILE}`;
}
