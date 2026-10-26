#!/usr/bin/env python3
"""Build data/observations.json -- the ONE dataset the unified site (index.html / app.js)
loads. One row = one observing option: either a specific instrument (today: ALMA's 10 bands
and MMT's 2 instruments, from data/data.csv, matched via data/instrumentfinder_crosswalk.csv)
or, for every other catalogue facility, one facility-level row built from the research
inventory. Both kinds carry the same facility-level location/hemisphere/declination/access
fields, so filtering and sorting works uniformly across all ~384 rows.

Run scripts/build_integration.py first (this script reads its outputs under data/).
"""
import csv
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wavelength_parse import parse_wavelength_range_m, classify_waveband, _to_meters  # noqa: E402


def as_list(v):
    """~29% of the source's routes[].covered_instruments are a bare string instead of a
    one-item list -- a data-shape inconsistency confirmed against every other list-typed field
    in the research edition (only this one is affected). Normalize so app.js can always .join() it."""
    if v is None:
        return []
    return v if isinstance(v, list) else [v]

ANGLE_TO_ARCSEC = {
    "uas": 1e-6, "mas": 1e-3, "arcsec": 1, "arcsecs": 1, "arcsecond": 1, "arcseconds": 1,
    "as": 1, '"': 1, "deg": 3600, "degree": 3600, "degrees": 3600,
    "arcmin": 60, "arcmins": 60, "arcminute": 60, "arcminutes": 60, "'": 60, "rad": 206264.806,
}


def to_num(v):
    s = str(v if v is not None else "").replace(",", "").strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def to_bool(v):
    return str(v or "").strip().lower() in {"yes", "y", "true", "1", "x"}


def to_arcsec(value, unit):
    if value is None:
        return None
    u = str(unit or "").strip().lower()
    return value * ANGLE_TO_ARCSEC[u] if u in ANGLE_TO_ARCSEC else None


