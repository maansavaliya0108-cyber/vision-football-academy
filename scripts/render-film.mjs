// Renders the short film "Head Up" to public/media/vision-head-up.mp4, with a poster image.
// Needs the dev server running (npm run dev) and Google Chrome installed; set CHROME_PATH if it lives
// somewhere else. Usage: npm run film
// To check frames without rendering the whole film: npm run film -- --stills <folder> [times…]
import puppeteer from 'puppeteer-core'
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = process.env.SITE || 'http://localhost:5173'
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const media = fileURLToPath(new URL('../public/media/', import.meta.url))
const stillsAt = process.argv.indexOf('--stills')
const FILE = 'vision-head-up'
// The poster: the first-time pass, in slow motion, as the defender lunges.
const POSTER_AT = 42.3

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: mkdtempSync(join(tmpdir(), 'vfa-film-')),
  args: ['--no-first-run', '--ignore-gpu-blocklist'],
  protocolTimeout: 30 * 60 * 1000,
})
const save = (file, dataUrl) => writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('page error:', e.message))
  page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && console.error('console:', m.text()))
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`${site}/film/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.filmReady, { timeout: 60000 })
  if (stillsAt > -1) {
    const out = process.argv[stillsAt + 1]
    const times = process.argv.slice(stillsAt + 2).map(Number)
    mkdirSync(out, { recursive: true })
    for (const t of times.length ? times : [2, 3.5, 6, 10, 13.5, 16.5, 18.5, 20.3, 23.5, 26.5, 29, 31.5, 34, 37, 39, 40.7, 42, 44, 46, 47.8, 52, 56, 61]) {
      save(join(out, `f-${String(t.toFixed(1)).padStart(4, '0')}.jpg`), await page.evaluate((t) => window.renderStill(t), t))
    }
    console.log(`stills written to ${out}`)
  } else {
    mkdirSync(media, { recursive: true })
    const file = join(media, `${FILE}.mp4`)
    writeFileSync(file, Buffer.alloc(0))
    await page.exposeFunction('__save', (b64, last) => {
      appendFileSync(file, Buffer.from(b64, 'base64'))
      if (last) console.log(`public/media/${FILE}.mp4 written`)
    })
    const started = Date.now()
    const bytes = await page.evaluate(() => window.renderFilm())
    console.log(`${(bytes / 1e6).toFixed(1)} MB in ${Math.round((Date.now() - started) / 1000)} s`)
    save(join(media, `${FILE}.jpg`), await page.evaluate((t) => window.renderStill(t), POSTER_AT))
  }
} finally {
  await browser.close()
}
