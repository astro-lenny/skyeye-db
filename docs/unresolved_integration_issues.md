# Unresolved integration issues (prioritized)

Updated for the unified single-page design (`data/observations.json` / `index.html` / `app.js`).
Ordered roughly by how much they affect what a user can rely on.

## High priority

1. **Only 12 of 384 rows have real per-instrument technical data** (ALMA's 10 bands + MMT's 2
   instruments, from `data/data.csv`). The other 372 facility-level rows have location/hemisphere/
   access info (where known) but `—` for capabilities, spectral/spatial resolution and FOV — those
   filters simply won't match them. Growing `data/data.csv` to cover more facilities is the single
   highest-value follow-up (see `CONTRIBUTING.md`), not something this integration pass invents.

2. **Coordinates are known for only 156 of 374 facilities (42%)**, so the map and the
   declination/elevation filter silently exclude the majority. The source's own audit
   (`coverage_audit.md`) flags coordinates as one of the least-complete fields (211 of the 363
   *eligible* entries missing latitude/longitude). Prioritize coordinate lookups (official site
   pages, Astropy registry, Wikidata) over other missing fields — it blocks an entire class of
   filtering, not just one column.

3. **Numeric wavelength/frequency ranges are parsed for only 66 of 384 rows (17%)** — the 12
   instrument rows plus ~55 facility-level rows whose free-text `wavelength_coverage` happened to
   contain an explicit number+unit (`scripts/wavelength_parse.py`). The rest (≈300 rows) only carry
   a `waveband_category` (Optical, Radio, etc.) with no numeric range — a precise "500–600 nm"
   search will miss them even if they'd qualify; the category checklist is the only way to find
   them today. Only 17/374 are genuinely `unknown` in the source itself — the rest have *some*
   wavelength description, it's just not written as a clean numeric range (e.g. instrument-specific
   per-filter lists). A deeper per-facility pass (reading each one's actual instrument page) would
   improve this; the regex parser already extracts everything it safely can from the text as given.

4. **Capability filters (`Polarimetry`, `AO`, etc.) only ever match the 12 instrument rows.**
   Checking any capability as required will hide all 372 facility-level rows, every time, by
   design (unknown ≠ no) — but it's easy for a user to read "0 results" as "no facility has this"
   rather than "we don't have per-instrument data for anything else yet." Worth a UI affordance
   (e.g. a visible count of "N rows excluded because capability data isn't recorded for them") if
   this proves confusing in practice.

5. **179 unresolved candidate records are not reachable from the site at all.** They live only in
   `research/2026-10-25-intermediate-363/unresolved_candidates.csv`. If a search finds nothing,
   it's worth also checking that file before concluding there's no documented access.

## Medium priority

6. **The map needs the viewer's own internet access to OpenStreetMap tiles** (`tile.openstreetmap.org`,
   loaded live, not vendored — basemap imagery isn't something to bundle into a git repo). Markers
   and all filtering still work without it (confirmed: Leaflet degrades to a blank grey basemap,
   no JS errors), but on a heavily locked-down network the map will show markers floating on grey.
   Leaflet itself, by contrast, is vendored locally (`vendor/leaflet/`) and needs no network access.

7. **Declination/elevation filtering uses pure transit-altitude geometry**
   (`90° − |latitude − declination|`, in `app.js`'s `peakElevation()`), nothing more. It ignores
   horizon obstructions, atmospheric refraction near the horizon, mount pointing limits, scheduling
   and instrument-specific restrictions — and the UI says so next to the filter. It also doesn't
   account for hour-angle/visibility-window length at all, only the single best achievable altitude.
   A user with a tight time-of-year/time-of-night constraint needs a real planning tool
   (airmass.org-style) on top of this, not a replacement for one.

8. **Network membership is resolved for only 4 of 17 `network`-class entries**
   (`amer-itelescope`, `ap-eavn`, `ap-lba`, and one more — see `data/facilities.csv`,
   `member_facility_ids_from_relationships`). Matches the source's own repeated audit notes that
   network member lists are incomplete. An *empty* member list means "not resolved," never "no
   physical members."

9. **Deadlines and call windows are free text, not normalized dates.** No "show only currently-open
   calls" filter exists, deliberately — correctly parsing 237 differently-formatted deadline
   strings against today's date, per time zone, is a real project of its own; done naively it would
   misclassify historical deadlines as current. Left as a manually-read field in the row detail
   panel instead.

10. **`data/instrumentfinder_crosswalk.csv`'s ALMA entry is a one-off manual override** (see
    `CHANGELOG.md`). It's now load-bearing — `scripts/build_unified.py` uses it to decide which
    facility an instrument row attaches to — so if a future research edition changes `amer-alma`'s
    ID or finally populates its own `aliases` field, re-verify the override still points to the
    right record.

11. **125 vs. 156 "facilities with known coordinates" — two correct, different numbers.** See
    `data_dictionary.md`. One counts a specific audit pass; the other counts all known coordinates.

## Low priority / cosmetic

12. **14 excluded records and 22 reconciliation actions were not materialized into any `data/`
    table**; they remain inside `research/2026-10-25-intermediate-363/inventory.json` as provided.

13. **`data/inventory_instruments.csv` instrument names aren't cross-checked against
    `data/data.csv`** even for ALMA/MMT (e.g. the inventory's single ALMA instrument entry doesn't
    break out Bands 1–10 the way `data.csv` does). Different granularities by design.

14. **No automated test suite / CI.** The site was sanity-checked each session by loading it in a
    local static server and exercising representative filters, sorting, the map, and mobile layout
    in a headless browser — not by an automated regression suite. A lightweight check worth adding:
    assert `data/observations.json` row/field counts in CI after every build-script run.
