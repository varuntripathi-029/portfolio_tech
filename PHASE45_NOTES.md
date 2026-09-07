# Phase 4/5 notes

## Blocked

**Barrier alternating white/red still reads as a uniform dark tone.**

Step 0a's one prescribed attempt: `environmentIntensity` on `<Environment>` dropped
to 0.6, directional light intensity dropped from 6 to 3, `envMapIntensity: 0.3` added
to the barrier material. Rebuilt and checked both the sun-facing and shadowed
barrier lines after the change: both still read as a uniform dark
brown/near-black band, no visible white/red alternation.

The instance colour buffer itself was already confirmed correct in phase 3
(alternating linear-space white/red values), so the data and the shader
mechanism are not the issue. This now looks like it needs either a brighter
albedo pair, a small emissive push, or a second directional fill light, none
of which were in scope for the one prescribed attempt. Left as-is per the rule,
noted here rather than trying a second fix.

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
