// "Head Up": a one-minute animated short for Vision Football Academy.
//
// 6 PM in Adajan. The floodlights come on. A young player takes the ball with his head down and loses
// it to a defender from his blind side. His coach points to his own eyes. Monday to Friday he learns
// to check his shoulders. On match night the ball comes from behind, the press comes from his blind
// side, and this time he has already seen it: one pass ahead, a goal, head up.
//
// Everything is built here: the set (world.js), the people (people.js), the shots and the edit (this
// file), the score and effects (score.js). Every frame is computed from its own time, so the render is
// repeatable. Driven by scripts/render-film.mjs (npm run film). Every fact on screen comes from
// shared/academy.js.
import * as THREE from 'three'
import {
  BloomEffect,
  BrightnessContrastEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  BlendFunction,
} from 'postprocessing'
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { academy } from '../shared/academy.js'
import { FILL, footPoint, gazeDirection, headPoint, makePerson, perform, pose } from './people'
import { createWorld, scanFan } from './world'
import { score } from './score'
import '../src/styles/base.css'

export const DURATION = 64.5
const FPS = 30
const W = 1920
const H = 1080
const BAR = Math.round((H - W / 2.39) / 2) // letterbox to 2.39:1
const VOLT = '#d7ff3a'
const BONE = '#f2f2ee'
const SMOKE = '#b8b8b2'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (v) => v * v * (3 - 2 * v)
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3)
const span = (t, a, b) => smooth(clamp01((t - a) / (b - a)))
const lerp = (a, b, u) => a + (b - a) * u
const v3 = (x, y, z) => new THREE.Vector3(x, y, z)

// ---------- Film time and story time ----------
// The edit holds and slows the story: a freeze frame on the lost ball, and two slow-motion beats on
// match night. People and the ball are posed in story time; shots and cards run in film time.
const SEGMENTS = [
  [0, 19.15, 1],
  [19.15, 21.5, 0], // freeze: HEAD DOWN.
  [21.5, 41.2, 1],
  [41.2, 45.2, 0.25], // the first-time pass
  [45.2, 46.8, 1],
  [46.8, 48.8, 0.3], // the ball hits the net
  [48.8, 999, 1],
]
export function storyAt(f) {
  let s = 0
  for (const [a, b, r] of SEGMENTS) {
    if (f <= a) break
    s += (Math.min(f, b) - a) * r
  }
  return s
}

// ---------- The cast and what they do (story time) ----------

const MON = 23.15 // first day of the montage; each day is one 2.5 s rep
const DAY = 2.5
const days = ['MON', 'TUE', 'WED', 'THU', 'FRI']
// Shoulder checks per day, each [when, yaw]: he scans more, and faster, every day.
const CHECKS = [
  [[0.5, 2.0]],
  [[0.35, 2.0], [0.95, -2.0]],
  [[0.3, -2.0], [0.8, 2.0]],
  [[0.25, 2.0], [0.62, -2.0], [1.05, 2.0]],
  [[0.2, -2.0], [0.48, 2.0], [0.78, -2.0], [1.1, 2.0]],
]
const RIGHT = Math.PI / 2 // facing +x, towards the far goal

function heroLook() {
  const k = [
    [0, 0, 0.1],
    [12, 0, 0.22],
    [13.6, 0, -0.45],
    [14.8, 0.35, -0.5],
    [15.3, 0, 0.12],
    [16.9, 0, 0.55],
    [19.0, 0, 0.55],
    [19.3, 0.5, 0.2],
    [21.0, 0, -0.08],
    [22.9, 0, -0.05],
  ]
  days.forEach((_, d) => {
    const s0 = MON + d * DAY
    k.push([s0 + 0.05, 0, 0.1])
    for (const [c, yaw] of CHECKS[d]) {
      k.push([s0 + c - 0.12, 0, 0.05], [s0 + c, yaw, 0], [s0 + c + 0.1, yaw, 0], [s0 + c + 0.24, 0, 0.05])
    }
    k.push([s0 + 1.6, 0, 0.3], [s0 + 1.95, 0, 0.3], [s0 + 2.2, 0, 0.05])
  })
  k.push([35.7, 0, 0.1], [37.75, 0, 0.1], [37.9, -1.9, 0], [38.12, -1.9, 0], [38.3, 0, 0.1], [38.48, 2.1, 0], [38.66, 2.1, 0], [38.84, 0, 0.28], [39.3, 0, 0.3], [39.6, 0, 0])
  k.push([43.6, 0, 0], [43.9, 0, -0.3], [44.9, 0, -0.1], [45.6, 0, -0.42], [47.5, 0, -0.48])
  return k.sort((a, b) => a[0] - b[0])
}

function heroFace() {
  const k = [
    [0, 1.99],
    [11.6, 1.99],
    [11.8, 2.57],
    [15.0, 2.57],
    [15.3, RIGHT],
    [19.3, RIGHT],
    [20.6, -0.8],
    [22.9, -0.8],
  ]
  days.forEach((_, d) => {
    const s0 = MON + d * DAY
    k.push([s0 + 0.02, RIGHT], [s0 + 2.02, RIGHT], [s0 + 2.35, 0.05], [s0 + DAY - 0.05, 0.05])
  })
  k.push([35.7, -0.6], [38.84, -0.6], [38.98, 1.72], [41.4, 1.72], [43.8, 1.72], [44.9, 1.72], [45.4, 2.6], [52, 2.6])
  return k
}

