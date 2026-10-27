import { academy } from '../../shared/academy.js'

const google = academy.ratings.find((r) => r.source === 'Google')
const items = [
  'Think one pass ahead',
  'Monday to Friday, 6 to 9 PM',
  'Boghara School Ground',
  'Adajan, Surat',
  `${google.score.toFixed(1)} on Google`,
  'Five programs',
]

/** A volt ticker between the scroll story and the rest of the page. Decorative: the facts appear elsewhere. */
export function Marquee() {
  const run = (
    <span className="marquee__run">
      {items.map((t) => (
        <span key={t} className="marquee__item">
          {t}
          <svg className="marquee__dot" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M6 7.5 10 13.5 14 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ))}
    </span>
  )
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {run}
        {run}
      </div>
    </div>
  )
}
