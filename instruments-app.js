const DATA_URL = "data/data.csv";   // ported from InstrumentFinder (https://github.com/adolfo1519/InstrumentFinder);
                                     // point this back at a published Google Sheet CSV URL if you prefer a live-edited source

// [CSV column, label shown in the UI]
const FEATURES = [
  ["Polarimetry?",     "Polarimetry"],
  ["Interferometry?",  "Interferometry"],
  ["AO?",              "Adaptive optics"],
  ["Spectroscopy?",    "Spectroscopy"],
  ["Imaging?",         "Imaging"],
  ["MOS?",             "Multi-object spectroscopy"],
  ["IFU?",             "IFU"],
];

const EXPECTED = [
  "Facility", "Instrument", "Waveband", "Min Wave/Freq", "Max Wave/Freq", "Unit",
  ...FEATURES.map(f => f[0]),
  "Min Spec Res", "Max Spec Res", "Min Spat Res", "Max Spat Res", "Spat Res Unit",
  "Min FOV", "Max FOV", "FOV Unit", "Access",
];

// ---------- Unit handling ----------
const C = 299792458;            // m/s
const HC_EV_M = 1.239841984e-6; // eV·m

// lower-case, "µ"/"μ" -> "u", spaces removed
const norm = u => String(u ?? "").trim().toLowerCase().replace(/[µμ]/g, "u").replace(/\s+/g, "");

const LENGTH = { pm: 1e-12, a: 1e-10, "å": 1e-10, angstrom: 1e-10, angstroms: 1e-10,
                 nm: 1e-9, um: 1e-6, micron: 1e-6, microns: 1e-6, mm: 1e-3, cm: 1e-2, m: 1 };
const FREQ   = { hz: 1, khz: 1e3, mhz: 1e6, ghz: 1e9, thz: 1e12 };
const ENERGY = { ev: 1, kev: 1e3, mev: 1e6 };
const ANGLE  = { uas: 1e-6, mas: 1e-3, arcsec: 1, arcsecs: 1, arcsecond: 1, arcseconds: 1,
                 as: 1, '"': 1, "″": 1, arcmin: 60, arcmins: 60, arcminute: 60, arcminutes: 60,
                 "'": 60, "′": 60, deg: 3600, degree: 3600, degrees: 3600, rad: 206264.806 };

// Any wavelength / frequency / energy -> meters (null if unknown unit)
function toMeters(value, unit) {
  if (value == null) return null;
  const u = norm(unit);
  if (Object.hasOwn(LENGTH, u)) return value * LENGTH[u];
  if (Object.hasOwn(FREQ, u))   return value > 0 ? C / (value * FREQ[u]) : null;
  if (Object.hasOwn(ENERGY, u)) return value > 0 ? HC_EV_M / (value * ENERGY[u]) : null;
  return null;
}

// Returns [shortest, longest] wavelength in meters. Handles the min/max flip for frequency.
function wavelengthRange(a, b, unit) {
  const v = [toMeters(a, unit), toMeters(b, unit)].filter(x => x != null);
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
}

function toArcsec(value, unit) {
  const u = norm(unit);
  return value == null || !Object.hasOwn(ANGLE, u) ? null : value * ANGLE[u];
}

// ---------- Parsing helpers ----------
const toNum = v => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const toBool = v => /^(yes|y|true|1|x|✓|✔)$/i.test(String(v ?? "").trim());
const isUrl = s => /^https?:\/\//i.test(s);
const finite = arr => arr.filter(v => v != null);
const unique = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));

// ---------- Display formatting ----------
const clean = x => +x.toPrecision(6);   // avoids 0.29*1000 = 290.00000000000006

function fmtRange(a, b, unit = "") {
  if (a == null && b == null) return "—";
  const u = String(unit).trim() ? " " + String(unit).trim() : "";
  if (a == null || b == null || a === b) return `${clean(a ?? b)}${u}`;
  return `${clean(a)} – ${clean(b)}${u}`;
}

// ---------- Load + normalise ----------
let rows = [];
let sortKey = null, sortDir = 1;

