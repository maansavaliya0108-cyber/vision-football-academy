import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { director, tick } from './director'
import { introProgress, span, storyState } from './timeline'
import { PASS_PATHS, ballShape, pitchShape, playShape, scatterShape, wordShape, wordmarkShape } from './shapes'

const Effects = lazy(() => import('./Effects.jsx'))

const BALL_RADIUS = 2.3
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt))

const vertexShader = /* glsl */ `
  attribute vec3 posB;
  attribute vec3 posC;
  attribute vec3 posD;
  attribute vec3 posE;
  attribute vec3 aScatter;
  attribute vec4 aKind;   // kind in formations A, B, C, D
  attribute float aKindE; // kind in formation E
  attribute float aRand;
  attribute float aSize;
  attribute float aU;     // position along the pass, for stream particles

  // The story now, and a moment ago (for the light trails).
  uniform float uStage, uTime, uStream, uIntro, uSpin;
  uniform float uStageLag, uTimeLag, uStreamLag, uIntroLag, uSpinLag;
  // 0 draws the particle itself; above 0 draws a copy that far back along its trail.
  uniform float uTrail;
  uniform float uTrailGain;

  uniform float uInteract;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uFocus;     // distance the camera is focused at
  uniform float uAperture;  // how quickly things blur away from it
  uniform float uFlash;
  uniform vec3 uMouse;
  uniform vec3 uPathA[3];
  uniform vec3 uPathB[3];
  uniform float uShock, uShockAge;
  uniform vec3 uShockAt;
  uniform float uSweep, uSweepOn;

  varying vec3 vColor;
  varying float vAlpha;

  const float PI = 3.14159265;

  vec3 bezier(vec3 a, vec3 b, vec3 c, float t) { return mix(mix(a, b, t), mix(b, c, t), t); }
  // Quintic ease: zero velocity and zero acceleration at both ends, so nothing ever lurches.
  float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }

  vec3 kindColor(float k) {
    if (k < 0.5) return vec3(0.55);                          // pitch lines
    if (k < 1.5) return vec3(0.95);                          // white
    if (k < 2.5) return vec3(0.84, 1.0, 0.23) * 1.25;        // volt
    if (k < 3.5) return vec3(0.84, 1.0, 0.23) * 1.9;         // the pass, brightest
    return vec3(0.12);                                       // dust
  }

  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

  // A divergence-free flow (the curl of travelling waves), in two octaves. Everything nearby moves
  // together, so particles in flight pour like a liquid instead of jittering.
  vec3 flow(vec3 p, float t) {
    vec3 v = vec3(
      cos(p.y * 1.3 + t * 0.9) - cos(p.z * 1.1 - t * 0.7),
      cos(p.z * 1.3 + t * 0.8) - cos(p.x * 1.1 + t * 0.6),
      cos(p.x * 1.3 - t * 0.5) - cos(p.y * 1.1 + t * 0.9)
    );
    vec3 q = p * 2.3 + 4.0;
    v += 0.45 * vec3(
      cos(q.y * 1.3 - t * 1.1) - cos(q.z * 1.1 + t * 0.8),
      cos(q.z * 1.3 + t * 1.2) - cos(q.x * 1.1 - t * 0.9),
      cos(q.x * 1.3 + t * 0.7) - cos(q.y * 1.1 - t * 1.0)
    );
    return v;
  }

  // When each particle sets off. Shapes build in order rather than all at once: the word and the
  // wordmark from left to right, the pitch from the near end to the far one.
  float delayFor(float fi, vec3 to) {
    if (fi < 0.5) return mix(aRand, clamp(to.x / 10.0 + 0.5, 0.0, 1.0), 0.65);
    if (fi < 1.5) return mix(aRand, clamp(0.5 - to.z / 9.6, 0.0, 1.0), 0.6);
    if (fi < 2.5) return aRand * 0.6;
    return mix(aRand, clamp(to.x / 11.0 + 0.5, 0.0, 1.0), 0.6);
  }

  vec3 place(float stage, float time, float stream, float intro, float spin, out float fi, out float tt) {
    // A spins; D's stream particles flow along the pass.
    vec3 A = rotY(spin) * rotX(0.35) * position;
    vec3 D = posD;
    if (aKind.w > 2.5 && aKind.w < 3.5) {
      float u = fract(aU + stream * 0.16);
      D = u < 0.5 ? bezier(uPathA[0], uPathA[1], uPathA[2], u * 2.0)
                  : bezier(uPathB[0], uPathB[1], uPathB[2], u * 2.0 - 1.0);
      D.y += sin(fract(u * 2.0) * PI) * 0.28;
      D += (vec3(fract(aRand * 13.1), fract(aRand * 7.7), fract(aRand * 3.3)) - 0.5) * 0.14;
    }

    float s = clamp(stage, 0.0, 3.999);
    fi = floor(s);
    float t = s - fi;
    vec3 from; vec3 to;
    if (fi < 0.5)      { from = A;    to = posB; }
    else if (fi < 1.5) { from = posB; to = posC; }
    else if (fi < 2.5) { from = posC; to = D; }
    else               { from = D;    to = posE; }
    tt = ease((t - delayFor(fi, to) * 0.45) / 0.55);

    vec3 p = mix(from, to, tt);
    // The ball bursts outward first; the cloud then gathers into the word.
    if (fi < 0.5) p += normalize(A + 0.0001) * sin(PI * clamp(t / 0.8, 0.0, 1.0)) * (2.2 + aRand * 2.6);
    // In flight, everything is carried by the flow.
    p += flow(p * 0.35, time * 0.35) * sin(tt * PI) * 0.9;

    // Intro: pour in from the scattered cloud and assemble.
    float it = ease((intro - aRand * 0.4) / 0.6);
    p = mix(aScatter, p, it);
    p += flow(p * 0.3, time * 0.3) * (1.0 - it) * 0.8;

    // A slow breath, so a formation is never perfectly still.
    p += flow(p * 0.7, time * 0.2) * 0.012;
    return p;
  }

  void main() {
    float fi; float tt;
    vec3 p = place(uStage, uTime, uStream, uIntro, uSpin, fi, tt);

    float trail = 1.0;
    if (uTrail > 0.0) {
      float fiL; float ttL;
      vec3 q = place(uStageLag, uTimeLag, uStreamLag, uIntroLag, uSpinLag, fiL, ttL);
      // Copies only show while a particle is really moving; at rest the trail folds into it.
      trail = smoothstep(0.04, 0.35, length(p - q)) * pow(1.0 - uTrail, 1.4) * uTrailGain;
      p = mix(p, q, uTrail);
    }

    // The shockwave: a ring that rolls outward, pushing particles aside and lighting them up.
    vec3 fromShock = p - uShockAt;
    float r = length(fromShock);
    float band = exp(-pow((r - uShockAge * 7.5) * 1.4, 2.0)) * exp(-uShockAge * 1.7) * uShock;
    p += normalize(fromShock + 0.0001) * band * 0.8;

    // The cursor pushes particles aside in the ball and wordmark formations.
    vec3 d = p - uMouse;
    p += normalize(d + 0.0001) * smoothstep(1.4, 0.0, length(d)) * 0.8 * uInteract;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;

    // Depth of field: points away from the focus distance grow and fade, like bokeh.
    float blur = min(abs(depth - uFocus) / max(uFocus, 0.001) * uAperture, 2.0);
    float twinkle = 0.92 + 0.08 * sin(uTime * 0.8 + aRand * 50.0);
    float size = uSize * aSize * uPixelRatio * twinkle / max(depth, 0.1) * (1.0 + blur * 1.8) * mix(1.0, 0.55, uTrail);
    // Never smaller than ~1.6 px (sub-pixel points flicker), never a screen-filling blot up close.
    gl_PointSize = clamp(size, 1.6 * uPixelRatio, 36.0 * uPixelRatio);

    float kf; float kt;
    if (fi < 0.5)      { kf = aKind.x; kt = aKind.y; }
    else if (fi < 1.5) { kf = aKind.y; kt = aKind.z; }
    else if (fi < 2.5) { kf = aKind.z; kt = aKind.w; }
    else               { kf = aKind.w; kt = aKindE; }
    float sweep = exp(-pow((p.z - uSweep) * 2.2, 2.0)) * uSweepOn;
    vColor = mix(kindColor(kf), kindColor(kt), tt) * (1.0 + band * 2.5 + sweep * 1.6 + uFlash * 0.5);

    // The far side of the ball is dimmer, so it reads as a solid sphere rather than a cage.
    float facing = 1.0;
    if (fi < 0.5) {
      vec3 A = rotY(uSpin) * rotX(0.35) * position;
      vec3 n = normalize((viewMatrix * vec4(A, 0.0)).xyz);
      facing = mix(mix(0.16, 1.0, smoothstep(-0.2, 0.6, n.z)), 1.0, tt);
    }
    float it = ease((uIntro - aRand * 0.4) / 0.6);
    float near = smoothstep(0.25, 1.2, depth);
    vAlpha = mix(0.35, 1.0, it) * facing * trail * near / (1.0 + blur * 1.2);
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * vAlpha;
    gl_FragColor = vec4(vColor * a, a);
  }
`

