"""Remember when expensive archive scans last ran."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "data" / "archive_state.json"
HKT = timezone(timedelta(hours=8))


def load() -> dict:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def due(key: str, days: int = 7) -> bool:
    state = load()
    raw = str(state.get(key) or "")
    if not raw:
        return True
    try:
        seen = datetime.strptime(raw[:16], "%Y-%m-%d %H:%M").replace(tzinfo=HKT)
    except ValueError:
        try:
            seen = datetime.strptime(raw[:10], "%Y-%m-%d").replace(tzinfo=HKT)
        except ValueError:
            return True
    return datetime.now(HKT) - seen >= timedelta(days=days)


def mark(key: str) -> None:
    state = load()
    state[key] = datetime.now(HKT).strftime("%Y-%m-%d %H:%M")
    save(state)
