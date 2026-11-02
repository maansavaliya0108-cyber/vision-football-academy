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
| `/play` | The Vision Test, a one-minute football scanning game (see below) |
| `/admin` | Staff dashboard (server version only) |

Each page has its own title, description, canonical link and share preview, written into the HTML by the server (or the static build) so search engines and WhatsApp see them without running JavaScript. The list lives in [`shared/pages.js`](shared/pages.js).

## The home page

The home page is built like a pitch, ending in one low-commitment step: **Book a visit**. Every claim on it is a confirmed fact from `shared/academy.js`. It implies the academy is the one to choose through proof (ratings, the method, the pathway), never by calling itself the best.

| Section | What it does |
| --- | --- |
| Opening scroll story | A short film you scroll through, made of 26,000 particles of light (16,000 on phones). They pour in and form a spinning football (which scatters from your cursor). The camera dives into the ball as it bursts with a shockwave, then pulls back as the cloud builds the word THINK. letter by letter. The word melts into ribbons that draw the pitch, then the camera cranes up for the tactical picture: the pressed player, the blocked passes, the open one. It drops to the turf and rides alongside the pass in slow motion as a light sweeps the pitch, then pulls back while everything locks into the VISION wordmark with a flash. Particles leave light trails while they move, and out-of-focus points blur like a camera lens. The headlines rise in word by word. |
| At a glance | The proof, straight after the story: 5.0 on Google (53+ reviews), 5.0 on Justdial, five evenings a week, five programs, four areas in every session |
| Why families choose Vision | Six reasons, each one a confirmed fact (the method, the four areas, the match pathway, the program range, confidence for every player, International Immersion), closing with Book a visit or call |
| Every session covers four things | Technical, Physical, Tactical and Mental, laid out as the four quarters of a pitch |
| Five ways to train | The five programs as a team sheet. "Enquire about…" pre-fills the form. |
| Match time is the measure | The pathway from training ground to state scouts, closing with Book a visit |
| What Surat families say | Google and Justdial ratings plus the themes that come up in reviews, closing with Book a visit |
| Timings and ground | Weekly timings with a live "Training now / Next session" badge (always in IST), map, directions, call and WhatsApp |
| Questions parents ask | Seven answers built only from confirmed facts (including what makes the coaching different), also published as FAQ structured data for search engines |
| Book a visit | The booking form, with the Google rating beside it. Only four things are required (name, age, mobile, program); everything else sits under "Add details (optional)". It saves to the database and gives the parent a reference such as `VFA-7KQ2M`. |

On phones, a Call / WhatsApp / Book a visit bar stays at the bottom of the screen once the hero has scrolled away, and the programs become an accordion.

### The opening film

An eight-second intro, cut like a sports-brand ad, opens the site on a first visit:

1. **The open:** two stadium floodlight banks flicker on in the dark, inside letterbox bars.
2. **The cards** cut in one after another:
   - 01 The method: "They don't wait for the shout."
   - 02 The edge: "They see it first." A streak of light whips across.
   - 03 The verdict: 5.0 and five stars, rated by Surat families, 53+ reviews on Google.
   - 04 The pathway: training ground, district trials, state scouts.
3. **The brand:** VISION, Football Academy, Adajan, Surat. Beneath it: Monday to Friday, 6 to 9 PM, outdoor turf.
4. **The handover:** the streak spirals into the spot where the 3D ball forms, the bars retract, the particles fly in, and the headline settles into focus.

Every line comes from `shared/academy.js`; there are no claims beyond the academy's confirmed facts.

- **When it plays:** once per visitor, remembered in the browser. Never for links to a section such as `/#join` or a shared `?film` link, never when arriving from another page, and never when the device is set to reduce motion.
- **Skipping:** the Skip intro button, any key, a click, or a scroll.

It lives in [`src/site/Opener.jsx`](src/site/Opener.jsx) (timing, the light streaks) and the "The film" section of [`src/styles/site.css`](src/styles/site.css) (cards, lights, letterbox). The two share one clock, so change their timings together.

### The promo film (33 seconds)

A real video file, for the site and for posting: [`public/media/vision-promo-16x9.mp4`](public/media/vision-promo-16x9.mp4) (1920 × 1080, for the site and YouTube) and [`public/media/vision-promo-9x16.mp4`](public/media/vision-promo-9x16.mp4) (1080 × 1920, for Instagram Reels and WhatsApp Status). It is cut from the same particle scene as the site, with title cards and sound design:

1. Floodlights snap on: "Every weekday. 6 PM."
2. The ball of light forms: "Where players learn to think."
3. It bursts, and the particles build "THINK.": "Coaches set the problem. Players find the answer."
4. The pitch draws itself: "See the pressure before the ball arrives."
5. The pass in slow motion: "Think one pass ahead."
6. Rapid cuts of the four areas: Technical, Physical, Tactical and Mental.
7. The verdict: 5.0, rated by Surat families.
8. The pathway: training ground, district trials, youth cups, state scouts.
9. The VISION wordmark lands, then Book a visit, the phone number, and Mon–Fri · 6–9 PM · Boghara School Ground.

Every line comes from `shared/academy.js`. The sound is synthesized (impacts, whooshes, risers and a low drone), so there's no music licence to worry about.

- **On the site:** **Watch the film** in the hero, the film section on the home page, and **Watch the film** in every page footer all open it in a full-screen player. It plays with sound, and phones held upright get the 9:16 cut. The player has Book a visit and download links for both cuts.
- **Sharing:** add `?film` to any address, for example `https://maansavaliya0108-cyber.github.io/vision-football-academy/?film`, and the page opens straight into the film. Browsers start it muted until the viewer taps for sound.
- **Changing it:** the film is rendered from [`promo/main.js`](promo/main.js) (the timeline, camera, cards and soundtrack). With the dev server running:

