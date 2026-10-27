import { useEffect, useState } from 'react'
import { academy } from '../../shared/academy.js'
import { Link } from '../router'
import { Logo } from './Logo'
import { CloseIcon, MenuIcon, PhoneIcon } from './icons'

const links = [
  { to: '/method', label: 'Method' },
  { to: '/programs', label: 'Programs' },
  { to: '/visit', label: 'Timings and ground' },
  { to: '/visit#faq', label: 'Questions' },
]

/** Pages with the enquiry form on them can jump straight to it; the rest go to the visit page. */
export const joinTarget = (path) => (path === '/' || path === '/visit' || path.startsWith('/programs/') ? '#join' : '/visit#join')

export function Nav({ path }) {
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)
  const isCurrent = (to) => !to.includes('#') && (path === to || path.startsWith(`${to}/`))

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className={`nav ${solid || open ? 'nav--solid' : ''}`}>
      <div className="nav__inner">
        <Logo />
        <nav className={`nav__links ${open ? 'is-open' : ''}`} id="site-menu" aria-label="Main">
          {links.map((l) => (
            <Link key={l.to} to={l.to} aria-current={isCurrent(l.to) ? 'page' : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <a className="nav__phone nav__phone--menu" href={`tel:${academy.phone.tel}`}>
            <PhoneIcon width={18} height={18} />
            {academy.phone.display}
          </a>
        </nav>
        <div className="nav__actions">
          <a className="nav__phone" href={`tel:${academy.phone.tel}`}>
            <PhoneIcon width={18} height={18} />
            {academy.phone.display}
          </a>
          <Link className="btn btn--volt btn--small" to={joinTarget(path)} onClick={() => setOpen(false)}>
            {/* One wrapper, so the button's flex gap doesn't open up between the two halves. */}
            <span>
              Join<span className="join-more"> the academy</span>
            </span>
          </Link>
          <button
            className="nav__toggle"
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
            <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