// Give the browser a turn between steps, so building the scene never blocks a tap or a scroll for long.
const yieldToPage = () => new Promise((r) => setTimeout(r, 0))

async function buildGeometry(n) {
  const A = ballShape(n, BALL_RADIUS)
  await yieldToPage()
  const B = wordShape(n)
  await yieldToPage()
  const C = pitchShape(n)
  await yieldToPage()
  const D = playShape(n)
  await yieldToPage()
  const E = wordmarkShape(n)
  await yieldToPage()
  const kinds = new Float32Array(n * 4)
  const rand = new Float32Array(n)
  const size = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    kinds.set([A.kind[i], B.kind[i], C.kind[i], D.kind[i]], i * 4)
    rand[i] = Math.random()
    size[i] = 0.6 + Math.random() * 0.9
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(A.pos, 3))
  g.setAttribute('posB', new THREE.BufferAttribute(B.pos, 3))
  g.setAttribute('posC', new THREE.BufferAttribute(C.pos, 3))
  g.setAttribute('posD', new THREE.BufferAttribute(D.pos, 3))
  g.setAttribute('posE', new THREE.BufferAttribute(E.pos, 3))
  g.setAttribute('aScatter', new THREE.BufferAttribute(scatterShape(n), 3))
  g.setAttribute('aKind', new THREE.BufferAttribute(kinds, 4))
  g.setAttribute('aKindE', new THREE.BufferAttribute(E.kind, 1))
  g.setAttribute('aRand', new THREE.BufferAttribute(rand, 1))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.setAttribute('aU', new THREE.BufferAttribute(D.u, 1))
  // Particles move far from their rest positions; never let the whole cloud be culled.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100)
  return g
}

