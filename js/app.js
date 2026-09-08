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

  // ---------- Init ----------
  if (userCoords) {
    addressInput.value = userCoords.label;
    setAddressStatus(`Using: ${userCoords.label}`, false);
  }
  S.populateStateFilter(stateFilter);
  render();

  // ---------- Event wiring ----------
  searchInput.addEventListener("input", S.debounce(render, 150));
  stateFilter.addEventListener("change", render);
  typeFilter.addEventListener("change", render);
  sortSelect.addEventListener("change", render);

  applyAddressBtn.addEventListener("click", async () => {
    const query = addressInput.value.trim();
    if (!query) {
      setAddressStatus("Enter an address first.", true);
      return;
    }
    await geocodeAndApply(query);
  });

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
        setAddressStatus("Using your current location.", false);
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

    let list = all.map((t) => S.enrich(t, now, userCoords));

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
      default: return "";
    }
  }

  function renderCard(t) {
    const card = document.createElement("div");
    card.className = "card" + (S.isLeague(t) ? " is-league" : "");

    const dateRange = S.formatDateRange(t.start, t.end);
    const deadlinePill = S.renderDeadlinePill(t);

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
      setAddressStatus(`Using: ${query}`, false);
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
})();
