// The Vision Test, drawn in 3D: the pitch at night, lit only where you look.
//
// The rules stay in visionTest.js. Each frame it hands this stage a plain description (who is where,
// who you can see right now, what you remember, what just happened) and the stage draws it, so what
// is lit is exactly what the game says you can see. Your vision is a floodlight from your own eyes:
// the turf, the haze and the dust in the air glow inside your cone and fall dark outside it. Players
// are small 3D figures that run, turn their heads and strike the ball; a memory is a see-through
// hologram of the player, frozen where you last saw them, that fades. The stage renders into its own
// WebGL canvas, which the game draws into its 2D canvas before adding the labels.
//
// World units are metres. The game's (x, y) is three's (x, z): y down the screen is towards the camera.
import * as THREE from 'three'
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing'

const DEG = Math.PI / 180
const FIG = 1.5 // figures are a little larger than life, so they still read on a phone
const MAX_FIGURES = 16
const MAX_GHOSTS = 14
const MAX_SPARKS = 360
// The camera: high behind you, like a broadcast tactical camera. Phones held upright look down more
// steeply, so the ground behind you does not take half the screen.
const ELEVATION = 52 * DEG
const TALL_ELEVATION = 63 * DEG
const FOV = 30
// What has to fit on screen (game x, y and height): the runners ahead, the passer and the pressers behind.
const WIDE_FRAME = [
  [-19.5, -1, 0],
  [19.5, -1, 0],
  [-19.5, -3, 0],
  [19.5, -3, 0],
  [-18, -10, 2],
  [18, -10, 2],
  [-12, -19, 2.2],
  [12, -19, 2.2],
  [0, -21, 2.4],
  [-12.5, 5, 0],
  [12.5, 5, 0],
  [-8.5, 12.5, 0],
  [8.5, 12.5, 0],
  [0, 14, 0],
]
const TALL_FRAME = [
  [-13, -4.5, 0],
  [13, -4.5, 0],
  [-13.2, -8, 0],
  [13.2, -8, 0],
  [-9, -16, 2],
  [9, -16, 2],
  [0, -20, 2.4],
  [-11, 5, 0],
  [11, 5, 0],
  [-7.5, 12, 0],
  [7.5, 12, 0],
  [0, 13.5, 0],
]

// Kits, as sRGB colours. You and your teammates wear the academy's volt; the opposition wear bone, and
// the pressers are marked out in red.
const KITS = {
  mate: { shirt: '#d7ff3a', shorts: '#121513', socks: '#d7ff3a', boots: '#0c0c0c', ring: '#d7ff3a' },
  opp: { shirt: '#ecebe4', shorts: '#26282a', socks: '#ecebe4', boots: '#0c0c0c', ring: '#f2f2ee' },
  press: { shirt: '#ff5b4d', shorts: '#2a0f0c', socks: '#ff5b4d', boots: '#0c0c0c', ring: '#ff6a5c' },
}
KITS.you = KITS.mate
KITS.passer = KITS.mate
const SKIN = ['#8a5636', '#a36c47', '#6c4027', '#b47b55', '#7a4b2f', '#94603d']
const HAIR = ['#120d0a', '#1b130e', '#0c0a09', '#24190f']
// The same, as linear colours for the renderer.
const KIT_C = Object.fromEntries(
  Object.entries(KITS).map(([k, kit]) => [
    k,
    Object.fromEntries(Object.entries(kit).map(([s, hex]) => [s, new THREE.Color(hex)])),
  ]),
)
const SKIN_C = SKIN.map((c) => new THREE.Color(c))
const HAIR_C = HAIR.map((c) => new THREE.Color(c))

const angleOf = (x, y) => Math.atan2(x, -y)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = (v) => v * v * (3 - 2 * v)
/** A bump from 0 up to 1 and back over [a, b]. */
const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI))
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

// ---------- Textures, drawn once ----------

function canvasTexture(size, h, paint, { repeat = false, color = true } = {}) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = h
  paint(c.getContext('2d'), size, h)
  const t = new THREE.CanvasTexture(c)
  if (color) t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Turf: fine blades in red, slow patches in green. */
function grassTexture() {
  const rnd = seeded(7)
  const t = canvasTexture(
    256,
    256,
    (g, s) => {
      g.fillStyle = 'rgb(128,128,0)'
      g.fillRect(0, 0, s, s)
      for (let i = 0; i < 9000; i++) {
        const v = Math.floor(70 + rnd() * 120)
        g.fillStyle = `rgba(${v},128,0,0.55)`
        const x = rnd() * s
        const y = rnd() * s
        g.fillRect(x, y, 1, 1 + rnd() * 3)
      }
      for (let i = 0; i < 40; i++) {
        const x = rnd() * s
        const y = rnd() * s
        const r = 10 + rnd() * 40
        const v = Math.floor(rnd() * 255)
        for (const [dx, dy] of [
          [0, 0],
          [s, 0],
          [-s, 0],
          [0, s],
          [0, -s],
        ]) {
          const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
          gr.addColorStop(0, `rgba(128,${v},0,0.35)`)
          gr.addColorStop(1, `rgba(128,${v},0,0)`)
          g.fillStyle = gr
          g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2)
        }
      }
    },
    { repeat: true, color: false },
  )
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/** A classic ball: twelve dark patches where an icosahedron's corners touch the sphere. */
function ballTexture() {
  const p = (1 + Math.sqrt(5)) / 2
  const corners = [
    [-1, p, 0],
    [1, p, 0],
    [-1, -p, 0],
    [1, -p, 0],
    [0, -1, p],
    [0, 1, p],
    [0, -1, -p],
    [0, 1, -p],
    [p, 0, -1],
    [p, 0, 1],
    [-p, 0, -1],
    [-p, 0, 1],
  ].map(([x, y, z]) => {
    const l = Math.hypot(x, y, z)
    return [x / l, y / l, z / l]
  })
  return canvasTexture(256, 128, (g, w, h) => {
    const img = g.createImageData(w, h)
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const th = (i / w) * Math.PI * 2
        const ph = (j / h) * Math.PI
        const v = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]
        const dots = corners.map((c) => c[0] * v[0] + c[1] * v[1] + c[2] * v[2]).sort((a, b) => b - a)
        let shade = 244
        if (dots[0] > 0.935) shade = 22
        else if (dots[0] - dots[1] < 0.012 || dots[0] > 0.925) shade = 150
        const k = (j * w + i) * 4
        img.data[k] = shade
        img.data[k + 1] = shade
        img.data[k + 2] = shade - 4
        img.data[k + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
  })
}

