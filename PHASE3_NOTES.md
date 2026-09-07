# Phase 3 notes

## Blocked

**Barrier alternating white/red is hard to see against the current lighting.**

Tried:
1. Suspected specular wash from the sunset HDRI (the same bug found and fixed on
   the LED boards) and set the barrier material to `roughness: 1`. This changed
   the overall tone but the alternation still wasn't visually obvious.
2. Suspected a stale-shader issue where `instanceColor` added after first compile
   doesn't get picked up. Verified directly:
   - The instance colour buffer itself is correct: alternating linear-space
     white `(0.807, 0.807, 0.776)` and red `(0.578, 0.007, 0.007)` values,
     confirmed by reading `mesh.instanceColor.array` at runtime.
   - Read `three`'s own `WebGLRenderer.js` (~line 2282): it already detects a
     mismatch between the compiled program's `instancingColor` flag and the
     object's current `instanceColor` state and forces a recompile
     automatically. So this is not a stale-shader bug.

Both the data and the render mechanism check out. What's left is that the right
(shadowed) barrier line sits mostly outside the direct sun and reads as a muted
brown regardless of white or red, and the left (sun-facing) one reads close to
black, apparently silhouetted against the bright sky under the current tone
mapping/exposure. That's a lighting/exposure characteristic of the phase 2 sun
setup, not a bug in the barrier code, so I stopped at two attempts per the rule
and left it for a visual call rather than tuning further.

## Left/right convention discovered this phase

Verified empirically (not assumed): in the forward-facing chase cam, **negative
world X renders on screen-right, positive X on screen-left**. All side-specific
placements (LED boards, grandstands, marshal posts on the spec's "Left Side";
year signs and the pit lane on "Right Side") were placed against this, not
against the naive assumption. Worth remembering for phase 4 event billboards.
