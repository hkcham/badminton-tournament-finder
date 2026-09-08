/**
 * Shared logic between the tournaments list view and the map view: loading
 * tournament data, time-zone-aware date math, formatting, and geocoding.
 * Exposed as the global `Shared` object so both pages' scripts can use it
 * without a build step / module bundler.
 *
 * This site is a read-only display of tournaments/leagues found online. There
 * is no in-browser "add" feature; js/data.js is the only source of entries.
 *
 * TIME ZONES
 * ----------
 * Deadlines in js/data.js are wall-clock times as the organizer published them
 * ("2026-09-20T23:59:00" means 11:59 PM where the tournament is held). To turn
 * that into a real instant we need the venue's zone, which is derived from its
 * state (or an explicit `timeZone` field on the entry).
 *
 * "Days left" is then counted in CALENDAR days in the *viewer's* zone, not in
 * elapsed milliseconds. That matters: two deadlines on the same date, one at
 * 10:00 AM and one at 11:59 PM, used to report "0 days" and "1 day" because
 * the old code did Math.ceil() on raw elapsed time. Counting calendar days
 * makes both say the same thing, which is what a reader expects.
 */

const Shared = (function () {
  "use strict";

  const ADDR_KEY = "badmintonFinder.address.v1";
  const GEOCODE_CACHE_KEY = "badmintonFinder.geocodeCache.v1";
  const TZ_KEY = "badmintonFinder.timeZone.v1";

  // ---------- US time zones ----------

  /** The zones this site offers. US only, per the site's scope. */
  const US_TIME_ZONES = [
    { id: "America/New_York", label: "Eastern time" },
    { id: "America/Chicago", label: "Central time" },
    { id: "America/Denver", label: "Mountain time" },
    { id: "America/Phoenix", label: "Arizona (no DST)" },
    { id: "America/Los_Angeles", label: "Pacific time" },
    { id: "America/Anchorage", label: "Alaska time" },
    { id: "Pacific/Honolulu", label: "Hawaii time" },
  ];

  /** Other IANA ids a US browser may report, mapped onto the list above. */
  const ZONE_ALIASES = {
    "America/Detroit": "America/New_York",
    "America/Indiana/Indianapolis": "America/New_York",
    "America/Indiana/Vincennes": "America/New_York",
    "America/Indiana/Winamac": "America/New_York",
    "America/Indiana/Marengo": "America/New_York",
    "America/Indiana/Vevay": "America/New_York",
    "America/Kentucky/Louisville": "America/New_York",
    "America/Kentucky/Monticello": "America/New_York",
    "America/Toronto": "America/New_York",
    "America/Indiana/Knox": "America/Chicago",
    "America/Indiana/Tell_City": "America/Chicago",
    "America/Menominee": "America/Chicago",
    "America/North_Dakota/Center": "America/Chicago",
    "America/North_Dakota/New_Salem": "America/Chicago",
    "America/North_Dakota/Beulah": "America/Chicago",
    "America/Winnipeg": "America/Chicago",
    "America/Boise": "America/Denver",
    "America/Edmonton": "America/Denver",
    "America/Juneau": "America/Anchorage",
    "America/Sitka": "America/Anchorage",
    "America/Nome": "America/Anchorage",
    "America/Yakutat": "America/Anchorage",
    "America/Metlakatla": "America/Anchorage",
    "America/Adak": "Pacific/Honolulu",
    "America/Vancouver": "America/Los_Angeles",
    "US/Eastern": "America/New_York",
    "US/Central": "America/Chicago",
    "US/Mountain": "America/Denver",
    "US/Pacific": "America/Los_Angeles",
    "US/Arizona": "America/Phoenix",
    "US/Alaska": "America/Anchorage",
    "US/Hawaii": "Pacific/Honolulu",
  };

  /** Venue zone lookup by state. Split states use their dominant zone. */
  const STATE_TIME_ZONES = {
    AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix",
    AR: "America/Chicago", CA: "America/Los_Angeles", CO: "America/Denver",
    CT: "America/New_York", DE: "America/New_York", DC: "America/New_York",
    FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
    ID: "America/Boise", IL: "America/Chicago", IN: "America/New_York",
    IA: "America/Chicago", KS: "America/Chicago", KY: "America/New_York",
    LA: "America/Chicago", ME: "America/New_York", MD: "America/New_York",
    MA: "America/New_York", MI: "America/New_York", MN: "America/Chicago",
    MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver",
    NE: "America/Chicago", NV: "America/Los_Angeles", NH: "America/New_York",
    NJ: "America/New_York", NM: "America/Denver", NY: "America/New_York",
    NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
    OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York",
    RI: "America/New_York", SC: "America/New_York", SD: "America/Chicago",
    TN: "America/Chicago", TX: "America/Chicago", UT: "America/Denver",
    VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
    WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver",
  };

  const DEFAULT_ZONE = "America/New_York";

  /** The zone a tournament's published deadline time is stated in. */
  function venueTimeZone(t) {
    return t.timeZone || STATE_TIME_ZONES[(t.state || "").toUpperCase()] || DEFAULT_ZONE;
  }

  function isSupportedZone(id) {
    return US_TIME_ZONES.some((z) => z.id === id);
  }

  /** The viewer's zone: saved choice, else auto-detected, else Eastern. */
  function getUserTimeZone() {
    try {
      const saved = localStorage.getItem(TZ_KEY);
      if (saved && isSupportedZone(saved)) return saved;
    } catch {}
    return detectUserTimeZone();
  }

  function detectUserTimeZone() {
    let detected;
    try {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return DEFAULT_ZONE;
    }
    if (isSupportedZone(detected)) return detected;
    if (ZONE_ALIASES[detected]) return ZONE_ALIASES[detected];
    return DEFAULT_ZONE;
  }

  function setUserTimeZone(id) {
    if (!isSupportedZone(id)) return;
    try { localStorage.setItem(TZ_KEY, id); } catch {}
  }

  function timeZoneLabel(id) {
    const z = US_TIME_ZONES.find((x) => x.id === id);
    return z ? z.label : id;
  }

  /** Short zone name for an instant, e.g. "EDT" / "PST". */
  function zoneAbbrev(date, timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
        .formatToParts(date);
      const p = parts.find((x) => x.type === "timeZoneName");
      return p ? p.value : "";
    } catch {
      return "";
    }
  }

  // ---------- Time zone math ----------

  /** The Y/M/D H:M:S an instant reads as, in a given zone. */
  function getZonedParts(date, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const out = {};
    for (const p of fmt.formatToParts(date)) {
      if (p.type !== "literal") out[p.type] = Number(p.value);
    }
    if (out.hour === 24) out.hour = 0; // some engines report midnight as 24
    return out;
  }

  /**
   * Turn a wall-clock string ("2026-09-20T23:59:00") in a given zone into the
   * real instant it refers to. Two correction passes settle DST boundaries.
   */
  function zonedWallClockToInstant(wallClock, timeZone) {
    if (!wallClock) return null;
    const [datePart, timePart = "00:00:00"] = String(wallClock).split("T");
    const [y, mo, d] = datePart.split("-").map(Number);
    const [h = 0, mi = 0, s = 0] = timePart.split(":").map(Number);
    const targetUTC = Date.UTC(y, mo - 1, d, h, mi, s);

    let guess = targetUTC;
    for (let i = 0; i < 2; i++) {
      const seen = getZonedParts(new Date(guess), timeZone);
      const seenUTC = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
      const drift = targetUTC - seenUTC;
      if (drift === 0) break;
      guess += drift;
    }
    return new Date(guess);
  }

  /** Whole calendar days from one instant to another, counted in `timeZone`. */
  function calendarDaysBetween(fromInstant, toInstant, timeZone) {
    return calendarDaysAcrossZones(fromInstant, timeZone, toInstant, timeZone);
  }

  /**
   * Days between "today where the viewer is" and "the deadline's date where
   * the tournament is". Using the venue's zone for the deadline side keeps the
   * number consistent with the date printed beside it: a California deadline
   * shown as "Sep 13, 11:59 PM PDT" counts to Sep 13, even for a viewer in a
   * later zone for whom that instant technically lands on Sep 14.
   */
  function calendarDaysAcrossZones(fromInstant, fromZone, toInstant, toZone) {
    const a = getZonedParts(fromInstant, fromZone);
    const b = getZonedParts(toInstant, toZone);
    const aMid = Date.UTC(a.year, a.month - 1, a.day);
    const bMid = Date.UTC(b.year, b.month - 1, b.day);
    return Math.round((bMid - aMid) / 86400000);
  }

  /** "2026-09-20" as a UTC-midnight Date, so display never drifts a day. */
  function parseCalendarDate(str) {
    if (!str) return null;
    const [y, m, d] = String(str).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  // ---------- Data loading ----------

  function getAllTournaments() {
    return TOURNAMENTS;
  }

  function loadStoredAddress() {
    try { return JSON.parse(localStorage.getItem(ADDR_KEY)) || null; } catch { return null; }
  }
  function storeAddress(coords) {
    try { localStorage.setItem(ADDR_KEY, JSON.stringify(coords)); } catch {}
  }
  function clearStoredAddress() {
    try { localStorage.removeItem(ADDR_KEY); } catch {}
  }

  // ---------- Enrichment / filtering / sorting ----------

  /**
   * Adds derived dates and status flags to a raw record.
   * `now` is the current instant; `userZone` is the viewer's zone (defaults to
   * their detected one) and only affects how "days left" is counted.
   */
  function enrich(t, now, userCoords, userZone) {
    const zone = userZone || getUserTimeZone();
    const venueZone = venueTimeZone(t);

    // Display dates: plain calendar dates, never shifted by a zone conversion.
    const start = parseCalendarDate(t.startDate);
    const end = t.endDate ? parseCalendarDate(t.endDate) : start;

    // Comparison instants: anchored to the venue's local clock.
    const endInstant = t.endDate
      ? zonedWallClockToInstant(t.endDate + "T23:59:59", venueZone)
      : (t.startDate ? zonedWallClockToInstant(t.startDate + "T23:59:59", venueZone) : null);
    const deadline = t.registrationDeadline
      ? zonedWallClockToInstant(t.registrationDeadline, venueZone)
      : null;

    const isPast = endInstant ? endInstant.getTime() < now.getTime() : false;
    const deadlinePassed = deadline ? deadline.getTime() < now.getTime() : false;

    // Everything the viewer sees is expressed in their own zone: the deadline
    // is converted into it for display, and days remaining is counted in it.
    // Both sides using the same zone is what keeps the number consistent with
    // the date printed next to it.
    const daysUntilDeadline = deadline ? calendarDaysBetween(now, deadline, zone) : null;
    const msUntilDeadline = deadline ? deadline.getTime() - now.getTime() : null;

    let distanceMiles = null;
    if (userCoords && typeof t.lat === "number" && typeof t.lng === "number") {
      distanceMiles = haversineMiles(userCoords.lat, userCoords.lng, t.lat, t.lng);
    }

    return {
      ...t, start, end, endInstant, deadline, venueZone, userZone: zone,
      isPast, deadlinePassed, daysUntilDeadline, msUntilDeadline, distanceMiles,
    };
  }

  /** Only tournaments that can still plausibly be registered for. */
  function isRegisterable(t) {
    return !t.isPast && !t.deadlinePassed;
  }

  /** true for a league entry; absence of activityType means "tournament". */
  function isLeague(t) {
    return t.activityType === "league";
  }

  function compareNullableDates(a, b) {
    if (!a && !b) return 0;
    if (!a) return 1; // null/TBD sorts last
    if (!b) return -1;
    return a.getTime() - b.getTime();
  }

  function sortList(list, mode) {
    const arr = [...list];
    if (mode === "deadline") {
      arr.sort((a, b) => compareNullableDates(a.deadline, b.deadline) || compareNullableDates(a.start, b.start));
    } else if (mode === "startDate") {
      arr.sort((a, b) => compareNullableDates(a.start, b.start));
    } else if (mode === "distance") {
      arr.sort((a, b) => {
        const da = a.distanceMiles;
        const db = b.distanceMiles;
        if (da == null && db == null) return compareNullableDates(a.deadline, b.deadline);
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    } else if (mode === "prize") {
      arr.sort((a, b) => {
        const pa = a.prizeMoney;
        const pb = b.prizeMoney;
        if (pa == null && pb == null) return compareNullableDates(a.deadline, b.deadline);
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pb - pa;
      });
    }
    return arr;
  }

  /** 'urgent' | 'soon' | 'ok' | 'past' | 'tbd': drives both list-pill and map-marker color. */
  function urgencyStatus(t) {
    if (t.isPast) return "past";
    if (!t.deadline) return "tbd";
    if (t.deadlinePassed) return "past";
    const d = t.daysUntilDeadline;
    if (d <= 3) return "urgent";
    if (d <= 14) return "soon";
    return "ok";
  }

  /**
   * The countdown text for a deadline. Inside 48 hours it ticks down in
   * hours/minutes (and seconds inside the last hour) so the page feels live;
   * beyond that, whole calendar days read better than a running clock.
   */
  function countdownLabel(msRemaining, calendarDays) {
    if (msRemaining <= 0) return "Closing now";

    if (msRemaining < 48 * 3600000) {
      const totalSeconds = Math.floor(msRemaining / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      if (h >= 1) return `Closes in ${h}h ${String(m).padStart(2, "0")}m`;
      if (m >= 1) return `Closes in ${m}m ${String(s).padStart(2, "0")}s`;
      return `Closes in ${s}s`;
    }
    if (calendarDays === 0) return "Closes today";
    if (calendarDays === 1) return "Closes tomorrow";
    return `${calendarDays} days left`;
  }

  /** A deadline rendered in any zone, e.g. "Sep 20, 11:59 PM EDT". */
  function formatDeadlineIn(deadline, timeZone) {
    if (!deadline) return "";
    const datePart = deadline.toLocaleDateString("en-US", {
      timeZone, month: "short", day: "numeric",
    });
    const timePart = deadline.toLocaleTimeString("en-US", {
      timeZone, hour: "numeric", minute: "2-digit",
    });
    return `${datePart}, ${timePart} ${zoneAbbrev(deadline, timeZone)}`.trim();
  }

  /** What the viewer sees: the deadline converted into their own zone. */
  function formatDeadlineInUserZone(t) {
    return formatDeadlineIn(t.deadline, t.userZone || getUserTimeZone());
  }

  /** The organizer's own stated time, kept for the tooltip. */
  function formatDeadlineInVenueZone(t) {
    return formatDeadlineIn(t.deadline, t.venueZone);
  }

  function renderDeadlinePill(t) {
    const status = urgencyStatus(t);
    if (status === "past") {
      return `<span class="deadline-pill past">${t.isPast ? "Event has passed" : "Registration closed"}</span>`;
    }
    if (status === "tbd") {
      return `<span class="deadline-pill tbd">Deadline: ${t.deadlineNote ? escapeHtml(t.deadlineNote) : "TBD"}</span>`;
    }
    const label = countdownLabel(t.msUntilDeadline, t.daysUntilDeadline);
    // Shown in the viewer's own zone. The organizer's stated local time is
    // kept in the tooltip so the original wording is never lost.
    const when = formatDeadlineInUserZone(t);
    const atVenue = formatDeadlineInVenueZone(t);
    const sameClock = when === atVenue;
    const note = t.deadlineNote ? ` (${t.deadlineNote})` : "";
    const tip = sameClock
      ? `Closes ${when}${note}`
      : `Closes ${when} your time, which is ${atVenue} where the tournament is held${note}`;
    // data-deadline lets the live ticker refresh this pill in place, with no
    // re-render, re-sort or scroll jump.
    return (
      `<span class="deadline-pill ${status}" data-deadline="${t.deadline.toISOString()}"` +
      ` data-venue-zone="${escapeAttr(t.venueZone)}"` +
      ` data-deadline-id="${escapeAttr(t.id)}"` +
      ` title="${escapeAttr(tip)}">` +
      `<span class="deadline-countdown">${label}</span> · ${escapeHtml(when)}</span>`
    );
  }

  // ---------- Formatting ----------

  /** Calendar dates are stored UTC-midnight, so format them in UTC too. */
  function formatDate(d) {
    if (!d) return "";
    return d.toLocaleDateString("en-US", {
      timeZone: "UTC", month: "short", day: "numeric", year: "numeric",
    });
  }

  function formatDateRange(start, end) {
    if (!start) return "Dates TBD";
    if (!end || start.getTime() === end.getTime()) return formatDate(start);
    const sameMonth =
      start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
    if (sameMonth) {
      const month = start.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
      return `${month} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
    }
    return `${formatDate(start)} – ${formatDate(end)}`;
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function haversineMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // miles
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ---------- Geocoding (OpenStreetMap Nominatim, no API key) ----------

  function loadGeocodeCache() {
    try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY)) || {}; } catch { return {}; }
  }
  function saveGeocodeCache(cache) {
    try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch {}
  }

  async function geocode(query) {
    const cache = loadGeocodeCache();
    const key = query.trim().toLowerCase();
    if (cache[key]) return cache[key];

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("geocode failed");
    const data = await res.json();
    if (!data || !data.length) return null;
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    cache[key] = result;
    saveGeocodeCache(cache);
    return result;
  }

  // ---------- Misc ----------

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function populateStateFilter(selectEl) {
    const states = Array.from(new Set(getAllTournaments().map((t) => t.state).filter(Boolean))).sort();
    const current = selectEl.value;
    selectEl.innerHTML = `<option value="">All states</option>` + states.map((s) => `<option value="${s}">${s}</option>`).join("");
    if (states.includes(current)) selectEl.value = current;
  }

  function populateTimeZoneSelect(selectEl, selectedId) {
    selectEl.innerHTML = US_TIME_ZONES
      .map((z) => `<option value="${z.id}">${z.label}</option>`)
      .join("");
    selectEl.value = selectedId || getUserTimeZone();
  }

  return {
    ADDR_KEY, GEOCODE_CACHE_KEY, TZ_KEY, US_TIME_ZONES,
    getAllTournaments,
    loadStoredAddress, storeAddress, clearStoredAddress,
    venueTimeZone, getUserTimeZone, setUserTimeZone, detectUserTimeZone,
    timeZoneLabel, zoneAbbrev, getZonedParts, zonedWallClockToInstant,
    calendarDaysBetween, calendarDaysAcrossZones, parseCalendarDate,
    enrich, isRegisterable, isLeague, compareNullableDates, sortList,
    urgencyStatus, renderDeadlinePill, countdownLabel,
    formatDeadlineIn, formatDeadlineInUserZone, formatDeadlineInVenueZone,
    formatDate, formatDateRange, escapeHtml, escapeAttr, haversineMiles,
    geocode, debounce, populateStateFilter, populateTimeZoneSelect,
  };
})();