/** A soft glowing ring (solid) or a dashed one (memories), for under players' feet. */
function ringTexture(dashed) {
  return canvasTexture(128, 128, (g, s) => {
    const c = s / 2
    g.lineCap = 'round'
    if (dashed) {
      g.setLineDash([9, 8])
      g.strokeStyle = '#fff'
      g.lineWidth = 6
      g.beginPath()
      g.arc(c, c, s * 0.41, 0, Math.PI * 2)
      g.stroke()
      return
    }
    const gr = g.createRadialGradient(c, c, s * 0.3, c, c, s * 0.5)
    gr.addColorStop(0, 'rgba(255,255,255,0)')
    gr.addColorStop(0.5, 'rgba(255,255,255,0.12)')
    gr.addColorStop(0.64, 'rgba(255,255,255,1)')
    gr.addColorStop(0.72, 'rgba(255,255,255,0.2)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, s, s)
  })
}

function blobTexture() {
  return canvasTexture(64, 64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    gr.addColorStop(0, 'rgba(0,0,0,0.75)')
    gr.addColorStop(0.55, 'rgba(0,0,0,0.4)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, s, s)
  })
}

/** A long shadow, dark at the feet (the bottom of the image) and fading away from the light. */
function castTexture() {
  return canvasTexture(64, 256, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = 1 - y / h // 1 at the feet
      const a = 0.62 * Math.pow(v, 1.6)
      const half = (w / 2) * (0.55 + 0.45 * Math.sin(Math.min(1, (1 - v) * 3 + 0.25) * Math.PI * 0.5))
      const gr = g.createLinearGradient(w / 2 - half, 0, w / 2 + half, 0)
      gr.addColorStop(0, 'rgba(0,0,0,0)')
      gr.addColorStop(0.5, `rgba(0,0,0,${a})`)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr
      g.fillRect(0, h - 1 - y, w, 1)
    }
  })
}

// ---------- Shaders ----------

// The cone of light, shared by the turf, the haze and the dust: 1 inside where you look, 0 outside.
// Its soft edge sits inside the cone, so nothing is ever lit that the game says you cannot see.
const CONE = /* glsl */ `
  float coneOf(vec2 p, float head, float cone, float soft) {
    float diff = abs(atan(sin(atan(p.x, -p.y) - head), cos(atan(p.x, -p.y) - head)));
    return 1.0 - smoothstep(cone - soft, cone + 0.002, diff);
  }
`

const GROUND_VERT = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vP = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const GROUND_FRAG = /* glsl */ `
  uniform float uHead, uCone, uNear, uTime, uSlow, uDanger, uSweep, uBoost;
  uniform sampler2D uGrass;
  varying vec2 vP;
  ${CONE}
  float lineAA(float d, float w) {
    float a = fwidth(d) * 1.2;
    return 1.0 - smoothstep(w - a, w + a, d);
  }
  void main() {
    vec2 p = vP;
    float d = length(p);
    float ang = atan(p.x, -p.y);
    float cone = coneOf(p, uHead, uCone, 0.085);
    float fall = mix(1.15, 0.5, smoothstep(3.0, 30.0, d)) * (1.0 - smoothstep(34.0, 56.0, d));
    float pool = 1.0 - smoothstep(uNear * 0.5, uNear * 1.5, d);
    // Light shafts through the haze, drifting slowly.
    float shafts = 0.93 + 0.07 * sin(ang * 57.0 + sin(ang * 13.0 + uTime * 0.12) * 3.0);
    float light = max(cone * fall * mix(1.0, shafts, smoothstep(3.0, 12.0, d)), pool * 0.6) * uBoost;

    vec3 g1 = texture2D(uGrass, p * 0.23).rgb;
    vec3 g2 = texture2D(uGrass, p * 0.034 + 0.37).rgb;
    float band = step(0.5, fract(p.y / 10.0 + 0.25)); // mown stripes, five metres wide
    vec3 turf = mix(vec3(0.011, 0.045, 0.017), vec3(0.017, 0.064, 0.025), band);
    turf *= (0.58 + 0.84 * g1.r) * (0.8 + 0.4 * g2.g);

    float lw = 0.065;
    float chalk = max(lineAA(abs(p.y), lw), lineAA(abs(d - 9.15), lw));
    chalk = max(chalk, 1.0 - smoothstep(0.17, 0.21, d));
    chalk *= 0.8 + 0.2 * g1.r;

    vec3 col = turf * vec3(1.0, 0.96, 0.86) * light * 2.9 + turf * 0.05;
    col += vec3(0.78) * chalk * (0.022 + light * 0.95);
    // A thin volt edge to the cone, as if the light catches the dew.
    float diff = abs(atan(sin(ang - uHead), cos(ang - uHead)));
    float rim = exp(-pow((diff - uCone) / 0.006, 2.0)) * smoothstep(1.2, 3.5, d) * (1.0 - smoothstep(16.0, 38.0, d));
    col += vec3(0.68, 1.0, 0.04) * rim * 0.09 * uBoost;
    // Slow motion: the world away from you drains of colour.
    float grey = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, vec3(grey) * vec3(0.78, 0.92, 1.08), uSlow * 0.6 * smoothstep(2.5, 10.0, d));
    // A tackle flashes red at your feet; a new level sweeps a band of light up the pitch.
    col += vec3(1.0, 0.12, 0.06) * uDanger * (1.0 - smoothstep(0.0, 7.0, d)) * 0.5;
    col += vec3(0.68, 1.0, 0.04) * exp(-pow((p.y - uSweep) / 1.4, 2.0)) * step(-40.0, uSweep) * (0.08 + light) * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }
`

const HAZE_FRAG = /* glsl */ `
  uniform float uHead, uCone, uTime, uK, uBoost;
  varying vec2 vP;
  ${CONE}
  void main() {
    float d = length(vP);
    float cone = coneOf(vP, uHead, uCone, 0.16);
    float fall = smoothstep(0.8, 3.5, d) * (1.0 - smoothstep(6.0, 32.0, d));
    float n = 0.7 + 0.3 * sin(vP.x * 0.33 + uTime * 0.21) * sin(vP.y * 0.27 - uTime * 0.17);
    gl_FragColor = vec4(vec3(0.82, 0.95, 0.72) * cone * fall * n * uK * uBoost, 1.0);
  }
`

