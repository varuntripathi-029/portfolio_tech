/**
 * The engine audio graph: six looping sources, crossfaded by gain against
 * RPM, always running, never restarted.
 *
 * A plain module-level singleton rather than a React hook or store slice:
 * `AudioContext`, `AudioBufferSourceNode` and friends are stateful browser
 * objects with their own lifecycle rules (a source node plays exactly once
 * and cannot be restarted; a context needs a user gesture to resume), and
 * wrapping that in React state would fight React's re-render model for no
 * benefit. `AudioEngine.tsx` is the thin React binding that calls into this.
 */

const LOOP_COUNT = 6
const LOOP_URLS = Array.from({ length: LOOP_COUNT }, (_, i) => `/audio/loop_${i}.ogg`)

/** Matches sim/car.ts. Duplicated rather than imported: this module must stay
 * loadable (and its constants meaningful) even before the sim has run once. */
const IDLE_RPM = 2500
const REDLINE_RPM = 12000

const MASTER_GAIN_CAP = 0.4
const MUTE_KEY = 'f1-portfolio-muted'

/** How fast a gain change ramps, in seconds. Long enough to avoid a click,
 * short enough to track a gear shift. */
const GAIN_RAMP = 0.08

interface EngineState {
  ctx: AudioContext | null
  master: GainNode | null
  loopGains: GainNode[]
  sources: AudioBufferSourceNode[]
  buffers: (AudioBuffer | null)[]
  ready: boolean
  muted: boolean
  /** Idle-buzz filter, built from loop 0 at a lower rate. */
  idleFilter: BiquadFilterNode | null
  idleGain: GainNode | null
  /** Block F: procedural tyre squeal. A looping white-noise buffer (no
   * downloaded asset, per the brief) through a resonant bandpass, gain and
   * centre frequency both driven by slip angle. */
  squealFilter: BiquadFilterNode | null
  squealGain: GainNode | null
  /** Block F / F5: reverse whine, a second tap off loop 0 (same source the
   * idle buzz already reuses) sped up and highpassed instead of slowed and
   * lowpassed, so it reads as a distinct electric-motor-ish whine rather
   * than more idle. */
  reverseFilter: BiquadFilterNode | null
  reverseGain: GainNode | null
  /** Block G: throttle "load". Every loop gain feeds through this one shared
   * lowpass and trim gain before master, so throttle-on brightens and lifts
   * the whole engine tone and a lift dulls and drops it, instead of the same
   * six loops sounding identical whether the pedal is down or not. */
  loadFilter: BiquadFilterNode | null
  loadGain: GainNode | null
  /** One-shot overrun burble on lift-off: a short bandpassed noise burst,
   * not a loop, so it decays on its own and never needs to be silenced. */
  burbleFilter: BiquadFilterNode | null
  burbleGain: GainNode | null
  listeners: Set<() => void>
}

const state: EngineState = {
  ctx: null,
  master: null,
  loopGains: [],
  sources: [],
  buffers: [null, null, null, null, null, null],
  ready: false,
  muted: readStoredMute(),
  idleFilter: null,
  idleGain: null,
  squealFilter: null,
  squealGain: null,
  reverseFilter: null,
  reverseGain: null,
  loadFilter: null,
  loadGain: null,
  burbleFilter: null,
  burbleGain: null,
  listeners: new Set(),
}

const LOAD_FILTER_CLOSED = 1200
const LOAD_FILTER_OPEN = 9000
const LOAD_GAIN_LIFT = 0.85
const LOAD_GAIN_THROTTLE = 1.0
const LOAD_RAMP = 0.15

/** Slip angle at which the squeal reaches full gain and its highest pitch. */
const SQUEAL_MAX_SLIP_DEG = 20
const SQUEAL_FREQ_LOW = 1000
const SQUEAL_FREQ_HIGH = 2000
const SQUEAL_Q = 8
const SQUEAL_MAX_GAIN = 0.5

const REVERSE_MAX_GAIN = 0.32
const REVERSE_PLAYBACK_RATE = 1.35
const REVERSE_FILTER_FREQ = 550

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function notify() {
  for (const l of state.listeners) l()
}