const toVec = (p) => new THREE.Vector3(...p)
const MAX_TRAILS = 5

/** Runs first every frame: advances the story clock that everything else reads. */
function Director() {
  useFrame((_, dt) => tick(Math.min(dt, 0.1)))
  return null
}

function Formation({ count, trails, onReady }) {
  const [geometry, setGeometry] = useState(null)
  const ready = useRef(false)
  const gl = useThree((s) => s.gl)
  const viewport = useThree((s) => s.size)

  // One set of uniforms shared by the particles and every trail copy; each copy adds its own uTrail.
  const uniforms = useMemo(
    () => ({
      uStage: { value: 0 },
      uTime: { value: 0 },
      uStream: { value: 0 },
      uIntro: { value: 0 },
      uSpin: { value: 0 },
      uStageLag: { value: 0 },
      uTimeLag: { value: 0 },
      uStreamLag: { value: 0 },
      uIntroLag: { value: 0 },
      uSpinLag: { value: 0 },
      uTrailGain: { value: 0.5 },
      uInteract: { value: 1 },
      uSize: { value: 44 },
      uPixelRatio: { value: 1 },
      uFocus: { value: 14 },
      uAperture: { value: 0 },
      uFlash: { value: 0 },
      uMouse: { value: new THREE.Vector3(99, 99, 99) },
      uPathA: { value: PASS_PATHS[0].map(toVec) },
      uPathB: { value: PASS_PATHS[1].map(toVec) },
      uShock: { value: 0 },
      uShockAge: { value: 99 },
      uShockAt: { value: new THREE.Vector3() },
      uSweep: { value: -99 },
      uSweepOn: { value: 0 },
    }),
    [],
  )
  const materials = useMemo(
    () =>
      Array.from(
        { length: MAX_TRAILS + 1 },
        (_, k) =>
          new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { ...uniforms, uTrail: { value: k / MAX_TRAILS } },
          }),
      ),
    [uniforms],
  )
  // With fewer trail copies, spread them over the same trail length.
  useEffect(() => {
    for (let k = 1; k <= trails; k++) materials[k].uniforms.uTrail.value = k / trails
  }, [materials, trails])

  // The word and the wordmark are drawn with the page font, so wait for it before sampling.
  useEffect(() => {
    let live = true
    const fonts = document.fonts ? document.fonts.load('900 230px Archivo').catch(() => {}) : Promise.resolve()
    fonts
      .then(() => buildGeometry(count))
      .then((g) => live && setGeometry(g))
    return () => {
      live = false
    }
  }, [count])

  const interact = useRef(0)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const u = uniforms
    const d = director
    // The intro starts with the first frame that actually has particles in it.
    if (geometry && !ready.current) {
      ready.current = true
      storyState.introAt = performance.now()
      onReady?.()
    }
    u.uStage.value = d.stage
    u.uTime.value = d.time
    u.uStream.value = d.stream
    u.uIntro.value = d.intro
    u.uSpin.value = d.spin
    u.uStageLag.value = d.lag.stage
    u.uTimeLag.value = d.lag.time
    u.uStreamLag.value = d.lag.stream
    u.uIntroLag.value = d.lag.intro
    u.uSpinLag.value = d.lag.spin
    u.uFocus.value = d.focus
    u.uAperture.value = d.aperture
    u.uFlash.value = d.flash
    u.uShock.value = d.shock
    u.uShockAge.value = Math.min(d.shockAge, 99)
    u.uShockAt.value.set(...d.shockAt)
    u.uSweep.value = d.sweep
    u.uSweepOn.value = d.sweepOn
    u.uPixelRatio.value = gl.getPixelRatio()
    // Phones frame everything from further away, so the points are drawn larger to match.
    u.uSize.value = viewport.width / viewport.height < 0.85 ? 78 : 44
    // The cursor only disturbs the ball and the wordmark, and only while it is moving; then they heal.
    const moving = performance.now() - storyState.pointerAt < 1800 ? 1 : 0
    const where = Math.max(1 - span(d.p, 0, 0.08), span(d.p, 0.9, 0.98))
    interact.current = damp(interact.current, moving * where, moving ? 6 : 1.5, dt)
    u.uInteract.value = interact.current
    // Where the pointer meets the plane the ball and wordmark sit on.
    ray.setFromCamera({ x: storyState.pointerX, y: storyState.pointerY }, state.camera)
    if (ray.ray.intersectPlane(plane, hit)) u.uMouse.value.lerp(hit, 1 - Math.exp(-5 * dt))
  })

  if (!geometry) return null
  return materials
    .slice(0, trails + 1)
    .map((m, k) => <points key={k} geometry={geometry} material={m} frustumCulled={false} />)
}

