# Changelog

## [Unreleased] — three real bugs found via actual deployed-site testing

All three below were caught from live GitHub Pages testing, not inferred — thank you for the
screenshots. Verified fixed with Playwright, not just reasoned about: see each entry.

### Fixed
- **Map showed "API KEY REQUIRED" watermarked tiles.** CARTO's anonymous `dark_all` basemap
  (`basemaps.cartocdn.com`) now requires an API key — it was free when first used here, isn't
  anymore. Switched to the OSM Foundation's own standard tile server (`tile.openstreetmap.org`,
  always free, no key, no account) and fake the dark look with a CSS `filter` on the tile pane
  only, so markers/popups/zoom controls are unaffected.
- **Clicking certain rows silently did nothing, and the map sometimes showed 0 markers.** Root
  cause: 139 of 482 routes (29%) in the research inventory have `covered_instruments` recorded as
  a bare string instead of a one-item list — a data-shape inconsistency in the source, confirmed
  against every other list-typed field (only this one is affected). `route.covered_instruments
  .join(", ")` threw a `TypeError` on those rows, which silently aborted the whole `render()` call
  partway through — explaining both symptoms with one root cause. Fixed by normalizing to a list
  in both build scripts (`as_list()` helper), plus a defensive `[].concat(...)` guard in `app.js`
  itself so a future data slip can't crash the page again. Verified by clicking through a sample
  spread across all 384 rows in a headless browser with zero errors, and confirming 0 remaining
  non-list values in the rebuilt `data/observations.json`.
- **Table couldn't be scrolled sideways, and the header didn't stay visible while scrolling down**
  — two compounding CSS bugs, both confirmed empirically before and after the fix:
  1. `#table-wrap { overflow: hidden }` clipped the oversized table instead of letting it scroll.
  2. `table { border-collapse: collapse }` and `th { overflow: hidden }` (the column-resize-handle
     styling) each independently break `position: sticky` on table cells in every major browser —
     a well-known browser limitation, not something either rule was obviously expected to cause.
     Dropped the resize handle (minor, unrequested) to keep the sticky header (explicitly asked
     for). `#table-wrap` is now its own bounded, scrollable region (horizontal + vertical) with
     its header pinned to the top of that region as you scroll through rows.

## [Unreleased] — visual redesign + quick telescope links

Direct response to feedback that the previous light-theme redesign still looked unfinished and
that doc links served raw Markdown on GitHub Pages instead of rendering.

### Added
- Dark "mission control" theme (new default, not a toggle): validated the categorical waveband
  palette and status-badge colors against the actual dark surface color with the project's
  color-accessibility script before using them (see `docs/data_dictionary.md`).
- A stat bar (observing options / facilities / located / countries / access programmes), computed
  live from the loaded data, not hardcoded.
- Chip-style pill buttons for every multi-select filter (waveband, hemisphere, category, status,
  region, capabilities) — still real `<input type=checkbox>` underneath (confirmed keyboard
  focus + Space-to-toggle still work), just styled as clickable pills instead of a checkbox list.
- Collapsible accordion filter groups (`<details>`/`<summary>`) instead of a long stack of
  always-open fieldsets.
- An inline SVG logo mark, and SVG icons on the Contribute/Report-bug/view-toggle buttons in place
  of emoji placeholders.
- A quick external-link icon directly on each table row's facility name (not just in the expanded
  detail), linking to the facility's `official_url` where known — honestly labelled, since that
  field is usually the current proposal/call page on file, not always a general homepage.
- Map tiles switched to CARTO's dark basemap to match the theme; marker colors adjusted for
  contrast against it.

### Fixed
- The "Coverage & limits" / "Data dictionary" / "known issues" / "changelog" links pointed at
  relative `.md` file paths, which GitHub Pages serves as raw unrendered text — genuinely looked
  broken. They now point at GitHub's rendered blob view for each file.

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
