// Target formations for the particle story. Each one is N positions plus a "kind" per particle
// (which decides its colour): 0 line, 1 white, 2 volt, 3 volt stream, 4 faint dust.
// Particle i keeps its index across formations, so the shader can morph A → B → C → D → E.

export const KIND = { LINE: 0, WHITE: 1, VOLT: 2, STREAM: 3, DUST: 4 }

// Pitch coordinates are metres (x across, z along; our team attacks towards -z), scaled into the scene.
export const PITCH_SCALE = 0.16
const P = (x, z, y = 0) => [x * PITCH_SCALE, y, z * PITCH_SCALE]

// The play from the scroll story: the pivot is pressed from the blind side, two passes are
// blocked, the pass into the midfielder is on, and the striker runs in behind.
export const PLAY = {
  usBefore: { lcb: [-9, 15], rcb: [9, 15], pivot: [0, 6], lw: [-15, -3], am: [3, -5.5], rw: [15, -5], st: [2, -15] },
  usAfter: { lcb: [-9, 13], rcb: [9, 13], pivot: [0, 5], lw: [-15, -6], am: [3.5, -8], rw: [15, -8], st: [-9, -22] },
  themBefore: { d1: [-7, 1], d2: [8, -1], press: [-6, 7.5], lb: [-12, -14], cb1: [-1, -17], cb2: [5, -17], rb: [12, -13], gk: [0, -27.5] },
  themAfter: { d1: [-6, -1], d2: [7, -3], press: [-2.3, 6.2], lb: [-12, -16], cb1: [-3.5, -18.5], cb2: [4, -19], rb: [12, -15], gk: [-1.5, -27] },
}

/** Bezier control points (scene units) for the flowing pass: pivot → midfielder → striker's run. */
export const PASS_PATHS = [
  [P(0, 6, 0.05), P(4, -0.5, 0.05), P(3.5, -8, 0.05)],
  [P(3.5, -8, 0.05), P(-1, -17, 0.05), P(-9, -22, 0.05)],
]

function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// ---------- A: the ball ----------

const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2
  return [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => {
    const l = Math.hypot(...v)
    return v.map((c) => c / l)
  })
})()

// Centres of the 20 hexagons: the icosahedron's face centres.
const HEX = (() => {
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ]
  return faces.map(([a, b, c]) => {
    const v = [0, 1, 2].map((k) => ICO[a][k] + ICO[b][k] + ICO[c][k])
    const l = Math.hypot(...v)
    return v.map((x) => x / l)
  })
})()

export function ballShape(n, radius) {
  const pos = new Float32Array(n * 3)
  const kind = new Float32Array(n)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    // Fibonacci sphere: an even spread of points over the surface.
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const a = golden * i
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    pos.set([x * radius, y * radius, z * radius], i * 3)
    // Nearest panel centre, with pentagons biased smaller, like the real 32-panel ball.
    let best = -2
    let second = -2
    let owner = 'hex'
    const consider = (v, bias, type) => {
      const d = v[0] * x + v[1] * y + v[2] * z - bias
      if (d > best) {
        second = best
        best = d
        owner = type
      } else if (d > second) second = d
    }
    for (const v of ICO) consider(v, 0.035, 'pent')
    for (const v of HEX) consider(v, 0, 'hex')
    // Points right on a boundary become the dark seams that outline every panel.
    if (best - second < 0.014) kind[i] = KIND.DUST
    else kind[i] = owner === 'pent' ? KIND.VOLT : KIND.WHITE
  }
  return { pos, kind }
}

// ---------- Drawing type and marks into points ----------

const INK_W = 1400
const INK_H = 360

function inkCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = INK_W
  canvas.height = INK_H
  const ctx = canvas.getContext('2d')
  ctx.font = '900 230px Archivo'
  ctx.fontStretch = 'expanded'
  ctx.textBaseline = 'middle'
  return ctx
}

/**
 * Turns what was drawn on an ink canvas into n points: 86% on the ink (volt where it was drawn in
 * volt), the rest as dust around it. `depth` gives the letters thickness, so they read as solid
 * shapes when the camera moves past them.
 */
