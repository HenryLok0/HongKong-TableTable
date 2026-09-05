"""Download Hang Seng (HSTTA) public badge-exam timetables and results."""

from __future__ import annotations

import json
import re
import ssl
import tempfile
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data" / "badges.json"
LISTING = "https://hstta.hktta.org.hk/training_detail.php?id=10"
HKT = timezone(timedelta(hours=8))
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)
SESSION_RE = re.compile(
    r"/BadgeScheme/(\d{4})/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/",
    re.I,
)
CODE_RE = re.compile(r"\b([BSGPD][A-Z]{0,3}\d+)\b")
NAME_RE = re.compile(r"^([BSGPD][A-Z]{0,3}\d+)\s+([\u4e00-\u9fff]{2,4})\b")
BADGE_LABEL_RE = re.compile(r"(鑽章(?:（[一二]）)?|白金章|金章|銀章|銅章)")
PASS_RE = re.compile(r"考獲([^，\s]+章(?:（[一二]）)?)資格")
MONTH = {
    "Jan": "01",
    "Feb": "02",
    "Mar": "03",
    "Apr": "04",
    "May": "05",
    "Jun": "06",
    "Jul": "07",
    "Aug": "08",
    "Sep": "09",
    "Oct": "10",
    "Nov": "11",
    "Dec": "12",
}
FILE_BADGE = {
    "_B": "銅章",
    "_S": "銀章",
    "_G": "金章",
    "_P": "白金章",
    "_D": "鑽章",
}


def ssl_context() -> ssl.SSLContext:
    return ssl.create_default_context()


def http_get(url: str) -> tuple[int, bytes]:
    url = url.replace(" ", "%20")
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
    )
    try:
        with urllib.request.urlopen(req, context=ssl_context(), timeout=60) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read() if exc.fp else b""


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", "", name)


def abs_url(href: str) -> str:
    href = href.replace("&amp;", "&").strip()
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http://"):
        href = "https://" + href[len("http://") :]
    return urljoin(LISTING, href)


def session_from_url(url: str) -> str:
    match = SESSION_RE.search(url)
    if not match:
        return ""
    return f"{match.group(1)}-{MONTH[match.group(2).title()]}"


def short_month(session: str) -> str:
    year, month = session.split("-")
    names = {v: k for k, v in MONTH.items()}
    return f"{names[month]}-{year[2:]}"


def listing_urls() -> list[str]:
    code, body = http_get(LISTING)
    if code != 200:
        print(f"listing failed ({code})")
        return []
    html = body.decode("utf-8", errors="replace")
    found: list[str] = []
    seen: set[str] = set()
    for href in HREF_RE.findall(html):
        url = abs_url(href)
        if ".pdf" not in url.lower():
            continue
        if url in seen:
            continue
        seen.add(url)
        found.append(url)
    return found


def related_docs(urls: list[str]) -> list[dict]:
    docs: list[dict] = []
    seen: set[str] = set()
    folders: set[tuple[str, str]] = set()
    for url in urls:
        session = session_from_url(url)
        if not session:
            continue
        path = unquote(urlparse(url).path)
        kind = ""
        if "timetable" in path.lower() or "考生名單" in path:
            kind = "timetable"
        elif "result" in path.lower():
            kind = "result"
        else:
            continue
        if url not in seen:
            seen.add(url)
            docs.append({"url": url, "session": session, "kind": kind})
        match = SESSION_RE.search(url)
        if match:
            folders.add((match.group(1), match.group(2).title()))

    for year, mon in folders:
        session = f"{year}-{MONTH[mon]}"
        stamp = short_month(session)
        base = f"https://hstta.hktta.org.hk/html/BadgeScheme/{year}/{mon}/"
        extras = [f"{base}Timetable for web ({stamp}).pdf"]
        for letter in "BSGPD":
            extras.append(f"{base}Result (for web)_{letter} ({stamp}).pdf")
        for extra in extras:
            if extra in seen:
                continue
            seen.add(extra)
            kind = "timetable" if "Timetable" in extra else "result"
            docs.append({"url": extra, "session": session, "kind": kind})
    return docs


def pdf_text(path: Path) -> str:
    import pdfplumber

    chunks = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
    return "\n".join(chunks)


