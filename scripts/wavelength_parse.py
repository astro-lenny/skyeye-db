"""Best-effort parsing of the inventory's free-text wavelength_coverage field.

Most values (≈85%) are bare category words ("optical", "radio", "X-ray", ...) with no
numeric range at all -- those get a waveband_category only. A minority have an actual
numeric range in varied formats; those additionally get lamLo_m/lamHi_m in meters so they
can participate in the same numeric wavelength/frequency filter as InstrumentFinder's
instrument-level rows. Unparsed numeric text is never guessed at -- it's left as
category-only, with the original string preserved for the detail view.
"""
import re

C = 299792458.0  # m/s

LENGTH_TO_M = {
    "pm": 1e-12, "angstrom": 1e-10, "angstroms": 1e-10, "å": 1e-10,
    "nm": 1e-9, "um": 1e-6, "µm": 1e-6, "micrometre": 1e-6, "micrometres": 1e-6,
    "micron": 1e-6, "microns": 1e-6, "mm": 1e-3, "cm": 1e-2, "m": 1.0,
}
FREQ_TO_HZ = {"hz": 1.0, "khz": 1e3, "mhz": 1e6, "ghz": 1e9, "thz": 1e12}
HC_EV_M = 1.239841984e-6  # eV * m
ENERGY_TO_EV = {"ev": 1.0, "kev": 1e3, "mev": 1e6, "gev": 1e9, "tev": 1e12}

# Longest/most-specific tokens first: Python's re tries alternatives left-to-right and
# stops at the first that matches, NOT the longest, so a bare "m" (or "u?m") listed before
# "mhz"/"mm" would wrongly swallow just the leading letter of those and misclassify the unit.
UNIT_PATTERN = (
    r"(?:pm|nm|micrometres?|microns?|µm|um|mm|cm|angstroms?|å"
    r"|ghz|mhz|khz|hz|tev|gev|mev|kev|ev|m)"
)
# one numeric token, e.g. "0.32", "1,350", "69"
NUM = r"(\d[\d,]*\.?\d*)"
RANGE_RE = re.compile(
    rf"{NUM}\s*[-–—/]\s*{NUM}\s*({UNIT_PATTERN})\b", re.IGNORECASE
)
# fallback: "NUM unit" with no range (e.g. a single centre frequency mentioned)
SINGLE_RE = re.compile(rf"{NUM}\s*({UNIT_PATTERN})\b", re.IGNORECASE)
# several "NUM-NUM" segments sharing one trailing unit, e.g. "69-90, 84-116, 210-275 GHz"
MULTI_SEGMENT_RE = re.compile(
    rf"((?:{NUM}\s*[-–—]\s*{NUM}\s*,\s*)+{NUM}\s*[-–—]\s*{NUM})\s*({UNIT_PATTERN})\b",
    re.IGNORECASE,
)
PAIR_RE = re.compile(rf"{NUM}\s*[-–—]\s*{NUM}")


def _to_meters(value, unit):
    u = unit.lower().replace("µ", "u").replace("å", "angstrom")
    if u in LENGTH_TO_M:
        return value * LENGTH_TO_M[u]
    if u in FREQ_TO_HZ:
        hz = value * FREQ_TO_HZ[u]
        return C / hz if hz > 0 else None
    if u in ENERGY_TO_EV:
        ev = value * ENERGY_TO_EV[u]
        return HC_EV_M / ev if ev > 0 else None
    return None


def parse_wavelength_range_m(text):
    """Return (lam_lo_m, lam_hi_m) or (None, None) if nothing numeric could be parsed.
    Scans *all* range matches in the string (it may list several sub-bands) and returns
    the overall envelope -- the original text is always kept verbatim elsewhere for the
    precise per-band breakdown.
    """
    if not text or text == "unknown":
        return None, None
    values_m = []

    # Handle "NUM-NUM, NUM-NUM, ... NUM-NUM UNIT" (one trailing unit shared by several segments)
    # first, and remove the matched span so the per-segment loop below doesn't double count it.
    remaining = text
    for m in MULTI_SEGMENT_RE.finditer(text):
        segment_text, unit = m.group(1), m.group(6)
        for pair in PAIR_RE.finditer(segment_text):
            a = float(pair.group(1).replace(",", ""))
            b = float(pair.group(2).replace(",", ""))
            ma, mb = _to_meters(a, unit), _to_meters(b, unit)
            values_m.extend(v for v in (ma, mb) if v is not None)
        remaining = remaining.replace(m.group(0), " ", 1)

    for m in RANGE_RE.finditer(remaining):
        a = float(m.group(1).replace(",", ""))
        b = float(m.group(2).replace(",", ""))
        unit = m.group(3)
        ma, mb = _to_meters(a, unit), _to_meters(b, unit)
        values_m.extend(v for v in (ma, mb) if v is not None)
    if not values_m:
        # no explicit range; try a lone "NUM unit" as a degenerate single-point range
        m = SINGLE_RE.search(text)
        if m:
            a = float(m.group(1).replace(",", ""))
            unit = m.group(2)
            v = _to_meters(a, unit)
            if v is not None:
                values_m = [v]
    if not values_m:
        return None, None
    return min(values_m), max(values_m)


