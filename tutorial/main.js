// "How to play The Vision Test": a video tutorial rendered from the real game.
//
// The pitch on the left is the game itself (src/game/visionTest.js) in its manual mode: each chapter
// sets up exact rounds and plays them with scripted looks and passes, so every rule is shown happening.
// Labels, an on-screen cursor and the explanation panel on the right are drawn over it here. Every
// frame is computed from the frames before it in a fixed order, so the render is repeatable.
// Driven by scripts/render-tutorial.mjs (npm run tutorial).
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { academy } from '../shared/academy.js'
import { FIRST_TIME_BONUS, LEVELS, createVisionTest, loadGraphics, soundInto } from '../src/game/visionTest.js'
import { tierFor, tipFor } from '../src/game/review.js'
import { TUTORIAL_CHAPTERS as CHAPTERS, TUTORIAL_SECONDS as DURATION } from '../src/game/tutorialChapters.js'
import '../src/styles/base.css'

const W = 1920
const H = 1080
const FPS = 30
const STEP = 1 / 60 // the game runs at 60 steps a second, two per video frame
const GW = 1160 // the pitch takes the left of the frame; the explanation sits on the right
const PX = GW + 70 // the panel's text column
const PW = W - PX - 80
const VOLT = '#d7ff3a'
const BONE = '#f2f2ee'
const SMOKE = '#b8b8b2'
const ASH = '#8b8b86'
const DANGER = '#ff6a5c'
const DEG = Math.PI / 180
// A shirt (24 units square), the same as the key on the game page.
const SHIRT = new Path2D(
  'M8.2 3 3.6 5.4 1.8 10l3.4 1.5 1.1-2V21h11.4V9.5l1.1 2 3.4-1.5-1.8-4.6L15.8 3c-.7 1.5-2.1 2.4-3.8 2.4S8.9 4.5 8.2 3Z',
)

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (v) => v * v * (3 - 2 * v)
const at = (deg, d) => ({ x: Math.sin(deg * DEG) * d, y: -Math.cos(deg * DEG) * d })
const mate = (deg, d, run = {}) => ({ ...at(deg, d), ...run })
const presser = (deg, d, startAt, speed) => ({ ...at(deg, d), startAt, ...(speed ? { speed } : {}) })
const angleOf = (p) => Math.atan2(p.x, -p.y) / DEG
const lerp = (a, b, u) => a + (b - a) * u
/** An angle that moves smoothly through [time, degrees] keys. */
function sweep(keys, t) {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a0] = keys[i]
    const [t1, a1] = keys[i + 1]
    if (t <= t1) return lerp(a0, a1, smooth((t - t0) / (t1 - t0)))
  }
  return keys[keys.length - 1][1]
}

// ---------- The rounds each chapter plays ----------

const THREE = [mate(-48, 12), mate(4, 15), mate(46, 11)]
const CALM = { passer: { x: 2, y: 10 }, passAt: 99, mates: THREE, open: 1, pressers: [] }
const LAYOUT = [mate(-50, 12), mate(0, 15), mate(48, 12)]
// A presser from behind on the left while the ball comes from behind on the right.
const TWO = {
  passer: { x: 1, y: 12 },
  passAt: 1.8,
  mates: [mate(-55, 12), mate(-18, 15), mate(20, 14), mate(55, 12)],
  open: 1,
  pressers: [presser(-140, 9.5, 1.9, 6.4), presser(140, 11, 2.1, 6.0)],
}
const PRESSED = {
  passer: { x: 5, y: 11 },
  passAt: 1.6,
  mates: [mate(-45, 12), mate(5, 15), mate(50, 12)],
  open: 1,
  pressers: [presser(-140, 9.5, 1.7, 5.0)],
}

// A scripted player for one round, step by step: look forward, check shoulders, watch the ball in,
// glance at the pass, and play it. Times are the round's own clock.
function player(
  k,
  { checks = [], lookUp = null, target = null, firstTime = false, delay = 0.15, blind = false, key = null, scan = 0 },
) {
  const R = k.R()
  if (!R || R.phase === 'over') return k.look(0)
  const t = R.t
  const goal = target != null ? R.mates[target] : null
  if (R.phase === 'build') {
    for (const [a, b, deg] of checks) if (t >= a && t < b) return k.look(deg)
    return k.look(scan ? Math.sin(t * 2.2) * scan : 0)
  }
  if (R.phase === 'incoming') {
    const d = Math.hypot(R.ball.x, R.ball.y)
    if (lookUp && d < lookUp[0] && d > lookUp[1] && goal) {
      k.aim(goal)
      if (firstTime) k.press(goal, 'first')
      return
    }
    if (!firstTime && !blind && goal && d < 2.9) return k.aim(goal)
    return k.aim(R.ball)
  }
  if (R.phase === 'onball') {
    if (!goal) return k.look(0)
    const target = blind ? goal.seen || goal : goal
    if (!blind) k.aim(goal)
    if (t >= R.readyAt + delay) {
      if (key) k.key(key, target, 'pass')
      else k.press(target, 'pass')
    }
  }
}

// A bot for the chapters that just play: it scans both shoulders, watches the ball in, and often plays
// first time. With lazy: true it never checks, for the practice hints.
function bot(k, { lazy = false } = {}) {
  const S = k.S()
  const R = S?.round
  if (!R || R.phase === 'over') return k.look(0)
  const seg = (p, q) => {
    const k2 = clamp01((p.x * q.x + p.y * q.y) / (q.x * q.x + q.y * q.y))
    return Math.hypot(p.x - q.x * k2, p.y - q.y * k2)
  }
  const fresh = (e) => (S.visible(e) ? e : e.seen && S.clock - e.seen.at < 2.4 ? e.seen : null)
  const pick = () => {
    let best = null
    for (const m of R.mates) {
      const p = fresh(m)
      if (!p) continue
      const clear = Math.min(9, ...[...R.opps, ...R.pressers].map((o) => (fresh(o) ? seg(fresh(o), p) : 9)))
      if (!best || clear > best.clear) best = { clear, p }
    }
    return best?.p
  }
  const t = R.t
  if (lazy) {
    k.look(0)
    if (R.phase === 'onball' && t > R.readyAt + 0.5) {
      const p = pick()
      if (p) k.pressAny(p)
    }
    return
  }
  const side = R.pressers[0] && R.pressers[0].x < 0 ? -1 : 1
  if (R.phase === 'build') {
    if (t > R.passAt - 0.95 && t < R.passAt - 0.5) return k.look(-140 * side)
    if (t >= R.passAt - 0.5 && R.pressers.length > 1) return k.look(140 * side)
    if (t >= R.passAt - 0.5) return k.look(-140 * side)
    return k.look(Math.sin(t * 2) * 30)
  }
  if (R.phase === 'incoming') {
    const d = Math.hypot(R.ball.x, R.ball.y)
    const p = pick()
    if (d < 7 && d > 4.4 && p) return k.aim(p)
    if (d < 3.3 && p && !R.queued && S.stats.rounds % 2 === 0) k.pressAny(p)
    if (d < 2.9 && p && S.stats.rounds % 2 === 1) return k.aim(p)
    return k.aim(R.ball)
  }
  if (R.phase === 'onball') {
    const p = pick()
    if (p) {
      k.aim(p)
      if (t >= R.readyAt + 0.08) k.pressAny(p)
    }
  }
}

