// Facility & Access Finder — reads the pre-joined view model at data/webapp_facilities.json,
// built from the research/2026-10-25-intermediate-363 frozen edition by scripts documented in
// docs/data_dictionary.md. See that file (and research/.../coverage_audit.md) for everything
// this data does and does not claim.

let FACILITIES = [];
let sortKey = null, sortDir = 1;
let expanded = new Set();

const unique = arr => [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ""))]
  .sort((a, b) => String(a).localeCompare(String(b)));
const checked = id => [...document.querySelectorAll(`#${id} input:checked`)].map(cb => cb.value);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function buildFacet(containerId, values, { checkedByDefault = [] } = {}) {
  const box = document.getElementById(containerId);
  box.innerHTML = "";
  for (const v of values) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = v;
    if (checkedByDefault.includes(v)) cb.checked = true;
    label.append(cb, " " + v);
    box.append(label);
  }
}

function statusBadge(status) {
  const known = ["active", "between_cycles", "suspended", "future"];
  const cls = known.includes(status) ? status : "unknown";
  return `<span class="badge badge-${cls}">${esc(status || "unknown")}</span>`;
}

function coordText(f) {
  if (!f.has_known_coordinates) return '<span class="muted">unknown</span>';
  const proxy = f.is_shared_site_or_registry_proxy
    ? ' <span class="muted" title="Shared-site or registry proxy coordinate, not a surveyed telescope position">(site proxy)</span>'
    : "";
  return `${f.latitude_deg.toFixed(3)}, ${f.longitude_deg.toFixed(3)}${proxy}`;
}

function decText(f) {
  if (f.min_declination_deg == null || f.max_declination_deg == null) return '<span class="muted">unknown</span>';
  return `${f.min_declination_deg.toFixed(1)}° to ${f.max_declination_deg.toFixed(1)}°`;
}

fetch("data/webapp_facilities.json")
  .then(r => r.json())
  .then(data => {
    FACILITIES = data;
    buildFacet("categories", unique(FACILITIES.map(f => f.category)));
    buildFacet("hemispheres", unique(FACILITIES.map(f => f.hemisphere)));
    buildFacet("statuses", unique(FACILITIES.map(f => f.proposal_access_status)));
    buildFacet("regions", unique(FACILITIES.map(f => f.region)));
    render();
  })
  .catch(err => {
    document.getElementById("count").textContent = "Could not load data/webapp_facilities.json: " + err;
  });

