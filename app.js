// SkyEye — unified Telescope & Access Finder.
// Loads the single pre-built dataset at data/observations.json (see
// scripts/build_integration.py + scripts/build_unified.py for how it's generated from the
// frozen research edition under research/) and renders one sortable, filterable table plus
// an optional map. No other data fetch happens at runtime.

const GITHUB_REPO = "astro-lenny/skyeye-db"; // update if you fork/rename this repo
document.getElementById("contribute-btn").href = `https://github.com/${GITHUB_REPO}/issues/new?template=feature_request.md`;
document.getElementById("report-bug-btn").href = `https://github.com/${GITHUB_REPO}/issues/new?template=bug_report.md`;

const CAPABILITIES = [
  ["polarimetry", "Polarimetry"],
  ["interferometry", "Interferometry"],
  ["ao", "Adaptive optics"],
  ["spectroscopy", "Spectroscopy"],
  ["imaging", "Imaging"],
  ["mos", "Multi-object spectroscopy"],
  ["ifu", "IFU"],
];

// ---------- Unit conversion (for the query value the user types, not the stored data --
// every row's numeric range is already precomputed in meters by the Python build step) ----------
const C = 299792458;
const HC_EV_M = 1.239841984e-6;
const LENGTH_M = { pm: 1e-12, angstrom: 1e-10, nm: 1e-9, um: 1e-6, mm: 1e-3, cm: 1e-2, m: 1 };
const FREQ_HZ = { hz: 1, khz: 1e3, mhz: 1e6, ghz: 1e9, thz: 1e12 };
const ENERGY_EV = { ev: 1, kev: 1e3, mev: 1e6, gev: 1e9, tev: 1e12 };
const ANGLE_ARCSEC = { uas: 1e-6, mas: 1e-3, arcsec: 1, arcmin: 60, deg: 3600 };

function toMeters(value, unit) {
  if (value == null) return null;
  const u = String(unit).toLowerCase();
  if (u in LENGTH_M) return value * LENGTH_M[u];
  if (u in FREQ_HZ) { const hz = value * FREQ_HZ[u]; return hz > 0 ? C / hz : null; }
  if (u in ENERGY_EV) { const ev = value * ENERGY_EV[u]; return ev > 0 ? HC_EV_M / ev : null; }
  return null;
}
function toArcsec(value, unit) {
  const u = String(unit).toLowerCase();
  return value == null || !(u in ANGLE_ARCSEC) ? null : value * ANGLE_ARCSEC[u];
}
const toNum = v => { const n = Number(v); return v !== "" && Number.isFinite(n) ? n : null; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const unique = arr => [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ""))].sort((a, b) => String(a).localeCompare(String(b)));
const checked = id => [...document.querySelectorAll(`#${id} input:checked`)].map(cb => cb.value);
const le = (a, b) => a <= b * (1 + 1e-9);
const ge = (a, b) => a >= b * (1 - 1e-9);

let ROWS = [];
let sortKey = null, sortDir = 1;
let expanded = new Set();
let currentView = "table";
let map = null, markerLayer = null;

function buildFacet(containerId, values, { title } = {}) {
  const box = document.getElementById(containerId);
  box.innerHTML = "";
  for (const v of values) {
    const label = document.createElement("label");
    if (title) label.title = title;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = v;
    label.append(cb, " " + v);
    box.append(label);
  }
}

fetch("data/observations.json")
  .then(r => r.json())
  .then(data => {
    ROWS = data;
    buildFacet("wavebands", unique(ROWS.map(r => r.waveband_category)));
    buildFacet("capabilities", CAPABILITIES.map(c => c[1]));
    buildFacet("hemispheres", unique(ROWS.map(r => r.hemisphere)));
    buildFacet("categories", unique(ROWS.map(r => r.category)));
    buildFacet("statuses", unique(ROWS.map(r => r.proposal_access_status)));
    buildFacet("regions", unique(ROWS.map(r => r.region)));
    initMap();
    render();
  })
  .catch(err => {
    document.getElementById("count").textContent = "Could not load data/observations.json: " + err;
  });

document.getElementById("filters").addEventListener("input", render);
document.getElementById("reset").addEventListener("click", () => {
  document.querySelectorAll("#filters input[type=checkbox]").forEach(el => { el.checked = false; });
  document.querySelectorAll("#filters input[type=number], #filters input[type=search]").forEach(el => { el.value = ""; });
  document.getElementById("eligibleOnly").checked = true;
  document.getElementById("hideAggregates").checked = true;
  document.getElementById("minElevation").value = "30";
  document.querySelector('input[name=wmode][value=overlap]').checked = true;
  render();
});

