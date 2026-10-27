import { Link } from '../router'
import { widestWordEm } from '../site/fit'

/**
 * The top of every inner page: where you are, the page title set huge, and a pitch diagram that
 * draws itself in (a quiet echo of the particle story on the home page).
 * `marks` are [x, y] spots on the 200 × 300 diagram for the volt player dots.
 */
export function PageHero({ crumbs = [], title, lede, children, marks = [[100, 196], [128, 110], [62, 150]] }) {
  // The title is set so large that its widest word decides whether it fits a phone; CSS uses this
  // to cap the size so a word like "INTERNATIONAL" never runs off the screen.
  const fit = widestWordEm(title).toFixed(2)
  return (
    <header className="page-hero">
      <div className="wrap page-hero__grid">
        <div className="page-hero__copy">
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link to="/">Home</Link>
              </li>
              {crumbs.map((c) => (
                <li key={c.label}>{c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
              ))}
            </ol>
          </nav>
          <h1 className="page-hero__title" style={{ '--fit': fit }}>
            {title}
          </h1>
          {lede && <p className="page-hero__lede">{lede}</p>}
          {children && <div className="page-hero__actions">{children}</div>}
        </div>
        <svg className="page-hero__pitch" viewBox="0 0 200 300" aria-hidden="true" focusable="false">
          <g className="page-hero__lines" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="10" y="10" width="180" height="280" pathLength="1" />
            <line x1="10" y1="150" x2="190" y2="150" pathLength="1" />
            <circle cx="100" cy="150" r="28" pathLength="1" />
            <rect x="46" y="10" width="108" height="46" pathLength="1" />
            <rect x="77" y="10" width="46" height="18" pathLength="1" />
            <rect x="46" y="244" width="108" height="46" pathLength="1" />
            <rect x="77" y="272" width="46" height="18" pathLength="1" />
          </g>
          {marks.map(([x, y], i) => (
            <circle key={i} className="page-hero__mark" cx={x} cy={y} r="4.5" style={{ animationDelay: `${0.9 + i * 0.15}s` }} />
          ))}
          {marks.length > 1 && (
            <path
              className="page-hero__pass"
              d={`M${marks[0][0]} ${marks[0][1]} Q ${(marks[0][0] + marks[1][0]) / 2 + 30} ${(marks[0][1] + marks[1][1]) / 2} ${marks[1][0]} ${marks[1][1]}`}
              pathLength="1"
            />
          )}
        </svg>
      </div>
    </header>
  )
}

/** A full-width call to action band that closes most pages. */
export function CtaBand({ title = 'Come and see a session', body, to = '/visit#join', label = 'Join the academy' }) {
  return (
    <section className="cta-band" aria-label="Join the academy">
      <div className="wrap cta-band__inner">
        <h2 className="cta-band__title">{title}</h2>
        {body && <p className="cta-band__body">{body}</p>}
        <Link className="btn btn--ink" to={to}>
          {label}
        </Link>
      </div>
    </section>
  )
}
