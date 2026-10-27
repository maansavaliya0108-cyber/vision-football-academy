import { useEffect, useRef, useState } from 'react'
import { academy } from '../../shared/academy.js'
import { currentPath } from '../router'
import { storyState } from '../three/timeline'

/**
 * The film: an eight-second promo that opens the site on a first visit, like a sports-brand ad.
 * Floodlights snap on; hard cuts carry the method, the edge, the families' verdict and the
 * pathway; the brand lands; and a streak of light spirals into the spot where the 3D ball forms
 * as the scroll story takes over. Every line is a fact from shared/academy.js.
 *
 * It plays once per visitor, any time from the hero's "Play the film" button, and for anyone
 * opening a shared link with ?film in it. The CSS animations in site.css run on the same clock as
 * the timings below, so change both together.
 */

const SEEN = 'vfa-film-seen'
const LENGTH = 8.2 // seconds until it's gone
const HANDOVER = 7.15 // the particles start flying in to form the ball
// The streaks, in seconds: one pass across with "They see it first", then the spiral into the ball.
const ACROSS = [2.0, 2.7]
const SPIRAL = [6.45, 7.25]

// Decided once, as the app first loads: a first visit landing on the home page itself (or a shared
// ?film link), with nothing after it in the address and no preference for reduced motion.
const willPlay = (() => {
  try {
    if (currentPath() !== '/' || window.location.hash) return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    const shared = new URLSearchParams(window.location.search).has('film')
    return shared || !window.localStorage.getItem(SEEN)
  } catch {
    return false
  }
})()
// The particles wait for the handover, so they form the ball just as the film ends.
if (willPlay) storyState.holdIntro = true
let played = false

/** Plays the film again from anywhere on the home page. */
export const playFilm = () => window.dispatchEvent(new Event('vfa:film'))

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (t) => t * t * (3 - 2 * t)
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Where the 3D ball sits on screen, so the spiral ends exactly on it. */
const ballSpot = (w, h) => (w / h < 0.85 ? [w * 0.5, h * 0.34] : [w * 0.75, h * 0.37])

function across(u, w, h) {
  const P = [
    [-0.12 * w, 0.78 * h],
    [0.3 * w, 0.42 * h],
    [0.68 * w, 0.86 * h],
    [1.12 * w, 0.5 * h],
  ]
  const v = 1 - u
  const k = [v * v * v, 3 * v * v * u, 3 * v * u * u, u * u * u]
  return [0, 1].map((i) => k.reduce((s, c, j) => s + c * P[j][i], 0))
}

function spiral(u, w, h) {
  const [tx, ty] = ballSpot(w, h)
  const r = Math.max(w, h) * 0.75 * Math.pow(1 - u, 1.5)
  const a = 0.5 + u * Math.PI * 2.1
  return [tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.62]
}

/** Head position at time t (seconds), or null when no streak is on screen. */
function headAt(t, w, h) {
  if (t >= ACROSS[0] && t <= ACROSS[1]) return across(easeInOut((t - ACROSS[0]) / (ACROSS[1] - ACROSS[0])), w, h)
  if (t >= SPIRAL[0] && t <= SPIRAL[1]) return spiral(smooth((t - SPIRAL[0]) / (SPIRAL[1] - SPIRAL[0])), w, h)
  return null
}

const VOLT = '215, 255, 58'

