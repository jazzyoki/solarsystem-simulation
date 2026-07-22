# Social Preview and Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Comet Teal social preview, matching favicon, and complete sharing metadata for the deployed Micro Solar System Simulation.

**Architecture:** Keep crawler-facing assets static under `public/` so Vite copies them unchanged and social bots can fetch them without JavaScript. Store the editable social-card SVG under `artwork/`, render the committed PNG deterministically with a small Sharp script, and verify assets and metadata with focused Vitest tests.

**Tech Stack:** SVG, PNG, Sharp 0.34.3, Vite 5, Vitest 2, HTML Open Graph and Twitter Card metadata.

## Global Constraints

- Social preview visual direction is the approved **Comet Teal** concept.
- Social image must be PNG at exactly 1200 x 630 pixels.
- Social image public URL must be `https://solar.yokicloud.net/social-preview.png`.
- Favicon must be a text-free SVG using the same dark teal, warm Sun, orbit, planet, and comet cues.
- Document title must be `Micro Solar System Simulation`.
- Description must be `Explore an interactive model of the Solar System with moving planets, moons, and famous comets.`
- Canonical URL must be `https://solar.yokicloud.net/`.
- Metadata and assets must work without client-side JavaScript.
- Do not modify simulation, rendering, or application UI code.
- Commit each task independently; run the full tests and production build before completion.

## File Structure

- Create `artwork/social-preview.svg`: editable 1200 x 630 Comet Teal source artwork.
- Create `scripts/render-social-preview.mjs`: deterministic SVG-to-PNG renderer.
- Create `public/social-preview.png`: crawler-facing rendered social card.
- Create `public/favicon.svg`: browser favicon using the compact visual identity.
- Create `src/staticAssets.test.ts`: verifies PNG dimensions/signature and favicon structure.
- Create `src/socialMetadata.test.ts`: verifies document, Open Graph, Twitter, canonical, theme, and favicon metadata.
- Modify `package.json`: add Sharp and the asset-generation command.
- Modify `package-lock.json`: lock Sharp and its platform packages.
- Modify `index.html`: add sharing, canonical, theme, and favicon metadata.

---

### Task 1: Comet Teal Static Assets

Create reproducible source artwork, render the social PNG, add the matching favicon, and test their basic contracts.

