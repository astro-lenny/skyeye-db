#!/usr/bin/env python3
"""Regenerate data/*.csv, data/*.json and data/webapp_facilities.json from a frozen
research edition under research/<edition>/. The frozen edition is read-only input;
this script only ever writes under data/.

Usage:
    python3 scripts/build_integration.py [edition_folder_name]

Defaults to the newest folder under research/ if no edition is given.
"""
import json
import csv
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH_DIR = os.path.join(REPO_ROOT, "research")
DATA_DIR = os.path.join(REPO_ROOT, "data")
IF_INSTRUMENTS_CSV = os.path.join(DATA_DIR, "data.csv")


def pick_edition():
    if len(sys.argv) > 1:
        return sys.argv[1]
    editions = sorted(
        d for d in os.listdir(RESEARCH_DIR)
        if os.path.isdir(os.path.join(RESEARCH_DIR, d))
    )
    if not editions:
        sys.exit(f"No edition folders found under {RESEARCH_DIR}")
    return editions[-1]


EDITION = pick_edition()
SRC_DIR = os.path.join(RESEARCH_DIR, EDITION)
print(f"Building from research edition: {EDITION}")

with open(os.path.join(SRC_DIR, "inventory.json"), encoding="utf-8") as f:
    INV = json.load(f)

ELIGIBLE_IDS = set()
with open(os.path.join(SRC_DIR, "master.csv"), encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        ELIGIBLE_IDS.add(row["id"])


def jcell(v):
    if v is None:
        return "unknown"
    if isinstance(v, (list, dict)):
        if isinstance(v, list) and len(v) == 0:
            return "[]"
        return json.dumps(v, ensure_ascii=False)
    return v


def write_csv(path, fieldnames, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: jcell(r.get(k)) for k in fieldnames})


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
        f.write("\n")


# ---------------------------------------------------------------------------
# facilities
# ---------------------------------------------------------------------------
AGGREGATE_CLASSES = {"network", "observatory_access_scope"}
NETWORK_MEMBER_PREDICATES = {
    "listed_component_of_facility_or_network",
    "physical_member_of_observatory_aggregate",
    "participates_in_2027A_network",
    "can_feed_interferometric_configuration",
}

# Membership relationships point member -> aggregate (subject = member facility/instrument,
# object = the network/aggregate it belongs to), so index by object_id, not subject_id.
rel_by_object = {}
for r in INV["relationships"]:
    rel_by_object.setdefault(r["object_id"], []).append(r)

facility_rows = []
for fac in INV["facilities"]:
    fid = fac["id"]
    entity_class = fac.get("entity_class", "unknown")
    is_aggregate = entity_class in AGGREGATE_CLASSES
    member_ids = sorted({
        r["subject_id"] for r in rel_by_object.get(fid, [])
        if r["predicate"] in NETWORK_MEMBER_PREDICATES
    })
    facility_rows.append({
        "id": fid,
        "official_name": fac.get("official_name"),
        "aliases": fac.get("aliases") or [],
        "category": fac.get("category"),
        "facility_type": fac.get("facility_type"),
        "entity_class": entity_class,
        "physical_telescope_class": "aggregate_do_not_count_as_physical_telescope" if is_aggregate else "single_catalogue_facility",
        "physical_count_caveat": fac.get("physical_count_caveat"),
        "eligible": fid in ELIGIBLE_IDS,
        "operational_status": fac.get("operational_status"),
        "proposal_access_status": fac.get("proposal_access_status"),
        "observatory": fac.get("observatory"),
        "operator": fac.get("operator"),
        "network": fac.get("network"),
        "country": fac.get("country"),
        "region": fac.get("region"),
        "location": fac.get("location"),
        "hemisphere": fac.get("hemisphere", "unknown"),
        "wavelength_coverage": fac.get("wavelength_coverage"),
        "aperture_m": fac.get("aperture_m"),
        "aperture_scope": fac.get("aperture_scope"),
        "collecting_area_m2": fac.get("collecting_area_m2"),
        "instrument_ids": fac.get("instrument_ids") or [],
        "instrument_count": len(fac.get("instrument_ids") or []),
        "observing_modes": fac.get("observing_modes"),
        "technical_constraints": fac.get("technical_constraints"),
        "site_id": fac.get("site_id"),
        "member_facility_ids_from_relationships": member_ids,
        "official_url": fac.get("official_url"),
        "technical_documentation_urls": fac.get("technical_documentation_urls") or [],
        "source_ids": fac.get("source_ids") or [],
        "research_tranche": fac.get("research_tranche"),
        "notes": fac.get("notes"),
    })

