import { useEffect } from 'react'
import Lenis from 'lenis'
import '../styles/site.css'
import { setScroller } from '../router'
import { Nav } from './Nav'
import { Footer } from './Footer'
import { QuickBar } from './QuickBar'

/** Everything around a public page: smooth scrolling, the nav, the footer and the phone contact bar. */
export function Layout({ path, children }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ lerp: 0.075, anchors: { offset: -72 } })
    setScroller(lenis)
    let raf = requestAnimationFrame(function loop(t) {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    })
    return () => {
      cancelAnimationFrame(raf)
      setScroller(null)
      lenis.destroy()
    }
  }, [])

  // Arriving from a shared link with a #section: wait for the page to render, then jump to it.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    let tries = 0
    const t = setInterval(() => {
      const el = document.getElementById(id)
      if (el || ++tries > 30) {
        clearInterval(t)
        el?.scrollIntoView()
      }
    }, 100)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav path={path} />
      <main id="main" key={path}>
        {children}
      </main>
      <Footer />
      <QuickBar path={path} />
    </>
  )
}