CATEGORY_RULES = [
    # (category label, any-of these substrings, case-insensitive)
    ("Gamma-ray", ["gamma"]),
    ("X-ray", ["x-ray", "xray"]),
    ("Cosmic ray", ["cosmic ray", "neutrino"]),
    ("Ultraviolet", ["ultraviolet", "extreme uv", "euv", " uv ", " uv,", " uv;", " uv)", "uv-"]),
    ("Millimeter/Submillimeter", ["millimet", "submillimet"]),
    ("Radio", ["radio"]),
]


FREQ_UNIT_RE = re.compile(r"\b(ghz|mhz|khz|hz)\b", re.IGNORECASE)
MM_UNIT_RE = re.compile(r"\d\s*mm\b", re.IGNORECASE)

# fallback bins by the midpoint wavelength, used only when no keyword matched anything --
# standard-ish astronomical regime boundaries, approximate by design.
WAVELENGTH_BINS_M = [
    (10e-9, "X-ray"),
    (400e-9, "Ultraviolet"),
    (700e-9, "Optical"),
    (350e-6, "Infrared"),
    (1e-2, "Millimeter/Submillimeter"),
    (float("inf"), "Radio"),
]


def _bin_by_wavelength(lam_lo_m, lam_hi_m):
    if lam_lo_m is None or lam_hi_m is None:
        return None
    mid = (lam_lo_m + lam_hi_m) / 2
    for upper, label in WAVELENGTH_BINS_M:
        if mid < upper:
            return label
    return "Radio"


def classify_waveband(text, lam_lo_m=None, lam_hi_m=None):
    if not text or text == "unknown":
        return "Unknown"
    t = " " + text.lower() + " "
    for label, needles in CATEGORY_RULES:
        if any(n in t for n in needles):
            return label
    has_optical = "optical" in t or "visible" in t or "white light" in t or "white-light" in t
    has_ir = "infrared" in t or "near-ir" in t or "/ir" in t or " ir " in t or "j/h/k" in t
    if has_optical and has_ir:
        return "Optical/Infrared"
    if has_ir:
        return "Infrared"
    if has_optical:
        return "Optical"
    if FREQ_UNIT_RE.search(t):
        return "Radio"
    if MM_UNIT_RE.search(t):
        return "Millimeter/Submillimeter"
    # last resort: classify by the parsed numeric wavelength itself, if we got one
    binned = _bin_by_wavelength(lam_lo_m, lam_hi_m)
    return binned or "Unknown"


if __name__ == "__main__":
    samples = [
        "optical", "optical / infrared", "Radio", "radio; EAVN modes station-dependent",
        "300–2500nm allowed telescope range; actual offered instrument sensitivity unknown",
        "16–88MHz (station/mode dependent)", "1350–1620MHz, optimizedHI1420MHz",
        "0.32–8.5 mm", "69–90, 84–116, 129–180, 210–275 GHz", "0.7–20 micrometres (instrument dependent)",
        "visible; J/H/K infrared", "85GeV to >30TeV gamma rays", "unknown",
        "L1.628–1.708GHz,S2.2–2.3GHz,X8.2–8.6GHz;GSSR8.560GHz", "4.5–8.8GHz;RT32additionally1.4–1.72GHz",
    ]
    for s in samples:
        lo, hi = parse_wavelength_range_m(s)
        cat = classify_waveband(s, lo, hi)
        print(f"{s!r:75} -> cat={cat:28} lo={lo} hi={hi}")
