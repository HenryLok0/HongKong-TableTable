"""Store unique-name totals on rankings.json for the homepage delta arrows."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RANKINGS = ROOT / "data" / "rankings.json"
LCSD = ROOT / "data" / "lcsd.json"
BADGES = ROOT / "data" / "badges.json"


def norm(name: object) -> str:
    return re.sub(r"\s+", "", str(name or ""))


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def unique_names() -> int:
    keys: set[str] = set()
    rankings = load(RANKINGS)
    for player in rankings.get("players") or []:
        key = norm(player.get("name"))
        if key:
            keys.add(key)
    if LCSD.exists():
        for name in (load(LCSD).get("players") or {}):
            key = norm(name)
            if key:
                keys.add(key)
    if BADGES.exists():
        for name in (load(BADGES).get("players") or {}):
            key = norm(name)
            if key:
                keys.add(key)
    return len(keys)


def main() -> None:
    rankings = load(RANKINGS)
    current = unique_names()
    prev = rankings.get("uniqueCount")
    if prev is None:
        prev = current
    rankings["uniqueCount"] = current
    rankings["uniquePrev"] = prev
    RANKINGS.write_text(json.dumps(rankings, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"unique {current} (prev {prev})")


if __name__ == "__main__":
    main()
