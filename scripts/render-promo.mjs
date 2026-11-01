// Renders the promo film to public/media: a 16:9 MP4 for the site and YouTube, a 9:16 MP4 for
// Instagram Reels and WhatsApp Status, and a poster image for each.
// Needs the dev server running (npm run dev) and Google Chrome installed; set CHROME_PATH if it lives
// somewhere else. Usage: npm run promo
// To check frames without rendering the whole film: npm run promo -- --stills <folder>
import puppeteer from 'puppeteer-core'
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = process.env.SITE || 'http://localhost:5173'
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const media = fileURLToPath(new URL('../public/media/', import.meta.url))
const stillsAt = process.argv.indexOf('--stills')
const FILES = { landscape: 'vision-promo-16x9', portrait: 'vision-promo-9x16' }
// The poster is the end card: the wordmark, Book a visit and the phone number.
const POSTER_AT = 31.8

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: mkdtempSync(join(tmpdir(), 'vfa-promo-')),
  args: ['--no-first-run', '--ignore-gpu-blocklist'],
  protocolTimeout: 20 * 60 * 1000,
})
const save = (file, dataUrl) => writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('page error:', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()))
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`${site}/promo/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.promoReady, { timeout: 60000 })

  if (stillsAt > -1) {
    const out = process.argv[stillsAt + 1]
    mkdirSync(out, { recursive: true })
    const times = [0.5, 1.5, 3.2, 4.6, 5.75, 6.15, 7.6, 9, 10.6, 12.6, 15, 16.6, 18.6, 20.6, 22.6, 25.9, 28.6, 30.1, 31.8, 33]
    for (const format of ['landscape', 'portrait']) {
      for (const t of times) save(join(out, `${format}-${String(t).padStart(4, '0')}.jpg`), await page.evaluate((f, t) => window.renderStill(f, t), format, t))
    }
    console.log(`stills written to ${out}`)
  } else {
    mkdirSync(media, { recursive: true })
    await page.exposeFunction('__save', (format, b64, last) => {
      appendFileSync(join(media, `${FILES[format]}.mp4`), Buffer.from(b64, 'base64'))
      if (last) console.log(`public/media/${FILES[format]}.mp4 written`)
    })
    for (const format of ['landscape', 'portrait']) {
      writeFileSync(join(media, `${FILES[format]}.mp4`), Buffer.alloc(0))
      const started = Date.now()
      const bytes = await page.evaluate((f) => window.renderPromo(f), format)
      console.log(`${format}: ${(bytes / 1e6).toFixed(1)} MB in ${Math.round((Date.now() - started) / 1000)} s`)
      save(join(media, `${FILES[format]}.jpg`), await page.evaluate((f, t) => window.renderStill(f, t), format, POSTER_AT))
    }
  }
} finally {
  await browser.close()
}
