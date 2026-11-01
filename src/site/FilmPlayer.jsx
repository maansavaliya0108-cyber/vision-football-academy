import { useEffect, useRef, useState } from 'react'
import { Link, holdScroll, usePath } from '../router'
import { joinTarget } from './Nav'

const MEDIA = `${import.meta.env.BASE_URL}media/`
/** The promo film (rendered by npm run promo): a 16:9 cut and a 9:16 cut for phones and Reels. */
export const PROMO = {
  seconds: 33,
  wide: { src: `${MEDIA}vision-promo-16x9.mp4`, poster: `${MEDIA}vision-promo-16x9.jpg` },
  tall: { src: `${MEDIA}vision-promo-9x16.mp4`, poster: `${MEDIA}vision-promo-9x16.jpg` },
}

/** Opens the promo film over whatever page is showing. */
export const openFilm = () => window.dispatchEvent(new Event('vfa:promo'))

// Phones held upright get the vertical cut.
const showing = (muted) => ({ muted, tall: window.innerWidth / window.innerHeight < 0.8 })

/**
 * The film player: a full-screen dialog with the 33-second promo. Opened from "Watch the film"
 * anywhere, or straight away by a shared link with ?film in it.
 */
export function FilmPlayer() {
  const dialog = useRef(null)
  const video = useRef(null)
  // null while closed; otherwise which cut is showing and whether it starts muted (a shared link
  // opens the player without a tap, so the browser only lets it start muted).
  const [film, setFilm] = useState(null)
  const path = usePath()

  useEffect(() => {
    const show = () => setFilm(showing(false))
    window.addEventListener('vfa:promo', show)
    if (new URLSearchParams(window.location.search).has('film')) setFilm(showing(true))
    return () => window.removeEventListener('vfa:promo', show)
  }, [])

  useEffect(() => {
    const d = dialog.current
    if (!film || !d) return
    d.showModal()
    holdScroll(true)
    const v = video.current
    v.muted = film.muted
    // Sound on when the visitor asked for the film; if the browser still refuses, play muted.
    v.play().catch(() => {
      v.muted = true
      v.play().catch(() => {})
    })
    return () => {
      holdScroll(false)
      if (d.open) d.close()
    }
  }, [film])

  const close = () => {
    video.current?.pause()
    setFilm(null)
  }

  const cut = film?.tall ? PROMO.tall : PROMO.wide
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
              Vision Football Academy <span>· The film</span>
            </h2>
            <button type="button" className="player__close" onClick={close}>
              Close
            </button>
          </div>
          <video ref={video} className="player__video" src={cut.src} poster={cut.poster} controls playsInline preload="auto" />
          <div className="player__actions">
            <Link className="btn btn--volt" to={joinTarget(path)} onClick={close}>
              Book a visit
            </Link>
            <a className="player__download" href={PROMO.tall.src} download="Vision-Football-Academy-9x16.mp4">
              Download for Reels and Status (9:16)
            </a>
            <a className="player__download" href={PROMO.wide.src} download="Vision-Football-Academy-16x9.mp4">
              Download widescreen (16:9)
            </a>
          </div>
        </div>
      )}
    </dialog>
  )
}
