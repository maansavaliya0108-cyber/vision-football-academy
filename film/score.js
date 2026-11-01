// The score and sound for "Head Up", synthesised offline (no samples), so the film renders the same
// every time. 96 BPM: each day of the training week is one bar. Music runs in film time; the sounds
// of play (kicks, the tackle, the net) are cued in story time and mapped onto the edit.

const BEAT = 60 / 96
const RATE = 48000
let seed = 7
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)

// Chords as MIDI notes, with a bass note.
const CHORD = {
  Dm: { notes: [50, 53, 57], bass: 38 },
  Bb: { notes: [50, 53, 58], bass: 46 },
  F: { notes: [53, 57, 60], bass: 41 },
  C: { notes: [52, 55, 60], bass: 48 },
  A: { notes: [49, 52, 57], bass: 45 },
  D: { notes: [50, 54, 57], bass: 38 },
}

export async function score(duration, storyAt, { MON, DAY, CHECKS }) {
  seed = 7
  const ac = new OfflineAudioContext(2, Math.ceil(RATE * duration), RATE)
  // Film time of a story moment (the first frame that reaches it).
  const film = (s) => {
    let lo = 0
    let hi = duration
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (storyAt(mid) < s) lo = mid
      else hi = mid
    }
    return hi
  }

  // Buses: music (through a filter that muffles the freeze and the slow motion), effects, reverb.
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  comp.attack.value = 0.004
  comp.release.value = 0.2
  comp.connect(ac.destination)
  const master = ac.createGain()
  master.gain.value = 0.8
  master.connect(comp)
  const muffle = ac.createBiquadFilter()
  muffle.type = 'lowpass'
  muffle.Q.value = 0.5
  muffle.frequency.value = 20000
  muffle.connect(master)
  const music = ac.createGain()
  music.connect(muffle)
  const sfx = ac.createGain()
  sfx.connect(master)
  const verb = ac.createConvolver()
  verb.buffer = impulse(ac, 2.6)
  const verbIn = ac.createGain()
  verbIn.gain.value = 0.5
  verbIn.connect(verb)
  verb.connect(master)
  const muffleAt = (t, hz, glide = 0.08) => {
    muffle.frequency.setTargetAtTime(hz, t, glide)
  }
  // The freeze and the two slow-motion beats are heard as if underwater.
  muffleAt(19.15, 320, 0.03)
  muffleAt(21.4, 20000, 0.15)
  muffleAt(41.2, 700, 0.05)
  muffleAt(45.1, 20000, 0.1)
  muffleAt(46.8, 500, 0.05)
  muffleAt(48.75, 20000, 0.02)

  const noise = ac.createBuffer(2, RATE * 3, RATE)
  for (let c = 0; c < 2; c++) {
    const d = noise.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] = random() * 2 - 1
  }

  // ---------- Instruments ----------
  const env = (g, t, a, peak, d, sustain = 0, hold = 0, release = 0.05) => {
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + a)
    g.gain.setTargetAtTime(sustain, t + a, d / 4)
    if (hold) {
      g.gain.setValueAtTime(sustain, t + a + hold)
      g.gain.linearRampToValueAtTime(0, t + a + hold + release)
    }
  }
  const out = (node, bus, pan = 0, wet = 0) => {
    const p = ac.createStereoPanner()
    p.pan.value = pan
    node.connect(p)
    p.connect(bus)
    if (wet) {
      const w = ac.createGain()
      w.gain.value = wet
      p.connect(w)
      w.connect(verbIn)
    }
    return p
  }
  const noiseSrc = (t, dur) => {
    const s = ac.createBufferSource()
    s.buffer = noise
    s.loop = true
    s.start(t, random() * 2, dur + 0.1)
    return s
  }
  const osc = (type, f, t, dur) => {
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = f
    o.start(t)
    o.stop(t + dur + 0.05)
    return o
  }
  const filter = (type, f, q = 0.7) => {
    const b = ac.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    return b
  }

  function kick(t, level = 1, bus = music) {
    const o = osc('sine', 150, t, 0.5)
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
    const g = ac.createGain()
    env(g, t, 0.003, 0.9 * level, 0.42)
    o.connect(g)
    out(g, bus)
  }
  function clap(t, level = 1, pan = 0) {
    const n = noiseSrc(t, 0.3)
    const b = filter('bandpass', 1500, 0.8)
    const g = ac.createGain()
    env(g, t, 0.002, 0.5 * level, 0.22)
    n.connect(b).connect(g)
    out(g, music, pan, 0.25)
  }
  function hat(t, level = 1, open = false) {
    const n = noiseSrc(t, 0.4)
    const b = filter('highpass', 7500)
    const g = ac.createGain()
    env(g, t, 0.001, 0.16 * level, open ? 0.3 : 0.05)
    n.connect(b).connect(g)
    out(g, music, 0.25)
  }
  function bass(t, n, dur, level = 1) {
    const o = osc('sawtooth', midi(n), t, dur)
    const sub = osc('sine', midi(n - 12), t, dur)
    const lp = filter('lowpass', 420, 1.2)
    const g = ac.createGain()
    env(g, t, 0.01, 0.32 * level, 0.3, 0.2 * level, dur - 0.06, 0.05)
    o.connect(lp).connect(g)
    sub.connect(g)
    out(g, music)
  }
  function pad(t0, t1, notes, level = 1, cutoff = 1100) {
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(0.06 * level, t0 + Math.min(1.2, (t1 - t0) / 3))
    g.gain.setValueAtTime(0.06 * level, Math.max(t0 + 0.1, t1 - 0.6))
    g.gain.linearRampToValueAtTime(0, t1)
    const lp = filter('lowpass', cutoff, 0.6)
    lp.connect(g)
    for (const n of notes) {
      for (const det of [-7, 0, 6]) {
        const o = osc('sawtooth', midi(n), t0, t1 - t0)
        o.detune.value = det
        o.connect(lp)
      }
    }
    out(g, music, 0, 0.5)
  }
  function pluck(t, n, level = 1, pan = 0) {
    const o = osc('triangle', midi(n), t, 0.5)
    const o2 = osc('sawtooth', midi(n), t, 0.5)
    const lp = filter('lowpass', 2400)
    lp.frequency.setValueAtTime(2400, t)
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.3)
    const g = ac.createGain()
    env(g, t, 0.002, 0.08 * level, 0.35)
    o.connect(lp)
    const m = ac.createGain()
    m.gain.value = 0.3
    o2.connect(m).connect(lp)
    lp.connect(g)
    out(g, music, pan, 0.35)
  }
  function piano(t, n, level = 1, pan = 0) {
    const g = ac.createGain()
    env(g, t, 0.004, 0.11 * level, 3.2)
    ;[1, 2, 3, 4, 6].forEach((h, i) => {
      const o = osc('sine', midi(n) * h * (1 + i * 0.0007), t, 4)
      const hg = ac.createGain()
      hg.gain.value = [1, 0.42, 0.2, 0.1, 0.04][i]
      o.connect(hg).connect(g)
    })
    out(g, music, pan, 0.6)
  }
  function cymbal(t, level = 1) {
    const n = noiseSrc(t, 3)
    const b = filter('highpass', 5200)
    const g = ac.createGain()
    env(g, t, 0.002, 0.2 * level, 2.6)
    n.connect(b).connect(g)
    out(g, music, -0.1, 0.4)
  }
  function boom(t, level = 1, bus = music) {
    const o = osc('sine', 90, t, 2.2)
    o.frequency.setValueAtTime(90, t)
    o.frequency.exponentialRampToValueAtTime(32, t + 0.6)
    const g = ac.createGain()
    env(g, t, 0.004, 1.0 * level, 2.0)
    o.connect(g)
    out(g, bus, 0, 0.3)
    const n = noiseSrc(t, 0.6)
    const lp = filter('lowpass', 300)
    const ng = ac.createGain()
    env(ng, t, 0.002, 0.5 * level, 0.5)
    n.connect(lp).connect(ng)
    out(ng, bus)
  }
  // A swell that ends exactly on its hit.
  function riser(tEnd, dur, level = 1) {
    const t = tEnd - dur
    const n = noiseSrc(t, dur)
    const b = filter('bandpass', 400, 1.4)
    b.frequency.setValueAtTime(300, t)
    b.frequency.exponentialRampToValueAtTime(5200, tEnd)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.32 * level, tEnd - 0.02)
    g.gain.linearRampToValueAtTime(0, tEnd)
    n.connect(b).connect(g)
    out(g, music, 0, 0.3)
  }
  function whoosh(t, dur = 0.35, level = 1, pan = 0) {
    const n = noiseSrc(t, dur)
    const b = filter('bandpass', 600, 1.2)
    b.frequency.setValueAtTime(500, t)
    b.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.6)
    b.frequency.exponentialRampToValueAtTime(900, t + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.32 * level, t + dur * 0.5)
    g.gain.linearRampToValueAtTime(0, t + dur)
    n.connect(b).connect(g)
    out(g, sfx, pan)
  }
  // The scan: a shoulder check, heard as a bright rising shimmer.
  function scan(t, level = 1, pan = 0) {
    whoosh(t - 0.06, 0.3, 0.6 * level, pan)
    for (const [f, d] of [[1320, 0], [1980, 4]]) {
      const o = osc('sine', f, t, 0.6)
      o.frequency.setValueAtTime(f * 0.7, t)
      o.frequency.exponentialRampToValueAtTime(f, t + 0.12)
      o.detune.value = d
      const g = ac.createGain()
      env(g, t, 0.01, 0.05 * level, 0.5)
      o.connect(g)
      out(g, sfx, pan, 0.7)
    }
  }
  function ballHit(t, level = 1, pan = 0) {
    const o = osc('sine', 170, t, 0.15)
    o.frequency.setValueAtTime(170, t)
    o.frequency.exponentialRampToValueAtTime(70, t + 0.08)
    const g = ac.createGain()
    env(g, t, 0.001, 0.55 * level, 0.12)
    o.connect(g)
    out(g, sfx, pan)
    const n = noiseSrc(t, 0.06)
    const b = filter('bandpass', 1800, 1)
    const ng = ac.createGain()
    env(ng, t, 0.001, 0.3 * level, 0.03)
    n.connect(b).connect(ng)
    out(ng, sfx, pan, 0.15)
  }
  function whistle(t, dur, level = 1) {
    const o = osc('sine', 2950, t, dur)
    const trill = osc('sine', 34, t, dur)
    const depth = ac.createGain()
    depth.gain.value = 140
    trill.connect(depth).connect(o.frequency)
    const g = ac.createGain()
    env(g, t, 0.015, 0.09 * level, 0.1, 0.08 * level, dur - 0.04, 0.04)
    o.connect(g)
    out(g, sfx, 0.3, 0.5)
  }
  // A floodlight relay: a heavy clunk, then the hum of the lamps.
  function relay(t, pan) {
    boom(t, 0.35, sfx)
    ballHit(t, 0.9, pan)
    const h = osc('sawtooth', 100, t, duration - t)
    const lp = filter('lowpass', 260)
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.012, t + 0.4)
    g.gain.setValueAtTime(0.012, 8.5)
    g.gain.linearRampToValueAtTime(0.004, 10)
    h.connect(lp).connect(g)
    out(g, sfx, pan)
  }
  // Wash of noise through a few bands, each breathing at its own rate: wind, rain, a crowd.
  function wash(t0, t1, bands, level, fadeIn = 0.6, fadeOut = 0.6, lfo = 0) {
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(level, t0 + fadeIn)
    g.gain.setValueAtTime(level, t1 - fadeOut)
    g.gain.linearRampToValueAtTime(0, t1)
    bands.forEach(([f, q, w], i) => {
      const n = noiseSrc(t0, t1 - t0)
      const b = filter('bandpass', f, q)
      const bg = ac.createGain()
      bg.gain.value = w
      if (lfo) {
        const l = osc('sine', lfo * (0.7 + i * 0.37), t0, t1 - t0)
        const lg = ac.createGain()
        lg.gain.value = w * 0.6
        l.connect(lg).connect(bg.gain)
      }
      n.connect(b).connect(bg).connect(g)
    })
    out(g, sfx, 0, 0.2)
    return g
  }
  function crickets(t0, t1) {
    for (let t = t0 + 0.3; t < t1; t += 0.55 + random() * 0.7) {
      const o = osc('sine', 4300 + random() * 500, t, 0.25)
      const am = osc('square', 38, t, 0.25)
      const g = ac.createGain()
      g.gain.value = 0
      const a = ac.createGain()
      a.gain.value = 0.006
      am.connect(a).connect(g.gain)
      o.connect(g)
      out(g, sfx, random() * 1.4 - 0.7)
    }
  }

  // ---------- 0–8: dusk, and the lights ----------
  wash(0, 21, [[180, 0.6, 1], [520, 0.8, 0.5]], 0.12, 1.5, 2, 0.15) // wind and the city
  crickets(0.4, 8.6)
  ;[[2.4, -0.6], [4.6, 0.7], [5.2, -0.3], [5.8, 0.4]].forEach(([t, p]) => relay(t, p))
  pad(4.0, 8.2, [38, 45, 50], 0.9, 600)
  riser(8.0, 2.2, 0.6)

  // ---------- 8–19.15: the walk on, the drill, the lost ball ----------
  const ARP = [62, 65, 69, 72, 69, 65, 62, 57]
  for (let t = 8, i = 0; t < 19.1; t += BEAT, i++) {
    kick(t, t < 15.5 ? 0.55 : 0.75)
    if (i % 2 === 1) hat(t, 0.5)
    hat(t + BEAT / 2, 0.35)
    pluck(t, ARP[(i * 2) % 8], 0.8, -0.3)
    pluck(t + BEAT / 2, ARP[(i * 2 + 1) % 8], 0.7, 0.3)
    if (t >= 15.5) bass(t, i % 8 < 4 ? 38 : 46, BEAT * 0.9, 0.8)
  }
  pad(8, 15.5, [50, 53, 57], 0.8)
  pad(15.5, 19.15, [46, 50, 53, 58], 0.9, 1400)
  riser(19.15, 3.2, 0.9)
  // Ball touches as he walks on, the flick, the passes.
  for (let s = 7.8; s < 13.2; s += 0.62) ballHit(film(s), 0.25, -0.2)
  ballHit(film(13.25), 0.5)
  ballHit(film(14.42), 0.45)
  ballHit(film(15.0), 0.8, 0.3)
  ballHit(film(16.1), 0.5, 0.5)
  ballHit(film(16.6), 0.8, 0.5)
  ballHit(film(17.65), 0.5)
  // The tackle, and the freeze.
  whoosh(film(18.75), 0.4, 1.2, -0.4)
  ballHit(film(19.02), 1.2, -0.2)
  boom(19.15, 0.9, sfx)
  cymbal(19.15, 0.5)

  // ---------- 19.15–25.5: HEAD DOWN, and the coach ----------
  pad(19.15, 21.6, [26, 38, 45], 1.4, 300)
  piano(19.3, 38, 1.2)
  piano(19.3, 45, 0.8)
  whistle(21.62, 0.32)
  pad(21.6, 25.5, [50, 53, 57, 62], 0.85, 900)
  ;[[21.9, 69], [22.55, 65], [23.2, 62], [23.85, 64], [24.5, 65]].forEach(([t, n]) => piano(t, n, 0.9, 0.15))
  riser(25.5, 1.6, 0.9)

  // ---------- 25.5–38: Monday to Friday, one bar each ----------
  const WEEK = ['Dm', 'Bb', 'F', 'C', 'A']
  WEEK.forEach((name, d) => {
    const bar = 25.5 + d * DAY
    const ch = CHORD[name]
    boom(bar, 0.45)
    if (d > 0) cymbal(bar, 0.35)
    pad(bar, bar + DAY, ch.notes, 0.7 + d * 0.08, 900 + d * 250)
    for (let b = 0; b < 4; b++) {
      const t = bar + b * BEAT
      kick(t, 0.85)
      if (d >= 1 || b % 2) hat(t + BEAT / 2, 0.55)
      if (d >= 1 && b % 2 === 1) clap(t, 0.8)
      if (d >= 3) {
        hat(t + BEAT / 4, 0.3)
        hat(t + (3 * BEAT) / 4, 0.3)
      }
      bass(t, ch.bass, BEAT / 2 - 0.02, 0.9)
      bass(t + BEAT / 2, ch.bass + (b === 3 ? 7 : 12), BEAT / 2 - 0.02, 0.7)
      if (d >= 2) {
        pluck(t, ch.notes[b % 3] + 12, 0.7, -0.35)
        pluck(t + BEAT / 2, ch.notes[(b + 1) % 3] + 12, 0.6, 0.35)
      }
    }
    // His shoulder checks, faster every day; the passes in and out.
    const s0 = MON + d * DAY
    for (const [c, yaw] of CHECKS[d]) scan(film(s0 + c), 1, yaw > 0 ? -0.5 : 0.5)
    ballHit(film(s0 + 0.9), 0.6, 0.6)
    ballHit(film(s0 + 1.95), 0.55)
    ballHit(film(s0 + 2.3), 0.75, -0.3)
  })
  wash(film(MON + 2 * DAY), film(MON + 3 * DAY), [[2500, 0.4, 1], [6000, 0.5, 0.7], [900, 0.6, 0.4]], 0.16, 0.15, 0.1) // rain
  riser(37.95, 1.8, 1)
  boom(36.4, 0.4)

  // ---------- 38–41.2: match night ----------
  const crowd = wash(38, duration - 3.5, [[450, 1.2, 1], [900, 1.4, 0.8], [1800, 1.6, 0.5], [3200, 2, 0.25]], 0.09, 0.4, 3, 0.7)
  crowd.gain.setValueAtTime(0.09, 47.3)
  crowd.gain.linearRampToValueAtTime(0.32, 48.9) // the goal
  crowd.gain.setTargetAtTime(0.12, 50.5, 0.8)
  whistle(38.15, 0.18, 0.7)
  pad(38, 41.2, [26, 38, 45, 50], 1.2, 500)
  for (let t = 38; t < 41.2; t += BEAT) {
    kick(t, 0.6)
    for (let k = 0; k < 4; k++) hat(t + (k * BEAT) / 4, k ? 0.18 : 0.3)
  }
  ballHit(film(37.6), 0.7, -0.5)
  scan(film(37.9), 1.2, 0.5)
  scan(film(38.48), 1.2, -0.5)

  // ---------- 41.2–48.8: the pass, in slow motion; the shot; the net ----------
  const pass = film(39.12)
  boom(pass, 1.1, sfx)
  ballHit(pass, 1.0)
  for (let t = 41.4; t < 45.1; t += 0.95) {
    kick(t, 0.7, sfx)
    kick(t + 0.22, 0.45, sfx)
  }
  pad(41.2, 45.2, [62, 69, 74], 1.1, 3000)
  const shimmer = osc('sine', midi(81), 43.0, 2.2)
  shimmer.frequency.setValueAtTime(midi(81), 43.0)
  shimmer.frequency.exponentialRampToValueAtTime(midi(93), 45.2)
  const sg = ac.createGain()
  sg.gain.setValueAtTime(0, 43.0)
  sg.gain.linearRampToValueAtTime(0.035, 44.6)
  sg.gain.linearRampToValueAtTime(0, 45.2)
  shimmer.connect(sg)
  out(sg, sfx, 0, 0.8)
  riser(45.2, 1.0, 0.8)
  for (let t = 45.2; t < 46.8; t += BEAT / 2) {
    kick(t, 0.75)
    hat(t + BEAT / 4, 0.4)
  }
  ballHit(film(40.29), 0.7, 0.3)
  ballHit(film(41.12), 1.3, 0.2)
  whoosh(film(41.2), 0.5, 0.8, 0.3)
  // The net: a deep, slowed thump, then the ground erupts.
  boom(film(41.65), 1.2, sfx)
  wash(film(41.65), film(41.65) + 0.9, [[220, 0.8, 1], [700, 1, 0.5]], 0.35, 0.02, 0.8)
  riser(48.8, 1.3, 1)

  // ---------- 48.8–58.5: the goal, HEAD UP, the pathway ----------
  boom(48.8, 1)
  cymbal(48.8, 1)
  const ANTHEM = ['D', 'Bb', 'C', 'D']
  for (let bar = 0; bar < 4; bar++) {
    const t0 = 48.8 + bar * 4 * BEAT
    const ch = CHORD[ANTHEM[bar]]
    pad(t0, t0 + 4 * BEAT + 0.05, [...ch.notes, ch.notes[0] + 12], 1.0, 2200)
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * BEAT
      const quiet = t >= 51.55 && t < 53.9 // the close-up: the drums step back
      if (!quiet) {
        kick(t, 0.95)
        if (b % 2) clap(t, 1)
        hat(t + BEAT / 2, 0.6)
        bass(t, ch.bass, BEAT / 2 - 0.02, 1)
        bass(t + BEAT / 2, ch.bass + 12, BEAT / 2 - 0.02, 0.8)
      }
      pluck(t, ch.notes[b % 3] + 12, 0.8, -0.3)
      pluck(t + BEAT / 2, ch.notes[(b + 2) % 3] + 24, 0.6, 0.3)
    }
  }
  // As he looks up: the piano, then the title.
  ;[[51.65, 74], [52.0, 73], [52.3, 69]].forEach(([t, n]) => piano(t, n, 1.1, 0.1))
  riser(52.3, 0.7, 0.7)
  boom(52.3, 1.1)
  cymbal(52.3, 0.8)
  pad(52.3, 54.2, [50, 54, 57, 62, 66], 1.1, 2600)
  riser(54.0, 0.6, 0.5)
  for (let t = 54.0, i = 0; t < 58.4; t += BEAT, i++) {
    kick(t, 0.95)
    if (i % 2) clap(t, 1)
    hat(t + BEAT / 2, 0.6)
    hat(t + BEAT / 4, 0.3)
    bass(t, i < 4 ? 46 : 48, BEAT / 2 - 0.02, 1)
    bass(t + BEAT / 2, (i < 4 ? 46 : 48) + 12, BEAT / 2 - 0.02, 0.8)
  }
  pad(54.0, 56.5, [50, 53, 58, 62], 1.0, 2400)
  pad(56.5, 58.6, [52, 55, 60, 64], 1.05, 2600)
  ;[54.3, 55.4, 56.5].forEach((t, i) => boom(t, 0.35 + i * 0.1)) // each step of the pathway
  riser(58.6, 1.5, 0.9)

  // ---------- 58.5–end: the end card ----------
  boom(58.65, 1.2)
  cymbal(58.65, 1)
  pad(58.65, duration - 0.3, [38, 50, 54, 57, 62, 66, 69], 1.25, 2400)
  bass(58.65, 38, 4.5, 0.9)
  ;[[58.7, 62], [59.3, 66], [60.2, 69], [60.8, 74]].forEach(([t, n]) => piano(t, n, 1.0, 0.1))

  const buffer = await ac.startRendering()
  // Normalise to just under full scale.
  let peak = 0
  for (let c = 0; c < 2; c++) for (const v of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(v))
  const k = peak > 0 ? 0.89 / peak : 1
  for (let c = 0; c < 2; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] *= k
  }
  return buffer
}

function impulse(ac, seconds) {
  const len = Math.floor(ac.sampleRate * seconds)
  const b = ac.createBuffer(2, len, ac.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
  }
  return b
}
