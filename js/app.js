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
    const countLabel = leagueCount > 0 && typeVal === ""
      ? `${list.length} shown (${leagueCount} league${leagueCount === 1 ? "" : "s"}, ${list.length - leagueCount} tournament${list.length - leagueCount === 1 ? "" : "s"})`
      : `${list.length} ${typeVal === "league" ? "league" : "tournament"}${list.length === 1 ? "" : "s"} shown`;
    resultsCount.textContent = countLabel;
    sortDescription.textContent = describeSort(sortMode);

    cardList.innerHTML = "";
    if (list.length === 0) {
      cardList.innerHTML = `<div class="empty-state">No tournaments match your filters right now. Try widening your search.</div>`;
      return;
    }
    for (const t of list) cardList.appendChild(renderCard(t));
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

  function renderCard(t) {
    const card = document.createElement("div");
    card.className = "card" + (S.isLeague(t) ? " is-league" : "");

    const dateRange = S.formatDateRange(t.start, t.end);
    const deadlinePill = S.renderDeadlinePill(t);
    const entriesLabel = S.entriesLabel(t);

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title-row">
          ${S.isLeague(t) ? `<span class="badge league-badge">League</span>` : ""}
          <h3>${S.escapeHtml(t.name)}</h3>
          ${t.level ? `<span class="badge level">${S.escapeHtml(t.level)}</span>` : ""}
        </div>
        ${deadlinePill}
      </div>
      <div class="card-meta">
        <span class="meta-item">📍 ${S.escapeHtml(t.venue || "")}${t.city ? `, ${S.escapeHtml(t.city)}` : ""}${t.state ? `, ${S.escapeHtml(t.state)}` : ""}</span>
        <span class="meta-item">📅 ${dateRange}</span>
        ${t.distanceMiles != null ? `<span class="meta-item">📏 ${t.distanceMiles.toFixed(0)} mi away</span>` : ""}
        ${entriesLabel ? `<span class="meta-item entries-meta" title="${S.escapeAttr(S.entriesTooltip(t))}">👥 ${S.escapeHtml(entriesLabel)}</span>` : ""}
        ${t.sourcePlatform ? `<span class="badge source">${S.escapeHtml(t.sourcePlatform)}</span>` : ""}
      </div>
      ${t.description ? `<p class="card-desc">${S.escapeHtml(t.description)}</p>` : ""}
      <div class="card-footer">
        <span class="prize">${t.prizeMoney != null ? "$" + Number(t.prizeMoney).toLocaleString() + " prize purse" : (t.prizeNote ? S.escapeHtml(t.prizeNote) : "No prize money listed")}</span>
        ${t.sourceUrl ? `<a class="link-btn" href="${S.escapeAttr(t.sourceUrl)}" target="_blank" rel="noopener">View / Register →</a>` : ""}
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