function heroPath() {
  const k = [
    [0, -24, 17],
    [7.5, -24, 17],
    [11.6, -6, 9],
    [13.2, -1.5, 2],
    [15.0, -0.2, 0],
    [15.4, 0, 0],
    [19.0, 0, 0],
    [19.5, -0.4, 0.5],
    [22.9, -0.4, 0.5],
  ]
  days.forEach((_, d) => {
    const s0 = MON + d * DAY
    k.push([s0 + 0.01, 0, 0], [s0 + 2.0, 0, 0], [s0 + 2.45, -0.1, 0.9])
  })
  k.push([35.66, 8, 2.1], [37.4, 8.2, 2.0], [38.9, 8.4, 1.9], [39.4, 8.6, 1.8], [40.2, 10.5, 1.4], [43.8, 26.0, -0.6], [52, 26.0, -0.6])
  return k
}

const CAST = {
  hero: { person: makePerson({ height: 1.55, team: 'vision', build: 0.92, skin: 0 }) },
  t1: { person: makePerson({ height: 1.63, team: 'vision', skin: 2 }) },
  d1: { person: makePerson({ height: 1.68, team: 'other', build: 1.05, skin: 1 }) },
  coach: { person: makePerson({ height: 1.8, team: 'coach', build: 1.08, skin: 3 }) },
  t2: { person: makePerson({ height: 1.64, team: 'vision', skin: 1 }) },
  t3: { person: makePerson({ height: 1.6, team: 'vision', skin: 3 }) },
  d2: { person: makePerson({ height: 1.7, team: 'other', build: 1.05, skin: 2 }) },
  d3: { person: makePerson({ height: 1.72, team: 'other' }) },
  gk: { person: makePerson({ height: 1.78, team: 'keeper', build: 1.1, skin: 1 }) },
  // Others training at the far end, then on the pitch on match night.
  e1: { person: makePerson({ height: 1.62, team: 'vision', skin: 2 }) },
  e2: { person: makePerson({ height: 1.66, team: 'other', skin: 0 }) },
  e3: { person: makePerson({ height: 1.7, team: 'other', skin: 3 }) },
  // Parents on the touchline.
  ...Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`p${i}`, { person: makePerson({ height: 1.58 + (i % 3) * 0.08, team: 'parent', build: 1.05 + (i % 2) * 0.08, skin: i, shirt: i }) }])),
}

