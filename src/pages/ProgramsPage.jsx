import { academy } from '../../shared/academy.js'
import { Link } from '../router'
import { TickIcon } from '../site/icons'
import { SectionTitle } from '../site/SectionTitle'
import { CtaBand, PageHero } from './PageHero'

const choose = academy.faq.find((f) => f.q.startsWith('Which program'))

export default function ProgramsPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Programs' }]}
        title="Five ways to train"
        lede="From a first kickabout to an overseas pathway. All weekday training is at Boghara School Ground, Monday to Friday, 6 to 9 PM."
      >
        <Link className="btn btn--volt" to="/visit#join">
          Book a visit
        </Link>
        <Link className="btn btn--ghost" to="/method">
          How sessions work
        </Link>
      </PageHero>

      <section className="catalogue" aria-label="All programs">
        <div className="wrap">
          <ol className="catalogue__list">
            {academy.programs.map((p, i) => (
              <li key={p.id} className="catalogue__item">
                <span className="catalogue__num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="catalogue__main">
                  <h2 className="catalogue__name">
                    <Link to={`/programs/${p.id}`}>{p.name}</Link>
                  </h2>
                  <p className="catalogue__summary">{p.summary}</p>
                </div>
                <dl className="catalogue__facts">
                  <div>
                    <dt>Who it’s for</dt>
                    <dd>{p.for}</dd>
                  </div>
                  <div>
                    <dt>Format</dt>
                    <dd>{p.format}</dd>
                  </div>
                </dl>
                <ul className="catalogue__focus" aria-label={`${p.name} focus`}>
                  {p.focus.map((f) => (
                    <li key={f}>
                      <TickIcon width={16} height={16} />
                      {f}
                    </li>
                  ))}
                </ul>
                {/* The row itself is the link (through the name); this arrow is decoration. */}
                <span className="catalogue__go" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {choose && (
        <section className="chooser" aria-labelledby="chooser-title">
          <div className="wrap chooser__grid">
            <SectionTitle id="chooser-title">Not sure which one?</SectionTitle>
            <p className="chooser__body">{choose.a}</p>
          </div>
        </section>
      )}

      <CtaBand body="Tell the academy about the player and they’ll call you back to talk through the right program." />
    </>
  )
}
