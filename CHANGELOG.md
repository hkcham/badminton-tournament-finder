# Changelog

Daily data-maintenance log for `js/data.js`, kept by the scheduled refresh task.

## 2026-09-07

- ~ Updated **2026 Annual MBC Chicago Open** (`ts-mbc-chicago-open-2026`): corrected city from
  "Woodridge" to "Darien" and tightened the address to "8202 Lemont Road, Darien, IL 60516"
  (re-geocoded lat/lng accordingly), and filled in `registrationDeadline` (2026-09-06 11:59 PM
  CDT — already closed) which had been `null`. All confirmed via the tournament's own
  TournamentSoftware detail page.
- ~ Updated **TopShot Open** (`ts-topshot-open-2026`): filled in `registrationDeadline`
  (2026-11-07 11:59 PM CST, previously `null`/not shown) and tightened the address to
  "840 N. Vista Ridge Blvd, Cedar Park, TX 78613" (re-geocoded lat/lng). Confirmed via the
  tournament's own TournamentSoftware detail page.
- Checked TournamentSoftware's national tournament search (39 results) and league search
  (3 results, unchanged) for anything not already in `js/data.js`. A handful of newly-visible
  listings (TTS 2026 Junior Tournament, 2026 MN Badminton Open, Sparc Open 2026, New Hope
  Badminton Academy Labor Day Tournament, Nashville's 2026 Labor Day Tournament) were all dated
  Sept 5–7, 2026 — today or earlier — so per the "future events only" rule none were added.
  Cross-checked every other listed tournament's "Online Entry: X days left" countdown against
  the stored `registrationDeadline`; all matched except the two above.
- Checked Facebook Events for Pioneer Badminton (`pioneer.badminton.IL`), Southern Asian
  Association of Badminton (`SAABHOU`), and Capital Badminton Academy — all upcoming events
  shown were already in the file; no new tournaments found. General web search for other US
  badminton club Facebook events surfaced only professional BWF tour pages (Wikipedia), nothing
  usable.
- Instagram sweep was cut short: only 3 of the 38 accounts (`cmubadminton`, `utbadmintonclub`,
  `uiuc.badminton`) loaded before Instagram's anonymous-browsing rate limit kicked in and started
  showing a hard login wall (no post grid) for every subsequent account, including on a fresh
  browser tab — confirming it was a session/IP-level throttle rather than anything account
  specific. Waited up to ~25s and retried twice with no change. The 3 accounts checked had no new
  open-tournament posts (CMU's own post is already tracked as `ig-cmu-open-tournament-2026`; the
  other two only showed tryouts/social posts). The remaining 35 accounts were not checked today —
  worth a retry on the next run, since the throttle is presumably temporary.
