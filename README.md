# Facility & Access Finder

An open-source, static-site tool for finding astronomical facilities and instruments by
capability, location and proposal-access route. It extends
[adolfo1519/InstrumentFinder](https://github.com/adolfo1519/InstrumentFinder) — which matches
*instruments* by wavelength, resolution, field of view, etc. — with a much larger,
worldwide *facility and access* directory: where a telescope is, what hemisphere/declination
range it can reach, and what documented proposal programmes exist for it.

**Live pages (once hosted, e.g. via GitHub Pages):**
- `index.html` — Facility & Access Finder (new, this project's main addition)
- `instruments.html` — Instrument Finder (ported from InstrumentFinder, same data model)

No build step. No backend. Everything runs client-side against the JSON/CSV files in `data/`.

## Why two finders?

- **InstrumentFinder's `data.csv`** is hand-curated, per-instrument, and currently covers two
  facilities (ALMA, MMT) in detail — wavelength ranges, resolving power, FOV, etc.
- **The worldwide inventory** in `research/2026-10-25-intermediate-363/` covers 374 catalogue
  entries (363 currently judged eligible, plus suspended/future/non-current ones kept for
  reference) with location, hemisphere and documented proposal-access routes — but far less
  instrument-level technical detail, and with many fields still `unknown`.

Rather than force these into one schema and lose information, they're kept as two linked views.
`data/instrumentfinder_crosswalk.csv` records how the two existing InstrumentFinder facilities map
onto the worldwide inventory's facility IDs, as a starting point for merging further.

## Data provenance — please read before trusting any single field

This project consumes an **intermediate, incomplete research edition**
(`2026-10-25-intermediate-363`, frozen and included verbatim, read-only, under `research/`).
Important interpretation rules inherited from that edition (see
`research/2026-10-25-intermediate-363/README.md` and `coverage_audit.md` for the full text):

- **"Unknown" never means no, zero, free, or unrestricted.** It means not yet verified.
- **No claim of worldwide or all-country completeness.** Discovery was still yielding new
  eligible facilities when this edition was frozen.
- **"Active" / "between_cycles" describes documented programme continuity, not an open call.**
  Historical deadlines are not current opportunities.
- **Declination bounds are derived ideal-horizon geometry** (from latitude alone), not verified
  telescope pointing limits. They ignore mount limits, local horizon obstructions, scheduling and
  instrument-specific restrictions.
- **Coordinates are not all independently surveyed.** Many are shared-site or site-registry
  proxies (see `coordinate_scope` / `is_shared_site_or_registry_proxy` in
  `data/facility_location.csv`), not a dedicated measurement of that specific telescope.
- **A network or site-level access scope is not a physical telescope.** See `entity_class` /
  `is_aggregate_not_physical_telescope` — arrays (e.g. VLA, ALMA) are one physical facility each;
  networks (e.g. EAVN, LBA) and access-scope aggregates are not counted as additional telescopes.
- **One programme's eligibility is not applied facility-wide.** Each row in
  `data/facility_programme_routes.csv` carries its own route-specific eligibility, fees and
  deadline; do not assume every route at a facility shares the same terms.

See `docs/data_dictionary.md` for every output file and column, `CHANGELOG.md` for what changed
from the frozen edition to these integration outputs, and `docs/unresolved_integration_issues.md`
for a prioritized list of what still needs human review.

## Repository layout

```
index.html, instruments.html   the two finder pages
style.css                      shared styling
facility-app.js                logic for the Facility & Access Finder
instruments-app.js             logic for the Instrument Finder (ported from InstrumentFinder)
data/
  data.csv                     per-instrument data (ported from InstrumentFinder, unchanged)
  webapp_facilities.json       denormalized view-model the Facility Finder actually loads
  facilities.csv / .json       normalized facility table (374 rows, stable IDs)
  sites.csv / .json            observatory-site table (177 rows, facility_ids many-to-many)
  programmes.csv / .json       proposal-programme table (237 rows)
  facility_programme_routes.* the facility<->programme crosswalk (482 documented routes)
  facility_location.*         lat/lon/elevation/hemisphere + geometric declination estimates
  instrumentfinder_crosswalk.* existing InstrumentFinder facilities -> inventory facility IDs
  inventory_instruments.*     named instruments per facility as catalogued (410 rows)
  relationships.*             raw many-to-many graph (instrument_at_facility, site grouping, etc.)
research/2026-10-25-intermediate-363/
                                the frozen source edition, copied verbatim, read-only
docs/
  data_dictionary.md
  integration_recommendation.md
  unresolved_integration_issues.md
```

## Contributing

This is meant to be forked and extended — more facilities, verified coordinates, resolved
crosswalk entries, updated calls. When adding data:

1. Keep the frozen `research/2026-10-25-intermediate-363/` edition untouched; it's the cited
   evidence trail. New research should land in a new dated edition folder alongside it.
2. Preserve IDs (`facility_id`, `programme_id`, `route_id`, `source_id`) across updates — they are
   the join keys and the citation trail back to evidence.
3. Keep `unknown` literal and distinct from a verified negative; don't quietly turn an unknown
   fee into "free" or an unknown eligibility into "open to all."
4. Don't apply one route's/programme's eligibility to every route at the same facility.

## License

MIT — see `LICENSE`. The underlying research data carries the same license unless a specific
source's terms require otherwise (noted per-row in `source_type`/`publisher` where relevant).