/** Faint distant points that give the black some depth as the camera moves. */
function StarField({ count }) {
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 30 + Math.random() * 40
      const a = Math.random() * Math.PI * 2
      const b = Math.acos(2 * Math.random() - 1)
      pos.set([Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [count])
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.09} color="#8a8a86" transparent opacity={0.55} depthWrite={false} sizeAttenuation />
    </points>
  )
}

// Monotone cubic interpolation (Fritsch–Carlson): a smooth curve through every key that never
// overshoots one, so the camera glides between shots instead of stopping at each.
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

/**
 * The camera's path through the story, keyed to scroll progress. `move` marks the in-between shots
 * (the dive, the swoop, the tracking shot); with reduced motion the camera skips them.
 * shift/lift frame the scene to the right of the copy on wide screens; back/drop/dz pull back and
 * lower it on portrait phones. dof is how strongly things out of focus blur.
 */
const SHOTS = [
  { p: 0.0, pos: [0, 0.3, 14], at: [0, -0.2, 0], fov: 38, roll: 0, dof: 0.15, shift: -3.8, lift: -1.1, back: 1.75, drop: -1.6, dz: 0 },
  // A slow push-in on the ball while the hero is read.
  { p: 0.1, pos: [0.6, 0.1, 11.6], at: [0, -0.15, 0], fov: 38, roll: -0.02, dof: 0.2, shift: -3.4, lift: -0.9, back: 1.7, drop: -1.6, dz: 0 },
  // Diving into the ball as it bursts, then out again as the word forms.
  { move: true, p: 0.165, pos: [0.15, 0.05, 4.2], at: [0, 0, -2], fov: 52, roll: 0.12, dof: 0.45, shift: -0.6, lift: 0, back: 1.2, drop: 0, dz: 0 },
  { move: true, p: 0.2, pos: [0, 0.1, 2.9], at: [0, 0, -3], fov: 58, roll: 0.2, dof: 0.55, shift: 0, lift: 0, back: 1.2, drop: 0, dz: 0 },
  { p: 0.28, pos: [0, 0.25, 13.5], at: [0, 0, 0], fov: 40, roll: 0, dof: 0.25, shift: -3.4, lift: 0, back: 2.1, drop: -3.4, dz: 0 },
  // A slow dolly across the word, so its depth shows.
  { p: 0.38, pos: [-1.1, 0.6, 12.4], at: [0, 0, 0], fov: 40, roll: 0.02, dof: 0.3, shift: -3.2, lift: 0, back: 2.1, drop: -3.4, dz: 0 },
  // A low swoop across the pitch as its lines are drawn, then a crane up to the tactical view.
  { move: true, p: 0.46, pos: [3.4, 1.4, 7.2], at: [0, 0, -1.2], fov: 48, roll: -0.1, dof: 0.6, shift: -1.5, lift: 0, back: 1.5, drop: 0, dz: 0.8 },
  { p: 0.54, pos: [0, 10.5, 6.2], at: [0, 0, -0.4], fov: 38, roll: 0, dof: 0.12, shift: -3.8, lift: 0, back: 1.75, drop: 0, dz: 2.2 },
  { p: 0.64, pos: [0.9, 10.2, 5.8], at: [0, 0, -0.4], fov: 38, roll: 0, dof: 0.12, shift: -3.8, lift: 0, back: 1.75, drop: 0, dz: 2.2 },
  // Down to the turf beside the passer, then riding along with the pass to the striker.
  { move: true, p: 0.7, pos: [2.3, 1.6, 2.5], at: [0.3, 0, -0.6], fov: 46, roll: -0.06, dof: 0.5, shift: -1.6, lift: 0, back: 1.4, drop: 0, dz: 0.8 },
  { move: true, p: 0.84, pos: [1.3, 1.1, -1.5], at: [-1, 0, -3.6], fov: 46, roll: -0.04, dof: 0.5, shift: -1.4, lift: 0, back: 1.4, drop: 0, dz: 0.8 },
  // A crane pull-back to reveal the wordmark.
  { p: 0.96, pos: [0, 0, 15.5], at: [0, 0, 0], fov: 38, roll: 0, dof: 0.1, shift: -1.2, lift: 0, back: 2.6, drop: -4, dz: 0 },
  { p: 1, pos: [0, 0, 15], at: [0, 0, 0], fov: 38, roll: 0, dof: 0.1, shift: -1.2, lift: 0, back: 2.6, drop: -4, dz: 0 },
]

