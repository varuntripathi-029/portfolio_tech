import { useEffect, useState } from 'react'
import { useRaceStore } from '../state/raceStore'
import { DriverStats, CarSpecification } from './DriverProfile'

const LIGHT_INTERVAL = 550

/**
 * The 3-2-1 countdown state, shared by the bottom light bulbs and the big
 * top-of-screen numerals (Block F): one timer, not two independently-running
 * `setTimeout` chains that could drift apart from each other.
 *
 * Only ever runs during the 'launching' phase, which is timed to
 * `LAUNCH_DURATION` (2.2s) in Car.tsx and drives the camera orbit in
 * ChaseCam.tsx. Idle (all dark) any other time, so it is ready to replay
 * clean on the next lap.
 */
function useLightsCountdown() {
  const phase = useRaceStore((s) => s.phase)
  const [lit, setLit] = useState(0) // 0..3 lit, -1 = lights out

  useEffect(() => {
    if (phase !== 'launching') {
      setLit(0)
      return
    }
    let cancelled = false
    let n = 0
    setLit(0)
    const tick = () => {
      const delay = n >= 3 ? 500 : LIGHT_INTERVAL
      window.setTimeout(() => {
        if (cancelled) return
        n += 1
        setLit(n >= 4 ? -1 : n)
        if (n < 4) tick()
      }, delay)
    }
    tick()
    return () => {
      cancelled = true
    }
  }, [phase])

  return lit
}

function StartLights({ lit }: { lit: number }) {
  return (
    <div className="flex gap-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="chamfer-sm h-7 w-7 border border-slate"
          style={{ background: lit > i ? 'var(--color-race-red)' : 'var(--color-graphite)' }}
        />
      ))}
    </div>
  )
}

/**
 * Big numeral countdown, top-centre: "3", "2", "1" as each bulb lights, then
 * nothing once they go dark together (lights-out is the launch itself, not
 * another number). Purely decorative next to the bulbs, which are the real
 * state the reduced-motion and replay logic already covers.
 */
function TopCountdown({ lit }: { lit: number }) {
  const phase = useRaceStore((s) => s.phase)
  if (phase !== 'launching' || lit <= 0) return null
  const label = 3 - lit + 1 // lit=1 -> "3", lit=2 -> "2", lit=3 -> "1"

  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-30 flex justify-center">
      <span
        key={label}
        className="animate-[countdown-pop_0.5s_ease-out] font-mono text-7xl font-black tracking-tight text-race-red drop-shadow-[0_0_24px_rgba(225,6,0,0.55)]"
      >
        {label}
      </span>
    </div>
  )
}

/**
 * The DRIVER profile, anchored to one side of the screen so it never covers
 * the car: the load camera sits in front at a 3/4 angle specifically so the
 * car and this card can share the frame (spec 7.1).
 *
 * Shown only until the first W: `driverSeen` then keeps it off the grid for
 * every later lap, while the lights themselves (`StartLights`, above) still
 * replay every time. The navbar's DRIVER row is how the profile is reached
 * again after that.
 */
export function StartSequence() {
  const driverSeen = useRaceStore((s) => s.driverSeen)
  const tutorialSeen = useRaceStore((s) => s.tutorialSeen)
  const phase = useRaceStore((s) => s.phase)
  const lit = useLightsCountdown()

  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-30 flex w-full items-center justify-start pt-16 pb-10 pl-6">
      {/* DRIVER waits for the onboarding card to be dismissed first, so the
          two never compete for the same "before you can drive" beat. */}
      {!driverSeen && tutorialSeen && (
        <div className="pointer-events-auto flex max-h-[80vh] w-[min(520px,44vw)] flex-col gap-6 overflow-y-auto">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-smoke uppercase">Varun Tripathi</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-paper uppercase">
              Race Engineer
            </h1>
          </div>
          <DriverStats />
          <CarSpecification />
        </div>
      )}

      <TopCountdown lit={lit} />

      <div className="pointer-events-auto fixed bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
        <StartLights lit={lit} />
        {phase === 'lights' && (
          <p className="font-mono text-xs tracking-[0.2em] text-smoke uppercase">Press W to go</p>
        )}
      </div>
    </div>
  )
}
