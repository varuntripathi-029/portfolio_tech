import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { FiChevronDown, FiMenu, FiX } from 'react-icons/fi'
import { NAV_GROUPS, type NavRow } from './navData'
import { NavPill } from './NavPill'
import { MegaMenu } from './MegaMenu'
import { SURFACE_BLUR, SURFACE_FLAT } from './surface'
import { useRaceStore } from '../state/raceStore'
import { useIsNarrowViewport } from './useTouch'

/** Grace period so moving the pointer from a pill down into the menu does not close it. */
const CLOSE_DELAY = 200
/**
 * Sustained hover before the panel opens. The bar sits across the top of a
 * scene the reader is driving through, so a pointer merely crossing it must
 * not throw a full-width panel over the track.
 */
const OPEN_DELAY = 120

export function Navbar() {
  const [openId, setOpenId] = useState<string | null>(null)
  // Pointer hover is tracked apart from the open panel: the pill's own gsap
  // wipe has to answer the pointer on the same frame, while the panel waits
  // out OPEN_DELAY to prove the hover was deliberate.
  const [hoverId, setHoverId] = useState<string | null>(null)
  const closeTimer = useRef<number | null>(null)
  const openTimer = useRef<number | null>(null)
  const barRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const requestWarp = useRaceStore((s) => s.requestWarp)
  const phase = useRaceStore((s) => s.phase)
  const reopenTutorial = useRaceStore((s) => s.reopenTutorial)
  // Block G4: the pill bar collapses to a single menu button under 768px.
  const isNarrow = useIsNarrowViewport()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const cancelOpen = () => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current)
      openTimer.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    cancelOpen()
    closeTimer.current = window.setTimeout(() => {
      setOpenId(null)
      setHoverId(null)
    }, CLOSE_DELAY)
  }

  /** Pointer arrived on a pill. */
  const hover = (id: string) => {
    cancelClose()
    cancelOpen()
    setHoverId(id)
    // A panel is already up, so intent is established and sliding sideways
    // switches groups at once. The delay only ever guards the first open.
    if (openId !== null) {
      setOpenId(id)
      return
    }
    openTimer.current = window.setTimeout(() => setOpenId(id), OPEN_DELAY)
  }

  /** Keyboard focus or a click. Nothing to prove, so no delay. */
  const openNow = (id: string) => {
    cancelClose()
    cancelOpen()
    setHoverId(id)
    setOpenId(id)
  }

  useEffect(() => {
    return () => {
      cancelClose()
      cancelOpen()
    }
  }, [])

  const pills = () => Array.from(barRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])

  /** Rows of the group currently open. Keyed by group so an outgoing list
   *  mid-cross-fade is never picked up. */
  const rows = (id: string | null) =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(`ul[data-group="${id}"] button`) ?? [],
    )

  const focusPill = (id: string | null) => {
    if (!id) return
    pills()[NAV_GROUPS.findIndex((g) => g.id === id)]?.focus()
  }

  // ArrowDown off a closed pill has to open the panel first, and its rows do
  // not exist until React commits. An effect is the only hook guaranteed to
  // run after that commit; a rAF would also work until the tab is hidden or
  // the frame rate drops, at which point the keyboard path silently breaks.
  const pendingRowFocus = useRef(false)
  useEffect(() => {
    if (!pendingRowFocus.current || !openId) return
    pendingRowFocus.current = false
    rows(openId)[0]?.focus()
  }, [openId])

  // Escape closes and hands focus back to the pill that opened the panel, so
  // the bar is never a keyboard trap and never drops the reader to the body.
  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const returnTo = openId
      setOpenId(null)
      setHoverId(null)
      focusPill(returnTo)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

  const onBarKeys = (e: React.KeyboardEvent) => {
    const list = pills()
    const index = list.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const step = e.key === 'ArrowRight' ? 1 : -1
      // Focus triggers openNow, so moving along the bar swaps panels too.
      list[(index + step + list.length) % list.length].focus()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const id = NAV_GROUPS[index].id
      if (openId === id) {
        rows(id)[0]?.focus()
      } else {
        pendingRowFocus.current = true
        openNow(id)
      }
    }
  }

  const onMenuKeys = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const list = rows(openId)
    const index = list.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) {
      list[0]?.focus()
      return
    }
    const next = index + (e.key === 'ArrowDown' ? 1 : -1)
    // Up off the top row returns to the bar rather than wrapping to the bottom.
    if (next < 0) focusPill(openId)
    else list[next % list.length]?.focus()
  }

  const pick = (row: NavRow) => {
    // Ignore a second request mid-flight: the warp captures its origin on the
    // first frame and re-entering would restart it from a partial position.
    if (phase === 'warping') return
    setOpenId(null)
    setHoverId(null)
    requestWarp(row.target)
  }

  const openGroup = NAV_GROUPS.find((g) => g.id === openId) ?? null

  // One blurred surface at a time. A card, the end card or the start screen
  // owns the blur whenever it is up; otherwise the open panel owns it; the bar
  // only blurs when it is the sole surface on screen.
  const cardShowing = phase === 'lights' || phase === 'dry' || phase === 'stopped'
  const barFlat = cardShowing || openId !== null

  return (
    <div
      data-nav-root
      className="pointer-events-none fixed inset-x-0 top-0 z-40"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
    >
      <div
        className={`chamfer-panel hud-noise pointer-events-auto relative border-b border-slate ${
          barFlat ? SURFACE_FLAT : SURFACE_BLUR
        }`}
      >
        <div className="flex items-center justify-between gap-6 px-6 py-2.5">
          <span className="shrink-0">
            <span className="block font-mono text-[10px] tracking-[0.28em] text-smoke uppercase">
              Varun Tripathi
            </span>
            <span className="block font-mono text-[10px] tracking-[0.28em] text-race-red uppercase">
              Race Engineer
            </span>
          </span>

          {isNarrow ? (
            // Block G4: one menu button instead of the pill bar. No hover
            // intent to worry about on touch, so this is a plain toggle.
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className="focus-ring chamfer-sm flex h-9 w-9 shrink-0 items-center justify-center border border-slate text-paper"
            >
              {mobileMenuOpen ? <FiX aria-hidden /> : <FiMenu aria-hidden />}
            </button>
          ) : (
            <>
              <nav ref={barRef} onKeyDown={onBarKeys} className="flex flex-wrap items-center gap-2">
                {NAV_GROUPS.map((group) => (
                  <span
                    key={group.id}
                    className="flex items-center"
                    onMouseEnter={() => hover(group.id)}
                  >
                    <NavPill
                      label={group.label}
                      // The wipe answers the pointer, not the delayed panel.
                      open={hoverId === group.id || openId === group.id}
                      onHover={() => hover(group.id)}
                      onFocus={() => openNow(group.id)}
                      // A group with one row is itself the destination, so clicking
                      // the pill jumps rather than making the reader open a menu of one.
                      onSelect={() => {
                        if (group.rows.length === 1) pick(group.rows[0])
                        else openNow(group.id)
                      }}
                    />
                    {group.rows.length > 1 && (
                      <FiChevronDown
                        aria-hidden
                        className={`-ml-1 shrink-0 text-slate transition-transform ${
                          openId === group.id ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </span>
                ))}
              </nav>

              {/* Not a warp target, so it lives outside <nav>: pills() scopes
                  its querySelectorAll to barRef for the arrow-key model, and
                  this button has no matching NAV_GROUPS entry for that index
                  lookup. */}
              <button
                type="button"
                onClick={() => reopenTutorial()}
                className="focus-ring chamfer-sm shrink-0 border border-slate px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-smoke uppercase transition-colors hover:text-paper"
              >
                How to drive
              </button>
            </>
          )}
        </div>

        {isNarrow && mobileMenuOpen && (
          <div className="max-h-[70vh] overflow-y-auto border-t border-slate px-2 pb-3">
            {NAV_GROUPS.map((group) => (
              <div key={group.id} className="py-2">
                <p className="px-4 py-1 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
                  {group.label}
                </p>
                {group.rows.map((row) => (
                  <button
                    key={`${row.label}-${row.year}`}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      pick(row)
                    }}
                    className="focus-ring block w-full px-4 py-2 text-left text-sm text-paper hover:bg-[rgba(247,244,241,0.05)]"
                  >
                    {row.label}
                  </button>
                ))}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                reopenTutorial()
              }}
              className="focus-ring mt-1 block w-full px-4 py-2 text-left font-mono text-xs tracking-widest text-smoke uppercase"
            >
              How to drive
            </button>
          </div>
        )}
      </div>

      {/* The panel itself is never re-keyed on the group: switching groups
          cross-fades inside one mounted panel (see MegaMenu). */}
      <div ref={menuRef} onKeyDown={onMenuKeys}>
        <AnimatePresence>
          {openGroup && <MegaMenu group={openGroup} onPick={pick} blur={!cardShowing} />}
        </AnimatePresence>
      </div>
    </div>
  )
}