function runFilm(canvas) {
  const ctx = canvas.getContext('2d')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  let w = 0
  let h = 0
  const fit = () => {
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  fit()
  window.addEventListener('resize', fit)

  const sparks = []
  let burst = false
  const start = performance.now()
  let last = start
  let frame = 0

  const draw = (now) => {
    const t = (now - start) / 1000
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'

    // The streak: a tapering trail of recent positions, a volt glow and a white-hot head.
    const head = headAt(t, w, h)
    if (head) {
      const STEPS = 34
      let prev = head
      ctx.lineCap = 'round'
      for (let k = 1; k <= STEPS; k++) {
        const p = headAt(t - k * 0.007, w, h)
        if (!p) break
        const fade = 1 - k / STEPS
        ctx.strokeStyle = `rgba(${VOLT}, ${0.55 * fade})`
        ctx.lineWidth = 7 * fade + 0.5
        ctx.beginPath()
        ctx.moveTo(prev[0], prev[1])
        ctx.lineTo(p[0], p[1])
        ctx.stroke()
        prev = p
      }
      const glow = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 46)
      glow.addColorStop(0, `rgba(${VOLT}, 0.9)`)
      glow.addColorStop(1, `rgba(${VOLT}, 0)`)
      ctx.fillStyle = glow
      ctx.fillRect(head[0] - 46, head[1] - 46, 92, 92)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(head[0], head[1], 3.2, 0, Math.PI * 2)
      ctx.fill()
      // Sparks shed along the way.
      for (let i = 0; i < 4; i++) {
        sparks.push({ x: head[0], y: head[1], vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.3) * 90, life: 0.4 + Math.random() * 0.5, age: 0 })
      }
    }

    // Arrival: the streak bursts where the ball is about to form.
    if (t >= SPIRAL[1] && !burst) {
      burst = true
      const [tx, ty] = ballSpot(w, h)
      for (let i = 0; i < 150; i++) {
        const a = Math.random() * Math.PI * 2
        const v = 120 + Math.random() * 380
        sparks.push({ x: tx, y: ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.7, age: 0 })
      }
    }
    if (burst && t - SPIRAL[1] < 0.6) {
      const age = t - SPIRAL[1]
      const [tx, ty] = ballSpot(w, h)
      ctx.strokeStyle = `rgba(${VOLT}, ${0.7 * (1 - age / 0.6)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(tx, ty, age * 900, age * 900 * 0.62, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.age += dt
      if (s.age > s.life) {
        sparks.splice(i, 1)
        continue
      }
      s.vx *= 1 - dt * 1.8
      s.vy = s.vy * (1 - dt * 1.8) + 40 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      ctx.fillStyle = `rgba(${VOLT}, ${clamp01(1 - s.age / s.life) * 0.9})`
      ctx.fillRect(s.x - 1, s.y - 1, 2, 2)
    }

    if (t < LENGTH) frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', fit)
  }
}

function Floodlight({ side }) {
  return (
    <div className={`film__light film__light--${side}`}>
      <div className="film__flicker">
        <div className="film__beam" />
        <div className="film__lamps">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <div className="film__flare" />
      </div>
    </div>
  )
}

export function Opener() {
  const [state, setState] = useState(() => (willPlay && !played ? 'playing' : 'done'))
  // Bumped on every replay, so the film's CSS animations restart from the top.
  const [take, setTake] = useState(0)
  const canvas = useRef(null)
  const google = academy.ratings.find((r) => r.source === 'Google')

  // "Play the film" from the hero.
  useEffect(() => {
    const replay = () => {
      window.scrollTo(0, 0)
      setTake((n) => n + 1)
      setState('playing')
    }
    window.addEventListener('vfa:film', replay)
    return () => window.removeEventListener('vfa:film', replay)
  }, [])

  useEffect(() => {
    if (state !== 'playing') return
    // A page restored partway down skips straight to it.
    if (take === 0 && window.scrollY > 50) {
      setState('done')
      return
    }
    played = true
    // On the automatic first play the particles hold until the handover (a replay starts with
    // the ball already formed).
    if (take === 0) storyState.holdIntro = true
    try {
      window.localStorage.setItem(SEEN, '1')
    } catch {
      // Private browsing: it may play again next time, which is fine.
    }
    const stopFilm = runFilm(canvas.current)
    const root = document.documentElement
    // At the handover the particles fly in and the hero headline settles into focus.
    const handover = setTimeout(() => {
      storyState.holdIntro = false
      root.classList.add('film-handover')
    }, HANDOVER * 1000)
    root.classList.remove('film-handover')
    const end = setTimeout(() => setState('done'), LENGTH * 1000)
    // Any key, click, scroll or swipe skips it.
    const skip = () => setState('leaving')
    const events = ['keydown', 'pointerdown', 'wheel', 'touchmove']
    // Wait a beat before listening, so the click on "Play the film" doesn't skip it at once.
    const listen = setTimeout(() => events.forEach((e) => window.addEventListener(e, skip, { passive: true })), 300)
    return () => {
      stopFilm()
      clearTimeout(handover)
      clearTimeout(end)
      clearTimeout(listen)
      events.forEach((e) => window.removeEventListener(e, skip))
      storyState.holdIntro = false
    }
  }, [state, take])

  useEffect(() => {
    if (state !== 'leaving') return
    const t = setTimeout(() => setState('done'), 450)
    return () => clearTimeout(t)
  }, [state])

  if (state === 'done') return null
  return (
    <div key={take} className={`film ${state === 'leaving' ? 'is-leaving' : ''}`}>
      <div className="film__frame" aria-hidden="true">
        <div className="film__haze" />
        <Floodlight side="left" />
        <Floodlight side="right" />
        <canvas ref={canvas} className="film__canvas" />

        <div className="film__card film__card--method">
          <p className="film__eyebrow">01 · The method</p>
          <p className="film__line">
            They don’t wait
            <br />
            for the shout.
          </p>
        </div>
        <div className="film__card film__card--edge">
          <p className="film__eyebrow">02 · The edge</p>
          <p className="film__line">
            They see it <em>first.</em>
          </p>
        </div>
        <div className="film__card film__card--verdict">
          <p className="film__eyebrow">03 · The verdict</p>
          <p className="film__score">{google.score.toFixed(1)}</p>
          <p className="film__stars">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} style={{ '--i': i }}>
                ★
              </span>
            ))}
          </p>
          <p className="film__small">Rated by Surat families · {google.countLabel} on Google</p>
        </div>
        <div className="film__card film__card--pathway">
          <p className="film__eyebrow">04 · The pathway</p>
          <p className="film__line film__line--stack">
            <span>Training ground.</span>
            <span>District trials.</span>
            <span>
              <em>State scouts.</em>
            </span>
          </p>
        </div>
        <div className="film__card film__card--brand">
          <p className="film__brand">Vision</p>
          <p className="film__sub">
            Football Academy <span>·</span> Adajan, Surat
          </p>
          <p className="film__small film__small--brand">Monday to Friday · 6 to 9 PM · Outdoor turf</p>
        </div>

        <div className="film__bar film__bar--top" />
        <div className="film__bar film__bar--bottom" />
      </div>
      <button type="button" className="film__skip" onClick={() => setState('leaving')}>
        Skip intro
      </button>
    </div>
  )
}
