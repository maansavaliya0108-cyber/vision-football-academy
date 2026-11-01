// The film's set: a night pitch in Adajan. A floodlit turf with real markings, four light towers with
// beams through the haze, a goal with a net that ripples, a school block and trees, a city skyline
// with the warm glow of Surat behind it, drifting dust, and rain for one day of the montage.
import * as THREE from 'three'

export const PITCH = { halfLength: 34, halfWidth: 22 }
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

function turfTexture() {
  const W = 2400
  const H = 1600 // 80 m × 53.3 m
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const m = W / 80 // pixels per metre
  const X = (x) => (x + 40) * m
  const Z = (z) => (z + 26.65) * m
  // Mown stripes across the pitch.
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#11251a' : '#14301f'
    g.fillRect(i * 5 * m, 0, 5 * m + 1, H)
  }
  // Grain.
  const r = rng(5)
  for (let i = 0; i < 90000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(120,160,110,0.06)'
    g.fillRect(r() * W, r() * H, 2, 2)
  }
  // Markings.
  const L = PITCH.halfLength
  const Wd = PITCH.halfWidth
  g.strokeStyle = 'rgba(235,240,232,0.9)'
  g.lineWidth = 0.12 * m
  g.strokeRect(X(-L), Z(-Wd), 2 * L * m, 2 * Wd * m)
  g.beginPath()
  g.moveTo(X(0), Z(-Wd))
  g.lineTo(X(0), Z(Wd))
  g.stroke()
  g.beginPath()
  g.arc(X(0), Z(0), 9.15 * m, 0, Math.PI * 2)
  g.stroke()
  for (const s of [-1, 1]) {
    const gx = s * L
    g.strokeRect(Math.min(X(gx), X(gx - s * 16.5)), Z(-20.16), 16.5 * m, 40.32 * m)
    g.strokeRect(Math.min(X(gx), X(gx - s * 5.5)), Z(-9.16), 5.5 * m, 18.32 * m)
    g.fillStyle = 'rgba(235,240,232,0.9)'
    g.beginPath()
    g.arc(X(gx - s * 11), Z(0), 0.15 * m, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.arc(X(gx - s * 11), Z(0), 9.15 * m, s > 0 ? Math.PI - 0.93 : -0.93, s > 0 ? Math.PI + 0.93 : 0.93)
    g.stroke()
  }
  g.beginPath()
  g.arc(X(0), Z(0), 0.2 * m, 0, Math.PI * 2)
  g.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** A cone of light through the haze: bright at the lamp, fading along its length and at its edges. */
function beam(from, to, radius, color = '#fff6e0') {
  const length = from.distanceTo(to)
  const g = new THREE.CylinderGeometry(0.6, radius, length, 48, 1, true)
  g.translate(0, -length / 2, 0)
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uLevel: { value: 0 }, uColor: { value: new THREE.Color(color) }, uLength: { value: length } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      uniform float uLength;
      void main() {
        vAlong = -position.y / uLength;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      uniform float uLevel;
      uniform vec3 uColor;
      void main() {
        float edge = pow(abs(dot(vN, vView)), 1.6);
        float a = edge * pow(1.0 - vAlong, 1.4) * 0.07 * uLevel;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.position.copy(from)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize())
  mesh.renderOrder = 2
  return mesh
}

function tower(scene, x, z, castShadow, index) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  const steel = new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.8, metalness: 0.3 })
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 22, 10), steel)
  pole.position.y = 11
  group.add(pole)
  const headPos = new THREE.Vector3(0, 22.5, 0)
  const head = new THREE.Group()
  head.position.copy(headPos)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 0.3), steel)
  head.add(frame)
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fffdf2'), toneMapped: false })
  const lamps = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.62), lampMat.clone())
      lamp.position.set(-1.45 + c * 0.97, -0.75 + r * 0.75, 0.16)
      head.add(lamp)
      lamps.push(lamp)
    }
  }
  head.lookAt(new THREE.Vector3(-x * 0.3, 0, -z * 0.3).sub(group.position).add(headPos))
  group.add(head)
  scene.add(group)

  const target = new THREE.Object3D()
  target.position.set(x * 0.15, 0, z * 0.1)
  scene.add(target)
  const light = new THREE.SpotLight('#fff4e2', 0, 140, 0.62, 0.65, 0)
  light.position.set(x, 22.5, z)
  light.target = target
  if (castShadow) {
    light.castShadow = true
    light.shadow.mapSize.set(2048, 2048)
    light.shadow.camera.near = 8
    light.shadow.camera.far = 110
    light.shadow.bias = -0.0004
    light.shadow.normalBias = 0.02
  }
  scene.add(light)
  const b = beam(new THREE.Vector3(x, 22.3, z), new THREE.Vector3(x * 0.12, 0, z * 0.08), 17)
  scene.add(b)
  return { lamps, light, beam: b, index }
}

