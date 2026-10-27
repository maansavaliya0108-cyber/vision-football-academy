import express from 'express'
import compression from 'compression'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { academy } from '../shared/academy.js'
import { applyPageMeta, findPage, pages } from '../shared/pages.js'
import { trainingStatus } from '../shared/schedule.js'
import { createEnquiry, enquiryStats, listEnquiries, updateEnquiry } from './db.js'
import { enquirySchema, fieldErrors, updateSchema } from './validation.js'
import {
  adminConfigured,
  endSession,
  isAuthenticated,
  passwordMatches,
  requireAdmin,
  startSession,
} from './auth.js'

const isProd = process.env.NODE_ENV === 'production'
// In production this one server serves the whole site on PORT (as most hosts expect).
// In development Vite owns the page and proxies /api here, so the API keeps its own port.
const PORT = isProd ? Number(process.env.PORT) || 8787 : Number(process.env.API_PORT) || 4387
const dist = resolve('dist')

const app = express()
app.disable('x-powered-by')
app.use(compression())
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback')
app.use(express.json({ limit: '20kb' }))

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (isProd) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        'frame-src https://www.google.com https://maps.google.com',
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    )
  }
  next()
})

// Small in-memory limiter: enough to stop a form being hammered from one address.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs)
    if (recent.length >= max) {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - recent[0])) / 1000))
      return res.status(429).json({ error: message })
    }
    recent.push(now)
    hits.set(req.ip, recent)
    if (hits.size > 5000) hits.clear()
    next()
  }
}

async function notify(ref, enquiry) {
  const url = process.env.ENQUIRY_WEBHOOK_URL
  if (!url) return
  const program = academy.programs.find((p) => p.id === enquiry.program)?.name
  const text = `New enquiry ${ref}: ${enquiry.playerName} (age ${enquiry.playerAge}) for ${program}. Call ${enquiry.phone}.`
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text, ref, enquiry }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (err) {
    console.warn(`Webhook for ${ref} failed: ${err.message}`)
  }
}

// ---------- Public API ----------

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.get('/api/academy', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.json(academy)
})

app.get('/api/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json(trainingStatus())
})

app.post(
  '/api/enquiries',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many enquiries from this connection. Call the academy instead, or try again in 15 minutes.',
  }),
  (req, res) => {
    const parsed = enquirySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error)
      // Quietly accept bot submissions that filled the honeypot, so they get no signal.
      if (errors.website) return res.status(201).json({ ref: 'VFA-RECEIVED' })
      return res.status(422).json({ error: 'Check the highlighted fields.', fields: errors })
    }
    const ref = createEnquiry(parsed.data)
    notify(ref, parsed.data)
    res.status(201).json({ ref })
  },
)

// ---------- Admin API ----------

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: isAuthenticated(req), configured: adminConfigured() })
})

app.post(
  '/api/admin/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many sign-in attempts. Wait 15 minutes and try again.' }),
  (req, res) => {
    if (!adminConfigured()) {
      return res.status(503).json({ error: 'Set ADMIN_PASSWORD (8 or more characters) on the server to turn on the dashboard.' })
    }
    if (!passwordMatches(req.body?.password ?? '')) {
      return res.status(401).json({ error: 'That password is incorrect.' })
    }
    startSession(res)
    res.json({ authenticated: true })
  },
)

app.post('/api/admin/logout', (req, res) => {
  endSession(res)
  res.json({ authenticated: false })
})

app.get('/api/admin/enquiries', requireAdmin, (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    enquiries: listEnquiries({ status: req.query.status, q: String(req.query.q || '').slice(0, 80) }),
    stats: enquiryStats(),
  })
})

app.patch('/api/admin/enquiries/:id', requireAdmin, (req, res) => {
  const parsed = updateSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(422).json({ error: 'Check the status and notes.', fields: fieldErrors(parsed.error) })
  const updated = updateEnquiry(Number(req.params.id), parsed.data)
  if (!updated) return res.status(404).json({ error: 'That enquiry no longer exists.' })
  res.json(updated)
})

app.get('/api/admin/enquiries.csv', requireAdmin, (req, res) => {
  const rows = listEnquiries({ status: req.query.status })
  const columns = [
    'ref', 'created_at', 'status', 'player_name', 'player_age', 'guardian_name',
    'phone', 'email', 'program', 'experience', 'preferred_day', 'message', 'notes',
  ]
  // Prefix formula-like cells so spreadsheets don't execute them.
  const cell = (v) => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }
  const csv = [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\r\n')
  const date = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="vision-fa-enquiries-${date}.csv"`)
  res.send('﻿' + csv)
})

app.use('/api', (req, res) => res.status(404).json({ error: 'No such endpoint.' }))

// ---------- Search engines ----------

// The public address of the site. Set SITE_URL in production so links never depend on the Host header;
// without it, a Host header that isn't a plain hostname is ignored rather than written into pages.
const originOf = (req) => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '')
  const host = req.get('host') || ''
  return `${req.protocol}://${/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host) ? host : `localhost:${PORT}`}`
}

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    ['User-agent: *', 'Disallow: /admin', 'Disallow: /api/', '', `Sitemap: ${originOf(req)}/sitemap.xml`, ''].join('\n'),
  )
})

const builtAt = new Date().toISOString().slice(0, 10)
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${originOf(req)}${p.path}</loc><lastmod>${builtAt}</lastmod></url>`).join('\n')}
</urlset>
`,
  )
})

// ---------- Client ----------


if (isProd && existsSync(dist)) {
  const indexHtml = readFileSync(resolve(dist, 'index.html'), 'utf8')
  app.use(
    express.static(dist, {
      index: false,
      setHeaders: (res, path) => {
        // Vite fingerprints everything under /assets, so those can be cached forever.
        const hashed = path.includes(`${resolve(dist, 'assets')}`)
        res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600')
      },
    }),
  )
  const notFound = { path: '/404', title: 'Page not found | Vision Football Academy', description: 'This page does not exist.' }
  const adminPage = { path: '/admin', title: 'Enquiries | Vision Football Academy', description: 'Staff dashboard.' }
  app.get('/{*splat}', (req, res) => {
    const path = req.path.replace(/\/+$/, '') || '/'
    const page = findPage(path) || (path === '/admin' ? adminPage : null)
    res.setHeader('Cache-Control', 'no-cache')
    // Each page gets its own title and description in the HTML (for search and link previews).
    // Unknown paths still get the app, which shows a not-found page, but with a real 404 status.
    res
      .status(page ? 200 : 404)
      .type('html')
      .send(applyPageMeta(indexHtml, page || notFound, originOf(req)))
  })
}

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON.' })
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That message is too long. Shorten it, or call the academy instead.' })
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on the server. Call the academy if this keeps happening.' })
})

app.listen(PORT, (err) => {
  if (err) {
    console.error(
      err.code === 'EADDRINUSE'
        ? `Port ${PORT} is already in use.${isProd ? '' : ' The dev server is probably running already; npm run dev:stop stops it.'}`
        : err,
    )
    process.exit(1)
  }
  console.log(`Vision FA API listening on http://localhost:${PORT}${isProd ? '' : ' (dev; site runs through Vite)'}`)
  if (!adminConfigured()) console.log('ADMIN_PASSWORD is missing, too short or still the example value, so /admin is turned off.')
})
