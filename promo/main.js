// Renders the promo film: the site's particle story re-cut as a 33-second ad, with title cards, sound
// design and an MP4 at the end. Every frame is computed from its own timestamp, so the render is smooth
// and repeatable however long each frame takes. Every line on screen is a fact from shared/academy.js.
// Driven by scripts/render-promo.mjs (npm run promo); see "The promo film" in the README.
import * as THREE from 'three'
import { BloomEffect, EffectComposer, EffectPass, RenderPass, VignetteEffect } from 'postprocessing'
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { academy } from '../shared/academy.js'
import { MAX_TRAILS, buildGeometry, createMaterials, createUniforms } from '../src/three/particles'
import '../src/styles/base.css'

export const DURATION = 33.5
const FPS = 30
const VOLT = '#d7ff3a'
const BONE = '#f2f2ee'
const SMOKE = '#b8b8b2'
const VOID = '#060607'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (v) => v * v * (3 - 2 * v)
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3)
/** 0 → 1 as t goes from a to b, eased. */
const span = (t, a, b) => smooth(clamp01((t - a) / (b - a)))
/** A hit that rises fast and falls away over `len` seconds. */
const hit = (age, len) => (age < 0 || age > len * 6 ? 0 : Math.min(1, age / 0.06) * Math.exp(-age / len))

// ---------- The timeline ----------

const BURST = 5.6 // the ball bursts
const LAND = 29.9 // the wordmark lands

/** Piecewise eased keys: [[time, value], …]. */
const keyed = (keys) => (t) => {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i]
    const [t1, v1] = keys[i + 1]
    if (t <= t1) return v0 + (v1 - v0) * smooth(clamp01((t - t0) / (t1 - t0)))
  }
  return keys[keys.length - 1][1]
}
// Formations: 0 ball · 1 the word THINK. · 2 pitch and players · 3 the pass · 4 wordmark.
const stageAt = keyed([[0, 0], [5.55, 0], [6.9, 1], [9.6, 1], [11.4, 2], [14, 2], [15.2, 3], [27.6, 3], [29.9, 4], [99, 4]])
const slowAt = (t) => span(t, 15, 15.4) * (1 - span(t, 17.8, 18.4))

// The scene's own clock runs at quarter speed through the slow-motion pass.
const warp = (() => {
  const step = 1 / 240
  const n = Math.ceil((DURATION + 2) / step)
  const acc = new Float64Array(n + 1)
  for (let i = 1; i <= n; i++) acc[i] = acc[i - 1] + (1 - 0.75 * slowAt(i * step)) * step
  return (t) => {
    const x = Math.max(0, t) / step
    const i = Math.min(Math.floor(x), n - 1)
    return acc[i] + (acc[i + 1] - acc[i]) * (x - i)
  }
})()

function storyAt(t) {
  const time = warp(t)
  return { stage: stageAt(t), time, stream: time, spin: time * 0.32, intro: easeOut((t - 2.2) / 3) }
}

// ---------- The camera ----------

// Monotone cubic interpolation (Fritsch–Carlson): smooth through every key, never overshooting one.
function monotone(xs, ys) {
  const n = xs.length
  const h = []
  const s = []
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i]
    s[i] = (ys[i + 1] - ys[i]) / h[i]
  }
  const m = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1]
      const w2 = h[i] + 2 * h[i - 1]
      m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i])
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const t = (x - xs[i]) / h[i]
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1]
  }
}