def badge_from_filename(url: str) -> str:
    path = unquote(urlparse(url).path)
    for key, label in FILE_BADGE.items():
        if key in path and "Result" in path:
            return label
    return ""


def parse_timetable(text: str, meta: dict) -> list[dict]:
    rows = []
    for raw in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw).strip()
        match = NAME_RE.match(line)
        if not match:
            continue
        code, name = match.group(1).upper(), match.group(2)
        label_match = BADGE_LABEL_RE.search(line)
        rows.append(
            {
                "name": name,
                "norm": normalize_name(name),
                "code": code,
                "badge": label_match.group(1) if label_match else "",
                "session": meta["session"],
                "url": meta["url"],
            }
        )
    return rows


def parse_results(text: str, meta: dict) -> dict[str, dict]:
    file_badge = badge_from_filename(meta["url"])
    out: dict[str, dict] = {}
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        found = list(CODE_RE.finditer(line))
        if not found:
            continue
        if "考獲" not in line and "未達合格" not in line and "缺席" not in line:
            continue
        code = found[0].group(1).upper()
        passed = "考獲" in line
        pass_match = PASS_RE.search(line)
        badge = (pass_match.group(1) if pass_match else file_badge) or file_badge
        out[code] = {
            "code": code,
            "passed": passed,
            "absent": "缺席" in line and "考獲" not in line,
            "badge": badge,
            "session": meta["session"],
            "url": meta["url"],
            "detail": line[:180],
        }
    return out


def merge_players(sittings: list[dict], results: dict[tuple[str, str], dict]) -> dict[str, list[dict]]:
    players: dict[str, list[dict]] = defaultdict(list)
    for row in sittings:
        key = (row["session"], row["code"])
        result = results.get(key)
        badge = (result or {}).get("badge") or row["badge"]
        item = {
            "name": row["name"],
            "code": row["code"],
            "badge": badge,
            "session": row["session"],
            "passed": result["passed"] if result else None,
            "absent": result["absent"] if result else False,
            "url": (result or row)["url"],
            "listUrl": row["url"],
        }
        existing = {(r.get("session"), r.get("code")) for r in players[row["norm"]]}
        if key not in existing:
            players[row["norm"]].append(item)
    return players


def main() -> None:
    import pdfplumber  # noqa: F401

    listed = listing_urls()
    print(f"listing pdfs: {len(listed)}")
    docs = related_docs(listed)
    print(f"candidate docs: {len(docs)}")

    sittings: list[dict] = []
    results: dict[tuple[str, str], dict] = {}
    parsed = 0
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for i, meta in enumerate(docs, 1):
            url = meta["url"]
            print(f"[{i}/{len(docs)}] {meta['kind']} {meta['session']} {url}")
            code, body = http_get(url)
            if code != 200 or not body.startswith(b"%PDF"):
                print(f"  skip ({code})")
                continue
            path = tmp_dir / f"{i}.pdf"
            path.write_bytes(body)
            try:
                text = pdf_text(path)
            except Exception as exc:  # noqa: BLE001
                print(f"  parse error: {exc}")
                continue
            parsed += 1
            if meta["kind"] == "timetable":
                rows = parse_timetable(text, meta)
                sittings.extend(rows)
                print(f"  names {len(rows)}")
            else:
                mapped = parse_results(text, meta)
                for cand, row in mapped.items():
                    results[(row["session"], cand)] = row
                print(f"  results {len(mapped)}")

    players = merge_players(sittings, results)
    if OUT_PATH.exists():
        old = json.loads(OUT_PATH.read_text(encoding="utf-8"))
        kept = 0
        for name, recs in (old.get("players") or {}).items():
            existing = {(r.get("session"), r.get("code")) for r in players.get(name, [])}
            for rec in recs:
                key = (rec.get("session"), rec.get("code"))
                if key not in existing:
                    players[name].append(rec)
                    existing.add(key)
                    kept += 1
        print(f"kept {kept} historical badge rows")

    payload = {
        "source": "恒生乒乓球學院公開章別考試（考生時間表／成績 PDF）",
        "sourceUrl": LISTING,
        "updated": datetime.now(HKT).strftime("%Y-%m-%d %H:%M"),
        "documents": parsed,
        "players": players,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes, {len(players)} names)")


if __name__ == "__main__":
    main()
