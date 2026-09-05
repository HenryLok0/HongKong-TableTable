"""Download HKTTA ranking PDFs and build a searchable JSON snapshot."""

from __future__ import annotations

import json
import re
import ssl
import tempfile
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data" / "rankings.json"

HKT = timezone(timedelta(hours=8))

BASE = "https://hktta.org.hk/registered_player/past_record/rankingList"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

# PDF-published singles lists. U18/U12 are web-only on HKTTA and 404 as PDFs.
LISTS = [
    ("Men-All", "M", "ALL", "男子所有球員"),
    ("Men-U21", "M", "U21", "男子 U21"),
    ("Men-U19", "M", "U19", "男子 U19"),
    ("Men-U17", "M", "U17", "男子 U17"),
    ("Men-U15", "M", "U15", "男子 U15"),
    ("Men-U13", "M", "U13", "男子 U13"),
    ("Men-U11", "M", "U11", "男子 U11"),
    ("Men-U9", "M", "U9", "男子 U9"),
    ("Women-All", "F", "ALL", "女子所有球員"),
    ("Women-U21", "F", "U21", "女子 U21"),
    ("Women-U19", "F", "U19", "女子 U19"),
    ("Women-U17", "F", "U17", "女子 U17"),
    ("Women-U15", "F", "U15", "女子 U15"),
    ("Women-U13", "F", "U13", "女子 U13"),
    ("Women-U11", "F", "U11", "女子 U11"),
    ("Women-U9", "F", "U9", "女子 U9"),
]

YOUNGEST_ORDER = ["U9", "U11", "U13", "U15", "U17", "U19", "U21"]

AGE_BAND = {
    "U9": {"label": "9歲或以下", "approx": "U9（9歲或以下）"},
    "U11": {"label": "約10–11歲", "approx": "U11 但未入 U9（約10–11歲）"},
    "U13": {"label": "約12–13歲", "approx": "U13 但未入 U11（約12–13歲）"},
    "U15": {"label": "約14–15歲", "approx": "U15 但未入 U13（約14–15歲）"},
    "U17": {"label": "約16–17歲", "approx": "U17 但未入 U15（約16–17歲）"},
    "U19": {"label": "約18–19歲", "approx": "U19 但未入 U17（約18–19歲）"},
    "U21": {"label": "約20–21歲", "approx": "U21 但未入 U19（約20–21歲）"},
}


def ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    return ctx


def http_get(url: str) -> tuple[int, bytes]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": "https://www.hktta.org.hk/registered_player/past_record/index.html",
            "Accept": "application/pdf,*/*",
        },
    )
    try:
        with urllib.request.urlopen(req, context=ssl_context(), timeout=60) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read() if exc.fp else b""


def find_latest_period() -> str:
    year = datetime.now(HKT).year
    for y in (year, year - 1):
        for n in range(12, 0, -1):
            period = f"{y}-{n:02d}"
            url = f"{BASE}/{period}/Men-All.pdf"
            code, body = http_get(url)
            if code == 200 and body.startswith(b"%PDF"):
                print(f"found {period} ({len(body)} bytes)")
                return period
            print(f"skip {period} ({code})")
    raise SystemExit("No ranking PDF period found")


def parse_int(value: object) -> int | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if not text or text == "-":
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def clean(value: object) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def parse_pdf(path: Path, gender: str, group: str) -> tuple[str, list[dict]]:
    import pdfplumber

    players: list[dict] = []
    printed = ""
    with pdfplumber.open(path) as pdf:
        first_text = pdf.pages[0].extract_text() or ""
        match = re.search(r"列印日期\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})", first_text)
        if match:
            printed = match.group(1)
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                continue
            for row in tables[0]:
                if not row or len(row) < 4:
                    continue
                rank = parse_int(row[0])
                if rank is None:
                    continue
                name = clean(row[3])
                if not name:
                    continue
                players.append(
                    {
                        "gender": gender,
                        "group": group,
                        "rank": rank,
                        "prev": parse_int(row[1]) if len(row) > 1 else None,
                        "name": name,
                        "coach": clean(row[4]) if len(row) > 4 else "",
                        "club": clean(row[5]) if len(row) > 5 else "",
                        "school": clean(row[6]) if len(row) > 6 else "",
                        "points": parse_int(row[7]) if len(row) > 7 else None,
                    }
                )
    return printed, players


def player_key(row: dict) -> tuple:
    return (
        row["gender"],
        row["name"],
        row.get("points"),
        row.get("club") or "",
        row.get("school") or "",
    )


def estimate_age(groups: list[str]) -> dict:
    present = set(groups)
    if not present:
        return {
            "youngestGroup": None,
            "label": "未能從年齡榜推斷",
            "note": "今期沒有出現在已下載的年齡組排名榜。",
        }
    for group in YOUNGEST_ORDER:
        if group in present:
            band = AGE_BAND[group]
            return {
                "youngestGroup": group,
                "label": band["label"],
                "note": "按乒總年齡榜推斷（以出生年份劃組，並非確實出生日期）。" + band["approx"],
            }
    return {
        "youngestGroup": None,
        "label": "22歲或以上",
        "note": "有男子/女子總榜，但未出現在 U21 或以下榜，多數為 22 歲或以上，或該期青少年榜未收錄。",
    }


