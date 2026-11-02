import { useEffect, useRef, useState } from 'react'
import { FIRST_TIME_BONUS, LEVELS, MATCH_SECONDS, createVisionTest } from '../game/visionTest'
import { tierFor, tipFor } from '../game/review'
import { TUTORIAL_CHAPTERS, TUTORIAL_SECONDS } from '../game/tutorialChapters'
import { Link, toHref } from '../router'
import { SectionTitle } from '../site/SectionTitle'
import { CtaBand, PageHero } from './PageHero'

const BEST = 'vfa-vision-best'
const MEDIA = `${import.meta.env.BASE_URL}media/`
const TUTORIAL = {
  src: `${MEDIA}vision-test-tutorial.mp4`,
  poster: `${MEDIA}vision-test-tutorial.jpg`,
}
const minutes = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const clock = (s) => (s === Infinity ? 'Practice' : `0:${String(Math.ceil(s)).padStart(2, '0')}`)

const TRAINS = [
  {
    title: 'Scanning',
    body: 'Checking both shoulders before the ball arrives, so you already know where the pressure and the space are.',
  },
  {
    title: 'Working memory',
    body: 'Holding a picture of players you can no longer see, and knowing that picture goes out of date.',
  },
  {
    title: 'Decision speed',
    body: 'Choosing the pass before the ball arrives and playing it first time, before the presser decides for you.',
  },
  {
    title: 'Hand–eye coordination',
    body: 'Looking with one hand and passing with the other, or both thumbs at once on a phone.',
  },
]

/** Where you looked in the match, as a fan around you: brighter slices are where you looked more. */
function VisionMap({ map }) {
  const top = Math.max(...map, 0.0001)
  const share = (idx) => Math.round(idx.reduce((s, i) => s + map[i], 0) * 100)
  const ahead = share([4, 5, 6, 7])
  const sides = share([2, 3, 8, 9])
  const behind = share([0, 1, 10, 11])
  const at = (deg, r) => [80 + r * Math.sin((deg * Math.PI) / 180), 80 - r * Math.cos((deg * Math.PI) / 180)]
  return (
    <figure className="vmap">
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label={`Where you looked: ${ahead}% ahead, ${sides}% to the sides, ${behind}% behind you.`}
      >
        <circle cx="80" cy="80" r="66" className="vmap__ring" />
        {map.map((v, i) => {
          const a0 = -180 + i * 30
          const [x0, y0] = at(a0, 66)
          const [x1, y1] = at(a0 + 30, 66)
          return (
            <path
              key={i}
              d={`M80 80 L${x0} ${y0} A66 66 0 0 1 ${x1} ${y1}Z`}
              className="vmap__slice"
              style={{ opacity: 0.08 + 0.92 * (v / top) }}
            />
          )
        })}
        <circle cx="80" cy="80" r="6" className="vmap__you" />
        <text x="80" y="10" className="vmap__label">
          AHEAD
        </text>
        <text x="80" y="157" className="vmap__label">
          BEHIND
        </text>
      </svg>
      <figcaption>
        <strong>{behind + sides}%</strong> of the time looking wide or behind
      </figcaption>
    </figure>
  )
}