function sky() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.1, 1.0);
          vec3 zenith = vec3(0.008, 0.012, 0.022);
          vec3 horizon = vec3(0.05, 0.07, 0.11);
          vec3 glow = vec3(0.22, 0.12, 0.05); // the city's sodium glow, low on the horizon
          vec3 c = mix(horizon, zenith, smoothstep(0.0, 0.45, h));
          c += glow * exp(-max(h, 0.0) * 14.0) * 0.55;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  )
}

function skyline(scene) {
  const r = rng(17)
  const n = 260
  const box = new THREE.BoxGeometry(1, 1, 1)
  box.translate(0, 0.5, 0)
  const mesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: '#05070b' }), n)
  const windows = []
  const m = new THREE.Matrix4()
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const d = 150 + r() * 120
    const w = 8 + r() * 22
    const h = 6 + Math.pow(r(), 2) * 48
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), new THREE.Vector3(w, h, 8 + r() * 10))
    mesh.setMatrixAt(i, m)
    // Lit windows on the face towards the ground.
    for (let k = 0; k < 6 + h / 3; k++) {
      if (r() < 0.55) continue
      const u = (r() - 0.5) * w * 0.9
      windows.push(x - Math.cos(a) * 4 + -Math.sin(a) * u, 2 + r() * (h - 3), z - Math.sin(a) * 4 + Math.cos(a) * u)
    }
  }
  scene.add(mesh)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(windows, 3))
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffc27a', size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.8, fog: false })))
}

function surroundings(scene) {
  const r = rng(29)
  const dark = new THREE.MeshStandardMaterial({ color: '#07090a', roughness: 1 })
  // A long school block along one side.
  const block = new THREE.Mesh(new THREE.BoxGeometry(60, 12, 10), dark)
  block.position.set(-6, 6, -46)
  scene.add(block)
  const wins = []
  for (let f = 0; f < 3; f++) for (let i = 0; i < 18; i++) if (r() < 0.35) wins.push(-34 + i * 3.2, 2.2 + f * 3.4, -40.9)
  const wg = new THREE.BufferGeometry()
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wins, 3))
  scene.add(new THREE.Points(wg, new THREE.PointsMaterial({ color: '#ffd9a0', size: 0.9, transparent: true, opacity: 0.85 })))
  // Trees around the ground: each crown a few lumpy clumps, so the silhouettes read as leaves.
  const crown = new THREE.IcosahedronGeometry(1, 2)
  const cp = crown.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < cp.count; i++) {
    v.fromBufferAttribute(cp, i)
    const k = 1 + 0.16 * Math.sin(v.x * 5.1 + v.y * 3.3) * Math.cos(v.z * 4.7 - v.y * 2.1) + 0.08 * Math.sin(v.x * 11 + v.z * 9)
    cp.setXYZ(i, v.x * k, v.y * k, v.z * k)
  }
  crown.computeVertexNormals()
  const trunk = new THREE.CylinderGeometry(0.2, 0.3, 4, 6)
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2
    const d = 52 + r() * 22
    const x = Math.cos(a) * d * 1.15
    const z = Math.sin(a) * d * 0.8
    if (z < -38 && Math.abs(x) < 36) continue
    const s = 2.5 + r() * 3.5
    for (let k = 0; k < 4; k++) {
      const c = new THREE.Mesh(crown, dark)
      const q = k === 0 ? 1 : 0.5 + r() * 0.35
      c.position.set(x + (r() - 0.5) * s * 1.3, 4 + s * (0.8 + (k ? (r() - 0.3) * 0.8 : 0)), z + (r() - 0.5) * s * 1.3)
      c.scale.set(s * q, s * q * (1 + r() * 0.3), s * q)
      c.rotation.set(r() * 6, r() * 6, r() * 6)
      scene.add(c)
    }
    const t = new THREE.Mesh(trunk, dark)
    t.position.set(x, 2, z)
    scene.add(t)
  }
}

