/**
 * Backdrop blur over a live WebGL canvas is the most expensive thing the DOM
 * layer does, so the project allows exactly one blurred surface on screen at a
 * time. Anything that loses the budget flattens to the same colour at higher
 * opacity, which reads almost identically against the dark track.
 */
export const SURFACE_BLUR = 'bg-[rgba(21,21,30,0.82)] backdrop-blur-[6px]'
export const SURFACE_FLAT = 'bg-[rgba(21,21,30,0.94)]'
