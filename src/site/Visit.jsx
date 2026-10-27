import { useEffect, useRef, useState } from 'react'
import { academy } from '../../shared/academy.js'
import { formatTime } from '../../shared/schedule.js'
import { useTrainingStatus } from './useTrainingStatus'
import { StatusBadge } from './Story'
import { ChatIcon, PhoneIcon, PinIcon } from './icons'
import { SectionTitle } from './SectionTitle'

function LazyMap() {
  const box = useRef(null)
  const [load, setLoad] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLoad(true), { rootMargin: '400px' })
    io.observe(box.current)
    return () => io.disconnect()
  }, [])
  return (
    <div className="map" ref={box}>
      {load ? (
        <iframe
          title="Map showing Boghara School Ground, Adajan, Surat"
          src={academy.maps.embed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="map__placeholder">Loading map</div>
      )}
    </div>
  )
}

export function Visit() {
  const status = useTrainingStatus()
  const { phone, address } = academy
  return (
    <section className="visit" id="visit" aria-labelledby="visit-title">
      <div className="wrap visit__grid">
        <div className="visit__times">
          <SectionTitle id="visit-title">Monday to Friday, 6 to 9 PM</SectionTitle>
          <StatusBadge status={status} />
          <table className="fixtures">
            <caption className="visually-hidden">Weekly training timings</caption>
            <tbody>
              {academy.schedule.map((d) => (
                <tr key={d.day} className={`${d.dow === status.today ? 'is-today' : ''} ${d.open ? '' : 'is-off'}`}>
                  <th scope="row">
                    {d.day}
                    {d.dow === status.today && (
                      <>
                        {' '}
                        <span className="fixtures__today">Today</span>
                      </>
                    )}
                  </th>
                  <td>{d.open ? `${formatTime(d.open)} to ${formatTime(d.close)}` : 'No training'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="visit__note">Weekends are {academy.weekendNote.charAt(0).toLowerCase() + academy.weekendNote.slice(1)}</p>
        </div>

        <div className="visit__ground">
          <LazyMap />
          <div className="ground">
            <h3 className="ground__title">
              <PinIcon width={20} height={20} />
              {address.venue}
            </h3>
            <address className="ground__address">
              {address.lines.map((l) => (
                <span key={l}>{l}</span>
              ))}
              <span>
                {address.city}, {address.region} {address.postcode}
              </span>
            </address>
            <p className="ground__facility">{academy.facility}</p>
            <div className="ground__actions">
              <a className="btn btn--volt" href={academy.maps.directions} target="_blank" rel="noreferrer">
                Get directions
              </a>
              <a className="btn btn--ghost" href={`tel:${phone.tel}`}>
                <PhoneIcon width={18} height={18} />
                Call
              </a>
              <a
                className="btn btn--ghost"
                href={`https://wa.me/${phone.whatsapp}?text=${encodeURIComponent('Hi, I would like to know more about training at Vision Football Academy.')}`}
                target="_blank"
                rel="noreferrer"
              >
                <ChatIcon width={18} height={18} />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
