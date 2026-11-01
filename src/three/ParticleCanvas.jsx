import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { director, tick } from './director'
import { MAX_TRAILS, buildGeometry, createMaterials, createUniforms } from './particles'
import { introProgress, span, storyState } from './timeline'

const Effects = lazy(() => import('./Effects.jsx'))

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt))


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
  const uniforms = useMemo(createUniforms, [])
  const materials = useMemo(() => createMaterials(uniforms), [uniforms])
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
    // The intro starts with the first frame that actually has particles in it (or, while the
    // opening film plays, once it hands over).
    if (geometry && !ready.current) {
      ready.current = true
      onReady?.()
    }
    if (ready.current && storyState.introAt == null && !storyState.holdIntro) storyState.introAt = performance.now()
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
