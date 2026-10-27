// Renders the app icons into public/. Run after changing the mark: `npm run images`.
// (The share image is captured from the live hero by scripts/capture-og.mjs.)
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#060607"/>
  <g transform="translate(32 32) scale(0.78) translate(-32 -32)">
    <circle cx="32" cy="32" r="21" fill="none" stroke="#f2f2ee" stroke-width="4"/>
    <path d="M20 22 L32 44 L44 22" fill="none" stroke="#d7ff3a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`

for (const [file, width] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const png = new Resvg(icon, { fitTo: { mode: 'width', value: width } }).render().asPng()
  writeFileSync(`${root}public/${file}`, png)
  console.log(`public/${file}  ${width}px  ${(png.length / 1024).toFixed(0)} KB`)
}