// Shots keyed by time. back/drop/dz reframe for the vertical (9:16) cut, as on a phone.
const SHOTS = [
  { t: 0, shift: -4.2, pos: [0, 0.3, 22], at: [0, 0, 0], fov: 38, roll: 0, dof: 0.2, back: 1.75, drop: -1.6, dz: 0 },
  { t: 2.2, shift: -4.2, pos: [0, 0.3, 18], at: [0, 0, 0], fov: 38, roll: 0, dof: 0.2, back: 1.75, drop: -1.6, dz: 0 },
  { t: 5.4, shift: -3.6, pos: [0.4, 0.1, 11.5], at: [0, -0.1, 0], fov: 38, roll: -0.02, dof: 0.2, back: 1.7, drop: -1.6, dz: 0 },
  { t: 5.9, pos: [0.1, 0.05, 4.2], at: [0, 0, -2], fov: 52, roll: 0.12, dof: 0.45, back: 1.2, drop: 0, dz: 0 },
  { t: 6.3, pos: [0, 0.1, 2.9], at: [0, 0, -3], fov: 58, roll: 0.2, dof: 0.55, back: 1.2, drop: 0, dz: 0 },
  { t: 7.2, pos: [0, 0.25, 13.5], at: [0, 0, 0], fov: 40, roll: 0, dof: 0.25, back: 2.1, drop: -2.6, dz: 0 },
  { t: 9.6, pos: [-1.1, 0.6, 12.4], at: [0, 0, 0], fov: 40, roll: 0.02, dof: 0.3, back: 2.1, drop: -2.6, dz: 0 },
  { t: 10.6, pos: [3.4, 1.4, 7.2], at: [0, 0, -1.2], fov: 48, roll: -0.1, dof: 0.6, back: 1.5, drop: 0, dz: 0.8 },
  { t: 11.6, shift: -3, pos: [0, 10.5, 6.2], at: [0, 0, -0.4], fov: 38, roll: 0, dof: 0.12, back: 1.75, drop: 0, dz: 2.2 },
  { t: 14, shift: -3, pos: [0.9, 10.2, 5.8], at: [0, 0, -0.4], fov: 38, roll: 0, dof: 0.12, back: 1.75, drop: 0, dz: 2.2 },
  { t: 14.8, shift: -1.5, pos: [2.3, 1.6, 2.5], at: [0.3, 0, -0.6], fov: 46, roll: -0.06, dof: 0.5, back: 1.4, drop: 0, dz: 0.8 },
  { t: 18.2, shift: -1.2, pos: [1.3, 1.1, -1.5], at: [-1, 0, -3.6], fov: 46, roll: -0.04, dof: 0.5, back: 1.4, drop: 0, dz: 0.8 },
  { t: 21, pos: [6, 7, 6], at: [0, 0, -1], fov: 40, roll: 0, dof: 0.3, back: 1.6, drop: 0, dz: 1.5 },
  { t: 27.6, pos: [-5, 6, 7], at: [0, 0, -1], fov: 40, roll: 0, dof: 0.3, back: 1.6, drop: 0, dz: 1.5 },
  { t: 29.9, pos: [0, 0, 15.5], at: [0, 0, 0], fov: 38, roll: 0, dof: 0.1, back: 2.6, drop: -3.4, dz: 0 },
  { t: DURATION, pos: [0, 0, 14.2], at: [0, 0, 0], fov: 38, roll: 0, dof: 0.1, back: 2.6, drop: -3.4, dz: 0 },
]
const PATH = (() => {
  const xs = SHOTS.map((s) => s.t)
  const ch = (get) => monotone(xs, SHOTS.map(get))
  const c = { pos: [0, 1, 2].map((k) => ch((s) => s.pos[k])), at: [0, 1, 2].map((k) => ch((s) => s.at[k])) }
  for (const key of ['fov', 'roll', 'dof', 'back', 'drop', 'dz']) c[key] = ch((s) => s[key])
  c.shift = ch((s) => s.shift ?? 0)
  return c
})()

// ---------- The 3D scene ----------

function starField(count) {
  const pos = new Float32Array(count * 3)
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < count; i++) {
    const r = 30 + rand() * 40
    const a = rand() * Math.PI * 2
    const b = Math.acos(2 * rand() - 1)
    pos.set([Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.09, color: '#8a8a86', transparent: true, opacity: 0.55, depthWrite: false }))
}

