import { useEffect, useRef, useState } from 'react'
import { MATCH_SECONDS, createVisionTest } from '../game/visionTest'
import { Link, toHref } from '../router'
import { SectionTitle } from '../site/SectionTitle'
import { CtaBand, PageHero } from './PageHero'

const BEST = 'vfa-vision-best'
// The rating at the end, from the moment players stop scanning to the academy's own line.
const TIERS = [
  [4500, 'One pass ahead'],
  [2500, 'Scanning'],
  [1000, 'Checking'],
  [0, 'Head down'],
]
const tierFor = (score) => TIERS.find(([min]) => score >= min)[1]
const clock = (s) => `0:${String(Math.ceil(s)).padStart(2, '0')}`

const TRAINS = [
  { title: 'Scanning', body: 'Checking your shoulders before the ball arrives, so you already know where the pressure and the space are.' },
  { title: 'Working memory', body: 'Holding a picture of players you can no longer see, and knowing that picture goes out of date.' },
  { title: 'Decision speed', body: 'Choosing the pass in the moment the ball arrives, before the presser does it for you.' },
  { title: 'Hand–eye coordination', body: 'Looking with one hand and passing with the other, or both thumbs at once on a phone.' },
]

export default function PlayPage() {
  const canvas = useRef(null)
  const game = useRef(null)
  const stage = useRef(null)
  const [phase, setPhase] = useState('ready') // ready, playing, done
  const [hud, setHud] = useState({ timeLeft: MATCH_SECONDS, score: 0, combo: 1, level: 1 })
  const [result, setResult] = useState(null)
  const [said, setSaid] = useState('')
  const [muted, setMuted] = useState(false)
  const [best, setBest] = useState(() => {
    try {
      return Number(window.localStorage.getItem(BEST)) || 0
    } catch {
      return 0
    }
  })

  useEffect(() => {
    const g = createVisionTest(canvas.current, {
      onHud: setHud,
      onEvent: setSaid,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onEnd: (r) => {
        setResult(r)
        setPhase('done')
        setBest((b) => {
          const next = Math.max(b, r.score)
          try {
            window.localStorage.setItem(BEST, String(next))
          } catch {
            // Not remembered in private browsing.
          }
          return next
        })
      },
    })
    game.current = g
    // A read-only look at the match, for automated checks on the dev server only.
    if (import.meta.env.DEV) window.__visionTest = g
    return () => {
      g.destroy()
      if (import.meta.env.DEV) delete window.__visionTest
    }
  }, [])

  const start = () => {
    setResult(null)
    setPhase('playing')
    stage.current?.scrollIntoView({ block: 'center' })
    game.current.start()
  }
  const toggleSound = () => {
    setMuted((m) => {
      game.current.setMuted(!m)
      return !m
    })
  }

  const shareText = result
    ? `I scored ${result.score} on The Vision Test from Vision Football Academy, Surat: ${result.completed} passes, ${result.checksBeforeBall.toFixed(1)} shoulder checks before each ball. Can you see it first? ${window.location.origin}${toHref('/play')}`
    : ''

  return (
    <>
      <PageHero
        crumbs={[{ label: 'Play' }]}
        title="The Vision Test"
        lede="You only see what you look at. Check your shoulders, spot the press and find the open pass before the presser arrives. One minute: how far ahead can you see?"
        marks={[[100, 150], [128, 110]]}
      >
        <Link className="btn btn--volt" to="#game">
          Play now
        </Link>
        <Link className="btn btn--ghost" to="/method">
          The method behind it
        </Link>
      </PageHero>

      <section className="game" id="game" aria-labelledby="game-title">
        <h2 id="game-title" className="visually-hidden">
          The Vision Test
        </h2>
        <div className="wrap">
          <div className="game__stage" ref={stage}>
            <canvas
              ref={canvas}
              className="game__pitch"
              tabIndex={0}
              aria-label="The pitch, seen from above. Turn your head with the mouse, a finger or the arrow keys; pass with a click, a tap, the number keys or Space."
            />
            <div className="game__hud">
              <p className="game__time">{clock(hud.timeLeft)}</p>
              <p className="game__score">
                {hud.score}
                <span> pts</span>
              </p>
              <p className="game__combo">×{hud.combo.toFixed(1)}</p>
              <p className="game__level">Level {hud.level}</p>
              <button type="button" className="game__sound" aria-pressed={!muted} onClick={toggleSound}>
                Sound {muted ? 'off' : 'on'}
              </button>
            </div>
            <p className="visually-hidden" aria-live="polite">
              {said}
            </p>

            {phase === 'ready' && (
              <div className="game__panel">
                <p className="game__eyebrow">A {MATCH_SECONDS}-second match</p>
                <p className="game__title">The Vision Test</p>
                <ol className="game__rules">
                  <li>
                    <strong>Look around.</strong> Move your mouse, or drag a finger, to turn your head. You only see what you
                    look at.
                  </li>
                  <li>
                    <strong>Check your shoulders.</strong> The ball comes from behind and a presser closes from your blind side.
                    Look before the ball arrives.
                  </li>
                  <li>
                    <strong>Pass.</strong> Click or tap the open teammate. Covered lanes get intercepted, and memories go stale:
                    players keep moving.
                  </li>
                </ol>
                <ul className="game__legend" aria-label="Key">
                  <li>
                    <span className="game__key game__key--mate" />
                    Teammate
                  </li>
                  <li>
                    <span className="game__key game__key--opp" />
                    Opponent
                  </li>
                  <li>
                    <span className="game__key game__key--press" />
                    Presser
                  </li>
                  <li>
                    <span className="game__key game__key--ghost" />
                    Memory
                  </li>
                </ul>
                <button type="button" className="btn btn--volt" onClick={start}>
                  Start the match
                </button>
                <p className="game__note">
                  Keyboard: ← → to look, 1–4 or Space to pass.{best > 0 && ` Your best: ${best}.`}
                </p>
              </div>
            )}

            {phase === 'done' && result && (
              <div className="game__panel game__panel--result" role="status">
                <p className="game__eyebrow">Your Vision score</p>
                <p className="game__big">{result.score}</p>
                <p className="game__tier">{tierFor(result.score)}</p>
                <dl className="game__stats">
                  <div>
                    <dt>Passes completed</dt>
                    <dd>
                      {result.completed} of {result.rounds}
                    </dd>
                  </div>
                  <div>
                    <dt>Shoulder checks before each ball</dt>
                    <dd>{result.checksBeforeBall.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>Press spotted early</dt>
                    <dd>{Math.round(result.pressSpotted * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Average decision</dt>
                    <dd>{result.decisionSeconds.toFixed(2)} s</dd>
                  </div>
                </dl>
                <div className="game__actions">
                  <button type="button" className="btn btn--volt" onClick={start}>
                    Play again
                  </button>
                  <a className="btn btn--ghost" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
                    Share on WhatsApp
                  </a>
                  <Link className="game__book" to="/visit#join">
                    Book a visit
                  </Link>
                </div>
                <p className="game__note">Your best: {best}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="trains" aria-labelledby="trains-title">
        <div className="wrap">
          <SectionTitle id="trains-title">What it trains</SectionTitle>
          <ul className="trains__list">
            {TRAINS.map((t) => (
              <li key={t.title}>
                <h3 className="trains__title">{t.title}</h3>
                <p>{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Train it for real"
        body="Scanning, positioning and choosing the right option before the ball arrives is part of every session at Boghara School Ground."
      />
    </>
  )
}
