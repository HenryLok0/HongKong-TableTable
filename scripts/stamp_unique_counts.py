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
HISTORY = ROOT / "data" / "source_history.json"
HKT = timezone(timedelta(hours=8))
HISTORY_LIMIT = 90


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
    if BADGES.exists():
        for name in load(BADGES).get("players") or {}:
            key = norm(name)
            if key:
                keys.add(key)
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


def current_snapshot() -> dict:
    unique = unique_names()
    return {
        "at": latest_source_time(),
        "hktta": player_count(RANKINGS, True),
        "lcsd": player_count(LCSD, False),
        "badges": player_count(BADGES, False),
        "unique": unique,
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


def stamp_unique(snap: dict) -> None:
    rankings = load(RANKINGS)
    prev = rankings.get("uniqueCount")
    if prev is None:
        prev = snap["unique"]
    rankings["uniqueCount"] = snap["unique"]
    rankings["uniquePrev"] = prev
    RANKINGS.write_text(json.dumps(rankings, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    snap = current_snapshot()
    stamp_unique(snap)
    write_history(snap)
    print(f"unique {snap['unique']} hktta {snap['hktta']} lcsd {snap['lcsd']} badges {snap['badges']}")


if __name__ == "__main__":
    main()
