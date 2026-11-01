import { PROMO, openFilm } from './FilmPlayer'
import { SectionTitle } from './SectionTitle'

/** The promo film on the home page: its end card as a poster, opening the full-screen player. */
export function FilmTeaser() {
  return (
    <section className="teaser" id="film" aria-labelledby="teaser-title">
      <div className="wrap teaser__grid">
        <button type="button" className="teaser__poster" onClick={openFilm} aria-label={`Play the ${PROMO.seconds}-second film`}>
          <img src={PROMO.wide.poster} alt="" width="1920" height="1080" loading="lazy" decoding="async" />
          <span className="teaser__play" aria-hidden="true">
            <svg width="22" height="26" viewBox="0 0 10 12">
              <path d="M0 0 10 6 0 12Z" fill="currentColor" />
            </svg>
          </span>
        </button>
        <div className="teaser__copy">
          <p className="teaser__eyebrow">The film · {PROMO.seconds} seconds</p>
          <SectionTitle id="teaser-title">See Vision in {PROMO.seconds} seconds</SectionTitle>
          <p className="teaser__body">
            The method, the pitch, the pathway and what Surat families say, cut into one short film. Turn the sound on.
          </p>
          <div className="teaser__actions">
            <button type="button" className="btn btn--volt" onClick={openFilm}>
              Watch the film
            </button>
            <a className="teaser__download" href={PROMO.tall.src} download="Vision-Football-Academy-9x16.mp4">
              Download for Reels and Status
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