const DUST_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime, uHead, uCone, uScale, uBoost;
  varying float vA;
  ${CONE}
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.23 + aSeed * 17.0) * 0.9;
    p.y += sin(uTime * 0.31 + aSeed * 11.0) * 0.35;
    p.z += cos(uTime * 0.19 + aSeed * 13.0) * 0.9;
    float d = length(p.xz);
    float fall = smoothstep(1.0, 3.0, d) * (1.0 - smoothstep(10.0, 30.0, d));
    vA = coneOf(p.xz, uHead, uCone, 0.1) * fall * (0.45 + 0.55 * sin(uTime * 1.3 + aSeed * 40.0)) * uBoost;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = vA > 0.01 ? uScale * (0.04 + 0.035 * fract(aSeed * 7.0)) / -mv.z : 0.0;
    gl_Position = projectionMatrix * mv;
  }
`
const DUST_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(vec3(1.0, 0.97, 0.86) * smoothstep(0.5, 0.05, r) * vA * 1.6, 1.0);
  }
`

const SPARK_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uScale;
  varying vec3 vC;
  void main() {
    vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize > 0.0 ? uScale * aSize / -mv.z : 0.0;
    gl_Position = projectionMatrix * mv;
  }
`
const SPARK_FRAG = /* glsl */ `
  varying vec3 vC;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(vC * (smoothstep(0.5, 0.0, r) + smoothstep(0.2, 0.0, r)), 1.0);
  }
`

// Ground marks drawn exactly: a ring of radius uR, solid or dashed, whole or an arc.
const DECAL_VERT = /* glsl */ `
  uniform float uExtent;
  varying vec2 vQ;
  void main() {
    vQ = vec2(position.x, position.z) * uExtent;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const DECAL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha, uR, uW, uDash, uSpin, uA0, uLen;
  varying vec2 vQ;
  void main() {
    float d = length(vQ);
    float a = fwidth(d);
    float m = 1.0 - smoothstep(uW * 0.5 - a, uW * 0.5 + a, abs(d - uR));
    m += exp(-pow((d - uR) / (uW * 2.2), 2.0)) * 0.3;
    float ang = atan(vQ.x, -vQ.y);
    if (uDash > 0.0) m *= step(0.42, fract(ang / 6.2831853 * uDash + uSpin));
    if (uLen < 6.2) {
      float off = abs(atan(sin(ang - uA0), cos(ang - uA0)));
      m *= 1.0 - smoothstep(uLen * 0.5 - 0.06, uLen * 0.5, off);
    }
    gl_FragColor = vec4(uColor * m * uAlpha, 1.0);
  }
`

// Memories: a see-through hologram, brightest at its edges, with light scanning up through it.
const GHOST_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vC;
  varying float vH;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 w = m * vec4(position, 1.0);
    vN = normalize(mat3(m) * normal);
    vV = normalize(cameraPosition - w.xyz);
    vC = instanceColor;
    vH = w.y;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const GHOST_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vC;
  varying float vH;
  void main() {
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float scan = 0.55 + 0.45 * step(0.5, fract(vH * 11.0 - uTime * 0.7));
    gl_FragColor = vec4(vC * (0.1 + 1.2 * pow(f, 2.2)) * scan, 1.0);
  }
`

// ---------- The figure ----------

const PARTS = {
  // part: [colour slot, geometry]
  pelvis: ['shorts', () => new THREE.SphereGeometry(1, 16, 10).scale(0.165, 0.12, 0.12)],
  torso: [
    'shirt',
    () =>
      new THREE.LatheGeometry(
        [
          [0.001, 0],
          [0.15, 0],
          [0.158, 0.06],
          [0.166, 0.16],
          [0.186, 0.28],
          [0.205, 0.38],
          [0.21, 0.44],
          [0.19, 0.5],
          [0.12, 0.54],
          [0.001, 0.555],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        18,
      ).scale(1, 1, 0.62),
  ],
  neck: ['skin', () => new THREE.CylinderGeometry(0.05, 0.056, 0.12, 10)],
  head: ['skin', () => new THREE.SphereGeometry(0.115, 18, 12).scale(1, 1.12, 1.06)],
  hair: ['hair', () => new THREE.SphereGeometry(0.123, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(1, 1.08, 1.1)],
  sleeve: ['shirt', () => new THREE.CapsuleGeometry(0.057, 0.15, 4, 10)],
  forearm: ['skin', () => new THREE.CapsuleGeometry(0.043, 0.17, 4, 10)],
  thigh: ['shorts', () => new THREE.CapsuleGeometry(0.076, 0.27, 4, 12)],
  shin: ['socks', () => new THREE.CapsuleGeometry(0.056, 0.3, 4, 10)],
  boot: ['boots', () => new THREE.CapsuleGeometry(0.05, 0.12, 4, 8).rotateX(Math.PI / 2).scale(1, 0.78, 1)],
}

/** The joints of one figure (shared: each figure is posed on it in turn), facing -z (forward). */
function makeRig() {
  const node = (parent, x = 0, y = 0, z = 0) => {
    const o = new THREE.Object3D()
    o.position.set(x, y, z)
    parent.add(o)
    return o
  }
  const root = new THREE.Object3D()
  root.scale.setScalar(FIG)
  const hips = node(root, 0, 0.93)
  const spine = node(hips, 0, 0.04)
  const neck = node(spine, 0, 0.5)
  const head = node(neck, 0, 0.08)
  const shoulder = [-1, 1].map((s) => node(spine, s * 0.205, 0.43))
  const elbow = shoulder.map((o) => node(o, 0, -0.27))
  const hip = [-1, 1].map((s) => node(hips, s * 0.095, -0.04))
  const knee = hip.map((o) => node(o, 0, -0.43))
  const ankle = knee.map((o) => node(o, 0, -0.43))
  const parts = {
    pelvis: [node(hips, 0, -0.02)],
    torso: [node(spine)],
    neck: [node(neck, 0, 0.03)],
    head: [node(head, 0, 0.11)],
    hair: [node(head, 0, 0.13, 0.014)],
    sleeve: shoulder.map((o) => node(o, 0, -0.12)),
    forearm: elbow.map((o) => node(o, 0, -0.12)),
    thigh: hip.map((o) => node(o, 0, -0.2)),
    shin: knee.map((o) => node(o, 0, -0.21)),
    boot: ankle.map((o) => node(o, 0, -0.01, -0.055)),
  }
  return { root, hips, spine, neck, head, shoulder, elbow, hip, knee, ankle, parts }
}

/**
 * Sets the rig to a pose. p: { x, y, yaw, phase, speed, neck, kick, touch, hit, t } with yaw and neck
 * as game angles (clockwise from forward), kick and touch as seconds since the strike or the first
 * touch (or null), and t a clock for breathing.
 */
function pose(rig, p) {
  const run = clamp(p.speed / 6.5, 0, 1)
  const idle = 1 - clamp(p.speed / 1.2, 0, 1)
  rig.root.position.set(p.x, 0, p.y)
  rig.root.rotation.set(0, -p.yaw, 0)
  rig.hips.position.y =
    0.92 - 0.025 * run - 0.015 * idle + 0.04 * run * Math.abs(Math.sin(p.phase)) + 0.006 * Math.sin(p.t * 3.1) * idle
  rig.spine.rotation.set(-(0.05 + 0.3 * run) - 0.02 * Math.sin(p.t * 1.7) * idle, Math.sin(p.phase) * 0.16 * run, 0)
  rig.head.rotation.set(0.12 * run, -(p.neck || 0), 0)
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1
    const ph = p.phase + i * Math.PI
    const swing = Math.sin(ph) * (0.12 + 0.78 * run) * (1 - idle * 0.9)
    const bend = (0.15 + 1.25 * run) * Math.max(0, Math.cos(ph)) * (1 - idle) + 0.22 * idle
    rig.hip[i].rotation.set(swing + 0.1 * idle, 0, s * 0.03)
    rig.knee[i].rotation.set(-bend, 0, 0)
    rig.ankle[i].rotation.set(bend * 0.3, 0, 0)
    rig.shoulder[i].rotation.set(-swing * 0.85, 0, s * (0.1 + 0.08 * idle))
    rig.elbow[i].rotation.set(0.35 + 0.85 * run, 0, 0)
  }
  // Striking the ball with the right foot: wind up, swing through, follow through.
  if (p.kick != null && p.kick > -0.22 && p.kick < 0.4) {
    const k = p.kick + 0.22
    const back = smooth(clamp(k / 0.16, 0, 1))
    const through = smooth(clamp((k - 0.16) / 0.12, 0, 1))
    const settle = smooth(clamp((k - 0.34) / 0.28, 0, 1))
    rig.hip[1].rotation.x = (-0.75 * back + 1.75 * through) * (1 - settle)
    rig.knee[1].rotation.x = -(1.5 * back - 1.35 * through) * (1 - settle) - 0.1
    rig.hip[0].rotation.x = 0.1
    rig.knee[0].rotation.x = -0.35
    rig.shoulder[0].rotation.x = 0.7 * back * (1 - settle)
    rig.shoulder[1].rotation.x = -0.5 * back * (1 - settle)
    rig.spine.rotation.x = -0.12 - 0.12 * through * (1 - settle)
  }
  // A first touch: the left foot reaches to cushion the ball.
  if (p.touch != null) {
    const b = bump(p.touch, 0, 0.32)
    rig.hip[0].rotation.x += 0.55 * b
    rig.knee[0].rotation.x -= 0.35 * b
  }
  // Tackled: knocked off balance.
  if (p.hit != null) {
    const b = bump(p.hit, 0, 0.7)
    rig.spine.rotation.z = 0.45 * b
    rig.spine.rotation.x += 0.25 * b
    rig.hips.position.y -= 0.12 * b
  }
}

// ---------- The stage ----------

let shared = null
/** One WebGL renderer for the page, reused by every game made on it (the tutorial makes many). */
function sharedRenderer() {
  if (shared && !shared.lost) return shared
  const canvas = document.createElement('canvas')
  const gl = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  })
  gl.outputColorSpace = THREE.SRGBColorSpace
  gl.toneMapping = THREE.NoToneMapping
  shared = { canvas, gl, lost: false }
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    shared.lost = true
  })
  return shared
}

