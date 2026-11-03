// Renders "How to play The Vision Test" to public/media/vision-test-tutorial.mp4, with a poster image.
// Needs the dev server running (npm run dev) and Google Chrome installed; set CHROME_PATH if it lives
// somewhere else. Usage: npm run tutorial
// To check frames without rendering the whole video: npm run tutorial -- --stills <folder> [times…]
import puppeteer from 'puppeteer-core'
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = process.env.SITE || 'http://localhost:5173'
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const media = fileURLToPath(new URL('../public/media/', import.meta.url))
const stillsAt = process.argv.indexOf('--stills')
const FILE = 'vision-test-tutorial'
// The poster: a first-time pass lined up, with its label.
const POSTER_AT = 89.0

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: mkdtempSync(join(tmpdir(), 'vfa-tutorial-')),
  args: ['--no-first-run', '--ignore-gpu-blocklist'],
  protocolTimeout: 30 * 60 * 1000,
})
const save = (file, dataUrl) => writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('page error:', e.message))
  page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && console.error('console:', m.text()))
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`${site}/tutorial/`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.tutorialReady, { timeout: 60000 })
  if (stillsAt > -1) {
    const out = process.argv[stillsAt + 1]
    const times = process.argv.slice(stillsAt + 2).map(Number)
    mkdirSync(out, { recursive: true })
    for (const t of times.length ? times : [2, 8, 15, 25, 34, 43, 53, 62, 72, 81, 90, 102, 111, 121, 131, 140, 149, 157]) {
      save(join(out, `t-${String(t.toFixed(1)).padStart(5, '0')}.jpg`), await page.evaluate((t) => window.renderStill(t), t))
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
    const { bytes, sounds } = await page.evaluate(() => window.renderTutorial(2.6e6))
    console.log(`${(bytes / 1e6).toFixed(1)} MB in ${Math.round((Date.now() - started) / 1000)} s, ${sounds} game sounds`)
    save(join(media, `${FILE}.jpg`), await page.evaluate((t) => window.renderStill(t), POSTER_AT))
  }
} finally {
  await browser.close()
}