// What each chapter sets up, how it is played, the labels over the pitch, and the panel's extras.
// Times called `u` are seconds into the chapter; `t` is the round's own clock.
const SCENES = {
  intro: { rounds: [CALM], input: (k, u) => k.look(Math.sin(u * 0.9) * 35, 9, true), extra: 'intro' },
  you: {
    rounds: [CALM],
    input: (k) => k.look(0, 9, true),
    notes: (k, u) => [
      u > 0.4 && { at: { x: 0, y: 0 }, text: 'You', ring: 1.3, dir: [80, 90] },
      u > 1.6 && { at: { x: 0, y: -19.5 }, text: '↑ Forward, towards goal', ring: 0, dir: [0, 0] },
      u > 2.8 && { at: k.R()?.mates[2], text: 'Your teammates', ring: 1.2, dir: [100, 50] },
      u > 4.2 && { at: k.R()?.opps[0], text: 'Opponents', ring: 1.1, color: BONE, dir: [-150, -40] },
    ],
    extra: 'legend',
  },
  look: {
    rounds: [CALM],
    input: (k, u) =>
      k.look(
        sweep(
          [
            [0, 0],
            [1.0, 0],
            [2.4, -95],
            [3.8, -165],
            [5.6, 120],
            [7.2, 40],
            [8.4, 0],
          ],
          u,
        ),
      ),
    notes: (k, u) => {
      const S = k.S()
      const R = k.R()
      return [
        u > 1.2 &&
          u < 8.6 &&
          Math.abs(S.head) < 100 * DEG && { at: at(S.head / DEG, 15), text: 'What you can see', ring: 0, dir: [0, 0] },
        R && S.visible(R.passer) && u > 3 && { at: R.passer, text: 'The passer, behind you', ring: 1.2, dir: [-60, -80] },
      ]
    },
    extra: 'controls',
  },
  memory: {
    rounds: [{ ...CALM, mates: [mate(-45, 12), mate(0, 15), mate(45, 12, { vx: -0.4, vy: -2.6, runFrom: 2.4, runFor: 2.6 })] }],
    input: (k, u) =>
      k.look(
        sweep(
          [
            [0, 0],
            [2.6, 0],
            [3.0, -125],
            [4.9, -125],
            [5.3, 0],
            [6.6, 0],
            [7.0, 125],
            [10, 125],
          ],
          u,
        ),
      ),
    notes: (k, u) => {
      const m = k.R()?.mates[2]
      if (!m) return []
      return [
        u > 3.1 && u < 4.9 && m.seen && { at: m.seen, text: 'Memory: where you last saw them', ring: 1.1, dir: [-150, 70] },
        u > 3.6 && u < 4.9 && { at: m, text: 'Where they are now', ring: 1.0, dashed: true, dir: [80, -60] },
        u > 5.3 && u < 6.6 && { at: m, text: 'They moved', ring: 1.2, dir: [90, -40] },
        u > 7.2 && { at: k.R().mates[0].seen, text: 'Memories fade in 3.5 seconds', ring: 1.1, dir: [-40, -90] },
      ]
    },
  },
  ball: {
    rounds: [
      { ...CALM, passer: { x: 3, y: 13 }, passAt: 1.5 },
      { ...CALM, passer: { x: -4, y: 10 }, passAt: 0.6, open: 0, mates: [mate(-40, 13), mate(10, 14), mate(52, 11)] },
    ],
    input: (k) => {
      const R = k.R()
      if (!R) return k.look(0)
      if (k.S().stats.rounds === 1) {
        if (R.phase === 'build') return k.look(R.t < 1.85 ? 0 : 0)
        if (R.phase === 'incoming') return R.t - R.passAt < 0.45 ? k.look(0) : k.aim(R.ball)
        if (R.phase === 'onball') {
          k.aim(R.mates[1])
          if (R.t > R.receivedAt + 0.45) k.press(R.mates[1], 'p1')
        }
        return
      }
      k.look(0)
    },
    notes: (k) => {
      const R = k.R()
      const S = k.S()
      if (!R) return []
      const first = S.stats.rounds === 1
      return [
        first &&
          R.phase === 'incoming' &&
          !S.visible(R.ball) && {
            at: at(angleOf(R.ball), 3.4),
            text: 'The call: the ball is coming from here',
            ring: 0,
            dir: [-40, 110],
          },
        first && R.phase === 'incoming' && S.visible(R.ball) && { at: R.ball, text: 'Watch it in', ring: 0.9, dir: [80, 70] },
        first && R.phase === 'onball' && { at: { x: 0, y: 0 }, text: 'Clean first touch', ring: 1.3, dir: [90, 90] },
        !first && R.phase === 'incoming' && { at: { x: 0, y: 0 }, text: 'Not looking at the ball…', ring: 1.3, dir: [90, 90] },
        !first &&
          R.phase === 'onball' && {
            at: { x: 0, y: 0 },
            text: 'Heavy touch: you lose a moment',
            ring: 1.3,
            color: DANGER,
            dir: [90, 90],
          },
      ]
    },
  },
  pass: {
    rounds: [
      { passer: { x: -2, y: 11 }, passAt: 1.6, mates: LAYOUT, open: 2, pressers: [] },
      { passer: { x: 4, y: 11 }, passAt: 1.0, mates: [mate(-40, 13), mate(10, 14), mate(55, 11)], open: 0, pressers: [] },
    ],
    input: (k) =>
      k.S().stats.rounds === 1 ? player(k, { target: 2, scan: 35 }) : player(k, { target: 0, key: '1', delay: 0.25 }),
    notes: (k) => {
      const R = k.R()
      const S = k.S()
      if (!R) return []
      const first = S.stats.rounds === 1
      return [
        first && R.phase === 'build' && R.t > 0.3 && { lane: R.mates[2], text: 'The open lane' },
        first && R.phase === 'build' && R.t > 0.3 && { at: R.opps[0], text: 'Covered', ring: 1, color: BONE, dir: [-110, -30] },
        first && R.phase === 'build' && R.t > 0.3 && { at: R.opps[1], text: 'Covered', ring: 1, color: BONE, dir: [-20, -80] },
        S.slow > 0 && { at: { x: 0, y: 0 }, text: 'Time slows as the ball arrives', ring: 1.3, dir: [100, 90] },
      ]
    },
    extra: 'controls',
  },
  lane: {
    rounds: [
      { passer: { x: 2, y: 10 }, passAt: 1.4, mates: LAYOUT, open: 0, pressers: [] },
      { passer: { x: -3, y: 10 }, passAt: 0.9, mates: LAYOUT, open: 0, pressers: [] },
    ],
    input: (k) => (k.S().stats.rounds === 1 ? player(k, { target: 1 }) : player(k, { target: 0, scan: 40 })),
    notes: (k) => {
      const R = k.R()
      const S = k.S()
      if (!R) return []
      const first = S.stats.rounds === 1
      const block = R.opps.find((o) => o.lane === 1)
      return [
        first &&
          R.phase !== 'build' &&
          R.phase !== 'over' &&
          block && { at: block, text: 'This lane is covered', ring: 1.1, color: BONE, dir: [110, -40] },
        !first && R.phase !== 'over' && { lane: R.mates[0], text: 'The lane nobody is in' },
      ]
    },
  },
  press: {
    rounds: [PRESSED, PRESSED, CALM],
    input: (k) => {
      const R = k.R()
      if (!R || k.S().stats.rounds > 2) return k.look(0)
      if (R.phase === 'build') return k.look(Math.sin(R.t * 2) * 25)
      if (R.phase === 'incoming') return k.aim(R.ball)
      if (R.phase === 'onball') {
        k.look(0)
        if (R.t > R.receivedAt + 0.95) k.press(R.mates[1], 'late')
      }
    },
    notes: (k) => {
      const R = k.R()
      if (!R || k.S().stats.rounds > 2) return []
      const P = R.pressers[0]
      return [
        R.t > 1.75 &&
          R.phase !== 'over' &&
          !k.S().visible(P) && {
            at: P,
            text: 'The presser: you can’t see them',
            ring: 1.1,
            dashed: true,
            color: DANGER,
            dir: [-40, -100],
          },
      ]
    },
  },
  check: {
    rounds: [PRESSED, PRESSED, CALM],
    input: (k) => (k.S().stats.rounds > 2 ? k.look(0) : player(k, { target: 1, checks: [[0.9, 1.45, -135]] })),
    notes: (k) => {
      const R = k.R()
      const S = k.S()
      if (!R || S.stats.rounds > 2) return []
      const P = R.pressers[0]
      return [
        R.phase === 'build' &&
          R.t > 0.95 &&
          R.t < 1.6 && { at: { x: 0, y: 0 }, text: 'Shoulder check', ring: 1.3, dir: [110, 80] },
        R.phase !== 'over' &&
          P.seenBeforeBall && { at: S.visible(P) ? P : P.seen, text: 'Spotted', ring: 1.1, color: DANGER, dir: [-30, -100] },
        S.slow > 0 && { at: { x: 0, y: 0 }, text: 'Time slows: you saw it coming', ring: 1.3, dir: [100, 90] },
      ]
    },
  },
  stale: {
    rounds: [
      {
        passer: { x: -3, y: 11 },
        passAt: 2.2,
        mates: [mate(-45, 12, { vx: -2.8, vy: -1.2, runFrom: 1.4, runFor: 2.2 }), mate(5, 15), mate(50, 12)],
        open: 0,
        pressers: [],
      },
      CALM,
    ],
    input: (k) => {
      const R = k.R()
      if (!R || k.S().stats.rounds > 1) return k.look(0)
      if (R.phase === 'build') return R.t < 1.2 ? k.look(Math.sin(R.t * 3) * 30) : k.aim(R.passer)
      if (R.phase === 'incoming') return k.aim(R.ball)
      if (R.phase === 'onball') {
        k.aim(R.ball)
        const m = R.mates[0]
        if (m.seen && R.t > R.readyAt + 0.3) k.press(m.seen, 'blind')
      }
    },
    notes: (k) => {
      const R = k.R()
      const S = k.S()
      if (!R || S.stats.rounds > 1) return []
      const m = R.mates[0]
      return [
        R.t > 1.6 &&
          R.phase !== 'over' &&
          !S.visible(m) &&
          m.seen && { at: m.seen, text: 'An old memory', ring: 1.1, dir: [-20, -100] },
        R.t > 2.0 &&
          R.phase !== 'over' &&
          !S.visible(m) && { at: m, text: 'Where they ran to', ring: 1.0, dashed: true, dir: [-60, 90] },
      ]
    },
  },
  first: {
    rounds: [
      {
        passer: { x: 3, y: 12 },
        passAt: 1.4,
        mates: [mate(-48, 12), mate(2, 15), mate(46, 12)],
        open: 2,
        pressers: [presser(-140, 10, 1.6, 5.2)],
      },
      {
        passer: { x: -3, y: 12 },
        passAt: 1.2,
        mates: [mate(-46, 12), mate(-4, 15), mate(48, 12)],
        open: 0,
        pressers: [presser(140, 10, 1.4, 5.2)],
      },
      CALM,
    ],
    input: (k) => {
      const n = k.S().stats.rounds
      if (n === 1) return player(k, { target: 2, checks: [[0.6, 1.1, -135]], lookUp: [7.6, 4.7], firstTime: true })
      if (n === 2) return player(k, { target: 0, checks: [[0.4, 0.9, 135]], lookUp: [7.6, 4.7], firstTime: true })
      k.look(0)
    },
    notes: (k) => {
      const R = k.R()
      if (!R || k.S().stats.rounds > 2) return []
      return [
        R.queued && R.phase === 'incoming' && { at: R.queued, text: 'Lined up: your first-time pass', ring: 0, dir: [-60, -90] },
      ]
    },
  },
  levels: { auto: true, level: 1, seed: 21, extra: 'levels' },
  switch: {
    level: 2,
    rounds: [
      {
        passer: { x: -2, y: 11 },
        passAt: 1.4,
        mates: LAYOUT,
        open: 2,
        switchFrom: 0,
        switchAt: 1.8,
        pressers: [presser(140, 10.5, 1.5, 5.4)],
      },
      CALM,
    ],
    input: (k) => {
      const R = k.R()
      if (!R || k.S().stats.rounds > 1) return k.look(0)
      if (R.phase === 'incoming' && Math.hypot(R.ball.x, R.ball.y) < 3.1) return k.look(0, 12)
      player(k, { target: 0, checks: [[0.9, 1.35, 135]], delay: 0.3 })
      if (R.phase === 'build' && R.t < 0.9) k.look(30)
    },
    notes: (k) => {
      const R = k.R()
      if (!R || k.S().stats.rounds > 1) return []
      const mover = R.opps.find((o) => o.lane === 2 && R.t >= 1.8)
      return [
        R.phase === 'build' && R.t > 0.2 && R.t < 0.9 && { lane: R.mates[2], text: 'Open when you looked' },
        R.t > 1.8 &&
          R.phase === 'incoming' &&
          mover && { at: mover, text: 'The cover switches', ring: 1.0, dashed: true, color: BONE, dir: [90, 60] },
        R.phase === 'onball' && { lane: R.mates[0], text: 'Now this one is open' },
      ]
    },
  },
  two: {
    level: 4,
    rounds: [
      TWO,
      { ...TWO, passer: { x: -2, y: 12 }, open: 2, pressers: [presser(140, 9.5, 1.9, 6.4), presser(-140, 11, 2.1, 6.0)] },
      CALM,
    ],
    input: (k) =>
      k.S().stats.rounds > 2
        ? k.look(0)
        : player(k, {
            target: k.S().stats.rounds === 1 ? 1 : 2,
            checks: [
              [0.6, 1.05, -135],
              [1.1, 1.6, 135],
            ],
          }),
    notes: (k) => {
      const R = k.R()
      const S = k.S()
      if (!R || S.stats.rounds > 2 || R.phase === 'over') return []
      return R.pressers.map(
        (P, i) =>
          P.seenBeforeBall && {
            at: S.visible(P) ? P : P.seen,
            text: `Presser ${i + 1}`,
            ring: 1.1,
            color: DANGER,
            dir: [i ? 40 : -40, -100],
          },
      )
    },
  },
  score: { auto: true, mode: 'match', level: 3, seed: 31, extra: 'scoring', hud: true },
  results: { auto: true, level: 2, seed: 41, extra: null, card: true },
  practice: { auto: true, lazy: true, level: 2, seed: 51, hints: true, hud: true, extra: 'keys' },
  end: { auto: true, level: 5, seed: 63, extra: 'end', dim: true },
}

