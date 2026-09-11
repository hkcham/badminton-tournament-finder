# Changelog

Daily data-maintenance log for `js/data.js`, kept by the scheduled refresh task.

## 2026-09-11

+ Added **North Shore Open 2026** (`ts-north-shore-open-2026`): found via TournamentSoftware's
  national search, not previously tracked. Oct 3-4, 2026 at Shannon Pohl Badminton Academy, Vernon
  Hills, IL; deadline Sept 19, 11:59 PM CDT; 0 entries so far.
+ Added **2026 SBC Open** (`ts-sbc-open-2026`): found via TournamentSoftware, hosted directly by the
  Seattle Badminton Club. Nov 6-8, 2026 in Kirkland, WA; deadline Oct 23, 11:59 PM PDT; 0 entries.
+ Added **Michigan Open 2026 Fall** (`ts-michigan-open-2026-fall`): found via TournamentSoftware.
  Nov 7-8, 2026 at Sparc in Novi, MI; deadline Nov 4, 11:59 PM; 1 entry so far.
+ Added **Club Championship North America 2026** (`ts-league-club-championship-north-america-2026`):
  new result on TournamentSoftware's league search (now 4 leagues total, up from 3). Sept 12-13, 2026
  at Manhattan Beach Badminton Club under SCBA; no online-entry deadline shown on its organization
  page, and since it starts the day after this check, entry is probably already closed.
+ Added **Frisco Open 2027** (`frisco-open-2027`): found via a general web search that surfaced
  friscobadminton.com's own events page. April 15-18, 2027 at Frisco Badminton Academy, Frisco, TX;
  $150,000 USD in prize money across Open A/B, Members Only, and Seniors draws; not USA Badminton
  sanctioned; registration not yet open, so `registrationDeadline` stays null with a note to watch
  for registration news.
