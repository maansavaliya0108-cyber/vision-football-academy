// Captures the share image (public/og.png, 1200 × 630): the opening film's brand card, the moment
// VISION has landed under the floodlights, so link previews on WhatsApp, Instagram and X look like
// a title card from the film.
// Needs the dev server running (npm run dev) and Google Chrome installed; set CHROME_PATH if it
// lives somewhere else. Usage: npm run og
import puppeteer from 'puppeteer-core'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const url = process.env.SITE || 'http://localhost:5173/'
const out = fileURLToPath(new URL('../public/og.png', import.meta.url))
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// Milliseconds into the film: the brand and both lines beneath it are in, the lights still on.
const BRAND_MOMENT = 6890

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: mkdtempSync(join(tmpdir(), 'vfa-og-')),
  args: ['--no-first-run', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
  await page.goto(`${url}?film`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.film', { timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  // Hold every animation of the film at the brand moment. The light streak runs on its own clock,
  // so it's left out for a clean card.
  await page.evaluate((moment) => {
    document.querySelector('.film__canvas').style.display = 'none'
    document.querySelector('.film__skip').style.display = 'none'
    for (const a of document.getAnimations()) {
      a.pause()
      a.currentTime = moment
    }
  }, BRAND_MOMENT)
  await page.addStyleTag({ content: 'body::after { display: none; }' })
  await new Promise((r) => setTimeout(r, 300))
  await page.screenshot({ path: out })
  console.log(`public/og.png captured from ${url}?film`)
} finally {
  await browser.close()
}