```bash
npm run promo
```

That renders both cuts and their posters into `public/media` in about 15 seconds, using Chrome's own video encoder. To check frames without rendering the whole film, use `npm run promo -- --stills <folder>`.

### The Vision Test (the game)

A one-minute football scanning game at `/play`, built on the academy's own method: "see the pressure before the ball arrives" and "think one pass ahead".

To reach it: **Play the game** in the top menu, the **Play the game** button under **Watch the film** on the home page's first screen, the game section further down the home page, and **Play the game** in every page footer.

You are the pivot in the centre circle, seen from above, and **you only see what you look at**. Everything outside your vision cone is dark.

- **The ball comes from behind,** and a presser closes in from your blind side, so you have to check your shoulders.
- **Watch it in:** look at the ball just before it arrives, or your first touch is heavy and you lose a moment.
- **Memory ghosts:** what you look away from stays as a dashed outline where you last saw it. Ghosts fade and go stale, because players keep moving.
- **Awareness buys time:** spot every presser before the ball arrives and time slows as it reaches you. Miss one and there is no slow motion.
- **Passing:**
  - Pass to the open teammate before you're tackled.
  - A pass into a covered lane is intercepted, and a pass to an out-of-date memory goes to empty grass.
  - **First-time passes:** choose your pass while the ball is still coming (a dashed ring lines it up). If you watched the ball in, you play it first time for 60 extra points.

**Five levels,** named after the academy's pathway. A match climbs one every three completed passes:

| Level | Name | What it adds |
| --- | --- | --- |
| 1 | Training ground | Three runners ahead and one presser behind |
| 2 | Match time | The cover can switch lanes after the ball is played |
| 3 | District trials | Four runners, and traffic in midfield |
| 4 | Youth cups and leagues | A second presser, from your other side |
| 5 | State scouts | Quicker pressers, and memories fade sooner |

**Two modes:** a one-minute **match** (scored, climbing levels, your best remembered on the device) and **practice** (pick any level, no clock, coaching tips as you play, End practice when you're done).

**Scoring:** 100 for a completed pass, up to 60 for a quick decision, 15 for each shoulder check before the ball (up to 4), 20 for spotting every presser, 60 for a first-time pass, and ×1.1 for each pass in a row (up to ×2.0). The result shows a Vision score, a rating (Head down, Checking, Scanning, One pass ahead), the level reached, eight stats (including first-time passes, interceptions, tackles and passes to old memories), a **vision map** of where you looked, and a **coach's note** on what to work on next. It can be shared on WhatsApp, and closes with Book a visit.

**Controls:**

| Device | Look around | Pass |
| --- | --- | --- |
| Desktop | Move the mouse | Click a teammate |
| Phone | Drag a finger | Tap a teammate (one thumb looks, the other passes) |
| Keyboard | ← and → | 1–4 or Space |

**Fair at every level:** bots play full matches through the engine's manual mode. A bot that checks both shoulders completes about 87% of its passes and reaches level 5. A bot that never checks gets a heavy touch on almost every ball, is tackled again and again, and completes about 40% (about 5% at levels 4 and 5).

### How to play (the tutorial video)

[`public/media/vision-test-tutorial.mp4`](public/media/vision-test-tutorial.mp4): 2 minutes 40 seconds, 1920 × 1080, with sound, in 18 chapters. Each rule is played out in the real game: the controls, the vision cone, memories, the ball and the heavy touch, passing, covered lanes, the presser and the shoulder check, stale memories, first-time passes, all five levels, scoring, the results screen and practice. Labels and an on-screen cursor show what is happening, and a panel explains each step. It sits on `/play` under the game, with a list of chapters to jump to, and **Watch how to play** on the game's start screen opens it.

It is rendered from [`tutorial/main.js`](tutorial/main.js), which drives the game engine with scripted rounds. The chapter list lives in [`src/game/tutorialChapters.js`](src/game/tutorialChapters.js), shared with the page. With the dev server running:

```bash
npm run tutorial
```

That renders the video and its poster into `public/media` in about 30 seconds. To check frames first, use `npm run tutorial -- --stills <folder>`, optionally followed by times in seconds.

The engine is [`src/game/visionTest.js`](src/game/visionTest.js): a plain canvas, with synthesized sound effects and no images or libraries. The rating and coach's note are in [`src/game/review.js`](src/game/review.js), and the page is [`src/pages/PlayPage.jsx`](src/pages/PlayPage.jsx).

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

The particle formations (ball, the word, pitch, the play, wordmark) are built in [`src/three/shapes.js`](src/three/shapes.js); when each one appears as you scroll is set in [`src/three/timeline.js`](src/three/timeline.js). The camera's shots are the `SHOTS` list in [`src/three/ParticleCanvas.jsx`](src/three/ParticleCanvas.jsx), and the timed moments (the burst, the slow-motion pass, the landing) are in [`src/three/director.js`](src/three/director.js). On slower devices the scene steps itself down (fewer light trails, then no glow); with reduced motion turned on there are no trails, shakes or camera dives. On those devices a **Full animation** switch appears under the hero buttons. It brings back the full story and is remembered for next time.

The share image (`public/og.png`, shown when the link is posted on WhatsApp, Instagram or X) is the opening film's brand card: VISION under the floodlights, with the place and timings beneath. With the dev server running and Google Chrome installed:

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
