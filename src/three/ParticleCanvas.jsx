import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { introProgress, span, stageAt, storyState } from './timeline'
import {
  PASS_PATHS,
  ballShape,
  pitchShape,
  playShape,
  scatterShape,
  vortexShape,
  wordmarkShape,
} from './shapes'

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

  uniform float uTime;
  uniform float uStage;
  uniform float uIntro;
  uniform float uSpin;
  uniform float uInteract;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uMouse;
  uniform vec3 uPathA[3];
  uniform vec3 uPathB[3];

  varying vec3 vColor;
  varying float vAlpha;

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

  // Cheap flowing turbulence: enough to make transitions swirl like smoke.
  vec3 swirl(vec3 p, float t) {
    return vec3(
      sin(p.y * 1.7 + t + aRand * 6.28),
      sin(p.z * 1.3 + t * 1.3 + aRand * 4.0),
      sin(p.x * 1.5 + t * 0.9 + aRand * 2.0)
    );
  }

  void main() {
    // Formation A spins; B turns slowly; D's stream particles flow along the pass.
    vec3 A = rotY(uSpin) * rotX(0.35) * position;
    vec3 B = rotY(uTime * 0.12) * posB;
    vec3 D = posD;
    if (aKind.w > 2.5 && aKind.w < 3.5) {
      float u = fract(aU + uTime * 0.16);
      D = u < 0.5 ? bezier(uPathA[0], uPathA[1], uPathA[2], u * 2.0)
                  : bezier(uPathB[0], uPathB[1], uPathB[2], u * 2.0 - 1.0);
      D.y += sin(fract(u * 2.0) * 3.14159) * 0.28;
      D += (vec3(fract(aRand * 13.1), fract(aRand * 7.7), fract(aRand * 3.3)) - 0.5) * 0.14;
    }

    float s = clamp(uStage, 0.0, 3.999);
    float fi = floor(s);
    float t = s - fi;
    // Each particle leaves a little later than the last, so formations peel apart rather than jump.
    float tt = ease((t - aRand * 0.3) / 0.7);
    vec3 from; vec3 to; float kf; float kt;
    if (fi < 0.5)      { from = A;    to = B;    kf = aKind.x; kt = aKind.y; }
    else if (fi < 1.5) { from = B;    to = posC; kf = aKind.y; kt = aKind.z; }
    else if (fi < 2.5) { from = posC; to = D;    kf = aKind.z; kt = aKind.w; }
    else               { from = D;    to = posE; kf = aKind.w; kt = aKindE; }

    vec3 p = mix(from, to, tt);
    // Long, slow swirl while in flight: reads as drifting smoke rather than jitter.
    p += swirl(p * 0.28, uTime * 0.32) * sin(tt * 3.14159) * 0.85;

    // Intro: fly in from the scattered cloud and assemble.
    float it = ease((uIntro - aRand * 0.4) / 0.6);
    p = mix(aScatter, p, it);
    p += swirl(p * 0.25, uTime * 0.3) * (1.0 - it) * 0.7;

    // A slow breath, so a formation is never perfectly still (kept low-frequency to avoid shimmer).
    p += swirl(p * 0.6, uTime * 0.18) * 0.018;

    // The cursor pushes particles aside in the ball and wordmark formations.
    vec3 d = p - uMouse;
    float dist = length(d);
    p += normalize(d + 0.0001) * smoothstep(1.4, 0.0, dist) * 0.8 * uInteract;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.92 + 0.08 * sin(uTime * 0.8 + aRand * 50.0);
    // Never smaller than ~1.6 px: sub-pixel points flicker as they move.
    gl_PointSize = max(uSize * aSize * uPixelRatio * twinkle / -mv.z, 1.6 * uPixelRatio);

    vColor = mix(kindColor(kf), kindColor(kt), tt);

    // The far side of the ball is dimmer, so it reads as a solid sphere rather than a cage.
    float facing = 1.0;
    if (fi < 0.5) {
      vec3 n = normalize((viewMatrix * vec4(A, 0.0)).xyz);
      facing = mix(mix(0.16, 1.0, smoothstep(-0.2, 0.6, n.z)), 1.0, tt);
    }
    vAlpha = mix(0.35, 1.0, it) * facing;
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
  const B = vortexShape(n)
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

function Formation({ count, reduced, onReady }) {
  const [geometry, setGeometry] = useState(null)
  const ready = useRef(false)
  const gl = useThree((s) => s.gl)
  const viewport = useThree((s) => s.size)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uStage: { value: 0 },
          uIntro: { value: 0 },
          uSpin: { value: 0 },
          uInteract: { value: 1 },
          uSize: { value: 44 },
          uPixelRatio: { value: 1 },
          uMouse: { value: new THREE.Vector3(99, 99, 99) },
          uPathA: { value: PASS_PATHS[0].map(toVec) },
          uPathB: { value: PASS_PATHS[1].map(toVec) },
        },
      }),
    [],
  )

  // The wordmark is drawn with the page font, so wait for it before sampling.
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

  const stage = useRef(0)
  const spin = useRef(0)
  const interact = useRef(0)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const u = material.uniforms
    const p = storyState.progress
    // The intro starts with the first frame that actually has particles in it.
    if (geometry && !ready.current) {
      ready.current = true
      storyState.introAt = performance.now()
      onReady?.()
    }
    if (!reduced) u.uTime.value += dt
    // Ease towards the scroll position so the motion carries on smoothly after each scroll step.
    stage.current = damp(stage.current, stageAt(p), reduced ? 30 : 2.2, dt)
    u.uStage.value = stage.current
    u.uIntro.value = introProgress()
    if (!reduced) spin.current += dt * 0.32
    u.uSpin.value = spin.current
    u.uPixelRatio.value = gl.getPixelRatio()
    // Phones frame everything from further away, so the points are drawn larger to match.
    u.uSize.value = viewport.width / viewport.height < 0.85 ? 78 : 44
    // The cursor only disturbs the ball and the wordmark, and only while it is moving; then they heal.
    const moving = performance.now() - storyState.pointerAt < 1800 ? 1 : 0
    const where = Math.max(1 - span(p, 0, 0.08), span(p, 0.9, 0.98))
    interact.current = damp(interact.current, moving * where, moving ? 6 : 1.5, dt)
    u.uInteract.value = interact.current
    // Where the pointer meets the plane the ball and wordmark sit on.
    ray.setFromCamera({ x: storyState.pointerX, y: storyState.pointerY }, state.camera)
    if (ray.ray.intersectPlane(plane, hit)) u.uMouse.value.lerp(hit, 1 - Math.exp(-5 * dt))
  })

  if (!geometry) return null
  return <points geometry={geometry} material={material} frustumCulled={false} />
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