def load_json(name):
    with open(os.path.join(DATA_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def load_csv(name):
    with open(os.path.join(DATA_DIR, name), encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


facilities = {f["id"]: f for f in load_json("facilities.json")}
locations = {r["facility_id"]: r for r in load_json("facility_location.json")}
routes_by_facility = {}
for r in load_json("facility_programme_routes.json"):
    routes_by_facility.setdefault(r["facility_id"], []).append(r)
programmes = {p["id"]: p for p in load_json("programmes.json")}
crosswalk = load_csv("instrumentfinder_crosswalk.csv")
if_rows = load_csv("data.csv")

PROXY_SCOPES = {"shared_observatory_site_reference", "registry_telescope_or_array_reference", "array_core_reference"}


def unknown_to_none(v):
    return None if v in (None, "unknown", "") else v


def facility_context(fid):
    """Fields shared by every row (instrument-specific or facility-level) for a facility."""
    fac = facilities.get(fid, {})
    loc = locations.get(fid, {})
    routes_out = []
    eligibility_bits = []
    for r in routes_by_facility.get(fid, []):
        prog = programmes.get(r["programme_id"], {})
        elig = r.get("eligibility") or prog.get("eligibility")
        if elig and elig != "unknown":
            eligibility_bits.append(elig)
        routes_out.append({
            "route_id": r["id"],
            "programme_id": r["programme_id"],
            "programme_name": prog.get("name"),
            "route_status": r.get("route_status"),
            "programme_status": prog.get("programme_status"),
            "call_window_status": prog.get("call_window_status"),
            "eligibility": elig,
            "funding_vs_observing_note": unknown_to_none(prog.get("funding_vs_observing_note")),
            "fees": prog.get("fees"),
            "frequency": prog.get("frequency"),
            "latest_call_found": prog.get("latest_call_found"),
            "deadline": prog.get("deadline"),
            "submission_portal": prog.get("submission_portal"),
            "allocation_process": prog.get("allocation_process"),
            "covered_instruments": as_list(r.get("covered_instruments")),
            "access_evidence": unknown_to_none(r.get("access_evidence")),
            "verification": r.get("verification"),
            "notes": unknown_to_none(r.get("notes")),
        })
    return {
        "facility_id": fid,
        "official_name": fac.get("official_name"),
        "aliases": fac.get("aliases") or [],
        "country": fac.get("country"),
        "region": fac.get("region"),
        "operator": unknown_to_none(fac.get("operator")),
        "category": fac.get("category"),
        "facility_type": fac.get("facility_type"),
        "entity_class": fac.get("entity_class"),
        "is_aggregate": fac.get("physical_telescope_class") != "single_catalogue_facility",
        "physical_count_caveat": unknown_to_none(fac.get("physical_count_caveat")),
        "eligible": fac.get("eligible", True),
        "proposal_access_status": fac.get("proposal_access_status"),
        "operational_status": unknown_to_none(fac.get("operational_status")),
        "official_url": unknown_to_none(fac.get("official_url")),
        "notes": unknown_to_none(fac.get("notes")),
        "latitude_deg": loc.get("latitude_deg") if loc.get("has_known_coordinates") else None,
        "longitude_deg": loc.get("longitude_deg_east_positive") if loc.get("has_known_coordinates") else None,
        "elevation_m": unknown_to_none(loc.get("elevation_m")),
        "hemisphere": unknown_to_none(loc.get("hemisphere")),
        "has_known_coordinates": bool(loc.get("has_known_coordinates")),
        "is_coordinate_proxy": bool(loc.get("is_shared_site_or_registry_proxy")),
        "coordinate_notes": unknown_to_none(loc.get("coordinate_notes")),
        "min_declination_deg": unknown_to_none(loc.get("min_declination_ideal_horizon_deg")),
        "max_declination_deg": unknown_to_none(loc.get("max_declination_ideal_horizon_deg")),
        "declination_bounds_status": unknown_to_none(loc.get("declination_bounds_status")),
        "eligibility_text": " | ".join(dict.fromkeys(eligibility_bits)),  # de-duplicated, order-preserving
        "route_count": len(routes_out),
        "routes": routes_out,
    }


# ---------------------------------------------------------------------------
# Instrument-specific rows, from data/data.csv, matched to a facility_id via
# the crosswalk. A row whose facility has no crosswalk match is dropped from
# the unified view with a warning -- it would otherwise have no location/access
# context at all; it still exists untouched in data/data.csv itself.
# ---------------------------------------------------------------------------
# data/data.csv's "Waveband" column uses InstrumentFinder's own vocabulary; normalize it onto
# the same category labels classify_waveband() produces so a chip's CSS class always resolves.
IF_WAVEBAND_TO_CATEGORY = {
    "millimeter": "Millimeter/Submillimeter",
    "near-infrared": "Infrared",
    "infrared": "Infrared",
    "visible": "Optical",
    "optical": "Optical",
    "radio": "Radio",
    "x-ray": "X-ray",
    "ultraviolet": "Ultraviolet",
    "gamma-ray": "Gamma-ray",
}

name_to_fid = {
    row["instrumentfinder_facility_name"]: row["inventory_facility_id"]
    for row in crosswalk
    if row["match_confidence"] in ("exact_name_or_alias", "manual_verified_override")
}

rows = []
matched_facility_ids = set()
skipped = []
for r in if_rows:
    name = r["Facility"]
    fid = name_to_fid.get(name)
    if not fid or fid not in facilities:
        skipped.append((name, r["Instrument"]))
        continue
    matched_facility_ids.add(fid)

    w_min, w_max, w_unit = to_num(r["Min Wave/Freq"]), to_num(r["Max Wave/Freq"]), r["Unit"]
    lam_values = [v for v in (_to_meters(w_min, w_unit) if w_min is not None else None,
                               _to_meters(w_max, w_unit) if w_max is not None else None) if v is not None]
    lam_lo, lam_hi = (min(lam_values), max(lam_values)) if lam_values else (None, None)

    spat_min, spat_max = to_num(r["Min Spat Res"]), to_num(r["Max Spat Res"])
    spat_vals = [v for v in (to_arcsec(spat_min, r["Spat Res Unit"]), to_arcsec(spat_max, r["Spat Res Unit"])) if v is not None]
    fov_min, fov_max = to_num(r["Min FOV"]), to_num(r["Max FOV"])
    fov_vals = [v for v in (to_arcsec(fov_min, r["FOV Unit"]), to_arcsec(fov_max, r["FOV Unit"])) if v is not None]
    res_min, res_max = to_num(r["Min Spec Res"]), to_num(r["Max Spec Res"])
    res_vals = [v for v in (res_min, res_max) if v is not None]

    row = facility_context(fid)
    row.update({
        "row_id": f"{fid}:{r['Instrument']}",
        "is_instrument_specific": True,
        "instrument_name": r["Instrument"],
        "waveband_category": IF_WAVEBAND_TO_CATEGORY.get(r["Waveband"].strip().lower(), r["Waveband"]),
        "lam_lo_m": lam_lo,
        "lam_hi_m": lam_hi,
        "wavelength_display": f"{r['Min Wave/Freq']}–{r['Max Wave/Freq']} {r['Unit']}" if w_min != w_max else f"{r['Min Wave/Freq']} {r['Unit']}",
        "capabilities": {
            "polarimetry": to_bool(r["Polarimetry?"]) if r["Polarimetry?"] != "N/A" else None,
            "interferometry": to_bool(r["Interferometry?"]) if r["Interferometry?"] != "N/A" else None,
            "ao": to_bool(r["AO?"]) if r["AO?"] != "N/A" else None,
            "spectroscopy": to_bool(r["Spectroscopy?"]) if r["Spectroscopy?"] != "N/A" else None,
            "imaging": to_bool(r["Imaging?"]) if r["Imaging?"] != "N/A" else None,
            "mos": to_bool(r["MOS?"]) if r["MOS?"] != "N/A" else None,
            "ifu": to_bool(r["IFU?"]) if r["IFU?"] != "N/A" else None,
        },
        "spec_res_best": max(res_vals) if res_vals else None,
        "spat_res_arcsec_best": min(spat_vals) if spat_vals else None,
        "fov_arcsec_best": max(fov_vals) if fov_vals else None,
        "instrument_access": r["Access"],
    })
    rows.append(row)

# ---------------------------------------------------------------------------
# Facility-level rows: every other eligible-or-not catalogue facility.
# ---------------------------------------------------------------------------
for fid, fac in facilities.items():
    if fid in matched_facility_ids:
        continue
    wc = fac.get("wavelength_coverage")
    lam_lo, lam_hi = parse_wavelength_range_m(wc)
    cat = classify_waveband(wc, lam_lo, lam_hi)
    row = facility_context(fid)
    row.update({
        "row_id": fid,
        "is_instrument_specific": False,
        "instrument_name": None,
        "waveband_category": cat,
        "lam_lo_m": lam_lo,
        "lam_hi_m": lam_hi,
        "wavelength_display": unknown_to_none(wc),
        "capabilities": {k: None for k in
                         ("polarimetry", "interferometry", "ao", "spectroscopy", "imaging", "mos", "ifu")},
        "spec_res_best": None,
        "spat_res_arcsec_best": None,
        "fov_arcsec_best": None,
        "instrument_access": None,
        "aperture_m": unknown_to_none(fac.get("aperture_m")),
        "instrument_count": fac.get("instrument_count", 0),
    })
    rows.append(row)

out_path = os.path.join(DATA_DIR, "observations.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(rows, f, indent=1, ensure_ascii=False)
    f.write("\n")

print(f"observations.json: {len(rows)} rows "
      f"({sum(1 for r in rows if r['is_instrument_specific'])} instrument-specific, "
      f"{sum(1 for r in rows if not r['is_instrument_specific'])} facility-level)")
if skipped:
    print("SKIPPED (no crosswalk match -- won't appear in the unified view):", skipped)
numeric = sum(1 for r in rows if r["lam_lo_m"] is not None)
print(f"rows with a numeric wavelength/frequency range: {numeric} / {len(rows)}")
