# Stage B notes: navbar, mega menu, jump

## Blocked

Nothing blocked. No item hit the two-attempt limit.

## Bugs found and fixed during the stage

**1. The camera fell hundreds of metres behind during a jump.**
`Car` and `ChaseCam` both used the default `useFrame` priority of 0, so they ran in
mount order. `Car` suspends on the GLTF and therefore mounts *second*, meaning the
camera was reading a one-frame-stale position every frame. Harmless at 85 m/s,
catastrophic at jump speeds.

Fixed by giving `Car` a priority of `-1`. Verified in the fiber source that this is
safe: `internal.priority` is only incremented for `priority > 0`
(`events-b1bdeb1a.cjs.dev.js:1146`) and the auto-render is gated on that counter
(`:16196`), while subscribers sort ascending (`:1154`). A **positive** priority would
have handed rendering to the app; a negative one only reorders.

**2. The first easing read as a teleport, not a jump.**
`easeOutQuint` peaks in velocity at t=0, so roughly 60 percent of a 2000m jump
happened in the first fifth of a second, followed by a long drift. Replaced with an
explicit two-phase profile: velocity ramps linearly for the first 30 percent, then
decays quadratically to zero. Peak is ~2.6x the average rather than ~5x, there is now
something to track leaving the stop, and the quadratic tail is what makes the arrival
feel braked.

**3. Arriving from a jump left the car crawling.**
`entering` decays speed toward a 4 m/s floor. Handing it 0 on arrival meant creeping
the last 60m for about fifteen seconds. Now hands it `JUMP_ARRIVAL_SPEED = 60`, which
covers the pit entry in ~1.4s and lets the existing deceleration do the braking.

**4. LED logos were sheared 8x across (reported mid-stage).**
Stage A widened the boards to 8x2 (4:1) but left the atlas at 6 cols x 3 rows, whose
cells are 170x341, i.e. 1:2. Mapping a 1:2 cell onto a 4:1 quad stretches by 8x.

Rebuilt the atlas as 2 cols x 9 rows, giving 512x113.8 cells at exactly 4.5:1, and
exported `BOARD_ASPECT` so `LedBoards` and `GantryBridges` now **derive** their quad
dimensions from the cell aspect rather than hard-coding them. The two can no longer
drift apart.

While fixing it: a wide board carrying one small square glyph reads as a mistake, so
each cell now draws the mark plus the brand wordmark from `icon.title`, sized to fit.
That is what real trackside advertising looks like and it is far more legible from a
chase cam. The atlas repaints once on `document.fonts.ready`, because the webfont is
almost certainly still loading when the texture is first built.

## Deviations worth reviewing

**Nav rows outnumber timeline stops, deliberately.** The brief asked for 9 projects and
4 hackathons, but the timeline has 14 consolidated events: the June hackathon treble is
one entry, and UrbanAir / Crime Intelligence / DevAgent are another. So several named
rows resolve to the same `trackZ`. Splitting the timeline to give every row its own stop
would change the drive, which is not a navigation concern. Reasoning is in `navData.ts`.

**Single-row groups jump on click rather than opening a menu of one.** DRIVER and HIRE
have one destination each, so making the reader open a dropdown to find it is friction.
Hover still opens the panel so the description is visible.

**HUD no longer prints the name.** The navbar carries it now, so the HUD is the sector
alone.

## Values chosen

| Value | Setting |
|---|---|
| `JUMP_DURATION` | 1.5s, constant, as briefed |
| `ACCEL_FRACTION` | 0.3 of the flight spent accelerating |
| `JUMP_ARRIVAL_SPEED` | 60 m/s |
| FOV punch | 55 to 88, `sin(pi * progress)` so it returns to base at both ends |
| Mega menu | 76vw, capped at 1200px |
| `CLOSE_DELAY` | 120ms grace so the pointer can travel from pill into menu |
| Card media | height-capped at 24vh rather than a free 16/9, which was pushing the title and links below the fold |

## react-icons

Kept and now used: `FiChevronDown` for the bar, `FiArrowUpRight` on menu rows.

## Not verified

The reduced-motion path on the navbar and mega menu. Both are guarded
(`useReducedMotion` in `NavPill` and `MegaMenu`), but forcing
`prefers-reduced-motion: reduce` needs OS or browser-launch level emulation. Check it
via DevTools, Rendering panel.
