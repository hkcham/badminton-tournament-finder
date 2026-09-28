/**
 * US Badminton Tournament Finder: map view logic.
 * Renders a Leaflet map of the continental US with a marker per tournament
 * (colored by registration-deadline urgency, same language as the list view)
 * plus a synced sidebar list. Uses js/shared.js for data/formatting so this
 * page never drifts out of sync with the list view's rules.
 */

(function () {
  "use strict";

  const S = Shared;

  // Keep in step with the --*-dot colours in css/style.css so markers, the
  // legend and the sidebar dots all agree.
  const URGENCY_COLOR = {
    urgent: "#d32f2f",
    soon: "#d48806",
    ok: "#1f9c5c",
    tbd: "#7b8a92",
  };

  // ---------- DOM refs ----------
  const searchInput = document.getElementById("mapSearchInput");
  const stateFilter = document.getElementById("mapStateFilter");
  const typeFilter = document.getElementById("mapTypeFilter");
  const resultsCount = document.getElementById("mapResultsCount");
  const sidebar = document.getElementById("mapSidebar");
  const unlocatedNote = document.getElementById("mapUnlocatedNote");

  // ---------- Map setup ----------
  const map = L.map("mapContainer", {
    minZoom: 3,
    maxZoom: 12,
    maxBounds: [[5, -170], [72, -50]],
    maxBoundsViscosity: 0.6,
  }).setView([39.5, -98.35], 4);

  // Standard OpenStreetMap tiles, need no API key. A CSS grayscale filter
  // (see .leaflet-tile-pane in style.css) turns them into a light white/gray
  // base map so the page stays green-and-white themed with green markers.
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 19,
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  const markersById = new Map();
  let hasFitOnce = false;

  // ---------- Init ----------
  S.populateStateFilter(stateFilter);
  render();

  searchInput.addEventListener("input", S.debounce(render, 150));
  stateFilter.addEventListener("change", render);
  typeFilter.addEventListener("change", render);

  // ---------- Core rendering ----------

  function render() {
    const all = S.getAllTournaments();
    const now = new Date();
    const query = searchInput.value.trim().toLowerCase();
    const stateVal = stateFilter.value;
    const typeVal = typeFilter.value;

    let list = all.map((t) => S.enrich(t, now, null));
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

    list = S.sortList(list, "deadline");

    const located = list.filter((t) => typeof t.lat === "number" && typeof t.lng === "number");
    const unlocated = list.length - located.length;

    resultsCount.innerHTML = `<strong>${list.length}</strong> event${list.length === 1 ? "" : "s"} <span class="results-breakdown">${located.length} on the map</span>`;

    if (unlocated > 0) {
      unlocatedNote.hidden = false;
      unlocatedNote.textContent = `${unlocated} matching tournament${unlocated === 1 ? "" : "s"} couldn't be placed on the map (no venue coordinates yet). Still visible in the sidebar list and on the Tournaments page.`;
    } else {
      unlocatedNote.hidden = true;
    }

    renderMarkers(located);
    renderSidebar(list);
    fitToMarkers(located);
  }

  function fitToMarkers(located) {
    if (located.length === 0) return;
    const bounds = L.latLngBounds(located.map((t) => [t.lat, t.lng]));
    // First paint: fit instantly (all 37+ tournaments ≈ the default US view
    // anyway). After that, animate so filtering feels like the map responding.
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 9, animate: hasFitOnce });
    hasFitOnce = true;
  }

  function renderMarkers(list) {
    markerLayer.clearLayers();
    markersById.clear();

    const jittered = jitterOverlaps(list);

    for (const t of jittered) {
      const status = S.urgencyStatus(t);
      const color = URGENCY_COLOR[status] || URGENCY_COLOR.ok;
      const marker = S.isLeague(t)
        ? L.marker([t._lat, t._lng], {
            icon: L.divIcon({
              className: "league-marker-icon",
              html: `<span style="background:${color};"></span>`,
              iconSize: [15, 15],
              iconAnchor: [7, 7],
              popupAnchor: [0, -7],
            }),
          })
        : L.circleMarker([t._lat, t._lng], {
            radius: 8,
            weight: 2,
            color: "#ffffff",
            fillColor: color,
            fillOpacity: 0.95,
          });
      marker.bindPopup(renderPopup(t), { maxWidth: 300, minWidth: 250 });
      marker.on("click", () => highlightSidebarRow(t.id));
      marker.addTo(markerLayer);
      markersById.set(t.id, marker);
    }
  }

  /**
   * Spreads tournaments that share (near-)identical coordinates into a small
   * ring around the shared point, so overlapping markers stay individually
   * clickable instead of stacking into one dot. Sets _lat/_lng on each item.
   */
  function jitterOverlaps(list) {
    const groups = new Map();
    for (const t of list) {
      const key = `${t.lat.toFixed(2)},${t.lng.toFixed(2)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    const out = [];
    for (const group of groups.values()) {
      const n = group.length;
      group.forEach((t, i) => {
        if (n === 1) {
          out.push({ ...t, _lat: t.lat, _lng: t.lng });
        } else {
          const angle = (2 * Math.PI * i) / n;
          const radiusDeg = 0.09;
          out.push({
            ...t,
            _lat: t.lat + radiusDeg * Math.sin(angle),
            _lng: t.lng + radiusDeg * Math.cos(angle),
          });
        }
      });
    }
    return out;
  }

  function renderPopup(t) {
    const dateRange = S.formatDateRange(t.start, t.end);
    const location = [t.venue, t.city, t.state].filter(Boolean).map(S.escapeHtml).join(", ");
    const entries = S.entriesLabel(t);
    const note = S.deadlineNoteForDisplay(t);
    return `
      <div class="map-popup">
        <div class="event-tags">
          ${S.isLeague(t) ? `<span class="tag tag-league">${S.icon("repeat")}League</span>` : ""}
          ${t.level ? `<span class="tag">${S.escapeHtml(t.level)}</span>` : ""}
        </div>
        <h4>${S.escapeHtml(t.name)}</h4>
        ${S.renderDeadlinePill(t)}
        <ul class="event-meta event-meta-stacked">
          ${location ? `<li>${S.icon("pin")}<span>${location}</span></li>` : ""}
          <li>${S.icon("calendar")}<span>${dateRange}</span></li>
          ${entries ? `<li class="entries-meta" title="${S.escapeAttr(S.entriesTooltip(t))}">${S.icon("users")}<span>${S.escapeHtml(entries)}</span></li>` : ""}
          ${t.prizeMoney != null ? `<li class="prize has-prize">${S.icon("trophy")}<span>$${Number(t.prizeMoney).toLocaleString()} prize purse</span></li>` : ""}
        </ul>
        ${note ? `<p class="event-note">${S.icon("info")}<span>${S.escapeHtml(note)}</span></p>` : ""}
        ${t.sourceUrl
          ? `<a class="link-btn" href="${S.escapeAttr(t.sourceUrl)}" target="_blank" rel="noopener"` +
            ` aria-label="View or register for ${S.escapeAttr(t.name)} (opens in a new tab)">View / Register${S.icon("arrow")}</a>`
          : ""}
      </div>
    `;
  }

  function renderSidebar(list) {
    sidebar.innerHTML = "";
    if (list.length === 0) {
      sidebar.innerHTML = `<div class="empty-state empty-state-compact">No events match your filters.</div>`;
      return;
    }
    for (const t of list) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "map-sidebar-row";
      row.dataset.id = t.id;
      const hasLoc = typeof t.lat === "number" && typeof t.lng === "number";
      const status = S.urgencyStatus(t);
      const shapeClass = S.isLeague(t) ? "legend-dot shape-square" : "legend-dot";
      row.innerHTML = `
        <span class="${shapeClass} ${status}" style="${hasLoc ? "" : "opacity:.25;"}"></span>
        <span class="map-sidebar-row-text">
          <strong>${S.escapeHtml(t.name)}</strong>
          <span>${S.isLeague(t) ? `<span class="mini-tag">League</span>` : ""}${t.city ? S.escapeHtml(t.city) + ", " : ""}${S.escapeHtml(t.state || "")} · ${S.formatDateRange(t.start, t.end)}</span>
        </span>
      `;
      row.addEventListener("click", () => {
        if (!hasLoc) return;
        const marker = markersById.get(t.id);
        if (!marker) return;
        map.flyTo(marker.getLatLng(), 8, { duration: 0.6 });
        marker.openPopup();
        highlightSidebarRow(t.id);
      });
      sidebar.appendChild(row);
    }
  }

  function highlightSidebarRow(id) {
    sidebar.querySelectorAll(".map-sidebar-row").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === id);
    });
    const el = sidebar.querySelector(`.map-sidebar-row[data-id="${CSS.escape(id)}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
})();
