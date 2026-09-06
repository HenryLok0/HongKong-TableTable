"""Collect every still-published HKTTA ranking PDF into a compact history file.

Does not call HKTTA CGI ranking pages. Year index HTML and PDFs only.
Latest period stays in rankings.json; this file is past + current ALL ranks.
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from archive_http import get_pdf, http_get  # noqa: E402

OUT_PATH = ROOT / "data" / "hktta_history.json"
RANKINGS_PATH = ROOT / "data" / "rankings.json"
INDEX = "https://www.hktta.org.hk/registered_player/past_record/index.html"
YEAR_INDEX = "https://www.hktta.org.hk/registered_player/past_record/{year}index.html"
HKT = timezone(timedelta(hours=8))
NAME_RE = re.compile(r"^[\u4e00-\u9fff]{2,4}$")
CJK_RE = re.compile(r"^[\u4e00-\u9fff]{2,4}$")
PAIR_RE = re.compile(
    r"(\d{1,4})\s+([\u4e00-\u9fff]{2,4})\s+(\d{1,5})\s+(\d{1,4}|[-–])\s+(\d{1,5}|[-–])"
)
MODERN_LINE_RE = re.compile(
    r"^(\d{1,4})\s+(?:\d{1,4}|[-–])\s+([\u4e00-\u9fff]{2,4})\b"
)
PERIOD_RE = re.compile(r"(20\d{2}|200[4-9])[-_](\d{2})")
HREF_RE = re.compile(r"""(?:href\s*=\s*|url\s*\(\s*)['"]?([^'"\s>)]+\.pdf)""", re.I)
SAVE_EVERY = 8

GROUP_PATTERNS = [
    (re.compile(r"u-?9|under\s*9|9歲", re.I), "U9"),
    (re.compile(r"u-?11|under\s*11|11歲", re.I), "U11"),
    (re.compile(r"u-?12|under\s*12|12歲", re.I), "U12"),
    (re.compile(r"u-?13|under\s*13|13歲", re.I), "U13"),
    (re.compile(r"u-?15|under\s*15|15歲", re.I), "U15"),
    (re.compile(r"u-?17|under\s*17|17歲", re.I), "U17"),
    (re.compile(r"u-?18|under\s*18|18歲", re.I), "U18"),
    (re.compile(r"u-?19|under\s*19|19歲", re.I), "U19"),
    (re.compile(r"u-?21|under\s*21|uml|uwl|21歲", re.I), "U21"),
    (re.compile(r"junior|jml|jwl", re.I), "JR"),
]


def now_stamp() -> str:
    return datetime.now(HKT).strftime("%Y-%m-%d %H:%M")


def empty_store() -> dict:
    return {"source": "HKTTA ranking PDFs", "sourceUrl": INDEX, "updated": "", "seen": [], "players": {}}


def load_store() -> dict:
    if not OUT_PATH.exists():
        return empty_store()
    try:
        data = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return empty_store()
    data.setdefault("seen", [])
    data.setdefault("players", {})
    return data


def save_store(store: dict) -> None:
    store["updated"] = now_stamp()
    store["periods"] = sorted({row[0] for recs in store["players"].values() for row in recs})
    store["names"] = len(store["players"])
    OUT_PATH.write_text(json.dumps(store, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"saved {OUT_PATH.name} ({OUT_PATH.stat().st_size} bytes, {store['names']} names, {len(store['seen'])} pdfs)")


def classify(url: str) -> dict | None:
    path = unquote(urlparse(url).path)
    blob = path.replace("_", " ").replace("-", " ")
    lower = blob.lower()
    if "double" in lower:
        return None
    period = ""
    match = PERIOD_RE.search(path.replace("-", "-"))
    if not match:
        match = PERIOD_RE.search(path.replace("_", "-"))
    if match:
        period = f"{match.group(1)}-{match.group(2)}"
    gender = ""
    if re.search(r"women|female|\bjwl\b|\buwl\b|_wl_|wl \d", lower):
        gender = "F"
    elif re.search(r"men|male|\bjml\b|\buml\b|_ml_|ml \d", lower):
        gender = "M"
    group = "ALL"
    for cre, label in GROUP_PATTERNS:
        if cre.search(lower) or cre.search(path):
            group = label
            break
    return {"url": url, "period": period, "gender": gender, "group": group}


def parse_int(value: object) -> int | None:
    text = re.sub(r"[^\d]", "", str(value or ""))
    return int(text) if text else None


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def gender_from_text(text: str, fallback: str) -> str:
    head = text[:1200]
    if re.search(r"性別\s*F\b", head) or re.search(r"\bGender\s*F\b", head, re.I):
        return "F"
    if re.search(r"性別\s*M\b", head) or re.search(r"\bGender\s*M\b", head, re.I):
        return "M"
    if "女子" in head[:400] and "男子" not in head[:400]:
        return "F"
    if "男子" in head[:400] and "女子" not in head[:400]:
        return "M"
    return fallback


def parse_tables(pdf, gender: str, group: str) -> list[dict]:
    rows: list[dict] = []
    for page in pdf.pages:
        tables = page.extract_tables() or []
        for table in tables:
            for raw in table or []:
                if not raw or len(raw) < 3:
                    continue
                rank = parse_int(raw[0])
                if rank is None:
                    continue
                name = ""
                for cell in raw[1:]:
                    text = clean(cell)
                    if NAME_RE.fullmatch(text):
                        name = text
                        break
                if not name:
                    continue
                points = None
                for cell in reversed(raw):
                    points = parse_int(cell)
                    if points is not None:
                        break
                rows.append({"name": name, "gender": gender, "group": group, "rank": rank, "points": points})
    return rows


def parse_lines(text: str, gender: str, group: str) -> list[dict]:
    rows: list[dict] = []
    seen_pair = 0
    for raw in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw).strip()
        pairs = list(PAIR_RE.finditer(line))
        if len(pairs) >= 1 and (len(pairs) >= 2 or not MODERN_LINE_RE.match(line)):
            for match in pairs:
                rows.append(
                    {
                        "name": match.group(2),
                        "gender": gender,
                        "group": group,
                        "rank": int(match.group(1)),
                        "points": int(match.group(3)),
                    }
                )
                seen_pair += 1
            continue
        match = MODERN_LINE_RE.match(line)
        if not match:
            continue
        rank = int(match.group(1))
        name = match.group(2)
        nums = [int(n) for n in re.findall(r"\d{2,5}", line[match.end() :])]
        points = nums[-1] if nums else None
        rows.append({"name": name, "gender": gender, "group": group, "rank": rank, "points": points})
    return rows


def parse_pdf(path: Path, meta: dict) -> tuple[str, list[dict]]:
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        text = "\n".join((page.extract_text() or "") for page in pdf.pages[:2])
        gender = gender_from_text(text, meta.get("gender") or "")
        group = meta.get("group") or "ALL"
        rows = parse_tables(pdf, gender, group)
        full = text + "\n" + "\n".join((page.extract_text() or "") for page in pdf.pages[2:])
        extra = parse_lines(full, gender or "M", group)
        if len(extra) > len(rows):
            rows = extra
        period = meta.get("period") or ""
        if not period:
            listed = re.search(r"List\s*No\.?\s*(20\d{2}[-_]\d{2})", text, re.I)
            if listed:
                period = listed.group(1).replace("_", "-")
        if not period:
            match = PERIOD_RE.search(text[:1500])
            if match:
                period = f"{match.group(1)}-{match.group(2)}"
        if not period:
            printed = re.search(r"(20\d{2})", text[:800])
            if printed:
                period = f"{printed.group(1)}-01"
        for row in rows:
            row["period"] = period
            if not row.get("gender"):
                row["gender"] = gender or "M"
    return period, rows


def add_row(store: dict, row: dict) -> None:
    name = re.sub(r"\s+", "", row.get("name") or "")
    period = row.get("period") or ""
    if not name or not period or not CJK_RE.fullmatch(name):
        return
    gender = row.get("gender") or "M"
    group = row.get("group") or "ALL"
    recs = store["players"].setdefault(name, [])
    key = (period, gender, group)
    for i, existing in enumerate(recs):
        if (existing[0], existing[1], existing[2]) == key:
            recs[i] = [period, gender, group, row.get("rank"), row.get("points")]
            return
    recs.append([period, gender, group, row.get("rank"), row.get("points")])


def ingest_current_rankings(store: dict) -> int:
    if not RANKINGS_PATH.exists():
        return 0
    data = json.loads(RANKINGS_PATH.read_text(encoding="utf-8"))
    period = data.get("period") or ""
    added = 0
    for player in data.get("players") or []:
        gender = player.get("gender") or "M"
        for group, rec in (player.get("rankings") or {}).items():
            add_row(
                store,
                {
                    "name": player.get("name"),
                    "period": period,
                    "gender": gender,
                    "group": group,
                    "rank": rec.get("rank"),
                    "points": rec.get("points") if rec.get("points") is not None else player.get("points"),
                },
            )
            added += 1
    return added


def discover_modern(known_periods: set[str] | None = None) -> list[str]:
    from fetch_rankings import BASE, LISTS

    known = known_periods or set()
    found: list[str] = []
    year = datetime.now(HKT).year
    print("probing 2021+ Men-All.pdf periods", flush=True)
    for y in range(2021, year + 1):
        for n in range(1, 13):
            period = f"{y}-{n:02d}"
            if period in known and y < year:
                continue
            probe = f"{BASE}/{period}/Men-All.pdf"
            code, body = http_get(probe, referer=INDEX, timeout=20)
            if code != 200 or not body.startswith(b"%PDF"):
                continue
            print(f"modern period {period}", flush=True)
            for filename, _gender, _group, _label in LISTS:
                found.append(f"{BASE}/{period}/{filename}.pdf")
    return found


def discover_pdfs(known_periods: set[str] | None = None) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    pages = [INDEX]
    year = datetime.now(HKT).year
    for y in range(2005, year + 1):
        pages.append(YEAR_INDEX.format(year=y))
    print("reading year index pages", flush=True)
    for page in pages:
        code, body = http_get(page, referer=INDEX, timeout=20)
        if code != 200 or not body:
            print(f"index skip {page} ({code})", flush=True)
            continue
        html = body.decode("utf-8", errors="replace")
        for href in HREF_RE.findall(html):
            url = urljoin(page, href.replace("&amp;", "&").strip())
            if ".pdf" not in url.lower() or url in seen:
                continue
            if re.search(r"RankingReform|reform", url, re.I):
                continue
            seen.add(url)
            found.append(url)
    for url in discover_modern(known_periods):
        if url not in seen:
            seen.add(url)
            found.append(url)
    print(f"discovered {len(found)} ranking pdf links", flush=True)
    return found


def main() -> None:
    import pdfplumber  # noqa: F401

    store = load_store()
    periods = {row[0] for recs in store["players"].values() for row in recs}
    current = ""
    if RANKINGS_PATH.exists():
        current = json.loads(RANKINGS_PATH.read_text(encoding="utf-8")).get("period") or ""
    if not (periods - {current}):
        store["seen"] = []
        print("reset seen; previous harvest stored no past rows")
    seen = set(store.get("seen") or [])
    ingested = ingest_current_rankings(store)
    print(f"merged current rankings.json rows: {ingested}")

    docs = []
    for url in discover_pdfs(known_periods=set(store.get("periods") or periods)):
        meta = classify(url)
        if not meta:
            continue
        docs.append(meta)
    print(f"singles pdfs: {len(docs)} already-seen: {sum(1 for d in docs if d['url'] in seen)}")

    pending = [d for d in docs if d["url"] not in seen]
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for i, meta in enumerate(pending, 1):
            url = meta["url"]
            print(f"[{i}/{len(pending)}] {meta['period']} {meta['gender']}/{meta['group']} {url}")
            body = get_pdf(url, referer=INDEX)
            if not body:
                print("  skip (no pdf)")
                continue
            path = tmp_dir / f"{i}.pdf"
            path.write_bytes(body)
            try:
                period, rows = parse_pdf(path, meta)
            except Exception as exc:  # noqa: BLE001
                print(f"  parse error: {exc}")
                continue
            if not period:
                print("  skip (no period)")
                seen.add(url)
                continue
            for row in rows:
                if not row.get("period"):
                    row["period"] = period
                add_row(store, row)
            seen.add(url)
            store["seen"] = sorted(seen)
            print(f"  rows {len(rows)} period {period}")
            if i % SAVE_EVERY == 0:
                save_store(store)

    store["seen"] = sorted(seen)
    save_store(store)


if __name__ == "__main__":
    main()