async function createScene(W, H, portrait) {
  const glCanvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false })
  renderer.setPixelRatio(1)
  renderer.setSize(W, H, false)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(VOID)
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 300)
  const uniforms = createUniforms()
  const materials = createMaterials(uniforms)
  for (let k = 1; k <= MAX_TRAILS; k++) materials[k].uniforms.uTrail.value = k / MAX_TRAILS
  uniforms.uInteract.value = 0
  // Points are sized as they are on the site at the matching screen shape.
  uniforms.uSize.value = portrait ? 78 : 44
  uniforms.uPixelRatio.value = portrait ? H / 844 : H / 900
  const geometry = await buildGeometry(26000)
  for (const m of materials) {
    const points = new THREE.Points(geometry, m)
    points.frustumCulled = false
    scene.add(points)
  }
  scene.add(starField(1600))
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new BloomEffect({ mipmapBlur: true, intensity: 0.95, luminanceThreshold: 0.18, luminanceSmoothing: 0.4, radius: 0.72 })
  composer.addPass(new EffectPass(camera, bloom, new VignetteEffect({ offset: 0.2, darkness: 0.85 })))
  return { W, H, portrait, glCanvas, camera, uniforms, composer, bloom }
}

function renderScene(s, t) {
  const u = s.uniforms
  const now = storyAt(t)
  const lag = storyAt(t - 0.16)
  u.uStage.value = now.stage
  u.uTime.value = now.time
  u.uStream.value = now.stream
  u.uIntro.value = now.intro
  u.uSpin.value = now.spin
  u.uStageLag.value = lag.stage
  u.uTimeLag.value = lag.time
  u.uStreamLag.value = lag.stream
  u.uIntroLag.value = lag.intro
  u.uSpinLag.value = lag.spin

  const landed = t >= LAND
  const age = landed ? t - LAND : t >= BURST ? t - BURST : 99
  u.uShock.value = landed ? 0.45 : t >= BURST ? 1 : 0
  u.uShockAge.value = age
  u.uShockAt.value.set(landed ? -5 : 0, 0, 0)
  const flash = Math.max(hit(t - BURST, 0.35), 0.8 * hit(t - LAND, 0.45), 0.5 * slowAt(t))
  u.uFlash.value = flash
  s.bloom.intensity = 0.95 + flash * 1.4
  // A light sweep runs down the pitch as it is drawn, and again as the pass plays in slow motion.
  const sweepWindow = (a, len) => (t >= a && t <= a + len ? (t - a) / len : null)
  const sw = sweepWindow(11, 1.4) ?? sweepWindow(15.2, 1.4)
  u.uSweep.value = sw == null ? -99 : 5.5 - sw * 11
  u.uSweepOn.value = sw == null ? 0 : Math.sin(Math.PI * sw)

  const pos = PATH.pos.map((f) => f(t))
  const at = PATH.at.map((f) => f(t))
  if (!s.portrait) {
    const shift = PATH.shift(t)
    pos[0] += shift
    at[0] += shift
  } else {
    const back = PATH.back(t)
    for (let k = 0; k < 3; k++) pos[k] = at[k] + (pos[k] - at[k]) * back
    const drop = PATH.drop(t)
    pos[1] += drop
    at[1] += drop
    const dz = PATH.dz(t)
    pos[2] += dz
    at[2] += dz
  }
  // A slow drift, and a short shake on each hit.
  const shake = Math.max(0.1 * hit(t - BURST, 0.3), 0.14 * hit(t - LAND, 0.35))
  pos[0] += Math.sin(t * 0.15) * 0.35 + Math.sin(t * 41) * shake
  pos[1] += Math.sin(t * 0.21) * 0.2 + Math.sin(t * 37 + 1.3) * shake
  const cam = s.camera
  cam.position.set(...pos)
  cam.up.set(0, 1, 0)
  cam.lookAt(...at)
  cam.rotateZ(PATH.roll(t))
  cam.fov = PATH.fov(t)
  cam.updateProjectionMatrix()
  u.uFocus.value = Math.hypot(pos[0] - at[0], pos[1] - at[1], pos[2] - at[2])
  u.uAperture.value = PATH.dof(t)
  s.composer.render()
}

// ---------- What is drawn over the scene ----------

const google = academy.ratings.find((r) => r.source === 'Google')
const evenings = academy.schedule.filter((d) => d.open).length

function font(size, weight = 900, stretch = 'expanded') {
  return { font: `${weight} ${Math.round(size)}px Archivo`, stretch }
}
function setFont(ctx, f, spacing = 0) {
  ctx.font = f.font
  ctx.fontStretch = f.stretch
  ctx.letterSpacing = `${spacing}px`
}

