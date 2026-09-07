# Phase 4/5 notes

## Resolved: barrier colour (was misdiagnosed as lighting/exposure)

**Root cause: `vertexColors: true` on the barrier material, with no `color`
geometry attribute on the BoxGeometry.** `vertexColors` and `instanceColor`
are different features. `vertexColors: true` defines `USE_COLOR`, which reads
a per-vertex `color` attribute; with none bound, it reads as `(0,0,0)`, and
three's `color_vertex` chunk multiplies `vColor *= color` *before*
`vColor.xyz *= instanceColor.xyz`, zeroing every segment to black regardless
of the instance buffer. `setColorAt` enables `USE_INSTANCING_COLOR` on its
own and needs no material flag. Removed `vertexColors` from Barriers.tsx;
confirmed visually, both barrier lines now show a clear alternating
white/red pattern.

This means the phase 3 and phase 4/5 "exposure" fixes (environmentIntensity
0.6, light intensity 3, envMapIntensity 0.3) were chasing a symptom with a
different real cause. Re-checked the scene after the real fix: it does not
read flat or underlit at those values (car, kerb and barriers all show good
contrast and highlights), so left them as-is rather than raising intensity
back up.

Audited every other component using `setColorAt`/`instanceColor`
(LedBoards, Grandstands, LightPoles, MarshalPosts, GantryBridges, YearSigns,
EventBillboards): none of them combine it with `vertexColors: true`.
MarshalPosts does use `vertexColors: true`, but legitimately: it bakes a
real per-vertex `color` attribute onto its merged geometry and never touches
`instanceColor`, so it was left untouched.

## Real bug found and fixed during live verification

**Car could get permanently stuck mid pit-lane entry.** The `entering` phase
decelerated speed toward 0 with no floor, and advanced `z` by `speed * delta`.
If speed reached 0 before `z` reached the event's `trackZ` (true at higher
entry speeds against a fixed `ENTER_DECEL`), the car stopped moving but never
satisfied the `z >= trackZ` condition that transitions to `stopped`, so it sat
frozen partway into the pit lane forever. Fixed by giving `entering` a floor of
`MIN_ENTER_SPEED` (4 m/s) instead of 0, so it always keeps creeping until it
physically reaches the bay, where it snaps to a hard stop. Confirmed working
across a full run through several consecutive pit stops afterward.

## Values picked arbitrarily, worth a look

- `PIT_ENTRY_LEAD` (60m) / `PIT_EXIT_LEAD` (40m): distance before/after an
  event's trackZ where the car auto-decelerates in and accelerates out.
- `ENTER_DECEL` (25 m/s^2) and `MIN_ENTER_SPEED` (4 m/s): the automatic
  pit-entry braking profile.
- Driver stat bar weights (Pace 92, Racecraft 78, Awareness 88, Reliability 85,
  Tyre Mgmt 90): relative bar lengths only, never rendered as numbers, per the
  correction to Step 5. Purely a self-rating, not derived from any measured fact.
- Timeline bundling: events 9 and 11 in the spec's list each name three
  achievements (Redrob AI + Maximise + Ad Mads; UrbanAir Intel + Crime
  Intelligence + DevAgent Remote). Each is kept as ONE timeline entry (matching
  the spec's 14-item list) with one project as the structured
  liveUrl/repo/status and the other two folded into bullet text. Crime
  Intelligence's real ARCHIVED status and DevAgent's MOBILE status from the
  per-project table are therefore not separately represented as chips anywhere
  in the current 14 entries; only LIVE and BACKEND appear. The StatusChip
  component itself still supports all four statuses.
- Event billboard placement: right side (negative X), 30m before each
  project/pivot event's trackZ, offset further out (x = -(BARRIER_X+8)) than
  the year signs. Not specified in the spec beyond "between signboards".
- Sector HUD: track split into three equal thirds by trackZ. Not specified in
  the spec beyond "sector label" existing.
