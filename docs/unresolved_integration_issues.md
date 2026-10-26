# Unresolved integration issues (prioritized)

Issues found while building `data/` from `research/2026-10-25-intermediate-363/`. Ordered
roughly by how much they affect what a user can rely on in the two finder pages.

## High priority

1. **InstrumentFinder's per-instrument data covers only 2 of 374 inventory facilities.**
   `data/instrumentfinder_crosswalk.csv` currently has exactly 2 rows (ALMA, MMT) because that's
   all `data/data.csv` lists today. The other ~361 facilities in the worldwide inventory have
   location/access information (where known) but no wavelength/resolution/FOV instrument data —
   they simply won't appear on `instruments.html`. Growing `data.csv` to cover more facilities is
   a separate, substantial data-entry effort, not something this integration pass invents.

2. **Coordinates are known for only 156 of 374 facilities (42%)**, so hemisphere/declination
   filtering silently excludes the majority. The source's own audit (`coverage_audit.md`) flags
   coordinates as one of the least-complete fields (211 of the 363 *eligible* entries missing
   latitude/longitude). Anyone wanting broader coverage should prioritize coordinate lookups
   (official site pages, Astropy registry, Wikidata) over other missing fields, since it blocks
   an entire class of filters.

3. **Network membership is resolved for only 4 of 17 `network`-class entries**
   (`amer-itelescope`, `ap-eavn`, `ap-lba`, and one more — see `data/facilities.csv`,
   `member_facility_ids_from_relationships`). This matches the source's own repeated audit notes
   that network member lists are incomplete (e.g. `AU7-Instrument-source-scope`,
   `AU7-Site-membership-not-call-scope` in `coverage_audit.md`) — it is not a bug introduced here,
   but it does mean a user browsing a network entry (e.g. LBA, EAVN) cannot assume the listed
   members (when present) are exhaustive, and should not assume an *empty* member list means the
   network has no physical members — it means they weren't resolved in this edition.

4. **179 unresolved candidate records are not reachable from either finder page.** They live only
   in `research/2026-10-25-intermediate-363/unresolved_candidates.csv`. If a user searches for a
   facility and finds nothing, it's worth also checking that file before concluding the facility
   has no documented access — it may be a known candidate still pending verification.

## Medium priority

5. **14 excluded records and 22 reconciliation actions were not materialized into any `data/`
   table.** They remain inside `research/2026-10-25-intermediate-363/inventory.json` (top-level
   keys `excluded` and `reconciliation_actions`) exactly as the source provided them. A future
   pass could add `data/excluded.csv` and `data/reconciliation_actions.csv` if anyone needs to
   browse them without reading raw JSON — skipped here as lower-value than the tables that feed
   the two finder pages.

6. **Deadlines and call windows are free text, not normalized dates**, by explicit source policy
   ("Deadlines are retained with year and timezone when given; missing clock/timezone stays
   unknown"). Neither finder page offers "show only currently-open calls" filtering because doing
   that correctly would require parsing 237 differently-formatted deadline strings and getting the
   now-vs-then comparison right per timezone — attempted naively, it would misclassify some
   historical deadlines as current. Left as a manually-read field (`deadline`, `call_window_status`)
   in the facility detail view instead.

7. **`instrumentfinder_crosswalk.csv`'s ALMA entry is a one-off manual override**, justified in
   `CHANGELOG.md` and `data_dictionary.md`. If a future research edition changes `amer-alma`'s ID
   or finally populates its `aliases` field, re-verify the override still points to the right
   record rather than assuming it carries forward unchanged.

8. **125 vs. 156 "facilities with known coordinates" — two correct, different numbers.** See
   `data_dictionary.md`'s explanation. Don't quote one without the other's context; they measure
   different things (one audit pass vs. all known coordinates).

## Low priority / cosmetic

9. **`data/inventory_instruments.csv` instrument names are not cross-checked against
   `data/data.csv` instrument names** even for ALMA/MMT (e.g. ALMA's single inventory instrument
   entry doesn't break out Bands 1–10 the way `data.csv` does). No action taken — they're
   different granularities by design (see `docs/integration_recommendation.md`), but worth knowing
   if you're looking for a 1:1 instrument match and not finding one.

10. **No automated test suite.** Both finder pages were sanity-checked by loading them in a local
    static server and exercising representative filters (search text, hemisphere, declination
    target, category, aggregate toggle) — see the PR/commit notes for what was checked — but there
    is no CI. A lightweight check worth adding: validate `data/*.json` against expected row counts
    on every `scripts/build_integration.py` run (counts are already printed; wiring that into a
    CI assertion is a small follow-up).
