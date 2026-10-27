import { useId, useRef, useState } from 'react'
import { academy } from '../../shared/academy.js'
import { Link } from '../router'
import { fitStyle } from './fit'
import { TickIcon } from './icons'
import { SectionTitle } from './SectionTitle'
import { useMediaQuery } from './useMediaQuery'

// One shared size for the program names on phones, set by the widest word among them.
const nameFit = fitStyle(academy.programs.map((p) => p.name).join(' '))

function ProgramDetail({ program, onEnquire, headingLevel: H = 'h3' }) {
  return (
    <>
      <H className="program__name" style={nameFit}>
        {program.name}
      </H>
      <p className="program__summary">{program.summary}</p>
      <dl className="program__facts">
        <div>
          <dt>Who it’s for</dt>
          <dd>{program.for}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{program.format}</dd>
        </div>
      </dl>
      <h4 className="program__focus-title">What the sessions work on</h4>
      <ul className="program__focus">
        {program.focus.map((f) => (
          <li key={f}>
            <TickIcon width={18} height={18} />
            {f}
          </li>
        ))}
      </ul>
      <div className="program__actions">
        <button type="button" className="btn btn--ink" onClick={() => onEnquire(program.id)}>
          Enquire about {program.name.replace(/ Program$/, '')}
        </button>
        <Link className="program__more" to={`/programs/${program.id}`}>
          Full program
        </Link>
      </div>
    </>
  )
}

/** Wide screens: a team sheet with tabs on the left and the chosen program on the right. */
function SheetTabs({ header, onEnquire }) {
  const [selected, setSelected] = useState(academy.programs[0].id)
  const tabs = useRef([])
  const uid = useId()
  const program = academy.programs.find((p) => p.id === selected)

  const onKeyDown = (e, index) => {
    const n = academy.programs.length
    const moves = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    let next = null
    if (e.key in moves) next = (index + moves[e.key] + n) % n
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = n - 1
    if (next === null) return
    e.preventDefault()
    setSelected(academy.programs[next].id)
    tabs.current[next]?.focus()
  }

  return (
    <div className="wrap programs__grid">
      <div className="programs__side">
        {header}
        <div className="sheet" role="tablist" aria-label="Programs" aria-orientation="vertical">
          {academy.programs.map((p, i) => {
            const isOn = p.id === selected
            return (
              <button
                key={p.id}
                ref={(el) => (tabs.current[i] = el)}
                role="tab"
                type="button"
                id={`${uid}-tab-${p.id}`}
                aria-selected={isOn}
                aria-controls={`${uid}-panel`}
                tabIndex={isOn ? 0 : -1}
                className={`sheet__row ${isOn ? 'is-on' : ''}`}
                onClick={() => setSelected(p.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <span className="sheet__name">{p.name}</span>
                <span className="sheet__for">{p.for}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div
        className="program"
        role="tabpanel"
        id={`${uid}-panel`}
        aria-labelledby={`${uid}-tab-${program.id}`}
        key={program.id}
      >
        <ProgramDetail program={program} onEnquire={onEnquire} />
      </div>
    </div>
  )
}

/** Phones: the same sheet as an accordion, so the details open right under the row you tapped. */
function SheetAccordion({ onEnquire }) {
  const [open, setOpen] = useState(academy.programs[0].id)
  const uid = useId()
  return (
    <div className="sheet">
      {academy.programs.map((p) => {
        const isOn = p.id === open
        return (
          <div key={p.id} className="sheet__item">
            <h3 className="sheet__heading">
              <button
                type="button"
                className={`sheet__row ${isOn ? 'is-on' : ''}`}
                aria-expanded={isOn}
                aria-controls={`${uid}-${p.id}`}
                onClick={() => setOpen(isOn ? null : p.id)}
              >
                <span className="sheet__name">{p.name}</span>
                <span className="sheet__for">{p.for}</span>
                <span className="sheet__chevron" aria-hidden="true" />
              </button>
            </h3>
            {isOn && (
              <div className="program program--inline" id={`${uid}-${p.id}`} role="region" aria-label={p.name}>
                <ProgramDetail program={p} onEnquire={onEnquire} headingLevel="p" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function Programs({ onEnquire }) {
  const narrow = useMediaQuery('(max-width: 860px)')
  const header = (
    <>
      <SectionTitle id="programs-title">Five ways to train</SectionTitle>
      <p className="programs__intro">
        From a first kickabout to an overseas pathway. Not sure which fits? Send an enquiry and the academy will help
        you choose.
      </p>
    </>
  )
  return (
    <section className="programs" id="programs" aria-labelledby="programs-title">
      {narrow ? (
        <div className="wrap">
          {header}
          <SheetAccordion onEnquire={onEnquire} />
        </div>
      ) : (
        <SheetTabs header={header} onEnquire={onEnquire} />
      )}
    </section>
  )
}