/**
 * Makes the stage. quality: 'high', 'medium' or 'low' (phones start at medium; the game lowers it if
 * frames run slow). grain adds film grain (off for the tutorial video, where it would cost bitrate).
 */
export function createStage({ quality = 'high', grain = true } = {}) {
  const { canvas, gl } = sharedRenderer()
  const rnd = seeded(2024) // effects only: the game's own random sequence is never touched
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#030404')
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 260)
  const disposables = []
  const keep = (x) => (disposables.push(x), x)
  let W = 1
  let H = 1
  let ratio = 1
  let askedRatio = 1
  let level = { high: 0, medium: 1, low: 2 }[quality] ?? 0

  // Light for the figures: a high floodlight, a cool rim from the far end, a fill from the camera
  // side and the light of your own gaze.
  scene.add(new THREE.HemisphereLight('#9fb8aa', '#050806', 0.55))
  const key = new THREE.DirectionalLight('#fff4e2', 1.7)
  key.position.set(-12, 30, -10)
  const rim = new THREE.DirectionalLight('#cfe0ff', 2.2)
  rim.position.set(4, 9, -40)
  const fill = new THREE.DirectionalLight('#dfe9e2', 0.7)
  fill.position.set(8, 16, 30)
  const gaze = new THREE.PointLight('#fff4dc', 11, 0, 1)
  gaze.position.set(0, 1.85, 0)
  scene.add(key, rim, fill, gaze)

  // The turf.
  const grass = keep(grassTexture())
  grass.anisotropy = gl.capabilities.getMaxAnisotropy()
  const lightUniforms = {
    uHead: { value: 0 },
    uCone: { value: 55 * DEG },
    uNear: { value: 2.2 },
    uTime: { value: 0 },
    uBoost: { value: 1 },
  }
  const groundMat = keep(
    new THREE.ShaderMaterial({
      uniforms: {
        ...lightUniforms,
        uSlow: { value: 0 },
        uDanger: { value: 0 },
        uSweep: { value: -99 },
        uGrass: { value: grass },
      },
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
    }),
  )
  const groundGeo = keep(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2))
  scene.add(new THREE.Mesh(groundGeo, groundMat))

  // Haze: thin layers of lit air, stacked, so the beam has depth from the camera's angle.
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
  const hazeGeo = keep(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2))
  const haze = [0.4, 0.85, 1.3, 1.8, 2.3].map((h, i) => {
    const m = keep(
      new THREE.ShaderMaterial({
        ...additive,
        uniforms: { ...lightUniforms, uK: { value: 0.014 - i * 0.0022 } },
        vertexShader: GROUND_VERT,
        fragmentShader: HAZE_FRAG,
      }),
    )
    const mesh = new THREE.Mesh(hazeGeo, m)
    mesh.position.y = h
    mesh.renderOrder = 2
    scene.add(mesh)
    return mesh
  })

  // Dust in the beam.
  const DUST = 900
  const dustGeo = keep(new THREE.BufferGeometry())
  const dp = new Float32Array(DUST * 3)
  const ds = new Float32Array(DUST)
  for (let i = 0; i < DUST; i++) {
    dp[i * 3] = (rnd() * 2 - 1) * 30
    dp[i * 3 + 1] = 0.15 + rnd() * 3.2
    dp[i * 3 + 2] = -34 + rnd() * 50
    ds[i] = rnd()
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3))
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(ds, 1))
  const dustMat = keep(
    new THREE.ShaderMaterial({
      ...additive,
      uniforms: { ...lightUniforms, uScale: { value: 1000 } },
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
    }),
  )
  const dust = new THREE.Points(dustGeo, dustMat)
  dust.frustumCulled = false
  dust.renderOrder = 3
  scene.add(dust)

  // Shadows: a contact blob under everyone, and a long shadow cast away from your gaze.
  const flat = keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2))
  const shadowMat = (map) => keep(new THREE.MeshBasicMaterial({ map: keep(map), transparent: true, depthWrite: false }))
  const blobs = new THREE.InstancedMesh(flat, shadowMat(blobTexture()), MAX_FIGURES + 1)
  const casts = new THREE.InstancedMesh(flat, shadowMat(castTexture()), MAX_FIGURES)
  // Rings under players' feet, in their colours: solid for who you see, dashed for memories.
  const ringMat = (map) => keep(new THREE.MeshBasicMaterial({ ...additive, map: keep(map) }))
  const rings = new THREE.InstancedMesh(flat, ringMat(ringTexture(false)), MAX_FIGURES)
  const ghostRings = new THREE.InstancedMesh(flat, ringMat(ringTexture(true)), MAX_GHOSTS)
  for (const [m, order] of [
    [blobs, 1],
    [casts, 1],
    [rings, 4],
    [ghostRings, 4],
  ]) {
    m.frustumCulled = false
    m.renderOrder = order
    m.count = 0
    for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, new THREE.Color(1, 1, 1))
    scene.add(m)
  }

  // The figures: one instanced mesh per body part, for every player at once, and the same again in
  // hologram for memories.
  const rig = makeRig()
  const solidMat = keep(new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 }))
  solidMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
      outgoingLight += mix(vec3(1.0), diffuseColor.rgb, 0.55) * rimF * 0.6;
      #include <opaque_fragment>`,
    )
  }
  const ghostMat = keep(
    new THREE.ShaderMaterial({
      ...additive,
      uniforms: { uTime: lightUniforms.uTime },
      vertexShader: GHOST_VERT,
      fragmentShader: GHOST_FRAG,
    }),
  )
  const body = {}
  for (const [part, [slot, make]] of Object.entries(PARTS)) {
    const geo = keep(make())
    const per = rig.parts[part].length
    const solid = new THREE.InstancedMesh(geo, solidMat, MAX_FIGURES * per)
    const ghost = new THREE.InstancedMesh(geo, ghostMat, MAX_GHOSTS * per)
    for (const m of [solid, ghost]) {
      m.frustumCulled = false
      m.count = 0
      for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, new THREE.Color(1, 1, 1))
      scene.add(m)
    }
    ghost.renderOrder = 5
    body[part] = { slot, per, solid, ghost }
  }

  // The ball.
  const ballMap = keep(ballTexture())
  const ballMat = keep(
    new THREE.MeshStandardMaterial({
      map: ballMap,
      roughness: 0.42,
      emissive: '#ffffff',
      emissiveIntensity: 0.32,
      emissiveMap: ballMap,
    }),
  )
  const BALL_R = 0.24
  const ball = new THREE.Mesh(keep(new THREE.SphereGeometry(BALL_R, 32, 18)), ballMat)
  scene.add(ball)

  // Your facing: a small volt chevron on the turf in front of you.
  const chevronShape = new THREE.Shape()
  chevronShape.moveTo(0, 0.36)
  chevronShape.lineTo(0.3, -0.08)
  chevronShape.lineTo(0, 0.08)
  chevronShape.lineTo(-0.3, -0.08)
  chevronShape.closePath()
  const chevron = new THREE.Mesh(
    keep(new THREE.ShapeGeometry(chevronShape).rotateX(-Math.PI / 2)),
    keep(new THREE.MeshBasicMaterial({ ...additive, color: new THREE.Color('#d7ff3a').multiplyScalar(1.6) })),
  )
  chevron.renderOrder = 4
  scene.add(chevron)

  // Ground marks: the call, a lined-up pass, shock waves and the slow-motion ring.
  const decalGeo = keep(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2))
  const decals = Array.from({ length: 14 }, () => {
    const mat = keep(
      new THREE.ShaderMaterial({
        ...additive,
        uniforms: {
          uExtent: { value: 1 },
          uColor: { value: new THREE.Color() },
          uAlpha: { value: 1 },
          uR: { value: 1 },
          uW: { value: 0.1 },
          uDash: { value: 0 },
          uSpin: { value: 0 },
          uA0: { value: 0 },
          uLen: { value: 7 },
        },
        vertexShader: DECAL_VERT,
        fragmentShader: DECAL_FRAG,
      }),
    )
    const mesh = new THREE.Mesh(decalGeo, mat)
    mesh.renderOrder = 4
    mesh.visible = false
    scene.add(mesh)
    return mesh
  })

  // Sparks, for completed passes and turnovers.
  const sparkGeo = keep(new THREE.BufferGeometry())
  const sp = new Float32Array(MAX_SPARKS * 3)
  const sc = new Float32Array(MAX_SPARKS * 3)
  const ss = new Float32Array(MAX_SPARKS)
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  sparkGeo.setAttribute('aColor', new THREE.BufferAttribute(sc, 3))
  sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(ss, 1))
  const sparkMat = keep(
    new THREE.ShaderMaterial({
      ...additive,
      uniforms: { uScale: dustMat.uniforms.uScale },
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
    }),
  )
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat)
  sparkPoints.frustumCulled = false
  sparkPoints.renderOrder = 6
  scene.add(sparkPoints)
  const sparks = []
  const shocks = []

  // Post-processing: glow, filmic tone and a vignette.
  let composer = null
  let bloom = null
  function buildComposer() {
    composer?.dispose()
    composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: level === 0 ? (ratio >= 2 ? 2 : 4) : 0,
    })
    composer.addPass(new RenderPass(scene, camera))
    const effects = []
    if (level < 2) {
      bloom = new BloomEffect({
        mipmapBlur: true,
        intensity: 1.15,
        luminanceThreshold: 0.82,
        luminanceSmoothing: 0.22,
        radius: 0.72,
      })
      effects.push(bloom)
    } else bloom = null
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }))
    effects.push(new VignetteEffect({ offset: 0.3, darkness: 0.72 }))
    if (grain && level < 2) {
      const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false })
      noise.blendMode.opacity.value = 0.09
      effects.push(noise)
    }
    composer.addPass(new EffectPass(camera, ...effects))
    composer.setSize(W, H, false)
  }

  // ---------- Framing ----------

  const v3 = new THREE.Vector3()
  let tall = false
  function place(tz, d) {
    const el = tall ? TALL_ELEVATION : ELEVATION
    camera.position.set(0, Math.sin(el) * d, tz + Math.cos(el) * d)
    camera.lookAt(0, 0, tz)
    camera.updateMatrixWorld()
  }
  function fits(points) {
    for (const [x, y, h] of points) {
      v3.set(x, h, y).project(camera)
      if (Math.abs(v3.x) > 0.965 || v3.y > 0.94 || v3.y < -0.965 || v3.z > 1) return false
    }
    return true
  }
  /** Vertical room left above and below what has to fit, in screen units. */
  function slack(points) {
    let top = -1
    let bottom = 1
    for (const [x, y, h] of points) {
      v3.set(x, h, y).project(camera)
      top = Math.max(top, v3.y)
      bottom = Math.min(bottom, v3.y)
    }
    return { top: 0.94 - top, bottom: bottom + 0.965 }
  }
  /**
   * Moves the camera as close as it can while everything the game needs stays on screen. Where the
   * width decides that (phones), the height left over is shared equally above and below.
   */
  function frame() {
    camera.aspect = W / H
    camera.zoom = 1
    camera.updateProjectionMatrix()
    const points = tall ? TALL_FRAME : WIDE_FRAME
    const closest = (tz) => {
      let lo = 8
      let hi = 220
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2
        place(tz, mid)
        if (fits(points)) hi = mid
        else lo = mid
      }
      return hi
    }
    const tries = []
    for (let tz = -9; tz <= 4; tz += 0.25) tries.push({ tz, d: closest(tz) })
    const d = Math.min(...tries.map((t) => t.d)) * 1.01
    let best = null
    for (const t of tries) {
      if (t.d > d) continue
      place(t.tz, d)
      const s = slack(points)
      const off = Math.abs(s.top - s.bottom)
      if (!best || off < best.off) best = { tz: t.tz, off }
    }
    place(best.tz, d)
  }

  function setSize(w, h, pixelRatio = 1, isTall = false) {
    W = Math.max(1, Math.round(w))
    H = Math.max(1, Math.round(h))
    tall = isTall
    askedRatio = pixelRatio
    ratio = Math.min(pixelRatio, [2, 1.5, 1][level])
    gl.setPixelRatio(ratio)
    gl.setSize(W, H, false)
    frame()
    dustMat.uniforms.uScale.value = (H * ratio) / (2 * Math.tan((FOV * DEG) / 2))
    buildComposer()
    const layers = [5, 3, 0][level]
    haze.forEach((m, i) => (m.visible = i < layers))
    dust.visible = level < 2
  }

  // ---------- Effects ----------

  const colorOf = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k)
  function burst(x, y, color, count, { speed = 5, up = 4, size = 0.16, life = 0.9, height = 1.2 } = {}) {
    for (let i = 0; i < count && sparks.length < MAX_SPARKS; i++) {
      const a = rnd() * Math.PI * 2
      const s = speed * (0.35 + rnd() * 0.65)
      sparks.push({
        x,
        y: height * (0.4 + rnd() * 0.6),
        z: y,
        vx: Math.sin(a) * s,
        vy: up * (0.4 + rnd()),
        vz: Math.cos(a) * s,
        age: 0,
        life: life * (0.6 + rnd() * 0.5),
        color,
        size: size * (0.6 + rnd() * 0.8),
      })
    }
  }
  function shock(x, y, color, { from = 0.5, to = 2.5, life = 0.5, w = 0.16, alpha = 1 } = {}) {
    shocks.push({ x, y, color, from, to, life, w, alpha, age: 0 })
  }
  let danger = 0
  let sweep = null
  /** Something happened in the game: a burst of light where it did. */
  function fx(name, x = 0, y = 0) {
    const volt = colorOf('#d7ff3a', 3.2)
    const red = colorOf('#ff5b4d', 3.2)
    const white = colorOf('#ffffff', 1.3)
    if (name === 'receive') shock(0, 0, white, { from: 0.4, to: 2.1, life: 0.4, w: 0.12 })
    if (name === 'complete' || name === 'first') {
      burst(x, y, volt, name === 'first' ? 70 : 44, { speed: name === 'first' ? 6.5 : 5 })
      shock(x, y, volt, { from: 0.5, to: 3.2, life: 0.6 })
      if (name === 'first') shock(x, y, volt, { from: 0.3, to: 5, life: 0.85, w: 0.1, alpha: 0.7 })
    }
    if (name === 'intercepted') {
      burst(x, y, red, 40)
      shock(x, y, red, { from: 0.4, to: 2.8, life: 0.55 })
    }
    if (name === 'misplaced') shock(x, y, colorOf('#f2f2ee', 1.6), { from: 0.3, to: 2.2, life: 0.6, w: 0.1 })
    if (name === 'tackled') {
      burst(0, 0, red, 36, { speed: 4, up: 3 })
      shock(0, 0, red, { from: 0.6, to: 4.5, life: 0.7, w: 0.22 })
      danger = 1
    }
    if (name === 'level') sweep = 0
  }

  // ---------- Each frame ----------

  const anims = new WeakMap()
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const yAxis = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  const col = new THREE.Color()
  const ballSpin = new THREE.Quaternion()
  const lastBall = { x: 0, y: 0, set: false }
  let lastTime = null
  let lastClock = null
  let slowK = 0
  let zoom = 1
  let youYaw = 0

  function animFor(key, x, y, yaw) {
    let a = anims.get(key)
    if (!a) {
      a = { x, y, yaw, phase: rnd() * Math.PI * 2, speed: 0, variant: Math.floor(rnd() * 24), seen: null }
      anims.set(key, a)
    }
    return a
  }
  /** Moves a figure's animation on: speed and stride from how far it moved, and which way it faces. */
  function animate(a, x, y, dt, faceTo, kind) {
    const dist = Math.hypot(x - a.x, y - a.y)
    const v = dt > 0 ? dist / dt : 0
    a.speed += (Math.min(v, 9) - a.speed) * Math.min(1, dt * 9)
    a.phase += (dist / 2.3) * Math.PI * 2
    let face = faceTo
    if (v > 0.6 && kind !== 'opp') face = angleOf(x - a.x, y - a.y)
    else if (v > 0.6) face = faceTo + clamp(wrap(angleOf(x - a.x, y - a.y) - faceTo), -0.5, 0.5)
    a.yaw = wrap(a.yaw + clamp(wrap(face - a.yaw), -dt * 9, dt * 9))
    a.x = x
    a.y = y
  }
  function writeFigure(set, i, kit, variant, k = 1) {
    rig.root.updateMatrixWorld(true)
    const skin = SKIN_C[variant % SKIN_C.length]
    const hair = HAIR_C[variant % HAIR_C.length]
    if (set === 'ghost') col.copy(KIT_C[kit].ring).multiplyScalar(k)
    for (const [name, part] of Object.entries(body)) {
      const mesh = part[set]
      const slot = part.slot
      const c = set === 'ghost' ? col : slot === 'skin' ? skin : slot === 'hair' ? hair : KIT_C[kit][slot]
      for (let j = 0; j < part.per; j++) {
        const idx = i * part.per + j
        mesh.setMatrixAt(idx, rig.parts[name][j].matrixWorld)
        mesh.setColorAt(idx, c)
      }
    }
  }
  function flatAt(mesh, i, x, y, yaw, w, l, color = null, lift = 0.012) {
    pos.set(x, lift, y)
    q.setFromAxisAngle(yAxis, -yaw)
    scl.set(w, 1, l)
    mesh.setMatrixAt(i, m4.compose(pos, q, scl))
    if (color) mesh.setColorAt(i, color)
  }

  /**
   * Draws a frame. view: { time, clock, head, cone, near, slow, idle, reducedMotion, you, figures,
   * ball, decals } (see visionTest.js, which builds it).
   */
  function render(view) {
    const dt = lastTime == null ? 0 : clamp(view.time - lastTime, 0, 0.1)
    const dc = lastClock == null || view.clock < lastClock ? 0 : clamp(view.clock - lastClock, 0, 0.1)
    lastTime = view.time
    lastClock = view.clock
    const U = lightUniforms
    U.uHead.value = view.head
    U.uCone.value = view.cone
    U.uNear.value = view.near
    U.uTime.value = view.reducedMotion ? 0 : view.time
    U.uBoost.value = view.idle ? 0.8 : 1
    slowK += ((view.slow ? 1 : 0) - slowK) * Math.min(1, dt * 7)
    groundMat.uniforms.uSlow.value = slowK
    danger = Math.max(0, danger - dt * 1.6)
    groundMat.uniforms.uDanger.value = danger
    if (sweep != null) {
      sweep += dt
      groundMat.uniforms.uSweep.value = 14 - sweep * 30
      if (sweep > 1.4) sweep = null
    } else groundMat.uniforms.uSweep.value = -99
    gaze.position.set(Math.sin(view.head) * 5, 3.2, -Math.cos(view.head) * 5)

    // You: the head leads, the body follows.
    const you = view.you
    const bodyTarget = clamp(view.head * 0.5, -80 * DEG, 80 * DEG)
    youYaw += clamp(bodyTarget - youYaw, -dt * 5, dt * 5)
    const neck = clamp(wrap(view.head - youYaw), -95 * DEG, 95 * DEG)
    pose(rig, { x: 0, y: 0, yaw: youYaw, phase: 0, speed: 0, neck, kick: you.kick, touch: you.touch, hit: you.hit, t: view.time })
    writeFigure('solid', 0, 'you', 3)
    let n = 1
    let g = 0
    let nr = 0
    let ng = 0
    flatAt(blobs, 0, 0, 0, 0, 1.2, 1.2)
    flatAt(casts, 0, 0.45, 0.78, 150 * DEG, 0.8 * FIG, 1.8)
    flatAt(
      rings,
      nr++,
      0,
      0,
      0,
      1.9,
      1.9,
      colorOf('#d7ff3a', 1.25 + (view.ballComing ? 0.6 + 0.5 * Math.sin(view.time * 12) : 0)),
    )
    chevron.position.set(Math.sin(view.head) * 1.25, 0.02, -Math.cos(view.head) * 1.25)
    chevron.rotation.set(0, -view.head, 0)
    chevron.visible = !view.idle

    for (const f of view.figures) {
      const kit = KITS[f.kind]
      const toYou = angleOf(-f.x, -f.y)
      const a = animFor(f.key, f.x, f.y, toYou)
      animate(a, f.x, f.y, dc, toYou, f.kind)
      const neckTurn = clamp(wrap(toYou - a.yaw), -1.1, 1.1) * 0.8
      if (f.shown && n < MAX_FIGURES) {
        pose(rig, {
          x: f.x,
          y: f.y,
          yaw: a.yaw,
          phase: a.phase,
          speed: a.speed,
          neck: neckTurn,
          kick: f.kick,
          t: view.time + a.variant,
        })
        writeFigure('solid', n, f.kind, a.variant)
        a.seen = { yaw: a.yaw, phase: a.phase, speed: a.speed, neck: neckTurn }
        flatAt(blobs, n, f.x, f.y, 0, 1.15, 1.15)
        const away = angleOf(f.x, f.y)
        const l = 2.7 * FIG
        flatAt(casts, n, f.x + Math.sin(away) * l * 0.5, f.y - Math.cos(away) * l * 0.5, away, 0.8 * FIG, l)
        // Pressers' rings burn brighter the closer they get.
        const near = f.kind === 'press' ? 1 + 1.6 * clamp(1 - Math.hypot(f.x, f.y) / 9, 0, 1) : 1
        flatAt(rings, nr++, f.x, f.y, 0, 1.55, 1.55, colorOf(kit.ring, (f.kind === 'opp' ? 0.55 : 1.05) * near))
        n++
      } else if (f.ghost && g < MAX_GHOSTS) {
        const s = a.seen || { yaw: toYou, phase: a.phase, speed: 0, neck: 0 }
        pose(rig, { x: f.ghost.x, y: f.ghost.y, yaw: s.yaw, phase: s.phase, speed: s.speed, neck: s.neck, t: 0 })
        writeFigure('ghost', g, f.kind, a.variant, 0.55 * f.ghost.alpha)
        flatAt(ghostRings, ng++, f.ghost.x, f.ghost.y, view.time * 0.4, 1.55, 1.55, colorOf(kit.ring, 1.1 * f.ghost.alpha))
        g++
      }
    }
    for (const part of Object.values(body)) {
      part.solid.count = n * part.per
      part.ghost.count = g * part.per
      for (const m of [part.solid, part.ghost]) {
        m.instanceMatrix.needsUpdate = true
        m.instanceColor.needsUpdate = true
      }
    }

    // The ball: it rolls as it travels, and sits at your feet when it is yours.
    const B = view.ball
    ball.visible = !!B?.shown
    if (B) {
      let bx = B.x
      let by = B.y
      if (B.held) {
        bx = Math.sin(youYaw) * 0.55 * FIG
        by = -Math.cos(youYaw) * 0.55 * FIG
      }
      if (lastBall.set) {
        const dx = bx - lastBall.x
        const dz = by - lastBall.y
        const dist = Math.hypot(dx, dz)
        if (dist > 1e-4 && dist < 3) {
          q.setFromAxisAngle(pos.set(dz / dist, 0, -dx / dist), dist / BALL_R)
          ballSpin.premultiply(q)
        }
      }
      lastBall.x = bx
      lastBall.y = by
      lastBall.set = true
      ball.position.set(bx, BALL_R, by)
      ball.quaternion.copy(ballSpin)
      ballMat.emissiveIntensity = B.glow ? 0.75 : 0.32
      if (B.shown) flatAt(blobs, n, bx, by, 0, 0.75, 0.75)
    } else lastBall.set = false
    blobs.count = n + (B?.shown ? 1 : 0)
    casts.count = n
    rings.count = nr
    ghostRings.count = ng
    for (const m of [blobs, casts, rings, ghostRings]) {
      m.instanceMatrix.needsUpdate = true
      m.instanceColor.needsUpdate = true
    }

    // Ground marks from the game, then the shock waves.
    let di = 0
    const mark = (x, y, { r, w = 0.14, color, alpha = 1, dash = 0, spin = 0, a0 = 0, len = 7 }) => {
      if (di >= decals.length) return
      const d = decals[di++]
      const u = d.material.uniforms
      const extent = r + w * 4
      d.visible = true
      d.position.set(x, 0.018, y)
      d.scale.setScalar(extent)
      u.uExtent.value = extent
      u.uR.value = r
      u.uW.value = w
      u.uColor.value.copy(color)
      u.uAlpha.value = alpha
      u.uDash.value = dash
      u.uSpin.value = spin
      u.uA0.value = a0
      u.uLen.value = len
    }
    for (const m of view.decals) mark(m.x, m.y, { ...m, color: colorOf(m.color, m.k ?? 1.6) })
    if (slowK > 0.02) {
      mark(0, 0, {
        r: 3.4 - slowK * 0.4,
        w: 0.06,
        color: colorOf('#f2f2ee', 0.8),
        alpha: slowK * 0.25,
        dash: 64,
        spin: -view.time * 0.3,
      })
    }
    for (const s of shocks) {
      s.age += dt
      const e = s.age / s.life
      mark(s.x, s.y, {
        r: s.from + (s.to - s.from) * (1 - (1 - e) * (1 - e)),
        w: s.w * (1 - e * 0.5),
        color: s.color,
        alpha: s.alpha * (1 - e),
      })
    }
    for (let i = shocks.length - 1; i >= 0; i--) if (shocks[i].age >= shocks[i].life) shocks.splice(i, 1)
    for (; di < decals.length; di++) decals[di].visible = false

    // Sparks fall and fade.
    for (const s of sparks) {
      s.age += dt
      s.vy -= 7 * dt
      const drag = Math.exp(-2.2 * dt)
      s.vx *= drag
      s.vz *= drag
      s.x += s.vx * dt
      s.y = Math.max(0.03, s.y + s.vy * dt)
      s.z += s.vz * dt
    }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].age >= sparks[i].life) sparks.splice(i, 1)
    sparks.forEach((s, i) => {
      const k = 1 - s.age / s.life
      sp[i * 3] = s.x
      sp[i * 3 + 1] = s.y
      sp[i * 3 + 2] = s.z
      sc[i * 3] = s.color.r * k
      sc[i * 3 + 1] = s.color.g * k
      sc[i * 3 + 2] = s.color.b * k
      ss[i] = s.size * (0.5 + 0.5 * k)
    })
    sparkGeo.setDrawRange(0, sparks.length)
    for (const name of ['position', 'aColor', 'aSize']) sparkGeo.attributes[name].needsUpdate = true

    // Slow motion pushes in a touch.
    const zoomTo = view.reducedMotion ? 1 : 1 + 0.05 * slowK
    if (Math.abs(zoomTo - zoom) > 1e-4) {
      zoom = zoomTo
      camera.zoom = zoom
      camera.updateProjectionMatrix()
    }
    if (bloom) bloom.intensity = 1.15 + danger * 0.8
    composer.render(dt)
  }

  return {
    canvas,
    setSize,
    render,
    fx,
    /** Screen position (CSS pixels) of a point on the pitch, h metres up. */
    project(x, y, h = 0) {
      v3.set(x, h, y).project(camera)
      return { x: ((v3.x + 1) / 2) * W, y: ((1 - v3.y) / 2) * H }
    },
    /** The point on the pitch under a screen position, or null above the horizon. */
    unproject(px, py) {
      v3.set((px / W) * 2 - 1, 1 - (py / H) * 2, 0.5).unproject(camera)
      const o = camera.position
      const dy = v3.y - o.y
      if (dy >= -1e-6) return null
      const k = -o.y / dy
      return { x: o.x + (v3.x - o.x) * k, y: o.z + (v3.z - o.z) * k }
    },
    /** Pixels per metre at a point on the pitch. */
    scaleAt(x, y) {
      const a = this.project(x - 0.5, y)
      const b = this.project(x + 0.5, y)
      return Math.hypot(b.x - a.x, b.y - a.y)
    },
    /** One step down in quality, when frames run slow. Returns false at the lowest. */
    lower() {
      if (level >= 2) return false
      level++
      setSize(W, H, askedRatio, tall)
      return true
    },
    get quality() {
      return ['high', 'medium', 'low'][level]
    },
    /** True once the browser has taken the WebGL context away (the game then draws flat). */
    get lost() {
      return shared.lost
    },
    dispose() {
      composer?.dispose()
      for (const d of disposables) d.dispose?.()
      for (const part of Object.values(body)) {
        part.solid.dispose()
        part.ghost.dispose()
      }
      for (const m of [blobs, casts, rings, ghostRings]) m.dispose()
    },
  }
}
