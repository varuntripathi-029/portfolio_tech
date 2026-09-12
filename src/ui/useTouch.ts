import { useEffect, useState } from 'react'

/**
 * Touch detection (Block G): `(pointer: coarse)` is the right query, not
 * `ontouchstart in window` (true on plenty of touch-capable laptops with a
 * mouse attached) or viewport width alone (a touch tablet can be wide). This
 * is what the tutorial copy, the auto-drive gate, and the lighter-render
 * quality tier below all key off.
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const onChange = () => setIsTouch(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isTouch
}

/** Under this width the navbar collapses to a menu button (Block G4). */
export const MOBILE_BREAKPOINT = 768

export function useIsNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  )

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return narrow
}
