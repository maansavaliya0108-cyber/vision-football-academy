import { PROMO, SHORT, openFilm } from './FilmPlayer'
import { SectionTitle } from './SectionTitle'

/** "Head Up", the short film, on the home page: its title frame as a poster, opening the player. */
export function FilmTeaser() {
  return (
    <section className="teaser" id="film" aria-labelledby="teaser-title">
      <div className="wrap teaser__grid">
        <button type="button" className="teaser__poster" onClick={() => openFilm()} aria-label={`Play ${SHORT.name}, a ${SHORT.length} short film`}>
          <img src={SHORT.wide.poster} alt="" width="1920" height="1080" loading="lazy" decoding="async" />
          <span className="teaser__play" aria-hidden="true">
            <svg width="22" height="26" viewBox="0 0 10 12">
              <path d="M0 0 10 6 0 12Z" fill="currentColor" />
            </svg>
          </span>
        </button>
        <div className="teaser__copy">
          <p className="teaser__eyebrow">A short film · {SHORT.length}</p>
          <SectionTitle id="teaser-title">{SHORT.name}.</SectionTitle>
          <p className="teaser__body">
            Six o'clock, the floodlights come on, and a young player loses the ball he never saw coming. Five evenings
            later, on match night, he has seen it before it arrives. Turn the sound on.
          </p>
          <div className="teaser__actions">
            <button type="button" className="btn btn--volt" onClick={() => openFilm()}>
              Watch the film
            </button>
            <button type="button" className="teaser__download" onClick={() => openFilm('promo')}>
              Or the {PROMO.length} promo
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
