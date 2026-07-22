import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const title = 'Micro Solar System Simulation';
const description = 'Explore an interactive model of the Solar System with moving planets, moons, and famous comets.';
const siteUrl = 'https://solar.yokicloud.net/';
const imageUrl = 'https://solar.yokicloud.net/social-preview.png';

describe('social metadata', () => {
  let document: Document;

  beforeAll(() => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    document = new DOMParser().parseFromString(html, 'text/html');
  });

  const meta = (key: string) =>
    document.querySelector<HTMLMetaElement>(`meta[property="${key}"], meta[name="${key}"]`)?.content;

  it('sets the document identity and canonical URL', () => {
    expect(document.title).toBe(title);
    expect(meta('description')).toBe(description);
    expect(meta('theme-color')).toBe('#071b21');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(siteUrl);
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute('href')).toBe('/favicon.svg');
  });

  it('provides complete Open Graph metadata', () => {
    expect(meta('og:type')).toBe('website');
    expect(meta('og:url')).toBe(siteUrl);
    expect(meta('og:title')).toBe(title);
    expect(meta('og:description')).toBe(description);
    expect(meta('og:image')).toBe(imageUrl);
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    expect(meta('og:image:alt')).toBe('Micro Solar System Simulation with stylized planets, orbital rings, and a comet');
  });

  it('provides a large Twitter Card using the same copy and image', () => {
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('twitter:title')).toBe(title);
    expect(meta('twitter:description')).toBe(description);
    expect(meta('twitter:image')).toBe(imageUrl);
    expect(meta('twitter:image:alt')).toBe('Micro Solar System Simulation with stylized planets, orbital rings, and a comet');
  });
});
