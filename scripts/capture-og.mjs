// Captures the share image (public/og.png, 1200 × 630) from the real 3D hero, so link previews on
// WhatsApp, Instagram and X show exactly what the site looks like.
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

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: mkdtempSync(join(tmpdir(), 'vfa-og-')),
  args: ['--no-first-run', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.waitForSelector('.story__stage.is-ready', { timeout: 30000 })
  // Keep the logo, the ball and the headline; drop the interface around them.
  await page.addStyleTag({
    content: `
      .nav__links, .nav__actions, .hero__intro, .story__cue, .quickbar { display: none !important; }
      .hero { justify-content: flex-end !important; padding-bottom: 2.5rem !important; }
      .hero__title { font-size: 7.4rem !important; }
      body::after { display: none; }
    `,
  })
  await new Promise((r) => setTimeout(r, 4000)) // let the opening camera move settle
  await page.screenshot({ path: out })
  console.log(`public/og.png captured from ${url}`)
} finally {
  await browser.close()
}