// The words in the panel for each chapter.
const COPY = {
  intro:
    'The one-minute scanning game from Vision Football Academy, Surat: every rule, every control and all five levels, played out on the pitch.',
  you: 'You are the pivot in the centre circle, seen from above. Up the screen is forward, towards the goal. Your teammates are ahead of you, numbered; the ball will come to you from behind.',
  look: 'You only see what you look at: everything outside your cone of vision is dark. Turn your head with the mouse, by dragging a finger, or by holding the arrow keys.',
  memory:
    'Look away and people stay where you last saw them, as see-through memories. A memory fades after 3.5 seconds, and it goes out of date: players keep moving.',
  ball: 'A teammate plays the ball in from behind, and a flashing arc shows which side it is coming from. Turn and watch it in. If you have not looked at it just before it arrives, your first touch is heavy and you lose a moment.',
  pass: 'When the ball arrives, pass to the open teammate: click them, or tap them on a phone. On a keyboard, press their number, or Space for the one you are facing. A teammate you can see gets the ball played into their run.',
  lane: 'A defender shadows every lane but one. Pass into a covered lane and it is intercepted. Look along the line of the pass, not just at the player, and find the lane nobody is in.',
  press:
    'Once the ball is played, a presser comes at you from your blind side. You cannot see them unless you look. If they reach you while you have the ball, you are tackled.',
  check:
    'Check your shoulder before the ball arrives. Spot every presser in time and the moment slows down as the ball reaches you, so you can pick your pass. Miss one and there is no slow motion.',
  stale:
    'You can pass to a memory without looking. But a runner you saw two seconds ago is somewhere else now, and the ball goes to empty grass. Look again before you pass.',
  first: `Think one pass ahead. Choose your pass while the ball is still on its way, and a dashed ring lines it up. Watch the ball in and you play it first time: no waiting, and ${FIRST_TIME_BONUS} extra points.`,
  levels:
    'In a match, every three completed passes take you up a level. The levels are named after the academy’s own pathway, and each one adds something new.',
  switch:
    'From level 2, a defender can switch lanes after the ball is played. The pass that was on when you looked may be shut by the time the ball arrives: look again before you play it.',
  two: 'From level 4, a second presser comes from your other side, so one look over one shoulder is not enough. Level 3 adds a fourth runner and players drifting through midfield; level 5 brings quicker pressers and shorter memories.',
  score:
    'Every completed pass scores, and a streak multiplies it. An interception, a tackle or a pass to an old memory ends the streak.',
  results:
    'When the whistle goes: your score and rating, and how you played. The vision map shows where you looked, and the coach’s note says what to work on next.',
  practice:
    'Practice holds one level with no clock, and adds coaching tips as you play. Pick any level, and press End practice when you are done.',
  end: 'One minute. Five levels. How far ahead can you see?',
}

