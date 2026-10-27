// Every public page, with the title and description used for the tab, search results and link
// previews. The browser, the Node server and the static (GitHub Pages) build all read this list.
import { academy } from './academy.js'

const SUFFIX = 'Vision Football Academy, Surat'

export const pages = [
  {
    path: '/',
    title: 'Vision Football Academy, Adajan, Surat',
    description:
      'Evening football coaching in Adajan, Surat: recreational, academy squads, 1-on-1, goalkeeping and international programs. Monday to Friday, 6 to 9 PM.',
  },
  {
    path: '/programs',
    title: `Programs | ${SUFFIX}`,
    description:
      'Five ways to train at Vision Football Academy: Recreational, Academy Training Squads, 1-on-1 Personal Training, Goalkeeping and International Immersion.',
  },
  ...academy.programs.map((p) => ({
    path: `/programs/${p.id}`,
    title: `${p.name} | ${SUFFIX}`,
    // Kept under ~160 characters so search results show it whole.
    description: `${p.summary} Adajan, Surat.`,
  })),
  {
    path: '/method',
    title: `The method | ${SUFFIX}`,
    description: `${academy.philosophy.name}: guided self-discovery instead of rigid drills, so players learn to read the game and make their own decisions.`,
  },
  {
    path: '/visit',
    title: `Timings, ground and joining | ${SUFFIX}`,
    description:
      'Training runs Monday to Friday, 6 to 9 PM, at Boghara School Ground, Adajan, Surat. Find the ground, read common questions and send an enquiry.',
  },
]

export const findPage = (path) => pages.find((p) => p.path === path)

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * Fills a page's title, description and absolute URLs into the HTML shell.
 * `origin` is the site's public address including any base path, with no trailing slash.
 */
export function applyPageMeta(html, page, origin) {
  const url = origin + page.path
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(page.title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeAttr(page.description)}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${escapeAttr(page.title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${escapeAttr(page.description)}$2`)
    .replaceAll('__URL__', url)
    .replaceAll('__ORIGIN__', origin)
}
