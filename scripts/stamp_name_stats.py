"""Build compact given-name gender / age-band counts for client estimates.

Uses the current HKTTA snapshot plus LCSD records only (not ranking history).
Rules follow assets/app.js buildNameStats / mapLcsdRecord / mergeAgeRows.
"""

from __future__ import annotations

import json
import math
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RANKINGS = ROOT / "data" / "rankings.json"
LCSD = ROOT / "data" / "lcsd.json"
AGE_MAPS = ROOT / "data" / "lcsd_age_maps.json"
OUT = ROOT / "data" / "name_stats.json"
HKT = timezone(timedelta(hours=8))
OPEN = math.inf

HKTTA_AGE = {
    "U9": "u9",
    "U11": "10-11",
    "U13": "12-13",
    "U15": "14-15",
    "U17": "16-18",
    "U19": "16-18",
    "U21": "19-24",
}

AGE_BANDS = [
    ("65+", 65, OPEN),
    ("55-64", 55, 64),
    ("45-54", 45, 54),
    ("35-44", 35, 44),
    ("25-34", 25, 34),
    ("19-24", 19, 24),
    ("16-18", 16, 18),
    ("14-15", 14, 15),
    ("12-13", 12, 13),
    ("10-11", 10, 11),
    ("u9", 0, 9),
]

WTS_RE = re.compile(r"^[MF](Y[1-5]|S[1-3]|DS|DA|DY)$")
DOUBLES_RE = re.compile(r"^[MF]([KLM]|D[SAYBC])$")


def rng(lo: float, hi: float, doubles: bool = False) -> dict:
    return {"min": lo, "max": hi, "doubles": doubles}


LCSD_CORE = {
    "MB": rng(45, 54),
    "FB": rng(45, 54),
    "MC": rng(35, 44),
    "FC": rng(35, 44),
    "MD": rng(25, 34),
    "FD": rng(25, 34),
    "ME": rng(19, 24),
    "FE": rng(19, 24),
    "MF": rng(16, 18),
    "FF": rng(16, 18),
    "MG": rng(14, 15),
    "FG": rng(14, 15),
    "MH": rng(12, 13),
    "FH": rng(12, 13),
    "MI": rng(10, 11),
    "FI": rng(10, 11),
    "MJ": rng(0, 9),
    "FJ": rng(0, 9),
    "MK": rng(35, OPEN, True),
    "FK": rng(35, OPEN, True),
    "ML": rng(19, 34, True),
    "FL": rng(19, 34, True),
    "MM": rng(0, 18, True),
    "FM": rng(0, 18, True),
}

