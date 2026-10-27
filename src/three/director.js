// The story's clock and its impact moments. One tick per frame turns raw scroll progress into
// everything the scene reads: a smoothed position in the story, the (sometimes slowed) clocks, the
// recent past for light trails, and short timed hits (the burst, the slow-motion pass, the landing).
import { introProgress, stageAt, storyState } from './timeline'

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt))
/** Rises fast and falls away over `len` seconds; 0 before and long after. */
const hit = (age, len) => (age < 0 || age > len * 3 ? 0 : Math.min(1, age / 0.06) * Math.exp(-age / len))

// Trails show where each particle was this long ago.
export const TRAIL_SECONDS = 0.16

export const director = {
  p: 0, // smoothed scroll progress
  stage: 0, // formation, as a continuous number: 0 ball · 1 word · 2 pitch · 3 the pass · 4 wordmark
  time: 0, // drives drifting and swirling; slows during slow motion
  stream: 0, // drives the pass flowing along its path
  spin: 0, // the ball's rotation
  intro: 0,
  lag: { stage: 0, time: 0, stream: 0, spin: 0, intro: 0 },
  // Seconds since each hit (Infinity: not yet).
  burstAge: Infinity,
  slowAge: Infinity,
  landAge: Infinity,
  shock: 0, // strength of the current shockwave
  shockAge: Infinity,
  shockAt: [0, 0, 0],
  flash: 0,
  shake: 0,
  sweep: -99, // z position of the light sweep across the pitch
  sweepOn: 0,
  // Set by the camera each frame: how far away it is focused, and how strongly the rest blurs.
  focus: 14,
  aperture: 0,
}

const history = []
let started = false

// Forward crossings of these stage values set off the hits.
const BURST_AT = 0.04
const SLOW_AT = 2.6
const LAND_AT = 3.9

export function tick(dt) {
  const d = director
  const reduced = storyState.reduced
  const prevStage = d.stage
  d.p = damp(d.p, storyState.progress, reduced ? 30 : 2.4, dt)
  d.stage = stageAt(d.p)
  d.intro = introProgress()

  // Hits only once the scene has fully arrived, never with reduced motion, and not on the first
  // frame (a page restored halfway down would otherwise fire them all at once).
  if (started && !reduced && d.intro >= 1) {
    if (prevStage < BURST_AT && d.stage >= BURST_AT) d.burstAge = 0
    if (prevStage < SLOW_AT && d.stage >= SLOW_AT) d.slowAge = 0
    if (prevStage < LAND_AT && d.stage >= LAND_AT) d.landAge = 0
  }
  started = true
  d.burstAge += dt
  d.slowAge += dt
  d.landAge += dt

  // Slow motion as the pass plays: time drops to a quarter speed, then eases back.
  const slow = hit(d.slowAge, 0.9)
  const scale = reduced ? 0 : 1 - 0.75 * slow
  d.time += dt * scale
  d.stream += dt * scale
  d.spin += dt * 0.32 * scale

  // The shockwave: from the ball when it bursts, softer through the wordmark when it lands.
  if (d.burstAge < d.landAge) {
    d.shockAge = d.burstAge
    d.shock = 1
    d.shockAt = [0, 0, 0]
  } else {
    d.shockAge = d.landAge
    d.shock = 0.45
    d.shockAt = [-5, 0, 0]
  }
  d.flash = Math.max(hit(d.burstAge, 0.35), 0.8 * hit(d.landAge, 0.45), 0.5 * slow)
  d.shake = Math.max(0.1 * hit(d.burstAge, 0.3), 0.14 * hit(d.landAge, 0.35))

  // A floodlight sweep runs down the pitch as its lines are drawn, and again when the pass plays.
  const drawn = Math.min(1, Math.max(0, (d.stage - 1.5) / 0.7))
  const sweepT = d.slowAge < 1.4 ? d.slowAge / 1.4 : drawn
  d.sweep = 5.5 - sweepT * 11
  d.sweepOn = d.slowAge < 1.4 ? Math.sin(Math.PI * sweepT) : Math.sin(Math.PI * drawn) * (d.stage < 2.3 ? 1 : 0)

  // Keep a moment of history for the light trails. After a pause (the scene scrolled out of view),
  // start afresh rather than drawing one long streak back to where things were.
  const now = performance.now() / 1000
  if (history.length && now - history[history.length - 1].at > 0.25) history.length = 0
  history.push({ at: now, stage: d.stage, time: d.time, stream: d.stream, spin: d.spin, intro: d.intro })
  while (history.length > 2 && history[1].at < now - TRAIL_SECONDS) history.shift()
  const past = history[0]
  d.lag.stage = past.stage
  d.lag.time = past.time
  d.lag.stream = past.stream
  d.lag.spin = past.spin
  d.lag.intro = past.intro
}
