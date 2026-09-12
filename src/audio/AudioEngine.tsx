import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useCarStore } from '../state/carStore'
import { useRaceStore } from '../state/raceStore'
import {
  resumeOnGesture,
  setRpmGains,
  setIdleGain,
  setDriftSqueal,
  setReverseWhine,
  setThrottleLoad,
  triggerBurble,
  silenceAll,
  subscribeMute,
  isMuted,
  toggleMuted,
} from './engine'

/** Above this speed, hard braking gets its own short squeal (Block G). */
const HARD_BRAKE_SQUEAL_SPEED = 150 / 3.6

const IDLE_RPM = 2500
const REDLINE_RPM = 12000

/** How high a launch flare or a downshift blip pushes the synthetic rpm. */
const LAUNCH_FLARE_RPM = REDLINE_RPM * 0.72
const DOWNSHIFT_BLIP_RPM = REDLINE_RPM * 0.6

/**
 * Headless: owns the engine-audio lifecycle and translates sim state into
 * gain changes. Mounted once in Overlay, outside the Canvas (this is DOM-side
 * bookkeeping and Web Audio, neither needs a frame loop of its own; it rides
 * the car store's own per-physics-frame updates as its clock).
 */
export function AudioEngine() {
  const phaseRef = useRef<string>('lights')
  const phaseEnteredAt = useRef(performance.now())
  const lastGear = useRef(0)
  const lastThrottleInput = useRef(false)

  // Lights countdown timing, mirrored from StartSequence.tsx's own schedule
  // (3 lights at 550ms, then a 500ms hold) rather than imported, since audio
  // must not depend on a specific DOM component existing.
  const LIGHT_INTERVAL = 0.55

  useEffect(() => {
    // The first W is the resume gesture, called here and nowhere else per
    // spec 11. Left bound for the whole session rather than removed after
    // one use: resumeOnGesture()/AudioContext.resume() are no-ops once
    // already running, so a W held down or pressed again costs nothing, and
    // this is the only recovery path if the very first resume() call lost a
    // race with the browser's own autoplay gate.
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'w') void resumeOnGesture()
      if (k === 'm') toggleMuted()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const unsubRace = useRaceStore.subscribe((s) => {
      if (s.phase !== phaseRef.current) {
        phaseRef.current = s.phase
        phaseEnteredAt.current = performance.now()
        if (s.phase === 'driving') {
          // Launch flare: lights out. One held-high impulse; the very next
          // physics-frame update below overwrites it with the real (still
          // low, since v=0) rpm, so this reads as a flare-then-settle, not
          // a sustained hold.
          setRpmGains(LAUNCH_FLARE_RPM)
        }
        if (s.phase === 'dry') silenceAll()
      }
    })

    const unsubCar = useCarStore.subscribe((car) => {
      const phase = phaseRef.current
      const elapsed = (performance.now() - phaseEnteredAt.current) / 1000

      // Independent of the rpm/idle branches below: the squeal only ever
      // depends on the sim's own slip angle, which is already zero (and
      // `drifting` already false) whenever a phase does not allow driving.
      const hardBraking = car.braking && car.v > HARD_BRAKE_SQUEAL_SPEED
      setDriftSqueal(car.slipAngle, car.drifting, hardBraking)
      // Same independence for the reverse whine: `reversing` and `v` are
      // already correct (false / capped low) in every phase but 'driving'.
      setReverseWhine(car.reversing, car.v)

      // Throttle load and the overrun burble: real pedal input, not a
      // derived rpm/speed guess, and independent of phase for the same
      // reason as the squeal and whine above (throttleInput already reads
      // false wherever it cannot mean anything).
      setThrottleLoad(car.throttleInput)
      if (lastThrottleInput.current && !car.throttleInput) triggerBurble()
      lastThrottleInput.current = car.throttleInput

      if (phase === 'dry') return // already silenced on entry; nothing to update

      if (phase === 'lights') {
        setRpmGains(IDLE_RPM)
        setIdleGain(0.35)
        return
      }

      if (phase === 'launching') {
        // Revs held and blipped once per light: a quick rise then fall
        // inside each LIGHT_INTERVAL window.
        const t = (elapsed % LIGHT_INTERVAL) / LIGHT_INTERVAL
        const blip = Math.sin(Math.min(1, t * 2) * Math.PI) // 0 -> 1 -> 0 across the first half
        setRpmGains(IDLE_RPM + blip * (REDLINE_RPM * 0.35 - IDLE_RPM))
        setIdleGain(0)
        return
      }

      if (phase === 'stopped') {
        setRpmGains(IDLE_RPM, 0.3)
        setIdleGain(0.5)
        return
      }

      // driving, arriving, warping, creeping: track the sim's real rpm.
      setIdleGain(0)

      if ((phase === 'arriving' || phase === 'driving') && car.gear < lastGear.current) {
        // Downshift blip: under the automatic section braking (arriving),
        // and now also under manual S braking during free driving, since a
        // gear the box actually dropped sounds the same either way.
        setRpmGains(Math.max(car.rpm, DOWNSHIFT_BLIP_RPM))
      } else {
        setRpmGains(car.rpm || IDLE_RPM)
      }
      lastGear.current = car.gear
    })

    return () => {
      unsubRace()
      unsubCar()
    }
  }, [])

  return <MuteToggle />
}

/** Always-reachable visible mute control, per spec 11. */
function MuteToggle() {
  const muted = useSyncExternalStore(subscribeMute, isMuted, () => false)
  return (
    <button
      type="button"
      onClick={() => toggleMuted()}
      aria-label={muted ? 'Unmute engine audio' : 'Mute engine audio'}
      aria-pressed={muted}
      className="focus-ring chamfer-sm pointer-events-auto fixed right-6 bottom-[168px] z-20 flex h-8 w-8 items-center justify-center border border-slate bg-[rgba(21,21,30,0.7)] font-mono text-[13px] text-paper"
    >
      {muted ? '\u{1F507}' : '\u{1F50A}'}
    </button>
  )
}
