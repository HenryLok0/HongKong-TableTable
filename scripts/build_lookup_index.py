"""Build per-name lookup shards so the Worker does not parse full LCSD/badge/history JSON."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LCSD = ROOT / "data" / "lcsd.json"
BADGES = ROOT / "data" / "badges.json"
HISTORY = ROOT / "data" / "hktta_history.json"
COMP = ROOT / "data" / "comp.json"
OUT_DIR = ROOT / "data" / "idx" / "s"
READY = ROOT / "data" / "idx" / "_ready.json"
HKT = timezone(timedelta(hours=8))


def norm(name: object) -> str:
    return "".join(str(name or "").split())


def shard_id(key: str) -> str:
    # FNV-1a 32-bit, first two hex digits. Must match workers/hk-tt.js shardId().
    h = 2166136261
    for ch in key:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return f"{h:08x}"[:2]


def load(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def put(shards: dict[str, dict], key: str, field: str, value: object) -> None:
    if not key or not value:
        return
    rec = shards[shard_id(key)].setdefault(key, {})
    rec[field] = value


def main() -> None:
    shards: dict[str, dict] = defaultdict(dict)
    lcsd = load(LCSD)
    for name, recs in (lcsd.get("players") or {}).items():
        put(shards, norm(name), "l", recs)
    badges = load(BADGES)
    for name, recs in (badges.get("players") or {}).items():
        put(shards, norm(name), "b", recs)
    history = load(HISTORY)
    for name, recs in (history.get("players") or {}).items():
        put(shards, norm(name), "p", recs)
    comp = load(COMP)
    for name, recs in (comp.get("players") or {}).items():
        put(shards, norm(name), "c", recs)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.json"):
        old.unlink()

    files = 0
    names = 0
    for sid, payload in shards.items():
        if not payload:
            continue
        (OUT_DIR / f"{sid}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        files += 1
        names += len(payload)

    ready = {
        "v": 1,
        "updated": datetime.now(HKT).strftime("%Y-%m-%d %H:%M"),
        "files": files,
        "names": names,
    }
    READY.write_text(json.dumps(ready, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"lookup shards {files} files {names} names")


if __name__ == "__main__":
    main()