FACILITY_FIELDS = list(facility_rows[0].keys())
write_csv(os.path.join(DATA_DIR, "facilities.csv"), FACILITY_FIELDS, facility_rows)
write_json(os.path.join(DATA_DIR, "facilities.json"), facility_rows)

# ---------------------------------------------------------------------------
# sites
# ---------------------------------------------------------------------------
site_rows = []
for s in INV["sites"]:
    site_rows.append({
        "id": s["id"],
        "name": s.get("name"),
        "country": s.get("country"),
        "region": s.get("region"),
        "facility_ids": s.get("facility_ids") or [],
        "facility_count": len(s.get("facility_ids") or []),
        "source_ids": s.get("source_ids") or [],
        "notes": s.get("notes"),
    })
SITE_FIELDS = list(site_rows[0].keys())
write_csv(os.path.join(DATA_DIR, "sites.csv"), SITE_FIELDS, site_rows)
write_json(os.path.join(DATA_DIR, "sites.json"), site_rows)

# ---------------------------------------------------------------------------
# programmes
# ---------------------------------------------------------------------------
programme_rows = []
for p in INV["programmes"]:
    programme_rows.append({
        "id": p["id"],
        "name": p.get("name"),
        "operator": p.get("operator"),
        "programme_status": p.get("programme_status"),
        "eligibility": p.get("eligibility"),
        "funding_vs_observing_note": p.get("funding_vs_observing_note"),
        "fees": p.get("fees"),
        "frequency": p.get("frequency"),
        "latest_call_found": p.get("latest_call_found"),
        "call_source_date": p.get("call_source_date"),
        "deadline": p.get("deadline"),
        "call_window_status": p.get("call_window_status"),
        "submission_portal": p.get("submission_portal"),
        "allocation_process": p.get("allocation_process"),
        "access_modes": p.get("access_modes"),
        "access_url": p.get("access_url"),
        "source_ids": p.get("source_ids") or [],
        "research_tranche": p.get("research_tranche"),
        "notes": p.get("notes"),
    })
PROGRAMME_FIELDS = list(programme_rows[0].keys())
write_csv(os.path.join(DATA_DIR, "programmes.csv"), PROGRAMME_FIELDS, programme_rows)
write_json(os.path.join(DATA_DIR, "programmes.json"), programme_rows)

# ---------------------------------------------------------------------------
# facility<->programme routes
# ---------------------------------------------------------------------------
fac_by_id = {f["id"]: f for f in INV["facilities"]}
prog_by_id = {p["id"]: p for p in INV["programmes"]}

route_rows = []
for r in INV["routes"]:
    fac = fac_by_id.get(r["facility_id"], {})
    prog = prog_by_id.get(r["programme_id"], {})
    route_rows.append({
        "id": r["id"],
        "facility_id": r["facility_id"],
        "facility_name": fac.get("official_name"),
        "programme_id": r["programme_id"],
        "programme_name": prog.get("name"),
        "route_status": r.get("route_status"),
        "verification": r.get("verification"),
        "covered_instruments": r.get("covered_instruments") or [],
        "eligibility": r.get("eligibility"),
        "access_evidence": r.get("access_evidence"),
        "source_ids": r.get("source_ids") or [],
        "research_tranche": r.get("research_tranche"),
        "notes": r.get("notes"),
    })
