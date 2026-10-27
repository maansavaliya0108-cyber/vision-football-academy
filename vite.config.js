import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyPageMeta, pages } from './shared/pages.js'

const api = `http://localhost:${process.env.API_PORT || 4387}`

// index.html carries __ORIGIN__ / __URL__ wherever an absolute URL is required (canonical, share image).
// The Node server fills them in per request; during development they point at the dev server.
const devOrigin = () => ({
  name: 'dev-origin',
  apply: 'serve',
  transformIndexHtml: (html) => html.replaceAll('__URL__', 'http://localhost:5173/').replaceAll('__ORIGIN__', 'http://localhost:5173'),
})

/**
 * Static hosting (GitHub Pages): with SITE_URL set, write a real HTML file for every page, each with
 * its own title, description and canonical URL, plus 404.html, sitemap.xml and robots.txt.
 */
const staticPages = (siteUrl) => ({
  name: 'static-pages',
  apply: 'build',
  closeBundle() {
    if (!siteUrl) return
    const origin = siteUrl.replace(/\/+$/, '')
    const dist = 'dist'
    const shell = readFileSync(join(dist, 'index.html'), 'utf8')
    // GitHub Pages redirects /programs to /programs/ (the folder holding index.html), so the
    // canonical and sitemap addresses carry the slash and never point at a redirect.
    const slashed = (path) => (path === '/' ? '/' : `${path}/`)
    for (const page of pages) {
      const dir = join(dist, page.path)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'index.html'), applyPageMeta(shell, { ...page, path: slashed(page.path) }, origin))
    }
    const missing = { path: '/404', title: 'Page not found | Vision Football Academy', description: 'This page does not exist.' }
    writeFileSync(join(dist, '404.html'), applyPageMeta(shell, missing, origin))
    const today = new Date().toISOString().slice(0, 10)
    writeFileSync(
      join(dist, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
        .map((p) => `  <url><loc>${origin}${slashed(p.path)}</loc><lastmod>${today}</lastmod></url>`)
        .join('\n')}\n</urlset>\n`,
    )
    writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`)
  },
})

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), devOrigin(), staticPages(process.env.SITE_URL)],
  server: {
    port: 5173,
    // Fail instead of drifting to 5174: the API proxy, the startup hook and bookmarks all expect 5173.
    strictPort: true,
    proxy: {
      '/api': api,
      // Keep the browser's Host header so these files list the dev server's own address.
      '/robots.txt': { target: api, changeOrigin: false },
      '/sitemap.xml': { target: api, changeOrigin: false },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
