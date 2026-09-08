/**
 * Shared logic between index.html (list view) and map.html (map view):
 * loading tournament data, date math, formatting, and geocoding. Exposed as
 * the global `Shared` object so both pages' scripts can use it without a
 * build step / module bundler.
 *
 * This site is a read-only display of tournaments/leagues found online. There
 * is no in-browser "add" feature; js/data.js is the only source of entries.
 */

const Shared = (function () {
  "use strict";

  const ADDR_KEY = "badmintonFinder.address.v1";
  const GEOCODE_CACHE_KEY = "badmintonFinder.geocodeCache.v1";

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

  // ---------- Enrichment / filtering / sorting ----------

  /** Adds derived Date objects and status flags to a raw tournament record. */
  function enrich(t, now, userCoords) {
    const start = t.startDate ? new Date(t.startDate + "T00:00:00") : null;
    const end = t.endDate ? new Date(t.endDate + "T23:59:59") : start;
    const deadline = t.registrationDeadline ? new Date(t.registrationDeadline) : null;

    const isPast = end ? end.getTime() < now.getTime() : false;
    const deadlinePassed = deadline ? deadline.getTime() < now.getTime() : false;
    const daysUntilDeadline = deadline ? Math.ceil((deadline - now) / 86400000) : null;

    let distanceMiles = null;
    if (userCoords && typeof t.lat === "number" && typeof t.lng === "number") {
      distanceMiles = haversineMiles(userCoords.lat, userCoords.lng, t.lat, t.lng);
    }

    return { ...t, start, end, deadline, isPast, deadlinePassed, daysUntilDeadline, distanceMiles };
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

  function renderDeadlinePill(t) {
    const status = urgencyStatus(t);
    if (status === "past") {
      return `<span class="deadline-pill past">${t.isPast ? "Event has passed" : "Registration closed"}</span>`;
    }
    if (status === "tbd") {
      return `<span class="deadline-pill tbd">Deadline: ${t.deadlineNote ? escapeHtml(t.deadlineNote) : "TBD"}</span>`;
    }
    const d = t.daysUntilDeadline;
    const label = d === 0 ? "Closes today!" : d === 1 ? "1 day left" : `${d} days left`;
    return `<span class="deadline-pill ${status}">${label} · ${formatDate(t.deadline)}</span>`;
  }

  // ---------- Formatting ----------

  function formatDate(d) {
    if (!d) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatDateRange(start, end) {
    if (!start) return "Dates TBD";
    if (!end || start.toDateString() === end.toDateString()) return formatDate(start);
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      const month = start.toLocaleDateString("en-US", { month: "short" });
      return `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
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

  return {
    ADDR_KEY, GEOCODE_CACHE_KEY,
    getAllTournaments,
    loadStoredAddress, storeAddress,
    enrich, isRegisterable, isLeague, compareNullableDates, sortList, urgencyStatus, renderDeadlinePill,
    formatDate, formatDateRange, escapeHtml, escapeAttr, haversineMiles,
    geocode, debounce, populateStateFilter,
  };
})();
