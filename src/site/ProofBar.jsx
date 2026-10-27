import { academy } from '../../shared/academy.js'
import { Stars } from './icons'

const [google, justdial] = academy.ratings
const evenings = academy.schedule.filter((d) => d.open).length

// The academy at a glance, straight after the story: every figure comes from shared/academy.js.
const FACTS = [
  { value: google.score.toFixed(1), stars: true, label: `on Google, from ${google.countLabel}` },
  { value: justdial.score.toFixed(1), stars: true, label: 'on Justdial' },
  { value: String(evenings), label: 'evenings a week, 6 to 9 PM' },
  { value: String(academy.programs.length), label: 'programs, from a first kickabout to an overseas pathway' },
  { value: String(academy.philosophy.quadrants.length), label: 'areas worked on in every session' },
]

export function ProofBar() {
  return (
    <section className="proof" aria-label="The academy at a glance">
      <ul className="wrap proof__list">
        {FACTS.map((f) => (
          <li key={f.label} className="proof__item">
            <p className="proof__value">
              {f.value}
              {f.stars && <span className="visually-hidden"> out of 5</span>}
            </p>
            {f.stars && <Stars size={14} />}
            <p className="proof__label">{f.label}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