function sampleInk(n, ctx, rand, depth) {
  const img = ctx.getImageData(0, 0, INK_W, INK_H).data
  const filled = []
  for (let y = 0; y < INK_H; y += 2) {
    for (let x = 0; x < INK_W; x += 2) {
      const o = (y * INK_W + x) * 4
      if (img[o + 3] > 128) filled.push([x, y, img[o + 2] < 120])
    }
  }
  const pos = new Float32Array(n * 3)
  const kind = new Float32Array(n)
  const onInk = Math.floor(n * 0.86)
  const scale = 11 / INK_W
  for (let i = 0; i < n; i++) {
    if (i < onInk && filled.length) {
      const [x, y, volt] = filled[Math.floor(rand() * filled.length)]
      pos.set([(x - INK_W / 2) * scale + (rand() - 0.5) * 0.02, -(y - INK_H / 2) * scale, (rand() - 0.5) * depth], i * 3)
      kind[i] = volt ? KIND.VOLT : KIND.WHITE
    } else {
      pos.set([(rand() - 0.5) * 16, (rand() - 0.5) * 7, (rand() - 0.5) * 4], i * 3)
      kind[i] = KIND.DUST
    }
  }
  return { pos, kind }
}

// ---------- B: the word ----------

/** "THINK." set in the display face, with the full stop in volt, as in the hero headline. */
export function wordShape(n, seed = 5) {
  const ctx = inkCanvas()
  ctx.font = '900 250px Archivo'
  ctx.fontStretch = 'expanded'
  const word = 'THINK'
  const wordW = ctx.measureText(word).width
  const x = (INK_W - ctx.measureText(`${word}.`).width) / 2
  ctx.fillStyle = '#ffffff'
  ctx.fillText(word, x, INK_H / 2 + 8)
  ctx.fillStyle = '#d7ff3a'
  ctx.fillText('.', x + wordW, INK_H / 2 + 8)
  return sampleInk(n, ctx, rng(seed), 0.6)
}

// ---------- C and D: the pitch and the play ----------

function pitchSegments() {
  const W = 20
  const L = 30
  const segs = []
  const line = (x1, z1, x2, z2) => segs.push({ type: 'line', x1, z1, x2, z2, len: Math.hypot(x2 - x1, z2 - z1) })
  const arc = (cx, cz, r, a0, a1) => segs.push({ type: 'arc', cx, cz, r, a0, a1, len: Math.abs(a1 - a0) * r })
  line(-W, -L, W, -L)
  line(W, -L, W, L)
  line(W, L, -W, L)
  line(-W, L, -W, -L)
  line(-W, 0, W, 0)
  arc(0, 0, 6, 0, Math.PI * 2)
  for (const s of [-1, 1]) {
    const g = s * L
    line(-12, g, -12, g - s * 10)
    line(-12, g - s * 10, 12, g - s * 10)
    line(12, g - s * 10, 12, g)
    line(-5, g, -5, g - s * 4)
    line(-5, g - s * 4, 5, g - s * 4)
    line(5, g - s * 4, 5, g)
    // The D at the top of each box.
    const cz = g - s * 8
    arc(0, cz, 6, s > 0 ? Math.PI + 0.93 : 0.93, s > 0 ? 2 * Math.PI - 0.93 : Math.PI - 0.93)
  }
  return segs
}

function samplePitchLines(count, rand) {
  const segs = pitchSegments()
  const total = segs.reduce((s, g) => s + g.len, 0)
  const out = []
  for (let i = 0; i < count; i++) {
    let d = rand() * total
    let g = segs[0]
    for (const s of segs) {
      if (d <= s.len) {
        g = s
        break
      }
      d -= s.len
    }
    const t = d / g.len
    const jitter = () => (rand() - 0.5) * 0.12
    if (g.type === 'line') out.push(P(g.x1 + (g.x2 - g.x1) * t + jitter(), g.z1 + (g.z2 - g.z1) * t + jitter()))
    else {
      const a = g.a0 + (g.a1 - g.a0) * t
      out.push(P(g.cx + Math.cos(a) * g.r + jitter(), g.cz + Math.sin(a) * g.r + jitter()))
    }
  }
  return out
}

// A solid disc of points for our players, a ring for theirs.
const disc = (x, z, rand) => {
  const r = Math.sqrt(rand()) * 0.75
  const a = rand() * Math.PI * 2
  return P(x + Math.cos(a) * r, z + Math.sin(a) * r, 0.05)
}
const ring = (x, z, rand) => {
  const r = 0.62 + (rand() - 0.5) * 0.14
  const a = rand() * Math.PI * 2
  return P(x + Math.cos(a) * r, z + Math.sin(a) * r, 0.05)
}