function normalizeRow(r) {
  const g = k => String(r[k] ?? "").trim();

  const wMin = toNum(g("Min Wave/Freq")), wMax = toNum(g("Max Wave/Freq"));
  const lam = wavelengthRange(wMin, wMax, g("Unit"));
  if (!lam && (wMin != null || wMax != null))
    console.warn(`Unrecognised Unit "${g("Unit")}" for ${g("Facility")} ${g("Instrument")}`);

  const sUnit = g("Spat Res Unit"), fUnit = g("FOV Unit");
  const sMin = toNum(g("Min Spat Res")), sMax = toNum(g("Max Spat Res"));
  const fMin = toNum(g("Min FOV")),      fMax = toNum(g("Max FOV"));
  const rMin = toNum(g("Min Spec Res")), rMax = toNum(g("Max Spec Res"));

  const sVals = finite([toArcsec(sMin, sUnit), toArcsec(sMax, sUnit)]);
  const fVals = finite([toArcsec(fMin, fUnit), toArcsec(fMax, fUnit)]);
  const rVals = finite([rMin, rMax]);

  const row = {
    facility:   g("Facility"),
    instrument: g("Instrument"),
    wavebands:  g("Waveband").split(/[;,]/).map(s => s.trim()).filter(Boolean),
    accessList: g("Access").split(";").map(s => s.trim()).filter(Boolean),
    flags:      FEATURES.filter(([col]) => toBool(r[col])).map(([, label]) => label),

    // numeric values used for filtering/sorting
    lamLo: lam ? lam[0] : null,
    lamHi: lam ? lam[1] : null,
    resBest:  rVals.length ? Math.max(...rVals) : null,   // highest R reachable
    spatBest: sVals.length ? Math.min(...sVals) : null,   // finest resolution, arcsec
    fovBest:  fVals.length ? Math.max(...fVals) : null,   // largest FOV, arcsec

    // strings shown to the user (original numbers + units)
    dWave: fmtRange(wMin, wMax, g("Unit")),
    dRes:  fmtRange(rMin, rMax),
    dSpat: fmtRange(sMin, sMax, sUnit),
    dFov:  fmtRange(fMin, fMax, fUnit),
  };
  row.searchText = [row.facility, row.instrument, g("Waveband"), g("Access")].join(" ").toLowerCase();
  return row;
}

Papa.parse(DATA_URL, {
  download: true,
  header: true,
  skipEmptyLines: "greedy",
  transformHeader: h => h.trim(),
  complete: res => {
    const missing = EXPECTED.filter(h => !res.meta.fields.includes(h));
    if (missing.length) console.warn("Columns not found in CSV:", missing);

    rows = res.data.map(normalizeRow);
    buildFacet("features",   FEATURES.map(f => f[1]));
    buildFacet("wavebands",  unique(rows.flatMap(r => r.wavebands)));
    buildFacet("facilities", unique(rows.map(r => r.facility)));
    // If "Access" holds URLs rather than categories, there's nothing to facet on
    buildFacet("access", unique(rows.flatMap(r => r.accessList.filter(a => !isUrl(a)))));
    render();
  },
  error: err => {
    document.getElementById("count").textContent = "Could not load data: " + err;
  },
});

// ---------- UI construction ----------
function buildFacet(containerId, values) {
  const box = document.getElementById(containerId);
  box.innerHTML = "";
  for (const v of values) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = v;
    label.append(cb, " " + v);
    box.append(label);
  }
  if (!values.length) box.closest("fieldset").hidden = true;
}

document.getElementById("filters").addEventListener("input", render);

