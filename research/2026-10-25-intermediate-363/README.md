# Astronomical proposal-access inventory

Research edition dated 25 October 2026. This is an incomplete, source-linked inventory assembled by regional researchers and a separate access auditor.

- `master.csv`: one row per eligible catalogue entity; 363 rows. Space observatories have category `space`. Networks and observatory access scopes are explicitly labelled.
- `inventory.json`: normalized facilities, programmes, many-to-many routes, source records, site labels, instrument records, relationships, ledger, discovery passes, unresolved candidates, exclusions and audit findings. All 374 catalogue entries, including suspended entries, are retained here.
- `inventory.md`: readable inventory grouped by region, country and observatory, with space separately grouped.
- `proposal_access.csv` and `proposal_access.md`: one row per documented route, including explicitly labelled suspended/limited routes; 482 rows.
- `sources.csv`: official evidence, source dates and retrieval dates.
- `research_ledger.csv`: searches/source families, results and access limitations. Source entries also record retrieved pages that were not separately repeated in the search ledger.
- `unresolved_candidates.csv`: 179 candidate records, some covering multiple named facilities; these are not verified opportunities. Related suspended entries may repeat a candidate because resumption is unresolved.
- `country_coverage.csv`: country/territory checklist using the local timezone database ISO naming table. This is a coverage aid, not a claim that every country was searched.
- `coverage_audit.md`: stopping condition, gaps, positive pass yields, counts, missing-field rates and structural checks.

## Joining and interpreting

Join routes on `facility_id` and `programme_id`; join all `source_ids` to sources `id`. CSV cells containing arrays or mappings are JSON-encoded, preserving lists and programme-specific restrictions. UTF-8 CSV follows standard quoted-field escaping. Numeric known coordinates/apertures are numeric cells; unknown values use the literal `unknown`. Empty relationship arrays mean no relationship was established, not absence in reality.

`Facility`, `site`, `instrument`, `programme` and `route` are separate concepts. Site labels group verified observatory names but have not all been normalized geographically. Instrument IDs are facility-specific, and lists are incomplete; a source instrument list does not guarantee availability through every route. Some interferometric configurations overlap existing telescopes, and some network node lists remain unresolved. Counts therefore describe catalogue entries, not an independent physical telescope census.

“Active” or “between_cycles” describes documented programme continuity. It is not a claim of an open deadline or of availability for every instrument. `latest_call_found` is the latest located in these searches, not a guarantee that no later call exists. Deadlines are retained with year and timezone when given; missing clock/timezone stays unknown. Historic deadlines must not be advertised as current opportunities. Proposal funding and observing eligibility are distinguished where the sources state separate restrictions. Unknown fees do not mean free access.

Coordinates use decimal degrees, east-positive longitude and elevation in metres. Explicitly matched Astropy site-registry values are secondary structured reference values, sometimes shared-site proxies. Original official coordinates take precedence when present; alternative values and reference scopes remain in JSON. Registry snapshot SHA256: `f7d28418ed81204f5f54a63c8e968a4ccec6f1df6e6d599c136e000103bb36e0`. Derived declination limits assume an unobstructed geometric horizon and ignore actual mount, safety, elevation/airmass, scheduling, instrument and network restrictions. They are preliminary sky geometry, not proof a facility can point at a target.

## Research limit

Intermediate edition published at the user request while coordinated research continues. Agent usage-limit interruptions and resumption are checkpointed; account availability rechecked25October2026. Successive discovery passes still yield eligible facilities. No worldwide or all-country completeness or discovery convergence is claimed. Incomplete research edition. Successive discovery passes still produced eligible facilities. No claim of worldwide or all-country completeness.

Official access documentation establishes the recorded routes; discovery catalogues alone do not prove open access. Some eligibility and technical details remain unknown despite a documented route. References, conflicts, limitations and excluded archival-only calls are preserved for review. No proposals were submitted and no observatories were contacted.

## Intermediate edition and validation

Edition `2026-10-25-intermediate-363` is a frozen checkpoint. Stable facility, programme and route IDs support later updates. All six CSV exports were compared cell-by-cell with the structured export tables, including JSON list cells and numeric values. Identity joins and evidence references passed structural checks. These checks do not establish scientific completeness or verify every technical manual.

Use `master.csv` for facilities and `proposal_access.csv` for programme-specific eligibility and application links. Match facility IDs when updating your working copy; do not replace your edits by name alone. The access table retains suspended/future routes with explicit status. The structured JSON retains source variants and unresolved scope discrepancies.
