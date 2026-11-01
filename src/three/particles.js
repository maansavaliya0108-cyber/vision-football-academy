// The particle story itself: the shaders, the geometry of every formation, and the uniforms and
// materials they need. Shared by the scroll story on the site (ParticleCanvas) and the promo video
// renderer (promo/), so both draw exactly the same scene.
import * as THREE from 'three'
import { PASS_PATHS, ballShape, pitchShape, playShape, scatterShape, wordShape, wordmarkShape } from './shapes'

const BALL_RADIUS = 2.3

export const vertexShader = /* glsl */ `
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

export const fragmentShader = /* glsl */ `
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

export async function buildGeometry(n) {
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
export const MAX_TRAILS = 5

/** One set of uniforms, shared by the particles and every trail copy. */
export function createUniforms() {
  return {
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
  }
}

/** The particles (index 0) and the trail copies (1 to MAX_TRAILS), each with its own uTrail. */
export function createMaterials(uniforms) {
  return Array.from(
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
  )
}
