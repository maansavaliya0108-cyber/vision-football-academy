import { academy } from '../../shared/academy.js'
import { SectionTitle } from './SectionTitle'

export function Pathway() {
  return (
    <section className="pathway" id="pathway" aria-labelledby="pathway-title">
      <div className="wrap">
        <header className="pathway__head">
          <SectionTitle id="pathway-title">Match time is the measure</SectionTitle>
          <p className="pathway__intro">
            The academy judges progress by how much real football its players get. Instead of keeping them on the
            training ground, it puts registered players forward for official trials, cups and leagues.
          </p>
        </header>
        <ol className="track">
          {academy.pathway.map((step, i) => (
            <li key={step.title} className="track__step">
              <span className="track__num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="track__title">{step.title}</h3>
              <p className="track__body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