function directCast() {
  const montage = (fn) => days.flatMap((_, d) => fn(MON + d * DAY, d))
  perform(CAST.hero.person, {
    path: heroPath(),
    look: heroLook(),
    face: heroFace(),
    acts: [
      { type: 'kick', at: 14.8, dur: 0.4 },
      { type: 'touch', at: 17.55, dur: 0.35 },
      { type: 'stumble', at: 19.0, dur: 1.0 },
      { type: 'slump', at: 20.0, dur: 1.6 },
      ...montage((s0) => [
        { type: 'touch', at: s0 + 1.88, dur: 0.3 },
        { type: 'kick', at: s0 + 2.15, dur: 0.33 },
      ]),
      { type: 'kick', at: 38.92, dur: 0.4 },
      { type: 'celebrate', at: 43.6, dur: 1.3 },
    ],
  })
  perform(CAST.t1.person, {
    path: [[0, 14, -8], [10, 14, -8], [14.5, 10, 0], [35.5, 10, 0], [35.66, 21, 11], [60, 21, 11]],
    face: [[0, -1.0], [14.4, -1.0], [14.7, -RIGHT], [35.5, -RIGHT], [35.66, -2.4], [60, -2.4]],
    look: [[0, 0, 0.1]],
    acts: [{ type: 'touch', at: 16.0, dur: 0.3 }, { type: 'kick', at: 16.4, dur: 0.4 }, ...montage((s0) => [{ type: 'kick', at: s0 + 0.7, dur: 0.4 }])],
  })
  perform(CAST.d1.person, {
    path: [
      [0, -15, -14],
      [14, -7, -5],
      [16.9, -7, -5],
      [19.0, -0.65, -0.45],
      [20.6, -6, 4],
      [23.0, -6.5, 4.5],
      ...montage((s0) => [[s0 + 0.01, -7, -5], [s0 + 0.9, -7, -5], [s0 + 2.3, -1.7, -1.2], [s0 + 2.48, -1.5, -0.6]]),
      [35.66, 20.5, 9.5],
      [60, 20.5, 9.5],
    ],
    look: [[0, 0, 0.15]],
    acts: [],
  })
  perform(CAST.coach.person, {
    path: [[0, -9.5, 9.5], [19.3, -9.5, 9.5], [21.0, -1.15, 1.35], [23.0, -1.15, 1.35], [23.1, -6.5, 7], [35.5, -6.5, 7], [35.66, 2, 23.5], [60, 2, 23.5]],
    face: [[0, 2.4], [19.3, 2.4], [19.5, 2.45], [21.0, 2.45], [23.1, 2.1], [35.5, 2.1], [35.66, 3.1], [60, 3.1]],
    look: [[0, 0, 0.05], [21.1, 0, 0.25], [22.0, 0, 0.15]],
    acts: [{ type: 'point', at: 21.15, dur: 1.9 }],
  })
  perform(CAST.t2.person, {
    path: [[0, 12, -14], [4, 12, -14], [9, 20, -10], [14, 14, -16], [19, 18, -12], [24, 15, -15], [35.5, 15, -15], [35.66, 18, -10], [37.8, 18.5, -9.6], [40.25, 26.8, -2.3], [40.9, 28.4, -1.6], [41.4, 29.0, -1.4], [42.0, 29.0, -1.3], [44.2, 28.5, -1.0], [45.0, 30.5, -1.2], [52, 33, 6]],
    face: [[0, 1.0], [35.5, 1.0], [37.8, 0.75], [40.25, 0.9], [40.9, 1.45], [41.4, 1.45], [42.0, -1.6], [44.4, -1.6], [52, -1.6]],
    look: [[0, 0, 0.1], [39.9, -0.6, 0.2], [40.4, 0, 0.3], [41.2, 0, 0.1]],
    acts: [{ type: 'touch', at: 40.22, dur: 0.3 }, { type: 'kick', at: 40.9, dur: 0.42 }, { type: 'celebrate', at: 42.0, dur: 2.0 }],
  })
  perform(CAST.t3.person, {
    path: [[0, 9, 15], [6, 13, 13], [12, 9, 15], [35.5, 9, 15], [35.66, -8.5, 10.5], [37.45, -4.6, 8.3], [38.2, -4.0, 8.0], [41, 2, 6], [60, 2, 6]],
    face: [[0, 0.5], [35.66, 2.0], [37.3, 2.0], [37.5, 1.1], [38.2, 1.6], [60, 1.6]],
    look: [[0, 0, 0.2]],
    acts: [{ type: 'kick', at: 37.38, dur: 0.4 }],
  })
  perform(CAST.d2.person, {
    path: [[0, 6, -18], [8, 2, -16], [16, 8, -18], [35.5, 8, -18], [35.66, 2, -6], [37.6, 2.2, -5.8], [39.25, 7.65, 1.35], [39.8, 8.9, 2.9], [42, 9.4, 3.2], [60, 9.4, 3.2]],
    face: [[0, 0.8], [35.66, 0.6], [39.25, 0.68], [39.8, 0.68], [42, 1.2], [60, 1.2]],
    look: [[0, 0, 0.2]],
    acts: [{ type: 'stumble', at: 39.15, dur: 0.6 }, { type: 'slump', at: 40.0, dur: 3 }],
  })
  perform(CAST.d3.person, {
    path: [[0, 20, -6], [35.5, 20, -6], [35.66, 16.5, -1.5], [38.8, 16.6, -1.6], [39.6, 17.2, -2.6], [40.6, 19.5, -2.4], [60, 19.5, -2.4]],
    face: [[0, -RIGHT], [35.66, -1.9], [39.6, -1.2], [40.6, 1.4], [60, 1.4]],
    look: [[0, 0, 0.1]],
    acts: [],
  })
  const extra = (who, before, during) => perform(CAST[who].person, { path: [...before, ...during], look: [[0, 0, 0.1]] })
  extra('e1', [[0, 22, 12], [12, 26, 8], [24, 21, 12], [35.5, 25, 9]], [[35.66, 15, 9], [38.5, 17, 7.5], [41, 21, 5], [60, 21, 5]])
  extra('e2', [[0, 27, 6], [12, 22, 10], [24, 26, 7], [35.5, 22, 11]], [[35.66, 13, -11], [38.5, 15.5, -8.5], [41, 19, -6], [60, 19, -6]])
  extra('e3', [[0, 24, 15], [12, 25, 13], [24, 23, 14], [35.5, 24, 13]], [[35.66, 23, 7], [38.5, 24, 5], [41, 27, 3], [60, 27, 3]])
  ;[-7, -4.6, 6.2, 8.4, 11].forEach((x, i) =>
    perform(CAST[`p${i}`].person, {
      path: [[0, x, 24.6 + (i % 2) * 0.5]],
      face: [[0, Math.PI + (i - 2) * 0.12]],
      look: [[0, 0, 0.05]],
      acts: [{ type: 'celebrate', at: 41.75 + i * 0.07, dur: 1.8 }],
    }),
  )
  perform(CAST.gk.person, {
    path: [[0, 33.4, 0], [40.6, 33.4, 0.2], [41.15, 33.4, 0.6], [60, 33.4, 0.6]],
    face: [[0, -RIGHT]],
    look: [[0, 0, 0.1]],
    acts: [{ type: 'dive', at: 41.2, dur: 0.85, side: -1 }],
  })
}

// ---------- The ball (story time) ----------

const RELEASE_TO_T1 = 15.0
const PASS = { from: v3(10, 0.11, 0), to: v3(0.38, 0.11, 0.05) }
const MATCH_PASS_AT = 39.12
const MATCH_TARGET = v3(26.9, 0.11, -2.2)
const SHOT_AT = 41.12
const NET_AT = 41.65
const NET_HIT = v3(34.35, 1.35, 2.5)

function arc(from, to, u, h) {
  const p = from.clone().lerp(to, u)
  p.y = lerp(from.y, to.y, u) + 4 * h * u * (1 - u)
  return p
}