document.getElementById("filters").addEventListener("input", render);
document.getElementById("reset").addEventListener("click", () => {
  document.querySelectorAll("#filters input[type=checkbox]").forEach(el => { el.checked = false; });
  document.getElementById("eligibleOnly").checked = true;
  document.getElementById("hideAggregates").checked = true;
  document.getElementById("search").value = "";
  document.getElementById("decTarget").value = "";
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

function getMatches() {
  const text = document.getElementById("search").value.toLowerCase().trim();
  const eligibleOnly = document.getElementById("eligibleOnly").checked;
  const hideAggregates = document.getElementById("hideAggregates").checked;
  const coordsOnly = document.getElementById("coordsOnly").checked;
  const cats = checked("categories");
  const hemis = checked("hemispheres");
  const statuses = checked("statuses");
  const regions = checked("regions");
  const decRaw = document.getElementById("decTarget").value;
  const decTarget = decRaw === "" ? null : Number(decRaw);

  return FACILITIES.filter(f => {
    if (eligibleOnly && !f.eligible) return false;
    if (hideAggregates && f.is_aggregate_not_physical_telescope) return false;
    if (coordsOnly && !f.has_known_coordinates) return false;
    if (cats.length && !cats.includes(f.category)) return false;
    if (hemis.length && !hemis.includes(f.hemisphere)) return false;
    if (statuses.length && !statuses.includes(f.proposal_access_status)) return false;
    if (regions.length && !regions.includes(f.region)) return false;
    if (decTarget !== null) {
      if (f.min_declination_deg == null || f.max_declination_deg == null) return false;
      if (decTarget < f.min_declination_deg || decTarget > f.max_declination_deg) return false;
    }
    if (text) {
      const hay = [f.official_name, f.country, f.operator, f.region, f.location]
        .join(" ").toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

function routeCard(r) {
  const parts = [
    ["Eligibility", r.eligibility],
    ["Fees", r.fees],
    ["Deadline (as found)", r.deadline],
    ["Call window status", r.call_window_status],
    ["Latest call found", r.latest_call_found],
    ["Allocation process", r.allocation_process],
    ["Covered instruments", (r.covered_instruments || []).join(", ")],
    ["Funding vs. observing", r.funding_vs_observing_note],
  ].filter(([, v]) => v && v !== "unknown");

  const portal = r.submission_portal && r.submission_portal !== "unknown"
    ? `<a href="${esc(r.submission_portal)}" target="_blank" rel="noopener">${esc(r.submission_portal)}</a>`
    : '<span class="muted">unknown</span>';

  return `<div class="route-card">
    <h4>${esc(r.programme_name || r.programme_id)} ${statusBadge(r.route_status === "documented_route" ? r.programme_status : r.route_status)}</h4>
    <dl>
      ${parts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}
      <dt>Submission portal</dt><dd>${portal}</dd>
    </dl>
  </div>`;
}

function detailHtml(f) {
  const caveats = [];
  if (f.is_aggregate_not_physical_telescope) {
    caveats.push(f.physical_count_caveat || "This is a network / aggregate access-scope entry, not an independent physical telescope.");
  }
  if (f.has_known_coordinates && f.is_shared_site_or_registry_proxy) {
    caveats.push("Coordinates are a shared-site or registry proxy (" + esc(f.coordinate_notes || "") + "), not a dedicated survey of this facility.");
  }
  if (f.declination_bounds_status) {
    caveats.push("Declination bounds: " + esc(f.declination_bounds_status) + ".");
  }

  return `<div class="detail-wrap">
    ${f.notes ? `<p>${esc(f.notes)}</p>` : ""}
    <dl class="route-card">
      <dl>
        <dt>Operator</dt><dd>${esc(f.operator ?? "unknown")}</dd>
        <dt>Wavelength coverage</dt><dd>${esc(f.wavelength_coverage ?? "unknown")}</dd>
        <dt>Aperture</dt><dd>${esc(f.aperture_m ?? "unknown")}</dd>
        <dt>Observing modes</dt><dd>${esc(f.observing_modes ?? "unknown")}</dd>
        <dt>Technical constraints</dt><dd>${esc(f.technical_constraints ?? "unknown")}</dd>
        <dt>Official URL</dt><dd>${f.official_url ? `<a href="${esc(f.official_url)}" target="_blank" rel="noopener">${esc(f.official_url)}</a>` : "unknown"}</dd>
      </dl>
    </dl>
    ${caveats.map(c => `<div class="caveat">⚠ ${c}</div>`).join("")}
    <h3>Documented access routes (${f.routes.length})</h3>
    ${f.routes.length ? f.routes.map(routeCard).join("") : '<p class="muted">No documented route in this edition yet.</p>'}
  </div>`;
}

function td(html, label = "") {
  const el = document.createElement("td");
  el.innerHTML = html;
  if (label) el.dataset.label = label;
  return el;
}

function render() {
  let out = getMatches();
  if (sortKey) {
    out = [...out].sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === "string" ? x.localeCompare(y) : x - y;
      return c * sortDir;
    });
  }

  document.getElementById("count").textContent = `${out.length} of ${FACILITIES.length} catalogue entries match`;
  document.getElementById("show-results").textContent = `Show ${out.length} results`;
  const tbody = document.getElementById("results");
  tbody.innerHTML = "";

  for (const f of out) {
    const tr = document.createElement("tr");
    tr.className = "facility-row";
    tr.append(
      td(`${esc(f.official_name)}${f.is_aggregate_not_physical_telescope ? ' <span class="badge badge-aggregate">aggregate</span>' : ""}`, "Facility"),
      td(esc(f.facility_type || f.entity_class), "Type"),
      td(`${esc(f.country)}<br><span class="muted">${esc(f.region)}</span>`, "Country / Region"),
      td(coordText(f), "Coordinates"),
      td(esc(f.hemisphere || "unknown") + (f.min_declination_deg != null ? `<br><span class="muted">${decText(f)}</span>` : ""), "Hemisphere"),
      td(statusBadge(f.proposal_access_status), "Status"),
      td(String(f.route_count), "Programmes"),
    );
    tr.addEventListener("click", () => {
      if (expanded.has(f.id)) expanded.delete(f.id); else expanded.add(f.id);
      render();
    });
    tbody.append(tr);

    if (expanded.has(f.id)) {
      const dtr = document.createElement("tr");
      dtr.className = "detail-row";
      const dtd = document.createElement("td");
      dtd.colSpan = 7;
      dtd.innerHTML = detailHtml(f);
      dtr.append(dtd);
      tbody.append(dtr);
    }
  }

}

// ---------- Mobile: filter panel + sort dropdown (set up once) ----------
const filterPanel = document.getElementById("filters");
const setPanelOpen = open => {
  filterPanel.classList.toggle("open", open);
  document.body.classList.toggle("noscroll", open);
  if (open) filterPanel.scrollTop = 0;
};
document.getElementById("open-filters").addEventListener("click", () => setPanelOpen(true));
document.getElementById("show-results").addEventListener("click", () => setPanelOpen(false));
document.addEventListener("keydown", e => { if (e.key === "Escape") setPanelOpen(false); });

document.getElementById("sort").addEventListener("change", e => {
  if (!e.target.value) { sortKey = null; sortDir = 1; }
  else { const [k, d] = e.target.value.split(":"); sortKey = k; sortDir = +d; }
  render();
});
