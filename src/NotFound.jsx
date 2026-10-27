import { useEffect } from 'react'
import { academy } from '../shared/academy.js'
import { Link } from './router'
import { Mark } from './site/Logo'

export default function NotFound() {
  useEffect(() => {
    document.title = 'Page not found | Vision Football Academy'
  }, [])
  return (
    <section className="not-found">
      <Mark size={56} />
      <h1>Page not found</h1>
      <p>This address isn’t part of the Vision Football Academy site. It may have been mistyped or moved.</p>
      <div className="not-found__actions">
        <Link className="not-found__home" to="/">
          Go to the home page
        </Link>
        <a href={`tel:${academy.phone.tel}`}>Call {academy.phone.display}</a>
      </div>
    </section>
  )
}
