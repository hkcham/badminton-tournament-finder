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

  const URGENCY_COLOR = {
    urgent: "#c62828",
    soon: "#b7791f",
    ok: "#157a4a",
    tbd: "#5a6b74",
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

    resultsCount.textContent = `${list.length} shown · ${located.length} on map`;

    if (unlocated > 0) {
      unlocatedNote.hidden = false;
      unlocatedNote.textContent = `${unlocated} matching tournament${unlocated === 1 ? "" : "s"} couldn't be placed on the map (no venue coordinates yet). Still visible in the sidebar list and the main List view.`;
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
      marker.bindPopup(renderPopup(t), { maxWidth: 280 });
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
    const deadlinePill = S.renderDeadlinePill(t);
    return `
      <div class="map-popup">
        <h4>${S.escapeHtml(t.name)}</h4>
        <div style="margin-bottom:6px;">
          ${S.isLeague(t) ? `<span class="badge league-badge">League</span> ` : ""}
          ${t.level ? `<span class="badge level">${S.escapeHtml(t.level)}</span>` : ""}
        </div>
        <div>${deadlinePill}</div>
        <div class="map-popup-meta">📍 ${S.escapeHtml(t.venue || "")}${t.city ? `, ${S.escapeHtml(t.city)}` : ""}${t.state ? `, ${S.escapeHtml(t.state)}` : ""}</div>
        <div class="map-popup-meta">📅 ${dateRange}</div>
        <div class="map-popup-meta">${t.prizeMoney != null ? "💰 $" + Number(t.prizeMoney).toLocaleString() + " prize purse" : ""}</div>
        ${t.sourceUrl ? `<a class="link-btn" style="margin-top:8px;display:inline-block;" href="${S.escapeAttr(t.sourceUrl)}" target="_blank" rel="noopener">View / Register →</a>` : ""}
      </div>
    `;
  }

  function renderSidebar(list) {
    sidebar.innerHTML = "";
    if (list.length === 0) {
      sidebar.innerHTML = `<div class="empty-state" style="padding:24px 14px;">No tournaments match your filters.</div>`;
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
          <strong>${S.isLeague(t) ? "🔁 " : ""}${S.escapeHtml(t.name)}</strong>
          <span>${t.city ? S.escapeHtml(t.city) + ", " : ""}${S.escapeHtml(t.state || "")} · ${S.formatDateRange(t.start, t.end)}</span>
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
