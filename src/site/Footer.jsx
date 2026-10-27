import { academy } from '../../shared/academy.js'
import { STATIC } from '../config'
import { Link } from '../router'
import { Logo } from './Logo'

export function Footer() {
  const { address, phone } = academy
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div className="footer__brand">
          <Logo />
          <p>Evening football coaching for young players in Adajan, Surat.</p>
        </div>
        <nav aria-label="Footer">
          <h2 className="footer__title">Explore</h2>
          <ul className="footer__links">
            <li>
              <Link to="/programs">Programs</Link>
            </li>
            <li>
              <Link to="/method">The method</Link>
            </li>
            <li>
              <Link to="/visit">Timings and ground</Link>
            </li>
            <li>
              <Link to="/visit#faq">Questions</Link>
            </li>
            <li>
              <Link to="/visit#join">Join the academy</Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="footer__title">Ground</h2>
          <address>
            {address.venue}
            <br />
            {address.lines[1]}
            <br />
            {address.city}, {address.region} {address.postcode}
          </address>
        </div>
        <div>
          <h2 className="footer__title">Training</h2>
          <p>
            Monday to Friday
            <br />6 PM to 9 PM
            <br />
            No sessions at weekends
          </p>
        </div>
        <div>
          <h2 className="footer__title">Contact</h2>
          <p>
            <a href={`tel:${phone.tel}`}>{phone.display}</a>
            <br />
            <a href={`https://wa.me/${phone.whatsapp}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </p>
        </div>
      </div>
      <p className="footer__wordmark" aria-hidden="true">
        Vision
      </p>
      <div className="wrap footer__base">
        <p>© {new Date().getFullYear()} {academy.name}, Surat</p>
        {!STATIC && <a href="/admin">Staff sign-in</a>}
      </div>
    </footer>
  )
}
