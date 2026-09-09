import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { FiChevronDown } from 'react-icons/fi'
import { NAV_GROUPS, type NavRow } from './navData'
import { NavPill } from './NavPill'
import { MegaMenu } from './MegaMenu'
import { useRaceStore } from '../state/raceStore'

/** Grace period so moving the pointer from a pill down into the menu does not close it. */
const CLOSE_DELAY = 120

export function Navbar() {
  const [openId, setOpenId] = useState<string | null>(null)
  const closeTimer = useRef<number | null>(null)
  const requestJump = useRaceStore((s) => s.requestJump)
  const phase = useRaceStore((s) => s.phase)

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpenId(null), CLOSE_DELAY)
  }

  useEffect(() => cancelClose, [])

  // Escape closes, so the menu is not a keyboard trap.
  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

  const pick = (row: NavRow) => {
    // Ignore a second request mid-flight; the jump captures its origin on the
    // first frame and re-entering would restart it from a partial position.
    if (phase === 'jumping') return
    setOpenId(null)
    requestJump(row.target)
  }

  const openGroup = NAV_GROUPS.find((g) => g.id === openId) ?? null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
    >
      <div className="chamfer-panel hud-noise pointer-events-auto relative border-b border-slate bg-[rgba(21,21,30,0.82)] backdrop-blur-[6px]">
        <div className="flex items-center justify-between gap-6 px-6 py-2.5">
          <span className="shrink-0">
            <span className="block font-mono text-[10px] tracking-[0.28em] text-smoke uppercase">
              Varun Tripathi
            </span>
            <span className="block font-mono text-[10px] tracking-[0.28em] text-race-red uppercase">
              Race Engineer
            </span>
          </span>

          <nav className="flex flex-wrap items-center gap-2">
            {NAV_GROUPS.map((group) => (
              <span
                key={group.id}
                className="flex items-center"
                onMouseEnter={() => {
                  cancelClose()
                  setOpenId(group.id)
                }}
              >
                <NavPill
                  label={group.label}
                  open={openId === group.id}
                  onHover={() => {
                    cancelClose()
                    setOpenId(group.id)
                  }}
                  // A group with one row is itself the destination, so clicking
                  // the pill jumps rather than making the reader open a menu of one.
                  onSelect={() => {
                    if (group.rows.length === 1) pick(group.rows[0])
                    else setOpenId(group.id)
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
        </div>
      </div>

      <AnimatePresence mode="wait">
        {openGroup && <MegaMenu key={openGroup.id} group={openGroup} onPick={pick} />}
      </AnimatePresence>
    </div>
  )
}
