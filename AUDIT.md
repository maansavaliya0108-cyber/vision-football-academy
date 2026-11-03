# Site audit

Five audits were run on 26–27 October 2026 before publishing. Each one was automated (headless Chrome driven by Puppeteer, plus axe-core and Lighthouse) and run against the production build, then run again after the fixes. The live site was checked again after publishing, which turned up one more problem: big headings running off narrow phone screens (see [After publishing](#after-publishing-the-live-site)). Everything below reflects the final state.

| # | Audit | Result |
| --- | --- | --- |
| 1 | Function: every page, link, journey and form | 18 of 18 checks pass on the server build; 13 of 13 on the GitHub Pages build |
| 2 | Accessibility | 0 axe violations (WCAG 2.2 AA and best practice) on 8 routes at desktop and phone size |
| 3 | Performance | Lighthouse 96–100; the 3D scene holds 60 fps |
| 4 | Search, sharing and content | Every page has a unique title, description, canonical link and share preview; no issues left |
| 5 | Security and code health | 44 of 44 attack probes handled; `npm audit` finds 0 vulnerabilities |

## 1. Function

**What was checked.** 11 addresses (the 9 pages, `/admin` and an unknown address), each at three sizes (1440 px desktop, 768 px tablet, 375 px phone):

- Exactly one `h1` and a page title.
- No sideways scrolling.
- No broken internal links or missing `#anchors`.
- New-tab links carry `rel="noopener"`.
- Images have alt text and buttons have names.
- No console errors or failed requests.

Then the journeys a parent would take:

- Navigation from the nav bar, a program row, the next-program link and the logo; the browser back button.
- "Join" from a page without a form lands on the form on `/visit`.
- The enquiry form:
  - An empty submit shows 6 field errors and moves focus to the first one.
  - A valid submit is saved with a `VFA-` reference.
- "Enquire about" pre-selects the program, and the arrow keys move between program tabs.
- On phones, the program accordion and the quick contact bar.
- The staff dashboard: sign in, the new enquiry is listed, the CSV export downloads, and sign-out ends the session.

**GitHub Pages build.** Served the way GitHub Pages serves a project site: under `/vision-football-academy/`, with folder redirects and `404.html`. Checks:

- Each page loads from a pasted link with the right title, canonical link and font.
- All 17 internal link targets return 200, and no link escapes the base path.
- The 3D canvas mounts.
- Client-side navigation and back work.
- An unknown address returns a real 404 with the not-found page.
- `/admin` shows the static notice.
- The enquiry form opens WhatsApp to +91 90335 13330 with the player's details written out.
- The manifest icons resolve.

**Fixed:**

- "Join" from another page sometimes stopped short of the form. The new page hadn't rendered yet, and the smooth scroller still had the old page height. Navigation now waits for the target and re-measures before scrolling.

## 2. Accessibility

**What was checked:**

- axe-core with the WCAG 2.0/2.1/2.2 A and AA rules plus best practice. Each page was scrolled first so lazy sections and entrance animations had finished and contrast was measured on final colours.
- Keyboard: the first Tab reaches the skip link, and 40 tab stops per page each show a visible focus ring.
- Reduced motion: the headline is visible straight away, and the marquee stops.
- 200% zoom (a 640 px viewport): every page reflows without sideways scrolling.

**Fixed:**

- The logo link's accessible name didn't match its visible text. The label was removed and a real space added between "Vision" and "Football Academy".
- A decorative arrow on each program row was a second, unlabelled link to the same page. It's now decoration only; the program name is the link.
- The Google map had no visible focus ring when tabbed into. Its frame now draws one.
- The "Today" badge in the timings table ran into the day name for screen readers ("TuesdayToday"). A space now separates them.

## 3. Performance

Lighthouse on the production build (Node server with compression):

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home, phone | 96–97 | 100 | 100 | 100 |
| Method, phone | 99 | 100 | 100 | 100 |
| Visit, phone | 99 | 100 | 100 | 100 |
| Home, desktop | 100 | 100 | 100 | 100 |
| Programs, desktop | 100 | 100 | 100 | 100 |

Home on a phone: first paint 1.4 s, largest paint 2.1 s, total blocking time 170–180 ms, layout shift 0.

3D frame rate (desktop, scrolling through the whole story): median frame 16.7 ms, worst 16.8 ms, 0 frames over 33 ms. That's a steady 60 fps. A frame-time watchdog switches off the glow effects on devices that can't keep up.

**Fixed.** The home page started at 46 on phones, with 2,640 ms of blocking time. The changes:

- **Fonts:** self-hosted instead of loading from Google Fonts, which had been blocking the first paint.
- **Pages:** the light pages are bundled with the app, so there's no second round trip before content.
- **3D scene:**
  - It loads once the browser is idle, after the headline is on screen.
  - The glow effects are a separate download, desktop only.
  - The particle shapes are built in small steps so the page stays responsive.
  - An unused 3D helper library was removed.
- **Server:** responses are compressed.

Download sizes (before compression):

- App: 295 KB.
- Stylesheet: 40 KB.
- 3D engine: 927 KB, loaded after first paint.
- Glow effects: 85 KB, desktop only.

## 4. Search, sharing and content

**What was checked**, on every page:

- A unique title and description.
- A canonical link and `og:url` pointing at the page itself.
- An absolute share image.
- No unfilled placeholders.
- Valid JSON-LD structured data.
- Headings that never skip a level.

Also:

- The share image is reachable at 1200 × 630.
- The sitemap lists all 9 pages.
- robots.txt points to the sitemap and keeps `/admin` out.
- The visible copy of every page was read through against the academy's confirmed facts.

**Fixed:**

- Seven descriptions were 195–229 characters and would be cut off in search results. All are now under 160.
- The International Immersion page said "When: Monday to Friday, 6 to 9 PM" as if the overseas program itself ran on weekday evenings. It now says "Squad training, Monday to Friday, 6 to 9 PM".
- The programs page said "Every program trains at Boghara School Ground". It now says all weekday training is there.
- GitHub Pages redirects `/programs` to `/programs/`, so the static build's canonical links and sitemap now use the trailing slash and never point at a redirect.
- The share image was recaptured from the final hero.

## 5. Security and code health

**Probes run against the production server:**

- **Headers:**
  - Content Security Policy: scripts only from the site itself, no inline or eval, no framing by other sites.
  - `nosniff`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` are set; there's no `X-Powered-By`.
  - Responses are compressed, and fingerprinted assets are cached as immutable.
- **Private files:** none of these can be fetched, including with encoded `../`: `.env`, `package.json`, server code, the database, `.git`, `/etc/passwd`.
- **Forged Host header:** never written into pages or the sitemap.
- **Enquiry API:**
  - Malformed JSON gets a 400, and a 30 KB body a 413.
  - Each invalid field gets its own 422 message, and objects or arrays in place of text are rejected.
  - Honeypot (bot) submissions are silently dropped.
  - The 6th enquiry in 15 minutes from one address gets a 429 with `Retry-After`.
  - HTML and spreadsheet-formula text is stored as plain text, shown escaped, and neutralised in the CSV export.
- **Dashboard:**
  - Every admin endpoint needs a session.
  - A forged cookie, or a real cookie with its expiry extended, is refused.
  - The session cookie is `HttpOnly`, `SameSite=Strict`, `Secure` and limited to `/api/admin`.
  - SQL-looking search text matches nothing, because queries are parameterised.
  - Bad status values and IDs are rejected, and form-style cross-site bodies aren't parsed.
  - Sign-out clears the cookie.
  - Repeated wrong passwords are rate limited.

**Code health:**

- `npm audit`: 0 vulnerabilities.
- No unused source files.
- No secrets in the repository: `.env` and `data/` are ignored by git, and `.env.example` holds placeholders only.

**Fixed:**

- A request body over 20 KB returned a 500 server error. It now gets a clear 413.
- Without `SITE_URL` set, the server built page links from the request's Host header as-is. It now only accepts a plain host name.
- The dashboard would have switched on with the example password `change-me`. It now stays off until a password of at least 8 characters is set.
- Removed an unused animation library (`motion`).

## After publishing: the live site

The GitHub Pages site was checked again once it was live. The static-build function checks above all passed on the real address.

Lighthouse on the live site:

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home, phone | 85–96 | 100 | 100 | 100 |
| Program page, phone | 98 | 100 | 100 | 100 |
| Visit, phone | 99 | 100 | 100 | 100 |
| Home, desktop | 99 | 100 | 100 | 100 |

The phone home page varies with GitHub's CDN: the first, uncached load paints in about 2 s, a cached one in 0.8 s.

**Found and fixed: big headings ran off narrow phone screens.** A screenshot of the live site showed "GOALKEEPING" cut off at the right edge on a phone. A stricter check then found more cases:

- **Page titles:** "RECREATIONAL", "INTERNATIONAL" and "DEVELOPMENT" are single words wider than a 320–414 px screen at the title size. They dragged the intro text and buttons past the edge too.
- **"Problems, not instructions":** on phones up to about 420 px, "INSTRUCTIONS" is wider than the screen. The phone then laid the whole page out wider, which pushed the menu button off-screen on the Method page.
- **The four method cards:** their names didn't fit at tablet and 320 px widths.
- **The open program on the home page** at 320 px.
- **The staff sign-in card** at 320 px.
- **The nav and quick contact bar's "Join the academy" buttons** didn't fit at 320 px.

The fixes:

- **Big headings:** they now know how wide their widest word is in this typeface. The width comes from a measured table of letter widths that slightly over-estimates, so it's on the safe side. Each heading's size is capped so that word fits its column. Desktop sizes are unchanged.
- **Grid columns** can now shrink below their content.
- **On phones under 375 px,** the nav and quick bar buttons say "Join".

**Why the earlier checks missed it.** They compared page width with the window width, and a phone widens its layout to fit oversized content, so both grew together. The page also clips sideways overflow, so nothing ever scrolled. The overflow check now:

- Compares against the real screen width.
- Measures each heading's letters as well as its box.
- Reports cut-off text.
- Flags a widened layout.

It runs on every page at 11 widths from 320 to 1440 px. Run against the earlier live version, it flags the clipped titles; on the fixed version it finds nothing.

## Marketing pass: facts only

The site was rewritten to sell, not just inform. One rule held throughout: **every claim is a confirmed fact from `shared/academy.js`.** The academy is never called the best. The case is made by proof:

- The 5.0 ratings on Google (53+ reviews) and Justdial.
- The method.
- The four areas in every session.
- The pathway to district trials and state scouts.
- The program range.
- What parents' reviews keep saying.

**What changed:**

- **Home:** a proof bar straight after the story, then "Why families choose Vision" (six reasons). "Book a visit" closes the persuasive sections.
- **Calls to action:** one low-commitment step everywhere, "Book a visit".
- **The form:** only name, age, mobile and program are required; the rest is optional. The rating sits beside it, with a reassurance line under the button.
- **Copy and meta:** page titles and descriptions lead with the rating, and a new FAQ answers "What makes the coaching different?".
- **Share image:** now the film's brand card.

**Checks:**

- **Claim words:** all site copy was searched for words that would need proof the academy hasn't given (best, top-rated, leading, number one, free, certified, licensed, guarantee, expert, world-class, state-of-the-art). The only hits were "pressure-free" and "kept free for tournaments".
- **The booking flow:**
  - An empty submit flags only the essentials.
  - A mistake inside the optional details opens them and focuses the field.
  - An essentials-only booking is saved with a reference.
  - The dashboard shows experience as "Not given".
- **The full regression pass** still runs clean at three sizes: one h1 per page, never wider than the screen, 0 axe violations, and the 320 px menu and booking buttons work.

## The promo film and The Vision Test

Checked on a production build before publishing.

**The promo film:**

- Both cuts decode in Chrome: 33.6 s, 1920 × 1080 and 1080 × 1920, H.264 video with an AAC audio track.
- Frames sampled from the encoded files match the design.
- The server streams them in chunks (HTTP 206), so playback starts without downloading the whole file.
- **The player** passes 10 of 10 checks:
  - The hero, footer and teaser all open it.
  - It plays with sound after a tap.
  - Escape and Close both work.
  - A `?film` link opens it muted, and the 8-second opener doesn't play over it.
  - Phones held upright get the 9:16 cut.

**The game:**

- **A bot that scans and watches the ball in** completes 13–14 of 15 passes in a match.
- **A bot that never checks its shoulders** completes none (7 intercepted, 8 tackled). So the game rewards scanning.
- **Passes to a visible teammate always arrive.** An early version led runners for the whole flight even when their run had ended; that was fixed.
- **On production** (smoke test): the clock runs, the pitch takes keyboard focus, results show after 60 seconds, and the WhatsApp share carries the score and a link back.
- **Accessibility:** 0 axe violations on `/play` at desktop and phone size. (Fixed: the scoreboard had been hidden from screen readers while containing the focusable Sound button.)

**Layout and speed:**

- Nothing overflows on any page at 11 widths from 320 to 1440 px, including the nav with its new Play link.
- Lighthouse: home 98 on phones and 100 on desktop, `/play` 98 on phones. Accessibility, best practices and SEO are 100.

## The advanced game and its tutorial

Checked on a production build before publishing.

**The game, played by bots** (six full matches each, through the engine's manual mode):

| Bot | Passes completed | Level reached | Score |
| --- | --- | --- | --- |
| Checks both shoulders | 12.8 of 14.7 | 5 | 3,446 |
| Plays first time | 11.2 of 15.2, all first time | 4.3 | 3,552 |
| Never checks | 5.7 of 13.8 (tackled 3.8, heavy touch on 13.5) | 2.7 | 845 |

In practice at levels 4 and 5, the scanning bot completes about 80%, while the bot that never checks completes about 5% and is tackled on almost every ball. So scanning decides the result at every level.

- **Fixed: watching the ball in never counted.** The ball counted as seen once it was within 2.2 m of you, so a heavy touch could never happen; this was also true in the first version. Now only actually looking at the ball counts.
- **Fixed: two messages overlapped.** "No time: you did not see the press" printed on top of "Tackled".
- **The game page passes 12 of 12 checks:**
  - The five named levels can be practised.
  - Practice shows its HUD and End practice, and ending it shows the results, vision map and coach's note.
  - A full one-minute match climbs levels and ends with score, rating, level reached, the WhatsApp share and best score.
  - Each tutorial chapter button plays the video from that chapter.
  - On a 390 px phone the start screen begins with Start the match and nothing is wider than the screen.
  - There are no page errors.

**The tutorial video:**

- The file decodes in Chrome: 160.1 s, 1920 × 1080, H.264 with an AAC track carrying the game's own sounds (93 of them) over a soft music bed.
- Frames sampled every 5 seconds from the encoded file show each chapter's rule happening, as listed.

**Layout, accessibility and speed:**

- Nothing overflows on any page at 11 widths.
- 0 axe violations on `/play`, at desktop and phone size, on the start screen, while practising, and on the results screen.
- Lighthouse on `/play`: 96 on phones and 100 on desktop. Accessibility, best practices and SEO are 100.

## The 3D graphics

The game is now drawn in 3D (`src/game/stage3d.js`): a night pitch lit only inside your vision cone, animated players in kit, hologram memories, and glow and particle effects. Checked before publishing.

- **The rules did not change.** The same bots, six matches each, score exactly as before: 3,446, 3,552 and 845. The game page still passes 12 of 12 checks.
- **Clicks land on the right player.** A real mouse click on a teammate in the 3D view passed to them, 3 times out of 3.
- **Speed while playing:** a steady 60 frames a second in Chrome on an Apple M4 Mac:
  - at desktop size (1342 × 666 at 2× pixels), on the top quality;
  - at phone size (353 × 641 at 3×), on the phone quality.

  The game steps its quality down by itself if frames run slow.
- **Fixed: the 3D slowed the page's first load.** Loading it as soon as the pitch was near the screen dropped Lighthouse on phones to 68, with 760 ms of blocking. It now loads at the visitor's first scroll, touch, key or mouse move. Lighthouse on `/play` is back to 96 on phones and 100 on desktop, with no blocking time, and 100 for accessibility, best practices and SEO.
- **Without WebGL** the game falls back to the flat drawing, which still renders.
- **Layout and accessibility:**
  - nothing overflows at 11 widths;
  - 0 axe violations on `/play` at desktop and phone size, on the start screen, while practising and on the results.
- **The tutorial video was re-rendered with the new look.** It decodes as 160.1 s, 1920 × 1080, with the game's sounds.
  - It is 53.7 MB, up from 35 MB, even after lowering the bitrate from 3.5 to 2.6 Mbit/s. The video streams, so visitors only download what they watch.
  - Fixed: labels overlapped in two chapters.
  - Fixed: the last chapter ended on a tackle; it now ends on a completed pass.

## Not covered

- Real devices: iPhone Safari and Android Chrome, including how the 3D game runs on their graphics chips. Testing used desktop Chrome, with phone sizes emulated.
- A walkthrough with a screen reader (VoiceOver or TalkBack). The automated checks cover names, roles, focus and contrast, but not how the pages sound read aloud.
- Security headers on GitHub Pages. GitHub's own hosting doesn't send the headers listed in audit 5; those apply when the site runs on its own Node server.
