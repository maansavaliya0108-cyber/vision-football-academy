import { academy } from '../../shared/academy.js'
import { BookVisit } from './BookVisit'
import { SectionTitle } from './SectionTitle'

/** The case for the academy in six points, each one a confirmed fact, ending on the next step. */
export function WhyVision() {
  const google = academy.ratings.find((r) => r.source === 'Google')
  return (
    <section className="why" id="why" aria-labelledby="why-title">
      <div className="wrap">
        <header className="why__head">
          <SectionTitle id="why-title">Why families choose Vision</SectionTitle>
          <p className="why__intro">
            Rated {google.score.toFixed(1)} by Surat families on Google and Justdial. This is what their players get,
            every weekday evening in Adajan.
          </p>
        </header>
        <ol className="why__list">
          {academy.reasons.map((r, i) => (
            <li key={r.title} className="why__item">
              <span className="why__num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="why__title">{r.title}</h3>
              <p className="why__body">{r.body}</p>
            </li>
          ))}
        </ol>
        <BookVisit tone="ink" />
      </div>
    </section>
  )
}
