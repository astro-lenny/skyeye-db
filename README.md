# SkyEye — Telescope & Access Finder

<p align="center">
  <a href="https://astro-lenny.github.io/skyeye-db/">
    <img src="https://img.shields.io/badge/🚀%20LAUNCH%20SKYEYE-Open%20App-2ea44f?style=for-the-badge" alt="Launch SkyEye">
  </a>
</p>

An open-source tool for answering one question: **given a wavelength range, a target's sky
position and your affiliation, which telescopes worldwide could you actually observe with, and
how do you apply?** One page, one sortable spreadsheet-style table (plus a map), no backend, no
build step.

It started from [adolfo1519/InstrumentFinder](https://github.com/adolfo1519/InstrumentFinder) —
credit for the original per-instrument filter design — and grew to merge in a much larger
worldwide facility/proposal-access inventory.

## Features

- **One unified table**, not two separate tools: every row is a telescope, array, space
  observatory or instrument, with wavelength, resolving power/FOV (where known), location,
  hemisphere, and documented proposal-access routes all in the same place.
- A dark "mission control" theme with a live stat bar, chip-style filters, and a quick external
  link straight from each row to the facility's page on file (clearly labelled: usually the
  current proposal/call page, not always a general homepage).
- **Sortable, spreadsheet-like columns** — click any header to sort (ascending/descending, with an
  indicator arrow), resize columns by dragging their edge.
- **Filter by what you actually have**: a wavelength/frequency range *or* a broad waveband
  category, your target's declination (translated into an estimated peak elevation at each site),
  your affiliation/country (matched against documented eligibility text), plus capability,
  hemisphere, region, and programme-status facets.
- **A map view** (Leaflet + OpenStreetMap) of every facility with known coordinates, colored by
  hemisphere/category, synced to the current filters.
- **Hover tooltips** on column headers and filter labels explaining exactly what each field means
  and its caveats — this dataset has enough nuance that an unexplained field is easy to misread.
- **Contribute / Report a bug buttons** linking straight to GitHub issues.
- Click any row to expand full detail: every documented access route for that facility, with its
  own eligibility, fees, deadline and submission portal — never collapsed onto one "the facility's
  eligibility" line, because different routes genuinely differ.

## Data provenance — please read before trusting any single field

This project consumes an **intermediate, incomplete research edition**
(`2026-10-25-intermediate-363`, frozen and included verbatim, read-only, under `research/`).
Important interpretation rules inherited from that edition (full text in
`research/2026-10-25-intermediate-363/README.md` and `coverage_audit.md`):

- **"Unknown" never means no, zero, free, or unrestricted.** It means not yet verified.
- **No claim of worldwide or all-country completeness.**
- **"Active" / "between_cycles" describes documented programme continuity, not an open call.**
  Historical deadlines are not current opportunities.
- **Declination/elevation figures are derived geometry** (latitude only — see
  `app.js`'s `peakElevation()`), not verified telescope pointing limits.
- **Coordinates are not all independently surveyed.** Many are shared-site or site-registry
  proxies — see `is_coordinate_proxy` in the data.
- **A network or access-scope aggregate is not a physical telescope** — see `is_aggregate`.
- **One programme's eligibility is not every route's eligibility.** Each documented access route
  carries its own terms; read the expanded row detail, not just a summary badge.

See `docs/data_dictionary.md` for every field, `CHANGELOG.md` for what changed and when, and
`docs/unresolved_integration_issues.md` for a prioritized list of known gaps (notably: only 12 of
384 rows have verified per-instrument specs today, and only 156 of 374 facilities have known
coordinates — see that doc for exact numbers before assuming absence means "none").

## Repository layout

```
index.html, app.js, style.css  the whole site — one page, no build step
vendor/leaflet/                 vendored map library (no CDN dependency)
data/
  observations.json             what app.js actually loads — one row per observing option
  data.csv                      per-instrument technical data (edit this to add instruments)
  facilities.csv / .json        normalized facility table (374 rows, stable IDs)
  sites.csv / .json             observatory-site table (facility_ids many-to-many)
  programmes.csv / .json        proposal-programme table
  facility_programme_routes.*   facility<->programme crosswalk (documented access routes)
  facility_location.*           lat/lon/elevation/hemisphere with provenance + declination geometry
  instrumentfinder_crosswalk.*  data.csv facilities -> inventory facility IDs
  inventory_instruments.*       named instruments per facility as catalogued
  relationships.*                raw many-to-many graph (instrument/site/network membership)
scripts/
  build_integration.py           research/<edition>/ -> the normalized data/ tables above
  build_unified.py                data/ tables -> data/observations.json (run after the above)
  wavelength_parse.py             free-text wavelength parsing + waveband categorization
research/2026-10-25-intermediate-363/
                                  the frozen source research edition, copied verbatim, read-only
docs/
  data_dictionary.md
  integration_recommendation.md
  unresolved_integration_issues.md
.github/ISSUE_TEMPLATE/          bug report / contribution templates
CONTRIBUTING.md
```

## Running it locally

```bash
python3 -m http.server 8000
```
then open `http://localhost:8000/`. (Opening `index.html` directly via `file://` won't work —
`fetch()` of local JSON is blocked by browser CORS rules on `file://`; GitHub Pages serves it over
HTTPS so this isn't an issue once deployed.)

**After deploying a change to `app.js` or `style.css`, bump the `?v=N` query string on their
`<link>`/`<script>` tags in `index.html`.** GitHub Pages' CDN (and browsers) can serve a cached
copy of those two files for a little while after a push even through a hard-refresh, since a
same-URL request can be satisfied from cache without ever reaching the server again; changing the
URL (via the version number) forces a fresh fetch. If something looks unfixed right after a push,
check the raw file on GitHub (`github.com/<repo>/blob/main/app.js`) before assuming the code itself
is wrong — that bypasses all caching and shows you what's actually committed.

## Contributing

See `CONTRIBUTING.md` — short version: edit `data/data.csv` for instrument-level entries, or add a
new dated folder under `research/` for broader facility/access research, then re-run
`scripts/build_integration.py` and `scripts/build_unified.py` before committing. Preserve IDs
across updates; they're the join keys and the citation trail back to evidence.

## License

MIT — see `LICENSE`. Leaflet (`vendor/leaflet/`) is MIT-licensed by its own authors (`vendor/leaflet/LICENSE`).