/**
 * A stack of lines. Each line is a string or { text, volt }. Anchored at (x, y) = top-left (or top-centre).
 * The whole block scales from `scale` around its anchor, for the slow push-in on a hard cut.
 */
function lines(ctx, list, { x, y, size, align = 'left', scale = 1, lead = 0.94, color = BONE, maxWidth = fitWidth(ctx, x, align) }) {
  // Shrink the whole block if its widest line would run past the frame.
  setFont(ctx, font(size), -size * 0.03)
  const widest = Math.max(...list.map((l) => ctx.measureText(typeof l === 'string' ? l : l.text).width))
  if (widest * scale > maxWidth) size *= maxWidth / (widest * scale)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  setFont(ctx, font(size), -size * 0.03)
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  list.forEach((line, i) => {
    const text = typeof line === 'string' ? line : line.text
    ctx.fillStyle = typeof line === 'string' ? color : line.volt ? VOLT : color
    ctx.fillText(text, 0, i * size * lead)
  })
  ctx.restore()
}

/** Room for a line starting at x (or centred on it), keeping the same margin on both sides. */
function fitWidth(ctx, x, align) {
  const W = ctx.canvas.width
  return align === 'center' ? W * 0.86 : W - 2 * x
}

/** Sets a font, shrinking it until the text fits the room it has. */
function fitFont(ctx, text, size, weight, stretch, spacing, maxWidth) {
  setFont(ctx, font(size, weight, stretch), size * spacing)
  const w = ctx.measureText(text).width
  if (w > maxWidth) setFont(ctx, font((size * maxWidth) / w, weight, stretch), ((size * maxWidth) / w) * spacing)
}

function eyebrow(ctx, text, { x, y, size, align = 'left' }) {
  fitFont(ctx, text.toUpperCase(), size, 700, 'normal', 0.3, fitWidth(ctx, x, align))
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillStyle = VOLT
  ctx.fillText(text.toUpperCase(), x, y)
}

function small(ctx, text, { x, y, size, align = 'left', color = SMOKE }) {
  fitFont(ctx, text.toUpperCase(), size, 600, 'normal', 0.24, fitWidth(ctx, x, align))
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.fillText(text.toUpperCase(), x, y)
}

function star(ctx, cx, cy, r) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

// Floodlights flicker on like the site's opening film: on, off, on, dip, on.
function flicker(t, start) {
  const k = (t - start) / 0.8
  if (k < 0) return 0
  const steps = [[0, 0], [0.06, 1], [0.12, 0.15], [0.2, 1], [0.3, 0.45], [0.38, 1]]
  for (let i = steps.length - 1; i >= 0; i--) if (k >= steps[i][0]) return steps[i][1]
  return 0
}

function floodlights(ctx, s, t, level) {
  if (level <= 0) return
  const { W, H, portrait } = s
  const banks = [
    [portrait ? W * 0.14 : W * 0.08, portrait ? H * 0.09 : H * 0.15, flicker(t, 0.25), 1],
    [portrait ? W * 0.86 : W * 0.92, portrait ? H * 0.09 : H * 0.15, flicker(t, 0.55), -1],
  ]
  const unit = portrait ? W * 0.022 : H * 0.022
  for (const [x, y, on, side] of banks) {
    const a = level * (t > 29 ? 1 : on)
    if (a <= 0) continue
    // The beam: soft light falling across the pitch.
    ctx.save()
    ctx.globalAlpha = a
    ctx.filter = `blur(${Math.round(unit * 1.4)}px)`
    const g = ctx.createLinearGradient(x, y, x + side * W * 0.25, y + H * 0.85)
    g.addColorStop(0, 'rgba(242,242,230,0.20)')
    g.addColorStop(0.55, 'rgba(242,242,230,0.05)')
    g.addColorStop(1, 'rgba(242,242,230,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x - unit, y)
    ctx.lineTo(x + unit, y)
    ctx.lineTo(x + side * W * 0.55, y + H * 0.95)
    ctx.lineTo(x + side * W * 0.05, y + H * 0.95)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // The anamorphic flare and the lamp bank itself.
    ctx.save()
    ctx.globalAlpha = a
    const flare = ctx.createLinearGradient(x - W * 0.25, 0, x + W * 0.25, 0)
    flare.addColorStop(0, 'rgba(190,215,255,0)')
    flare.addColorStop(0.5, 'rgba(190,215,255,0.55)')
    flare.addColorStop(1, 'rgba(190,215,255,0)')
    ctx.fillStyle = flare
    ctx.fillRect(x - W * 0.25, y + unit * 0.9, W * 0.5, Math.max(2, unit * 0.08))
    ctx.fillStyle = '#101012'
    ctx.fillRect(x - unit * 2.6, y, unit * 5.2, unit * 2.1)
    ctx.shadowColor = 'rgba(255,255,235,0.9)'
    ctx.shadowBlur = unit * 1.2
    ctx.fillStyle = '#fffef4'
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) ctx.fillRect(x - unit * 2.35 + c * unit * 1.2, y + unit * 0.25 + r * unit * 0.95, unit * 1, unit * 0.65)
    ctx.restore()
  }
}

