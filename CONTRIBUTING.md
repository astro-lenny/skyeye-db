# Contributing to SkyEye

Thanks for wanting to improve this. Two kinds of contributions are especially useful right now:
**correcting/adding data** and **improving the site itself**.

## Reporting a data problem

Open an issue (there's a "Report a bug / error" button on the site itself, or use
[the bug template](.github/ISSUE_TEMPLATE/bug_report.md) directly) naming the facility/field and,
ideally, a link to the official page that supports the correct value. See
`research/2026-10-25-intermediate-363/README.md` for how this edition tracks evidence —
a correction with a source attached is much faster to merge than one without.

## Adding or correcting data yourself

There are two data sources, kept separate on purpose (see
`docs/integration_recommendation.md` for why):

1. **`data/data.csv`** — per-instrument technical specs (wavelength range, resolving power,
   spatial resolution, field of view, capability flags). Edit this directly for the facilities
   that have — or should have — detailed instrument-level entries.
2. **`research/<edition>/`** — the broader worldwide facility/access inventory (location,
   hemisphere, proposal programmes, eligibility). This is treated as a frozen, citable research
   edition; don't hand-edit it. Larger corrections belong in a new edition folder (e.g.
   `research/2026-11-xx-edition-NNN/`) that a future research pass adds alongside it.

After editing `data/data.csv` (or adding a new research edition), regenerate everything the site
actually loads:

```bash
python3 scripts/build_integration.py     # research/<edition>/ -> data/facilities.csv, programmes.csv, ...
python3 scripts/build_unified.py         # data/*.csv -> data/observations.json (what app.js reads)
```

Both scripts print row counts and basic sanity checks — read the output before committing.
`data/instrumentfinder_crosswalk.csv` is worth checking too: if you add a facility to
`data/data.csv` whose name doesn't exactly match (or alias) the inventory's name for it, it'll
come back `no_match` or `ambiguous_multiple_candidates` rather than being silently merged — resolve
that by hand (see `scripts/build_unified.py`'s `MANUAL_OVERRIDES`, used for exactly this with ALMA)
rather than loosening the name-matching logic, which risks false merges.

## Working on the site itself

No build step for the front end — `index.html` / `app.js` / `style.css` run directly from the
files in this repo; `python3 -m http.server` from the repo root and open `http://localhost:8000/`
to preview (opening `index.html` via `file://` won't work — `fetch()` of local JSON is blocked by
browser CORS rules on `file://`).

A few things worth knowing before changing `app.js`:
- **`unknown` must stay `unknown`** in the UI — don't let a missing fee render as "free" or a
  missing eligibility render as "open to all."
- **One route's eligibility is not every route's eligibility.** Keep route-level detail in the
  expandable panel rather than collapsing it onto the facility row.
- **Declination/elevation numbers are geometric estimates** (latitude only) — keep that labelled
  as such anywhere it's shown, not just in the tooltip.
- If you add a new table column or filter, add a `title` tooltip explaining it, consistent with
  the rest of the sidebar — this dataset has enough caveats that an unexplained field is easy to
  misread.

## License

Contributions are accepted under this repo's MIT license (see `LICENSE`).