export function subscribeMute(listener: () => void): () => void {
  state.listeners.add(listener)
  return () => state.listeners.delete(listener)
}

export function isMuted(): boolean {
  return state.muted
}

export function setMuted(muted: boolean) {
  state.muted = muted
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* private-browsing or storage disabled: mute still works this session */
  }
  applyMasterGain()
  notify()
}

export function toggleMuted() {
  setMuted(!state.muted)
}

function applyMasterGain() {
  if (!state.master || !state.ctx) return
  const target = state.muted ? 0 : MASTER_GAIN_CAP
  state.master.gain.setTargetAtTime(target, state.ctx.currentTime, 0.05)
}

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  const data = await res.arrayBuffer()
  return ctx.decodeAudioData(data)
}

/**
 * Builds the graph and starts all six loops at zero gain. Safe to call more
 * than once; only the first call does anything.
 */
export async function initEngine(): Promise<void> {
  if (state.ctx) return
  const ctx = new AudioContext()
  state.ctx = ctx

  const master = ctx.createGain()
  master.gain.value = 0 // ramped up by applyMasterGain once resumed
  master.connect(ctx.destination)
  state.master = master

  const buffers = await Promise.all(LOOP_URLS.map((url) => loadBuffer(ctx, url)))
  state.buffers = buffers

  // Block G: every loop feeds through one shared "load" lowpass and trim
  // gain before master, so the whole engine tone brightens under throttle
  // and dulls on a lift instead of six loops that sound the same regardless.
  const loadFilter = ctx.createBiquadFilter()
  loadFilter.type = 'lowpass'
  loadFilter.frequency.value = LOAD_FILTER_OPEN
  const loadGain = ctx.createGain()
  loadGain.gain.value = LOAD_GAIN_THROTTLE
  loadFilter.connect(loadGain)
  loadGain.connect(master)
  state.loadFilter = loadFilter
  state.loadGain = loadGain

  buffers.forEach((buffer, i) => {
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(loadFilter)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gain)
    source.start()

    state.loopGains[i] = gain
    state.sources[i] = source
  })

  // Idle buzz: the lowest loop, slowed and low-passed, per spec 11. No extra
  // download, just a second tap off the same buffer.
  const idleSource = ctx.createBufferSource()
  idleSource.buffer = buffers[0]
  idleSource.loop = true
  idleSource.playbackRate.value = 0.6
  const idleFilter = ctx.createBiquadFilter()
  idleFilter.type = 'lowpass'
  idleFilter.frequency.value = 800
  const idleGain = ctx.createGain()
  idleGain.gain.value = 0
  idleSource.connect(idleFilter)
  idleFilter.connect(idleGain)
  idleGain.connect(master)
  idleSource.start()
  state.idleFilter = idleFilter
  state.idleGain = idleGain

  // Procedural tyre squeal: a short buffer of white noise, looped, through a
  // resonant bandpass. No downloaded asset, per the brief -- the buffer is
  // generated, not decoded.
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1
  const noiseSource = ctx.createBufferSource()
  noiseSource.buffer = noiseBuffer
  noiseSource.loop = true
  const squealFilter = ctx.createBiquadFilter()
  squealFilter.type = 'bandpass'
  squealFilter.frequency.value = SQUEAL_FREQ_LOW
  squealFilter.Q.value = SQUEAL_Q
  const squealGain = ctx.createGain()
  squealGain.gain.value = 0
  noiseSource.connect(squealFilter)
  squealFilter.connect(squealGain)
  squealGain.connect(master)
  noiseSource.start()
  state.squealFilter = squealFilter
  state.squealGain = squealGain

  // Reverse whine: a second tap off loop 0, sped up and highpassed (the
  // idle buzz taps the same buffer slowed down and lowpassed), so the two
  // never sound like the same event even though neither downloads anything.
  const reverseSource = ctx.createBufferSource()
  reverseSource.buffer = buffers[0]
  reverseSource.loop = true
  reverseSource.playbackRate.value = REVERSE_PLAYBACK_RATE
  const reverseFilter = ctx.createBiquadFilter()
  reverseFilter.type = 'highpass'
  reverseFilter.frequency.value = REVERSE_FILTER_FREQ
  const reverseGain = ctx.createGain()
  reverseGain.gain.value = 0
  reverseSource.connect(reverseFilter)
  reverseFilter.connect(reverseGain)
  reverseGain.connect(master)
  reverseSource.start()
  state.reverseFilter = reverseFilter
  state.reverseGain = reverseGain

  // Overrun burble on lift-off: the same noise buffer as the squeal, a third
  // independent tap, through a low bandpass so it reads as an exhaust
  // burble rather than more tyre noise. Looping and always-on like every
  // other source here; `triggerBurble` below is a one-shot ENVELOPE on its
  // gain, not a restart.
  const burbleSource = ctx.createBufferSource()
  burbleSource.buffer = noiseBuffer
  burbleSource.loop = true
  const burbleFilter = ctx.createBiquadFilter()
  burbleFilter.type = 'bandpass'
  burbleFilter.frequency.value = 350
  burbleFilter.Q.value = 1.2
  const burbleGain = ctx.createGain()
  burbleGain.gain.value = 0
  burbleSource.connect(burbleFilter)
  burbleFilter.connect(burbleGain)
  burbleGain.connect(master)
  burbleSource.start()
  state.burbleFilter = burbleFilter
  state.burbleGain = burbleGain

  state.ready = true
  applyMasterGain()
}