function goal(scene, side) {
  const L = PITCH.halfLength
  const x = side * L
  const white = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.4, emissive: '#3a3a36' })
  const post = new THREE.CylinderGeometry(0.06, 0.06, 2.44, 10)
  for (const z of [-3.66, 3.66]) {
    const p = new THREE.Mesh(post, white)
    p.position.set(x, 1.22, z)
    p.castShadow = true
    scene.add(p)
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.32, 10), white)
  bar.rotation.x = Math.PI / 2
  bar.position.set(x, 2.44, 0)
  bar.castShadow = true
  scene.add(bar)
  // The net: a grid over the back and the roof, which ripples where the ball hits it.
  const depth = 1.8
  const pts = []
  const base = []
  const addLine = (a, b) => {
    pts.push(...a, ...b)
    base.push(...a, ...b)
  }
  const back = x + side * depth
  for (let z = -3.66; z <= 3.661; z += 0.3) addLine([back, 0, z], [back, 2.0, z])
  for (let y = 0; y <= 2.0; y += 0.3) addLine([back, y, -3.66], [back, y, 3.66])
  for (let z = -3.66; z <= 3.661; z += 0.3) addLine([x, 2.44, z], [back, 2.0, z])
  for (let d = 0; d <= depth; d += 0.3) addLine([x + side * d, 2.44 - (0.44 * d) / depth, -3.66], [x + side * d, 2.44 - (0.44 * d) / depth, 3.66])
  for (const z of [-3.66, 3.66]) for (let d = 0; d <= depth; d += 0.3) addLine([x + side * d, 0, z], [x + side * d, 2.44 - (0.44 * d) / depth, z])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  const net = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#e8ece6', transparent: true, opacity: 0.4 }))
  scene.add(net)
  return { net, base: new Float32Array(base), side }
}

function ballMesh() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#f5f5f2'
  g.fillRect(0, 0, 512, 256)
  g.fillStyle = '#16181a'
  const r = rng(3)
  for (let i = 0; i < 14; i++) {
    const x = r() * 512
    const y = 30 + r() * 196
    g.beginPath()
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      g.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22)
    }
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, emissive: '#2a2a28' }))
  m.castShadow = true
  return m
}

