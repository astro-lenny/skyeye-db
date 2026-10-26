# Data dictionary

All tables under `data/` are derived from the frozen, read-only edition at
`research/2026-10-25-intermediate-363/` (see that folder's own `README.md` and
`coverage_audit.md` for the authoritative policy notes — summarized, not replaced, here).
Nothing in `research/` was modified; everything in `data/` is a cleaned/joined *view* of it,
built by a script whose logic is summarized below so it can be reproduced or re-run against a
future edition.

General conventions carried over from the source:
- The literal string `unknown` means "not yet verified," never "no / zero / free / unrestricted."
- List-valued cells in CSV files are JSON-encoded (e.g. `["a","b"]`); the paired `.json` file has
  them as native arrays.
- Coordinates are decimal degrees, longitude east-positive, elevation in metres.
- IDs are stable across editions; join on IDs, not on names.

## `observations.json` — 384 rows — **what the site actually loads**

Built by `scripts/build_unified.py` from every table below plus `data.csv`. One row = one
observing option: 12 instrument-specific rows (ALMA's 10 bands + MMT's 2 instruments, from
`data.csv`, matched to a facility via `instrumentfinder_crosswalk.csv`) and 372 facility-level
rows (everything else). Both kinds carry the same location/hemisphere/access fields so the unified
table/map can filter and sort uniformly; see `docs/integration_recommendation.md` for the full
reasoning. Key fields not already covered by the tables below:

| Field | Meaning |
|---|---|
| `is_instrument_specific` | True for the 12 rows with real per-instrument technical data. |
| `waveband_category` | One of 10 labels (Optical, Optical/Infrared, Infrared, Radio, Millimeter/Submillimeter, Ultraviolet, X-ray, Gamma-ray, Cosmic ray, Unknown), from `scripts/wavelength_parse.py`'s keyword+numeric classifier. Covers ~95% of rows (17/374 facilities are genuinely `unknown` in the source itself — see that script's module docstring for the classification rules). |
| `lam_lo_m` / `lam_hi_m` | Numeric wavelength range in meters, where parseable — 66/384 rows (the 12 instrument rows plus ~55 facility-level rows whose free-text `wavelength_coverage` contained an explicit numeric range/unit). Most facility-level rows only have a category, not a number; use `waveband_category` for those. |
| `eligibility_text` | Every route's (and its programme's) eligibility text for this facility, concatenated, for the affiliation keyword filter. A text-match convenience, not a legal determination — many open programmes don't name every eligible country. |
| `capabilities` | `{polarimetry, interferometry, ao, spectroscopy, imaging, mos, ifu}`, each `true`/`false` for the 12 instrument rows (from `data.csv`) and `null` ("not recorded") for every facility-level row. |
| `min_declination_deg` / `max_declination_deg` | Carried from `facility_location.json`. The app additionally computes a transit-altitude figure (`90° − |latitude − declination|`) live in `app.js`, which is the more useful "can I actually reach this" number the declination/elevation filter uses — these two fields are the cruder "does it ever rise at all" geometric bound. |

## `facilities.csv` / `facilities.json` — 374 rows

One row per catalogue entry (telescope, array, space observatory, network, or
observatory-access-scope aggregate). Key columns beyond the obvious:

| Column | Meaning |
|---|---|
| `entity_class` | One of `telescope_or_facility`, `array`, `space_observatory`, `network`, `observatory_access_scope`. |
| `physical_telescope_class` | Derived: `single_catalogue_facility` or `aggregate_do_not_count_as_physical_telescope`. Networks (e.g. LBA, EAVN) and access-scope aggregates (e.g. a university's generic "research access") are **not** additional physical telescopes on top of their member facilities, which are separately catalogued where known. |
| `eligible` | Whether this ID is in the source's `master.csv` (363 of 374). The 11 not eligible are suspended (5), announced-future (2), or non-current/unverified (4) — kept here for reference, excluded from `master.csv`. |
| `member_facility_ids_from_relationships` | Derived from the source's `relationships[]` graph (predicates `listed_component_of_facility_or_network`, `physical_member_of_observatory_aggregate`, etc.), where resolvable. Often empty even for real networks — the source explicitly says member lists are incomplete; empty here means "not resolved," not "no members." |
| `instrument_ids`, `instrument_count` | FK into `inventory_instruments.csv`. A facility with named instruments is not a claim that every instrument is available through every route — see `facility_programme_routes.csv`. |

## `sites.csv` / `sites.json` — 177 rows

Groups facilities by shared observatory/site **label** (e.g. "Chajnantor", "Mauna Kea"). This is a
name-based grouping, not independently surveyed site geometry — distributed facilities may span
several real locations under one label. `facility_ids` is the many-to-many link back to
`facilities.csv`.

## `programmes.csv` / `programmes.json` — 237 rows

One row per proposal programme (e.g. "NRAO and GBO regular observing proposals", "HST Cycle 34
GO/AR"). `eligibility`, `fees`, `deadline`, `submission_portal` etc. describe the *programme*, not
any one facility — a programme can serve several facilities (see routes below) and a facility can
be served by several programmes.

- `programme_status` is documented continuity, not an open-call guarantee.
- `funding_vs_observing_note` flags where the source explicitly distinguishes observing
  eligibility from funding eligibility (e.g. HST: broad observing eligibility, narrower NASA
  funding eligibility) — do not collapse the two.

## `facility_programme_routes.csv` / `.json` — 482 rows

**The facility↔programme many-to-many crosswalk.** Each row is one documented access route: a
`facility_id` served by a `programme_id`, with its own `eligibility`, `covered_instruments`,
`route_status` and evidence. A facility with 3 routes can have 3 different eligibility/fee/deadline
combinations — always read the route row, not just the facility or programme row in isolation.

## `facility_location.csv` / `.json` — 374 rows

| Column | Meaning |
|---|---|
| `has_known_coordinates` | 156 of 374 (not 374). Coordinates are simply `unknown` for the rest. |
| `coordinate_scope` | `own_official_value` (cited directly for this facility), `shared_observatory_site_reference` (site-label proxy), `registry_telescope_or_array_reference` (matched via the Astropy site registry by exact telescope/array identity), `array_core_reference`, or `unknown`. |
| `is_shared_site_or_registry_proxy` | True when `coordinate_scope` is a proxy/registry match rather than a value cited specifically for this facility. |
| `min/max_declination_ideal_horizon_deg` | **Geometric estimate only**: `latitude ± 90°`, clipped to [-90, 90]. Assumes an unobstructed horizon and ignores mount limits, local horizon, safety limits, scheduling and instrument/network restrictions. Not a verified pointing limit. |
| `declination_bounds_status` | Literally says so: `"derived ideal horizon only; not a verified telescope pointing limit"`, or `unknown` when latitude itself is unknown. |

**Coordinate count discrepancy, explained:** the source's own `coverage_audit.md` reports
`coordinate_matches: 125` — that counts only facilities matched during one specific audit pass
against the Astropy site registry. This table's `has_known_coordinates` counts **156**: those 125
plus 31 facilities whose coordinates were already cited directly from an official source earlier
in the research (no registry match needed). Both numbers are correct; they answer different
questions.

## `instrumentfinder_crosswalk.csv` / `.json`

Matches the facilities already in InstrumentFinder's `data/data.csv` (ALMA, MMT) to this
inventory's facility IDs. `match_confidence` values:
- `exact_name_or_alias` — matched automatically on name or a listed alias.
- `manual_verified_override` — automatic matching missed it (e.g. ALMA's own `aliases` field is
  empty in the source, a data gap), but it was independently confirmed via operator name and
  official URL domain and is recorded as such, not guessed.
- `ambiguous_multiple_candidates` — left unresolved on purpose; needs human review.
- `no_match` — nothing found; needs manual lookup.

## `inventory_instruments.csv` / `.json` — 410 rows

Named instruments as catalogued per facility. Per the source's own audit finding
(`AU7-Instrument-source-scope` in `coverage_audit.md`), an instrument's presence here reflects
"agent-reported instrument list from cited facility/access sources" — current mode-by-mode
availability may differ and was not separately verified for every instrument.

## `relationships.csv` / `.json` — 786 rows

Raw `(subject_id, predicate, object_id, source_ids)` graph from the source: instrument-at-facility
links, site-label grouping, network/array membership, etc. Kept as-is for anyone who wants a
different normalization than the `facilities.csv`/`sites.csv` views above.

`data/observations.json` (documented at the top of this file) is built from all of the tables
above plus `data.csv`, by `scripts/build_unified.py` — regenerate it from there rather than
hand-editing it.