/**
 * Throttle "load": brightens (opens the shared lowpass) and slightly lifts
 * gain under throttle, dulls and drops it on a lift. One shared filter for
 * all six loops, so the whole engine tone shifts together rather than any
 * one stage sounding disconnected from the rest.
 */
export function setThrottleLoad(throttleOn: boolean) {
  if (!state.loadFilter || !state.loadGain || !state.ctx) return
  const now = state.ctx.currentTime
  state.loadFilter.frequency.setTargetAtTime(
    throttleOn ? LOAD_FILTER_OPEN : LOAD_FILTER_CLOSED,
    now,
    LOAD_RAMP,
  )
  state.loadGain.gain.setTargetAtTime(throttleOn ? LOAD_GAIN_THROTTLE : LOAD_GAIN_LIFT, now, LOAD_RAMP)
}

/**
 * One-shot overrun burble, fired on a throttle-lift edge. A short attack and
 * a longer decay on the burble gain, layered on top of whatever else is
 * playing rather than replacing it.
 */
export function triggerBurble() {
  if (!state.burbleGain || !state.ctx) return
  const now = state.ctx.currentTime
  state.burbleGain.gain.cancelScheduledValues(now)
  state.burbleGain.gain.setValueAtTime(state.burbleGain.gain.value, now)
  state.burbleGain.gain.linearRampToValueAtTime(0.35, now + 0.03)
  state.burbleGain.gain.setTargetAtTime(0, now + 0.03, 0.12)
}

/**
 * Drives the procedural squeal from the sim's own slip angle: gain and
 * centre frequency both climb with |slipAngle|, so the squeal rises into a
 * corner and falls away as the car straightens or the drift is released.
 * Never restarts the noise source, same discipline as the engine loops.
 */
export function setDriftSqueal(slipAngleDeg: number, drifting: boolean, hardBraking = false) {
  if (!state.squealGain || !state.squealFilter || !state.ctx) return
  const now = state.ctx.currentTime
  const slideMag = drifting ? Math.min(1, Math.abs(slipAngleDeg) / SQUEAL_MAX_SLIP_DEG) : 0
  // Hard braking above ~150km/h gets a short squeal of its own, independent
  // of slip angle: real tyres chirp under heavy braking even going dead
  // straight. Capped below the full slide squeal so a drift still reads as
  // the louder event.
  const mag = Math.max(slideMag, hardBraking ? 0.5 : 0)
  state.squealGain.gain.setTargetAtTime(mag * SQUEAL_MAX_GAIN, now, GAIN_RAMP)
  const freq = SQUEAL_FREQ_LOW + mag * (SQUEAL_FREQ_HIGH - SQUEAL_FREQ_LOW)
  state.squealFilter.frequency.setTargetAtTime(freq, now, GAIN_RAMP)
}