// ---------- Running the game ----------

const game = document.createElement('canvas')
game.width = GW
game.height = H
let sounds = [] // [time, name] of every sound the game makes, for the soundtrack
let recording = false
let simT = 0
let cur = null

function enter(chapter) {
  cur?.g.destroy()
  const sc = SCENES[chapter.id]
  // The game draws once per video frame (in compose), not on each of its steps.
  const g = createVisionTest(game, {
    manual: true,
    render: false,
    sound: {
      play: (name) => recording && (name !== 'whistle' || sc.whistle) && sounds.push([simT, name]),
      unlock() {},
      setMuted() {},
      close() {},
    },
  })
  g.start({ mode: sc.mode || 'practice', level: sc.level || 1, seed: sc.seed || 7, hints: !!sc.hints })
  for (const spec of sc.rounds || []) g.stage(spec)
  const k = {
    g,
    u: 0,
    cursor: null,
    ripple: null,
    keycap: null,
    fired: new Set(),
    S: () => g.peek(),
    R: () => g.peek()?.round,
    aim(w) {
      if (!w) return
      k.cursor = { x: w.x, y: w.y }
      g.aim(w)
    },
    look(deg, r = 9) {
      k.aim(at(deg, r))
    },
    pressAny(w) {
      g.press(w)
      k.ripple = { x: w.x, y: w.y, u: k.u }
    },
    // A press that happens once per round, however many steps ask for it.
    press(w, tag) {
      const once = `${tag}:${g.peek().stats.rounds}`
      if (!w || k.fired.has(once)) return
      k.fired.add(once)
      k.pressAny(w)
    },
    key(label, w, tag) {
      const once = `${tag}:${g.peek().stats.rounds}`
      if (!w || k.fired.has(once)) return
      k.fired.add(once)
      g.press(w)
      k.keycap = { label, u: k.u }
    },
  }
  cur = { chapter, sc, g, k }
}

function chapterAt(t) {
  let c = CHAPTERS[0]
  for (const ch of CHAPTERS) if (t >= ch.at - 1e-9) c = ch
  return c
}