ROUTE_FIELDS = list(route_rows[0].keys())
write_csv(os.path.join(DATA_DIR, "facility_programme_routes.csv"), ROUTE_FIELDS, route_rows)
write_json(os.path.join(DATA_DIR, "facility_programme_routes.json"), route_rows)

# ---------------------------------------------------------------------------
# instruments (supplementary)
# ---------------------------------------------------------------------------
instrument_rows = []
for i in INV["instruments"]:
    instrument_rows.append({
        "id": i["id"],
        "name": i.get("name"),
        "facility_id": i.get("facility_id"),
        "status": i.get("status"),
        "source_ids": i.get("source_ids") or [],
    })
INSTRUMENT_FIELDS = list(instrument_rows[0].keys())
write_csv(os.path.join(DATA_DIR, "inventory_instruments.csv"), INSTRUMENT_FIELDS, instrument_rows)
write_json(os.path.join(DATA_DIR, "inventory_instruments.json"), instrument_rows)

# ---------------------------------------------------------------------------
# relationships (supplementary)
# ---------------------------------------------------------------------------
relationship_rows = []
for r in INV["relationships"]:
    relationship_rows.append({
        "subject_id": r["subject_id"],
        "predicate": r["predicate"],
        "object_id": r["object_id"],
        "source_ids": r.get("source_ids") or [],
    })
REL_FIELDS = list(relationship_rows[0].keys())
write_csv(os.path.join(DATA_DIR, "relationships.csv"), REL_FIELDS, relationship_rows)
write_json(os.path.join(DATA_DIR, "relationships.json"), relationship_rows)

# ---------------------------------------------------------------------------
# facility_location
# ---------------------------------------------------------------------------
PROXY_SCOPES = {"shared_observatory_site_reference", "registry_telescope_or_array_reference", "array_core_reference"}

location_rows = []
for fac in INV["facilities"]:
    lat = fac.get("latitude_deg")
    lon = fac.get("longitude_deg")
    has_coords = isinstance(lat, (int, float)) and isinstance(lon, (int, float))
    coord_scope = fac.get("coordinate_scope")
    location_rows.append({
        "facility_id": fac["id"],
        "official_name": fac.get("official_name"),
        "category": fac.get("category"),
        "entity_class": fac.get("entity_class"),
        "eligible": fac["id"] in ELIGIBLE_IDS,
        "has_known_coordinates": has_coords,
        "latitude_deg": lat if has_coords else "unknown",
        "longitude_deg_east_positive": lon if has_coords else "unknown",
        "elevation_m": fac.get("elevation_m", "unknown"),
        "hemisphere": fac.get("hemisphere", "unknown"),
        "coordinate_scope": coord_scope or ("own_official_value" if has_coords else "unknown"),
        "is_shared_site_or_registry_proxy": bool(coord_scope in PROXY_SCOPES),
        "coordinate_source_ids": fac.get("coordinate_source_ids") or [],
        "coordinate_notes": fac.get("coordinate_notes"),
        "coordinate_alternatives": fac.get("coordinate_alternatives") or [],
        "min_declination_ideal_horizon_deg": fac.get("min_declination_ideal_horizon_deg", "unknown"),
        "max_declination_ideal_horizon_deg": fac.get("max_declination_ideal_horizon_deg", "unknown"),
        "declination_bounds_status": fac.get("declination_bounds_status", "unknown"),
        "declination_is_geometric_estimate_not_verified_pointing_limit": True,
    })
LOCATION_FIELDS = list(location_rows[0].keys())
write_csv(os.path.join(DATA_DIR, "facility_location.csv"), LOCATION_FIELDS, location_rows)
write_json(os.path.join(DATA_DIR, "facility_location.json"), location_rows)

known_coord_count = sum(1 for r in location_rows if r["has_known_coordinates"])

