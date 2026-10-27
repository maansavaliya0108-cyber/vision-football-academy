# Vision Football Academy website

Website and enquiry system for Vision Football Academy, Boghara School Ground, Adajan, Surat.

- **Front end:** React 19, Three.js through React Three Fiber, smooth scrolling with Lenis
- **Back end:** Express 5 API with Node's built-in SQLite (no database server to install)
- **Staff dashboard** at `/admin` for following up on enquiries

**Live preview:** https://maansavaliya0108-cyber.github.io/vision-football-academy/ (the static GitHub Pages version; see [Publish on GitHub Pages](#publish-on-github-pages) for how it differs).

## Pages

| Address | What's there |
| --- | --- |
| `/` | The scroll story, then a tour of the whole academy (sections below) |
| `/programs` | All five programs side by side, with who each is for, the format and what sessions work on, plus help choosing |
| `/programs/recreational`, `/academy`, `/personal`, `/goalkeeping`, `/international` | One page per program: facts, focus, the four-part method, the match pathway (squads and immersion), links to the neighbouring programs, and the enquiry form with that program already chosen |
| `/method` | Cerebral Player Development: rigid drills compared with guided self-discovery, the objective, the four areas, the pathway and the reviews |
| `/visit` | Timings, the ground and map, questions parents ask and the enquiry form |
| `/admin` | Staff dashboard (server version only) |

Each page has its own title, description, canonical link and share preview, written into the HTML by the server (or the static build) so search engines and WhatsApp see them without running JavaScript. The list lives in [`shared/pages.js`](shared/pages.js).

## The home page

| Section | What it does |
| --- | --- |
| Opening scroll story | A short film you scroll through, made of 26,000 particles of light (16,000 on phones). They pour in and form a spinning football (which scatters from your cursor). The camera dives into the ball as it bursts with a shockwave, then pulls back as the cloud builds the word THINK. letter by letter. The word melts into ribbons that draw the pitch, then the camera cranes up for the tactical picture: the pressed player, the blocked passes, the open one. It drops to the turf and rides alongside the pass in slow motion as a light sweeps the pitch, then pulls back while everything locks into the VISION wordmark with a flash. Particles leave light trails while they move, and out-of-focus points blur like a camera lens. The headlines rise in word by word. |
| Every session covers four things | Technical, Physical, Tactical and Mental, laid out as the four quarters of a pitch |
| Five ways to train | The five programs as a team sheet. "Enquire about…" pre-fills the form. |
| Match time is the measure | The pathway from training ground to state scouts |
| What Surat families say | Google and Justdial ratings plus the themes that come up in reviews |
| Timings and ground | Weekly timings with a live "Training now / Next session" badge (always in IST), map, directions, call and WhatsApp |
| Questions parents ask | Six answers built only from confirmed facts, also published as FAQ structured data for search engines |
| Join the academy | Enquiry form. Saves to the database and gives the parent a reference such as `VFA-7KQ2M`. |

On phones, a Call / WhatsApp / Join bar stays at the bottom of the screen once the hero has scrolled away, and the programs become an accordion.

## Run it locally

Needs Node.js 22.13 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. The API runs on port 4387 and Vite proxies `/api` to it.

In Claude Code, a SessionStart hook (`.claude/settings.json`) starts the dev server automatically whenever a chat opens in this folder, if it isn't already running. Its output goes to `.claude/dev-server.log`. If the server is already running, `npm run dev` says so and exits instead of starting a second copy. To watch the log of a server that's already running in the background (starting it first if needed):

```bash
npm run dev:follow
```

To stop it, however it was started:

```bash
npm run dev:stop
```

Settings live in `.env` (copy `.env.example` to start). The dashboard at http://localhost:5173/admin uses `ADMIN_PASSWORD` from that file.

## Run it in production

```bash
npm run build
```

```bash
npm start
```

This one Node process serves the built site and the API on `PORT` (default 8787). Before going live:

1. Set `SITE_URL` to the public address (for example `https://visionfootballacademy.in`). It is used for the canonical link, the share image, robots.txt and sitemap.xml.
2. Set a strong `ADMIN_PASSWORD` and a long random `SESSION_SECRET`.
3. Run it behind HTTPS (the admin cookie is marked `Secure` in production). If a reverse proxy sits in front, set `TRUST_PROXY=1`.
4. Put `data/` (the SQLite database) on a persistent disk and back it up. Serverless hosts with throwaway filesystems will lose enquiries, so use a VPS, Render, Railway or Fly.io with a volume.
5. Optional: set `ENQUIRY_WEBHOOK_URL` to a Slack, Discord, Make or Zapier webhook to get pinged for every new enquiry.

## Publish on GitHub Pages

GitHub Pages only hosts static files, so there's a static build of the same site:

```bash
npm run build:pages
```

Every push to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml), which builds this and publishes it. In the static version:

- **Enquiries go to WhatsApp.** The form checks the details as usual, then opens WhatsApp to +91 90335 13330 with a message already written out. Nothing is stored, and there's no dashboard (`/admin` explains this).
- **Every page is its own HTML file** (`programs/academy/index.html` and so on), each with its own title and share preview. There's also a `404.html`, a sitemap and robots.txt.
- **The address includes the repository name.** If you rename the repository or add a custom domain, change `VITE_BASE` and `SITE_URL` in the `build:pages` script in `package.json`.

For the full version with stored enquiries and the dashboard, run the server as described above.

## Editing the content

Everything the site says about the academy is in [`shared/academy.js`](shared/academy.js): phone, address, timings, ratings, philosophy, programs and pathway. The page and the server's form validation both read from it, so a program you add there appears in the program list, the form dropdown and the dashboard.

The particle formations (ball, the word, pitch, the play, wordmark) are built in [`src/three/shapes.js`](src/three/shapes.js); when each one appears as you scroll is set in [`src/three/timeline.js`](src/three/timeline.js). The camera's shots are the `SHOTS` list in [`src/three/ParticleCanvas.jsx`](src/three/ParticleCanvas.jsx), and the timed moments (the burst, the slow-motion pass, the landing) are in [`src/three/director.js`](src/three/director.js). On slower devices the scene steps itself down (fewer light trails, then no glow); with reduced motion turned on there are no trails, shakes or camera dives.

The share image (`public/og.png`, shown when the link is posted on WhatsApp, Instagram or X) is a capture of the live hero. With the dev server running and Google Chrome installed:

```bash
npm run og
```

The app icons are generated from SVG:

```bash
npm run images
```

The typeface is Archivo, served from `public/fonts` (one variable file per character set, covering every weight and width), so the site makes no requests to Google Fonts.

## Audits

[`AUDIT.md`](AUDIT.md) records the five audits run before publishing (function, accessibility, performance, search and sharing, security and code health), what each found and what was fixed.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/academy` | The content from `shared/academy.js` |
| `GET` | `/api/status` | Whether training is on right now (IST) |
| `POST` | `/api/enquiries` | Validated with zod. Rate-limited to 5 per 15 minutes per IP. Includes a honeypot field. |
| `POST` | `/api/admin/login` | Sets a signed, HTTP-only session cookie (12 hours) |
| `GET` | `/api/admin/enquiries` | `?status=` and `?q=` filters, plus summary stats |
| `PATCH` | `/api/admin/enquiries/:id` | Update `status` (`new`, `contacted`, `trial`, `enrolled`, `closed`) or `notes` |
| `GET` | `/api/admin/enquiries.csv` | Spreadsheet export, with formula injection blocked |

## Before launch

- **Logo.** The mark in `src/site/Logo.jsx`, `public/favicon.svg`, the particle wordmark (`src/three/shapes.js`) and `scripts/make-images.mjs` is a placeholder. Swap in the academy's crest, then run `npm run images` and `npm run og`.
- **Photos.** Real photos from training at Boghara School Ground would be a strong addition next to the 3D.
- **Fees, age groups, coach names.** These weren't in the brief, so the site doesn't state any.
