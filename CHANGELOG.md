# Changelog

## [Unreleased] — unified single-page design ("SkyEye")

Replaces the two separate pages (Instrument Finder / Facility & Access Finder) from the previous
release with one merged tool, per direct feedback that the split was confusing and didn't match
the actual workflow (wavelength range + sky position + affiliation, answered in one place).

### Added
- `data/observations.json` + `scripts/build_unified.py` — the new single dataset the site loads:
  one row per observing option (12 instrument-specific rows from `data.csv`, 372 facility-level
  rows from the inventory), all sharing the same location/hemisphere/access fields.
- `scripts/wavelength_parse.py` — parses numeric wavelength/frequency/energy ranges out of the
  inventory's free-text `wavelength_coverage` field where possible (66/384 rows), and classifies
  every row into one of 10 waveband categories (covers 367/384; see
  `docs/unresolved_integration_issues.md` for exact coverage).
- Declination/elevation filter: given a target declination (or range) and a minimum usable
  elevation, computes each facility's peak transit altitude (`90° − |latitude − declination|`) and
  filters on it — replacing the previous page's cruder "is this declination geometrically possible
  at all" bound.
- Affiliation/country keyword filter against documented route eligibility text, clearly labelled
  as a text match, not a legal eligibility determination.
- Map view (Leaflet + OpenStreetMap, Leaflet vendored under `vendor/leaflet/`), synced to the
  active filters, colored by hemisphere/category, with a "show in table" link from each marker.
- Sortable column headers with a direction indicator, hover tooltips on every column header and
  filter explaining what it means and its caveats, resizable columns.
- "Contribute" and "Report a bug / error" buttons linking to GitHub issue templates
  (`.github/ISSUE_TEMPLATE/`), plus `CONTRIBUTING.md`.
- Visual redesign: a validated 8-color categorical palette for waveband chips (checked with the
  project's color-accessibility validator script; chips always carry a visible text label per its
  "relief rule" for the slots that sit below 3:1 contrast on this surface), a fixed status-color
  set for programme-status badges, sticky table header, zebra striping, a proper header bar.

### Changed
- `instrumentfinder_crosswalk.csv` is now load-bearing: `build_unified.py` uses it to decide which
  facility each `data.csv` instrument row attaches to, rather than being a reference table.
- Capability flags (`Polarimetry`, `AO`, etc.) are `null` ("not recorded") rather than `false` for
  the 372 facility-level rows that have no per-instrument data — filtering on a capability
  correctly excludes them instead of implying "confirmed absent."

### Removed
- `index.html`'s old Facility & Access page and `instruments.html` / `facility-app.js` /
  `instruments-app.js` — superseded by the single `index.html` / `app.js`.
- The vendored PapaParse copy — no longer needed; CSV parsing now happens once at build time in
  Python (`scripts/build_unified.py`), not in the browser.
- `data/webapp_facilities.json` and its generation in `build_integration.py` — superseded by
  `data/observations.json` (see Added, above).

### Fixed (caught during this session's own testing, not reported externally)
- Network membership derivation (`member_facility_ids_from_relationships` in `facilities.csv`) was
  reading the relationship graph backwards (looking for the network as the relationship's subject,
  when membership is recorded member→network). Fixed; now correctly resolves for 4/17 networks
  (the rest are genuinely unresolved in the source itself).
- Instrument-row waveband chips (ALMA/MMT) were invisible — `data.csv`'s own waveband vocabulary
  ("Millimeter", "Near-Infrared", "Visible") didn't match the inventory's category labels used for
  chip styling. Added an explicit mapping in `build_unified.py`.
- On the mobile card layout, a table cell with multiple badges (e.g. several capability flags) had
  each badge become its own flex item instead of wrapping together, due to the mobile CSS turning
  `<td>` into a flex container. Fixed by wrapping all cell content in one child element.

## [2026-10-25] — initial integration of research edition `2026-10-25-intermediate-363`

### Added
- `research/2026-10-25-intermediate-363/` — the frozen source research edition, copied verbatim
  and treated as read-only (374 catalogue entries, 363 eligible, 237 programmes, 482 routes, 177
  sites, 673 sources, 179 unresolved candidates; see its own `README.md`/`coverage_audit.md`).
- `data/facilities.csv` / `.json` — normalized, stable-ID facility table (374 rows), with a
  derived `physical_telescope_class` distinguishing single catalogue facilities from
  network/access-scope aggregates, and `eligible` carried over from the source's `master.csv`.
- `data/sites.csv` / `.json` — observatory-site table (177 rows) with `facility_ids` many-to-many.
- `data/programmes.csv` / `.json` — proposal-programme table (237 rows).
- `data/facility_programme_routes.csv` / `.json` — the facility↔programme crosswalk (482 rows),
  one row per documented route, each carrying its own eligibility/fees/deadline rather than
  inheriting them from the facility or programme as a whole.
- `data/facility_location.csv` / `.json` — lat/lon/elevation/hemisphere table (374 rows; 156 with
  known coordinates), with coordinate provenance (`coordinate_scope`,
  `is_shared_site_or_registry_proxy`) and declination bounds explicitly labelled as geometric
  ideal-horizon estimates, not verified pointing limits.
- `data/instrumentfinder_crosswalk.csv` / `.json` — maps the 2 facilities already in
  InstrumentFinder's `data/data.csv` (ALMA, MMT) onto this inventory's facility IDs.
  - ALMA required a manually verified override (`manual_verified_override`): the source record
    `amer-alma` has an empty top-level `aliases` array, so automatic alias matching missed it;
    confirmed instead via operator name (`Joint ALMA Observatory`) and official URL domain
    (`almascience.eso.org`).
  - MMT matched automatically (`exact_name_or_alias`).
- `data/inventory_instruments.csv` / `.json` — named instruments per facility (410 rows).
- `data/relationships.csv` / `.json` — raw many-to-many relationship graph (786 rows).
- `data/webapp_facilities.json` — denormalized view-model consumed by `facility-app.js`.
- `index.html` + `facility-app.js` — new Facility & Access Finder page: filter by category,
  hemisphere, target declination (geometric), programme status, region; expandable per-facility
  detail showing every documented access route with its own eligibility/fees/deadline/portal.
- `instruments.html` + `instruments-app.js` — ported from
  [adolfo1519/InstrumentFinder](https://github.com/adolfo1519/InstrumentFinder) `index.html` /
  `app.js`, pointed at the local `data/data.csv` instead of a published Google Sheet so the whole
  site works as one static repository; filtering/sorting logic unchanged.
- `scripts/build_integration.py` — reproducible build script that regenerates every file under
  `data/` from a `research/<edition>/` folder; picks the most recent edition folder by default.
- `docs/data_dictionary.md`, `docs/integration_recommendation.md`,
  `docs/unresolved_integration_issues.md`.

### Known limitations carried into this release (see docs for detail)
- Coverage is explicitly incomplete and not claimed worldwide-complete (source's own audit).
- Only 156/374 facilities have any known coordinates; many hemisphere/declination values are
  `unknown` rather than filled in.
- `instrumentfinder_crosswalk.csv` currently covers only the 2 facilities InstrumentFinder already
  had; the other ~361 inventory facilities have no InstrumentFinder-side instrument data yet.
- Declination bounds are geometric estimates only (see `data_dictionary.md`).
