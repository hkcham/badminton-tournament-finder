# US Badminton Tournament Finder

**Live site:** https://hkcham.github.io/badminton-tournament-finder/
(source: [hkcham/badminton-tournament-finder](https://github.com/hkcham/badminton-tournament-finder))

A static website with two views of badminton **tournaments and leagues** held in the United States:

- **Tournaments** ([tournaments/index.html](tournaments/index.html), served at `/tournaments`), which can be sorted by how soon registration closes
  (soonest first by default), by distance from an address, or by prize money, and includes
  search/filter tools (including a Tournaments-only / Leagues-only filter).
- **Map** ([map/index.html](map/index.html), served at `/map`), which plots everything currently registerable on an interactive
  map of the US, color-coded by how soon its deadline is, with a synced sidebar list.

Leagues are shown alongside tournaments everywhere (a dark-green "League" badge on cards and
popups, a **square** map marker instead of a round one) rather than as a separate list, since
they're filtered, sorted, and searched the exact same way.

This is a **read-only display** of tournaments/leagues found online. There is intentionally no
"add a tournament" feature on the site itself. Every entry comes from `js/data.js`; see "Adding an
entry" below for how to add one there, and "Keeping this site current" for the automated daily
check that does this for you.

There's no build step, no server, and no database required, since it's plain HTML/CSS/JS. The map
uses [Leaflet](https://leafletjs.com/) (loaded from a CDN) with standard OpenStreetMap tiles.

## Running it

Just double-click **`tournaments/index.html`**; it opens in your browser and works immediately.
Switch to the Map tab from there, or open `map/index.html` directly. (The `index.html` in the
project root is only a redirect to `/tournaments/`.) Both pages need an internet connection (for
map tiles and address geocoding) even though there's no backend of your own.

It's already published via **GitHub Pages** at the live-site link above. That repo is what the
daily scheduled task (see "Keeping this site current" below) pushes its updates to, so the live
site refreshes automatically each day. To change the source of truth, clone that repo, edit files,
and `git push`; GitHub Pages rebuilds within a minute or two of any push to `main`.

Any other static host works too (Netlify, Vercel, Cloudflare Pages) if you'd rather move it, since
there's no backend to migrate.

## How it's organized

```
index.html             root redirect to /tournaments/ (not a real page)
tournaments/index.html tournaments list view, served at /tournaments
map/index.html         map view, served at /map
robots.txt             search-engine directives, points at the sitemap
sitemap.xml            lists /tournaments/ and /map/ for search engines
css/style.css   the green-and-white badminton-court theme, shared by both pages
img/shuttle-logo.jpg   the site logo/favicon, shown in the header on both pages
js/data.js      <-- THE TOURNAMENT DATABASE (a plain JS array; the only place entries are added or updated)
js/shared.js    logic shared by both pages: loading data, time-zone-aware date math, formatting, geocoding
js/app.js       list-view-only logic: search/sort/filter controls, rendering cards, the live countdown ticker
js/map.js       map-view-only logic: Leaflet markers/popups, the sidebar list, map filters
```

The `css`/`js` includes carry a `?v=N` cache-busting query. If you edit
`css/style.css`, `js/shared.js`, `js/app.js` or `js/map.js`, bump that number in
`tournaments/index.html` and `map/index.html` so returning visitors get the new file right away.
`js/data.js` is deliberately left unversioned, since it changes daily and the normal short cache
window is the right behaviour for it.

Both pages read the same `js/data.js` through `js/shared.js`, so they always show the same
tournaments/leagues, since there's nothing browser-specific or per-visitor about the data.

### About the map

- **Markers** are colored the same way as the list's deadline pills: green (15+ days left), amber
  (4–14 days), red (≤3 days), or gray (deadline TBD). See the legend in the map's bottom-left corner.
- **Base map**: standard OpenStreetMap tiles (no API key needed) run through a CSS grayscale filter
  so the map reads as light gray/white. CARTO's free "Positron" light basemap now requires an API
  key, so this CSS-filter approach was used instead to keep the green-and-white look without adding
  an API key dependency for anyone who reuses this site.
- **Overlapping venues** (e.g. two tournaments at the same club) are nudged apart slightly so both
  stay clickable. That's cosmetic only; real coordinates are still used for anything computed
  (like the list's distance sort).
- A tournament with no venue coordinates yet (e.g. a same-day "add a tournament" entry before its
  address has been geocoded) can't be placed on the map; it still appears in the map's sidebar list
  and in the List view, and the page notes how many were skipped.

## What's shown: only tournaments that can currently be registered for

The site never shows past tournaments and has no toggle to reveal them; a tournament disappears
automatically once either its dates or its known registration deadline has passed. For a
tournament where the source page didn't show a live registration deadline, the site treats it as
still open (showing "check tournament page" instead of a countdown) until its event dates pass, so
click through to confirm before assuming a spot is available. Historical/past entries are simply
left out of `js/data.js` rather than kept and hidden, so the file only ever describes currently
relevant tournaments.

## Scope: all US badminton tournaments, not just one circuit

This site is **not** limited to USA Badminton's sanctioned circuit or to tournaments listed on
TournamentSoftware. It intentionally mixes tournaments found across different kinds of sources,
because that's genuinely where US badminton tournaments live:

| Type | Example in `js/data.js` | Found via |
|---|---|---|
| USAB-sanctioned Local/Regional/National Championships | `2026 YONEX Arena SoCal Open Regional Championships` | usabadminton.org → TournamentSoftware |
| Club-hosted opens found via TournamentSoftware's own national search (not individually posted on usabadminton.org) | `2026 Golden Bear LXXII`, `2026 NVBC Open Championship`, `Fortius Atlanta Badminton Open`, and ~25 more | tournamentsoftware.com/find (filtered to SportID=2/badminton, USA) |
| BWF-sanctioned international events held in the US | `Arise International Challenge 2026`, `LA Open 2026` | same TournamentSoftware search |
| Independent club-run open tournaments (not USAB-sanctioned) | `2026 CBA Team Tournament` | the club's own website |
| Community/association open tournaments | `2026 Lunar New Year Badminton Open Tournament` (Houston, $12K+ in prizes) | Facebook + the organizing association's website |
| College club / intramural tournaments | `University of Delaware Intramural Badminton Tournament` | university recreation/events calendar |
| Casual college club tournaments | `Asia Organization x Badminton Club Tournament` (Minnesota State) | Instagram + campus news coverage |

There is currently **no sample/placeholder data**. Every entry is a real tournament that was
verified against its source at the time this site was built. A couple of entries have incomplete
details (no exact date, or "deadline not yet announced") because that's genuinely all the
organizer had published, so the site shows "TBD" rather than inventing a date. For the batch pulled
from TournamentSoftware's national search, entries that showed a live "Online Entry: X days left"
countdown got an exact computed deadline; entries without that badge got `registrationDeadline:
null` rather than a guessed date, since the listing didn't confirm those are still open. In that
case the card says "check tournament page" and links straight to it.

## ⚠️ Keeping this site current (please read)

Tournament calendars change constantly, and there is no single feed that lists every US badminton
tournament. Sanctioned events, independent club opens, and college club tournaments are scattered
across TournamentSoftware, individual club websites, Facebook, and Instagram. The site only shows
tournaments that appear currently registerable (see below) and drops past ones automatically, so
**check back regularly and add newly-announced tournaments** using the sources below. The
TournamentSoftware national search in particular is worth re-running every few weeks:
https://www.tournamentsoftware.com/find?DateFilterType=0&SportID=2&CountryCode=USA (add `StartDate`/`EndDate` query params for a specific window).

### Where to find real tournaments to add

1. **USA Badminton adult tournament schedule**, for sanctioned Local/Regional/National Championships:
   https://usabadminton.org/athletes/adults/adult-tournament-schedule/
   Each USAB news post (e.g. "20XX [Club] OLC/ORC Prospectus Released") links to the
   TournamentSoftware entry page with the real registration deadline.
2. **Independent club websites**: many clubs (e.g. Capital Badminton Academy) run their own
   "unranked, open, friendly" tournaments outside the USAB circuit and list them on a
   `/tournaments` page on their own site, often still using TournamentSoftware just for
   registration/draws.
3. **Facebook**: see "Finding tournaments on Facebook" below. Facebook's own search isn't usable
   for this, so the reliable way in is direct event links or a club's Page → Events tab.
4. **Instagram**: search a club or university's handle directly (e.g. `@<school>badminton`).
   College club tournaments are almost always announced this way, sometimes with no other
   listing anywhere else on the web.
5. **University recreation/intramural calendars**: search `"<university> intramural badminton"`
   or check the school's IMLeagues/recreation events page directly.
6. **TournamentSoftware's league search**, a separate search from its tournament one:
   https://www.tournamentsoftware.com/find/league?SportID=2&CountryCode=USA (add `StartDate`/
   `EndDate` for a specific window). As of when this site was built it returned exactly 3 US
   badminton leagues nationwide (all added; see `activityType: "league"` entries in
   `js/data.js`), so it's worth re-checking periodically as new ones get listed there.

### Finding tournaments on Facebook: what works and what doesn't

Facebook is where a lot of independent club tournaments live and nowhere else, so it's worth
understanding exactly what's reachable without logging in (this site was built without ever
signing in to Facebook):

- **Works: a direct event link**, e.g. `facebook.com/events/<id>`. A public event's full details
  are visible with no login: dates, venue address, fees, registration link, deadlines, even the
  full text description. This is how `2026 Pioneer Team Tournament Fall` and
  `Fall 2026 Pioneer Badminton Open` got added. Both came from event links and had **no listing
  anywhere else** (not on TournamentSoftware, not on usabadminton.org).
- **Works: a club's Page → Events tab**, e.g. `facebook.com/<page-name>/events`. If you already
  know a club's Page (from their website, a poster, or another tournament's "Host" link), this
  lists all their public events, past and upcoming, without login.
- **Doesn't work: Facebook's own search.** `facebook.com/search/...` requires being logged in,
  returning nothing (not even an error) to a signed-out request. There is no way to broadly
  discover "all badminton tournaments on Facebook" the way TournamentSoftware's search page allows.
- **Partially works: a public event's "Suggested events" sidebar.** Facebook shows a handful of
  related events on each event page, which sometimes surfaces genuinely relevant tournaments
  (that's how the two Pioneer Badminton events were found from each other). It's a narrow,
  algorithm-picked list, not a real search.

**Practical result:** this site's Facebook coverage is necessarily incomplete and can only grow
when someone (you, a club, or a future session) supplies specific event or Page links, the way you
did with the two Pioneer Badminton links. If you belong to local badminton Facebook groups or
follow specific clubs, sending their event/Page links is the single most effective way to expand
this site's coverage. A worthwhile companion resource for finding club Pages in the first place:
https://www.worldbadminton.com/whereToPlay/unitedStates/index.html (a maintained list of dedicated
badminton facilities by state; most have a Facebook Page, though not all use its Events feature).

### Finding tournaments on Instagram: what works and what doesn't

College club tournaments are often announced only on Instagram. As with Facebook, this site was
built without ever logging in, so here's exactly what that gets you:

- **Works: a profile's visible post grid.** Loading `instagram.com/<account>/` shows a "sign
  up/log in" modal, but dismissing it (or just ignoring it) reveals the account's recent post
  thumbnails underneath, and no login is needed for that much.
- **Works, and this is the useful part: each thumbnail's `alt` text.** Instagram auto-generates an
  accessibility description for every photo, and for text-heavy flyer-style posts that description
  includes OCR'd text pulled from the image, often enough to read a whole flyer (dates, fees,
  divisions, deadlines) straight from the grid with no click-through needed. Extracted via
  `document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')` and reading each `<img>`'s
  `alt` attribute.
