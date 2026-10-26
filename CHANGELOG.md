# Changelog

## [Unreleased] — initial integration of research edition `2026-10-25-intermediate-363`

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