document.querySelectorAll("th[data-key]").forEach(th =>
  th.addEventListener("click", () => {
    const k = th.dataset.key;
    sortDir = sortKey === k ? -sortDir : 1;
    sortKey = k;
    render();
  })
);

document.querySelectorAll("#view-toggle button").forEach(btn =>
  btn.addEventListener("click", () => {
    currentView = btn.dataset.view;
    document.querySelectorAll("#view-toggle button").forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    document.getElementById("map").hidden = currentView !== "map";
    document.getElementById("table-wrap").hidden = currentView !== "table";
    if (currentView === "map" && map) setTimeout(() => map.invalidateSize(), 50);
    render();
  })
);

// ---------- Peak elevation at transit: 90 - |latitude - declination|, evaluated at the
// point within [decMin, decMax] closest to the facility's latitude (best case within range).
function peakElevation(latitude, decMin, decMax) {
  if (latitude == null || decMin == null) return null;
  const lo = decMin, hi = decMax == null ? decMin : decMax;
  const evalDec = Math.min(Math.max(latitude, Math.min(lo, hi)), Math.max(lo, hi));
  return 90 - Math.abs(latitude - evalDec);
}

function getMatches() {
  const text = document.getElementById("search").value.toLowerCase().trim();
  const wunit = document.getElementById("wunit").value;
  const qValues = [toMeters(toNum(document.getElementById("wmin").value), wunit),
                   toMeters(toNum(document.getElementById("wmax").value), wunit)].filter(v => v != null);
  const q = qValues.length ? qValues : null;
  const qLo = q ? Math.min(...q) : null, qHi = q ? Math.max(...q) : null;
  const wmode = document.querySelector('input[name="wmode"]:checked').value;

  const bands = checked("wavebands");
  const caps = checked("capabilities");
  const hemis = checked("hemispheres");
  const cats = checked("categories");
  const statuses = checked("statuses");
  const regions = checked("regions");
  const eligibleOnly = document.getElementById("eligibleOnly").checked;
  const hideAggregates = document.getElementById("hideAggregates").checked;
  const coordsOnly = document.getElementById("coordsOnly").checked;

  const minR = toNum(document.getElementById("minR").value);
  const maxR = toNum(document.getElementById("maxR").value);
  const spatQ = toArcsec(toNum(document.getElementById("spat").value), document.getElementById("spatunit").value);
  const fovQ = toArcsec(toNum(document.getElementById("fov").value), document.getElementById("fovunit").value);

  const decMin = toNum(document.getElementById("decMin").value);
  const decMax = toNum(document.getElementById("decMax").value);
  const minElevation = toNum(document.getElementById("minElevation").value);

  const affiliation = document.getElementById("affiliation").value.toLowerCase().trim();

  return ROWS.filter(r => {
    if (eligibleOnly && !r.eligible) return false;
    if (hideAggregates && r.is_aggregate) return false;
    if (coordsOnly && !r.has_known_coordinates) return false;

    if (q) {
      if (r.lam_lo_m == null) return false;
      const ok = wmode === "overlap"
        ? le(r.lam_lo_m, qHi) && ge(r.lam_hi_m, qLo)
        : le(r.lam_lo_m, qLo) && ge(r.lam_hi_m, qHi);
      if (!ok) return false;
    }
    if (bands.length && !bands.includes(r.waveband_category)) return false;
    if (!caps.every(label => r.capabilities[CAPABILITIES.find(c => c[1] === label)[0]] === true)) return false;

    if (minR != null && !(r.spec_res_best != null && r.spec_res_best >= minR)) return false;
    if (maxR != null && !(r.spec_res_best != null && r.spec_res_best <= maxR)) return false;
    if (spatQ != null && !(r.spat_res_arcsec_best != null && le(r.spat_res_arcsec_best, spatQ))) return false;
    if (fovQ != null && !(r.fov_arcsec_best != null && ge(r.fov_arcsec_best, fovQ))) return false;

    if (decMin != null) {
      const elev = peakElevation(r.latitude_deg, decMin, decMax);
      if (elev == null || elev < (minElevation ?? 0)) return false;
    }

    if (hemis.length && !hemis.includes(r.hemisphere)) return false;
    if (cats.length && !cats.includes(r.category)) return false;
    if (statuses.length && !statuses.includes(r.proposal_access_status)) return false;
    if (regions.length && !regions.includes(r.region)) return false;

    if (affiliation && !r.eligibility_text.toLowerCase().includes(affiliation)) return false;

    if (text) {
      const hay = [r.official_name, r.instrument_name, r.country, r.operator, r.region].join(" ").toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

// ---------- Rendering ----------
function statusBadge(status) {
  const known = ["active", "between_cycles", "suspended", "future"];
  const cls = known.includes(status) ? status : "unknown";
  return `<span class="badge badge-${cls}">${esc(status || "unknown")}</span>`;
}
function wavebandChip(cat) {
  const slug = String(cat || "unknown").toLowerCase().replace(/[^a-z]+/g, "-");
  return `<span class="chip chip-${slug}">${esc(cat || "Unknown")}</span>`;
}
function fmt(v, suffix = "") {
  if (v == null) return '<span class="muted">—</span>';
  return typeof v === "number" ? `${+v.toPrecision(6)}${suffix}` : esc(v);
}
function capBadges(caps) {
  const yes = CAPABILITIES.filter(([k]) => caps[k] === true).map(([, label]) => label);
  if (!yes.length) return '<span class="muted">—</span>';
  return yes.map(l => `<span class="badge badge-cap">${esc(l)}</span>`).join(" ");
}

function hemisphereCell(r) {
  const decMin = toNum(document.getElementById("decMin").value);
  if (decMin != null && r.latitude_deg != null) {
    const decMax = toNum(document.getElementById("decMax").value);
    const elev = peakElevation(r.latitude_deg, decMin, decMax);
    return `${esc(r.hemisphere || "?")} <span class="muted">· peak alt. ${elev.toFixed(0)}°</span>`;
  }
  if (!r.hemisphere) return '<span class="muted">unknown</span>';
  const proxy = r.is_coordinate_proxy ? ' <span class="muted" title="Shared-site or registry proxy coordinate">(proxy)</span>' : "";
  return `${esc(r.hemisphere)}${r.latitude_deg != null ? ` <span class="muted">${r.latitude_deg.toFixed(1)}°</span>${proxy}` : ""}`;
}

function routeCard(route) {
  const parts = [
    ["Eligibility", route.eligibility],
    ["Fees", route.fees],
    ["Deadline (as found)", route.deadline],
    ["Call window status", route.call_window_status],
    ["Latest call found", route.latest_call_found],
    ["Allocation process", route.allocation_process],
    ["Covered instruments", (route.covered_instruments || []).join(", ")],
    ["Funding vs. observing", route.funding_vs_observing_note],
  ].filter(([, v]) => v && v !== "unknown");
  const portal = route.submission_portal && route.submission_portal !== "unknown"
    ? `<a href="${esc(route.submission_portal)}" target="_blank" rel="noopener">${esc(route.submission_portal)}</a>`
    : '<span class="muted">unknown</span>';
  return `<div class="route-card">
    <h4>${esc(route.programme_name || route.programme_id)} ${statusBadge(route.programme_status)}</h4>
    <dl>${parts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}<dt>Submission portal</dt><dd>${portal}</dd></dl>
  </div>`;
}

function detailHtml(r) {
  const caveats = [];
  if (r.is_aggregate) caveats.push(r.physical_count_caveat || "This is a network / aggregate access-scope entry, not an independent physical telescope.");
  if (r.has_known_coordinates && r.is_coordinate_proxy) caveats.push("Coordinates are a shared-site or registry proxy (" + esc(r.coordinate_notes || "") + "), not a dedicated survey of this facility.");
  if (r.declination_bounds_status) caveats.push("Declination / elevation figures: " + esc(r.declination_bounds_status) + ".");

  return `<div class="detail-wrap">
    ${r.notes ? `<p>${esc(r.notes)}</p>` : ""}
    <dl class="route-card"><dl>
      <dt>Operator</dt><dd>${esc(r.operator ?? "unknown")}</dd>
      <dt>Wavelength coverage (as documented)</dt><dd>${esc(r.wavelength_display ?? "unknown")}</dd>
      ${r.aperture_m ? `<dt>Aperture</dt><dd>${esc(r.aperture_m)}</dd>` : ""}
      ${r.instrument_access ? `<dt>Instrument-level access note</dt><dd>${esc(r.instrument_access)}</dd>` : ""}
      <dt>Official URL</dt><dd>${r.official_url ? `<a href="${esc(r.official_url)}" target="_blank" rel="noopener">${esc(r.official_url)}</a>` : "unknown"}</dd>
    </dl></dl>
    ${caveats.map(c => `<div class="caveat">⚠ ${c}</div>`).join("")}
    <h3>Documented access routes (${r.routes.length})</h3>
    ${r.routes.length ? r.routes.map(routeCard).join("") : '<p class="muted">No documented route in this edition yet.</p>'}
  </div>`;
}

function td(html, label = "") {
  // Wrapped in one element so the mobile card layout (which turns <td> into a flex
  // container) treats multi-node cell content -- badges, chips -- as a single flex
  // item that wraps internally, instead of each node becoming its own flex item.
  const el = document.createElement("td");
  el.innerHTML = `<span class="cell">${html}</span>`;
  if (label) el.dataset.label = label;
  return el;
}

function updateSortArrows() {
  document.querySelectorAll("th[data-key]").forEach(th => {
    const arrow = th.querySelector(".sort-arrow");
    if (th.dataset.key === sortKey) {
      arrow.textContent = sortDir > 0 ? " ▲" : " ▼";
      th.setAttribute("aria-sort", sortDir > 0 ? "ascending" : "descending");
    } else {
      arrow.textContent = "";
      th.removeAttribute("aria-sort");
    }
  });
}

function render() {
  const out0 = getMatches();
  let out = out0;
  if (sortKey) {
    out = [...out].sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === "string" ? x.localeCompare(y) : x - y;
      return c * sortDir;
    });
  }
  updateSortArrows();

  document.getElementById("count").textContent = `${out.length} of ${ROWS.length} observing options match`;
  document.getElementById("show-results").textContent = `Show ${out.length} results`;

  const tbody = document.getElementById("results");
  tbody.innerHTML = "";
  for (const r of out) {
    const tr = document.createElement("tr");
    tr.className = "facility-row";
    tr.append(
      td(`${esc(r.official_name)}${r.is_aggregate ? ' <span class="badge badge-aggregate">aggregate</span>' : ""}`, "Facility"),
      td(r.instrument_name ? esc(r.instrument_name) : '<span class="muted">—</span>', "Instrument"),
      td(esc(r.facility_type || r.entity_class), "Type"),
      td(wavebandChip(r.waveband_category), "Waveband"),
      td(esc(r.wavelength_display) || '<span class="muted">unknown</span>', "Wavelength/Freq."),
      td(capBadges(r.capabilities), "Capabilities"),
      td(fmt(r.spec_res_best), "Spectral Res."),
      td(fmt(r.spat_res_arcsec_best, '"'), "Spatial Res."),
      td(fmt(r.fov_arcsec_best, '"'), "FOV"),
      td(`${esc(r.country)}<br><span class="muted">${esc(r.region)}</span>`, "Country/Region"),
      td(hemisphereCell(r), "Hemisphere"),
      td(statusBadge(r.proposal_access_status), "Status"),
      td(String(r.route_count), "Programmes"),
    );
    tr.addEventListener("click", () => {
      if (expanded.has(r.row_id)) expanded.delete(r.row_id); else expanded.add(r.row_id);
      render();
    });
    tbody.append(tr);

    if (expanded.has(r.row_id)) {
      const dtr = document.createElement("tr");
      dtr.className = "detail-row";
      const dtd = document.createElement("td");
      dtd.colSpan = 13;
      dtd.innerHTML = detailHtml(r);
      dtr.append(dtd);
      tbody.append(dtr);
    }
  }

  if (currentView === "map") renderMap(out);
}

// ---------- Map ----------
function initMap() {
  map = L.map("map", { worldCopyJump: true }).setView([15, 10], 2);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function renderMap(rows) {
  if (!map) return;
  markerLayer.clearLayers();
  const byFacility = new Map();
  for (const r of rows) {
    if (!r.has_known_coordinates) continue;
    if (!byFacility.has(r.facility_id)) byFacility.set(r.facility_id, r);
  }
  for (const r of byFacility.values()) {
    const marker = L.circleMarker([r.latitude_deg, r.longitude_deg], {
      radius: 6,
      color: r.category === "space" ? "#9333ea" : r.hemisphere === "S" ? "#0891b2" : "#dc6803",
      fillOpacity: 0.85,
    }).addTo(markerLayer);
    marker.bindPopup(
      `<strong>${esc(r.official_name)}</strong><br>${esc(r.country)}<br>${esc(r.waveband_category)}` +
      `<br><button type="button" class="map-popup-link" data-row="${esc(r.row_id)}">Show in table</button>`
    );
    marker.on("popupopen", e => {
      const btn = e.popup.getElement().querySelector(".map-popup-link");
      if (btn) btn.addEventListener("click", () => {
        currentView = "table";
        document.querySelectorAll("#view-toggle button").forEach(b => b.classList.toggle("active", b.dataset.view === "table"));
        document.getElementById("map").hidden = true;
        document.getElementById("table-wrap").hidden = false;
        expanded.add(btn.dataset.row);
        render();
        document.getElementById("table-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
}

// ---------- Mobile filter panel ----------
const filterPanel = document.getElementById("filters");
const setPanelOpen = open => {
  filterPanel.classList.toggle("open", open);
  document.body.classList.toggle("noscroll", open);
  if (open) filterPanel.scrollTop = 0;
};
document.getElementById("open-filters").addEventListener("click", () => setPanelOpen(true));
document.getElementById("show-results").addEventListener("click", () => setPanelOpen(false));
document.addEventListener("keydown", e => { if (e.key === "Escape") setPanelOpen(false); });