function ballAt(t) {
  const H_ = CAST.hero.person
  const carry = (who, side = 'R', reach = 0.38) => {
    pose(who, t)
    const p = footPoint(who, t, side, reach)
    p.y = 0.11 + Math.abs(Math.sin(t * 9)) * 0.04 * clamp01(who.userData.perf.speed(t) / 2)
    return p
  }
  if (t < 13.2) return carry(H_)
  if (t < 14.4) {
    pose(H_, t)
    const u = (t - 13.2) / 1.2
    const p = footPoint(H_, t, 'R', 0.38)
    p.y = 0.11 + 4 * 1.5 * u * (1 - u)
    return p
  }
  if (t < RELEASE_TO_T1) return carry(H_)
  if (t < 16.1) return arc(footPoint(H_, RELEASE_TO_T1), v3(9.6, 0.11, 0), (t - RELEASE_TO_T1) / 1.1, 0.05)
  if (t < 16.6) return v3(9.62, 0.11, 0)
  if (t < 17.65) return arc(PASS.from.clone().setX(9.62), PASS.to, (t - 16.6) / 1.05, 0.04)
  if (t < 19.0) return carry(H_, 'R', 0.3)
  if (t < 20.6) return carry(CAST.d1.person, 'R', 0.42)
  for (let d = 0; d < 5; d++) {
    const s0 = MON + d * DAY
    if (t >= s0 && t < s0 + DAY) {
      if (t < s0 + 0.9) return v3(9.62, 0.11, 0)
      if (t < s0 + 1.95) return arc(v3(9.62, 0.11, 0), PASS.to, (t - s0 - 0.9) / 1.05, 0.04)
      if (t < s0 + 2.3) return carry(H_, 'R', 0.32)
      pose(H_, s0 + 2.3)
      return arc(footPoint(H_, s0 + 2.3), v3(-5, 0.11, 9), (t - s0 - 2.3) / 1.4, 0.1)
    }
  }
  if (t < MON) return carry(CAST.d1.person, 'R', 0.42)
  const T3 = CAST.t3.person
  if (t < 37.6) return carry(T3)
  const heroFoot = v3(8.75, 0.11, 1.75)
  if (t < 38.94) return arc(footPoint(T3, 37.6), heroFoot, (t - 37.6) / 1.34, 0.15)
  if (t < MATCH_PASS_AT) return heroFoot
  if (t < 40.29) return arc(heroFoot, MATCH_TARGET, (t - MATCH_PASS_AT) / (40.29 - MATCH_PASS_AT), 0.35)
  const T2 = CAST.t2.person
  if (t < SHOT_AT) return carry(T2, 'R', 0.4)
  if (t < NET_AT) {
    pose(T2, SHOT_AT)
    return arc(footPoint(T2, SHOT_AT), NET_HIT, (t - SHOT_AT) / (NET_AT - SHOT_AT), 0.5)
  }
  const fall = clamp01((t - NET_AT) / 0.7)
  return v3(lerp(NET_HIT.x, 35.1, fall), lerp(NET_HIT.y, 0.11, fall * fall), lerp(NET_HIT.z, 2.6, fall))
}

// ---------- Shots (film time) ----------
// Each shot: [from, to, (film u, story t) => { pos, look, fov, focus }]. Hard cuts between them.
const headOf = (who) => headPoint(CAST[who].person)
const bodyOf = (who, y = 1.0) => CAST[who].person.position.clone().setY(y)
const VISIBLE = W / 2.39 / H // the share of the frame's height left between the letterbox bars
/**
 * A camera at `pos` that puts `target` at screen position (sx, sy): -1 is the left or bottom edge of
 * the picture, 1 the right or top. Lets each shot be composed by thirds rather than centred.
 */
