import { useEffect, useState } from 'react'
import { academy } from '../../shared/academy.js'
import { Link } from '../router'
import { ChatIcon, PhoneIcon } from './icons'
import { joinTarget } from './Nav'

/**
 * Phones only: call, WhatsApp and join stay one tap away once the hero's own buttons have
 * scrolled off. It steps aside while the enquiry form is on screen.
 */
export function QuickBar({ path }) {
  const [pastHero, setPastHero] = useState(false)
  const [formInView, setFormInView] = useState(false)

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const join = document.getElementById('join')
    const io = join && new IntersectionObserver(([e]) => setFormInView(e.isIntersecting), { threshold: 0.05 })
    io?.observe(join)
    return () => {
      window.removeEventListener('scroll', onScroll)
      setFormInView(false)
      io?.disconnect()
    }
  }, [path])

  const shown = pastHero && !formInView
  return (
    <nav className={`quickbar ${shown ? 'is-shown' : ''}`} aria-label="Contact the academy" aria-hidden={!shown}>
      <a href={`tel:${academy.phone.tel}`} tabIndex={shown ? 0 : -1}>
        <PhoneIcon width={18} height={18} />
        Call
      </a>
      <a
        href={`https://wa.me/${academy.phone.whatsapp}?text=${encodeURIComponent('Hi, I would like to know more about training at Vision Football Academy.')}`}
        target="_blank"
        rel="noreferrer"
        tabIndex={shown ? 0 : -1}
      >
        <ChatIcon width={18} height={18} />
        <span className="quickbar__label">WhatsApp</span>
      </a>
      <Link className="quickbar__join" to={joinTarget(path)} tabIndex={shown ? 0 : -1}>
        <span className="cta-long">Book a visit</span>
        <span className="cta-short">Visit</span>
      </Link>
    </nav>
  )
}