~ Updated **2026 EBC Webadminton Charity Tournament** (`ts-ebc-webadminton-charity-2026`): its own
  TournamentSoftware page now shows the closing deadline extended from Sept 8 to Sept 11, 11:59 PM
  PDT (the listing's "8h left" countdown didn't match the stored Sept 8 date, which is what flagged
  this for a re-check); tightened the address to "33540 Central Ave, Union City, CA" and re-geocoded;
  added prize money ($2,000 for A/AB-combined events plus $2,000 for all other events, per the
  organizer's own description) which had been unlisted before; entries refreshed 266 to 271.
~ Refreshed `entries`/`entriesUpdated` on every other upcoming TournamentSoftware tournament already
  in the file (29 events): notable jumps include Peak Open 2026 (102 to 161), NVBC Open Championship
  (40 to 51), Fortius South OLC (0 to 28), Bay Badminton Championships (5 to 15), and Madison
  Badminton Invitational (5 to 12); ten events had no change in count but got their `entriesUpdated`
  date refreshed anyway per the daily-refresh convention. Arise International Challenge and LA Open
  remain uncounted (BWF login gate, as expected); the 3 leagues remain uncounted (organization pages
  have no entries stat, as expected).
- Checked Facebook Events for Pioneer Badminton (`pioneer.badminton.IL`), Southern Asian Association
  of Badminton (SAABHOU), and Capital Badminton Academy: all upcoming events shown matched what's
  already in the file, nothing new. A general web search for other US club Facebook tournament posts
  (New York, general) surfaced nothing usable beyond what's above; most results were BWF World Tour
  Wikipedia pages, not local club events.

## 2026-09-08

No new tournaments or leagues found (checked TournamentSoftware, 38 Instagram accounts, 3 Facebook
club pages, and a general web search). Nothing in `js/data.js` needed updating either; every field
already on file checked out against today's sources.

- Checked TournamentSoftware's national tournament search (39 results) and league search (3 results,
  unchanged) for anything not already in `js/data.js`. The only "new-looking" tournament IDs were the
  same 5 events flagged yesterday (TTS 2026 Junior Tournament, 2026 MN Badminton Open, Sparc Open
  2026, New Hope Badminton Academy Labor Day Tournament, Nashville's 2026 Labor Day Tournament),
  dated Sept 5-7, now fully in the past relative to today (Sept 8), so per the "future events only"
  rule none were added. Cross-checked every stored tournament's "Online Entry: X days left" countdown
  against its stored `registrationDeadline`; all matched (two, `ts-massbad-northeast-orc-2026` and
  `ts-bintang-norcal-orc-2026`, were 1 day off from the raw countdown, consistent with the badge's
  own day-rounding rather than a real discrepancy, so left as-is).
- Full Instagram sweep this time: all 38 accounts loaded without hitting yesterday's rate-limit wall
  (utbadmintonclub through vandybadminton per `badminton instagrams.txt`). Every account's recent
  posts were tryouts, quad-day/recruitment flyers, open-court practice schedules, or unrelated
  social/merch posts (a UCLA "Bruin Open" was a merch-design contest, not a competition; a Vanderbilt
  post was a graphic-designer recruitment call). No genuine new open-tournament announcements. The
  only real hit was the already-tracked CMU Open Tournament (`ig-cmu-open-tournament-2026`), whose
  post is unchanged since last check.
- Checked Facebook Events for Pioneer Badminton, Southern Asian Association of Badminton (SAABHOU),
  and Capital Badminton Academy. All upcoming events shown were already in the file (SAABHOU's Lunar
  New Year tournament has now moved to their "Past" tab, consistent with its March 2026 date being
  behind today). General web search for other US badminton club Facebook events again surfaced only
  professional BWF tour Wikipedia pages, nothing usable.
- Noted but did not touch: `css/style.css` has an unrelated, uncommitted local change (card
  text-wrapping fix) left over from outside this task's scope; left it out of today's commit.

## 2026-09-07

- ~ Updated **2026 Annual MBC Chicago Open** (`ts-mbc-chicago-open-2026`): corrected city from
  "Woodridge" to "Darien" and tightened the address to "8202 Lemont Road, Darien, IL 60516"
  (re-geocoded lat/lng accordingly), and filled in `registrationDeadline` (2026-09-06 11:59 PM
  CDT, already closed) which had been `null`. All confirmed via the tournament's own
  TournamentSoftware detail page.
- ~ Updated **TopShot Open** (`ts-topshot-open-2026`): filled in `registrationDeadline`
  (2026-11-07 11:59 PM CST, previously `null`/not shown) and tightened the address to
  "840 N. Vista Ridge Blvd, Cedar Park, TX 78613" (re-geocoded lat/lng). Confirmed via the
  tournament's own TournamentSoftware detail page.
- Checked TournamentSoftware's national tournament search (39 results) and league search
  (3 results, unchanged) for anything not already in `js/data.js`. A handful of newly-visible
  listings (TTS 2026 Junior Tournament, 2026 MN Badminton Open, Sparc Open 2026, New Hope
  Badminton Academy Labor Day Tournament, Nashville's 2026 Labor Day Tournament) were all dated
  Sept 5–7, 2026 (today or earlier), so per the "future events only" rule none were added.
  Cross-checked every other listed tournament's "Online Entry: X days left" countdown against
  the stored `registrationDeadline`; all matched except the two above.
- Checked Facebook Events for Pioneer Badminton (`pioneer.badminton.IL`), Southern Asian
  Association of Badminton (`SAABHOU`), and Capital Badminton Academy. All upcoming events
  shown were already in the file; no new tournaments found. General web search for other US
  badminton club Facebook events surfaced only professional BWF tour pages (Wikipedia), nothing
  usable.
- Instagram sweep was cut short: only 3 of the 38 accounts (`cmubadminton`, `utbadmintonclub`,
  `uiuc.badminton`) loaded before Instagram's anonymous-browsing rate limit kicked in and started
  showing a hard login wall (no post grid) for every subsequent account, including on a fresh
  browser tab, confirming it was a session/IP-level throttle rather than anything account
  specific. Waited up to ~25s and retried twice with no change. The 3 accounts checked had no new
  open-tournament posts (CMU's own post is already tracked as `ig-cmu-open-tournament-2026`; the
  other two only showed tryouts/social posts). The remaining 35 accounts were not checked today;
  worth a retry on the next run, since the throttle is presumably temporary.

## 2026-09-09

+ Added entry counts to every TournamentSoftware tournament that publishes one (31 events). The
  number comes from the "Entries" figure on each tournament overview page, next to "Events".
+ Added a "Number of entries (most)" option to the Sort by menu. Events with no published count
  sort to the bottom rather than being treated as having zero entries.
+ Entry counts now show on the tournament cards and in map popups, with a tooltip giving the date
  the number was read.
+ Added a "Why this site exists" section at the top of the tournaments page.
+ The daily refresh task now re-reads entry counts on every run, since they change as registration
  fills up.
+ Two BWF-sanctioned events (Arise International Challenge, LA Open) keep no count: they redirect
  to bwf.tournamentsoftware.com and require a login. Leagues resolve to organization pages with no
  entries figure, so they have no count either.