/**
 * Reverse whine: on while `reversing`, gain tracking speed (m/s, over the
 * ~7 m/s reverse top speed) so it rises as the car actually picks up speed
 * backward rather than switching on at full volume the instant reverse
 * engages.
 */
export function setReverseWhine(reversing: boolean, speed: number) {
  if (!state.reverseGain || !state.ctx) return
  const now = state.ctx.currentTime
  const REVERSE_TOP_SPEED_APPROX = 7
  const mag = reversing ? Math.min(1, speed / REVERSE_TOP_SPEED_APPROX) : 0
  state.reverseGain.gain.setTargetAtTime(mag * REVERSE_MAX_GAIN, now, GAIN_RAMP)
}

/**
 * The user gesture that unlocks audio. Call from the first W keydown and
 * nowhere else: a context created at load starts suspended and stays silent
 * with no error otherwise.
 */
export async function resumeOnGesture(): Promise<void> {
  if (!state.ctx) await initEngine()
  if (state.ctx?.state === 'suspended') await state.ctx.resume()
}

export function contextState(): string {
  return state.ctx?.state ?? 'uninitialised'
}

/** Read-only snapshot of the six loop gains and the idle gain, for verification. */
export function currentGains(): { loops: number[]; idle: number; master: number } {
  return {
    loops: state.loopGains.map((g) => g?.gain.value ?? 0),
    idle: state.idleGain?.gain.value ?? 0,
    master: state.master?.gain.value ?? 0,
  }
}

/**
 * Sets the six loop gains from an rpm value, crossfading between the two
 * adjacent stages and applying playbackRate for fine pitch within a stage.
 * Called every frame from AudioEngine.tsx; never restarts a source.
 */
export function setRpmGains(rpm: number, extraGain = 1) {
  if (!state.ready || !state.ctx) return
  const frac = Math.max(0, Math.min(1, (rpm - IDLE_RPM) / (REDLINE_RPM - IDLE_RPM)))
  const pos = frac * (LOOP_COUNT - 1)
  const lo = Math.floor(pos)
  const hi = Math.min(LOOP_COUNT - 1, lo + 1)
  const t = pos - lo

  const now = state.ctx.currentTime
  state.loopGains.forEach((gain, i) => {
    let target = 0
    if (i === lo) target = (1 - t) * extraGain
    else if (i === hi && hi !== lo) target = t * extraGain
    gain.gain.setTargetAtTime(target, now, GAIN_RAMP)
  })

  // Fine pitch within the active stage(s): +/-6% around the stage's own rate.
  const pitchAt = (stageT: number) => 0.97 + stageT * 0.06
  if (state.sources[lo]) state.sources[lo].playbackRate.setTargetAtTime(pitchAt(t), now, GAIN_RAMP)
  if (state.sources[hi]) state.sources[hi].playbackRate.setTargetAtTime(pitchAt(t), now, GAIN_RAMP)
}

/** Ramps the idle buzz in or out. 0 elsewhere, ~0.5 at a stop. */
export function setIdleGain(target: number) {
  if (!state.idleGain || !state.ctx) return
  state.idleGain.gain.setTargetAtTime(target, state.ctx.currentTime, GAIN_RAMP * 2)
}

/** Cuts every loop and the idle buzz to silence, for CONTACT running dry. */
export function silenceAll() {
  if (!state.ctx) return
  const now = state.ctx.currentTime
  for (const gain of state.loopGains) gain.gain.setTargetAtTime(0, now, 0.3)
  if (state.idleGain) state.idleGain.gain.setTargetAtTime(0, now, 0.3)
  if (state.squealGain) state.squealGain.gain.setTargetAtTime(0, now, 0.3)
  if (state.reverseGain) state.reverseGain.gain.setTargetAtTime(0, now, 0.3)
}