/** Runs the game forward to video time t (from the start of t's chapter, if it has to). */
function simulate(t) {
  const target = chapterAt(t)
  if (!cur || cur.chapter !== target || simT > t + 1e-9) {
    enter(target)
    simT = target.at
  }
  while (simT + STEP <= t + 1e-9) {
    const ch = chapterAt(simT + 1e-9)
    if (ch !== cur.chapter) {
      enter(ch)
      simT = ch.at
    }
    const { sc, k, g } = cur
    k.u = simT - cur.chapter.at
    if (sc.auto) bot(k, { lazy: sc.lazy })
    else sc.input(k, k.u)
    g.tick(STEP)
    simT += STEP
  }
  cur.k.u = t - cur.chapter.at
}

// An example match for the results chapter: played by the bot at setup, so the numbers are real.
function exampleResult() {
  const c = document.createElement('canvas')
  c.width = 560
  c.height = 520
  let result = null
  const g = createVisionTest(c, {
    manual: true,
    render: false,
    graphics: false,
    sound: { play() {}, unlock() {}, setMuted() {}, close() {} },
    onEnd: (r) => (result = r),
  })
  g.start({ mode: 'match', seed: 99 })
  const k = {
    u: 0,
    S: () => g.peek(),
    R: () => g.peek()?.round,
    aim: (w) => w && g.aim(w),
    look: (d, r = 9) => g.aim(at(d, r)),
    pressAny: (w) => g.press(w),
  }
  for (let i = 0; i < 60 * 80 && !result; i++) {
    bot(k)
    g.tick(STEP)
  }
  g.destroy()
  return result
}
let EXAMPLE = null

// ---------- Drawing ----------

function text(
  ctx,
  str,
  x,
  y,
  size,
  { weight = 800, stretch = 'normal', color = BONE, align = 'left', spacing = 0, alpha = 1, upper = false } = {},
) {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.font = `${weight} ${Math.round(size)}px Archivo`
  ctx.fontStretch = stretch
  ctx.letterSpacing = `${size * spacing}px`
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  ctx.fillText(upper ? str.toUpperCase() : str, x, y)
  ctx.restore()
}
function lines(ctx, str, width, size, weight = 500, stretch = 'normal') {
  ctx.save()
  ctx.font = `${weight} ${size}px Archivo`
  ctx.fontStretch = stretch
  const out = []
  let line = ''
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) {
      out.push(line)
      line = word
    } else line = next
  }
  if (line) out.push(line)
  ctx.restore()
  return out
}
function pill(ctx, x, y, w, h, fill, stroke) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

/** A label over the pitch: a ring round what it names, a leader line and a dark tag. */
function note(ctx, n, alpha) {
  const g = cur.g
  ctx.save()
  ctx.globalAlpha = alpha
  const color = n.color || VOLT
  if (n.lane) {
    const a = g.toScreen(0, 0)
    const b = g.toScreen(n.lane.x, n.lane.y)
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.setLineDash([16, 12])
    ctx.lineDashOffset = -cur.k.u * 40
    ctx.beginPath()
    ctx.moveTo(a.x + (b.x - a.x) * 0.08, a.y + (b.y - a.y) * 0.08)
    ctx.lineTo(a.x + (b.x - a.x) * 0.92, a.y + (b.y - a.y) * 0.92)
    ctx.stroke()
    ctx.setLineDash([])
    tag(ctx, n.text, (a.x + b.x) / 2 + 24, (a.y + b.y) / 2, color)
    ctx.restore()
    return
  }
  const p = g.toScreen(n.at.x, n.at.y)
  const ring = n.ring ?? 1.1
  const [dx, dy] = n.dir || [80, -80]
  const len = Math.hypot(dx, dy)
  // The ring lies on the pitch, so it is drawn in perspective; the leader leaves it facing its tag.
  const edge = groundRing(ctx, g, n.at, ring)
  if (ring > 0) {
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    if (n.dashed) ctx.setLineDash([10, 8])
    ctx.stroke()
    ctx.setLineDash([])
  }
  if (len > 0 && ring > 0) {
    const from = edge.reduce((a, b) => ((b.x - p.x) * dx + (b.y - p.y) * dy > (a.x - p.x) * dx + (a.y - p.y) * dy ? b : a))
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(p.x + dx, p.y + dy)
    ctx.stroke()
  }
  tag(ctx, n.text, p.x + dx, p.y + dy, color, len === 0 ? 'center' : dx < 0 ? 'right' : 'left')
  ctx.restore()
}
/** Starts a path round a circle of radius r metres on the pitch, and returns its points on screen. */
function groundRing(ctx, g, at, r) {
  const pts = []
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    pts.push(g.toScreen(at.x + Math.sin(a) * r, at.y - Math.cos(a) * r))
  }
  ctx.beginPath()
  pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
  ctx.closePath()
  return pts
}
function tag(ctx, str, x, y, color, align = 'left') {
  ctx.save()
  ctx.font = '800 26px Archivo'
  ctx.fontStretch = 'expanded'
  ctx.letterSpacing = '1.5px'
  const label = str.toUpperCase()
  const w = ctx.measureText(label).width + 32
  let left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
  left = Math.max(14, Math.min(GW - w - 14, left))
  y = Math.max(40, Math.min(H - 40, y))
  ctx.fillStyle = 'rgba(6,6,7,0.88)'
  ctx.beginPath()
  ctx.roundRect(left, y - 24, w, 48, 10)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(label, left + 16, y + 1)
  ctx.restore()
}

