// The film's people: stylised players and a coach on a simple skeleton, dressed in their kits and lit by
// the floodlights, with a soft rim from behind and a little fill from the camera. Everything they do
// (running, looking over a shoulder, kicking, pointing, celebrating) is posed from the time alone, so any
// frame can be rendered on its own.
import * as THREE from 'three'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (v) => v * v * (3 - 2 * v)

/** How much fill light falls on the people from the camera's side, as a film crew would add. */
export const FILL = { value: 0.3 }

/** A material with a soft fresnel rim of light, as if the floodlights were behind the player, and fill. */
export function rimMaterial(rimColor, base = '#0c0e10', strength = 1, roughness = 0.7) {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness, metalness: 0 })
  m.userData.rim = { value: new THREE.Color(rimColor).multiplyScalar(strength) }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = m.userData.rim
    shader.uniforms.uFill = FILL
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;\nuniform float uFill;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float facing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += uRim * pow(1.0 - facing, 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * uFill * pow(facing, 1.5);`,
      )
  }
  return m
}

const mesh = (geometry, material) => {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = true
  return m
}
/** A tapered segment hanging down from its joint. */
function taper(rTop, rBottom, length, material, offset = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, length, 16)
  g.translate(0, -length / 2 - offset, 0)
  return mesh(g, material)
}
const ball = (r, material, y = 0) => {
  const m = mesh(new THREE.SphereGeometry(r, 16, 12), material)
  m.position.y = y
  return m
}

// Kits: Vision in near-black with volt trim; the opposition in slate and white; the coach in black.
const KITS = {
  vision: { shirt: '#10160a', shorts: '#0a0c08', socks: '#141b08', trim: '#d7ff3a' },
  other: { shirt: '#232934', shorts: '#cfd4dc', socks: '#cfd4dc', trim: '#e9ecf1' },
  coach: { shirt: '#131315', shorts: '#131315', socks: '#131315', trim: '#e9e9e4' },
  keeper: { shirt: '#3b3420', shorts: '#16171a', socks: '#3b3420', trim: '#e9ecf1' },
}
// Parents in everyday clothes: long trousers, no trim.
const SHIRTS = ['#3d4250', '#5a4636', '#2f3d34', '#4d3442', '#6b6a62']
const SKIN = ['#4a3226', '#3c281e', '#55392a', '#432d22']

/**
 * A person: a skeleton of joints (THREE.Object3D) dressed in a kit. Proportions are a real athlete's,
 * slightly stylised; the floodlights light them, with a soft rim from behind.
 * team: 'vision', 'other' or 'coach'. build widens the frame a little.
 */
export function makePerson({ height = 1.75, team = 'vision', build = 1, skin = 0, shirt: shirtIndex = 0 } = {}) {
  const s = height / 1.75
  const civil = team === 'parent'
  const kit = civil ? { shirt: SHIRTS[shirtIndex % SHIRTS.length], shorts: '#1b1c21', socks: '#1b1c21', trim: '#1b1c21' } : KITS[team]
  const rim = '#fff0d6'
  const skinM = rimMaterial(rim, SKIN[skin % SKIN.length], 0.35, 0.55)
  const shirt = rimMaterial(rim, kit.shirt, 0.4, 0.75)
  const shorts = rimMaterial(rim, kit.shorts, 0.35, 0.7)
  const socks = rimMaterial(rim, kit.socks, 0.35, 0.8)
  const boots = rimMaterial(rim, '#0b0b0c', 0.3, 0.4)
  const hair = rimMaterial(rim, '#0a0908', 0.25, 0.9)
  const trim = new THREE.MeshStandardMaterial({ color: kit.trim, emissive: kit.trim, emissiveIntensity: team === 'vision' ? 0.28 : civil ? 0 : 0.08, roughness: 0.6 })
  const eyeM = new THREE.MeshStandardMaterial({ color: '#0a0806', roughness: 0.2 })
  const root = new THREE.Group()
  const J = {}
  const joint = (name, parent, x, y, z) => {
    const o = new THREE.Object3D()
    o.position.set(x, y, z)
    parent.add(o)
    J[name] = o
    return o
  }
  const w = build
  const leg = 0.884 * s // hip joint to sole: the leg chain below, so boots meet the turf
  const hips = joint('hips', root, 0, leg, 0)
  // Shorts.
  const pelvis = mesh(new THREE.CapsuleGeometry(0.105 * s * w, 0.1 * s * w, 6, 14), shorts)
  pelvis.rotation.z = Math.PI / 2
  pelvis.scale.set(1, 1, 0.72)
  hips.add(pelvis)
  // The torso: a lathed shirt, narrow at the waist and broad at the shoulders, flattened front to back.
  const spine = joint('spine', hips, 0, 0.03 * s, 0)
  const profile = [
    [0.158, -0.04],
    [0.152, 0.06],
    [0.162, 0.2],
    [0.186, 0.31],
    [0.2, 0.365],
    [0.198, 0.405],
    [0.168, 0.445],
    [0.07, 0.475],
    [0, 0.48],
  ].map(([r, y]) => new THREE.Vector2(r * s * w, y * s))
  const torso = mesh(new THREE.LatheGeometry(profile, 24), shirt) // the hem hangs over the shorts
  torso.scale.z = 0.66
  spine.add(torso)
  const chest = joint('chest', spine, 0, 0.41 * s, 0)
  const collar = mesh(new THREE.TorusGeometry(0.055 * s, 0.012 * s, 6, 18), trim)
  collar.rotation.x = Math.PI / 2
  collar.position.y = 0.05 * s
  chest.add(collar)
  const neck = joint('neck', chest, 0, 0.05 * s, 0)
  neck.add(taper(0.048 * s, 0.052 * s, 0.09 * s, skinM, -0.09 * s))
  // The head: an egg, with hair, ears, brows, eyes and a nose, so a face reads even at a distance.
  const R = 0.098 * s
  const skull = new THREE.Group()
  skull.position.y = 0.14 * s
  skull.scale.set(0.86, 1.07, 0.98)
  neck.add(skull)
  const head = mesh(new THREE.SphereGeometry(R, 28, 20), skinM)
  skull.add(head)
  const cap = mesh(new THREE.SphereGeometry(R * 1.045, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair)
  cap.rotation.x = -0.5 // hairline high at the front, low at the back
  skull.add(cap)
  const on = (m, x, y, z, k = 1) => {
    m.position.set(x, y, z).normalize().multiplyScalar(R * k)
    skull.add(m)
    return m
  }
  for (const side of [-1, 1]) {
    on(mesh(new THREE.SphereGeometry(R * 0.13, 10, 8), eyeM), side * 0.36, 0.1, 0.93, 0.93)
    const brow = on(mesh(new THREE.BoxGeometry(R * 0.36, R * 0.08, R * 0.12), hair), side * 0.38, 0.32, 0.87, 1.0)
    brow.rotation.set(-0.3, side * 0.35, side * 0.06)
    const ear = on(mesh(new THREE.SphereGeometry(R * 0.22, 10, 8), skinM), side, -0.04, -0.06, 0.97)
    ear.scale.set(0.45, 1, 0.75)
  }
  const nose = on(mesh(new THREE.SphereGeometry(R * 0.17, 10, 8), skinM), 0, -0.1, 1, 0.97)
  nose.scale.set(0.75, 1.3, 1)
  J.headMesh = head
  for (const side of [-1, 1]) {
    const n = side < 0 ? 'R' : 'L' // facing +z, +x is the person's left
    const shoulder = joint(`shoulder${n}`, chest, side * 0.178 * s * w, -0.035 * s, 0)
    shoulder.add(ball(0.056 * s * w, shirt))
    shoulder.add(taper(0.057 * s * w, 0.064 * s, 0.14 * s, shirt, -0.01 * s)) // a sleeve, flaring a little
    const cuff = mesh(new THREE.TorusGeometry(0.064 * s, 0.009 * s, 6, 16), trim)
    cuff.rotation.x = Math.PI / 2
    cuff.position.y = -0.13 * s
    shoulder.add(cuff)
    shoulder.add(taper(0.05 * s, 0.043 * s, 0.16 * s, skinM, 0.12 * s))
    const elbow = joint(`elbow${n}`, shoulder, 0, -0.285 * s, 0)
    elbow.add(ball(0.043 * s, skinM))
    elbow.add(taper(0.042 * s, 0.032 * s, 0.24 * s, skinM))
    const hand = ball(0.042 * s, skinM, -0.27 * s)
    hand.scale.set(0.8, 1.25, 0.6)
    elbow.add(hand)
    const hip = joint(`hip${n}`, hips, side * 0.09 * s * w, -0.03 * s, 0)
    hip.add(taper(0.082 * s * w, 0.076 * s * w, 0.2 * s, shorts))
    hip.add(taper(0.076 * s * w, 0.06 * s, 0.22 * s, civil ? shorts : skinM, 0.18 * s))
    const knee = joint(`knee${n}`, hip, 0, -0.4 * s, 0)
    knee.add(ball(0.058 * s, civil ? shorts : skinM))
    knee.add(taper(0.06 * s, 0.04 * s, 0.37 * s, socks, 0.02 * s))
    const sockBand = mesh(new THREE.TorusGeometry(0.06 * s, 0.008 * s, 6, 16), trim)
    sockBand.rotation.x = Math.PI / 2
    sockBand.position.y = -0.05 * s
    knee.add(sockBand)
    const ankle = joint(`ankle${n}`, knee, 0, -0.39 * s, 0)
    const boot = mesh(new THREE.CapsuleGeometry(0.045 * s, 0.15 * s, 6, 12), boots)
    boot.rotation.x = Math.PI / 2
    boot.scale.set(1.05, 1, 0.75)
    boot.position.set(0, -0.03 * s, 0.065 * s)
    ankle.add(boot)
  }
  root.userData = { J, height, s, legLen: leg }
  return root
}

// ---------- Moving and posing from time alone ----------

/** Piecewise-cubic interpolation of [t, ...values] keys (Catmull-Rom style, clamped at the ends). */
export function keys(list) {
  const n = list.length
  return (t) => {
    if (t <= list[0][0]) return list[0].slice(1)
    if (t >= list[n - 1][0]) return list[n - 1].slice(1)
    let i = 0
    while (t > list[i + 1][0]) i++
    const [t0] = list[i]
    const [t1] = list[i + 1]
    const u = smooth((t - t0) / (t1 - t0))
    return list[i].slice(1).map((v, k) => v + (list[i + 1][k + 1] - v) * u)
  }
}

/**
 * A character's whole performance. path: [[t, x, z], …] (smoothly eased between keys, so a key
 * repeated holds still). look: [[t, yaw, pitch], …] the head relative to the body. face: optional
 * [[t, angle], …] overrides facing the way they move. acts: [{ type, at, dur }].
 */
export function perform(person, { path, look = [[0, 0, 0]], face = null, acts = [] }) {
  const pos = keys(path)
  const head = keys(look)
  const facing = face && keys(face)
  // Distance travelled, sampled finely, so strides match the ground covered (no foot sliding).
  const t0 = path[0][0]
  const t1 = path[path.length - 1][0] + 2
  const step = 1 / 120
  const dist = [0]
  const heading = [0]
  let prev = pos(t0)
  let lastHeading = facing ? facing(t0)[0] : 0
  for (let t = t0 + step; t <= t1 + step; t += step) {
    const p = pos(t)
    const d = Math.hypot(p[0] - prev[0], p[1] - prev[1])
    dist.push(dist[dist.length - 1] + d)
    if (d > 0.0005) lastHeading = Math.atan2(p[0] - prev[0], p[1] - prev[1])
    heading.push(lastHeading)
    prev = p
  }
  const at = (arr, t) => {
    const x = Math.max(0, (t - t0) / step)
    const i = Math.min(Math.floor(x), arr.length - 2)
    return arr[i] + (arr[i + 1] - arr[i]) * (x - i)
  }
  // Heading turns smoothly rather than snapping when a run changes direction.
  const headingAt = (t) => {
    let sx = 0
    let sz = 0
    for (let k = -6; k <= 0; k++) {
      const h = heading[Math.max(0, Math.min(heading.length - 1, Math.round((t - t0) / step) + k * 6))]
      sx += Math.sin(h)
      sz += Math.cos(h)
    }
    return Math.atan2(sx, sz)
  }
  person.userData.perf = { pos, head, facing, acts, dist: (t) => at(dist, t), speed: (t) => (at(dist, t + 0.05) - at(dist, t - 0.05)) / 0.1, headingAt }
}

/** Where a performer's feet are at time t (for placing the ball), in world space. */
export function footPoint(person, t, side = 'R', reach = 0.35) {
  const { pos, headingAt, facing } = person.userData.perf
  const [x, z] = pos(t)
  const h = facing ? facing(t)[0] : headingAt(t)
  const sideOff = side === 'R' ? -0.12 : 0.12
  return new THREE.Vector3(x + Math.sin(h) * reach + Math.cos(h) * sideOff, 0.11, z + Math.cos(h) * reach - Math.sin(h) * sideOff)
}

const actWeight = (t, a) => {
  const u = (t - a.at) / a.dur
  if (u < 0 || u > 1) return 0
  return u
}

/** Sets every joint for time t. */
export function pose(person, t) {
  const { J, s, legLen } = person.userData
  const P = person.userData.perf
  const [x, z] = P.pos(t)
  const speed = P.speed(t)
  const run = clamp01(speed / 7) // 0 standing … 1 sprinting
  const moving = clamp01(speed / 1.2)
  const phase = (P.dist(t) / (1.3 * s + 0.5 * run)) * Math.PI
  const heading = P.facing ? P.facing(t)[0] : P.headingAt(t)
  person.position.set(x, 0, z)
  person.rotation.y = heading

  // Gait: thighs swing, knees fold on the back swing, arms counter-swing, a little bounce and lean.
  const A = (0.25 + 0.65 * run) * moving
  const swing = Math.sin(phase)
  for (const [n, sgn] of [['L', 1], ['R', -1]]) {
    const sw = swing * sgn
    J[`hip${n}`].rotation.set(-sw * A, 0, 0)
    J[`knee${n}`].rotation.set(Math.max(0, -Math.sin(phase * 1 + (sgn > 0 ? 0 : Math.PI) - 0.6)) * (0.3 + 1.3 * run) * moving + 0.05, 0, 0)
    J[`ankle${n}`].rotation.set(0, 0, 0)
    J[`shoulder${n}`].rotation.set(sw * A * 0.9, 0, sgn * 0.11)
    J[`elbow${n}`].rotation.set(-0.35 - 0.9 * run * moving, 0, 0)
  }
  J.hips.position.y = legLen - 0.02 - (0.03 + 0.05 * run) * moving + Math.abs(Math.cos(phase)) * 0.05 * run
  J.spine.rotation.set(0.05 + 0.28 * run * moving, Math.sin(phase) * 0.12 * run, 0)
  // Standing: a breath and a soft knee.
  if (moving < 0.2) {
    const b = Math.sin(t * 1.9 + x) * 0.015
    J.chest.rotation.x = b
    for (const n of ['L', 'R']) J[`knee${n}`].rotation.x = 0.12
  } else J.chest.rotation.x = 0

  // The head: where they are looking (yaw, pitch) relative to the body.
  const [yaw, pitch] = P.head(t)
  J.neck.rotation.set(pitch, yaw, 0)
  J.chest.rotation.y = yaw * 0.25

  for (const a of P.acts) {
    const u = actWeight(t, a)
    if (!u) continue
    const e = Math.sin(Math.PI * u)
    if (a.type === 'kick') {
      // Right foot: wind back, then strike through, body leaning back a touch.
      const k = u < 0.45 ? -smooth(u / 0.45) : -1 + 2.4 * smooth((u - 0.45) / 0.55)
      J.hipR.rotation.x = -k * 0.95
      J.kneeR.rotation.x = u < 0.45 ? 1.3 * smooth(u / 0.45) : 1.3 * (1 - smooth((u - 0.45) / 0.3))
      J.shoulderL.rotation.x = -0.9 * e
      J.shoulderR.rotation.z = -0.6 * e
      J.spine.rotation.x = 0.05 - 0.2 * e
      J.hipL.rotation.x = 0.08
      J.kneeL.rotation.x = 0.25
    }
    if (a.type === 'touch') {
      J.hipL.rotation.x = -0.45 * e
      J.kneeL.rotation.x = 0.2 * e
      J.spine.rotation.x = 0.2
    }
    if (a.type === 'point') {
      // Two fingers to the eyes, then a sweep: "look".
      J.shoulderR.rotation.set(-1.75 * smooth(Math.min(1, u * 3)), 0, -0.35)
      J.elbowR.rotation.x = -2.0 * smooth(Math.min(1, u * 3))
      if (u > 0.55) {
        const v = (u - 0.55) / 0.45
        J.shoulderR.rotation.set(-1.5, 0, -0.35 - Math.sin(v * Math.PI * 2) * 0.8)
        J.elbowR.rotation.x = -0.4
      }
    }
    if (a.type === 'celebrate') {
      const up = smooth(Math.min(1, u * 4))
      J.shoulderL.rotation.set(-2.7 * up, 0, 0.3)
      J.shoulderR.rotation.set(-2.7 * up, 0, -0.3)
      J.elbowL.rotation.x = -0.2
      J.elbowR.rotation.x = -0.2
      person.position.y = Math.abs(Math.sin(u * Math.PI * 3)) * 0.35 * (1 - u * 0.5)
    }
    if (a.type === 'stumble') {
      J.spine.rotation.set(0.5 * e, 0.6 * e, 0.25 * e)
      J.neck.rotation.x = 0.4 * e
      J.shoulderL.rotation.z = 0.9 * e
      J.shoulderR.rotation.z = -0.9 * e
    }
    if (a.type === 'dive') {
      // The keeper: a full-stretch dive to one side.
      const d = smooth(Math.min(1, u * 2.2))
      person.rotation.z = (a.side || 1) * 1.25 * d
      person.position.x += Math.cos(person.rotation.y) * (a.side || 1) * 1.2 * d
      person.position.y = Math.sin(d * Math.PI) * 0.5
      J.shoulderL.rotation.set(-2.6 * d, 0, 0)
      J.shoulderR.rotation.set(-2.6 * d, 0, 0)
    }
    if (a.type === 'slump') {
      J.spine.rotation.x = 0.35 * e
      J.neck.rotation.x = 0.5 * e
      J.shoulderL.rotation.x = 0.1
      J.shoulderR.rotation.x = 0.1
    }
  }
  person.updateMatrixWorld(true)
}

/** World position of a performer's head, for focus and the scanning beams. */
export function headPoint(person) {
  const v = new THREE.Vector3()
  person.userData.J.headMesh.getWorldPosition(v)
  return v
}
/** World direction the head faces. */
export function gazeDirection(person) {
  const q = new THREE.Quaternion()
  person.userData.J.neck.getWorldQuaternion(q)
  return new THREE.Vector3(0, 0, 1).applyQuaternion(q).setY(0).normalize()
}