function place(pos, target, sx, sy, fov, focus = target) {
  const d = target.clone().sub(pos)
  const dist = d.length()
  d.normalize()
  const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, d)
  const tv = Math.tan((fov * Math.PI) / 360)
  const look = target.clone().addScaledVector(right, -sx * tv * (W / H) * dist).addScaledVector(up, -sy * tv * VISIBLE * dist)
  return { pos, look, fov, focus }
}
const HERO_FACE_ON = v3(Math.sin(1.99), 0, Math.cos(1.99)) // the way he faces as he walks on
const SHOTS = [
  // 6:00 PM. Looking up at a tower as it comes on.
  [0, 4, (u) => ({ pos: v3(-35.5, 1.5, -21.5 + u * 0.6), look: v3(-44, 20.5 - u * 0.8, -31), fov: 40, focus: v3(-44, 22, -31) })],
  // Behind him, ball under his foot, as the rest of the ground lights up in front of him.
  [4, 8, (u) => {
    const h = bodyOf('hero', 1.0)
    const pos = h.clone().addScaledVector(HERO_FACE_ON, -lerp(4.6, 3.6, u)).add(v3(0.9, lerp(1.25, 1.1, u), 0.9))
    return place(pos, h, -0.34, -0.2, 34)
  }],
  // Alongside as he runs on with the ball.
  [8, 12, (u, t) => {
    const h = bodyOf('hero', 0.85)
    const side = v3(HERO_FACE_ON.z, 0, -HERO_FACE_ON.x) // to his left, so the lit ground is behind him
    const pos = h.clone().addScaledVector(side, -4.4).addScaledVector(HERO_FACE_ON, 0.6).setY(0.95)
    return place(pos, h, 0.18, -0.12, 32, ballAt(t))
  }],
  // He flicks the ball up and looks up at the lights. Side on, so the ball rises past his face.
  [12, 15.5, (u, t) => {
    const h = headOf('hero')
    const f = v3(Math.sin(2.57), 0, Math.cos(2.57))
    const pos = h.clone().add(v3(-f.z * 3.1, 0, f.x * 3.1)).addScaledVector(f, 0.9 - u * 0.4).setY(0.85)
    return place(pos, h, -0.15, 0.2, 32, ballAt(t).lerp(h, 0.5))
  }],
  // The drill, from behind the defender he hasn't seen.
  [15.5, 17.4, (u) => place(v3(-10.6 + u * 0.5, 2.0, -8.6 + u * 0.3), bodyOf('hero', 0.9), 0.15, -0.1, 30)],
  // In front of him: head down, eyes on the ball, and the defender closing from his blind side.
  [17.4, 19.15, (u) => {
    const h = headOf('hero')
    return place(v3(4.1 - u * 0.5, 0.95, 1.6 - u * 0.2), h, 0.32, 0.25, 34)
  }],
  // Freeze: the camera circles the moment the ball is taken.
  [19.15, 21.5, (u) => {
    const a = lerp(2.4, 0.9, smooth(u))
    const c = v3(-0.3, 0.85, -0.2)
    return place(v3(c.x + Math.cos(a) * 3.8, 1.15, c.z + Math.sin(a) * 3.8), c, 0, -0.25, 36)
  }],
  // Over his shoulder as the coach walks over and points to his own eyes.
  [21.5, 25.5, (u) => {
    const c = bodyOf('coach', 1.45)
    return place(v3(0.95 - u * 0.15, 1.42, -0.55 + u * 0.1), c, 0.22, 0.12, 30, headOf('coach'))
  }],
  // Monday to Friday: one camera per day. Monday from high, so the drill and his scan read as a diagram.
  [25.5, 28.0, (u) => place(v3(-2.6 + u * 0.6, 4.4, 5.4 - u * 0.3), v3(0.6, 0.2, -1.4), 0, -0.1, 40, bodyOf('hero', 0.8))],
  // Tuesday: close, side on, as his head turns.
  [28.0, 30.5, (u) => {
    const h = headOf('hero')
    return place(v3(h.x + 0.5, 1.3, h.z - 2.9 + u * 0.35), h, -0.2, 0.42, 30)
  }],
  // Wednesday, in the rain: face on.
  [30.5, 33.0, (u) => {
    const h = headOf('hero')
    return place(v3(h.x + 3.3 - u * 0.5, 1.15, h.z + 1.5), h, 0.25, 0.4, 28)
  }],
  // Thursday: over his shoulder, the whole picture in front of him.
  [33.0, 35.5, (u) => {
    const h = headOf('hero')
    return place(v3(h.x - 2.3, 1.55, h.z + 1.6 - u * 0.2), h, -0.42, -0.05, 40, v3(h.x + 4, 0.8, h.z))
  }],
  // Friday: low, circling him, scanning fast now.
  [35.5, 38.0, (u) => {
    const h = headOf('hero')
    const a = lerp(-0.6, 0.6, u)
    return place(v3(h.x + Math.cos(a) * 3.4, 0.6, h.z + Math.sin(a) * 3.4), h, 0.28, 0.35, 32)
  }],
  // Match night: the ball goes to him with a man closing behind him.
  [38.0, 40.2, (u) => place(v3(lerp(6.0, 5.0, u), 7.5, 17.5), v3(2, 0, 2), 0, 0, 40, headOf('hero'))],
  // He checks his shoulder and sees the press coming.
  [40.2, 41.2, (u) => {
    const h = headOf('hero')
    return place(v3(h.x - 1.35, 1.45, h.z + 2.0 - u * 0.15), h, -0.3, 0.3, 34)
  }],
  // Slow motion: the first-time pass, low at his feet…
  [41.2, 43.0, (u) => place(v3(lerp(11.6, 11.2, u), 0.6, lerp(4.4, 4.0, u)), v3(8.75, 0.55, 1.75), -0.1, -0.15, 34, v3(8.75, 0.3, 1.75))],
  // …and from above, the pass played into the runner's path.
  [43.0, 45.2, (u) => ({ pos: v3(lerp(10, 12, u), 21, lerp(13, 11, u)), look: v3(18, 0, -1), fov: 40, focus: v3(18, 0, -1) })],
  // The runner takes it in his stride and shoots.
  [45.2, 46.8, (u) => {
    const h = headOf('t2')
    return place(v3(h.x - 1.6, 1.0, h.z + 3.8), h, -0.35, 0.15, 34)
  }],
  // Behind the goal: the net takes it, in slow motion.
  [46.8, 49.5, (u) => ({ pos: v3(37.8, 1.0, -0.6 + u * 0.3), look: v3(30, 1.2, 1.2), fov: 34, focus: NET_HIT })],
  // They celebrate.
  [49.5, 51.6, (u) => place(v3(lerp(29.6, 30.2, u), 1.0, lerp(3.0, 3.6, u)), bodyOf('hero', 1.0), 0.1, -0.15, 32, headOf('hero'))],
  // Then he lifts his head to the lights. Close, from below.
  [51.6, 54.0, (u) => {
    const h = headOf('hero')
    const f = v3(Math.sin(2.6), 0, Math.cos(2.6))
    const pos = h.clone().addScaledVector(f, lerp(1.45, 1.2, u)).add(v3(f.z * 0.45, 0, -f.x * 0.45)).setY(lerp(1.12, 1.18, u))
    return place(pos, h, 0.25, -0.05, 30)
  }],
  // The pathway, over the whole ground.
  [54.0, 58.5, (u) => {
    const a = lerp(0.55, 0.95, u)
    return { pos: v3(Math.cos(a) * 46, 28, Math.sin(a) * 46), look: v3(4, 0, 0), fov: 38, focus: v3(4, 0, 0) }
  }],
  [58.5, DURATION + 1, () => ({ pos: v3(0, 30, 50), look: v3(0, 0, 0), fov: 36, focus: v3(0, 0, 0) })],
]