# ---------------------------------------------------------------------------
# instrumentfinder_crosswalk
# ---------------------------------------------------------------------------
existing_facilities = []
if os.path.exists(IF_INSTRUMENTS_CSV):
    with open(IF_INSTRUMENTS_CSV, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            existing_facilities.append(row["Facility"])
existing_facilities = sorted(set(existing_facilities))


def norm_name(s):
    return "".join(ch.lower() for ch in s if ch.isalnum())


alias_index = {}
for fac in INV["facilities"]:
    names = [fac.get("official_name", "")] + (fac.get("aliases") or [])
    for n in names:
        if n:
            alias_index.setdefault(norm_name(n), []).append(fac["id"])

# Verified manual overrides for cases where the inventory's own alias list is
# incomplete (a data gap in the source, not a guess on our part) -- each is
# confirmed against independent fields (operator name, official_url domain).
# Add new entries here as new crosswalk gaps are found; always justify them.
MANUAL_OVERRIDES = {
    "alma": ("amer-alma", "Verified, not guessed: inventory record amer-alma has official_name "
             "'Atacama Large Millimeter/submillimeter Array', operator 'Joint ALMA Observatory', "
             "official_url on almascience.eso.org, and registry_aliases including 'ALMA' nested under "
             "coordinate_alternatives -- but the facility's own top-level aliases:[] is empty, so exact/alias "
             "matching misses it. This is a data-completeness gap in the source record, not an ambiguous match."),
}

crosswalk_rows = []
for name in existing_facilities:
    key = norm_name(name)
    override = MANUAL_OVERRIDES.get(key)
    if override:
        fid, note = override
        crosswalk_rows.append({
            "instrumentfinder_facility_name": name,
            "inventory_facility_id": fid,
            "inventory_official_name": fac_by_id[fid].get("official_name"),
            "match_confidence": "manual_verified_override",
            "notes": note,
        })
        continue
    candidates = alias_index.get(key)
    if not candidates:
        candidates = sorted({
            fac["id"] for fac in INV["facilities"]
            if key and key in norm_name(fac.get("official_name", ""))
        })
    if not candidates:
        crosswalk_rows.append({
            "instrumentfinder_facility_name": name,
            "inventory_facility_id": "unknown",
            "inventory_official_name": "unknown",
            "match_confidence": "no_match",
            "notes": "No facility in the inventory matched this name or its aliases by exact or substring match. Needs manual lookup.",
        })
    elif len(candidates) == 1:
        fid = candidates[0]
        crosswalk_rows.append({
            "instrumentfinder_facility_name": name,
            "inventory_facility_id": fid,
            "inventory_official_name": fac_by_id[fid].get("official_name"),
            "match_confidence": "exact_name_or_alias",
            "notes": "",
        })
    else:
        crosswalk_rows.append({
            "instrumentfinder_facility_name": name,
            "inventory_facility_id": "AMBIGUOUS:" + "|".join(candidates),
            "inventory_official_name": "AMBIGUOUS",
            "match_confidence": "ambiguous_multiple_candidates",
            "notes": "Multiple inventory facilities matched; flagged for manual review rather than guessed.",
        })

CROSSWALK_FIELDS = ["instrumentfinder_facility_name", "inventory_facility_id", "inventory_official_name", "match_confidence", "notes"]
write_csv(os.path.join(DATA_DIR, "instrumentfinder_crosswalk.csv"), CROSSWALK_FIELDS, crosswalk_rows)
write_json(os.path.join(DATA_DIR, "instrumentfinder_crosswalk.json"), crosswalk_rows)

# ---------------------------------------------------------------------------
# webapp_facilities.json -- denormalized view-model for the static site
# ---------------------------------------------------------------------------
loc_by_id = {r["facility_id"]: r for r in location_rows}
routes_by_facility = {}
for r in INV["routes"]:
    routes_by_facility.setdefault(r["facility_id"], []).append(r)


def clean_unknown(v):
    return None if v == "unknown" else v


webapp_rows = []
for fac in facility_rows:
    fid = fac["id"]
    loc = loc_by_id.get(fid, {})
    routes_out = []
    for r in routes_by_facility.get(fid, []):
        prog = prog_by_id.get(r["programme_id"], {})
        routes_out.append({
            "route_id": r["id"],
            "programme_id": r["programme_id"],
            "programme_name": prog.get("name"),
            "route_status": r.get("route_status"),
            "programme_status": prog.get("programme_status"),
            "call_window_status": prog.get("call_window_status"),
            "eligibility": r.get("eligibility") or prog.get("eligibility"),
            "funding_vs_observing_note": prog.get("funding_vs_observing_note"),
            "fees": prog.get("fees"),
            "frequency": prog.get("frequency"),
            "latest_call_found": prog.get("latest_call_found"),
            "deadline": prog.get("deadline"),
            "submission_portal": prog.get("submission_portal"),
            "allocation_process": prog.get("allocation_process"),
            "covered_instruments": r.get("covered_instruments") or [],
            "access_evidence": r.get("access_evidence"),
            "verification": r.get("verification"),
            "notes": r.get("notes"),
        })
    webapp_rows.append({
        "id": fid,
        "official_name": fac["official_name"],
        "aliases": fac["aliases"],
        "category": fac["category"],
        "facility_type": fac["facility_type"],
        "entity_class": fac["entity_class"],
        "is_aggregate_not_physical_telescope": fac["physical_telescope_class"] != "single_catalogue_facility",
        "physical_count_caveat": fac["physical_count_caveat"],
        "eligible": fac["eligible"],
        "operational_status": fac["operational_status"],
        "proposal_access_status": fac["proposal_access_status"],
        "country": fac["country"],
        "region": fac["region"],
        "location": fac["location"],
        "operator": clean_unknown(fac["operator"]),
        "wavelength_coverage": clean_unknown(fac["wavelength_coverage"]),
        "aperture_m": clean_unknown(fac["aperture_m"]),
        "aperture_scope": clean_unknown(fac["aperture_scope"]),
        "instrument_count": fac["instrument_count"],
        "observing_modes": clean_unknown(fac["observing_modes"]),
        "technical_constraints": clean_unknown(fac["technical_constraints"]),
        "official_url": clean_unknown(fac["official_url"]),
        "notes": clean_unknown(fac["notes"]),
        "hemisphere": clean_unknown(loc.get("hemisphere")),
        "latitude_deg": loc.get("latitude_deg") if loc.get("has_known_coordinates") else None,
        "longitude_deg": loc.get("longitude_deg_east_positive") if loc.get("has_known_coordinates") else None,
        "elevation_m": clean_unknown(loc.get("elevation_m")),
        "has_known_coordinates": bool(loc.get("has_known_coordinates")),
        "is_shared_site_or_registry_proxy": bool(loc.get("is_shared_site_or_registry_proxy")),
        "coordinate_notes": clean_unknown(loc.get("coordinate_notes")),
        "min_declination_deg": clean_unknown(loc.get("min_declination_ideal_horizon_deg")),
        "max_declination_deg": clean_unknown(loc.get("max_declination_ideal_horizon_deg")),
        "declination_bounds_status": clean_unknown(loc.get("declination_bounds_status")),
        "route_count": len(routes_out),
        "routes": routes_out,
    })

write_json(os.path.join(DATA_DIR, "webapp_facilities.json"), webapp_rows)

print("facilities:", len(facility_rows), "| eligible:", sum(1 for r in facility_rows if r["eligible"]))
print("sites:", len(site_rows))
print("programmes:", len(programme_rows))
print("routes:", len(route_rows))
print("instruments:", len(instrument_rows))
print("relationships:", len(relationship_rows))
print("facility_location known coordinates:", known_coord_count, "/", len(location_rows))
print("instrumentfinder_crosswalk:", len(crosswalk_rows), "rows ->", [r["match_confidence"] for r in crosswalk_rows])
print("webapp_facilities.json:", len(webapp_rows), "facilities,",
      sum(len(r["routes"]) for r in webapp_rows), "routes nested")