function cursorIcon(ctx, k) {
  if (!k.cursor) return
  const p = cur.g.toScreen(k.cursor.x, k.cursor.y)
  if (k.ripple) {
    const e = (k.u - k.ripple.u) / 0.5
    if (e >= 0 && e < 1) {
      const q = cur.g.toScreen(k.ripple.x, k.ripple.y)
      ctx.save()
      ctx.globalAlpha = 1 - e
      ctx.strokeStyle = VOLT
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(q.x, q.y, 14 + e * 50, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }
  // An arrow pointer, drawn where the player is aiming.
  ctx.save()
  ctx.translate(Math.max(10, Math.min(GW - 30, p.x)), Math.max(10, Math.min(H - 40, p.y)))
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 34)
  ctx.lineTo(9, 26)
  ctx.lineTo(15, 40)
  ctx.lineTo(21, 37)
  ctx.lineTo(15, 24)
  ctx.lineTo(26, 24)
  ctx.closePath()
  ctx.fillStyle = BONE
  ctx.strokeStyle = '#0a0a0b'
  ctx.lineWidth = 3
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function keycap(ctx, k) {
  if (!k.keycap) return
  const e = k.u - k.keycap.u
  if (e < 0 || e > 1.4) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, (1.4 - e) / 0.3)
  const x = GW / 2 - 150
  const y = H - 190
  ctx.fillStyle = 'rgba(6,6,7,0.88)'
  ctx.beginPath()
  ctx.roundRect(x, y, 300, 96, 16)
  ctx.fill()
  const down = e < 0.18 ? 4 : 0
  ctx.fillStyle = '#1d1f1d'
  ctx.strokeStyle = VOLT
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(x + 20, y + 16 + down, 64, 64, 10)
  ctx.fill()
  ctx.stroke()
  text(ctx, k.keycap.label, x + 52, y + 61 + down, 34, { weight: 900, align: 'center', color: VOLT })
  text(ctx, 'Pass to', x + 104, y + 44, 22, { weight: 600, color: SMOKE })
  text(ctx, `teammate ${k.keycap.label}`, x + 104, y + 74, 26, { weight: 800 })
  ctx.restore()
}

function miniHud(ctx) {
  const S = cur.g.peek()
  if (!S) return
  ctx.save()
  const grad = ctx.createLinearGradient(0, 0, 0, 130)
  grad.addColorStop(0, 'rgba(6,6,7,0.85)')
  grad.addColorStop(1, 'rgba(6,6,7,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, GW, 130)
  const L = LEVELS[S.level - 1]
  if (S.mode === 'practice') {
    text(ctx, 'Practice', 40, 66, 40, { weight: 900, stretch: 'expanded' })
    text(ctx, `Level ${S.level} · ${L.name}`, 290, 62, 24, { weight: 600, color: SMOKE })
    pill(ctx, GW - 260, 30, 220, 52, 'rgba(6,6,7,0.6)', 'rgba(242,242,238,0.3)')
    text(ctx, 'End practice', GW - 150, 64, 22, { weight: 700, align: 'center' })
  } else {
    text(ctx, `${S.score}`, 40, 66, 40, { weight: 900 })
    text(ctx, 'pts', 48 + String(S.score).length * 25, 64, 22, { weight: 600, color: SMOKE })
    text(ctx, `×${(1 + 0.1 * Math.min(S.streak, 10)).toFixed(1)}`, 250, 64, 30, { weight: 800, color: VOLT })
    text(ctx, `Level ${S.level} · ${L.name}`, 360, 62, 24, { weight: 600, color: SMOKE })
  }
  ctx.restore()
}

function resultCard(ctx, r, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(6,6,7,0.9)'
  ctx.fillRect(0, 0, GW, H)
  const x = 90
  const w = GW - 180
  text(ctx, 'Your Vision score', GW / 2, 150, 22, { weight: 700, color: VOLT, align: 'center', spacing: 0.24, upper: true })
  text(ctx, String(r.score), GW / 2, 280, 130, { weight: 900, stretch: 'expanded', align: 'center' })
  text(ctx, `${tierFor(r.score).toUpperCase()}  ·  reached level ${r.level}, ${r.levelName}`, GW / 2, 335, 26, {
    weight: 800,
    color: VOLT,
    align: 'center',
  })
  const stats = [
    ['Passes completed', `${r.completed} of ${r.rounds}`],
    ['First-time passes', `${r.firstTime}`],
    ['Checks before each ball', r.checksBeforeBall.toFixed(1)],
    ['Press spotted early', `${Math.round(r.pressSpotted * 100)}%`],
    ['Average decision', `${r.decisionSeconds.toFixed(2)} s`],
    ['Intercepted', `${r.intercepted}`],
    ['Tackled', `${r.tackled}`],
    ['Passed to an old memory', `${r.misplaced}`],
  ]
  const cw = (w - 3 * 16) / 4
  stats.forEach(([label, value], i) => {
    const cx = x + (i % 4) * (cw + 16)
    const cy = 380 + Math.floor(i / 4) * 150
    ctx.strokeStyle = 'rgba(242,242,238,0.16)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx, cy, cw, 132, 12)
    ctx.stroke()
    lines(ctx, label, cw - 30, 20, 500).forEach((l, j) =>
      text(ctx, l, cx + cw / 2, cy + 38 + j * 24, 20, { weight: 500, color: SMOKE, align: 'center' }),
    )
    text(ctx, value, cx + cw / 2, cy + 112, 38, { weight: 900, align: 'center' })
  })
  // The vision map.
  const mx = x + 120
  const my = 840
  const top = Math.max(...r.lookMap, 0.0001)
  r.lookMap.forEach((v, i) => {
    const a0 = (-180 + i * 30 - 90) * DEG
    ctx.beginPath()
    ctx.moveTo(mx, my)
    ctx.arc(mx, my, 105, a0, a0 + 30 * DEG)
    ctx.closePath()
    ctx.fillStyle = VOLT
    ctx.globalAlpha = alpha * (0.08 + 0.92 * (v / top))
    ctx.fill()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = '#0b0d0c'
    ctx.lineWidth = 2
    ctx.stroke()
  })
  ctx.beginPath()
  ctx.arc(mx, my, 10, 0, Math.PI * 2)
  ctx.fillStyle = BONE
  ctx.fill()
  text(ctx, 'AHEAD', mx, my - 118, 16, { weight: 700, color: SMOKE, align: 'center', spacing: 0.15 })
  text(ctx, 'BEHIND', mx, my + 134, 16, { weight: 700, color: SMOKE, align: 'center', spacing: 0.15 })
  text(ctx, "Coach's note", x + 290, 790, 20, { weight: 700, color: VOLT, spacing: 0.2, upper: true })
  lines(ctx, tipFor(r), w - 300, 30, 600).forEach((l, j) => text(ctx, l, x + 290, 836 + j * 42, 30, { weight: 600 }))
  ctx.restore()
}

/** The explanation on the right: chapter, title, words, and a picture of the controls or rules. */
function panel(ctx, chapter, u) {
  const i = CHAPTERS.indexOf(chapter)
  const sc = SCENES[chapter.id]
  ctx.fillStyle = '#060607'
  ctx.fillRect(GW, 0, W - GW, H)
  ctx.fillStyle = 'rgba(242,242,238,0.12)'
  ctx.fillRect(GW, 0, 2, H)
  const k = clamp01(u / 0.45)
  const slide = (1 - smooth(k)) * 24
  ctx.save()
  ctx.globalAlpha = smooth(k)
  ctx.translate(0, slide)
  text(ctx, 'How to play', PX, 110, 22, { weight: 700, color: VOLT, spacing: 0.26, upper: true })
  text(ctx, `${String(i + 1).padStart(2, '0')} / ${CHAPTERS.length}`, PX + PW, 110, 22, {
    weight: 700,
    color: ASH,
    align: 'right',
    spacing: 0.1,
  })
  const big = chapter.id === 'intro' || chapter.id === 'end'
  const title = chapter.id === 'end' ? 'Play it' : chapter.title
  const tSize = big ? 92 : 58
  const tLines = lines(ctx, title.toUpperCase(), PW, tSize, 900, 'expanded')
  tLines.forEach((l, j) => text(ctx, l, PX, 210 + j * tSize * 1.02, tSize, { weight: 900, stretch: 'expanded' }))
  let y = 210 + tLines.length * tSize * 1.02 + 30
  const body = lines(ctx, COPY[chapter.id], PW, 31, 500)
  body.forEach((l, j) => text(ctx, l, PX, y + j * 46, 31, { weight: 500, color: SMOKE }))
  y += body.length * 46 + 40
  extra(ctx, sc.extra, y)
  ctx.restore()
  // Where you are in the tutorial.
  const segW = (PW - (CHAPTERS.length - 1) * 6) / CHAPTERS.length
  CHAPTERS.forEach((c, j) => {
    ctx.fillStyle = j < i ? 'rgba(215,255,58,0.55)' : j === i ? VOLT : 'rgba(242,242,238,0.16)'
    ctx.fillRect(PX + j * (segW + 6), H - 110, j === i ? segW * clamp01(u / c.seconds) || 1 : segW, 6)
    if (j === i) {
      ctx.fillStyle = 'rgba(242,242,238,0.16)'
      ctx.fillRect(PX + j * (segW + 6) + segW * clamp01(u / c.seconds), H - 110, segW * (1 - clamp01(u / c.seconds)), 6)
    }
  })
  text(ctx, 'The Vision Test · Vision Football Academy, Surat', PX, H - 62, 20, { weight: 600, color: ASH })
}

function extra(ctx, kind, y) {
  if (kind === 'legend') {
    const items = [
      ['mate', 'Teammate'],
      ['opp', 'Opponent'],
      ['press', 'Presser'],
      ['ghost', 'Memory'],
    ]
    items.forEach(([key, label], j) => {
      const cx = PX + 22 + (j % 2) * 300
      const cy = y + 20 + Math.floor(j / 2) * 64
      // The players' kits, as on the page's key.
      ctx.save()
      ctx.translate(cx - 19, cy - 19)
      ctx.scale(38 / 24, 38 / 24)
      if (key === 'ghost') {
        ctx.fillStyle = 'rgba(215,255,58,0.16)'
        ctx.fill(SHIRT)
        ctx.strokeStyle = VOLT
        ctx.lineWidth = 1.4
        ctx.setLineDash([2.2, 1.8])
        ctx.stroke(SHIRT)
      } else {
        ctx.fillStyle = key === 'mate' ? VOLT : key === 'press' ? DANGER : BONE
        ctx.fill(SHIRT)
      }
      ctx.restore()
      text(ctx, label, cx + 34, cy + 10, 28, { weight: 700 })
    })
  }
  if (kind === 'controls' || kind === 'keys') {
    const rows =
      kind === 'keys'
        ? [
            ['← →', 'look left and right'],
            ['1 – 4', 'pass to that number'],
            ['Space', 'pass to the one you face'],
          ]
        : [
            ['Mouse', 'move to look, click to pass'],
            ['Phone', 'drag to look, tap to pass'],
            ['Keys', '← → look · 1–4 or Space pass'],
          ]
    rows.forEach(([key, what], j) => {
      const cy = y + j * 78
      ctx.save()
      ctx.font = '800 26px Archivo'
      const kw = Math.max(110, ctx.measureText(key).width + 40)
      ctx.restore()
      pill(ctx, PX, cy, kw, 56, 'rgba(215,255,58,0.1)', VOLT)
      text(ctx, key, PX + kw / 2, cy + 37, 26, { weight: 800, color: VOLT, align: 'center' })
      text(ctx, what, PX + kw + 24, cy + 37, 27, { weight: 600 })
    })
  }
  if (kind === 'levels') {
    LEVELS.forEach((L, j) => {
      const cy = y + j * 84
      ctx.beginPath()
      ctx.arc(PX + 24, cy + 22, 24, 0, Math.PI * 2)
      ctx.fillStyle = j === 0 ? VOLT : '#18181b'
      ctx.fill()
      text(ctx, String(L.n), PX + 24, cy + 32, 26, { weight: 900, align: 'center', color: j === 0 ? '#0a0a0b' : BONE })
      text(ctx, L.name, PX + 66, cy + 20, 28, { weight: 800 })
      text(ctx, L.adds, PX + 66, cy + 54, 23, { weight: 500, color: SMOKE })
    })
  }
  if (kind === 'scoring') {
    const rows = [
      ['Completed pass', '100'],
      ['Quick decision', 'up to +60'],
      ['Each check before the ball (up to 4)', '+15'],
      ['Every presser spotted', '+20'],
      ['First-time pass', `+${FIRST_TIME_BONUS}`],
      ['Each pass in a row', '×1.1, up to ×2.0'],
    ]
    rows.forEach(([what, pts], j) => {
      const cy = y + j * 60
      ctx.fillStyle = 'rgba(242,242,238,0.12)'
      ctx.fillRect(PX, cy + 44, PW, 2)
      text(ctx, what, PX, cy + 30, 27, { weight: 600 })
      text(ctx, pts, PX + PW, cy + 30, 27, { weight: 900, color: VOLT, align: 'right' })
    })
  }
  if (kind === 'end') {
    pill(ctx, PX, y, 400, 84, VOLT)
    text(ctx, 'Play now', PX + 200, y + 55, 34, { weight: 800, color: '#0a0a0b', align: 'center' })
    text(ctx, 'maansavaliya0108-cyber.github.io', PX, y + 150, 27, { weight: 600, color: SMOKE })
    text(ctx, '/vision-football-academy/play', PX, y + 188, 27, { weight: 600, color: SMOKE })
    text(ctx, 'Train it for real', PX, y + 270, 24, { weight: 700, color: VOLT, spacing: 0.2, upper: true })
    text(ctx, `${academy.address.venue}, Adajan · Mon–Fri · 6–9 PM`, PX, y + 312, 27, { weight: 600 })
  }
  if (kind === 'intro') {
    text(ctx, 'VISION', PX, y + 70, 64, { weight: 900, stretch: 'expanded', spacing: 0.06 })
    text(ctx, 'Football Academy · Adajan, Surat', PX, y + 112, 24, { weight: 700, color: SMOKE, spacing: 0.12, upper: true })
  }
}

function frameCanvas() {
  const c = document.getElementById('frame')
  if (c.width !== W) {
    c.width = W
    c.height = H
  }
  return c
}

async function compose(t) {
  simulate(t)
  cur.g.draw()
  const { chapter, sc, k } = cur
  const u = t - chapter.at
  const c = frameCanvas()
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(game, 0, 0)
  if (sc.dim || chapter.id === 'intro') {
    ctx.fillStyle = 'rgba(6,6,7,0.55)'
    ctx.fillRect(0, 0, GW, H)
  }
  if (sc.hud) miniHud(ctx)
  if (sc.card) resultCard(ctx, EXAMPLE, clamp01((u - 0.3) / 0.5))
  if (!sc.card) {
    const notes = (sc.notes?.(k, u) || []).filter((n) => n && (n.lane || n.at))
    for (const n of notes) note(ctx, n, 1)
    if (!sc.dim && chapter.id !== 'intro') cursorIcon(ctx, k)
    keycap(ctx, k)
  }
  // A quick dip between chapters.
  const dip = chapter.at > 0 ? 1 - clamp01(u / 0.3) : 1 - clamp01(u / 0.6)
  if (dip > 0) {
    ctx.fillStyle = `rgba(0,0,0,${dip})`
    ctx.fillRect(0, 0, GW, H)
  }
  panel(ctx, chapter, u)
  const out = clamp01((t - (DURATION - 0.6)) / 0.6)
  if (out > 0) {
    ctx.fillStyle = `rgba(0,0,0,${out})`
    ctx.fillRect(0, 0, W, H)
  }
  return c
}

// ---------- The soundtrack ----------

async function soundtrack() {
  const rate = 48000
  const ac = new OfflineAudioContext(2, Math.ceil(rate * DURATION), rate)
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 3
  comp.connect(ac.destination)
  const sfx = ac.createGain()
  sfx.gain.value = 1.4
  sfx.connect(comp)
  const music = ac.createGain()
  music.gain.value = 0.55
  music.connect(comp)
  // A soft bed under the explanations: a slow chord every bar, a gentle pulse.
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)
  const beat = 60 / 96
  const chords = [
    [50, 53, 57, 60],
    [46, 50, 53, 57],
    [41, 45, 48, 52],
    [48, 52, 55, 59],
  ]
  for (let bar = 0, t = 0; t < DURATION - 1; bar++, t += 4 * beat) {
    const ch = chords[bar % 4]
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.035, t + 0.6)
    g.gain.setValueAtTime(0.035, t + 4 * beat - 0.3)
    g.gain.linearRampToValueAtTime(0, t + 4 * beat + 0.1)
    lp.connect(g).connect(music)
    for (const n of ch) {
      for (const det of [-6, 6]) {
        const o = ac.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = midi(n)
        o.detune.value = det
        o.connect(lp)
        o.start(t)
        o.stop(t + 4 * beat + 0.2)
      }
    }
    for (let b = 0; b < 4; b++) {
      const tb = t + b * beat
      const o = ac.createOscillator()
      o.frequency.setValueAtTime(120, tb)
      o.frequency.exponentialRampToValueAtTime(45, tb + 0.12)
      const kg = ac.createGain()
      kg.gain.setValueAtTime(0.0001, tb)
      kg.gain.exponentialRampToValueAtTime(0.22, tb + 0.005)
      kg.gain.exponentialRampToValueAtTime(0.0001, tb + 0.3)
      o.connect(kg).connect(music)
      o.start(tb)
      o.stop(tb + 0.35)
    }
  }
  // A soft chime at each new chapter.
  for (const c of CHAPTERS.slice(1)) {
    for (const [f, d] of [
      [880, 0],
      [1320, 0.06],
    ]) {
      const o = ac.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      const g = ac.createGain()
      g.gain.setValueAtTime(0.0001, c.at + d)
      g.gain.exponentialRampToValueAtTime(0.06, c.at + d + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, c.at + d + 0.5)
      o.connect(g).connect(music)
      o.start(c.at + d)
      o.stop(c.at + d + 0.55)
    }
  }
  // The game's own sounds, where they happened.
  for (const [t, name] of sounds) if (t < DURATION - 0.2) soundInto(ac, sfx, name, t)
  const buffer = await ac.startRendering()
  let peak = 0
  for (let ch = 0; ch < 2; ch++) for (const v of buffer.getChannelData(ch)) peak = Math.max(peak, Math.abs(v))
  const k = peak > 0 ? 0.89 / peak : 1
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch)
    for (let i = 0; i < d.length; i++) d[i] *= k
  }
  return buffer
}

