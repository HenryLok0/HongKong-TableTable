"""Store unique-name totals and a daily source-count history."""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RANKINGS = ROOT / "data" / "rankings.json"
LCSD = ROOT / "data" / "lcsd.json"
BADGES = ROOT / "data" / "badges.json"
COMP = ROOT / "data" / "comp.json"
HISTORY = ROOT / "data" / "source_history.json"
META = ROOT / "data" / "meta.json"
HKT = timezone(timedelta(hours=8))
HISTORY_LIMIT = 90


def current_year() -> str:
    return str(datetime.now(HKT).year)


def badge_in_year(recs: object, year: str) -> bool:
    return any(str(rec.get("session") or "").startswith(year) for rec in (recs or []))


def norm(name: object) -> str:
    return re.sub(r"\s+", "", str(name or ""))


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def player_count(path: Path, listed: bool) -> int:
    if not path.exists():
        return 0
    data = load(path)
    if data.get("count") is not None:
        return int(data["count"])
    players = data.get("players") or ([] if listed else {})
    return len(players)


def badge_year_names() -> set[str]:
    keys: set[str] = set()
    if not BADGES.exists():
        return keys
    year = current_year()
    for name, recs in (load(BADGES).get("players") or {}).items():
        key = norm(name)
        if key and badge_in_year(recs, year):
            keys.add(key)
    return keys


def unique_names() -> int:
    keys: set[str] = set()
    rankings = load(RANKINGS)
    for player in rankings.get("players") or []:
        key = norm(player.get("name"))
        if key:
            keys.add(key)
    if LCSD.exists():
        for name in load(LCSD).get("players") or {}:
            key = norm(name)
            if key:
                keys.add(key)
    keys.update(badge_year_names())
    return len(keys)


def latest_source_time() -> str:
    times = []
    for path in (RANKINGS, LCSD, BADGES):
        if not path.exists():
            continue
        text = str(load(path).get("updated") or "").strip()
        if text:
            times.append(text)
    return max(times) if times else datetime.now(HKT).strftime("%Y-%m-%d %H:%M")


def comp_counts() -> dict:
    if not COMP.exists():
        return {"hkssf": 0, "open": 0, "hkgames": 0, "updated": ""}
    data = load(COMP)
    counts = data.get("counts") or {}
    return {
        "hkssf": int(counts.get("hkssf") or 0),
        "open": int(counts.get("open") or 0),
        "hkgames": int(counts.get("hkgames") or 0),
        "updated": str(data.get("updated") or ""),
    }


def current_snapshot() -> dict:
    unique = unique_names()
    year_badges = len(badge_year_names())
    extra = comp_counts()
    return {
        "at": latest_source_time(),
        "hktta": player_count(RANKINGS, True),
        "lcsd": player_count(LCSD, False),
        "badges": year_badges,
        "unique": unique,
        **extra,
    }


