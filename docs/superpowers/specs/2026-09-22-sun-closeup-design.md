# Sun close-up navigation

The Sun entry in the 3D jump picker frames the Sun as a body, using the same
radius-based camera distance and follow behavior as the planets. It remains
selected in the dropdown. It must not request full-system framing.

The empty picker option releases focus and returns to the overview. Double-click
also releases an active body focus and returns to the overview. A selected Sun
owns the camera when comet framing is pending, as any other focused body does.

This supersedes the Sun-as-release behavior in the 2026-07-24 planet-jump spec
and item 7 of the 2026-09-21 review-fixes spec. The correction uses the existing
renderer focus path; no new camera algorithm or UI control is needed.

Verification: RAF-driven hook tests confirm Sun remains the requested focus and
no overview reset is queued, including after a planet/comet selection. Actual
Three.js camera tests confirm the Sun gets a close-up and double-click releases
it. Run the full suite and production build before committing.
