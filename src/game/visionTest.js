// The Vision Test: a scanning game built on the academy's own method ("see the pressure before the
// ball arrives", "think one pass ahead").
//
// You are the pivot in the centre circle, seen from above. You only see what you look at: everything
// outside your vision cone is dark. The ball is played to you from behind, and a presser closes in
// from your blind side, so you have to check your shoulders. What you look away from stays as a
// fading "memory ghost" where you last saw it, and memories go stale because players keep moving.
// Spot every presser before the ball arrives and time slows as it reaches you: pass to the open
// teammate before you are tackled. Choose the pass while the ball is still coming and, if you watched
// it in, you play it first time. A pass into a covered lane is intercepted; a pass to a stale memory
// goes to empty grass.
//
// Five levels, named after the academy's pathway, each add one thing: the cover switching, four
// runners and midfield traffic, a second presser, then quicker pressers and shorter memories.
// A match lasts a minute and climbs a level every three completed passes; practice holds one level
// with no clock and adds coaching hints.
//
// World units are metres. x runs right, y runs down the screen, so "forward" (towards goal) is -y.
// Angles are measured from forward, clockwise, so 0 = forward, +90° = right, ±180° = behind.
import { academy } from '../../shared/academy.js'

export const MATCH_SECONDS = 60
/** The five levels, named after the academy's pathway, and what each one adds. */
export const LEVELS = [
  'Three runners ahead and one presser behind.',
  'The cover can switch after the ball is played.',
  'Four runners, and traffic in midfield.',
  'A second presser, from your other side.',
  'Quicker pressers, and memories fade sooner.',
].map((adds, i) => ({ n: i + 1, name: academy.pathway[i].title, adds }))
export const FIRST_TIME_BONUS = 60

const DEG = Math.PI / 180
const PASS_SPEED = 20 // your pass
const HEAD_TURN = 10 // radians per second: fast, but not instant
const NEAR = 2.2 // you can sense anyone this close, wherever you look
const PASSES_PER_LEVEL = 3
// How much of the pitch is on screen: wide screens see 42 m across; phones held upright see 28 m.
const WIDE_VIEW = { left: -21, right: 21, top: -22, bottom: 15 }
const TALL_VIEW = { left: -14, right: 14, top: -21, bottom: 14 }

// What each level asks of you.
const rulesFor = (L) => ({
  runners: L >= 3 ? 4 : 3,
  switchChance: [0, 0, 0.35, 0.5, 0.6, 0.7][L],
  wanderers: Math.max(0, Math.min(2, L - 2)),
  pressers: L >= 4 ? 2 : 1,
  pressSpeed: Math.min(7.6, 5.2 + 0.45 * (L - 1) + (L >= 5 ? 0.4 : 0)),
  memory: L >= 5 ? 2.5 : 3.5, // seconds a memory ghost lasts
  ballSpeed: L >= 5 ? 12.5 : 11, // the pass in from behind
})

// Runners stay on the visible part of the pitch.
const clampX = (x) => Math.max(-19, Math.min(19, x))
const clampTallX = (x) => Math.max(-12.5, Math.min(12.5, x))
const clampY = (y) => Math.max(-20, Math.min(4, y))
const angleOf = (x, y) => Math.atan2(x, -y)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const smoothStep = (v) => v * v * (3 - 2 * v)
function toSegment(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k))
}
/** A repeatable random sequence (mulberry32), so a match can be replayed exactly from its seed. */
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COLORS = {
  turf: '#14211a',
  stripe: '#182820',
  line: 'rgba(242,242,238,0.9)',
  volt: '#d7ff3a',
  bone: '#f2f2ee',
  danger: '#ff6a5c',
}

/**
 * One of the game's synthesized sounds (no files), played into `dest` of audio context `a` at time
 * `t`. Shared by the live game and by the tutorial video, which renders the same sounds offline.
 */
export function soundInto(a, dest, name, t) {
  const tone = (freq, at, len, { type = 'sine', gain = 0.2, to } = {}) => {
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t + at)
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + at + len)
    g.gain.setValueAtTime(0.0001, t + at)
    g.gain.exponentialRampToValueAtTime(gain, t + at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + len)
    o.connect(g).connect(dest)
    o.start(t + at)
    o.stop(t + at + len + 0.02)
  }
  const thud = (gain = 0.4) => {
    tone(150, 0, 0.18, { gain, to: 50 })
    tone(900, 0, 0.03, { type: 'square', gain: gain * 0.15 })
  }
  if (name === 'whistle') {
    tone(2350, 0, 0.35, { type: 'square', gain: 0.05 })
    tone(2480, 0, 0.35, { type: 'square', gain: 0.04 })
  }
  if (name === 'pass') thud(0.45)
  if (name === 'receive') thud(0.25)
  if (name === 'good') {
    tone(660, 0, 0.18, { gain: 0.12 })
    tone(990, 0.09, 0.28, { gain: 0.12 })
  }
  if (name === 'first') {
    tone(660, 0, 0.14, { gain: 0.12 })
    tone(990, 0.07, 0.16, { gain: 0.12 })
    tone(1320, 0.14, 0.32, { gain: 0.1 })
  }
  if (name === 'level') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.3, { type: 'triangle', gain: 0.1 }))
  if (name === 'bad') tone(220, 0, 0.45, { type: 'sawtooth', gain: 0.07, to: 90 })
  if (name === 'tick') tone(1200, 0, 0.05, { type: 'square', gain: 0.04 })
}

// The 3D drawing (stage3d.js, with three.js) loads on its own, after the page: until it arrives, or
// where WebGL is missing, the game draws itself flat.
let Stage = null
let loading = null
/** Loads the 3D drawing. Games made after it resolves start in 3D; ones already running switch over. */
export function loadGraphics() {
  loading ??= import('./stage3d.js').then((m) => (Stage = m)).catch(() => null)
  return loading
}

/** The live game's sound: soundInto on the page's own audio context. */
function createSound() {
  let ac = null
  let muted = false
  const ctx = () => (ac ??= new (window.AudioContext || window.webkitAudioContext)())
  return {
    play(name) {
      if (muted) return
      try {
        const a = ctx()
        soundInto(a, a.destination, name, a.currentTime)
      } catch {
        // Audio is a bonus; the game works without it.
      }
    },
    unlock: () => ctx().resume?.(),
    setMuted: (m) => (muted = m),
    close: () => ac?.close(),
  }
}

/**
 * Starts the game on a canvas. Callbacks: onHud({ timeLeft, score, combo, level, mode }) a few times a
 * second, onEvent(text) for each outcome (for a live region), onEnd(results) when the match ends.
 * With manual: true there is no animation loop: the caller advances time with tick(seconds) and plays
 * with aim() and press(), which is how the tutorial video and the automated checks drive it.
 */