document.getElementById("reset").addEventListener("click", () => {
  document.querySelectorAll("#filters input, #filters select").forEach(el => {
    if (el.type === "checkbox") el.checked = false;
    else if (el.type === "radio") el.checked = el.value === "overlap";
    else if (el.tagName === "SELECT") el.selectedIndex = 0;
    else el.value = "";
  });
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

// ---------- Filtering ----------
const num = id => toNum(document.getElementById(id).value);
const val = id => document.getElementById(id).value;
const checked = id => [...document.querySelectorAll(`#${id} input:checked`)].map(cb => cb.value);

// comparisons with a tiny tolerance so 1 µm == 1000 nm despite floating point
const le = (a, b) => a <= b * (1 + 1e-9);
const ge = (a, b) => a >= b * (1 - 1e-9);

function getMatches() {
  const q = wavelengthRange(num("wmin"), num("wmax"), val("wunit"));  // null if both empty
  const mode = document.querySelector('input[name="wmode"]:checked').value;
  const minR = num("minR");
  const maxR = num("maxR");
  const spatQ = toArcsec(num("spat"), val("spatunit"));
  const fovQ  = toArcsec(num("fov"),  val("fovunit"));
  const feats = checked("features");
  const bands = checked("wavebands");
  const facs  = checked("facilities");
  const acc   = checked("access");
  const text  = val("search").toLowerCase().trim();

  // Note: when a numeric filter is active, rows with missing data for it are excluded.
  return rows.filter(r => {
    if (q) {
      if (r.lamLo == null) return false;
      const ok = mode === "overlap"
        ? le(r.lamLo, q[1]) && ge(r.lamHi, q[0])
        : le(r.lamLo, q[0]) && ge(r.lamHi, q[1]);
      if (!ok) return false;
    }
    if (minR  != null && !(r.resBest  != null && r.resBest >= minR))  return false;
    if (maxR  != null && !(r.resBest  != null && r.resBest <= maxR))  return false;
    if (spatQ != null && !(r.spatBest != null && le(r.spatBest, spatQ))) return false;
    if (fovQ  != null && !(r.fovBest  != null && ge(r.fovBest, fovQ)))   return false;

    if (facs.length  && !facs.includes(r.facility)) return false;             // OR within a facet
    if (bands.length && !r.wavebands.some(b => bands.includes(b))) return false;
    if (acc.length && !r.accessList.some(a => acc.includes(a))) return false;
    if (!feats.every(f => r.flags.includes(f))) return false;                 // AND across capabilities
    if (text && !r.searchText.includes(text)) return false;
    return true;
  });
}

// ---------- Rendering ----------
function td(text, label = "") {
  const el = document.createElement("td");
  el.textContent = text;
  if (label) el.dataset.label = label;   // used by the mobile card layout
  return el;
}
function linkLabel(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return "Link"; }
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

  document.getElementById("count").textContent =
    `${out.length} of ${rows.length} entries match`;
  document.getElementById("show-results").textContent = `Show ${out.length} results`;
  const tbody = document.getElementById("results");
  tbody.innerHTML = "";
  for (const r of out) {
    const tr = document.createElement("tr");

  const access = td("", "Access");
  r.accessList.forEach((item, i) => {
    if (i) access.append(", ");
    if (isUrl(item)) {
      const a = document.createElement("a");
      a.href = item;
      a.textContent = linkLabel(item);
      a.target = "_blank";
      a.rel = "noopener";
      access.append(a);
    } else {
      access.append(item);        // appended as text, so no HTML injection
    }
  });
  tr.append(
    td(r.facility, "Facility"), td(r.instrument, "Instrument"),
    td(r.wavebands.join(", "), "Waveband"),
    td(r.dWave, "Wavelength"), td(r.dRes, "Spectral res."),
    td(r.dSpat, "Spatial res."), td(r.dFov, "Field of view"),
    td(r.flags.join(", "), "Capabilities"), access
  );
  tbody.append(tr);
  }

  // ---------- Mobile: filter panel + sort dropdown ----------
  const panel = document.getElementById("filters");
  const setPanel = open => {
    panel.classList.toggle("open", open);
    document.body.classList.toggle("noscroll", open);
    if (open) panel.scrollTop = 0;
  };
  document.getElementById("open-filters").addEventListener("click", () => setPanel(true));
  document.getElementById("show-results").addEventListener("click", () => setPanel(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape") setPanel(false); });

  document.getElementById("sort").addEventListener("change", e => {
    if (!e.target.value) { sortKey = null; sortDir = 1; }
    else { const [k, d] = e.target.value.split(":"); sortKey = k; sortDir = +d; }
    render();
  });
}