export default function PlayPage() {
  const canvas = useRef(null)
  const game = useRef(null)
  const stage = useRef(null)
  const tutorial = useRef(null)
  const [phase, setPhase] = useState('ready') // ready, playing, done
  const [hud, setHud] = useState({
    timeLeft: MATCH_SECONDS,
    score: 0,
    combo: 1,
    level: 1,
    mode: 'match',
  })
  const [result, setResult] = useState(null)
  const [said, setSaid] = useState('')
  const [muted, setMuted] = useState(false)
  const [practiceLevel, setPracticeLevel] = useState(1)
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
        if (r.mode !== 'match') return
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

  const start = (mode = 'match', level = 1) => {
    setResult(null)
    setPhase('playing')
    stage.current?.scrollIntoView({ block: 'center' })
    game.current.start({ mode, level })
  }
  const toggleSound = () => {
    setMuted((m) => {
      game.current.setMuted(!m)
      return !m
    })
  }
  const watch = (at = 0) => {
    const v = tutorial.current
    if (!v) return
    v.scrollIntoView({ block: 'center', behavior: 'smooth' })
    v.currentTime = at
    v.play().catch(() => {})
  }

  const practice = hud.mode === 'practice'
  const shareText = result
    ? `I scored ${result.score} on The Vision Test from Vision Football Academy, Surat, and reached level ${result.level}, ${result.levelName}: ${result.completed} passes, ${result.checksBeforeBall.toFixed(1)} shoulder checks before each ball. Can you see it first? ${window.location.origin}${toHref('/play')}`
    : ''

  return (
    <>
      <PageHero
        crumbs={[{ label: 'Play' }]}
        title="The Vision Test"
        lede="You only see what you look at. Check your shoulders, spot the press and find the open pass before the presser arrives. One minute, five levels: how far ahead can you see?"
        marks={[
          [100, 150],
          [128, 110],
        ]}
      >
        <Link className="btn btn--volt" to="#game">
          Play now
        </Link>
        <Link className="btn btn--ghost" to="#tutorial">
          Watch how to play
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
              <p className="game__level">
                Level {hud.level} · {LEVELS[hud.level - 1].name}
              </p>
              {phase === 'playing' && practice && (
                <button type="button" className="game__sound game__end" onClick={() => game.current.stop()}>
                  End practice
                </button>
              )}
              <button
                type="button"
                className={`game__sound ${phase === 'playing' && practice ? 'game__sound--after' : ''}`}
                aria-pressed={!muted}
                onClick={toggleSound}
              >
                Sound {muted ? 'off' : 'on'}
              </button>
            </div>
            <p className="visually-hidden" aria-live="polite">
              {said}
            </p>

            {phase === 'ready' && (
              <div className="game__panel">
                <p className="game__eyebrow">A {MATCH_SECONDS}-second match · five levels</p>
                <p className="game__title">The Vision Test</p>
                <div className="game__actions">
                  <button type="button" className="btn btn--volt" onClick={() => start('match')}>
                    Start the match
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => watch(0)}>
                    Watch how to play · {minutes(TUTORIAL_SECONDS)}
                  </button>
                </div>
                <ol className="game__rules">
                  <li>
                    <strong>Look around.</strong> Move your mouse, or drag a finger, to turn your head. You only see what you look
                    at, and you only remember it for a few seconds.
                  </li>
                  <li>
                    <strong>Check both shoulders.</strong> The ball comes from behind and pressers close from your blind side.
                    Spot them all before the ball arrives and time slows for you.
                  </li>
                  <li>
                    <strong>Pass.</strong> Click or tap the open teammate. Covered lanes get intercepted, and memories go stale:
                    players keep moving.
                  </li>
                  <li>
                    <strong>Think one pass ahead.</strong> Choose your pass while the ball is still coming and, if you watched it
                    in, you play it first time for {FIRST_TIME_BONUS} extra points.
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
                <fieldset className="game__practice">
                  <legend>Or practise one level, with no clock</legend>
                  <div className="game__levels">
                    {LEVELS.map((L) => (
                      <button
                        key={L.n}
                        type="button"
                        className="game__lvl"
                        aria-pressed={practiceLevel === L.n}
                        onClick={() => setPracticeLevel(L.n)}
                      >
                        <span>{L.n}</span> {L.name}
                      </button>
                    ))}
                  </div>
                  <p className="game__lvl-adds">{LEVELS[practiceLevel - 1].adds}</p>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => start('practice', practiceLevel)}>
                    Practise level {practiceLevel}
                  </button>
                </fieldset>
                <p className="game__note">
                  Keyboard: ← → to look, 1–4 or Space to pass.
                  {best > 0 && ` Your best: ${best}.`}
                </p>
              </div>
            )}

            {phase === 'done' && result && (
              <div className="game__panel game__panel--result" role="status">
                <div className="game__result-head">
                  <p className="game__eyebrow">
                    {result.mode === 'practice' ? `Practice · level ${result.level}, ${result.levelName}` : 'Your Vision score'}
                  </p>
                  <p className="game__big">{result.score}</p>
                  {result.mode === 'match' && (
                    <p className="game__tier">
                      {tierFor(result.score)}{' '}
                      <span>
                        · reached level {result.level}, {result.levelName}
                      </span>
                    </p>
                  )}
                  <div className="game__actions">
                    {result.mode === 'practice' ? (
                      <>
                        <button type="button" className="btn btn--volt" onClick={() => start('practice', result.level)}>
                          Practise again
                        </button>
                        <button type="button" className="btn btn--ghost" onClick={() => start('match')}>
                          Play a match
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn--volt" onClick={() => start('match')}>
                          Play again
                        </button>
                        <a
                          className="btn btn--ghost"
                          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Share on WhatsApp
                        </a>
                      </>
                    )}
                    <button type="button" className="game__book" onClick={() => setPhase('ready')}>
                      Change mode
                    </button>
                    <Link className="game__book" to="/visit#join">
                      Book a visit
                    </Link>
                  </div>
                  {result.mode === 'match' && <p className="game__note">Your best: {best}</p>}
                </div>
                <div className="game__result-body">
                  <dl className="game__stats">
                    <div>
                      <dt>Passes completed</dt>
                      <dd>
                        {result.completed} of {result.rounds}
                      </dd>
                    </div>
                    <div>
                      <dt>First-time passes</dt>
                      <dd>{result.firstTime}</dd>
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
                    <div>
                      <dt>Intercepted</dt>
                      <dd>{result.intercepted}</dd>
                    </div>
                    <div>
                      <dt>Tackled</dt>
                      <dd>{result.tackled}</dd>
                    </div>
                    <div>
                      <dt>Passed to an old memory</dt>
                      <dd>{result.misplaced}</dd>
                    </div>
                  </dl>
                  <div className="game__review">
                    <VisionMap map={result.lookMap} />
                    <p className="game__tip">
                      <span>Coach's note</span>
                      {tipFor(result)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="tutorial" id="tutorial" aria-labelledby="tutorial-title">
        <div className="wrap tutorial__grid">
          <div className="tutorial__copy">
            <p className="tutorial__eyebrow">How to play · {minutes(TUTORIAL_SECONDS)}</p>
            <SectionTitle id="tutorial-title">Every rule, on the pitch</SectionTitle>
            <p className="tutorial__body">
              The controls, the vision cone, memories, the presser, first-time passes, all five levels and how you score, each one
              played out in the real game. Jump to any part:
            </p>
          </div>
          <video
            ref={tutorial}
            className="tutorial__video"
            src={TUTORIAL.src}
            poster={TUTORIAL.poster}
            controls
            playsInline
            preload="metadata"
            aria-label="How to play The Vision Test, a video tutorial"
          />
          <ol className="tutorial__chapters">
            {TUTORIAL_CHAPTERS.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => watch(c.at + 0.05)}>
                  <span className="tutorial__at">{minutes(c.at)}</span>
                  {c.title}
                </button>
              </li>
            ))}
          </ol>
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