// ---------- Lights, weather, scan beams (story time) ----------

function flicker(t, start) {
  const k = (t - start) / 0.7
  if (k < 0) return 0
  const steps = [[0, 0], [0.06, 1], [0.12, 0.1], [0.2, 0.9], [0.3, 0.35], [0.4, 1]]
  for (let i = steps.length - 1; i >= 0; i--) if (k >= steps[i][0]) return steps[i][1]
  return 0
}
const lightLevels = (t) => [flicker(t, 2.4), flicker(t, 4.6), flicker(t, 5.2), flicker(t, 5.8)]
const rainAt = (t) => span(t, MON + 2 * DAY, MON + 2 * DAY + 0.15) * (1 - span(t, MON + 3 * DAY - 0.1, MON + 3 * DAY))
// When the hero's scan beam is showing: through the montage and in the match before the ball arrives.
const scanning = (t) => (t >= MON && t < MON + 5 * DAY) || (t >= 37.7 && t < 38.85)

// ---------- Cards and the end (film time) ----------

const google = academy.ratings.find((r) => r.source === 'Google')

function font(size, weight = 900, stretch = 'expanded') {
  return { font: `${weight} ${Math.round(size)}px Archivo`, stretch }
}
function text(ctx, str, x, y, size, { weight = 900, stretch = 'expanded', color = BONE, align = 'left', spacing = -0.02, alpha = 1 } = {}) {
  const f = font(size, weight, stretch)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = f.font
  ctx.fontStretch = f.stretch
  ctx.letterSpacing = `${size * spacing}px`
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  ctx.fillText(str, x, y)
  ctx.restore()
}
const card = (f, a, b) => (f >= a && f < b ? Math.min(1, (f - a) / 0.25, (b - f) / 0.25) : 0)

function cards(ctx, f) {
  const left = 130
  const low = H - BAR - 90
  // 6:00 PM.
  const c0 = card(f, 0.7, 3.8)
  if (c0) {
    text(ctx, 'ADAJAN, SURAT', left, low - 92, 26, { weight: 700, stretch: 'normal', color: VOLT, spacing: 0.3, alpha: c0 })
    text(ctx, '6:00 PM.', left, low, 96, { alpha: c0 })
  }
  // The lost ball, frozen.
  const c1 = card(f, 19.35, 21.45)
  if (c1) text(ctx, 'HEAD DOWN.', W / 2, BAR + 175, 120, { align: 'center', alpha: c1 })
  const c2 = card(f, 22.7, 25.4)
  if (c2) {
    text(ctx, 'COACHES SET', left, low - 78, 70, { alpha: c2 })
    text(ctx, 'THE PROBLEM.', left, low, 70, { alpha: c2 })
  }
  // The days of the week, cut to the beat.
  days.forEach((d, i) => {
    const a = 25.5 + i * DAY
    const k = f >= a && f < a + 0.95 ? 1 - smooth(clamp01((f - a - 0.75) / 0.2)) : 0
    if (!k) return
    text(ctx, d, left, BAR + 150, 120, { alpha: k })
    text(ctx, '6–9 PM', left + 6, BAR + 196, 26, { weight: 700, stretch: 'normal', color: VOLT, spacing: 0.25, alpha: k })
  })
  const c3 = card(f, 36.4, 37.95)
  if (c3) {
    text(ctx, 'PLAYERS FIND', left, low - 78, 70, { alpha: c3 })
    text(ctx, 'THE ANSWER.', left, low, 70, { alpha: c3, color: VOLT })
  }
  const c4 = card(f, 38.25, 40.1)
  if (c4) text(ctx, 'MATCH NIGHT', left, BAR + 110, 30, { weight: 700, stretch: 'normal', color: VOLT, spacing: 0.3, alpha: c4 })
  const c5 = card(f, 43.25, 45.15)
  if (c5) {
    text(ctx, 'THINK ONE', left, low - 78, 70, { alpha: c5 })
    text(ctx, 'PASS AHEAD.', left, low, 70, { alpha: c5, color: VOLT })
  }
  // The title, as they celebrate.
  const c6 = card(f, 52.3, 53.95)
  if (c6) text(ctx, 'HEAD UP.', W / 2, BAR + 205, 150, { align: 'center', alpha: c6 })
  // The pathway, over the ground.
  ;['TRAINING GROUND.', 'DISTRICT TRIALS.', 'STATE SCOUTS.'].forEach((s, i) => {
    const k = card(f, 54.3 + i * 1.1, 58.3)
    if (k) text(ctx, s, left, BAR + 170 + i * 82, 72, { alpha: k, color: i === 2 ? VOLT : BONE })
  })
  // The end card.
  if (f >= 58.5) {
    const k = (a) => easeOut((f - a) / 0.7)
    ctx.fillStyle = '#060607'
    ctx.fillRect(0, 0, W, H)
    text(ctx, 'VISION', W / 2, H / 2 - 30, 168, { align: 'center', alpha: k(58.7), spacing: 0.06 })
    text(ctx, `FOOTBALL ACADEMY · ADAJAN, ${academy.city.toUpperCase()}`, W / 2, H / 2 + 40, 30, { weight: 700, stretch: 'normal', align: 'center', spacing: 0.32, alpha: k(59.3) })
    const k3 = k(60.2)
    ctx.save()
    ctx.globalAlpha = k3
    ctx.fillStyle = VOLT
    ctx.beginPath()
    ctx.roundRect(W / 2 - 170, H / 2 + 92, 340, 72, 36)
    ctx.fill()
    ctx.restore()
    text(ctx, 'BOOK A VISIT', W / 2, H / 2 + 140, 32, { weight: 800, align: 'center', color: '#0a0a0b', alpha: k3, spacing: 0 })
    text(ctx, academy.phone.display, W / 2, H / 2 + 232, 54, { align: 'center', alpha: k3 })
    text(ctx, `MON–FRI · 6–9 PM · ${academy.address.venue.toUpperCase()} · ${google.score.toFixed(1)} ★ ON GOOGLE`, W / 2, H / 2 + 282, 22, { weight: 600, stretch: 'normal', align: 'center', color: SMOKE, spacing: 0.22, alpha: k(60.8) })
  }
}

