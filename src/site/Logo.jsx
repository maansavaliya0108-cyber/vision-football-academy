import { Link } from '../router'

/** Mark: a lens ring (vision) with a chevron V cut through it. Swap for the academy's crest when available. */
export function Mark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M19 21 32 45 45 21" fill="none" stroke="var(--volt)" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo() {
  return (
    <Link className="logo" to="/">
      <Mark />
      <span className="logo__words">
        <span className="logo__name">Vision</span>{' '}
        <span className="logo__sub">Football Academy</span>
      </span>
    </Link>
  )
}