// The cards: each cuts in hard and holds with a slow push-in.
const push = (t, a, b) => 1.06 - 0.06 * easeOut((t - a) / (b - a))
const on = (t, a, b) => t >= a && t < b

function overlay(ctx, s, t) {
  const { W, H, portrait } = s
  const u = portrait ? W / 100 : H / 100 // one "unit" of type
  const left = portrait ? W * 0.08 : W * 0.07
  const base = portrait ? H * 0.64 : H * 0.6
  const size = portrait ? u * 10.5 : u * 8.6

  // Darken where the words sit, while any card is up.
  const carding = [[0.9, 2.2], [3.4, 5.5], [7.2, 9.6], [11.8, 14], [15.4, 18], [18.2, 27.6]].some(([a, b]) => on(t, a - 0.2, b + 0.2))
  if (carding) {
    const g = portrait ? ctx.createLinearGradient(0, H, 0, H * 0.35) : ctx.createLinearGradient(0, 0, W * 0.7, 0)
    g.addColorStop(0, 'rgba(6,6,7,0.82)')
    g.addColorStop(1, 'rgba(6,6,7,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // 0.9–2.2: the opening title, centred between the floodlights.
  if (on(t, 0.9, 2.2)) lines(ctx, ['EVERY WEEKDAY.', { text: '6 PM.', volt: true }], { x: W / 2, y: H * 0.42 - size, size, align: 'center', scale: push(t, 0.9, 2.2) })
  if (on(t, 3.4, 5.5)) {
    eyebrow(ctx, `${academy.name} · ${academy.city}`, { x: left, y: base - size * 1.9, size: u * 2.3 })
    lines(ctx, ['WHERE PLAYERS', 'LEARN TO', { text: 'THINK.', volt: true }], { x: left, y: base - size * 1.3, size, scale: push(t, 3.4, 5.5) })
  }
  if (on(t, 7.2, 8.4)) lines(ctx, ['COACHES SET', 'THE PROBLEM.'], { x: left, y: base, size, scale: push(t, 7.2, 8.4) })
  if (on(t, 8.4, 9.6)) lines(ctx, ['PLAYERS FIND', { text: 'THE ANSWER.', volt: true }], { x: left, y: base, size, scale: push(t, 8.4, 9.6) })
  if (on(t, 11.8, 14)) {
    eyebrow(ctx, '01 · Scan', { x: left, y: base - size * 1.5, size: u * 2.3 })
    lines(ctx, ['SEE THE PRESSURE', 'BEFORE THE', 'BALL ARRIVES.'], { x: left, y: base - size * 0.9, size: size * 0.9, scale: push(t, 11.8, 14) })
  }
  if (on(t, 15.4, 18)) {
    eyebrow(ctx, '02 · Decide', { x: left, y: base - size * 0.6, size: u * 2.3 })
    lines(ctx, ['THINK ONE', { text: 'PASS AHEAD.', volt: true }], { x: left, y: base, size, scale: push(t, 15.4, 18) })
  }

  // 18.2–21.4: the four areas, in rapid cuts.
  const quads = academy.philosophy.quadrants
  for (let i = 0; i < quads.length; i++) {
    const a = 18.2 + i * 0.8
    if (!on(t, a, a + 0.8)) continue
    eyebrow(ctx, 'Every session', { x: W / 2, y: H * 0.38, size: u * 2.3, align: 'center' })
    lines(ctx, [quads[i].name.toUpperCase()], { x: W / 2, y: H * 0.43, size: size * 1.35, align: 'center', scale: push(t, a, a + 0.8) })
    small(ctx, quads[i].title, { x: W / 2, y: H * 0.43 + size * 1.5, size: u * 2.8, align: 'center', color: BONE })
  }

  // 21.4–24.6: the families' verdict.
  if (on(t, 21.4, 24.6)) {
    eyebrow(ctx, 'The verdict', { x: W / 2, y: H * 0.27, size: u * 2.3, align: 'center' })
    lines(ctx, [google.score.toFixed(1)], { x: W / 2, y: H * 0.32, size: size * 2.6, align: 'center', scale: push(t, 21.4, 24.6) })
    ctx.fillStyle = VOLT
    for (let i = 0; i < 5; i++) {
      const pop = easeOut((t - 21.55 - i * 0.08) / 0.25)
      if (pop <= 0) continue
      star(ctx, W / 2 + (i - 2) * u * 6.2, H * 0.32 + size * 2.75, u * 2.3 * pop)
    }
    small(ctx, 'Rated by Surat families', { x: W / 2, y: H * 0.32 + size * 3.2, size: u * 2.9, align: 'center', color: BONE })
    small(ctx, `${google.countLabel} on Google · 5.0 on Justdial`, { x: W / 2, y: H * 0.32 + size * 3.2 + u * 4.6, size: u * 2.3, align: 'center' })
  }

  // 24.6–27.6: the pathway, line by line.
  if (on(t, 24.6, 27.6)) {
    eyebrow(ctx, '03 · The pathway', { x: left, y: H * 0.3, size: u * 2.3 })
    const steps = ['TRAINING GROUND.', 'DISTRICT TRIALS.', 'YOUTH CUPS.', { text: 'STATE SCOUTS.', volt: true }]
    steps.forEach((step, i) => {
      const k = easeOut((t - 24.7 - i * 0.4) / 0.35)
      if (k <= 0) return
      ctx.save()
      ctx.globalAlpha = k
      lines(ctx, [step], { x: left, y: H * 0.35 + i * size * 0.98 + (1 - k) * size * 0.3, size: size * 0.95 })
      ctx.restore()
    })
  }

  // 30.2 on: the end card, beneath the wordmark the particles have built.
  if (t >= 30.2) {
    const y0 = portrait ? H * 0.44 : H * 0.66
    const rise = (a) => easeOut((t - a) / 0.6)
    const k1 = rise(30.2)
    ctx.save()
    ctx.globalAlpha = k1
    small(ctx, `Football Academy · Adajan, ${academy.city}`, { x: W / 2, y: y0 + (1 - k1) * u * 2, size: u * 2.9, align: 'center', color: BONE })
    ctx.restore()
    const k2 = rise(31)
    ctx.save()
    ctx.globalAlpha = k2
    const pillY = y0 + u * 7 + (1 - k2) * u * 2
    setFont(ctx, font(u * 3.3, 800, 'expanded'), 0)
    const label = 'BOOK A VISIT'
    const pw = ctx.measureText(label).width + u * 7
    const ph = u * 7.4
    ctx.fillStyle = VOLT
    ctx.beginPath()
    ctx.roundRect(W / 2 - pw / 2, pillY, pw, ph, ph / 2)
    ctx.fill()
    ctx.fillStyle = '#0a0a0b'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, W / 2, pillY + ph / 2 + u * 0.15)
    lines(ctx, [academy.phone.display], { x: W / 2, y: pillY + ph + u * 3, size: u * 5.8, align: 'center' })
    small(ctx, `Mon–Fri · 6–9 PM · ${academy.address.venue}`, { x: W / 2, y: pillY + ph + u * 10.6, size: u * 2.3, align: 'center' })
    ctx.restore()
  }
}

// ---------- One full frame ----------

async function frame(s, ctx, t) {
  renderScene(s, t)
  const { W, H } = s
  ctx.globalAlpha = 1
  ctx.fillStyle = VOID
  ctx.fillRect(0, 0, W, H)
  // The scene fades up as the particles pour in, and dims under the run of cards.
  ctx.globalAlpha = span(t, 2.1, 3) * (1 - 0.55 * span(t, 18, 18.4) * (1 - span(t, 27.3, 27.9)))
  ctx.drawImage(s.glCanvas, 0, 0)
  ctx.globalAlpha = 1
  floodlights(ctx, s, t, t < 6 ? 1 - span(t, 4.8, 5.6) : span(t, 30.4, 31.4))
  overlay(ctx, s, t)
  // Letterbox bars at the open, retracting as the ball forms.
  if (!s.portrait && t < 5.7) {
    const bar = s.H * 0.11 * (1 - span(t, 5, 5.6))
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, s.W, bar)
    ctx.fillRect(0, s.H - bar, s.W, bar)
  }
  // The last moments fade to black.
  const out = span(t, DURATION - 0.35, DURATION)
  if (out > 0) {
    ctx.fillStyle = `rgba(0,0,0,${out})`
    ctx.fillRect(0, 0, W, H)
  }
}