export function createVisionTest(
  canvas,
  { onHud, onEvent, onEnd, reducedMotion = false, manual = false, sound: customSound = null, render = true, graphics = true },
) {
  const ctx = canvas.getContext('2d')
  const fog = document.createElement('canvas')
  const fctx = fog.getContext('2d')
  const sound = customSound || createSound()
  let W = 0
  let H = 0
  let dpr = 1
  let scale = 1
  let ox = 0
  let oy = 0
  let tall = false
  let unit = 1 // pixels per metre where you stand, for sizing labels
  let gfx = null // the 3D stage, once loaded
  let vt = 0 // seconds of drawing time, for the light, the dust and effects
  let destroyed = false
  let slowFrames = 0 // for lowering the 3D quality when frames run slow
  let frames = 0

  let S = null // the match
  let random = Math.random
  const rand = (a, b) => a + random() * (b - a)
  const staged = [] // rounds set up in advance (the tutorial's demonstrations)
  let raf = 0
  let last = 0
  let hudAt = 0
  let paused = false
  // Input
  const pointer = { x: null, y: null } // last aiming position, in world units
  const keys = { left: false, right: false }
  const touches = new Map()

  function resize() {
    const r = canvas.getBoundingClientRect()
    dpr = manual ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    W = Math.max(1, Math.round(manual ? canvas.width : r.width))
    H = Math.max(1, Math.round(manual ? canvas.height : r.height))
    canvas.width = W * dpr
    canvas.height = H * dpr
    fog.width = W * dpr
    fog.height = H * dpr
    tall = H / W > 1.15
    const view = tall ? TALL_VIEW : WIDE_VIEW
    scale = Math.min(W / (view.right - view.left), H / (view.bottom - view.top))
    ox = W / 2
    oy = H / 2 - ((view.top + view.bottom) / 2) * scale
    gfx?.setSize(W, H, manual ? 1 : Math.min(window.devicePixelRatio || 1, 2), tall)
    unit = gfx ? gfx.scaleAt(0, 0) : scale
    redraw()
  }
  const redraw = () => (!render ? null : S ? draw() : drawIdle())
  const sx = (x) => ox + x * scale
  const sy = (y) => oy + y * scale
  // Above the horizon of the 3D view, a point counts as far up the pitch.
  const toWorld = (px, py) => (gfx ? (gfx.unproject(px, py) ?? { x: 0, y: -60 }) : { x: (px - ox) / scale, y: (py - oy) / scale })

  /** Switches to the 3D drawing, if it has loaded and WebGL works here. */
  function upgrade() {
    if (gfx || destroyed || !Stage || !graphics) return
    try {
      // Touch screens start a step down; anything that then runs slow steps down again (see frame).
      const phone = !manual && window.matchMedia('(hover: none) and (pointer: coarse)').matches
      gfx = Stage.createStage({ quality: manual ? 'high' : phone ? 'medium' : 'high', grain: !manual })
      resize()
    } catch {
      gfx = null
    }
  }
  const fx = (name, x, y) => gfx?.fx(name, x, y)

  // ---------- The match ----------

  function newMatch({ mode = 'match', level = 1, hints } = {}) {
    const practice = mode === 'practice'
    return {
      mode,
      hints: hints ?? practice,
      clock: 0,
      timeLeft: practice ? Infinity : MATCH_SECONDS,
      score: 0,
      streak: 0,
      level: Math.max(1, Math.min(5, level)),
      rules: rulesFor(Math.max(1, Math.min(5, level))),
      head: 0,
      cone: 55 * DEG,
      zone: 'front',
      checks: [], // match times of each shoulder check
      look: new Array(12).fill(0), // seconds spent looking into each 30° slice around you
      round: null,
      gap: 0.6, // pause before the next round
      slow: 0, // seconds of slow motion left (real time)
      shake: 0,
      toasts: [],
      banner: null,
      ended: false,
      stats: {
        rounds: 0,
        completed: 0,
        intercepted: 0,
        tackled: 0,
        misplaced: 0,
        heavy: 0,
        firstTime: 0,
        pressSeen: 0,
        decisions: [],
        checksBefore: [],
      },
    }
  }

  /** A random round for the current level, as a spec for buildRound. */
  function randomSpec() {
    const L = S.level
    const rules = S.rules
    const count = rules.runners
    const spread = tall ? 60 : 78
    const angles = []
    while (angles.length < count) {
      const a = rand(-spread, spread)
      if (angles.every((b) => Math.abs(a - b) > (tall ? 22 : 26))) angles.push(a)
    }
    angles.sort((a, b) => a - b)
    const mates = angles.map((a) => {
      const d = tall ? rand(8, 14) : rand(9, 17)
      const runs = random() < 0.6
      const dir = rand(0, Math.PI * 2)
      const speed = rand(1.5, 3.5)
      return {
        x: Math.sin(a * DEG) * d,
        y: -Math.cos(a * DEG) * d,
        vx: runs ? Math.cos(dir) * speed : 0,
        vy: runs ? Math.sin(dir) * speed * 0.6 : 0,
        runFrom: rand(0.3, 1.5),
        runFor: rand(0.8, 2.2),
      }
    })
    const passAt = rand(1.2, 1.8)
    // One lane is open; a defender shadows every other lane. From level 2, the cover can switch
    // after the pass is played, so an early look may be out of date by the time the ball arrives.
    const open = Math.floor(random() * count)
    const blockers = mates
      .map((m, i) => (i === open ? null : { lane: i, f: rand(0.42, 0.68), side: rand(-0.35, 0.35) }))
      .filter(Boolean)
    let switchAt = null
    let switchFrom = null
    if (random() < rules.switchChance) {
      switchFrom = blockers[Math.floor(random() * blockers.length)].lane
      switchAt = passAt + rand(0.25, 0.6)
    }
    // Midfield wanderers from level 3, kept clear of the open lane.
    const wanderers = []
    for (let i = 0; i < rules.wanderers; i++)
      wanderers.push({ x: tall ? rand(-10, 10) : rand(-14, 14), y: rand(-16, -6), vx: rand(-1.5, 1.5), vy: rand(-1, 1) })
    // The presser starts behind you, on one side, and comes at you once the pass is played. From
    // level 4 a second one comes from the other side, so one look over one shoulder is not enough.
    const side = random() < 0.5 ? -1 : 1
    const pressers = []
    for (let i = 0; i < rules.pressers; i++) {
      const s = i === 0 ? side : -side
      const pa = s * rand(115, 165) * DEG
      const pd = i === 0 ? rand(8.5, 11) : rand(9.5, 12.5)
      pressers.push({
        x: Math.sin(pa) * pd,
        y: -Math.cos(pa) * pd,
        speed: rules.pressSpeed - (i ? 0.4 : 0),
        startAt: passAt + (i === 0 ? rand(0, 0.25) : rand(0.1, 0.4)),
      })
    }
    return {
      level: L,
      passer: { x: rand(-7, 7), y: rand(9, 12) },
      passAt,
      mates,
      open,
      blockers,
      switchAt,
      switchFrom,
      wanderers,
      pressers,
    }
  }

  /** Builds a round from a spec: where everyone starts, how they move, and when the ball is played. */
  function buildRound(spec) {
    const mates = spec.mates.map((m, i) => ({ n: i + 1, vx: 0, vy: 0, runFrom: 99, runFor: 0, ...m, seen: null }))
    const blockers =
      spec.blockers ?? mates.map((m, i) => (i === spec.open ? null : { lane: i, f: 0.55, side: 0 })).filter(Boolean)
    const opps = blockers.map((b) => {
      const m = mates[b.lane]
      return { lane: b.lane, f: b.f, side: b.side, x: m.x * b.f, y: m.y * b.f, seen: null }
    })
    for (const w of spec.wanderers ?? []) opps.push({ wander: true, vx: 0, vy: 0, ...w, seen: null })
    const pressers = spec.pressers.map((p) => ({ speed: S.rules.pressSpeed, ...p, seen: null, seenBeforeBall: false }))
    S.stats.rounds++
    return {
      t: 0,
      phase: 'build',
      passer: { ...spec.passer },
      passAt: spec.passAt,
      ballSpeed: spec.ballSpeed ?? S.rules.ballSpeed,
      mates,
      opps,
      open: spec.open,
      switchAt: spec.switchAt ?? null,
      switchFrom: spec.switchFrom ?? null,
      pressers,
      ball: { x: spec.passer.x, y: spec.passer.y },
      ballSeenAt: -9,
      receivedAt: null,
      readyAt: null,
      queued: null, // a first-time pass, chosen while the ball is on its way
      firstTime: false,
      composed: false, // every presser spotted before the ball arrived
      hinted: false,
      pass: null,
      result: null,
      resultAt: null,
    }
  }

  const inCone = (e) => Math.abs(wrap(angleOf(e.x, e.y) - S.head)) <= S.cone
  const visible = (e) => Math.hypot(e.x, e.y) <= NEAR || inCone(e)
  const fresh = (e) => e.seen && S.clock - e.seen.at < S.rules.memory
  // Where you would aim for a teammate: where they are if you can see them, else where you remember.
  const sighting = (m) => (visible(m) ? m : fresh(m) ? m.seen : null)

  function toast(text, x, y, color = COLORS.bone, big = false) {
    S.toasts.push({ text, x, y, color, big, age: 0 })
  }
  // A coaching line, in practice only.
  function hint(text) {
    if (S.hints) toast(text, 0, 3.2, COLORS.bone)
  }

  function finishRound(result, message) {
    const R = S.round
    R.phase = 'over'
    R.result = result
    R.resultAt = R.t
    S.gap = 0.9
    onEvent?.(message)
  }

  function step(dt) {
    const R = S.round
    // Head: turn towards where the player is aiming, at a human speed.
    let target = S.head
    if (keys.left || keys.right) target = S.head + (keys.right ? 1 : -1) * 0.6
    else if (pointer.x != null && Math.hypot(pointer.x, pointer.y) > 0.8) target = angleOf(pointer.x, pointer.y)
    const diff = wrap(target - S.head)
    S.head = wrap(S.head + Math.sign(diff) * Math.min(Math.abs(diff), HEAD_TURN * dt))
    S.look[Math.min(11, Math.floor(((S.head + Math.PI) / (2 * Math.PI)) * 12))] += dt
    // A shoulder check: from looking forward to looking wide or behind.
    const ang = Math.abs(S.head)
    if (S.zone === 'front' && ang > 80 * DEG) {
      S.zone = 'away'
      S.checks.push(S.clock)
    } else if (S.zone === 'away' && ang < 50 * DEG) S.zone = 'front'

    if (!R) return
    R.t += dt

    // Teammates make their runs; defenders track their lanes (or switch to the open one).
    for (const m of R.mates) {
      if (R.t > m.runFrom && R.t < m.runFrom + m.runFor) {
        m.x = (tall ? clampTallX : clampX)(m.x + m.vx * dt)
        m.y = clampY(m.y + m.vy * dt)
      }
    }
    if (R.switchAt != null && R.t >= R.switchAt) {
      // The cover leaves one lane to shut the open one: the freed lane becomes the pass that's on.
      const mover = R.opps.find((p) => !p.wander && p.lane === R.switchFrom)
      if (mover) {
        mover.lane = R.open
        R.open = R.switchFrom
      }
      R.switchAt = null
    }
    for (const o of R.opps) {
      if (o.wander) {
        o.x += o.vx * dt
        o.y += o.vy * dt
        // Wanderers keep out of the open lane, so there is always a pass on.
        const m = R.mates[R.open]
        if (toSegment(o, { x: 0, y: 0 }, m) < 2.6) {
          const away = Math.sign(o.x - m.x * 0.5) || 1
          o.x += away * 3 * dt
        }
        continue
      }
      const m = R.mates[o.lane]
      const tx = m.x * o.f + (-m.y / Math.hypot(m.x, m.y)) * o.side
      const ty = m.y * o.f + (m.x / Math.hypot(m.x, m.y)) * o.side
      const d = Math.hypot(tx - o.x, ty - o.y)
      const mv = Math.min(d, 5 * dt)
      if (d > 0.01) {
        o.x += ((tx - o.x) / d) * mv
        o.y += ((ty - o.y) / d) * mv
      }
    }
    // The pressers come once the pass is played.
    for (const P of R.pressers) {
      if (R.t >= P.startAt && R.phase !== 'over') {
        const d = Math.hypot(P.x, P.y)
        const mv = Math.min(d, P.speed * dt)
        P.x -= (P.x / d) * mv
        P.y -= (P.y / d) * mv
      }
    }

    // What you can see now becomes what you remember.
    for (const e of [...R.mates, ...R.opps, ...R.pressers]) if (visible(e)) e.seen = { x: e.x, y: e.y, at: S.clock }
    if (R.phase === 'build' || R.phase === 'incoming') {
      for (const P of R.pressers) if (visible(P)) P.seenBeforeBall = true
    }

    // The ball: played in from behind, then yours, then your pass.
    const B = R.ball
    if (R.phase === 'build' && R.t >= R.passAt) {
      R.phase = 'incoming'
      sound.play('pass')
    }
    if (R.phase === 'incoming') {
      const d = Math.hypot(B.x, B.y)
      // Watching it in means looking at it: sensing it at your feet is too late.
      if (inCone(B)) R.ballSeenAt = R.t
      const mv = Math.min(d, R.ballSpeed * dt)
      B.x -= (B.x / d) * mv
      B.y -= (B.y / d) * mv
      if (!R.hinted && d < 6 && R.pressers.some((P) => !P.seenBeforeBall)) {
        R.hinted = true
        hint('Check your shoulder: someone is coming')
      }
      if (d - mv < 0.7) receive()
    } else if (R.phase === 'onball') {
      if (R.pressers.some((P) => Math.hypot(P.x, P.y) < 1.05)) {
        S.stats.tackled++
        S.streak = 0
        S.shake = reducedMotion ? 0 : 0.35
        sound.play('bad')
        fx('tackled')
        hurt = reducedMotion ? 0 : 1
        toast('Tackled', 0, -1.5, COLORS.danger, true)
        if (R.pressers.some((P) => !P.seenBeforeBall)) toast('Check your shoulder before the ball arrives', 0, 1.6, COLORS.bone)
        else hint('You saw them: pass sooner, as soon as the ball arrives')
        finishRound('tackled', 'Tackled. The presser came from your blind side.')
      }
    } else if (R.phase === 'passing') {
      const p = R.pass
      const d = Math.hypot(p.to.x - B.x, p.to.y - B.y)
      const mv = Math.min(d, PASS_SPEED * dt)
      B.x += ((p.to.x - B.x) / (d || 1)) * mv
      B.y += ((p.to.y - B.y) / (d || 1)) * mv
      const thief = [...R.opps, ...R.pressers].find((o) => Math.hypot(o.x - B.x, o.y - B.y) < 0.95)
      if (thief) {
        S.stats.intercepted++
        S.streak = 0
        sound.play('bad')
        fx('intercepted', thief.x, thief.y)
        toast('Intercepted', thief.x, thief.y - 1.4, COLORS.danger, true)
        hint('Look along the lane, not just at the player: find the one nobody is in')
        finishRound('intercepted', 'Intercepted. That lane was covered.')
      } else if (d - mv < 0.4) {
        const mate = p.mate
        if (mate && Math.hypot(mate.x - B.x, mate.y - B.y) < 1.9) complete(mate)
        else {
          S.stats.misplaced++
          S.streak = 0
          sound.play('bad')
          fx('misplaced', B.x, B.y)
          toast('They had moved', B.x, B.y - 1.4, COLORS.danger, true)
          hint('Memories go stale: look again before you pass')
          finishRound('misplaced', 'Misplaced. You passed to where they were, not where they are.')
        }
      }
    }
  }

  function receive() {
    const R = S.round
    R.phase = 'onball'
    R.ball.x = 0
    R.ball.y = 0
    R.receivedAt = R.t
    const clean = R.t - R.ballSeenAt <= 0.35
    R.readyAt = R.t + (clean ? 0 : 0.35)
    R.composed = R.pressers.every((P) => P.seenBeforeBall)
    if (R.composed) S.stats.pressSeen++
    S.stats.checksBefore.push(S.checks.filter((c) => c > S.clock - 3).length)
    sound.play('receive')
    fx('receive')
    if (!clean) {
      S.stats.heavy++
      toast('Heavy touch: watch it in', 0, 1.6, COLORS.bone)
    }
    // A pass chosen while the ball was coming is played first time, if you watched the ball in.
    const queued = R.queued
    R.queued = null
    if (queued && clean) {
      const at = sighting(queued)
      if (at) {
        R.firstTime = true
        launch(queued, at, visible(queued))
        return
      }
    } else if (queued) hint('Watch the ball in to play it first time')
    // Seeing the press coming buys you time: the moment slows as the ball arrives.
    S.slow = reducedMotion || !R.composed ? 0 : S.mode === 'practice' ? 0.9 : 0.55
    if (!R.composed) toast('No time: you did not see the press', 0, -3.1, COLORS.bone)
  }

  function complete(mate) {
    const R = S.round
    const decision = Math.max(0, R.pass.at - R.readyAt)
    const checks = S.stats.checksBefore[S.stats.checksBefore.length - 1] || 0
    const base =
      100 +
      Math.round(Math.max(0, 60 - 50 * decision)) +
      15 * Math.min(4, checks) +
      (R.composed ? 20 : 0) +
      (R.firstTime ? FIRST_TIME_BONUS : 0)
    const mult = 1 + 0.1 * Math.min(S.streak, 10)
    const points = Math.round(base * mult)
    S.score += points
    S.streak++
    S.stats.completed++
    S.stats.decisions.push(decision)
    if (R.firstTime) S.stats.firstTime++
    sound.play(R.firstTime ? 'first' : 'good')
    fx(R.firstTime ? 'first' : 'complete', mate.x, mate.y)
    toast(`+${points}`, mate.x, mate.y - 1.6, COLORS.volt, true)
    if (R.firstTime) toast('First time', mate.x, mate.y + 1.5, COLORS.volt)
    else if (checks >= 2) toast(`${checks} checks before the ball`, 0, 1.6, COLORS.volt)
    finishRound('complete', `Pass completed${R.firstTime ? ', first time' : ''}. ${points} points.`)
    // Matches climb a level every three completed passes.
    const next = Math.min(5, 1 + Math.floor(S.stats.completed / PASSES_PER_LEVEL))
    if (S.mode === 'match' && next > S.level) {
      S.level = next
      S.rules = rulesFor(next)
      const L = LEVELS[next - 1]
      S.banner = { title: `Level ${next} · ${L.name}`, sub: L.adds, age: 0 }
      S.gap = 1.6
      sound.play('level')
      fx('level')
      onEvent?.(`Level ${next}, ${L.name}. ${L.adds}`)
    }
  }

  /** Plays the ball to a teammate at `at` (where they are, or where you remember them). */
  function launch(mate, at, vis) {
    const R = S.round
    // A visible runner is played into their path (for as much of the ball's flight as they will still
    // be running); a memory gets the ball where it was.
    const to = { x: at.x, y: at.y }
    if (vis) {
      const flight = Math.hypot(to.x, to.y) / PASS_SPEED
      const running = Math.max(0, Math.min(R.t + flight, mate.runFrom + mate.runFor) - Math.max(R.t, mate.runFrom))
      to.x = (tall ? clampTallX : clampX)(to.x + mate.vx * running)
      to.y = clampY(to.y + mate.vy * running)
    }
    R.pass = { to, mate, at: R.t }
    R.phase = 'passing'
    S.slow = 0
    sound.play('pass')
  }

  /** A pass towards a point on screen: to a teammate you can see, or one you remember. */
  function passTo(world) {
    const R = S?.round
    if (!R || S.ended) return
    if (R.phase !== 'onball' && R.phase !== 'incoming') return
    if (R.phase === 'onball' && R.t < R.readyAt) return
    let best = null
    for (const m of R.mates) {
      const at = sighting(m)
      if (!at) continue
      const d = Math.hypot(at.x - world.x, at.y - world.y)
      if (d < 3.2 && (!best || d < best.d)) best = { d, mate: m, at, vis: visible(m) }
    }
    if (!best) {
      toast('Pass to a teammate you can see or remember', 0, 1.6, COLORS.bone)
      return
    }
    // Still coming: this is the pass you will play first time.
    if (R.phase === 'incoming') R.queued = best.mate
    else launch(best.mate, best.at, best.vis)
  }

  function passToNumber(n) {
    const m = S?.round?.mates.find((x) => x.n === n)
    const at = m && sighting(m)
    if (at) passTo({ x: at.x, y: at.y })
  }

  function passToCentre() {
    const R = S?.round
    if (!R) return
    let best = null
    for (const m of R.mates) {
      const at = sighting(m)
      if (!at) continue
      const off = Math.abs(wrap(angleOf(at.x, at.y) - S.head))
      if (!best || off < best.off) best = { off, at }
    }
    if (best) passTo(best.at)
  }

  // ---------- Drawing ----------
  //
  // The 3D stage (stage3d.js) draws the pitch, the players and the light when WebGL is there; this
  // file adds the labels over it. Without WebGL, the flat drawing below stands in.

  /** Screen position of a point on the pitch, in whichever drawing is on. */
  const P = (x, y, h = 0) => (gfx ? gfx.project(x, y, h) : { x: sx(x), y: sy(y) })

  /** What the 3D stage needs for this frame: who is where, who you see, and what you remember. */
  function view3d() {
    const R = S?.round
    const figures = []
    const decals = []
    let ball = null
    const you = { kick: null, touch: null, hit: null }
    if (R) {
      const add = (e, kind, extra) => {
        const shown = visible(e)
        const age = e.seen ? S.clock - e.seen.at : Infinity
        const remembered = !shown && age > 0.05 && age <= S.rules.memory
        figures.push({
          key: e,
          kind,
          x: e.x,
          y: e.y,
          shown,
          ghost: remembered ? { x: e.seen.x, y: e.seen.y, alpha: 1 - age / S.rules.memory } : null,
          ...extra,
        })
      }
      add(R.passer, 'passer', { kick: R.t - R.passAt })
      for (const m of R.mates) add(m, 'mate')
      for (const o of R.opps) add(o, 'opp')
      for (const p of R.pressers) add(p, 'press')
      if (R.pass) you.kick = R.t - R.pass.at
      if (R.receivedAt != null) you.touch = R.t - R.receivedAt
      if (R.result === 'tackled') you.hit = R.t - R.resultAt
      // The ball sits at the passer's feet until it is played, then is drawn only when you look at it.
      const yours = R.phase === 'onball' || R.phase === 'passing' || R.phase === 'over'
      let { x, y } = R.ball
      if (R.phase === 'build' || R.phase === 'incoming') {
        const toYou = Math.hypot(R.passer.x, R.passer.y) || 1
        const out = Math.hypot(x - R.passer.x, y - R.passer.y)
        if (out < 0.6) {
          x = R.passer.x - (R.passer.x / toYou) * 0.6
          y = R.passer.y - (R.passer.y / toYou) * 0.6
        }
      }
      ball = { x, y, shown: yours || visible(R.ball), held: R.phase === 'onball', glow: R.phase === 'incoming' }
      // The call: a teammate shouting as they play it in, so you know which way to look for the ball.
      if (R.phase === 'incoming' && !visible(R.ball)) {
        decals.push({
          x: 0,
          y: 0,
          r: 3,
          w: 0.24,
          color: COLORS.volt,
          k: 2.2,
          alpha: 0.55 + 0.4 * Math.sin(vt * 14),
          a0: angleOf(R.ball.x, R.ball.y),
          len: 0.62,
        })
      }
      // The first-time pass you have lined up.
      if (R.queued && R.phase === 'incoming') {
        const at = sighting(R.queued)
        if (at) decals.push({ x: at.x, y: at.y, r: 1.2, w: 0.13, color: COLORS.volt, k: 2, dash: 14, spin: -vt * 0.9 })
      }
    }
    return {
      time: vt,
      clock: S ? S.clock : 0,
      head: S ? S.head : 0,
      cone: S ? S.cone : 55 * DEG,
      near: NEAR,
      slow: !!S && S.slow > 0,
      idle: !R,
      ballComing: R?.phase === 'incoming',
      reducedMotion,
      you,
      figures,
      ball,
      decals,
    }
  }

  function draw() {
    if (gfx?.lost) gfx = null // the browser took WebGL away: carry on flat
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.save()
    if (S.shake > 0) ctx.translate(Math.sin(S.clock * 91) * S.shake * 8, Math.cos(S.clock * 77) * S.shake * 8)
    if (gfx) {
      gfx.render(view3d())
      ctx.fillStyle = '#030404'
      ctx.fillRect(-20, -20, W + 40, H + 40)
      ctx.drawImage(gfx.canvas, 0, 0, W, H)
      drawTrail()
      drawNumbers()
    } else drawFlat()
    drawToasts()
    ctx.restore()
    drawCinema()
    drawBanner()
  }

  // The ball's trail: a short streak of light behind it as it travels.
  const trail = []
  function drawTrail() {
    const R = S.round
    const B = R?.ball
    const moving = R && (R.phase === 'passing' || (R.phase === 'incoming' && visible(B)))
    if (moving) trail.push({ x: B.x, y: B.y, at: vt })
    while (trail.length && (vt - trail[0].at > 0.22 || trail.length > 24)) trail.shift()
    if (!moving && trail.length) trail.shift()
    if (trail.length < 2) return
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    for (let i = 1; i < trail.length; i++) {
      const a = P(trail[i - 1].x, trail[i - 1].y, 0.24)
      const b = P(trail[i].x, trail[i].y, 0.24)
      const k = i / trail.length
      ctx.strokeStyle = R.phase === 'passing' ? `rgba(215,255,58,${0.55 * k})` : `rgba(255,255,255,${0.5 * k})`
      ctx.lineWidth = Math.max(1.5, unit * 0.34 * k)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Shirt numbers over your teammates' heads (for the number keys): solid when you see them, dashed
  // over a memory.
  function drawNumbers() {
    const R = S.round
    if (!R) return
    const s = Math.max(9, Math.min(14, unit * 0.42))
    ctx.save()
    ctx.font = `800 ${Math.round(s * 1.15)}px Archivo, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const m of R.mates) {
      const seen = visible(m)
      const age = m.seen ? S.clock - m.seen.at : Infinity
      if (!seen && !(age > 0.05 && age <= S.rules.memory)) continue
      const at = seen ? m : m.seen
      const q = P(at.x, at.y, 3.3)
      const p = { x: Math.max(s + 3, Math.min(W - s - 3, q.x)), y: Math.max(s + 3, q.y) }
      ctx.globalAlpha = seen ? 1 : 0.8 * (1 - age / S.rules.memory)
      ctx.beginPath()
      ctx.roundRect(p.x - s, p.y - s, s * 2, s * 2, s * 0.45)
      if (seen) {
        ctx.fillStyle = COLORS.volt
        ctx.fill()
        ctx.fillStyle = '#0a0a0b'
      } else {
        ctx.fillStyle = 'rgba(6,6,7,0.7)'
        ctx.fill()
        ctx.setLineDash([3, 3])
        ctx.strokeStyle = COLORS.volt
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.volt
      }
      ctx.fillText(String(m.n), p.x, p.y + 0.5)
    }
    ctx.restore()
  }

  function drawToasts() {
    for (const t of S.toasts) {
      const p = P(t.x, t.y)
      const x = Math.max(80, Math.min(W - 80, p.x))
      const y = p.y - t.age * 18
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - t.age / 1.3)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (t.big) {
        // Big calls pop in and glow.
        const pop = 1 + 0.45 * Math.pow(Math.max(0, 1 - t.age / 0.18), 2)
        const size = Math.max(16, unit * 1.5) * pop
        ctx.font = `900 ${Math.round(size)}px Archivo, sans-serif`
        ctx.fontStretch = 'expanded'
        const label = t.text.toUpperCase()
        ctx.lineJoin = 'round'
        ctx.lineWidth = Math.max(3, size * 0.16)
        ctx.strokeStyle = 'rgba(3,4,4,0.8)'
        ctx.strokeText(label, x, y)
        if (gfx) {
          ctx.shadowColor = t.color
          ctx.shadowBlur = size * 0.6
        }
        ctx.fillStyle = t.color
        ctx.fillText(label, x, y)
      } else {
        const size = Math.max(11, unit * 0.85)
        ctx.font = `700 ${Math.round(size)}px Archivo, sans-serif`
        if (gfx) {
          // A dark tag behind small text, so it reads over the lit turf.
          const w = ctx.measureText(t.text).width + size * 1.4
          ctx.fillStyle = 'rgba(6,6,7,0.72)'
          ctx.beginPath()
          ctx.roundRect(x - w / 2, y - size * 0.95, w, size * 1.9, size * 0.95)
          ctx.fill()
        }
        ctx.fillStyle = t.color
        ctx.fillText(t.text, x, y + 0.5)
      }
      ctx.restore()
    }
  }

  // Slow motion closes in like a replay (bars top and bottom); a tackle flashes the edges red.
  let bars = 0
  let hurt = 0
  function drawCinema() {
    if (!gfx || reducedMotion) return
    if (bars > 0.01) {
      const h = H * 0.06 * smoothStep(bars)
      ctx.fillStyle = '#020303'
      ctx.fillRect(0, 0, W, h)
      ctx.fillRect(0, H - h, W, h)
    }
    if (hurt > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75)
      g.addColorStop(0, 'rgba(255,60,40,0)')
      g.addColorStop(1, `rgba(255,60,40,${0.45 * hurt})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }
  }

  function drawBanner() {
    const b = S.banner
    if (!b) return
    const k = Math.min(1, b.age / 0.25, (2.4 - b.age) / 0.4)
    if (k <= 0) return
    ctx.save()
    ctx.globalAlpha = k
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const y = H * 0.3
    const u = Math.max(12, unit)
    const band = ctx.createLinearGradient(0, 0, W, 0)
    band.addColorStop(0, 'rgba(4,5,5,0)')
    band.addColorStop(0.5, 'rgba(4,5,5,0.86)')
    band.addColorStop(1, 'rgba(4,5,5,0)')
    ctx.fillStyle = band
    ctx.fillRect(0, y - u * 2.3, W, u * 4.2)
    // Volt rules that open out from the centre.
    const open = smoothStep(Math.min(1, b.age / 0.45)) * W * 0.32
    ctx.fillStyle = COLORS.volt
    ctx.fillRect(W / 2 - open, y - u * 2.3, open * 2, 2)
    ctx.fillRect(W / 2 - open, y + u * 1.9 - 2, open * 2, 2)
    const slide = (1 - smoothStep(Math.min(1, b.age / 0.35))) * 24
    ctx.fillStyle = COLORS.volt
    ctx.font = `900 ${Math.max(18, u * 1.35)}px Archivo, sans-serif`
    ctx.fontStretch = 'expanded'
    if (gfx) {
      ctx.shadowColor = COLORS.volt
      ctx.shadowBlur = u * 0.8
    }
    ctx.fillText(b.title.toUpperCase(), W / 2 + slide, y - u * 0.5)
    ctx.shadowBlur = 0
    ctx.fillStyle = COLORS.bone
    ctx.font = `600 ${Math.max(12, u * 0.72)}px Archivo, sans-serif`
    ctx.fontStretch = 'normal'
    ctx.fillText(b.sub, W / 2 - slide, y + u * 1.0)
    ctx.restore()
  }

  function drawIdle() {
    if (!W) return
    if (gfx?.lost) gfx = null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (gfx) {
      gfx.render(view3d())
      ctx.drawImage(gfx.canvas, 0, 0, W, H)
      return
    }
    drawPitch()
    drawLines(0.35)
    disc(0, 0, 0.7, COLORS.volt, '#ffffff')
  }

  // ---------- The flat drawing (without WebGL) ----------

  function drawPitch() {
    ctx.fillStyle = COLORS.turf
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = COLORS.stripe
    for (let y = -60; y < 60; y += 10) ctx.fillRect(0, sy(y), W, 5 * scale)
  }

  function drawLines(alpha) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = COLORS.line
    ctx.lineWidth = Math.max(1, scale * 0.12)
    ctx.beginPath()
    ctx.moveTo(0, sy(0))
    ctx.lineTo(W, sy(0))
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(sx(0), sy(0), 9.15 * scale, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  function disc(x, y, r, fill, stroke, label) {
    ctx.beginPath()
    ctx.arc(sx(x), sy(y), r * scale, 0, Math.PI * 2)
    if (fill) {
      ctx.fillStyle = fill
      ctx.fill()
    }
    if (stroke) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = Math.max(1.5, scale * 0.16)
      ctx.stroke()
    }
    if (label) {
      ctx.fillStyle = '#0a0a0b'
      ctx.font = `800 ${Math.max(9, scale * 0.75)}px Archivo, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, sx(x), sy(y) + 0.5)
    }
  }

  function ghost(e, color, r) {
    if (!e.seen) return
    const age = S.clock - e.seen.at
    if (age <= 0.05 || age > S.rules.memory) return
    ctx.save()
    ctx.globalAlpha = 0.6 * (1 - age / S.rules.memory)
    ctx.setLineDash([scale * 0.3, scale * 0.25])
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1.2, scale * 0.12)
    ctx.beginPath()
    ctx.arc(sx(e.seen.x), sy(e.seen.y), r * scale, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  /** The light of your gaze: the turf glows where you are looking, with faint edges to the cone. */
  function drawGaze() {
    const reach = 48 * scale
    const g = ctx.createRadialGradient(sx(0), sy(0), 0, sx(0), sy(0), reach)
    g.addColorStop(0, 'rgba(230,255,170,0.16)')
    g.addColorStop(0.5, 'rgba(230,255,170,0.05)')
    g.addColorStop(1, 'rgba(230,255,170,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(sx(0), sy(0))
    ctx.arc(sx(0), sy(0), reach, S.head - S.cone - Math.PI / 2, S.head + S.cone - Math.PI / 2)
    ctx.closePath()
    ctx.fill()
  }

  function drawConeEdges() {
    ctx.save()
    ctx.strokeStyle = 'rgba(215,255,58,0.22)'
    ctx.lineWidth = 1
    for (const side of [-1, 1]) {
      const a = S.head + side * S.cone
      ctx.beginPath()
      ctx.moveTo(sx(Math.sin(a) * 1.2), sy(-Math.cos(a) * 1.2))
      ctx.lineTo(sx(Math.sin(a) * 30), sy(-Math.cos(a) * 30))
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawFog() {
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    fctx.globalCompositeOperation = 'source-over'
    fctx.clearRect(0, 0, W, H)
    fctx.fillStyle = 'rgba(3,4,4,0.94)'
    fctx.fillRect(0, 0, W, H)
    fctx.globalCompositeOperation = 'destination-out'
    const reach = 48 * scale
    // The cone, drawn in layers so its edges are soft.
    for (const [spread, a] of [
      [1.12, 0.35],
      [1.0, 0.45],
      [0.86, 0.6],
    ]) {
      const g = fctx.createRadialGradient(sx(0), sy(0), 0, sx(0), sy(0), reach)
      g.addColorStop(0, `rgba(0,0,0,${a})`)
      g.addColorStop(0.75, `rgba(0,0,0,${a * 0.9})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      fctx.fillStyle = g
      const a0 = S.head - S.cone * spread - Math.PI / 2
      const a1 = S.head + S.cone * spread - Math.PI / 2
      fctx.beginPath()
      fctx.moveTo(sx(0), sy(0))
      fctx.arc(sx(0), sy(0), reach, a0, a1)
      fctx.closePath()
      fctx.fill()
    }
    // A small pool of awareness around you.
    const n = fctx.createRadialGradient(sx(0), sy(0), 0, sx(0), sy(0), NEAR * scale * 1.3)
    n.addColorStop(0, 'rgba(0,0,0,0.75)')
    n.addColorStop(1, 'rgba(0,0,0,0)')
    fctx.fillStyle = n
    fctx.beginPath()
    fctx.arc(sx(0), sy(0), NEAR * scale * 1.3, 0, Math.PI * 2)
    fctx.fill()
    ctx.drawImage(fog, 0, 0, W, H)
  }

  function drawFlat() {
    drawPitch()
    drawGaze()
    drawLines(0.5)
    const R = S.round
    if (R) {
      // Only what you can see right now is drawn under the light.
      for (const m of R.mates) if (visible(m)) disc(m.x, m.y, 0.6, COLORS.volt, null, String(m.n))
      if (visible(R.passer)) disc(R.passer.x, R.passer.y, 0.6, COLORS.volt, null, '')
      for (const o of R.opps) if (visible(o)) disc(o.x, o.y, 0.55, null, COLORS.bone)
      for (const p of R.pressers) if (visible(p)) disc(p.x, p.y, 0.6, null, COLORS.danger)
      if (R.pass && R.phase === 'passing') {
        ctx.save()
        ctx.strokeStyle = 'rgba(215,255,58,0.35)'
        ctx.lineWidth = scale * 0.25
        ctx.beginPath()
        ctx.moveTo(sx(0), sy(0))
        ctx.lineTo(sx(R.ball.x), sy(R.ball.y))
        ctx.stroke()
        ctx.restore()
      }
      // Until it reaches you, the ball is only drawn when you are looking at it.
      const yours = R.phase === 'onball' || R.phase === 'passing' || R.phase === 'over'
      if (yours || visible(R.ball)) {
        ctx.save()
        ctx.shadowColor = '#ffffff'
        ctx.shadowBlur = 12
        disc(R.ball.x, R.ball.y, 0.32, '#ffffff')
        ctx.restore()
      }
    }
    drawFog()
    drawLines(0.14)
    drawConeEdges()
    if (R) {
      // Memory ghosts: where you last saw people, fading and going stale.
      for (const m of R.mates) if (!visible(m)) ghost(m, COLORS.volt, 0.6)
      for (const o of R.opps) if (!visible(o)) ghost(o, COLORS.bone, 0.55)
      for (const p of R.pressers) if (!visible(p)) ghost(p, COLORS.danger, 0.6)
      // The call: which way to look for the ball.
      if (R.phase === 'incoming' && !visible(R.ball)) {
        const a = angleOf(R.ball.x, R.ball.y) - Math.PI / 2
        ctx.save()
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(S.clock * 14)
        ctx.strokeStyle = COLORS.volt
        ctx.lineWidth = scale * 0.22
        ctx.beginPath()
        ctx.arc(sx(0), sy(0), 3 * scale, a - 0.3, a + 0.3)
        ctx.stroke()
        ctx.restore()
      }
      // The first-time pass you have lined up.
      if (R.queued && R.phase === 'incoming') {
        const at = sighting(R.queued)
        if (at) {
          ctx.save()
          ctx.strokeStyle = COLORS.volt
          ctx.lineWidth = Math.max(2, scale * 0.14)
          ctx.setLineDash([scale * 0.5, scale * 0.3])
          ctx.lineDashOffset = -S.clock * scale * 3
          ctx.beginPath()
          ctx.arc(sx(at.x), sy(at.y), 1.15 * scale, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }
    }
    // You: the pivot, and which way you are facing.
    ctx.save()
    ctx.strokeStyle = COLORS.volt
    ctx.lineWidth = scale * 0.18
    ctx.beginPath()
    ctx.moveTo(sx(0), sy(0))
    ctx.lineTo(sx(Math.sin(S.head) * 1.5), sy(-Math.cos(S.head) * 1.5))
    ctx.stroke()
    ctx.restore()
    disc(0, 0, 0.7, COLORS.volt, '#ffffff')
  }

  // ---------- The loop ----------

  /** Moves the match on by `real` seconds of real time (slow motion runs the match slower). */
  function advance(real) {
    if (!S || S.ended) return
    const timeScale = S.slow > 0 ? 0.35 : 1
    S.slow = Math.max(0, S.slow - real)
    S.shake = Math.max(0, S.shake - real)
    const dt = real * timeScale
    vt += real
    bars += ((S.slow > 0 ? 1 : 0) - bars) * Math.min(1, real * 8)
    hurt = Math.max(0, hurt - real * 2.2)
    S.clock += dt
    const before = Math.ceil(S.timeLeft)
    S.timeLeft = Math.max(0, S.timeLeft - dt)
    if (S.timeLeft <= 5 && Math.ceil(S.timeLeft) < before) sound.play('tick')
    for (const t of S.toasts) t.age += real
    S.toasts = S.toasts.filter((t) => t.age < 1.3)
    if (S.banner) {
      S.banner.age += real
      if (S.banner.age > 2.4) S.banner = null
    }

    if (!S.round || S.round.phase === 'over') {
      S.gap -= real
      if (S.gap <= 0) {
        if (S.timeLeft <= 0) return end()
        S.round = buildRound(staged.length ? staged.shift() : randomSpec())
      }
    } else if (S.timeLeft <= 0 && S.round.phase !== 'passing') {
      return end()
    }
    step(dt)
    if (render) draw()
  }

  const hud = () => ({
    timeLeft: S.timeLeft,
    score: S.score,
    combo: 1 + 0.1 * Math.min(S.streak, 10),
    level: S.level,
    mode: S.mode,
  })

  function frame(now) {
    raf = requestAnimationFrame(frame)
    const real = Math.min(0.05, (now - last) / 1000 || 0)
    last = now
    if (paused || !S || S.ended) return
    if (!gfx && now < waitFor3d) return
    advance(real)
    // Running slow in 3D: step the quality down (lower resolution, then no glow).
    if (gfx && ++frames > 90) {
      slowFrames = real > 0.026 ? slowFrames + 1 : Math.max(0, slowFrames - 0.5)
      if (slowFrames > 40) {
        slowFrames = 0
        frames = 0
        gfx.lower()
        unit = gfx.scaleAt(0, 0)
      }
    }
    if (S && !S.ended && now - hudAt > 120) {
      hudAt = now
      onHud?.(hud())
    }
  }

  function end() {
    S.ended = true
    sound.play('whistle')
    const st = S.stats
    const played = S.mode === 'practice' ? S.clock : MATCH_SECONDS - S.timeLeft
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
    const lookTotal = S.look.reduce((x, y) => x + y, 0) || 1
    onHud?.({ ...hud(), timeLeft: 0, combo: 1 })
    onEnd?.({
      mode: S.mode,
      score: S.score,
      level: S.level,
      levelName: LEVELS[S.level - 1].name,
      rounds: st.rounds,
      completed: st.completed,
      intercepted: st.intercepted,
      tackled: st.tackled,
      misplaced: st.misplaced,
      heavyTouches: st.heavy,
      firstTime: st.firstTime,
      scansPerSecond: S.checks.length / Math.max(1, played),
      checksBeforeBall: avg(st.checksBefore),
      pressSpotted: st.checksBefore.length ? st.pressSeen / st.checksBefore.length : 0,
      decisionSeconds: avg(st.decisions),
      // Where you looked: twelve 30° slices, starting from straight behind you on the left and going
      // clockwise round to straight behind on the right.
      lookMap: S.look.map((s) => s / lookTotal),
      lookedBehind: S.look.filter((_, i) => i < 3 || i > 8).reduce((x, y) => x + y, 0) / lookTotal,
    })
  }

  // ---------- Input ----------

  const local = (e) => {
    const r = canvas.getBoundingClientRect()
    return { px: e.clientX - r.left, py: e.clientY - r.top }
  }
  function onPointerDown(e) {
    sound.unlock()
    const { px, py } = local(e)
    touches.set(e.pointerId, { px, py, at: performance.now(), moved: false, mouse: e.pointerType === 'mouse' })
    if (e.pointerType === 'mouse') {
      // A click passes; the mouse aims all the time.
      passTo(toWorld(px, py))
      return
    }
    canvas.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e) {
    const { px, py } = local(e)
    const t = touches.get(e.pointerId)
    if (e.pointerType === 'mouse' || (t && (t.moved || Math.hypot(px - t.px, py - t.py) > 10))) {
      if (t) t.moved = true
      const w = toWorld(px, py)
      pointer.x = w.x
      pointer.y = w.y
    }
  }
  function onPointerUp(e) {
    const t = touches.get(e.pointerId)
    touches.delete(e.pointerId)
    if (!t || t.mouse) return
    // A quick tap passes; a drag only aims.
    if (!t.moved && performance.now() - t.at < 300) passTo(toWorld(t.px, t.py))
  }
  function onKey(e, down) {
    if (!S || S.ended) return
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = down
    else if (e.key === 'ArrowRight' || e.key === 'd') keys.right = down
    else if (down && e.key === ' ') passToCentre()
    else if (down && /^[1-4]$/.test(e.key)) passToNumber(Number(e.key))
    else return
    if (keys.left || keys.right) pointer.x = null
    e.preventDefault()
  }
  const keydown = (e) => onKey(e, true)
  const keyup = (e) => onKey(e, false)
  const onVisibility = () => {
    paused = document.hidden
    last = performance.now()
  }

  if (!manual) {
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('keydown', keydown)
    canvas.addEventListener('keyup', keyup)
    document.addEventListener('visibilitychange', onVisibility)
  }
  const ro = manual ? null : new ResizeObserver(resize)
  ro?.observe(canvas)
  resize()
  last = performance.now()
  if (!manual) raf = requestAnimationFrame(frame)
  // The 3D drawing: straight away if it is already loaded (the tutorial loads it first). On the page it
  // loads at the visitor's first scroll, touch, key or mouse move, so it never slows the first load;
  // a match started before it arrives waits for it (see start).
  const INTENT = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'scroll', 'wheel']
  const listen = !manual && graphics && !Stage
  if (listen) for (const e of INTENT) window.addEventListener(e, want3d, { passive: true })
  let wanted = false
  function want3d() {
    if (wanted) return
    wanted = true
    for (const e of INTENT) window.removeEventListener(e, want3d)
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1))
    loadGraphics().then(() => idle(upgrade, { timeout: 400 }))
  }
  let waitFor3d = 0 // until when a new match waits for the 3D drawing
  if (Stage) upgrade()

  return {
    /** Starts a match: mode 'match' (a minute, climbing levels) or 'practice' (one level, no clock). */
    start({ mode = 'match', level = 1, seed = null, hints } = {}) {
      sound.unlock()
      random = seed == null ? Math.random : seeded(seed)
      S = newMatch({ mode, level, hints })
      pointer.x = null
      keys.left = keys.right = false
      sound.play('whistle')
      if (!manual) {
        canvas.focus({ preventScroll: true })
        if (graphics && !gfx) {
          want3d()
          waitFor3d = performance.now() + 2500
        }
      }
      onHud?.(hud())
    },
    /** Ends the match now (how practice finishes). */
    stop() {
      if (S && !S.ended) end()
    },
    setMuted: (m) => sound.setMuted(m),
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      for (const e of INTENT) window.removeEventListener(e, want3d)
      gfx?.dispose()
      gfx = null
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('keydown', keydown)
      canvas.removeEventListener('keyup', keyup)
      document.removeEventListener('visibilitychange', onVisibility)
      sound.close()
    },
    // Manual play, for the tutorial and the automated checks.
    tick(real) {
      advance(real)
      if (S && !S.ended) onHud?.(hud())
    },
    aim(world) {
      pointer.x = world ? world.x : null
      pointer.y = world ? world.y : null
    },
    press: (world) => passTo(world),
    /** The next round(s) will be exactly this, instead of random. */
    stage: (spec) => staged.push(spec),
    /** Draws the current moment (with render: false, the game only draws when asked). */
    draw: () => (S ? draw() : drawIdle()),
    /** Screen position of a point on the pitch, h metres up, and pixels per metre there (for notes). */
    toScreen: (x, y, h = 0) => ({ ...P(x, y, h), scale: gfx ? gfx.scaleAt(x, y) : scale }),
    /** How the game is being drawn: 'high', 'medium' or 'low' in 3D, or 'flat'. */
    graphics: () => (gfx ? gfx.quality : 'flat'),
    // A read-only look at the match.
    peek: () =>
      S && {
        mode: S.mode,
        phase: S.round?.phase,
        level: S.level,
        score: S.score,
        streak: S.streak,
        head: S.head,
        checks: S.checks.length,
        clock: S.clock,
        timeLeft: S.timeLeft,
        slow: S.slow,
        ended: S.ended,
        visible: (e) => visible(e),
        round: S.round,
        stats: S.stats,
      },
  }
}
