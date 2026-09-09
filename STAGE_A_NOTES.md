# Stage A (look pass) notes

## Blocked

Nothing blocked. No item hit the two-attempt limit.

## Not verified in situ

**Event cards were never seen at a pit stop.** Automated Chrome backgrounds the tab
between actions (`document.hidden === true`), which throttles `requestAnimationFrame`.
Two consequences: the car advances at a crawl because `useFrame` barely ticks, and the
panel stagger freezes partway (measured `opacity: 0.42`, mid-transition). Neither is a
code fault, and both resolve the moment a real user has the tab focused.

The `StartSequence` panels were captured fully rendered while the tab was briefly
foregrounded, and `EventCard` / `EndScreen` are built from the same `Panel`, so the
frame, chamfer, brackets, header rule and noise are verified. What is **not** verified
is the card at an actual pit stop and the staggered reveal at full speed. Worth an
eyeball on the next manual run.

## Bug found and fixed, not on the brief

**Ground planes started at z = 0 while the chase cam sits at z = -8.** At the start line
the near third of the frame rendered as bare sky below a hard horizontal seam, with the
car apparently cut in half. Planes were `PlaneGeometry(width, TRACK_LENGTH)` centred at
`TRACK_LENGTH / 2`, so the world began exactly at the grid.

Fixed with an 80m overhang at both ends (`GROUND_LENGTH = TRACK_LENGTH + 160`, still
centred at `TRACK_LENGTH / 2`, texture `repeatY` scaled to match). Pre-existing since
phase 1; only became obvious once the sky stopped being white enough to hide it.

## Extra change worth reviewing

**LED board spacing 50m -> 24m.** Not requested. At 8m wide, boards 50m apart left 42m
gaps and still read as sparse trackside furniture. Costs nothing (one merged geometry,
still one draw call, 2 triangles per board). Revert to 50 if it feels too busy.

## Values chosen

| Value | Setting | Note |
|---|---|---|
| `toneMappingExposure` | 0.65 | As briefed |
| `backgroundIntensity` | **0.35** | The one tuning attempt. 0.6 still read as pale cream |
| `environmentIntensity` | 0.6 | Unchanged, lighting was already right |
| LED board | 8m x 2m at `BARRIER_X + 1` | Two posts per board now, one centre post looked unsupported |
| Gantry panel | 14m x 2.6m, hung under the beam | Atlas cell offset by 3 so a gantry never repeats the board beside it |
| Board/panel `envMapIntensity` | 0.35 | Near-black backing was washing to light grey under the sky |
| Panel chamfer | 20px, top-right and bottom-left | |
| Corner brackets | 2, on the square corners | See below |

## Two judgement calls

**Brackets on two corners, not four.** Brackets are drawn outside the clip path, so a
bracket on a chamfered corner would float in cut-away space. The chamfer already gives
those two corners a strong identity. Top-left and bottom-right carry the L marks.

**Cyan is used in exactly one place per card:** the `Live Site` link and its underline,
plus the same treatment on the GitHub and LinkedIn links on the end card. It marks live
data, never fills, and never sits next to race-red.

## Known risk, not addressed

Panel content starts at `opacity: 0` and depends on JS to reveal it. That is fine in a
normal browser but means the portfolio's text is invisible if motion fails, and it does
not currently respect `prefers-reduced-motion`. Worth a `MotionConfig` pass later.
