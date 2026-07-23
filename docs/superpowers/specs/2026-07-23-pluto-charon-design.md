# Pluto And Charon Design

## Summary

Add dwarf planet Pluto and its major moon Charon to the main solar-system
simulation. Pluto appears after Neptune alongside the eight planets in both
Schematic and To Scale modes. Charon uses the existing stylized moon model in
both modes.

The change extends the existing planet and moon data pipeline rather than
adding a separate dwarf-planet subsystem. This keeps layout, motion, rendering,
labels, camera framing, and visibility behavior consistent with the rest of the
simulation.

## Data Model

Append Pluto to `PLANETS` after Neptune. `PlanetSpec` remains unchanged; the
name describes the existing shared major-body pipeline, and a data comment will
identify Pluto as a dwarf planet.

Pluto uses these values:

| Field | Value |
|---|---:|
| `periodDays` | `90921.85108674582` |
| `epochAngleRad` source value | `302.961154488` deg |
| `semiMajorAxisAu` | `39.57126152242962` |
| `eccentricity` | `0.2494484952274253` |
| `perihelionLongitudeRad` source value | `225.218605929714` deg |
| `bodyRadius` | `4` world units |
| `color` | `#b8a99a` |

The period, semi-major axis, eccentricity, and longitude of perihelion are from
the NASA/JPL Horizons heliocentric osculating elements at J2000. The longitude
of perihelion is `Omega + omega`. The epoch angle is the projected heliocentric
ecliptic longitude derived from Pluto's geometric Sun-centered position vector
at `2026-01-01 00:00 TDB`.

Append Charon to `MOONS` with `parent: 'Pluto'` and `periodDays: -6.387222`.
The negative period preserves Charon's retrograde ecliptic-projected motion,
consistent with the existing convention for moon orbits with inclination above
90 degrees. Charon has no stored epoch phase and therefore starts at the
existing default zero phase. This avoids implying a precise flattened position
for its highly inclined real orbit.

Sources:

- [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), Pluto
  target `999` relative to Sun `500@10`.
- NASA/JPL Horizons Charon target `901` relative to Pluto `500@999`, solution
  PLU060/DE440.

## Motion And Layout

No orbital-math changes are required.

In Schematic mode, Pluto receives the ninth circular orbit. `computeLayout`
places it beyond Neptune and includes a moon bubble sized for Charon. Pluto
moves at constant angular speed from its 2026 epoch longitude, matching the
existing schematic treatment of planets.

In To Scale mode, Pluto uses the existing Kepler solver and ellipse geometry.
Its high eccentricity is within the solver's supported elliptical range. The
model remains a 2D ecliptic simplification: inclination is not represented, and
the ellipse is oriented by longitude of perihelion. Deriving epoch mean anomaly
from Pluto's stored epoch longitude ensures that Schematic and To Scale modes
agree on Pluto's angle at `simDays = 0`.

Charon follows the existing circular moon treatment around Pluto in both modes.
Its displayed orbit radius is stylized and is not converted from its real
semi-major axis.

## Rendering And Camera

No rendering interfaces or UI controls change.

- Pluto uses the existing planet body, orbit-guide, and always-visible planet
  label treatment.
- Charon uses the shared moon radius and color, moon-bubble guide, zoom-based
  moon opacity, and moon-label visibility rules.
- The schematic extent automatically includes Pluto's orbit and Charon's moon
  bubble.
- The To Scale extent automatically includes Pluto's aphelion, so fitting the
  complete system produces a wider initial view.
- Asteroid-belt geometry remains bounded by Mars and Jupiter and is unchanged.
- Comet selection, framing, and rendering remain unchanged.

## Data Flow

1. `Simulation` computes its layout from the expanded `PLANETS` and `MOONS`
   tables.
2. `snapshot()` computes Pluto through `planetPosition` and Charon through the
   existing parent-relative moon loop.
3. `orbitPaths()` returns nine planet paths in either scale mode.
4. `extent()` includes Pluto because it derives its maximum from the complete
   planet table.
5. `drawScene()` consumes the expanded snapshot and orbit paths without
   Pluto-specific logic.

## Error Handling And Numerical Behavior

- Orbital values remain static application data; no runtime network request is
  added.
- Existing validation continues to reject zero periods, duplicate names, and
  moon parents absent from `PLANETS`.
- Floating-point orbital assertions use `toBeCloseTo`.
- Pluto's real orbit is inclined by about 17 degrees, but inclination remains
  outside this simulation's 2D model. The displayed path is its flattened
  ecliptic approximation, consistent with planets and comets.
- The Pluto-Charon barycentric wobble is outside scope; Charon is drawn around
  Pluto's displayed center like every other moon around its parent.

## Testing

- Update the expected major-body order to contain Pluto after Neptune.
- Update the moon total from 98 to 99 and add Pluto's expected moon count of
  one.
- Validate Pluto's period, epoch longitude, semi-major axis, eccentricity, and
  longitude of perihelion against the documented values.
- Verify Charon belongs to Pluto, uses the documented period, and moves
  retrograde around its parent.
- Update snapshot body counts from 107 to 109: Sun, nine major bodies, and 99
  moons.
- Verify both modes produce nine planet orbit paths.
- Verify Pluto's Schematic and To Scale positions agree in longitude at the
  simulation epoch.
- Update render-call expectations for one additional planet, one moon, one
  planet orbit guide, and one moon-bubble guide.
- Run the complete Vitest suite and production build.

## Out Of Scope

- Pluto's four smaller moons: Styx, Nix, Kerberos, and Hydra.
- A new dwarf-planet rendering category, legend, filter, or toggle.
- Other dwarf planets such as Ceres, Eris, Haumea, or Makemake.
- Inclined or three-dimensional planet and moon orbits.
- Pluto-Charon barycentric motion or real-scale moon distances.
- Runtime ephemeris updates.

## Acceptance Criteria

- Pluto appears after Neptune with a label and orbit guide in Schematic mode.
- Pluto appears on its eccentric, correctly oriented 2D orbit in To Scale mode.
- Both scale modes place Pluto at the same longitude on `2026-01-01`.
- Charon orbits Pluto retrograde and follows existing moon visibility and label
  behavior.
- Full-system camera fitting includes Pluto and Charon in Schematic mode and
  Pluto's aphelion in To Scale mode.
- Existing asteroid-belt, comet, date, speed, pause, zoom, pan, and touch
  behavior is unchanged.
- `npm test` and `npm run build` pass.