// ---------- Sound design ----------

/** Impacts, whooshes, risers and a low drone, cut to the picture. No samples or licensed music. */
async function soundtrack() {
  const rate = 48000
  const ac = new OfflineAudioContext(2, Math.ceil(rate * DURATION), rate)
  const master = ac.createGain()
  master.gain.value = 0.9
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 3
  master.connect(comp).connect(ac.destination)

  const noise = ac.createBuffer(1, rate * 2, rate)
  const nd = noise.getChannelData(0)
  let seed = 11
  for (let i = 0; i < nd.length; i++) nd[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1

  // The bed: two detuned low saws through a slowly opening filter.
  const drone = ac.createGain()
  drone.gain.setValueAtTime(0, 0)
  drone.gain.linearRampToValueAtTime(0.07, 3)
  drone.gain.setValueAtTime(0.07, DURATION - 2)
  drone.gain.linearRampToValueAtTime(0, DURATION)
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(220, 0)
  lp.frequency.linearRampToValueAtTime(700, 15)
  lp.frequency.linearRampToValueAtTime(380, 21)
  lp.frequency.linearRampToValueAtTime(900, LAND)
  lp.frequency.linearRampToValueAtTime(300, DURATION)
  drone.connect(lp).connect(master)
  for (const f of [55, 55.35, 82.4]) {
    const o = ac.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    o.connect(drone)
    o.start(0)
    o.stop(DURATION)
  }

  const boom = (at, level, pitch = 110) => {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(pitch, at)
    o.frequency.exponentialRampToValueAtTime(38, at + 0.5)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(level, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4)
    o.connect(g).connect(master)
    o.start(at)
    o.stop(at + 1.5)
  }
  const burstNoise = (at, level, len, { type = 'highpass', freq = 1200, q = 0.7 } = {}) => {
    const src = ac.createBufferSource()
    src.buffer = noise
    const f = ac.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(level, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    src.connect(f).connect(g).connect(master)
    src.start(at, (at * 0.37) % 1)
    src.stop(at + len + 0.05)
  }
  const sweep = (from, to, level, f0, f1) => {
    const src = ac.createBufferSource()
    src.buffer = noise
    src.loop = true
    const f = ac.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.2
    f.frequency.setValueAtTime(f0, from)
    f.frequency.exponentialRampToValueAtTime(f1, to)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, from)
    g.gain.exponentialRampToValueAtTime(level, to - 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, to + 0.12)
    src.connect(f).connect(g).connect(master)
    src.start(from)
    src.stop(to + 0.2)
  }

  // Floodlights clunk on.
  for (const [at, lvl] of [[0.25, 0.5], [0.55, 0.4]]) {
    boom(at, lvl, 90)
    burstNoise(at, lvl * 0.4, 0.12, { type: 'bandpass', freq: 900, q: 2 })
  }
  // The burst: a riser, then the hit.
  sweep(4.3, BURST, 0.35, 300, 6000)
  boom(BURST, 1, 140)
  burstNoise(BURST, 0.5, 1.6)
  // Whooshes on the big transitions.
  for (const at of [9.5, 13.9, 27.4]) sweep(at - 0.5, at + 0.2, 0.25, 500, 3500)
  // Slow motion: a heartbeat under the pass.
  for (const at of [15.4, 16.2, 17, 17.8]) {
    boom(at, 0.35, 70)
    boom(at + 0.22, 0.22, 60)
  }
  // The four cuts, then a soft chime under the verdict.
  for (let i = 0; i < 4; i++) {
    boom(18.2 + i * 0.8, 0.55, 120)
    burstNoise(18.2 + i * 0.8, 0.18, 0.06, { freq: 4000 })
  }
  for (const [f, lvl] of [[880, 0.08], [1320, 0.05], [1760, 0.03]]) {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, 21.4)
    g.gain.exponentialRampToValueAtTime(lvl, 21.42)
    g.gain.exponentialRampToValueAtTime(0.0001, 23.4)
    o.connect(g).connect(master)
    o.start(21.4)
    o.stop(23.5)
  }
  for (let i = 0; i < 4; i++) burstNoise(24.7 + i * 0.4, 0.12, 0.08, { type: 'bandpass', freq: 2500, q: 3 })
  // The landing: a riser, the hit, and the end card's final note.
  sweep(28.6, LAND, 0.4, 250, 7000)
  boom(LAND, 1, 150)
  burstNoise(LAND, 0.45, 1.8)
  boom(31, 0.3, 80)
  return ac.startRendering()
}