function cameraPath(shots) {
  const xs = shots.map((s) => s.p)
  const channel = (get) => monotone(xs, shots.map(get))
  const c = {
    pos: [0, 1, 2].map((k) => channel((s) => s.pos[k])),
    at: [0, 1, 2].map((k) => channel((s) => s.at[k])),
  }
  for (const key of ['fov', 'roll', 'dof', 'shift', 'lift', 'back', 'drop', 'dz']) c[key] = channel((s) => s[key])
  return c
}
const FULL_PATH = cameraPath(SHOTS)
const CALM_PATH = cameraPath(SHOTS.filter((s) => !s.move))

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const look = useRef(new THREE.Vector3())
  const first = useRef(true)
  useFrame((state, dt) => {
    const reduced = storyState.reduced
    const path = reduced ? CALM_PATH : FULL_PATH
    const p = director.p
    const pos = path.pos.map((f) => f(p))
    const target = path.at.map((f) => f(p))

    if (size.width / size.height < 0.85) {
      // Portrait: step back so wide formations fit, and keep the scene in the upper half.
      const back = path.back(p)
      for (let k = 0; k < 3; k++) pos[k] = target[k] + (pos[k] - target[k]) * back
      const drop = path.drop(p)
      pos[1] += drop
      target[1] += drop
      const dz = path.dz(p)
      pos[2] += dz
      target[2] += dz
    } else {
      const shift = path.shift(p)
      const lift = path.lift(p)
      pos[0] += shift
      target[0] += shift
      target[1] += lift
      pos[1] += lift * 0.3
    }

    if (!reduced) {
      // Always drifting a little, and shaken briefly by the hits.
      const tm = state.clock.elapsedTime
      pos[0] += Math.sin(tm * 0.15) * 0.35 + Math.sin(tm * 41) * director.shake
      pos[1] += Math.sin(tm * 0.21) * 0.2 + Math.sin(tm * 37 + 1.3) * director.shake
    }
    pos[0] += storyState.pointerX * 0.35
    pos[1] += storyState.pointerY * 0.2
    // Pulled back at first, so the intro is a push-in.
    pos[2] += (1 - introProgress()) * 6

    // The path is already smooth; this only softens pointer moves and the first frame.
    const k = first.current ? 1e3 : 8
    first.current = false
    camera.position.set(damp(camera.position.x, pos[0], k, dt), damp(camera.position.y, pos[1], k, dt), damp(camera.position.z, pos[2], k, dt))
    look.current.set(damp(look.current.x, target[0], k, dt), damp(look.current.y, target[1], k, dt), damp(look.current.z, target[2], k, dt))
    camera.lookAt(look.current)
    if (!reduced) camera.rotateZ(path.roll(p))
    const fov = path.fov(p)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    director.focus = camera.position.distanceTo(look.current)
    director.aperture = reduced ? 0 : path.dof(p)
  })
  return null
}

