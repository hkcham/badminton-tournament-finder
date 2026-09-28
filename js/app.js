/**
 * US Badminton Tournament Finder: list view logic.
 * No build step, no backend. Reads TOURNAMENTS from js/data.js via js/shared.js
 * and renders a sortable/filterable, read-only list. This site only displays
 * tournaments/leagues found online, so there's no way to add one through the UI;
 * see README.md for how to add entries to js/data.js.
 */

(function () {
  "use strict";

  const S = Shared;

  /** @type {{lat:number,lng:number,label:string}|null} */
  let userCoords = S.loadStoredAddress();

  // ---------- DOM refs ----------
  const searchInput = document.getElementById("searchInput");
  const stateFilter = document.getElementById("stateFilter");
  const typeFilter = document.getElementById("typeFilter");
  const sortSelect = document.getElementById("sortSelect");
  const cardList = document.getElementById("cardList");
  const resultsCount = document.getElementById("resultsCount");
  const sortDescription = document.getElementById("sortDescription");

  const addressInput = document.getElementById("addressInput");
  const applyAddressBtn = document.getElementById("applyAddressBtn");
  const useLocationBtn = document.getElementById("useLocationBtn");
  const addressStatus = document.getElementById("addressStatus");

  const timeZoneSelect = document.getElementById("timeZoneSelect");
  const timeZoneStatus = document.getElementById("timeZoneStatus");

  const toolbar = document.getElementById("toolbar");
  const moreOptionsToggle = document.getElementById("moreOptionsToggle");
  const moreOptionsSummary = document.getElementById("moreOptionsSummary");

  const heroStats = document.getElementById("heroStats");
  /** Instant of the soonest open deadline, so the ticker can refresh the stat. */
  let nextDeadlineAt = null;

  /** The zone all "days left" counts are measured in. */
  let userZone = S.getUserTimeZone();

  // ---------- Init ----------
  if (userCoords) {
    addressInput.value = userCoords.label;
    setUsingAddressStatus(userCoords.label);
  }
  S.populateStateFilter(stateFilter);
  S.populateTimeZoneSelect(timeZoneSelect, userZone);
  showTimeZoneStatus();
  render();
  startCountdownTicker();
  injectStructuredData();

  // ---------- Event wiring ----------
  // Only visible on phones (see .toolbar-toggle in style.css); on wider
  // screens the location and time zone row is always shown.
  moreOptionsToggle.addEventListener("click", () => {
    const expanded = toolbar.classList.toggle("is-expanded");
    moreOptionsToggle.setAttribute("aria-expanded", String(expanded));
  });

  searchInput.addEventListener("input", S.debounce(render, 150));
  stateFilter.addEventListener("change", render);
  typeFilter.addEventListener("change", render);
  sortSelect.addEventListener("change", render);

  timeZoneSelect.addEventListener("change", () => {
    userZone = timeZoneSelect.value;
    S.setUserTimeZone(userZone);
    showTimeZoneStatus();
    render();
  });

  function showTimeZoneStatus() {
    const detected = S.detectUserTimeZone();
    timeZoneStatus.textContent =
      userZone === detected
        ? `Detected automatically. Countdowns update live.`
        : `Set manually (detected ${S.timeZoneLabel(detected)}).`;
  }

  applyAddressBtn.addEventListener("click", async () => {
    const query = addressInput.value.trim();
    // Submitting an empty box is how you clear a saved location.
    if (!query) {
      clearAddress();
      return;
    }
    await geocodeAndApply(query);
  });

  /**
   * Forgets the saved location: distances disappear from the cards, and if the
   * list was sorted by distance we fall back to the default deadline sort,
   * since "nearest" is meaningless with no address to measure from.
   */
  function clearAddress() {
    if (!userCoords) {
      setAddressStatus("No location set.", false);
      return;
    }
    userCoords = null;
    S.clearStoredAddress();
    addressInput.value = "";
    if (sortSelect.value === "distance") sortSelect.value = "deadline";
    setAddressStatus("Location cleared.", false);
    render();
  }

  addressInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyAddressBtn.click();
    }
  });

  useLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setAddressStatus("Geolocation isn't supported in this browser.", true);
      return;
    }
    setAddressStatus("Locating…", false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "My current location",
        };
        addressInput.value = userCoords.label;
        S.storeAddress(userCoords);
        setUsingAddressStatus("your current location");
        sortSelect.value = "distance";
        render();
      },
      (err) => {
        setAddressStatus("Couldn't get your location (" + err.message + "). Try typing an address instead.", true);
      },
      { timeout: 8000 }
    );
  });

  // ---------- Core rendering ----------

  function render() {
    const all = S.getAllTournaments();
    const now = new Date();

    const query = searchInput.value.trim().toLowerCase();
    const stateVal = stateFilter.value;
    const typeVal = typeFilter.value;
    const sortMode = sortSelect.value;

    let list = all.map((t) => S.enrich(t, now, userCoords, userZone));

    // Only ever show tournaments that can still plausibly be registered for.
    list = list.filter(S.isRegisterable);

    if (query) {
      list = list.filter((t) =>
        [t.name, t.venue, t.city, t.state, t.description]
          .filter(Boolean)
          .some((f) => f.toLowerCase().includes(query))
      );
    }
    if (stateVal) list = list.filter((t) => t.state === stateVal);
    if (typeVal === "league") list = list.filter(S.isLeague);
    else if (typeVal === "tournament") list = list.filter((t) => !S.isLeague(t));

    list = S.sortList(list, sortMode);

    const leagueCount = list.filter(S.isLeague).length;
    const tournamentCount = list.length - leagueCount;
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const noun = typeVal === "league" ? "league" : typeVal === "tournament" ? "tournament" : "event";
    const breakdown = leagueCount > 0 && typeVal === ""
      ? ` <span class="results-breakdown">${plural(tournamentCount, "tournament")}, ${plural(leagueCount, "league")}</span>`
      : "";
    resultsCount.innerHTML = `<strong>${list.length}</strong> ${noun}${list.length === 1 ? "" : "s"}${breakdown}`;
    sortDescription.textContent = describeSort(sortMode);

    renderStats(all.map((t) => S.enrich(t, now, null, userZone)).filter(S.isRegisterable));
    moreOptionsSummary.textContent =
      `${S.timeZoneLabel(userZone)} · ${userCoords ? `Distances from ${userCoords.label}` : "No address set"}`;

    cardList.innerHTML = "";
    if (list.length === 0) {
      cardList.innerHTML = `
        <div class="empty-state">
          ${S.icon("search", "empty-state-icon")}
          <p class="empty-state-title">No events match your filters</p>
          <p>Try widening your search or clearing a filter.</p>
        </div>`;
      return;
    }
    for (const t of list) cardList.appendChild(renderCard(t));
  }

  // ---------- Header stats ----------

  /**
   * Three at-a-glance numbers in the header. They describe everything open
   * for registration, not the current filter, so they stay stable while the
   * visitor searches.
   */
  function renderStats(open) {
    if (!heroStats) return;
    const states = new Set(open.map((t) => t.state).filter(Boolean)).size;
    const upcoming = open
      .filter((t) => t.deadline && t.msUntilDeadline > 0)
      .sort((a, b) => a.deadline - b.deadline)[0];
    nextDeadlineAt = upcoming ? upcoming.deadline : null;

    heroStats.innerHTML = `
      <div class="stat"><span class="stat-value">${open.length}</span><span class="stat-label">open for registration</span></div>
      <div class="stat"><span class="stat-value">${states}</span><span class="stat-label">states</span></div>
      <div class="stat"><span class="stat-value" id="nextDeadlineStat">${nextDeadlineText(new Date())}</span><span class="stat-label">until the next deadline</span></div>
    `;
  }

  function nextDeadlineText(now) {
    if (!nextDeadlineAt) return "None set";
    const ms = nextDeadlineAt.getTime() - now.getTime();
    if (ms <= 0) return "Closing now";
    if (ms < 48 * 3600000) {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return h >= 1 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
    }
    const days = S.calendarDaysBetween(now, nextDeadlineAt, userZone);
    return days === 1 ? "1 day" : `${days} days`;
  }

  function describeSort(mode) {
    switch (mode) {
      case "deadline": return "Sorted by registration deadline, soonest first.";
      case "startDate": return "Sorted by tournament start date, soonest first.";
      case "distance":
        return userCoords ? `Sorted by distance from ${userCoords.label}.` : "Set your address above to sort by distance.";
      case "prize": return "Sorted by prize money, highest first.";
      case "entries": return "Sorted by number of entries, most first. Events that do not publish a count are listed last.";
      default: return "";
    }
  }

  /** Calendar-style tile showing the start date, for scanning down the list. */
  function renderDateTile(t) {
    if (!t.start) {
      return `<div class="event-date is-tbd" aria-hidden="true"><span class="event-date-month">Date</span><span class="event-date-day">TBD</span></div>`;
    }
    // Calendar dates are stored as UTC midnight, so read them back in UTC.
    const month = t.start.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
    const weekday = t.start.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" });
    return (
      `<div class="event-date" aria-hidden="true">` +
      `<span class="event-date-month">${month}</span>` +
      `<span class="event-date-day">${t.start.getUTCDate()}</span>` +
      `<span class="event-date-weekday">${weekday}</span></div>`
    );
  }

  function renderCard(t) {
    const card = document.createElement("article");
    card.className = "event-card" + (S.isLeague(t) ? " is-league" : "");

    const dateRange = S.formatDateRange(t.start, t.end);
    const location = [t.venue, t.city, t.state].filter(Boolean).map(S.escapeHtml).join(", ");
    const entriesLabel = S.entriesLabel(t);
    const note = S.deadlineNoteForDisplay(t);

    // Actual prize money is rare, so it is the only case that gets emphasis;
    // "none listed" is the common answer and stays quiet.
    const prize =
      t.prizeMoney != null
        ? { cls: "has-prize", text: "$" + Number(t.prizeMoney).toLocaleString() + " prize purse" }
        : t.prizeNote
        ? { cls: "", text: t.prizeNote }
        : { cls: "is-muted", text: "No prize money listed" };

    card.innerHTML = `
      ${renderDateTile(t)}
      <div class="event-main">
        <div class="event-tags">
          ${S.isLeague(t) ? `<span class="tag tag-league">${S.icon("repeat")}League</span>` : ""}
          ${t.level ? `<span class="tag">${S.escapeHtml(t.level)}</span>` : ""}
        </div>
        <h3 class="event-title">${S.escapeHtml(t.name)}</h3>
        <ul class="event-meta">
          ${location ? `<li>${S.icon("pin")}<span>${location}</span></li>` : ""}
          <li>${S.icon("calendar")}<span>${dateRange}</span></li>
          ${t.distanceMiles != null ? `<li>${S.icon("route")}<span>${t.distanceMiles.toFixed(0)} mi away</span></li>` : ""}
          ${entriesLabel ? `<li class="entries-meta" title="${S.escapeAttr(S.entriesTooltip(t))}">${S.icon("users")}<span>${S.escapeHtml(entriesLabel)}</span></li>` : ""}
        </ul>
        ${t.description ? `<p class="event-desc">${S.escapeHtml(t.description)}</p>` : ""}
        ${note ? `<p class="event-note">${S.icon("info")}<span>${S.escapeHtml(note)}</span></p>` : ""}
        <div class="event-foot">
          <span class="prize ${prize.cls}">${S.icon("trophy")}<span>${S.escapeHtml(prize.text)}</span></span>
          ${t.sourcePlatform ? `<span class="source-chip">via ${S.escapeHtml(t.sourcePlatform)}</span>` : ""}
        </div>
      </div>
      <div class="event-side">
        <div class="event-deadline">
          <span class="event-side-label">Registration</span>
          ${S.renderDeadlinePill(t)}
        </div>
        ${t.sourceUrl
          ? `<a class="link-btn" href="${S.escapeAttr(t.sourceUrl)}" target="_blank" rel="noopener"` +
            ` aria-label="View or register for ${S.escapeAttr(t.name)} (opens in a new tab)">View / Register${S.icon("arrow")}</a>`
          : ""}
      </div>
    `;

    return card;
  }

  // ---------- Geocoding ----------

  async function geocodeAndApply(query) {
    setAddressStatus("Looking up address…", false);
    applyAddressBtn.disabled = true;
    try {
      const geo = await S.geocode(query);
      if (!geo) {
        setAddressStatus("Couldn't find that address. Try a different format (e.g. add city and state).", true);
        return;
      }
      userCoords = { lat: geo.lat, lng: geo.lng, label: query };
      S.storeAddress(userCoords);
      setUsingAddressStatus(query);
      sortSelect.value = "distance";
      render();
    } catch (err) {
      setAddressStatus("Lookup failed. Check your internet connection and try again.", true);
    } finally {
      applyAddressBtn.disabled = false;
    }
  }

  function setAddressStatus(msg, isError) {
    addressStatus.textContent = msg;
    addressStatus.classList.toggle("error", !!isError);
  }

  /** Confirms the active location and points out how to clear it. */
  function setUsingAddressStatus(label) {
    setAddressStatus(`Using: ${label}. To clear it, empty the box and press Set address.`, false);
  }

  // ---------- Live countdown ----------

  /**
   * Updates each deadline pill in place once a second, so the time remaining
   * stays accurate without the visitor reloading. Only the countdown text is
   * touched, so scroll position, filters and sort order are left alone. If a
   * deadline actually lapses while the page is open, that entry is no longer
   * registerable, so the list is re-rendered to drop it.
   */
  function startCountdownTicker() {
    setInterval(() => {
      const now = new Date();
      let somethingLapsed = false;

      document.querySelectorAll("[data-deadline]").forEach((pill) => {
        const deadline = new Date(pill.getAttribute("data-deadline"));
        const msRemaining = deadline.getTime() - now.getTime();

        if (msRemaining <= 0) {
          somethingLapsed = true;
          return;
        }

        // Counted in the viewer's zone, matching the date printed in the pill.
        const calendarDays = S.calendarDaysBetween(now, deadline, userZone);
        const target = pill.querySelector(".deadline-countdown");
        if (!target) return;

        const label = S.countdownLabel(msRemaining, calendarDays);
        if (target.textContent !== label) target.textContent = label;

        // Keep the colour band honest as a deadline gets closer.
        const status = calendarDays <= 3 ? "urgent" : calendarDays <= 14 ? "soon" : "ok";
        if (!pill.classList.contains(status)) {
          pill.classList.remove("urgent", "soon", "ok");
          pill.classList.add(status);
        }
      });

      const stat = document.getElementById("nextDeadlineStat");
      if (stat) {
        // Once the soonest deadline passes, re-render so the stat moves on to
        // the next one (render also drops the lapsed card if it is visible).
        if (nextDeadlineAt && nextDeadlineAt.getTime() <= now.getTime()) somethingLapsed = true;
        else {
          const text = nextDeadlineText(now);
          if (stat.textContent !== text) stat.textContent = text;
        }
      }

      if (somethingLapsed) render();
    }, 1000);
  }

  // ---------- SEO: structured data ----------

  /**
   * Publishes the visible tournaments as schema.org SportsEvent entries so
   * search engines can read them as real events rather than plain text.
   */
  function injectStructuredData() {
    const now = new Date();
    const events = S.getAllTournaments()
      .map((t) => S.enrich(t, now, null, userZone))
      .filter(S.isRegisterable)
      .filter((t) => t.startDate)
      .slice(0, 50)
      .map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "SportsEvent",
          name: t.name,
          sport: "Badminton",
          startDate: t.startDate,
          endDate: t.endDate || t.startDate,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          url: t.sourceUrl || undefined,
          description: t.description || undefined,
          location: {
            "@type": "Place",
            name: t.venue || t.city,
            address: {
              "@type": "PostalAddress",
              streetAddress: t.address || undefined,
              addressLocality: t.city || undefined,
              addressRegion: t.state || undefined,
              addressCountry: "US",
            },
            geo:
              typeof t.lat === "number"
                ? { "@type": "GeoCoordinates", latitude: t.lat, longitude: t.lng }
                : undefined,
          },
        },
      }));

    const payload = [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "US Badminton Tournament Finder",
        url: "https://usbadmintontournaments.com/",
        description:
          "Find badminton tournaments and leagues across the United States, sorted by registration deadline, distance, or prize money.",
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Badminton tournaments in the United States open for registration",
        numberOfItems: events.length,
        itemListElement: events,
      },
    ];

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(payload);
    document.head.appendChild(script);
  }
})();