def merge_players(rows_by_list: dict[str, list[dict]]) -> list[dict]:
    merged: dict[tuple, dict] = {}
    for _list_id, rows in rows_by_list.items():
        for row in rows:
            key = player_key(row)
            item = merged.get(key)
            if item is None:
                item = {
                    "name": row["name"],
                    "gender": row["gender"],
                    "points": row.get("points"),
                    "coach": row.get("coach") or "",
                    "club": row.get("club") or "",
                    "school": row.get("school") or "",
                    "rankings": {},
                }
                merged[key] = item
            else:
                if not item["coach"] and row.get("coach"):
                    item["coach"] = row["coach"]
                if not item["club"] and row.get("club"):
                    item["club"] = row["club"]
                if not item["school"] and row.get("school"):
                    item["school"] = row["school"]
            item["rankings"][row["group"]] = {
                "rank": row["rank"],
                "prev": row.get("prev"),
                "points": row.get("points"),
            }

    players = []
    for item in merged.values():
        groups = list(item["rankings"].keys())
        item["age"] = estimate_age(groups)
        if "ALL" in item["rankings"] and not any(g in item["rankings"] for g in YOUNGEST_ORDER):
            item["age"] = {
                "youngestGroup": None,
                "label": "22歲或以上／不在青少年榜",
                "note": "今期只見於所有球員榜，未見於 U21 或以下。乒總以出生年份劃組。",
            }
        players.append(item)
    players.sort(
        key=lambda p: (
            0 if p["gender"] == "M" else 1,
            p["rankings"].get("ALL", {}).get("rank") or 10**9,
            p["name"],
        )
    )
    return players


def load_existing() -> dict | None:
    if not OUT_PATH.exists():
        return None
    try:
        return json.loads(OUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def player_stable_key(player: dict) -> str:
    return "|".join(
        [
            str(player.get("gender") or ""),
            str(player.get("name") or ""),
            str(player.get("club") or ""),
            str(player.get("school") or ""),
        ]
    )


def prior_from_snapshot(old: dict) -> dict:
    all_map: dict[str, dict] = {}
    for player in old.get("players") or []:
        row = (player.get("rankings") or {}).get("ALL")
        if not row:
            continue
        points = row.get("points")
        if points is None:
            points = player.get("points")
        all_map[player_stable_key(player)] = {
            "rank": row.get("rank"),
            "points": points,
        }
    return {"period": old.get("period"), "all": all_map}


def previous_period(period: str) -> str:
    year, num = period.split("-")
    year_n = int(year)
    num_n = int(num)
    if num_n > 1:
        return f"{year_n}-{num_n - 1:02d}"
    return f"{year_n - 1}-12"


def prior_from_all_pdfs(tmp_dir: Path, period: str) -> dict | None:
    all_map: dict[str, dict] = {}
    for filename, gender in (("Men-All", "M"), ("Women-All", "F")):
        url = f"{BASE}/{period}/{filename}.pdf"
        code, body = http_get(url)
        if code != 200 or not body.startswith(b"%PDF"):
            print(f"prior missing {filename} ({code})")
            continue
        pdf_path = tmp_dir / f"prior-{filename}.pdf"
        pdf_path.write_bytes(body)
        _printed, rows = parse_pdf(pdf_path, gender, "ALL")
        print(f"prior parsed {filename}: {len(rows)} players")
        for row in rows:
            all_map[player_stable_key(row)] = {
                "rank": row.get("rank"),
                "points": row.get("points"),
            }
    if not all_map:
        return None
    return {"period": period, "all": all_map}


def resolve_prior(old: dict | None, period: str) -> dict | None:
    if not old:
        return None
    old_period = old.get("period")
    if old_period and old_period != period:
        return prior_from_snapshot(old)
    return old.get("prior")


def main() -> None:
    import pdfplumber  # noqa: F401  # fail fast if missing

    old = load_existing()
    period = find_latest_period()
    print(f"using period {period}")
    rows_by_list: dict[str, list[dict]] = {}
    totals: dict[str, int] = {}
    printed = ""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for filename, gender, group, _label in LISTS:
            url = f"{BASE}/{period}/{filename}.pdf"
            code, body = http_get(url)
            if code != 200 or not body.startswith(b"%PDF"):
                print(f"missing {filename} ({code})")
                continue
            pdf_path = tmp_dir / f"{filename}.pdf"
            pdf_path.write_bytes(body)
            page_printed, rows = parse_pdf(pdf_path, gender, group)
            printed = printed or page_printed
            rows_by_list[filename] = rows
            totals[f"{gender}-{group}"] = len(rows)
            print(f"parsed {filename}: {len(rows)} players")
        prior_pdf = prior_from_all_pdfs(tmp_dir, previous_period(period))

    players = merge_players(rows_by_list)
    prior = prior_pdf or resolve_prior(old, period)
    count = len(players)
    prev_count = None
    if old:
        prev_count = old.get("count")
        if prev_count is None:
            prev_count = len(old.get("players") or [])
    payload = {
        "source": "中國香港乒乓總會註冊球員電腦積分及排名榜（PDF）",
        "sourceUrl": "https://www.hktta.org.hk/registered_player/past_record/index.html",
        "period": period,
        "printed": printed,
        "updated": datetime.now(HKT).strftime("%Y-%m-%d %H:%M"),
        "count": count,
        "prevCount": prev_count,
        "totals": totals,
        "players": players,
    }
    if old and old.get("uniqueCount") is not None:
        payload["uniqueCount"] = old["uniqueCount"]
    if old and old.get("uniquePrev") is not None:
        payload["uniquePrev"] = old["uniquePrev"]
    if prior:
        payload["prior"] = prior
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes, {len(players)} unique players)")


if __name__ == "__main__":
    main()