/** Watches the frame rate once the intro is done, and steps quality down if it can't keep up. */
function FrameWatch({ onSlow }) {
  const frames = useRef([])
  useFrame((_, dt) => {
    if (introProgress() < 1) return
    frames.current.push(dt)
    if (frames.current.length < 120) return
    const avg = frames.current.reduce((a, b) => a + b, 0) / frames.current.length
    frames.current = []
    if (avg > 1 / 40) onSlow()
  })
  return null
}

// Quality levels: 2 is glow plus five trail copies, 1 is two trail copies, 0 is the particles alone.
// Reduced motion keeps the glow (it isn't motion) but never draws trails.
const TRAILS = [0, 2, MAX_TRAILS]

export default function ParticleCanvas({ active, lite, reduced, onReady }) {
  const [quality, setQuality] = useState(lite ? 1 : 2)
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 16], fov: 38, near: 0.1, far: 300 }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      aria-hidden="true"
    >
      <color attach="background" args={['#060607']} />
      <Director />
      {quality > 0 && <FrameWatch key={quality} onSlow={() => setQuality((q) => Math.max(0, q - 1))} />}
      <StarField count={lite ? 700 : 1600} />
      <Formation count={lite ? 16000 : 26000} trails={reduced ? 0 : TRAILS[quality]} onReady={onReady} />
      <CameraRig />
      {quality === 2 && (
        <Suspense fallback={null}>
          <Effects />
        </Suspense>
      )}
    </Canvas>
  )
}
