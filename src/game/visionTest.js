// The Vision Test: a scanning game built on the academy's own method ("see the pressure before the
// ball arrives", "think one pass ahead").
//
// You are the pivot in the centre circle, seen from above. You only see what you look at: everything
// outside your vision cone is dark. The ball is played to you from behind, and a presser closes in
// from your blind side, so you have to check your shoulders. What you look away from stays as a
// fading "memory ghost" where you last saw it, and memories go stale because players keep moving.
// When the ball arrives, time slows for a beat: pass to the open teammate before you are tackled.
// A pass into a covered lane is intercepted; a pass to a stale memory goes to empty grass.
//
// World units are metres. x runs right, y runs down the screen, so "forward" (towards goal) is -y.
// Angles are measured from forward, clockwise, so 0 = forward, +90° = right, ±180° = behind.

export const MATCH_SECONDS = 60

const DEG = Math.PI / 180
const BALL_SPEED = 11 // the pass in from behind
const PASS_SPEED = 20 // your pass
const HEAD_TURN = 10 // radians per second: fast, but not instant
const NEAR = 2.2 // you can sense anyone this close, wherever you look
const MEMORY = 3.5 // seconds a memory ghost lasts
// How much of the pitch is on screen: wide screens see 42 m across; phones held upright see 28 m.
const WIDE_VIEW = { left: -21, right: 21, top: -22, bottom: 15 }
const TALL_VIEW = { left: -14, right: 14, top: -21, bottom: 14 }

const rand = (a, b) => a + Math.random() * (b - a)
// Runners stay on the visible part of the pitch.
const clampX = (x) => Math.max(-19, Math.min(19, x))
const clampTallX = (x) => Math.max(-12.5, Math.min(12.5, x))
const clampY = (y) => Math.max(-20, Math.min(4, y))
const angleOf = (x, y) => Math.atan2(x, -y)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
function toSegment(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k))
}

const COLORS = {
  turf: '#14211a',
  stripe: '#182820',
  line: 'rgba(242,242,238,0.9)',
  volt: '#d7ff3a',
  bone: '#f2f2ee',
  danger: '#ff6a5c',
}

/** Small synthesized sound effects (no files): kicks, a whistle, chimes. */
function createSound() {
  let ac = null
  let muted = false
  const ctx = () => (ac ??= new (window.AudioContext || window.webkitAudioContext)())
  const tone = (freq, at, len, { type = 'sine', gain = 0.2, to } = {}) => {
    const a = ctx()
    const t = a.currentTime + at
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + len)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    o.connect(g).connect(a.destination)
    o.start(t)
    o.stop(t + len + 0.02)
  }
  const thud = (gain = 0.4) => {
    tone(150, 0, 0.18, { gain, to: 50 })
    tone(900, 0, 0.03, { type: 'square', gain: gain * 0.15 })
  }
  const play = (name) => {
    if (muted) return
    try {
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
      if (name === 'bad') tone(220, 0, 0.45, { type: 'sawtooth', gain: 0.07, to: 90 })
      if (name === 'tick') tone(1200, 0, 0.05, { type: 'square', gain: 0.04 })
    } catch {
      // Audio is a bonus; the game works without it.
    }
  }
  return {
    play,
    unlock: () => ctx().resume?.(),
    setMuted: (m) => (muted = m),
    close: () => ac?.close(),
  }
}

/**
 * Starts the game on a canvas. Callbacks: onHud({ timeLeft, score, combo, level }) a few times a
 * second, onEvent(text) for each outcome (for a live region), onEnd(results) when the match ends.
 */
