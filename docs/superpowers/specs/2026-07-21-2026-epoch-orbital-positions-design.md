# 2026 Epoch Orbital Positions Design

## Summary

Start the simulation at `2026-01-01 00:00 UTC` and place the eight planets at
their real heliocentric ecliptic longitudes at that instant. Place Earth's Moon
at its real geocentric ecliptic longitude. After the epoch, retain the existing
simplified model: circular, coplanar orbits moving at constant angular speed
from the existing sidereal periods.

Distances, body sizes, eccentricity, inclination, and orbital perturbations
remain outside the model. The epoch positions are astronomically grounded, but
positions away from the epoch are intentionally approximate.

## Coordinate Convention

- Epoch: `2026-01-01 00:00:00 UTC` (`simDays = 0`).
- Reference plane: J2000 ecliptic.
- Planet center: Sun body center.
- Moon center: Earth body center.
- Position data: geometric vectors with no aberration or light-time correction.
- Angle: `atan2(y, x)`, normalized to `[0, 360)` degrees.
- Simulation angle zero is the positive world x-axis.
- Positive angles increase toward positive world y, appearing counterclockwise
  on screen when viewed from ecliptic north.

The simulation discards each source vector's radius and z-coordinate. It uses
only the projected x-y angle and the existing stylized circular orbit radius.

## Epoch Phase Data

The values below come from NASA/JPL Horizons geometric vectors for JD
`2461041.5` UTC. Planet vectors use target body centers relative to the Sun
(`CENTER=500@10`); the Moon vector uses the Moon relative to Earth
(`CENTER=500@399`). All queries use `EPHEM_TYPE=VECTORS`,
`REF_PLANE=ECLIPTIC`, `REF_SYSTEM=ICRF`, and `VEC_CORR=NONE`.

| Body | Horizons ID | X (AU) | Y (AU) | Epoch angle |
|---|---:|---:|---:|---:|
| Mercury | 199 | -0.2151859044614284 | -0.4092170140927566 | 242.262456669 deg |
| Venus | 299 | 0.08889321519355421 | -0.7217604600705986 | 277.021284224 deg |
| Earth | 399 | -0.1742952572691282 | 0.9677564245672475 | 100.209656729 deg |
| Mars | 499 | 0.3405909828265314 | -1.386998380378641 | 283.796552295 deg |
| Jupiter | 599 | -1.694009482677741 | 4.928880675200030 | 108.967359114 deg |
| Saturn | 699 | 9.507341281256027 | 0.2577434953656592 | 1.552905047 deg |
| Uranus | 799 | 9.880308185830774 | 16.80001357307254 | 59.539656457 deg |
| Neptune | 899 | 29.87212229334517 | 0.5189408715199665 | 0.995246704 deg |
| Moon | 301 | 0.0009642934183222764 | 0.002202069720339865 | 66.351233998 deg |

Source: [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html),
DE441 and target-specific satellite ephemerides returned by Horizons.

## Data Model

Add a required `epochAngleRad` number to `PlanetSpec`. Every planet receives its
verified epoch longitude converted to radians in `src/sim/data.ts`. Keep the
source values readable by defining one local degrees-to-radians conversion
factor and expressing each value as `<degrees> * factor`.

Add an optional `epochAngleRad` to `MoonSpec`. Set it only for Earth's Moon.
Every other moon defaults to zero phase, preserving the current simplified
behavior and avoiding unsupported claims about their real epoch positions.

No layout or rendering types change. Snapshot positions remain ordinary x-y
world coordinates.

## Orbital Math

Extend `angleAt` to accept an initial phase:

```ts
angleAt(periodDays, simDays, epochAngleRad = 0)
  = epochAngleRad + 2 * Math.PI * simDays / periodDays
```

The default keeps the helper compatible with bodies that have no calibrated
phase. Negative periods continue to produce retrograde motion because only the
time-dependent term changes sign.

`Simulation.snapshot()` passes each planet's required epoch angle and each
moon's optional epoch angle into `angleAt`. Moon positions remain relative to
their moving parent planet.

## Date Model

Change the date-formatting epoch from J2000 noon to Unix milliseconds for
`2026-01-01 00:00:00 UTC`. One whole `simDay` corresponds to one UTC calendar
day, so:

- `formatSimDate(0)` returns `2026-01-01`.
- `formatSimDate(1)` returns `2026-01-02`.
- Fractional values below 1 remain on `2026-01-01`.

The simulation clock itself remains elapsed days from epoch and requires no
behavioral change.

## Data Flow

1. `SimClock` starts at zero elapsed days.
2. `formatSimDate` maps elapsed days onto the 2026 UTC epoch.
3. `Simulation.snapshot()` combines elapsed days, sidereal period, and epoch
   phase to produce each body's circular-orbit angle.
4. `orbitalPosition` maps that angle onto the existing stylized orbit radius.
5. Rendering consumes the resulting snapshot without astronomical logic.

This preserves the existing boundary: `src/sim/` owns time and positions;
`src/render/` only draws them.

## Error Handling And Numerical Behavior

- Epoch values are static application data; there is no runtime network call
  and no ephemeris-service failure mode.
- Tests continue to reject zero orbital periods.
- Angles do not need normalization during simulation because `sin` and `cos`
  accept unbounded radians. Epoch source values are normalized for readability.
- Floating-point comparisons use `toBeCloseTo` rather than exact equality.
- The model is exact only at the epoch. Constant circular propagation will
  diverge from a real ephemeris because eccentricity and perturbations are
  intentionally omitted.

## Testing

- Update date tests for the midnight `2026-01-01` epoch, day rollover, leap-year
  handling, fractional days, and large elapsed values.
- Extend orbital-math tests to verify an initial phase at day zero and phase
  plus elapsed angular motion.
- Replace the simulation assertion that all bodies start on the positive x-axis
  with epoch-position assertions for all eight planets.
- Derive each tested angle from the body's snapshot x-y coordinates and compare
  it with the documented epoch angle.
- Verify Earth's Moon starts at `66.351233998` degrees relative to Earth.
- Verify an uncalibrated moon still starts at zero relative phase.
- Keep tests proving orbital radius, one-period revolution, parent-relative moon
  placement, and retrograde motion.
- Keep the full build and test suite as release gates.

## Out Of Scope

- Elliptical or inclined orbits.
- Runtime JPL Horizons requests.
- Ephemeris interpolation or date-dependent orbital elements.
- Real epoch phases for moons other than Earth's Moon.
- Axial rotation, constellations, equinox markers, or other sky orientation UI.
- Date selection, rewinding, or persistence.

## Acceptance Criteria

- The initial date display reads `2026-01-01`.
- At `simDays = 0`, all eight planets match the documented heliocentric
  ecliptic longitudes within floating-point tolerance.
- Earth's Moon matches the documented geocentric ecliptic longitude relative to
  Earth; all other shown moons retain zero initial phase.
- Advancing time preserves current constant-period circular motion, including
  retrograde moon behavior.
- Layout, rendering, speed controls, pause, zoom, pan, and touch interaction are
  unchanged.
- `npm test` and `npm run build` pass.
