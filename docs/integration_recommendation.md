# How to integrate facility-level location/access filters with the existing instrument data

## What was done in this release

Rather than merging the two schemas into one table, the site keeps two linked views
(see `README.md`): `instruments.html` (per-instrument technical filters, driven by
`data/data.csv`) and `index.html` (per-facility location/access filters, driven by
`data/webapp_facilities.json`). `data/instrumentfinder_crosswalk.csv` is the join key between
them today.

This was a deliberate choice, not a placeholder: the two sources disagree sharply in grain and
confidence. `data.csv` is dense and verified per-instrument for 2 facilities; the inventory is
broad but shallow (many `unknown` technical fields) across 374. Forcing them into one row-per-
instrument table right now would mean either dropping the inventory's 361 extra facilities (no
instrument rows to attach them to) or fabricating instrument rows for facilities that don't have
verified instrument data yet — both worse than keeping them separate and explicit.

## Recommended next step when you're ready to merge further

1. **Resolve the crosswalk, don't widen `data.csv` blindly.** As InstrumentFinder gains more
   facilities, add them to `data/data.csv` as today, then re-run
   `scripts/build_integration.py` and check `data/instrumentfinder_crosswalk.csv` for a match.
   Where it comes back `no_match` or `ambiguous_multiple_candidates`, resolve it by hand (confirm
   via operator name / official URL, the way the ALMA override was done) rather than
   string-matching more aggressively — the ALMA case shows automatic matching already produces a
   false negative on an exact, unambiguous facility; loosening it further would start producing
   false positives instead.
2. **Join at render time, not by flattening files.** When a facility in `data.csv` has a crosswalk
   match, `instruments.html` can look up that `inventory_facility_id` in
   `data/webapp_facilities.json` and show hemisphere/declination-range/open-routes as
   supplementary read-only context next to the instrument rows — without changing `data.csv`'s
   schema or re-deriving instrument specs from the inventory (which doesn't have the resolving
   power / FOV / spectral-resolution fields `data.csv` has).
3. **Never let a facility-level or programme-level field overwrite an instrument-level one.**
   Aperture, wavelength coverage, etc. in `data/facilities.csv` are facility-wide and frequently
   `unknown`; `data.csv`'s per-instrument fields are more specific and should always win for an
   instrument that has its own row. Treat the inventory fields as "fill in only if the instrument
   table is silent," never as a default that overrides a known instrument value.
4. **Don't apply one route's eligibility to the whole facility.** If you add a facility-level
   "can I apply here" indicator to `instruments.html`, derive it from the *count and diversity* of
   `data/facility_programme_routes.csv` rows for that facility (e.g. "3 documented routes, see
   Facility & Access Finder for details") rather than picking one route's eligibility text to
   stand in for all of them.
5. **Keep `unknown` as `unknown` in the UI.** Don't render a missing `fees` as "Free" or a missing
   `eligibility` as "Open to all" — render it as "not yet verified" with a link to the source, or
   omit the field, exactly as the source data intends.
6. **New research lands as a new edition folder**, e.g. `research/2026-11-xx-edition-NNN/`,
   keeping `2026-10-25-intermediate-363/` untouched for citation stability. Re-run
   `scripts/build_integration.py <new-folder-name>` to regenerate `data/`; IDs are stable across
   editions so existing crosswalk entries and any manual fixes you've layered on top of
   `data/instrumentfinder_crosswalk.csv` should mostly still apply — diff the new crosswalk output
   against the old one before trusting it blindly, since a facility ID can occasionally be
   retired/split/merged between research passes.

## Why not a single merged table right now

A single `facility,instrument,...,latitude,longitude,hemisphere,eligibility,...` table was
considered and rejected for this release because:
- It would need one row per (facility × instrument × route) to avoid losing the
  many-to-many structure, producing a wide, repetitive table that's harder to filter correctly
  than two joined tables.
- It would invite exactly the mistakes the source data explicitly warns against: a reader skimming
  one row might assume a single eligibility/fee/declination-bound applies uniformly, when in fact
  different instruments, routes and declination estimates can differ for the same physical
  facility.
- The two input datasets are at genuinely different confidence levels; merging them string-for-
  string would obscure that difference instead of surfacing it.

If a future contributor still wants one flat file for a specific downstream tool (e.g. a
spreadsheet import), generate it as a clearly-labelled *derived* export from the normalized tables
here — don't hand-edit it, and don't treat it as the source of truth.