// ---------- The renderer ----------

let R = null
async function setup() {
  if (R) return R
  directCast()
  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false })
  renderer.setPixelRatio(1)
  renderer.setSize(W, H, false)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  const world = createWorld(scene)
  for (const c of Object.values(CAST)) scene.add(c.person)
  const fan = scanFan()
  scene.add(fan)
  // The pass, drawn ahead of the runner in slow motion.
  const lineGeo = new THREE.PlaneGeometry(1, 0.22, 64, 1)
  lineGeo.rotateX(-Math.PI / 2)
  lineGeo.translate(0.5, 0.04, 0)
  const line = new THREE.Mesh(
    lineGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uDraw: { value: 0 }, uFade: { value: 0 } },
      vertexShader: 'varying float vU; void main(){ vU = position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} ',
      fragmentShader: `varying float vU; uniform float uDraw; uniform float uFade;
        void main(){ if (vU > uDraw) discard; float dash = step(0.35, fract(vU * 14.0)); float a = (0.55 + 0.45 * dash) * uFade;
          gl_FragColor = vec4(vec3(0.84, 1.0, 0.23) * a * 1.6, a); }`,
    }),
  )
  const from = v3(8.75, 0, 1.75)
  const to = MATCH_TARGET.clone().setY(0)
  line.position.copy(from)
  line.scale.set(from.distanceTo(to), 1, 1)
  line.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x)
  scene.add(line)

  const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 900)
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
  composer.addPass(new RenderPass(scene, camera))
  const dof = new DepthOfFieldEffect(camera, { worldFocusRange: 7, bokehScale: 3.2, resolutionScale: 0.75 })
  dof.target = new THREE.Vector3()
  const bloom = new BloomEffect({ mipmapBlur: true, intensity: 1.1, luminanceThreshold: 0.55, luminanceSmoothing: 0.25, radius: 0.7 })
  const grade = new HueSaturationEffect({ saturation: -0.08 })
  const contrast = new BrightnessContrastEffect({ contrast: 0.08 })
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.72 })
  const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false })
  noise.blendMode.opacity.value = 0.12
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
  composer.addPass(new EffectPass(camera, dof))
  composer.addPass(new EffectPass(camera, bloom, grade, contrast, vignette, noise, tone))
  R = { renderer, scene, camera, composer, world, fan, line, dof, bloom, grade, contrast, vignette, canvas }
  return R
}

