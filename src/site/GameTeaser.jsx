import { Link } from '../router'
import { SectionTitle } from './SectionTitle'

/** The game on the home page: a cone of light sweeping a dark pitch, and the way in. */
export function GameTeaser() {
  return (
    <section className="play-teaser" aria-labelledby="play-teaser-title">
      <div className="wrap play-teaser__grid">
        <div>
          <p className="play-teaser__eyebrow">Play · one minute</p>
          <SectionTitle id="play-teaser-title">Can you see it first?</SectionTitle>
          <p className="play-teaser__body">
            The Vision Test: you only see what you look at. Check your shoulders, spot the press and find the open pass
            before you are tackled. It is built on how the academy coaches scanning.
          </p>
          <Link className="btn btn--ink" to="/play">
            Play The Vision Test
          </Link>
        </div>
        <svg className="play-teaser__art" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="play-cone" cx="100" cy="100" r="96" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#d7ff3a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#d7ff3a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="96" fill="#0b0d0c" />
          <circle cx="100" cy="100" r="44" fill="none" stroke="rgba(242,242,238,0.25)" strokeWidth="1.2" />
          <line x1="4" y1="100" x2="196" y2="100" stroke="rgba(242,242,238,0.25)" strokeWidth="1.2" />
          <g className="play-teaser__sweep">
            <path d="M100 100 L172 30 A96 96 0 0 0 28 30 Z" fill="url(#play-cone)" />
          </g>
          <circle cx="70" cy="48" r="6" fill="#d7ff3a" />
          <circle cx="138" cy="58" r="6" fill="#d7ff3a" />
          <circle cx="104" cy="40" r="5.5" fill="none" stroke="#f2f2ee" strokeWidth="2" />
          <circle cx="58" cy="150" r="6" fill="none" stroke="#ff6a5c" strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="7" fill="#d7ff3a" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
    </section>
  )
}