/**
 * Allocation (fractions of n), identical for C and D so lines and players hold still while the play moves:
 * [lines 0.36][our players 0.1][their players 0.09][lanes 0.06][dust: the rest]
 */
function boardLayout(n) {
  const lines = Math.floor(n * 0.36)
  const ours = Math.floor(n * 0.1)
  const theirs = Math.floor(n * 0.09)
  const lanes = Math.floor(n * 0.06)
  return { lines, ours, theirs, lanes, dust: n - lines - ours - theirs - lanes }
}

function boardShape(n, after, seed) {
  const rand = rng(seed)
  const pos = new Float32Array(n * 3)
  const kind = new Float32Array(n)
  const u = new Float32Array(n)
  const L = boardLayout(n)
  let i = 0
  const put = (p, k, uu = 0) => {
    pos.set(p, i * 3)
    kind[i] = k
    u[i] = uu
    i++
  }
  for (const p of samplePitchLines(L.lines, rand)) put(p, KIND.LINE)

  const us = Object.values(after ? PLAY.usAfter : PLAY.usBefore)
  for (let k = 0; k < L.ours; k++) {
    const [x, z] = us[k % us.length]
    put(disc(x, z, rand), KIND.VOLT)
  }
  const them = Object.values(after ? PLAY.themAfter : PLAY.themBefore)
  for (let k = 0; k < L.theirs; k++) {
    const [x, z] = them[k % them.length]
    put(ring(x, z, rand), KIND.WHITE)
  }

  // Lanes. Before the pass: two blocked lanes (white, stopping at the defender) and the open one (volt).
  // During the pass, these particles join the flowing stream instead.
  const lanePts = L.lanes + (after ? Math.floor(L.dust * 0.12) : 0)
  for (let k = 0; k < L.lanes; k++) {
    if (after) {
      put([0, 0, 0], KIND.STREAM, k / L.lanes)
      continue
    }
    const which = k % 3
    const t = rand()
    const from = PLAY.usBefore.pivot
    const to = which === 0 ? PLAY.themBefore.d1 : which === 1 ? PLAY.themBefore.d2 : PLAY.usBefore.am
    const stop = which === 2 ? 0.86 : 0.8
    const x = from[0] + (to[0] - from[0]) * (0.12 + t * (stop - 0.12))
    const z = from[1] + (to[1] - from[1]) * (0.12 + t * (stop - 0.12))
    // Dashed: skip every other metre.
    const dashed = Math.floor(t * 18) % 2 === 0
    put(P(x, z, 0.05), which === 2 ? KIND.VOLT : dashed ? KIND.WHITE : KIND.DUST)
  }

  // Dust over the turf. During the pass, part of it joins the stream too.
  const streamFromDust = lanePts - L.lanes
  for (let k = 0; i < n; k++) {
    if (after && k < streamFromDust) {
      put([0, 0, 0], KIND.STREAM, rand())
      continue
    }
    put(P((rand() - 0.5) * 44, (rand() - 0.5) * 64, rand() * 0.4), KIND.DUST)
  }
  return { pos, kind, u }
}

export const pitchShape = (n) => boardShape(n, false, 9)
export const playShape = (n) => boardShape(n, true, 9)

// ---------- E: the wordmark ----------

export function wordmarkShape(n, seed = 13) {
  const ctx = inkCanvas()
  // Mark: lens ring in white, V in volt; then the name.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 26
  ctx.beginPath()
  ctx.arc(170, 180, 125, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#d7ff3a'
  ctx.lineWidth = 40
  ctx.beginPath()
  ctx.moveTo(105, 120)
  ctx.lineTo(170, 245)
  ctx.lineTo(235, 120)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.fillText('VISION', 345, 192)
  return sampleInk(n, ctx, rng(seed), 0.12)
}

/** Where every particle starts before the intro: a wide, deep cloud it flies in from. */
export function scatterShape(n, seed = 21) {
  const rand = rng(seed)
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const r = 8 + rand() * 18
    const a = rand() * Math.PI * 2
    const b = Math.acos(2 * rand() - 1)
    pos.set([Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r * 0.6, Math.sin(b) * Math.sin(a) * r - 6], i * 3)
  }
  return pos
}
