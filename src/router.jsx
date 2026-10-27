// A small client-side router: page changes swap content instantly instead of reloading the site.
// Paths in the app never include the base path (the GitHub Pages build serves from a sub-folder).
import { useEffect, useSyncExternalStore } from 'react'
import { findPage } from '../shared/pages.js'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const EVENT = 'vfa:navigate'

export const toHref = (to) => (to.startsWith('#') ? to : BASE + to)

export function currentPath() {
  let p = window.location.pathname
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length)
  return p.replace(/\/+$/, '') || '/'
}

const subscribe = (cb) => {
  window.addEventListener('popstate', cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener('popstate', cb)
    window.removeEventListener(EVENT, cb)
  }
}

export const usePath = () => useSyncExternalStore(subscribe, currentPath)

// Set by the layout so navigation can scroll through Lenis when smooth scrolling is on.
let scroller = null
export const setScroller = (s) => (scroller = s)

export function scrollToId(id, { immediate = false } = {}) {
  const el = document.getElementById(id)
  if (!el) return
  // Lenis caches the page height; after switching pages it must re-measure or the scroll gets clamped.
  scroller?.resize()
  if (scroller) scroller.scrollTo(el, { offset: -72, immediate })
  else el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' })
}

export function navigate(to) {
  const [path, hash] = to.split('#')
  const samePage = !path || path === currentPath()
  if (!samePage) {
    window.history.pushState(null, '', toHref(path || '/') + (hash ? `#${hash}` : ''))
    window.dispatchEvent(new Event(EVENT))
    if (scroller) scroller.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
  } else if (hash) {
    window.history.replaceState(null, '', toHref(currentPath()) + `#${hash}`)
  }
  if (hash) scrollWhenReady(hash, !samePage)
}

/** The next page may still be loading: wait (up to 4 s) for the section to exist, then scroll to it. */
function scrollWhenReady(id, immediate) {
  const started = performance.now()
  const tryScroll = () => {
    if (document.getElementById(id)) {
      // One more frame so the page's layout has settled before measuring.
      requestAnimationFrame(() => scrollToId(id, { immediate }))
    } else if (performance.now() - started < 4000) {
      setTimeout(tryScroll, 50)
    }
  }
  tryScroll()
}

/** An internal link: a real <a href> (so it works without JavaScript and opens in new tabs) that navigates instantly. */
export function Link({ to, onClick, ...props }) {
  return (
    <a
      href={toHref(to)}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        navigate(to)
      }}
      {...props}
    />
  )
}

/** Keeps the tab title and description in step with the current page. */
export function usePageMeta(path) {
  useEffect(() => {
    const page = findPage(path)
    if (!page) return
    document.title = page.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', page.description)
  }, [path])
}