const baseRims = new Map()
function renderFrame(f) {
  const { scene, camera, composer, world, fan, line, dof, grade, contrast, vignette } = R
  const t = storyAt(f)
  for (const c of Object.values(CAST)) pose(c.person, t)
  FILL.value = f >= 51.6 && f < 54 ? 0.6 : 0.3 // more light on his face as he looks up
  world.setLights(lightLevels(t))
  world.update(t, rainAt(t))
  const ball = ballAt(t)
  world.ball.position.copy(ball)
  world.ball.rotation.set(t * 9, t * 5, 0)
  world.ripple(1, NET_HIT, t - NET_AT)

  // The scan beam: from the hero's eyes, wherever he looks, lighting up the players it falls on.
  const hero = CAST.hero.person
  const gaze = gazeDirection(hero)
  const yaw = Math.abs(hero.userData.perf.head(t)[0])
  const fanLevel = scanning(t) ? clamp01((yaw - 0.4) / 0.8) : 0
  fan.position.set(hero.position.x, 0.03, hero.position.z)
  fan.rotation.y = Math.atan2(gaze.x, gaze.z) - Math.PI / 2
  fan.material.uniforms.uLevel.value = fanLevel
  for (const c of Object.values(CAST)) {
    if (c.person === hero) continue
    const mats = []
    c.person.traverse((o) => o.material?.userData?.rim && mats.push(o.material))
    if (!baseRims.has(c.person)) baseRims.set(c.person, mats.map((m) => m.userData.rim.value.clone()))
    const d = c.person.position.clone().sub(hero.position)
    const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(d.x, d.z) - Math.atan2(gaze.x, gaze.z)), Math.cos(Math.atan2(d.x, d.z) - Math.atan2(gaze.x, gaze.z))))
    const lit = fanLevel * (ang < 0.6 && d.length() < 17 ? 1 : 0)
    const base = baseRims.get(c.person)
    mats.forEach((m, i) => m.userData.rim.value.copy(base[i]).lerp(new THREE.Color('#d7ff3a').multiplyScalar(1.7), lit))
  }

  // The pass line, drawn in slow motion.
  line.material.uniforms.uDraw.value = span(t, 38.95, 39.22)
  line.material.uniforms.uFade.value = span(t, 38.93, 38.98) * (1 - span(t, 40.1, 40.5))
  line.visible = t > 38.9 && t < 40.6

  // The camera.
  const shot = SHOTS.find(([a, b]) => f >= a && f < b) || SHOTS[SHOTS.length - 1]
  const u = (f - shot[0]) / (shot[1] - shot[0])
  const s = shot[2](u, t)
  camera.position.copy(s.pos)
  camera.up.set(0, 1, 0)
  camera.lookAt(s.look)
  if (camera.fov !== s.fov) {
    camera.fov = s.fov
    camera.updateProjectionMatrix()
  }
  dof.target.copy(s.focus)

  // The freeze is drained of colour; slow motion is a little cooler and darker at the edges.
  const freeze = f >= 19.15 && f < 21.5 ? 1 : 0
  const slow = (f >= 41.2 && f < 45.2) || (f >= 46.8 && f < 48.8) ? 1 : 0
  grade.saturation = -0.08 - 0.75 * freeze - 0.18 * slow
  contrast.contrast = 0.08 + 0.18 * freeze
  vignette.darkness = 0.72 + 0.15 * slow
  composer.render()
}

function frameCanvas() {
  const c = document.getElementById('frame')
  if (c.width !== W) {
    c.width = W
    c.height = H
  }
  return c
}

async function compose(f) {
  renderFrame(f)
  const c = frameCanvas()
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(R.canvas, 0, 0)
  // Dips to black between the acts.
  const dip = Math.max(
    1 - clamp01(f / 0.6),
    ...[4.0, 8.0, 15.5, 25.5, 38.0, 54.0].map((a) => 1 - clamp01(Math.abs(f - a) / 0.12)),
  )
  if (dip > 0) {
    ctx.fillStyle = `rgba(0,0,0,${dip})`
    ctx.fillRect(0, 0, W, H)
  }
  cards(ctx, f)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, BAR)
  ctx.fillRect(0, H - BAR, W, BAR)
  const out = span(f, DURATION - 0.5, DURATION)
  if (out > 0) {
    ctx.fillStyle = `rgba(0,0,0,${out})`
    ctx.fillRect(0, 0, W, H)
  }
  return c
}

window.renderStill = async (f) => {
  await setup()
  return (await compose(f)).toDataURL('image/jpeg', 0.88)
}

// The score alone, as 16-bit WAV bytes in base64, for listening to without rendering the picture.
window.renderScore = async () => {
  const b = await score(DURATION, storyAt, { MON, DAY, CHECKS })
  const n = b.length
  const view = new DataView(new ArrayBuffer(44 + n * 4))
  const str = (o, s) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)))
  str(0, 'RIFF')
  view.setUint32(4, 36 + n * 4, true)
  str(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 2, true)
  view.setUint32(24, b.sampleRate, true)
  view.setUint32(28, b.sampleRate * 4, true)
  view.setUint16(32, 4, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, n * 4, true)
  const L = b.getChannelData(0)
  const R = b.getChannelData(1)
  for (let i = 0; i < n; i++) {
    view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true)
    view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true)
  }
  const bytes = new Uint8Array(view.buffer)
  let bin = ''
  for (let j = 0; j < bytes.length; j += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(j, j + 0x8000))
  return btoa(bin)
}

window.renderFilm = async (bitrate = 5e6) => {
  await setup()
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 },
    fastStart: 'in-memory',
  })
  const failures = []
  const video = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => failures.push(e.message) })
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
  const buffer = await score(DURATION, storyAt, { MON, DAY, CHECKS })
  const audio = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => failures.push(e.message) })
  audio.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 })
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
    await window.__save(btoa(bin), off + piece >= bytes.length)
  }
  status.textContent = `done, ${(bytes.length / 1e6).toFixed(1)} MB`
  return bytes.length
}

await document.fonts.load('900 120px Archivo')
await document.fonts.load('700 30px Archivo')
document.getElementById('status').textContent = 'Ready'
window.filmReady = true
