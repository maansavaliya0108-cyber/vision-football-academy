import { academy } from '../../shared/academy.js'
import { BookVisit } from './BookVisit'
import { Stars } from './icons'
import { SectionTitle } from './SectionTitle'

/** The one volt section: the ratings set as a scoreline. */
export function Reputation() {
  const [lead, second] = academy.reviewThemes
  return (
    <section className="reputation" id="reviews" aria-labelledby="reviews-title">
      <div className="wrap">
        <SectionTitle id="reviews-title">What Surat families say</SectionTitle>
        <div className="scoreline">
          {academy.ratings.map((r) => (
            <div key={r.source} className="scoreline__side">
              <p className="scoreline__score">
                {r.score.toFixed(1)}
                <span className="visually-hidden"> out of 5</span>
              </p>
              <div className="scoreline__meta">
                <Stars size={18} />
                <p className="scoreline__source">{r.source}</p>
                <p className="scoreline__count">{r.countLabel}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="themes">
          <figure className="theme theme--lead">
            <blockquote>
              <p>“{lead.text}.”</p>
            </blockquote>
            <figcaption>{lead.note}</figcaption>
          </figure>
          <figure className="theme">
            <p className="theme__statement">{second.text}</p>
            <figcaption>{second.note}</figcaption>
          </figure>
        </div>
        <a className="text-link" href={academy.maps.directions} target="_blank" rel="noreferrer">
          Read the reviews on Google Maps
        </a>
        <BookVisit tone="ink" />
      </div>
    </section>
  )
}