// ---------- Rendering ----------

function setup() {
  EXAMPLE ??= exampleResult()
}

window.renderStill = async (t) => {
  setup()
  recording = false
  cur = null
  return (await compose(t)).toDataURL('image/jpeg', 0.9)
}

window.renderTutorial = async (bitrate = 3.5e6) => {
  setup()
  sounds = []
  recording = true
  cur = null
  simT = 0
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 },
    fastStart: 'in-memory',
  })
  const failures = []
  const video = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => failures.push(e.message),
  })
  video.configure({ codec: 'avc1.640028', width: W, height: H, bitrate, framerate: FPS, avc: { format: 'avc' } })
  const total = Math.round(DURATION * FPS)
  const status = document.getElementById('status')
  for (let i = 0; i < total; i++) {
    const c = await compose(i / FPS)
    const vf = new VideoFrame(c, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) })
    video.encode(vf, { keyFrame: i % (FPS * 2) === 0 })
    vf.close()
    while (video.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2))
    if (i % 30 === 0) status.textContent = `frame ${i} of ${total}`
  }
  await video.flush()
  recording = false
  const buffer = await soundtrack()
  const audio = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => failures.push(e.message),
  })
  audio.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 })
  const block = 4800
  for (let off = 0; off < buffer.length; off += block) {
    const n = Math.min(block, buffer.length - off)
    const data = new Float32Array(n * 2)
    data.set(buffer.getChannelData(0).subarray(off, off + n), 0)
    data.set(buffer.getChannelData(1).subarray(off, off + n), n)
    const ad = new AudioData({
      format: 'f32-planar',
      sampleRate: 48000,
      numberOfFrames: n,
      numberOfChannels: 2,
      timestamp: Math.round((off * 1e6) / 48000),
      data,
    })
    audio.encode(ad)
    ad.close()
  }
  await audio.flush()
  muxer.finalize()
  if (failures.length) throw new Error(failures.join('; '))
  const bytes = new Uint8Array(muxer.target.buffer)
  const piece = 512 * 1024
  for (let off = 0; off < bytes.length; off += piece) {
    let bin = ''
    const part = bytes.subarray(off, off + piece)
    for (let j = 0; j < part.length; j += 0x8000) bin += String.fromCharCode.apply(null, part.subarray(j, j + 0x8000))
    await window.__save(btoa(bin), off + piece >= bytes.length)
  }
  status.textContent = `done, ${(bytes.length / 1e6).toFixed(1)} MB`
  return { bytes: bytes.length, sounds: sounds.length }
}

await loadGraphics()
await document.fonts.load('900 60px Archivo')
await document.fonts.load('800 26px Archivo')
await document.fonts.load('500 30px Archivo')
document.getElementById('status').textContent = 'Ready'
window.tutorialReady = true
