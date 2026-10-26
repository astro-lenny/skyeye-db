# How the instrument data and the facility/access inventory are merged

**Status: merged**, as of the `scripts/build_unified.py` pipeline. Earlier versions of this
project kept two separate pages (an "Instrument Finder" and a "Facility & Access Finder"); that
turned out to be the wrong call for actual use — a user with a wavelength range, a sky position
and an affiliation had to cross-reference two pages by hand. This doc now describes the merged
design and why it's built the way it is; see `CHANGELOG.md` for the history.

## The data model: one row = one observing option

`data/observations.json` (built by `scripts/build_unified.py`) has one row per *observing
option* — either a specific instrument (today: ALMA's 10 bands and MMT's 2 instruments, carried
over from `data/data.csv`) or, for every other catalogue facility, one facility-level row built
from the research inventory. Every row — instrument-specific or not — carries the same
facility-level fields: location, hemisphere, declination/elevation geometry, proposal-access
routes. This is what makes one unified, uniformly filterable/sortable table possible.

**Why not demand instrument-level detail for all 374 facilities instead?** Because it isn't known.
Forcing a `Min Spec Res` / `Max FOV` / etc. value onto a facility the research inventory has no
instrument data for would mean fabricating it. Facility-level rows instead show `—` /
`unknown` in those columns — they still fully participate in location, hemisphere, waveband,
eligibility and access filtering, just not in resolving-power/FOV filtering.

**Why not drop the per-instrument detail instead, to keep one simple schema?** Because it's real,
verified data that a facility-level wavelength *category* can't replace — "Optical" doesn't tell
you a spectrograph's resolving power. The merge keeps both: instrument rows carry their precise
numeric fields, facility rows carry what's actually known.

## The crosswalk is now load-bearing, not just a side table

`data/instrumentfinder_crosswalk.csv` used to be a reference table you'd consult by hand. Now
`scripts/build_unified.py` uses it directly: every row of `data/data.csv` is matched to an
inventory `facility_id` through it, and dropped from the unified view (with a build-time warning)
if no match exists. Growing `data/data.csv` to cover more facilities means the crosswalk must
resolve for each new facility — see `CONTRIBUTING.md` for how to fix a `no_match` or
`ambiguous_multiple_candidates` result (confirm by hand via operator name / official URL, as was
done for ALMA; don't loosen the automatic name-matching, which risks silently merging the wrong
facility).

## Where the line is still drawn

- **A facility-level field never overwrites an instrument-level one.** Aperture, wavelength
  coverage, etc. on a facility-level row are facility-wide and often `unknown`; an
  instrument-specific row's own fields (from `data/data.csv`) always take precedence for that
  instrument and are never backfilled from the facility level.
- **One route's eligibility is not the whole facility's eligibility.** The table and map show a
  route *count*; the actual eligibility, fees and deadline per documented access route only appear
  in the expandable per-row detail panel, each clearly attributed to its own programme.
- **The waveband category is a fallback, not a replacement, for the numeric range.** Where a
  numeric wavelength/frequency range is known (parsed from free text for facility-level entries,
  or carried over from `data/data.csv` for instrument-level ones), the numeric filter uses it
  directly. The category checklist (`scripts/wavelength_parse.py`) exists because most
  facility-level entries only have a category word ("optical", "radio", ...) and no numeric range
  at all — see `docs/data_dictionary.md` for exact coverage numbers.
- **Declination/elevation filtering is clearly geometric.** `peakElevation()` in `app.js` computes
  `90° − |latitude − declination|` — standard transit-altitude geometry, nothing more. It ignores
  horizon obstructions, mount limits, scheduling and instrument-specific restrictions, and the UI
  says so next to the filter, not just in a footnote.

## What would still improve this further

- Expanding `data/data.csv` to cover more of the 372 facility-level entries with real instrument
  specs (resolving power, FOV, capabilities) — the single highest-value follow-up, since it's what
  unlocks the numeric/capability filters for those rows.
- A second numeric wavelength parse pass specifically targeting the ~300 facilities currently
  classified only by category (see `docs/unresolved_integration_issues.md`).
- Resolving more of `data/instrumentfinder_crosswalk.csv`'s inevitable future `no_match` entries as
  `data/data.csv` grows.