LCSD_SCHEMES = {
    "maa": {"MAA": rng(65, OPEN), "FAA": rng(65, OPEN), "MA": rng(55, 64), "FA": rng(55, 64), **LCSD_CORE},
    "classic": {"MA": rng(55, OPEN), "FA": rng(55, OPEN), **LCSD_CORE},
    "wts": {
        "MAA": rng(65, OPEN),
        "FAA": rng(65, OPEN),
        "MS1": rng(55, OPEN),
        "FS1": rng(55, OPEN),
        "MS2": rng(45, 54),
        "FS2": rng(45, 54),
        "MS3": rng(35, 44),
        "FS3": rng(35, 44),
        "MA1": rng(25, 34),
        "FA1": rng(25, 34),
        "MA2": rng(19, 24),
        "FA2": rng(19, 24),
        "MY1": rng(16, 18),
        "FY1": rng(16, 18),
        "MY2": rng(14, 15),
        "FY2": rng(14, 15),
        "MY3": rng(12, 13),
        "FY3": rng(12, 13),
        "MY4": rng(10, 11),
        "FY4": rng(10, 11),
        "MY5": rng(0, 9),
        "FY5": rng(0, 9),
        "MDS": rng(35, OPEN, True),
        "FDS": rng(35, OPEN, True),
        "MDA": rng(19, 34, True),
        "FDA": rng(19, 34, True),
        "MDY": rng(0, 18, True),
        "FDY": rng(0, 18, True),
    },
    "eleven": {
        "MA": rng(65, OPEN),
        "FA": rng(65, OPEN),
        "MB": rng(55, 64),
        "FB": rng(55, 64),
        "MC": rng(45, 54),
        "FC": rng(45, 54),
        "MD": rng(35, 44),
        "FD": rng(35, 44),
        "ME": rng(25, 34),
        "FE": rng(25, 34),
        "MF": rng(19, 24),
        "FF": rng(19, 24),
        "MG": rng(16, 18),
        "FG": rng(16, 18),
        "MH": rng(14, 15),
        "FH": rng(14, 15),
        "MI": rng(12, 13),
        "FI": rng(12, 13),
        "MJ": rng(10, 11),
        "FJ": rng(10, 11),
        "MK": rng(0, 9),
        "FK": rng(0, 9),
    },
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def norm(name: object) -> str:
    return re.sub(r"\s+", "", str(name or ""))


def given_chars(name: str) -> list[str]:
    chars = list(norm(name))
    if len(chars) < 2:
        return []
    return chars[1:]


def rec_year(rec: dict) -> int:
    try:
        return int(rec.get("year") or 0)
    except (TypeError, ValueError):
        return 0


def is_doubles(code: str, flag: object) -> bool:
    if flag:
        return True
    return bool(DOUBLES_RE.match(str(code or "").upper()))


def scheme_from_codes(codes: set[str]) -> str:
    if any(WTS_RE.match(c) for c in codes):
        return "wts"
    has_doubles_ladder = bool(codes & {"ML", "FL", "MM", "FM"})
    has_k = bool(codes & {"MK", "FK"})
    if has_k and not has_doubles_ladder:
        return "eleven"
    if codes & {"MAA", "FAA"}:
        return "maa"
    return "classic"


def lcsd_gender(rec: dict, scheme: str) -> str:
    code = str(rec.get("group") or "").upper()
    if not code:
        return ""
    if (len(code) > 1 and code[1] == "X") or code == "DN":
        return ""
    if scheme == "wts" and code == "MF":
        return ""
    if code.startswith("M"):
        return "M"
    if code.startswith("F"):
        return "F"
    return ""


def band_from_age(now_min: float, now_max: float) -> str:
    top = now_min if now_max == OPEN else now_max
    for band_id, lo, hi in AGE_BANDS:
        if now_min >= lo and top <= hi:
            return band_id
    mid = now_min if now_max == OPEN else (now_min + now_max) / 2
    for band_id, lo, hi in AGE_BANDS:
        cap = 80 if hi == OPEN else hi
        if lo <= mid <= cap:
            return band_id
    return ""


def stored_age(rec: dict) -> dict | None:
    try:
        amin = int(rec["ageMin"]) if rec.get("ageMin") is not None and rec.get("ageMin") != "" else None
    except (TypeError, ValueError):
        amin = None
    if amin is None:
        return None
    amax = rec.get("ageMax")
    if amax is None or amax == "":
        amax_n = OPEN
    else:
        try:
            amax_n = int(amax)
        except (TypeError, ValueError):
            amax_n = OPEN
    return {
        "min": amin,
        "max": amax_n,
        "doubles": bool(rec.get("doubles")),
        "code": str(rec.get("group") or "").upper(),
    }


def mapped_from_age_map(rec: dict, maps: dict) -> dict | None:
    code = str(rec.get("group") or "").upper()
    groups = {}
    url = rec.get("url") or ""
    if url and maps.get(url):
        groups = maps[url].get("groups") or {}
    key = f"{rec.get('district') or ''}|{rec.get('year') or ''}"
    if not groups and maps.get(key):
        groups = maps[key].get("groups") or {}
    info = groups.get(code) or groups.get(re.sub(r"\d+$", "", code))
    if not info or info.get("ageMin") is None:
        return None
    try:
        amin = int(info["ageMin"])
    except (TypeError, ValueError):
        return None
    amax = info.get("ageMax")
    amax_n = OPEN if amax is None or amax == "" else int(amax)
    return {"min": amin, "max": amax_n, "doubles": bool(info.get("doubles")), "code": code}


def resolve_scheme_group(raw: object, scheme: str) -> dict | None:
    code = str(raw or "").upper()
    if not code:
        return None
    table = LCSD_SCHEMES.get(scheme) or LCSD_SCHEMES["classic"]
    info = table.get(code)
    if not info:
        base = re.sub(r"\d+$", "", code)
        info = table.get(base) if base != code else None
        if not info:
            return None
        code = base
    return {"code": code, **info}


def age_row_span(row: dict) -> float:
    top = row["nowMin"] + 40 if row["nowMax"] == OPEN else row["nowMax"]
    return top - row["nowMin"]


def pick_mapped_age(rows: list[dict]) -> dict | None:
    valid = [row for row in rows if row and (row.get("band") or math.isfinite(row.get("nowMin", math.nan)))]
    if not valid:
        return None
    return sorted(valid, key=lambda row: (-rec_year({"year": row["year"]}), age_row_span(row)))[0]


def merge_age_rows(rows: list[dict]) -> dict | None:
    if not rows:
        return None
    now_min = max(r["nowMin"] for r in rows)
    caps = [math.inf if r["nowMax"] == OPEN else r["nowMax"] for r in rows]
    cap = min(caps)
    if now_min > cap:
        return pick_mapped_age(rows)
    cite = sorted(rows, key=lambda r: (age_row_span(r), -r["year"]))[0]
    now_max = OPEN if cap == math.inf else cap
    return {**cite, "nowMin": now_min, "nowMax": now_max, "band": band_from_age(now_min, now_max)}


def map_lcsd_record(rec: dict, maps: dict, scheme: str, year_now: int) -> dict | None:
    mapped = stored_age(rec) or mapped_from_age_map(rec, maps) or resolve_scheme_group(rec.get("group"), scheme)
    if not mapped:
        return None
    year = rec_year(rec)
    delta = max(0, year_now - year) if year else 0
    now_min = mapped["min"] + delta
    now_max = OPEN if mapped["max"] == OPEN else mapped["max"] + delta
    if not math.isfinite(now_min):
        return None
    return {
        "band": band_from_age(now_min, now_max),
        "code": mapped["code"],
        "year": year,
        "doubles": is_doubles(mapped["code"], mapped.get("doubles")),
        "nowMin": now_min,
        "nowMax": now_max,
    }


def lcsd_age_band(recs: list, maps: dict, doc_codes: dict, year_now: int) -> tuple[str, bool]:
    mapped = []
    for rec in recs:
        url = rec.get("url") or f"{rec.get('district') or ''}|{rec.get('year') or ''}"
        scheme = scheme_from_codes(doc_codes.get(url) or set())
        row = map_lcsd_record(rec, maps, scheme, year_now)
        if row:
            mapped.append(row)
    singles = [row for row in mapped if not row["doubles"]]
    doubles = [row for row in mapped if row["doubles"]]
    merged = merge_age_rows(singles) or merge_age_rows(doubles)
    if not merged:
        return "", False
    return merged.get("band") or "", bool(merged.get("doubles"))


def main() -> None:
    rankings = load(RANKINGS) if RANKINGS.exists() else {"players": []}
    lcsd = load(LCSD) if LCSD.exists() else {"players": {}}
    maps = (load(AGE_MAPS).get("maps") or {}) if AGE_MAPS.exists() else {}
    year_now = datetime.now(HKT).year

    doc_codes: dict[str, set[str]] = {}
    for recs in (lcsd.get("players") or {}).values():
        for rec in recs or []:
            url = rec.get("url") or f"{rec.get('district') or ''}|{rec.get('year') or ''}"
            code = str(rec.get("group") or "").upper()
            if url and code:
                doc_codes.setdefault(url, set()).add(code)

    gender: dict[str, dict[str, int]] = {}
    given_age: dict[str, dict[str, int]] = {}
    band_n: dict[str, int] = {}
    youth: set[str] = set()

    def bump_gender(ch: str, g: str) -> None:
        row = gender.setdefault(ch, {"M": 0, "F": 0})
        row[g] += 1

    def bump_age(name: str, band: str) -> None:
        if not band:
            return
        key = "".join(given_chars(name))
        if not key:
            return
        row = given_age.setdefault(key, {})
        row[band] = row.get(band, 0) + 1
        band_n[band] = band_n.get(band, 0) + 1

    for player in rankings.get("players") or []:
        name = str(player.get("name") or "")
        given = given_chars(name)
        g = player.get("gender")
        if g in ("M", "F"):
            for ch in given:
                bump_gender(ch, g)
        young = HKTTA_AGE.get((player.get("age") or {}).get("youngestGroup") or "")
        bump_age(name, young or "")
        if young:
            youth.add(norm(name))

    for name, recs in (lcsd.get("players") or {}).items():
        rows = recs if isinstance(recs, list) else []
        genders: set[str] = set()
        for rec in rows:
            url = rec.get("url") or f"{rec.get('district') or ''}|{rec.get('year') or ''}"
            scheme = scheme_from_codes(doc_codes.get(url) or set())
            g = lcsd_gender(rec, scheme)
            if g:
                genders.add(g)
        if len(genders) == 1:
            g = next(iter(genders))
            for ch in given_chars(name):
                bump_gender(ch, g)
        if norm(name) in youth:
            continue
        band, doubles = lcsd_age_band(rows, maps, doc_codes, year_now)
        if doubles:
            continue
        bump_age(name, band)

    payload = {
        "source": "Current HKTTA ranking snapshot plus LCSD records (not historical ranking PDFs)",
        "updated": datetime.now(HKT).strftime("%Y-%m-%d %H:%M"),
        "gender": gender,
        "givenAge": given_age,
        "bandN": band_n,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(gender)} chars, {len(given_age)} given names)")


if __name__ == "__main__":
    main()
