import { useEffect, useRef, useState } from 'react'
import { Link, holdScroll, usePath } from '../router'
import { joinTarget } from './Nav'

const MEDIA = `${import.meta.env.BASE_URL}media/`
/** "Head Up", the animated short film (rendered by npm run film). */
export const SHORT = {
  id: 'short',
  name: 'Head Up',
  kind: 'Short film',
  length: '1 min',
  wide: { src: `${MEDIA}vision-head-up.mp4`, poster: `${MEDIA}vision-head-up.jpg` },
}
/** The promo (rendered by npm run promo): a 16:9 cut and a 9:16 cut for phones and Reels. */
export const PROMO = {
  id: 'promo',
  name: 'The promo',
  kind: 'Promo',
  length: '33 sec',
  wide: { src: `${MEDIA}vision-promo-16x9.mp4`, poster: `${MEDIA}vision-promo-16x9.jpg` },
  tall: { src: `${MEDIA}vision-promo-9x16.mp4`, poster: `${MEDIA}vision-promo-9x16.jpg` },
}
const FILMS = { short: SHORT, promo: PROMO }

/** Opens a film over whatever page is showing: the short film unless 'promo' is asked for. */
export const openFilm = (which) => window.dispatchEvent(new CustomEvent('vfa:film', { detail: which === 'promo' ? 'promo' : 'short' }))

// Phones held upright get the vertical cut, where a film has one.
const showing = (id, muted) => ({ id, muted, tall: !!FILMS[id].tall && window.innerWidth / window.innerHeight < 0.8 })

/**
 * The film player: a full-screen dialog with "Head Up" or the promo, and a switch between them.
 * Opened from "Watch the film" anywhere, or straight away by a shared link with ?film (the short
 * film) or ?promo in it.
 */
export function FilmPlayer() {
  const dialog = useRef(null)
  const video = useRef(null)
  // null while closed; otherwise which film and cut are showing and whether it starts muted (a shared
  // link opens the player without a tap, so the browser only lets it start muted).
  const [film, setFilm] = useState(null)
  const path = usePath()

  useEffect(() => {
    const show = (e) => setFilm(showing(e.detail, false))
    window.addEventListener('vfa:film', show)
    const query = new URLSearchParams(window.location.search)
    if (query.has('film')) setFilm(showing('short', true))
    else if (query.has('promo')) setFilm(showing('promo', true))
    return () => window.removeEventListener('vfa:film', show)
  }, [])

  const open = !!film
  useEffect(() => {
    const d = dialog.current
    if (!open || !d) return
    d.showModal()
    holdScroll(true)
    return () => {
      holdScroll(false)
      if (d.open) d.close()
    }
  }, [open])

  // Each time the film changes: play it, with sound when the visitor asked for it.
  useEffect(() => {
    if (!film) return
    const v = video.current
    v.muted = film.muted
    // Sound on when the visitor asked for the film; if the browser still refuses, play muted.
    v.play().catch(() => {
      v.muted = true
      v.play().catch(() => {})
    })
  }, [film])

  const close = () => {
    video.current?.pause()
    setFilm(null)
  }

  const current = film && FILMS[film.id]
  const cut = film?.tall ? current.tall : current?.wide
  return (
    <dialog
      ref={dialog}
      className={`player ${film?.tall ? 'player--tall' : ''}`}
      aria-labelledby="player-title"
      onClose={close}
      onClick={(e) => e.target === dialog.current && close()}
    >
      {film && (
        <div className="player__inner">
          <div className="player__top">
            <h2 id="player-title" className="player__title">
              Vision Football Academy <span>· {current.name}</span>
            </h2>
            <div className="player__films" role="group" aria-label="Choose a film">
              {Object.values(FILMS).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="player__film"
                  aria-pressed={f.id === film.id}
                  onClick={() => f.id !== film.id && setFilm(showing(f.id, false))}
                >
                  {f.kind} <span>{f.length}</span>
                </button>
              ))}
            </div>
            <button type="button" className="player__close" onClick={close}>
              Close
            </button>
          </div>
          <video key={cut.src} ref={video} className="player__video" src={cut.src} poster={cut.poster} controls playsInline preload="auto" />
          <div className="player__actions">
            <Link className="btn btn--volt" to={joinTarget(path)} onClick={close}>
              Book a visit
            </Link>
            {current.tall && (
              <a className="player__download" href={current.tall.src} download="Vision-Football-Academy-9x16.mp4">
                Download for Reels and Status (9:16)
              </a>
            )}
            <a className="player__download" href={current.wide.src} download={current === SHORT ? 'Vision-Football-Academy-Head-Up.mp4' : 'Vision-Football-Academy-16x9.mp4'}>
              Download {current === SHORT ? 'the film' : 'widescreen'} (16:9)
            </a>
          </div>
        </div>
      )}
    </dialog>
  )
}