- **Works: the real post permalink.** Each grid thumbnail's `<a href>` is a genuine
  `/<account>/p/<shortcode>/` link, usable as-is (e.g. `https://www.instagram.com/cmubadminton/p/Dbb9Hbxpyeh/`)
  even though clicking it in a browser triggers a login wall.
- **Doesn't work: opening an individual post.** Clicking any post (to read its full caption,
  comments, or a linked registration form) hits "Sign up or login to see this post," a hard wall
  with no exceptions found. So detail is limited to whatever the flyer image itself shows; a
  tournament announced only in caption text with a plain (non-flyer) photo would be missed entirely.
- **Doesn't work: Instagram's search**, same as Facebook: not reachable signed out.

**Practical result:** a sweep of a club's account only surfaces tournaments the club illustrated as
a text-flyer-style image, and only from their initial ~12 visible posts (older ones need scrolling,
which risks re-triggering the login modal). A sweep of all 38 accounts in `badminton
instagrams.txt` (2026-09-07) found **exactly one** genuine open tournament this way, the
`2026 CMU Open Tournament`, because the overwhelming majority of what college clubs post is
internal (tryouts, practice schedules, recruitment, socials), not tournaments open to outsiders.
That's a real result, not a search failure. Re-sweeping later, or checking a specific club right
before its usual tournament season, is more likely to catch something new than repeating this exact
sweep immediately.