// Camera framing per formation: [position, target]. On wide screens the scene sits right of the copy.
const KEYS = [
  { pos: [0, 0.3, 14], target: [0, -0.2, 0] }, // ball
  { pos: [0, 6.5, 10.5], target: [0, 0, 0] }, // vortex
  { pos: [0, 10.5, 6.2], target: [0, 0, -0.4] }, // pitch
  { pos: [-0.6, 9.2, 4.2], target: [-0.5, 0, -1.7] }, // the pass
  { pos: [0, 0, 15.5], target: [0, 0, 0] }, // wordmark
]
const SHIFT_WIDE = [-3.8, -3.2, -3.8, -3.6, -1.2]
const LIFT_WIDE = [-1.1, 0, 0, 0, 0]

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const look = useRef(new THREE.Vector3())
  const stage = useRef(0)
  const first = useRef(true)
  useFrame((state, dt) => {
    const aspect = size.width / size.height
    const narrow = aspect < 0.85
    stage.current = damp(stage.current, stageAt(storyState.progress), 2.2, dt)
    const s = Math.min(stage.current, 3.999)
    const i = Math.floor(s)
    const t = s - i
    const e = t * t * t * (t * (t * 6 - 15) + 10)
    const a = KEYS[i]
    const b = KEYS[i + 1]
    const pos = a.pos.map((v, k) => v + (b.pos[k] - v) * e)
    const target = a.target.map((v, k) => v + (b.target[k] - v) * e)

    if (narrow) {
      // Portrait: step back so wide formations fit, and keep the scene in the upper half.
      const back = [1.75, 1.6, 1.75, 1.75, 2.6]
      const k = back[i] + (back[i + 1] - back[i]) * e
      pos[0] = target[0] + (pos[0] - target[0]) * k
      pos[1] = target[1] + (pos[1] - target[1]) * k
      pos[2] = target[2] + (pos[2] - target[2]) * k
      const drop = [-1.6, -1.6, 0, 0, -4]
      const dy = drop[i] + (drop[i + 1] - drop[i]) * e
      pos[1] += dy
      target[1] += dy
      const dz = [0, 0, 2.2, 2.2, 0]
      const z = dz[i] + (dz[i + 1] - dz[i]) * e
      pos[2] += z
      target[2] += z
    } else {
      const sx = SHIFT_WIDE[i] + (SHIFT_WIDE[i + 1] - SHIFT_WIDE[i]) * e
      const ly = LIFT_WIDE[i] + (LIFT_WIDE[i + 1] - LIFT_WIDE[i]) * e
      pos[0] += sx
      target[0] += sx
      target[1] += ly
      pos[1] += ly * 0.3
    }

    // Always drifting a little, and pulled back at first so the intro is a push-in.
    if (!storyState.reduced) {
      const tm = state.clock.elapsedTime
      pos[0] += Math.sin(tm * 0.15) * 0.35
      pos[1] += Math.sin(tm * 0.21) * 0.2
    }
    pos[0] += storyState.pointerX * 0.35
    pos[1] += storyState.pointerY * 0.2
    pos[2] += (1 - introProgress()) * 6

    const k = first.current ? 1e3 : 2.6
    first.current = false
    camera.position.set(damp(camera.position.x, pos[0], k, dt), damp(camera.position.y, pos[1], k, dt), damp(camera.position.z, pos[2], k, dt))
    look.current.set(damp(look.current.x, target[0], k, dt), damp(look.current.y, target[1], k, dt), damp(look.current.z, target[2], k, dt))
    camera.lookAt(look.current)
  })
  return null
}

/** If the device can't hold a steady frame rate with the glow on, turn the glow off. */
function FrameWatch({ onSlow }) {
  const frames = useRef([])
  const done = useRef(false)
  useFrame((_, dt) => {
    if (done.current || introProgress() < 1) return
    frames.current.push(dt)
    if (frames.current.length < 120) return
    const avg = frames.current.reduce((a, b) => a + b, 0) / frames.current.length
    done.current = true
    if (avg > 1 / 40) onSlow()
  })
  return null
}

export default function ParticleCanvas({ active, lite, reduced, onReady }) {
  const [effects, setEffects] = useState(!lite)
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 16], fov: 38, near: 0.1, far: 300 }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      aria-hidden="true"
    >
      <color attach="background" args={['#060607']} />
      {effects && <FrameWatch onSlow={() => setEffects(false)} />}
      <StarField count={lite ? 700 : 1600} />
      <Formation count={lite ? 16000 : 26000} reduced={reduced} onReady={onReady} />
      <CameraRig />
      {effects && (
        <Suspense fallback={null}>
          <Effects />
        </Suspense>
      )}
    </Canvas>
  )
}