// ---------- Encoding ----------

const scenes = {}
async function sceneFor(format) {
  const portrait = format === 'portrait'
  scenes[format] ??= await createScene(portrait ? 1080 : 1920, portrait ? 1920 : 1080, portrait)
  return scenes[format]
}

function frameCanvas(s) {
  const c = document.getElementById('frame')
  if (c.width !== s.W || c.height !== s.H) {
    c.width = s.W
    c.height = s.H
  }
  return c
}

/** One still, for checking frames: returns a JPEG data URL. */
window.renderStill = async (format, t) => {
  const s = await sceneFor(format)
  const c = frameCanvas(s)
  await frame(s, c.getContext('2d'), t)
  return c.toDataURL('image/jpeg', 0.88)
}

/** Renders the whole film and hands it to the page's host in base64 pieces via window.__save. */
window.renderPromo = async (format, bitrate = 6e6) => {
  const s = await sceneFor(format)
  const c = frameCanvas(s)
  const ctx = c.getContext('2d')
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: s.W, height: s.H, frameRate: FPS },
    audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 },
    fastStart: 'in-memory',
  })
  const failures = []
  const video = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => failures.push(e.message) })
  video.configure({ codec: s.portrait ? 'avc1.640033' : 'avc1.640028', width: s.W, height: s.H, bitrate, framerate: FPS, avc: { format: 'avc' } })
  const total = Math.round(DURATION * FPS)
  const status = document.getElementById('status')
  for (let i = 0; i < total; i++) {
    await frame(s, ctx, i / FPS)
    const vf = new VideoFrame(c, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) })
    video.encode(vf, { keyFrame: i % (FPS * 2) === 0 })
    vf.close()
    while (video.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2))
    if (i % 30 === 0) status.textContent = `${format}: frame ${i} of ${total}`
  }
  await video.flush()

  const buffer = await soundtrack()
  const audio = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => failures.push(e.message) })
  audio.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 })
  const block = 4800
  for (let off = 0; off < buffer.length; off += block) {
    const n = Math.min(block, buffer.length - off)
    const data = new Float32Array(n * 2)
    data.set(buffer.getChannelData(0).subarray(off, off + n), 0)
    data.set(buffer.getChannelData(1).subarray(off, off + n), n)
    const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off * 1e6) / 48000), data })
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
    await window.__save(format, btoa(bin), off + piece >= bytes.length)
  }
  status.textContent = `${format}: done, ${(bytes.length / 1e6).toFixed(1)} MB`
  return bytes.length
}

await document.fonts.load('900 230px Archivo')
await document.fonts.load('600 40px Archivo')
document.getElementById('status').textContent = 'Ready'
window.promoReady = true