### Adding an entry

There's no "add" button on the site. Open `js/data.js` and copy one of the existing objects in the
`TOURNAMENTS` array, then fill in your own values. (The daily scheduled task described below does
exactly this automatically for the three sources it checks.) Field reference:

| Field | Notes |
|---|---|
| `id` | Any unique string, e.g. `"my-club-open-2026"` |
| `activityType` | Omit entirely for a one-off tournament (the default). Set to `"league"` for an ongoing/recurring league, which gets a "League" badge and a square map marker instead of a round one. |
| `name`, `venue`, `city`, `state`, `address` | Plain text |
| `lat`, `lng` | Needed for the distance sort. Easiest way: search the address on [Google Maps](https://maps.google.com), right-click the pin → the first menu item is the coordinates → click to copy. Or use [Nominatim](https://nominatim.openstreetmap.org/ui/search.html). |
| `startDate`, `endDate` | `"YYYY-MM-DD"`, or `null` if not yet announced. For a league, its season's first/last date. |
| `registrationDeadline` | `"YYYY-MM-DDTHH:mm:ss"` in local time, or `null` if unknown. For a league, its sign-up deadline. |
| `prizeMoney` | A plain number (USD) or `null` if there's no cash prize |
| `level` | Free text, e.g. `"National Championship"`, `"Independent Open Tournament"`, `"College Club"`, or for a league `"Team League"` / `"Collegiate Team League"` |
| `sourcePlatform` | `"TournamentSoftware"`, `"Facebook"`, `"Instagram"`, `"Club Website"`, or `"USA Badminton"` |
| `sourceUrl` | Link where people actually register or find current details |

## Keeping this site current: the daily scheduled task

A local scheduled task, **"Daily badminton tournament data refresh"**, runs once a day (6:01 AM
local time by default) and does the sweep described throughout this README automatically:

1. Re-checks TournamentSoftware's tournament and league search pages for anything new, and
   refreshes deadline/date/prize info on existing entries if a source now shows more than before.
2. Re-sweeps the 38 college club Instagram accounts in `badminton instagrams.txt` for newly-posted
   open tournaments (reading post-thumbnail alt text, as described above). Expect very few hits;
   that's normal, see the Instagram section above.
3. Re-checks the Facebook Pages of clubs already in `js/data.js`, plus a web search for others.
4. Appends a dated summary of what it found to `CHANGELOG.md` in the project root, and updates
   `js/data.js` directly.

**Important:** this task runs locally, inside this Claude Code app, so it only actually fires when
this app has an active session on this machine (not truly 24/7; if the app was closed when it was
due, it runs on next launch). It is not a cloud/GitHub-based automation. You can see and manage it
in the "Scheduled" section of the app sidebar: pause it, change its time, or click "Run now" to
trigger a check immediately (worth doing once up front, so it can pre-approve the browser/tool
permissions it needs rather than pausing on a prompt during its first automatic run).

## Time zones and the live countdown

Deadlines in `js/data.js` are stored as wall-clock times exactly as the organizer published them,
with no zone offset: `"2026-09-20T23:59:00"` means 11:59 PM *where the tournament is held*. The
venue's zone is derived from its `state` (see `STATE_TIME_ZONES` in `js/shared.js`), or from an
optional `timeZone` field on the entry if a state spans zones and the default is wrong.

Two things follow from that:

- **The deadline is displayed in the venue's own clock**, e.g. "Sep 20, 11:59 PM EDT", which is
  what the organizer's flyer says.
- **"Days left" counts calendar days**, from the viewer's today to the deadline's own printed date.
  This is why two deadlines on the same date always show the same number now. The earlier version
  did `Math.ceil()` on raw elapsed milliseconds, so a 10:00 AM deadline and an 11:59 PM deadline on
  the same day could report "0 days" and "1 day".

The viewer's zone is auto-detected with `Intl.DateTimeFormat().resolvedOptions().timeZone`, mapped
onto one of seven US zones (other US-equivalent IANA ids like `America/Detroit` are aliased in;
anything non-US falls back to Eastern). A dropdown on the tournaments page lets a visitor override
it, and the choice is remembered in `localStorage`.

A one-second ticker updates each countdown in place, so time remaining stays accurate without a
page refresh. It only rewrites the countdown text and the urgency colour, so scroll position,
filters and sort order are untouched. Inside 48 hours the countdown switches to a live
hours/minutes (then seconds) readout; if a deadline actually lapses while the page is open, the
list re-renders and that entry drops off, since it's no longer registerable.

## How sorting/filtering works

- **Registration deadline (default)**: soonest deadline first; tournaments with no announced
  deadline sort to the bottom and show "TBD".
- **Tournament date**: soonest start date first.
- **Distance**: type an address (or click "Use my location") and click "Set address"; the app
  geocodes it via the free [OpenStreetMap Nominatim](https://nominatim.org/) API (no API key, no
  data sent anywhere except that one lookup) and computes straight-line distance to each
  tournament's venue.
- **Prize money**: highest total purse first; tournaments with no listed prize sort to the bottom.

There's no "show past tournaments" option. Past and closed-registration tournaments are always
excluded (see "What's shown" above).

## Scope / limits by design

- **Badminton only.** This site intentionally does not include squash, tennis, pickleball, or
  other racket sports; only enter genuine badminton tournaments.
- **United States only.** Don't add international events.
- No backend means no shared database, so everyone editing `js/data.js` and re-publishing the site
  is the mechanism for keeping the shared list current. If you outgrow that (e.g. you want other
  people to submit tournaments directly through the site), that would need a small backend or a
  service like a spreadsheet-as-API/Airtable; ask if you'd like that added later.