def write_history(snap: dict) -> None:
    hist: dict = {"snapshots": []}
    if HISTORY.exists():
        try:
            hist = load(HISTORY)
        except (OSError, json.JSONDecodeError):
            hist = {"snapshots": []}
    snaps = list(hist.get("snapshots") or [])
    prev = snaps[-1] if snaps else None
    if switched_from_archive_badges(snap, prev):
        prev = None
    if prev:
        snap["prev"] = {
            "hktta": prev.get("hktta"),
            "lcsd": prev.get("lcsd"),
            "badges": prev.get("badges"),
            "unique": prev.get("unique"),
        }
    snaps.append(snap)
    HISTORY.write_text(
        json.dumps({"snapshots": snaps[-HISTORY_LIMIT:]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def last_history_unique() -> int | None:
    if not HISTORY.exists():
        return None
    try:
        snaps = load(HISTORY).get("snapshots") or []
    except (OSError, json.JSONDecodeError):
        return None
    if not snaps:
        return None
    value = snaps[-1].get("unique")
    return int(value) if value is not None else None


def stamp_unique(snap: dict) -> None:
    rankings = load(RANKINGS)
    prev = last_history_unique()
    if prev is None:
        prev = rankings.get("uniqueCount")
    if prev is None:
        prev = snap["unique"]
    last = last_snapshot()
    if switched_from_archive_badges(snap, last):
        prev = snap["unique"]
        last = None
    rankings["uniqueCount"] = snap["unique"]
    rankings["uniquePrev"] = prev
    RANKINGS.write_text(json.dumps(rankings, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if BADGES.exists():
        badges = load(BADGES)
        badge_prev = (last or {}).get("badges")
        badges["countAll"] = archive_name_count(BADGES)
        badges["count"] = snap["badges"]
        badges["prevCount"] = badge_prev if badge_prev is not None else snap["badges"]
        badges["countYear"] = current_year()
        BADGES.write_text(json.dumps(badges, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def lcsd_doc_codes(lcsd: dict) -> dict[str, list[str]]:
    codes: dict[str, list[str]] = {}
    for recs in (lcsd.get("players") or {}).values():
        for rec in recs or []:
            url = rec.get("url") or f"{rec.get('district')}|{rec.get('year')}"
            code = str(rec.get("group") or "").upper()
            if not url or not code:
                continue
            bucket = codes.setdefault(url, [])
            if code not in bucket:
                bucket.append(code)
    return codes


def snapshot_from(rankings: dict, lcsd: dict, badges: dict) -> dict:
    year = current_year()
    keys: set[str] = set()
    year_badges = 0
    for player in rankings.get("players") or []:
        key = norm(player.get("name"))
        if key:
            keys.add(key)
    for name in lcsd.get("players") or {}:
        key = norm(name)
        if key:
            keys.add(key)
    for name, recs in (badges.get("players") or {}).items():
        key = norm(name)
        if key and badge_in_year(recs, year):
            keys.add(key)
            year_badges += 1
    hktta = rankings.get("count")
    if hktta is None:
        hktta = len(rankings.get("players") or [])
    lcsd_n = lcsd.get("count")
    if lcsd_n is None:
        lcsd_n = len(lcsd.get("players") or {})
    times = [str(item.get("updated") or "").strip() for item in (rankings, lcsd, badges)]
    times = [text for text in times if text]
    return {
        "at": max(times) if times else datetime.now(HKT).strftime("%Y-%m-%d %H:%M"),
        "hktta": int(hktta or 0),
        "lcsd": int(lcsd_n or 0),
        "badges": year_badges,
        "unique": len(keys),
    }


def write_meta(snap: dict | None = None) -> None:
    rankings = load(RANKINGS) if RANKINGS.exists() else {}
    lcsd = load(LCSD) if LCSD.exists() else {}
    badges = load(BADGES) if BADGES.exists() else {}
    extra = comp_counts()
    if snap is None:
        snap = snapshot_from(rankings, lcsd, badges)
        snap.update(extra)
    prior = rankings.get("prior") or {}
    payload = {
        "hktta": snap["hktta"],
        "lcsd": snap["lcsd"],
        "badges": snap["badges"],
        "unique": snap["unique"],
        "uniquePrev": rankings.get("uniquePrev"),
        "period": rankings.get("period") or "",
        "updated": rankings.get("updated") or "",
        "totals": rankings.get("totals") or {},
        "priorPeriod": prior.get("period") or "",
        "hkttaPrev": rankings.get("prevCount"),
        "lcsdPrev": lcsd.get("prevCount"),
        "badgesPrev": badges.get("prevCount"),
        "lcsdUpdated": lcsd.get("updated") or "",
        "badgesUpdated": badges.get("updated") or "",
        "hkssf": snap.get("hkssf", extra["hkssf"]),
        "open": snap.get("open", extra["open"]),
        "hkgames": snap.get("hkgames", extra["hkgames"]),
        "compUpdated": extra.get("updated") or "",
        "lcsdDocCodes": lcsd_doc_codes(lcsd),
    }
    META.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def archive_name_count(path: Path) -> int:
    if not path.exists():
        return 0
    return len(load(path).get("players") or {})


def last_snapshot() -> dict | None:
    if not HISTORY.exists():
        return None
    try:
        snaps = load(HISTORY).get("snapshots") or []
    except (OSError, json.JSONDecodeError):
        return None
    return snaps[-1] if snaps else None


def switched_from_archive_badges(snap: dict, last: dict | None) -> bool:
    if not last:
        return False
    all_badges = archive_name_count(BADGES)
    prev_badges = last.get("badges")
    return (
        isinstance(prev_badges, int)
        and all_badges > 0
        and prev_badges == all_badges
        and snap["badges"] < all_badges
    )

def main() -> None:
    snap = current_snapshot()
    stamp_unique(snap)
    write_meta(snap)
    write_history(snap)
    print(f"unique {snap['unique']} hktta {snap['hktta']} lcsd {snap['lcsd']} badges {snap['badges']}")


if __name__ == "__main__":
    main()
