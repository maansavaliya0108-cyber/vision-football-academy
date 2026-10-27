import { useState } from 'react'
import { academy } from '../../shared/academy.js'
import { Link } from '../router'
import { Enquiry } from '../site/Enquiry'
import { TickIcon } from '../site/icons'
import { Method } from '../site/Method'
import { Pathway } from '../site/Pathway'
import NotFound from '../NotFound'
import { PageHero } from './PageHero'

export default function ProgramPage({ id }) {
  const index = academy.programs.findIndex((p) => p.id === id)
  const program = academy.programs[index]
  const [selected, setSelected] = useState(id)
  if (!program) return <NotFound />

  const prev = academy.programs[(index - 1 + academy.programs.length) % academy.programs.length]
  const next = academy.programs[(index + 1) % academy.programs.length]
  // Match exposure is the competitive tier's point, and International Immersion is selected from it.
  const showsPathway = id === 'academy' || id === 'international'

  return (
    <>
      <PageHero
        crumbs={[{ to: '/programs', label: 'Programs' }, { label: program.name }]}
        title={program.name}
        lede={program.summary}
        marks={[[100, 196], [128, 110], [62, 150], [150, 236]].slice(0, 2 + (index % 3))}
      >
        <Link className="btn btn--volt" to="#join">
          Enquire about this program
        </Link>
        <a className="btn btn--ghost" href={`tel:${academy.phone.tel}`}>
          Call {academy.phone.display}
        </a>
      </PageHero>

      <section className="program-facts" aria-label="At a glance">
        <div className="wrap program-facts__grid">
          <div>
            <p className="program-facts__label">Who it’s for</p>
            <p className="program-facts__value">{program.for}</p>
          </div>
          <div>
            <p className="program-facts__label">Format</p>
            <p className="program-facts__value">{program.format}</p>
          </div>
          <div>
            <p className="program-facts__label">When</p>
            <p className="program-facts__value">
              {/* Immersion players are picked from the squads, so the weekday sessions are their squad training. */}
              {program.id === 'international' ? 'Squad training, Monday to Friday, 6 to 9 PM' : 'Monday to Friday, 6 to 9 PM'}
            </p>
          </div>
          <div>
            <p className="program-facts__label">Where</p>
            <p className="program-facts__value">{academy.address.venue}, Adajan</p>
          </div>
        </div>
      </section>

      <section className="focus" aria-labelledby="focus-title">
        <div className="wrap focus__grid">
          <h2 id="focus-title" className="section-title">
            What the sessions work on
          </h2>
          <ol className="focus__list">
            {program.focus.map((f) => (
              <li key={f}>
                <TickIcon width={22} height={22} />
                <span>{f}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Method />
      {showsPathway && <Pathway />}

      <nav className="sibling-nav" aria-label="Other programs">
        <div className="wrap sibling-nav__grid">
          <Link className="sibling-nav__link" to={`/programs/${prev.id}`}>
            <span className="sibling-nav__dir">Previous program</span>
            <span className="sibling-nav__name">{prev.name}</span>
          </Link>
          <Link className="sibling-nav__link sibling-nav__link--next" to={`/programs/${next.id}`}>
            <span className="sibling-nav__dir">Next program</span>
            <span className="sibling-nav__name">{next.name}</span>
          </Link>
        </div>
      </nav>

      <Enquiry program={selected} onProgramChange={setSelected} />
    </>
  )
}
