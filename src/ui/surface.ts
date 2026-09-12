/**
 * Backdrop blur over a live WebGL canvas is the most expensive thing the DOM
 * layer does, so the project allows exactly one blurred surface on screen at a
 * time. Anything that loses the budget flattens to the same colour at higher
 * opacity, which reads almost identically against the dark track.
 */
/**
 * Block F: restored to a real, more pronounced glassmorphism look (lower
 * fill opacity, more blur, a touch of saturation) on explicit request, after
 * Block D had flattened cards to `SURFACE_FLAT` following a PERF GUARD
 * fps reading below 60 on this machine's integrated GPU. Re-measured after
 * that change; see FINAL2_NOTES.md's Block F entry for the numbers.
 *
 * Block G: pushed further again on explicit request -- lower fill still,
 * more blur, more saturation. Re-measured again; see the Block G entry.
 */
export const SURFACE_BLUR = 'bg-[rgba(21,21,30,0.55)] backdrop-blur-[18px] backdrop-saturate-[1.6]'
export const SURFACE_FLAT = 'bg-[rgba(21,21,30,0.94)]'
