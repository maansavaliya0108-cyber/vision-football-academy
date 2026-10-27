import { academy } from '../../shared/academy.js'
import { Link, usePath } from '../router'
import { PhoneIcon } from './icons'
import { joinTarget } from './Nav'

/**
 * The call to action that closes a persuasive section: book a visit (straight to the form, wherever
 * it is), or call. `tone` matches the section: "volt" on dark backgrounds, "ink" on bone and volt.
 */
export function BookVisit({ tone = 'volt', note }) {
  const path = usePath()
  return (
    <div className={`book book--${tone}`}>
      <Link className={`btn btn--${tone}`} to={joinTarget(path)}>
        Book a visit
      </Link>
      <a className="book__call" href={`tel:${academy.phone.tel}`}>
        <PhoneIcon width={18} height={18} />
        Or call {academy.phone.display}
      </a>
      {note && <p className="book__note">{note}</p>}
    </div>
  )
}