export function createVisionTest(canvas, { onHud, onEvent, onEnd, reducedMotion = false }) {
  const ctx = canvas.getContext('2d')
  const fog = document.createElement('canvas')
  const fctx = fog.getContext('2d')
  const sound = createSound()
  let W = 0
  let H = 0
  let dpr = 1
  let scale = 1
  let ox = 0
  let oy = 0
  let tall = false

  let S = null // the match
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
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = Math.max(1, Math.round(r.width))
    H = Math.max(1, Math.round(r.height))
    canvas.width = W * dpr
    canvas.height = H * dpr
    fog.width = W * dpr
    fog.height = H * dpr
    tall = H / W > 1.15
    const view = tall ? TALL_VIEW : WIDE_VIEW
    scale = Math.min(W / (view.right - view.left), H / (view.bottom - view.top))
    ox = W / 2
    oy = H / 2 - ((view.top + view.bottom) / 2) * scale
    if (!S) drawIdle()
  }
  const sx = (x) => ox + x * scale
  const sy = (y) => oy + y * scale
  const toWorld = (px, py) => ({ x: (px - ox) / scale, y: (py - oy) / scale })

  // ---------- The match ----------

  function newMatch() {
    return {
      clock: 0,
      timeLeft: MATCH_SECONDS,
      score: 0,
      streak: 0,
      level: 1,
      head: 0,
      cone: 55 * DEG,
      zone: 'front',
      checks: [], // match times of each shoulder check
      round: null,
      gap: 0.6, // pause before the next round
      slow: 0, // seconds of slow motion left (real time)
      shake: 0,
      toasts: [],
      ended: false,
      stats: { rounds: 0, completed: 0, intercepted: 0, tackled: 0, misplaced: 0, heavy: 0, pressSeen: 0, decisions: [], checksBefore: [] },
    }
  }

  function newRound() {
    const L = S.level
    const passer = { x: rand(-7, 7), y: rand(9, 12) }
    // Forward teammates, spread across the pitch ahead.
    const count = L >= 3 ? 4 : 3
    const spread = tall ? 60 : 78
    const angles = []
    while (angles.length < count) {
      const a = rand(-spread, spread)
      if (angles.every((b) => Math.abs(a - b) > (tall ? 22 : 26))) angles.push(a)
    }
    angles.sort((a, b) => a - b)
    const mates = angles.map((a, i) => {
      const d = tall ? rand(8, 14) : rand(9, 17)
      const runs = Math.random() < 0.6
      const dir = rand(0, Math.PI * 2)
      const speed = rand(1.5, 3.5)
      return {
        n: i + 1,
        x: Math.sin(a * DEG) * d,
        y: -Math.cos(a * DEG) * d,
        vx: runs ? Math.cos(dir) * speed : 0,
        vy: runs ? Math.sin(dir) * speed * 0.6 : 0,
        runFrom: rand(0.3, 1.5),
        runFor: rand(0.8, 2.2),
        seen: null,
      }
    })
    const passAt = rand(1.2, 1.8)
    // One lane is open; a defender shadows every other lane. From level 2, the cover can switch
    // after the pass is played, so an early look may be out of date by the time the ball arrives.
    let open = Math.floor(Math.random() * count)
    const blockers = mates.map((m, i) => (i === open ? null : { lane: i, f: rand(0.42, 0.68), side: rand(-0.35, 0.35) }))
    const switchChance = [0, 0, 0.35, 0.55, 0.7][Math.min(L, 4)]
    let switchAt = null
    let switchFrom = null
    if (Math.random() < switchChance) {
      const covered = blockers.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)
      switchFrom = covered[Math.floor(Math.random() * covered.length)]
      switchAt = passAt + rand(0.25, 0.6)
    }
    const opps = blockers.filter(Boolean).map((b) => {
      const m = mates[b.lane]
      return { lane: b.lane, f: b.f, side: b.side, x: m.x * b.f, y: m.y * b.f, seen: null }
    })
    // Midfield wanderers from level 3, kept clear of the open lane.
    if (L >= 3) for (let i = 0; i < Math.min(2, L - 2); i++) opps.push({ wander: true, x: tall ? rand(-10, 10) : rand(-14, 14), y: rand(-16, -6), vx: rand(-1.5, 1.5), vy: rand(-1, 1), seen: null })
    // The presser starts behind you, on one side, and comes at you once the pass is played.
    const side = Math.random() < 0.5 ? -1 : 1
    const pa = side * rand(115, 165) * DEG
    const pd = rand(8.5, 11)
    const presser = {
      x: Math.sin(pa) * pd,
      y: -Math.cos(pa) * pd,
      speed: Math.min(7.6, 5.2 + 0.45 * (L - 1)),
      startAt: passAt + rand(0, 0.25),
      seen: null,
      seenBeforeBall: false,
    }
    S.stats.rounds++
    return {
      t: 0,
      phase: 'build',
      passer,
      passAt,
      mates,
      opps,
      open,
      switchAt,
      switchFrom,
      presser,
      ball: { x: passer.x, y: passer.y },
      ballSeenAt: -9,
      receivedAt: null,
      readyAt: null,
      pass: null,
      result: null,
      resultAt: null,
    }
  }

  const visible = (e) => {
    const d = Math.hypot(e.x, e.y)
    if (d <= NEAR) return true
    return Math.abs(wrap(angleOf(e.x, e.y) - S.head)) <= S.cone
  }

  function toast(text, x, y, color = COLORS.bone, big = false) {
    S.toasts.push({ text, x, y, color, big, age: 0 })
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
    // The presser comes once the pass is played.
    const P = R.presser
    if (R.t >= P.startAt && R.phase !== 'over') {
      const d = Math.hypot(P.x, P.y)
      const mv = Math.min(d, P.speed * dt)
      P.x -= (P.x / d) * mv
      P.y -= (P.y / d) * mv
    }

    // What you can see now becomes what you remember.
    for (const e of [...R.mates, ...R.opps, P]) if (visible(e)) e.seen = { x: e.x, y: e.y, at: S.clock }
    if (R.phase === 'build' || R.phase === 'incoming') {
      if (visible(P)) P.seenBeforeBall = true
    }

    // The ball: played in from behind, then yours, then your pass.
    const B = R.ball
    if (R.phase === 'build' && R.t >= R.passAt) {
      R.phase = 'incoming'
      sound.play('pass')
    }
    if (R.phase === 'incoming') {
      const d = Math.hypot(B.x, B.y)
      if (visible(B)) R.ballSeenAt = R.t
      const mv = Math.min(d, BALL_SPEED * dt)
      B.x -= (B.x / d) * mv
      B.y -= (B.y / d) * mv
      if (d - mv < 0.7) receive()
    } else if (R.phase === 'onball') {
      if (Math.hypot(P.x, P.y) < 1.05) {
        S.stats.tackled++
        S.streak = 0
        S.shake = reducedMotion ? 0 : 0.35
        sound.play('bad')
        toast('Tackled', 0, -1.5, COLORS.danger, true)
        if (!P.seenBeforeBall) toast('Check your shoulder before the ball arrives', 0, 1.6, COLORS.bone)
        finishRound('tackled', 'Tackled. The presser came from your blind side.')
      }
    } else if (R.phase === 'passing') {
      const p = R.pass
      const d = Math.hypot(p.to.x - B.x, p.to.y - B.y)
      const mv = Math.min(d, PASS_SPEED * dt)
      B.x += ((p.to.x - B.x) / (d || 1)) * mv
      B.y += ((p.to.y - B.y) / (d || 1)) * mv
      const thief = [...R.opps, P].find((o) => Math.hypot(o.x - B.x, o.y - B.y) < 0.95)
      if (thief) {
        S.stats.intercepted++
        S.streak = 0
        sound.play('bad')
        toast('Intercepted', thief.x, thief.y - 1.4, COLORS.danger, true)
        finishRound('intercepted', 'Intercepted. That lane was covered.')
      } else if (d - mv < 0.4) {
        const mate = p.mate
        if (mate && Math.hypot(mate.x - B.x, mate.y - B.y) < 1.9) complete(mate)
        else {
          S.stats.misplaced++
          S.streak = 0
          sound.play('bad')
          toast('They had moved', B.x, B.y - 1.4, COLORS.danger, true)
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
    if (!clean) {
      S.stats.heavy++
      toast('Heavy touch: watch it in', 0, 1.6, COLORS.bone)
    }
    if (R.presser.seenBeforeBall) S.stats.pressSeen++
    S.stats.checksBefore.push(S.checks.filter((c) => c > S.clock - 3).length)
    S.slow = reducedMotion ? 0 : 0.55
    sound.play('receive')
  }

  function complete(mate) {
    const R = S.round
    const decision = Math.max(0, R.pass.at - R.readyAt)
    const checks = S.stats.checksBefore[S.stats.checksBefore.length - 1] || 0
    const base = 100 + Math.round(Math.max(0, 60 - 50 * decision)) + 15 * Math.min(4, checks) + (R.presser.seenBeforeBall ? 20 : 0)
    const mult = 1 + 0.1 * Math.min(S.streak, 10)
    const points = Math.round(base * mult)
    S.score += points
    S.streak++
    S.stats.completed++
    S.stats.decisions.push(decision)
    S.level = 1 + Math.floor(S.stats.completed / 3)
    sound.play('good')
    toast(`+${points}`, mate.x, mate.y - 1.6, COLORS.volt, true)
    if (checks >= 2) toast(`${checks} checks before the ball`, 0, 1.6, COLORS.volt)
    finishRound('complete', `Pass completed. ${points} points.`)
  }

  /** A pass towards a point on screen: to a teammate you can see, or one you remember. */
  function passTo(world) {
    const R = S?.round
    if (!R || R.phase !== 'onball' || R.t < R.readyAt) return
    let best = null
    for (const m of R.mates) {
      const vis = visible(m)
      const at = vis ? m : m.seen && S.clock - m.seen.at < MEMORY ? m.seen : null
      if (!at) continue
      const d = Math.hypot(at.x - world.x, at.y - world.y)
      if (d < 3.2 && (!best || d < best.d)) best = { d, mate: m, to: { x: at.x, y: at.y }, vis }
    }
    if (!best) {
      toast('Pass to a teammate you can see or remember', 0, 1.6, COLORS.bone)
      return
    }
    // A visible runner is played into their path (for as much of the ball's flight as they will still
    // be running); a memory gets the ball where it was.
    const to = { ...best.to }
    if (best.vis) {
      const m = best.mate
      const flight = Math.hypot(to.x, to.y) / PASS_SPEED
      const running = Math.max(0, Math.min(R.t + flight, m.runFrom + m.runFor) - Math.max(R.t, m.runFrom))
      to.x = (tall ? clampTallX : clampX)(to.x + m.vx * running)
      to.y = clampY(to.y + m.vy * running)
    }
    R.pass = { to, mate: best.mate, at: R.t }
    R.phase = 'passing'
    sound.play('pass')
  }

  function passToNumber(n) {
    const m = S?.round?.mates.find((x) => x.n === n)
    if (!m) return
    const at = visible(m) ? m : m.seen
    if (at) passTo({ x: at.x, y: at.y })
  }

  function passToCentre() {
    const R = S?.round
    if (!R) return
    let best = null
    for (const m of R.mates) {
      const at = visible(m) ? m : m.seen && S.clock - m.seen.at < MEMORY ? m.seen : null
      if (!at) continue
      const off = Math.abs(wrap(angleOf(at.x, at.y) - S.head))
      if (!best || off < best.off) best = { off, at }
    }
    if (best) passTo(best.at)
  }

  // ---------- Drawing ----------

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
    // The edge of the box ahead.
    ctx.strokeRect(sx(-20.16), sy(-52.5), 40.32 * scale, 16.5 * scale)
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
    if (age <= 0.05 || age > MEMORY) return
    ctx.save()
    ctx.globalAlpha = 0.6 * (1 - age / MEMORY)
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
    for (const [spread, a] of [[1.12, 0.35], [1.0, 0.45], [0.86, 0.6]]) {
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

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.save()
    if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake * 16, (Math.random() - 0.5) * S.shake * 16)
    drawPitch()
    drawGaze()
    drawLines(0.5)
    const R = S.round
    if (R) {
      // Only what you can see right now is drawn under the light.
      ctx.save()
      ctx.shadowColor = 'rgba(215,255,58,0.55)'
      for (const m of R.mates) if (visible(m)) disc(m.x, m.y, 0.6, COLORS.volt, null, String(m.n))
      ctx.restore()
      if (visible(R.passer)) disc(R.passer.x, R.passer.y, 0.6, COLORS.volt, null, '')
      for (const o of R.opps) if (visible(o)) disc(o.x, o.y, 0.55, null, COLORS.bone)
      if (visible(R.presser)) disc(R.presser.x, R.presser.y, 0.6, null, COLORS.danger)
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
      if (!visible(R.presser)) ghost(R.presser, COLORS.danger, 0.6)
      // The call: a teammate shouting as they play it in, so you know which way to look for the ball.
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
    // Toasts.
    for (const t of S.toasts) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - t.age / 1.3)
      ctx.fillStyle = t.color
      ctx.font = `${t.big ? 900 : 700} ${Math.max(t.big ? 16 : 11, scale * (t.big ? 1.5 : 0.85))}px Archivo, sans-serif`
      ctx.fontStretch = t.big ? 'expanded' : 'normal'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(t.big ? t.text.toUpperCase() : t.text, Math.max(80, Math.min(W - 80, sx(t.x))), sy(t.y) - t.age * 18)
      ctx.restore()
    }
    ctx.restore()
  }

  function drawIdle() {
    if (!W) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawPitch()
    drawLines(0.35)
    disc(0, 0, 0.7, COLORS.volt, '#ffffff')
  }

  // ---------- The loop ----------

  function frame(now) {
    raf = requestAnimationFrame(frame)
    const real = Math.min(0.05, (now - last) / 1000 || 0)
    last = now
    if (paused || !S || S.ended) return
    const timeScale = S.slow > 0 ? 0.35 : 1
    S.slow = Math.max(0, S.slow - real)
    S.shake = Math.max(0, S.shake - real)
    const dt = real * timeScale
    S.clock += dt
    const before = Math.ceil(S.timeLeft)
    S.timeLeft = Math.max(0, S.timeLeft - dt)
    if (S.timeLeft <= 5 && Math.ceil(S.timeLeft) < before) sound.play('tick')
    for (const t of S.toasts) t.age += real
    S.toasts = S.toasts.filter((t) => t.age < 1.3)

    if (!S.round || S.round.phase === 'over') {
      S.gap -= real
      if (S.gap <= 0) {
        if (S.timeLeft <= 0) return end()
        S.round = newRound()
      }
    } else if (S.timeLeft <= 0 && S.round.phase !== 'passing') {
      return end()
    }
    step(dt)
    draw()
    if (now - hudAt > 120) {
      hudAt = now
      onHud?.({ timeLeft: S.timeLeft, score: S.score, combo: 1 + 0.1 * Math.min(S.streak, 10), level: S.level })
    }
  }

  function end() {
    S.ended = true
    sound.play('whistle')
    const st = S.stats
    const played = MATCH_SECONDS - S.timeLeft
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
    onHud?.({ timeLeft: 0, score: S.score, combo: 1, level: S.level })
    onEnd?.({
      score: S.score,
      level: S.level,
      rounds: st.rounds,
      completed: st.completed,
      intercepted: st.intercepted,
      tackled: st.tackled,
      misplaced: st.misplaced,
      heavyTouches: st.heavy,
      scansPerSecond: S.checks.length / Math.max(1, played),
      checksBeforeBall: avg(st.checksBefore),
      pressSpotted: st.checksBefore.length ? st.pressSeen / st.checksBefore.length : 0,
      decisionSeconds: avg(st.decisions),
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

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('keydown', keydown)
  canvas.addEventListener('keyup', keyup)
  document.addEventListener('visibilitychange', onVisibility)
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()
  last = performance.now()
  raf = requestAnimationFrame(frame)

  return {
    start() {
      sound.unlock()
      S = newMatch()
      pointer.x = null
      sound.play('whistle')
      canvas.focus({ preventScroll: true })
    },
    setMuted: (m) => sound.setMuted(m),
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('keydown', keydown)
      canvas.removeEventListener('keyup', keyup)
      document.removeEventListener('visibilitychange', onVisibility)
      sound.close()
    },
    // For tests: a read-only look at the match.
    peek: () => S && { phase: S.round?.phase, level: S.level, score: S.score, head: S.head, checks: S.checks.length, ended: S.ended, round: S.round },
  }
}