**Files:**
- Create: `artwork/social-preview.svg`
- Create: `scripts/render-social-preview.mjs`
- Create: `public/social-preview.png` (generated)
- Create: `public/favicon.svg`
- Create: `src/staticAssets.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Sharp's `sharp(input).png(options).toFile(output)` API.
- Produces: `/social-preview.png` at 1200 x 630 and `/favicon.svg` with a `0 0 64 64` view box; `npm run generate:social-preview` regenerates the PNG from its SVG source.

- [ ] **Step 1: Install the pinned image renderer**

Run:

```bash
npm install --save-dev sharp@0.34.3
```

Expected: `package.json` gains `"sharp": "^0.34.3"` in `devDependencies`; `package-lock.json` records Sharp and its platform packages.

- [ ] **Step 2: Add the failing static-asset contract test**

Create `src/staticAssets.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('static sharing assets', () => {
  it('provides a 1200 x 630 PNG social preview', () => {
    const png = readFileSync(new URL('../public/social-preview.png', import.meta.url));

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('provides a scalable favicon with the compact solar-system artwork', () => {
    const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');

    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(document.querySelector('[aria-label="Micro Solar System Simulation"]')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- staticAssets`

Expected: FAIL with `ENOENT` for `public/social-preview.png` because neither asset exists yet.

- [ ] **Step 4: Create the editable social-card SVG**

Create `artwork/social-preview.svg` with this complete Comet Teal composition:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#06181e"/>
      <stop offset="0.55" stop-color="#0c2931"/>
      <stop offset="1" stop-color="#163b43"/>
    </linearGradient>
    <radialGradient id="sun" cx="40%" cy="35%">
      <stop offset="0" stop-color="#fff4a8"/>
      <stop offset="0.5" stop-color="#ffda5b"/>
      <stop offset="1" stop-color="#f4a62a"/>
    </radialGradient>
    <radialGradient id="sunGlow">
      <stop offset="0" stop-color="#ffd955" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#ffd955" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cometTail" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eaffff" stop-opacity="0.9"/>
      <stop offset="0.35" stop-color="#75e0cb" stop-opacity="0.52"/>
      <stop offset="1" stop-color="#75e0cb" stop-opacity="0"/>
    </linearGradient>
    <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <pattern id="stars" width="92" height="78" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="19" r="1.2" fill="#dff7f3" opacity="0.42"/>
      <circle cx="67" cy="52" r="0.8" fill="#dff7f3" opacity="0.28"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="url(#background)"/>
  <rect width="1200" height="630" fill="url(#stars)"/>
  <circle cx="896" cy="242" r="360" fill="none" stroke="#75e0cb" stroke-opacity="0.22" stroke-width="2"/>
  <circle cx="896" cy="242" r="280" fill="none" stroke="#75e0cb" stroke-opacity="0.25" stroke-width="2"/>
  <circle cx="896" cy="242" r="196" fill="none" stroke="#75e0cb" stroke-opacity="0.28" stroke-width="2"/>
  <circle cx="896" cy="242" r="116" fill="none" stroke="#75e0cb" stroke-opacity="0.32" stroke-width="2"/>

  <circle cx="896" cy="242" r="92" fill="url(#sunGlow)" filter="url(#softGlow)"/>
  <circle cx="896" cy="242" r="43" fill="url(#sun)"/>
  <circle cx="781" cy="390" r="14" fill="#ef7659"/>
  <circle cx="1047" cy="169" r="10" fill="#4d9de0"/>
  <circle cx="615" cy="213" r="7" fill="#e3bb76"/>
  <circle cx="1124" cy="425" r="17" fill="#d8a25e"/>
  <ellipse cx="1124" cy="425" rx="30" ry="8" fill="none" stroke="#e7c98b" stroke-width="3" transform="rotate(-16 1124 425)"/>

  <path d="M1070 84 C1008 105 943 145 872 207" fill="none" stroke="url(#cometTail)" stroke-width="28" stroke-linecap="round"/>
  <path d="M1070 84 C1005 108 946 148 880 202" fill="none" stroke="#b9fff0" stroke-opacity="0.55" stroke-width="5" stroke-linecap="round"/>
  <circle cx="1071" cy="84" r="11" fill="#efffff"/>
  <circle cx="1071" cy="84" r="24" fill="#b9fff0" opacity="0.25" filter="url(#softGlow)"/>

  <text x="82" y="356" fill="#ffffff" font-family="system-ui, sans-serif" font-size="68" font-weight="700" letter-spacing="-2">Micro Solar System</text>
  <text x="82" y="433" fill="#ffffff" font-family="system-ui, sans-serif" font-size="68" font-weight="700" letter-spacing="-2">Simulation</text>
  <text x="86" y="492" fill="#9dd9d1" font-family="system-ui, sans-serif" font-size="23" font-weight="600" letter-spacing="5">PLANETS, MOONS &amp; COMETS</text>
  <rect x="82" y="530" width="82" height="4" rx="2" fill="#75e0cb"/>
</svg>
```

- [ ] **Step 5: Add the deterministic renderer and npm command**

Create `scripts/render-social-preview.mjs`:

```js
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const input = fileURLToPath(new URL('../artwork/social-preview.svg', import.meta.url));
const output = fileURLToPath(new URL('../public/social-preview.png', import.meta.url));

await sharp(input).png({ compressionLevel: 9 }).toFile(output);
```

Add this script to the existing `scripts` object in `package.json`, preserving the existing commands:

```json
"generate:social-preview": "node scripts/render-social-preview.mjs"
```

- [ ] **Step 6: Create the matching favicon SVG**

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Micro Solar System Simulation">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#06181e"/>
      <stop offset="1" stop-color="#16404a"/>
    </linearGradient>
    <radialGradient id="sun">
      <stop stop-color="#fff4a8"/>
      <stop offset="0.55" stop-color="#ffda5b"/>
      <stop offset="1" stop-color="#f4a62a"/>
    </radialGradient>
    <linearGradient id="tail" x1="1" y1="0" x2="0" y2="1">
      <stop stop-color="#efffff"/>
      <stop offset="1" stop-color="#75e0cb" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="13" fill="url(#bg)"/>
  <circle cx="32" cy="34" r="22" fill="none" stroke="#75e0cb" stroke-opacity="0.55" stroke-width="1.5"/>
  <circle cx="32" cy="34" r="13" fill="none" stroke="#75e0cb" stroke-opacity="0.42" stroke-width="1.5"/>
  <circle cx="32" cy="34" r="7" fill="url(#sun)"/>
  <circle cx="51" cy="23" r="3" fill="#ef7659"/>
  <path d="M52 9 C45 12 40 16 35 22" fill="none" stroke="url(#tail)" stroke-width="6" stroke-linecap="round"/>
  <circle cx="53" cy="8" r="2.8" fill="#efffff"/>
</svg>
```

- [ ] **Step 7: Render the crawler-facing PNG**

Run: `npm run generate:social-preview`

Expected: command exits successfully and creates `public/social-preview.png`.

- [ ] **Step 8: Run the focused asset test**

Run: `npm test -- staticAssets`

Expected: PASS — PNG signature and 1200 x 630 IHDR dimensions match; favicon parses as SVG with the expected view box and accessible name.

- [ ] **Step 9: Commit the asset task**

```bash
git add artwork/social-preview.svg scripts/render-social-preview.mjs public/social-preview.png public/favicon.svg src/staticAssets.test.ts package.json package-lock.json
git commit -m "feat: add social preview and favicon assets"
```

---

### Task 2: Sharing Metadata

Add all fixed metadata to the static HTML shell and verify each crawler-facing value.

**Files:**
- Create: `src/socialMetadata.test.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: `/favicon.svg`, `https://solar.yokicloud.net/social-preview.png`, and the fixed copy from the approved design.
- Produces: canonical, theme, favicon, Open Graph, and Twitter Card tags in the initial HTML response.

- [ ] **Step 1: Add the failing metadata contract test**

Create `src/socialMetadata.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const title = 'Micro Solar System Simulation';
const description = 'Explore an interactive model of the Solar System with moving planets, moons, and famous comets.';
const siteUrl = 'https://solar.yokicloud.net/';
const imageUrl = 'https://solar.yokicloud.net/social-preview.png';

describe('social metadata', () => {
  let document: Document;

  beforeAll(() => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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
```

- [ ] **Step 2: Run the metadata test to verify it fails**

Run: `npm test -- socialMetadata`

Expected: FAIL because the current title is `Solar System Simulation` and the metadata tags do not exist.

- [ ] **Step 3: Add all metadata to `index.html`**

Replace the current `<head>` contents with:

```html
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Micro Solar System Simulation</title>
    <meta
      name="description"
      content="Explore an interactive model of the Solar System with moving planets, moons, and famous comets."
    />
    <meta name="theme-color" content="#071b21" />
    <link rel="canonical" href="https://solar.yokicloud.net/" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://solar.yokicloud.net/" />
    <meta property="og:title" content="Micro Solar System Simulation" />
    <meta
      property="og:description"
      content="Explore an interactive model of the Solar System with moving planets, moons, and famous comets."
    />
    <meta property="og:image" content="https://solar.yokicloud.net/social-preview.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta
      property="og:image:alt"
      content="Micro Solar System Simulation with stylized planets, orbital rings, and a comet"
    />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Micro Solar System Simulation" />
    <meta
      name="twitter:description"
      content="Explore an interactive model of the Solar System with moving planets, moons, and famous comets."
    />
    <meta name="twitter:image" content="https://solar.yokicloud.net/social-preview.png" />
    <meta
      name="twitter:image:alt"
      content="Micro Solar System Simulation with stylized planets, orbital rings, and a comet"
    />
```

- [ ] **Step 4: Run the metadata test to verify it passes**

Run: `npm test -- socialMetadata`

Expected: PASS — all three metadata contract tests pass.

- [ ] **Step 5: Run the complete verification suite**

Run: `npm test && npm run build`

Expected: all Vitest files pass; TypeScript checking and Vite production build succeed; Vite reports `dist/index.html` and bundled application assets.

- [ ] **Step 6: Verify Vite copied static assets and retained absolute metadata**

Run:

```bash
test -f dist/favicon.svg
test "$(od -An -tu4 -N4 -j16 --endian=big dist/social-preview.png | tr -d ' ')" = "1200"
rg 'https://solar\.yokicloud\.net/social-preview\.png' dist/index.html
rg '<title>Micro Solar System Simulation</title>' dist/index.html
```

Expected: all `test` commands exit 0; the first `rg` prints the Open Graph and Twitter image tags; the second prints the document title.

- [ ] **Step 7: Commit the metadata task**

```bash
git add index.html src/socialMetadata.test.ts
git commit -m "feat: add social sharing metadata"
```

---

## Self-Review

**Spec coverage:**
- Comet Teal social artwork with title, supporting line, orbital system, planets, Sun, and comet: Task 1 Step 4.
- 1200 x 630 crawler-compatible PNG at the required URL: Task 1 Steps 4, 7, and 8; Task 2 metadata.
- Matching text-free SVG favicon: Task 1 Step 6.
- Editable vector source and deterministic rendered PNG: Task 1 Steps 4, 5, and 7.
- Fixed title, description without asteroids, canonical URL, and theme color: Task 2 Steps 1 and 3.
- Complete Open Graph and Twitter summary-large-image metadata including dimensions and alt text: Task 2 Steps 1 and 3.
- Static operation without JavaScript: files live under `public/`; metadata is in `index.html`.
- Build, tests, copied assets, dimensions, and emitted metadata verification: Task 2 Steps 5 and 6.
- No simulation or UI changes: enforced by the file list and Global Constraints.

**Placeholder scan:** No TBD, TODO, deferred implementation, or unspecified error-handling steps remain. Every source and test file is provided in full; the generated PNG is produced by an exact command from complete SVG source.

**Type consistency:** Both tests reference the exact asset paths and metadata values produced by the implementation. The renderer's input/output paths match the created files, and the package script invokes that renderer directly.