/** Dust drifting in the light; rain falling for one day of the montage. */
function atmosphere(scene) {
  const r = rng(41)
  const n = 2400
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) pos.set([(r() - 0.5) * 90, r() * 22, (r() - 0.5) * 64], i * 3)
  const dg = new THREE.BufferGeometry()
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#fff3d8', size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }))
  scene.add(dust)
  const drops = 5200
  const rp = new Float32Array(drops * 6)
  const seeds = new Float32Array(drops * 3)
  for (let i = 0; i < drops; i++) seeds.set([(r() - 0.5) * 80, r() * 26, (r() - 0.5) * 60], i * 3)
  const rg = new THREE.BufferGeometry()
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3))
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#cfd8e6', transparent: true, opacity: 0, depthWrite: false }))
  rain.frustumCulled = false
  scene.add(rain)
  return {
    update(t, rainAmount) {
      const p = dg.attributes.position.array
      for (let i = 0; i < n; i++) {
        p[i * 3] = pos[i * 3] + Math.sin(t * 0.3 + i) * 0.6
        p[i * 3 + 1] = pos[i * 3 + 1] + Math.sin(t * 0.21 + i * 1.7) * 0.4
      }
      dg.attributes.position.needsUpdate = true
      rain.material.opacity = 0.35 * rainAmount
      rain.visible = rainAmount > 0
      if (!rain.visible) return
      for (let i = 0; i < drops; i++) {
        const y = 26 - ((seeds[i * 3 + 1] + t * 24) % 26)
        const x = seeds[i * 3] + y * 0.08
        const z = seeds[i * 3 + 2]
        rp.set([x, y, z, x + 0.06, y + 0.55, z], i * 6)
      }
      rg.attributes.position.needsUpdate = true
    },
  }
}

/** A fan of volt light on the turf: a player's scan, from the eyes outward. */
export function scanFan() {
  const g = new THREE.CircleGeometry(16, 48, -0.55, 1.1)
  g.rotateX(-Math.PI / 2)
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uLevel: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      varying vec2 vP;
      uniform float uLevel;
      void main(){
        float d = length(vP) / 16.0;
        float a = (1.0 - d) * (1.0 - d) * 0.55 * uLevel;
        gl_FragColor = vec4(vec3(0.84, 1.0, 0.23) * a, a);
      }`,
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.position.y = 0.03
  mesh.renderOrder = 3
  return mesh
}

export function createWorld(scene) {
  scene.fog = new THREE.FogExp2('#0a111c', 0.0075)
  scene.add(sky())
  skyline(scene)
  surroundings(scene)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#08100b', roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  ground.receiveShadow = true
  scene.add(ground)
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(80, 53.3), new THREE.MeshStandardMaterial({ map: turfTexture(), roughness: 0.92 }))
  turf.rotation.x = -Math.PI / 2
  turf.receiveShadow = true
  scene.add(turf)
  scene.add(new THREE.HemisphereLight('#24324a', '#0a0d0b', 0.35))
  const towers = [
    tower(scene, -44, -31, true, 0),
    tower(scene, 44, 31, true, 1),
    tower(scene, 44, -31, false, 2),
    tower(scene, -44, 31, false, 3),
  ]
  const goals = [goal(scene, 1), goal(scene, -1)]
  const ball = ballMesh()
  scene.add(ball)
  const air = atmosphere(scene)
  return {
    ball,
    towers,
    goals,
    /** Light levels 0…1 for each tower (they come on one by one at the start). */
    setLights(levels) {
      towers.forEach((tw, i) => {
        const l = levels[i]
        tw.light.intensity = 2.1 * l
        tw.beam.material.uniforms.uLevel.value = l
        for (const lamp of tw.lamps) lamp.material.color.setScalar(0.05 + 2.2 * l)
      })
    },
    /** Ripples the net of goal `side` from a hit at height y, z, `age` seconds ago. */
    ripple(side, hit, age) {
      const G = goals.find((g) => g.side === side)
      const p = G.net.geometry.attributes.position.array
      for (let i = 0; i < p.length; i += 3) {
        const bx = G.base[i]
        const by = G.base[i + 1]
        const bz = G.base[i + 2]
        const d = Math.hypot(by - hit.y, bz - hit.z)
        const amp = age >= 0 ? Math.exp(-age * 2.2) * Math.exp(-d * d * 0.35) * 0.9 * Math.cos(age * 9 - d * 2) : 0
        p[i] = bx + side * Math.max(0, amp) * 0.9
        p[i + 1] = by
        p[i + 2] = bz
      }
      G.net.geometry.attributes.position.needsUpdate = true
    },
    update(t, rainAmount = 0) {
      air.update(t, rainAmount)
    },
  }
}
