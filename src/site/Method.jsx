import { academy } from '../../shared/academy.js'
import { Link } from '../router'

/**
 * The four parts of every session, laid out on a pitch split into quarters:
 * halfway line, a centre line, and the centre circle where they meet.
 */
export function Method({ more = false }) {
  const { philosophy } = academy
  return (
    <section className="method" id="method" aria-labelledby="method-title">
      <div className="wrap">
        <header className="method__head">
          <h2 id="method-title" className="section-title">
            Every session covers four things
          </h2>
          <p className="method__intro">
            Each session is split across four areas, so players develop as complete footballers, not just quick
            ones or skilful ones.
          </p>
        </header>
        <div className="quarters">
          {philosophy.quadrants.map((q) => (
            <article key={q.key} className={`quarter quarter--${q.key}`}>
              <h3 className="quarter__name">{q.name}</h3>
              <p className="quarter__title">{q.title}</p>
              <p className="quarter__body">{q.body}</p>
            </article>
          ))}
          <div className="quarters__circle" aria-hidden="true" />
        </div>
        {more && (
          <Link className="more-link" to="/method">
            How the method works
          </Link>
        )}
      </div>
    </section>
  )
}
