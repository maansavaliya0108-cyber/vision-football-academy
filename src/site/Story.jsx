import { Fragment, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { academy } from '../../shared/academy.js'
import { formatTime } from '../../shared/schedule.js'
import { storyState, clamp01 } from '../three/timeline'
import { useTrainingStatus } from './useTrainingStatus'
import { PhoneIcon, Stars } from './icons'
import { Opener, playFilm } from './Opener'

const StoryCanvas = lazy(() => import('../three/ParticleCanvas.jsx'))

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function StatusBadge({ status, tone = 'dark' }) {
  return (
    <p className={`status status--${tone} ${status.live ? 'is-live' : ''}`} title={status.detail}>
      <span className="status__dot" aria-hidden="true" />
      <span>
        {status.live ? 'Training now' : 'Next session'}
        <span className="status__when">{status.live ? `, until ${formatTime(academy.schedule[0].close)}` : `: ${status.label}`}</span>
      </span>
    </p>
  )
}

/** A beat's headline, which rises into place word by word each time it scrolls into view. */
function KineticTitle({ children }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setShown(e.isIntersecting), { threshold: 0.5 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  const words = children.split(' ')
  return (
    <h2 ref={ref} className={`beat__title kinetic ${shown ? 'is-in' : ''}`}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="kinetic__word">
            <span className="kinetic__inner" style={{ '--i': i }}>
              {word}
            </span>
          </span>
          {i < words.length - 1 && ' '}
        </Fragment>
      ))}
    </h2>
  )
}

export function Story() {
  const section = useRef(null)
  const [active, setActive] = useState(true)
  const [ready, setReady] = useState(false)
  const [gl] = useState(webglAvailable)
  // Start the 3D once the page has painted and the browser is idle, so the headline appears first.
  const [startGl, setStartGl] = useState(false)
  useEffect(() => {
    if (!gl) return
    const go = () => setStartGl(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(go, { timeout: 1500 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(go, 400)
    return () => clearTimeout(t)
  }, [gl])
  const [device] = useState(() => ({
    lite: window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 4,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }))
  const status = useTrainingStatus()
  const google = academy.ratings.find((r) => r.source === 'Google')

  useEffect(() => {
    storyState.reduced = device.reduced
    const el = section.current
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      storyState.progress = clamp01(-rect.top / total)
    }
    const onPointer = (e) => {
      storyState.pointerX = (e.clientX / window.innerWidth) * 2 - 1
      storyState.pointerY = -((e.clientY / window.innerHeight) * 2 - 1)
      if (e.pointerType === 'mouse') storyState.pointerAt = performance.now()
    }
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    window.addEventListener('pointermove', onPointer, { passive: true })
    // Stop rendering the scene once it has scrolled out of view.
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: '100px' })
    io.observe(el)
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      window.removeEventListener('pointermove', onPointer)
      io.disconnect()
    }
  }, [device.reduced])

  return (
    <section className="story" ref={section} id="top" aria-label="Introduction">
      <Opener />
      <div className={`story__stage ${ready ? 'is-ready' : ''}`}>
        {gl && startGl && (
          <div className="story__gl">
            <Suspense fallback={null}>
              <StoryCanvas
                active={active}
                lite={device.lite}
                reduced={device.reduced}
                onReady={() => setReady(true)}
              />
            </Suspense>
          </div>
        )}
        <div className="story__scrim" aria-hidden="true" />
      </div>

      <div className="story__beat story__beat--hero">
        <div className="hero">
          <div className="hero__intro">
            <p className="hero__lede">
              Evening football coaching in Adajan, Surat. Players learn to read the game and make their own
              decisions, instead of waiting for a shout from the sideline.
            </p>
            <div className="hero__actions">
              <a className="btn btn--volt" href="#join">
                Join the academy
              </a>
              <a className="btn btn--ghost" href={`tel:${academy.phone.tel}`}>
                <PhoneIcon width={18} height={18} />
                Call {academy.phone.display}
              </a>
            </div>
            <div className="hero__meta">
              <StatusBadge status={status} />
              <p className="hero__rating">
                <Stars size={14} />
                <span>
                  <strong>{google.score.toFixed(1)}</strong> on Google, {google.countLabel}
                </span>
              </p>
              {gl && (
                <button type="button" className="hero__film" onClick={playFilm}>
                  <span className="hero__film-icon" aria-hidden="true">
                    <svg width="10" height="12" viewBox="0 0 10 12">
                      <path d="M0 0 10 6 0 12Z" fill="currentColor" />
                    </svg>
                  </span>
                  Play the film
                </button>
              )}
            </div>
          </div>
          <h1 className="hero__title">
            <span className="hero__word">Think</span> <span className="hero__word">one</span>{' '}
            <span className="hero__word">pass</span> <span className="hero__word">ahead.</span>
          </h1>
        </div>
        <p className="story__cue" aria-hidden="true">
          <span className="story__cue-line" />
          Scroll
        </p>
      </div>

      <div className="story__beat">
        <div className="beat">
          <KineticTitle>Coaches set the problem. Players find the answer.</KineticTitle>
          <p>
            The academy calls it <strong>{academy.philosophy.name}</strong>. Instead of rigid drills where players
            only follow instructions, sessions are built around guided self-discovery.
          </p>
        </div>
      </div>

      <div className="story__beat">
        <div className="beat">
          <KineticTitle>See the pressure before the ball arrives.</KineticTitle>
          <p>
            Players learn to check their shoulders and spot their options early. Here, the player on the ball is
            pressed from their blind side. Two passes are blocked. One is on.
          </p>
          <ul className="legend" aria-label="Key">
            <li>
              <span className="legend__us" />
              Vision players
            </li>
            <li>
              <span className="legend__them" />
              Opponents
            </li>
            <li>
              <span className="legend__on" />
              The pass that’s on
            </li>
            <li>
              <span className="legend__off" />
              Blocked
            </li>
          </ul>
        </div>
      </div>

      <div className="story__beat story__beat--last">
        <div className="beat">
          <KineticTitle>Decide, then play.</KineticTitle>
          <p>{academy.philosophy.objective}</p>
          <a className="beat__link" href="#method">
            How a session is built
          </a>
        </div>
      </div>
    </section>
  )
}
