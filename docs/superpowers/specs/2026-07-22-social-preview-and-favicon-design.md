# Social Preview and Favicon Design

- **Date:** 2026-07-22
- **Status:** Approved design

## Summary

Give the Solar System Simulation a recognizable identity when bookmarked or shared
through WhatsApp and other social applications. Add a Comet Teal social preview,
a matching favicon, and complete page metadata under the title "Micro Solar System
Simulation."

## Visual Direction

Use the approved **Comet Teal** concept. The artwork uses the application's dark
space setting with a restrained teal cast, thin orbital rings, a warm yellow Sun,
small contrasting planets, and a bright comet with an anti-sunward teal trail.
It should feel educational and technical while remaining legible at the small size
used by messaging applications.

The social card includes:

- The title "Micro Solar System Simulation"
- The supporting line "Planets, moons & comets"
- A stylized orbital system and comet, without application controls
- High contrast and generous safe margins so platform cropping does not obscure
  the title or main illustration

## Assets

### Social preview

- Path: `public/social-preview.png`
- Dimensions: 1200 x 630 pixels (Open Graph's 1.91:1 ratio)
- Format: PNG for broad crawler compatibility
- Public URL: `https://solar.yokicloud.net/social-preview.png`

The visual may be authored as vector artwork, but the committed crawler-facing
asset is the rendered PNG. The source design should use simple geometric forms so
the preview remains clear after thumbnailing and compression.

### Favicon

- Path: `public/favicon.svg`
- Format: SVG for sharp rendering at browser favicon sizes
- Appearance: a simplified square composition using the same dark teal field,
  warm Sun, orbit arc, small planet, and comet cue
- No text, because favicon sizes cannot support it legibly

## Metadata

Update `index.html` with:

- Document title: `Micro Solar System Simulation`
- Meta description: `Explore an interactive model of the Solar System with moving planets, moons, and famous comets.`
- Canonical URL: `https://solar.yokicloud.net/`
- Theme color matching the dark teal artwork
- Favicon link to `/favicon.svg`
- Open Graph type, URL, title, description, image, image dimensions, and image alt text
- Twitter summary-large-image card, title, description, image, and image alt text

All social image metadata uses the absolute production URL. No Twitter account
handle metadata is required.

## Error Handling and Compatibility

- Keep all assets static and available without JavaScript so crawler bots can read
  them directly.
- Use a PNG rather than SVG for the social image because social crawler SVG support
  is inconsistent.
- Keep the social image URL HTTPS and absolute.
- Avoid runtime metadata generation; this application has one shareable page and
  fixed metadata.

## Verification

- Confirm the preview PNG is exactly 1200 x 630 pixels.
- Confirm both assets are copied into the Vite production output.
- Run the production build and existing test suite.
- Inspect the built `index.html` to ensure metadata and absolute URLs remain intact.
- Verify the favicon and social image URLs return successfully when deployed.

## Non-Goals

- Per-date, per-comet, or otherwise dynamic social cards
- Changes to the simulation canvas or application controls
- Platform-specific preview images
- Legacy `.ico` favicon generation
