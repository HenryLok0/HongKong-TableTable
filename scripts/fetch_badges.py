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
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from archive_http import cdx_prefix, get_pdf  # noqa: E402
import archive_state  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data" / "badges.json"
MISS_PATH = ROOT / "data" / "badge_miss_urls.json"
EXTRA_PATH = ROOT / "data" / "badge_extra_urls.json"
LISTING = "https://hstta.hktta.org.hk/training_detail.php?id=10"
NEWS = "https://hstta.hktta.org.hk/news.php"
HKT = timezone(timedelta(hours=8))
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)
MONTH_NAME = (
    "January|February|March|April|June|July|August|September|October|November|December|"
    "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec"
)
SESSION_RE = re.compile(
    rf"/BadgeScheme/(\d{{4}})/({MONTH_NAME})(?:Result)?/",
    re.I,
)
SESSION_FILE_RE = re.compile(
    rf"/BadgeScheme/(20\d{{2}})/(?:20\d{{2}})?({MONTH_NAME})",
    re.I,
)
SESSION_STAMP_RE = re.compile(rf"({MONTH_NAME})[-_]?(\d{{2,4}})", re.I)
SKIP_RE = re.compile(
    r"form|prospectus|handbook|notice|scope|guideline|covid|entryform|"
    r"schoolapp|school.?form|校內報名|prevention|arrangement|exammarks|nonreg|\bbook\b",
    re.I,
)
CODE_RE = re.compile(r"(?:^|[\s（(])(?:\d)?([BSGPD][A-Z]{0,3})\s*(\d+)\b")
NAME_RESULT_RE = re.compile(
    r"^([\u4e00-\u9fff]{2,4})\b.{0,80}?(考獲|未達合格|缺席)"
)
NAME_STOP = {
    "注意事項",
    "考生須知",
    "考試日期",
    "考生編號",
    "領取證書",
    "公開章別",
    "中文姓名",
    "英文姓名",
    "合格水平",
    "未達合格",
    "銅章資格",
    "銀章資格",
    "金章資格",
    "白金章",
    "鑽章資格",
}
NAME_COMPACT_RE = re.compile(r"^([BSGPD][A-Z]{0,3}\d+)\s+([\u4e00-\u9fff]{2,4})\b")
NAME_SPACED_RE = re.compile(
    r"^(?:\d)?([BSGPD][A-Z]{0,3})\s+(\d+)\s+([\u4e00-\u9fff]{2,4})\b"
)
BADGE_LABEL_RE = re.compile(r"(鑽章(?:（[一二]）)?|白金章|金章|銀章|銅章)")
PASS_RE = re.compile(r"考獲([^，\s]+章(?:（[一二]）)?)資格")
CARRY_RE = re.compile(r"於(\d{4})年(\d{1,2})月(\d{1,2})日考獲合格成績")
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
LEVEL_FROM_LETTER = {
    "B": "銅章",
    "S": "銀章",
    "G": "金章",
    "P": "白金章",
    "D": "鑽章",
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
        return canon_url("https:" + href)
    if href.startswith("http://"):
        href = "https://" + href[len("http://") :]
    return canon_url(urljoin(LISTING, href))


def canon_url(url: str) -> str:
    url = unquote(url.replace("http://", "https://").replace(":80/", "/"))
    return url.split("#")[0]


def month_code(name: str) -> str:
    title = name.title()
    if title in MONTH:
        return MONTH[title]
    short = title[:3]
    if short in MONTH:
        return MONTH[short]
    raise KeyError(name)


def session_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    match = SESSION_RE.search(path) or SESSION_FILE_RE.search(path)
    if match:
        return f"{match.group(1)}-{month_code(match.group(2))}"
    stamp = SESSION_STAMP_RE.search(path)
    if stamp:
        year_part = stamp.group(2)
        year = f"20{year_part}" if len(year_part) == 2 else year_part
        if year.isdigit() and 2000 <= int(year) <= 2099:
            return f"{year}-{month_code(stamp.group(1))}"
    year_folder = re.search(r"/BadgeScheme/(20\d{2})/", path)
    if year_folder:
        fname = path.rsplit("/", 1)[-1]
        loose = re.search(rf"({MONTH_NAME})", fname, re.I)
        if loose:
            try:
                return f"{year_folder.group(1)}-{month_code(loose.group(1))}"
            except KeyError:
                pass
        return f"{year_folder.group(1)}-00"
    return ""


def kind_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    if SKIP_RE.search(path):
        return ""
    low = path.lower()
    if "result" in low or "prizelist" in low or re.search(r"/[bsgpd]\.pdf$", low):
        return "result"
    if (
        "timetable" in low
        or "namelist" in low
        or "time_table" in low
        or "infoexam" in low
        or "考生" in path
    ):
        return "timetable"
    return ""


def short_month(session: str) -> str:
    year, month = session.split("-")
    names = {v: k for k, v in MONTH.items()}
    return f"{names[month]}-{year[2:]}"


def result_guess_urls(session: str) -> list[str]:
    year, month = session.split("-")
    names = {v: k for k, v in MONTH.items()}
    mon = names.get(month, "")
    stamp = f"{mon}-{year[2:]}" if mon else year[2:]
    root = f"https://hstta.hktta.org.hk/html/BadgeScheme/{year}/"
    base = f"{root}{mon}/" if mon else root
    urls: list[str] = []
    for letter in "BSGPD":
        urls.extend(
            [
                f"{base}Result (for web)_{letter} ({stamp}).pdf",
                f"{base}Result (for web)_{letter}.pdf",
                f"{base}Result_{letter}.pdf",
                f"{base}Result/{letter}.pdf",
                f"{root}Result_{letter}.pdf",
                f"{root}Result/{letter}.pdf",
                f"https://www.hktta.org.hk/hstta/pdf/BadgeScheme/{year}/Result/{letter}.pdf",
            ]
        )
        if mon:
            urls.extend(
                [
                    f"{base}{mon}{year}_BS_Result_{letter}.pdf",
                    f"https://www.hktta.org.hk/hstta/pdf/BadgeScheme/{year}/{mon}/Result_{letter}.pdf",
                ]
            )
    return urls


def listing_urls() -> list[str]:
    code, body = http_get(LISTING)
    if code != 200:
        print(f"listing failed ({code})")
        return []
    html = body.decode("utf-8", errors="replace")
    found: list[str] = []
    seen: set[str] = set()
    for href in HREF_RE.findall(html):
        url = canon_url(href)
        if ".pdf" not in url.lower():
            continue
        if url in seen:
            continue
        seen.add(url)
        found.append(url)
    return found


def extra_urls() -> list[str]:
    if not EXTRA_PATH.exists():
        return []
    try:
        data = json.loads(EXTRA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    found: list[str] = []
    seen: set[str] = set()
    for item in data:
        url = canon_url(item) if isinstance(item, str) else canon_url((item or {}).get("url") or "")
        if not url or url in seen:
            continue
        seen.add(url)
        found.append(url)
    print(f"extra badge pdfs: {len(found)}")
    return found


def news_pdfs() -> list[str]:
    code, body = http_get(NEWS)
    if code != 200:
        print(f"news listing failed ({code})")
        return []
    html = body.decode("utf-8", errors="replace")
    ids = []
    seen_ids: set[str] = set()
    for match in re.finditer(r"news_detail\.php\?id=(\d+)", html):
        nid = match.group(1)
        if nid in seen_ids:
            continue
        window = html[max(0, match.start() - 400) : match.end() + 200]
        if "章別" not in window and "Badge" not in window:
            continue
        seen_ids.add(nid)
        ids.append(nid)
    found: list[str] = []
    seen: set[str] = set()
    for nid in ids:
        url = f"https://hstta.hktta.org.hk/news_detail.php?id={nid}"
        got, page = http_get(url)
        if got != 200 or not page:
            continue
        text = page.decode("utf-8", errors="replace")
        for href in HREF_RE.findall(text):
            pdf = canon_url(href) if href.startswith("http") else abs_url(href)
            if ".pdf" not in pdf.lower() or "BadgeScheme" not in pdf:
                continue
            if pdf in seen:
                continue
            seen.add(pdf)
            found.append(pdf)
    print(f"news badge pdfs: {len(found)}")
    return found


def guessed_session_docs(use_cdx: bool) -> list[dict]:
    year_now = datetime.now(HKT).year
    docs: list[dict] = []
    seen: set[str] = set()
    months = list(MONTH.keys())
    # Only probe current and previous year with the modern filename; older years come from Wayback.
    for year in range(year_now - 1, year_now + 1):
        for mon in months:
            session = f"{year}-{MONTH[mon]}"
            stamp = short_month(session)
            base = f"https://hstta.hktta.org.hk/html/BadgeScheme/{year}/{mon}/"
            extras = [f"{base}Timetable for web ({stamp}).pdf"]
            extras.extend(result_guess_urls(session))
            for extra in extras:
                if extra in seen:
                    continue
                seen.add(extra)
                kind = "timetable" if "Timetable" in extra else "result"
                docs.append({"url": extra, "session": session, "kind": kind, "wayback": False})
    if not use_cdx:
        return docs
    prefixes = [
        "hstta.hktta.org.hk/html/BadgeScheme/",
        "www.hktta.org.hk/hstta/pdf/BadgeScheme/",
    ]
    for prefix in prefixes:
        for _ts, original in cdx_prefix(prefix, limit=20000):
            if ".pdf" not in original.lower():
                continue
            url = canon_url(original)
            session = session_from_url(url)
            path = unquote(urlparse(url).path)
            if SKIP_RE.search(path):
                continue
            kind = kind_from_url(url) or "unknown"
            if not session:
                continue
            if url in seen:
                continue
            seen.add(url)
            docs.append({"url": url, "session": session, "kind": kind, "wayback": True})
    return docs


def related_docs(urls: list[str], use_cdx: bool) -> list[dict]:
    docs: list[dict] = []
    seen: set[str] = set()
    folders: set[tuple[str, str]] = set()
    for url in urls:
        url = canon_url(url)
        session = session_from_url(url)
        path = unquote(urlparse(url).path)
        if SKIP_RE.search(path):
            continue
        kind = kind_from_url(url) or "unknown"
        if not session:
            continue
        if url not in seen:
            seen.add(url)
            docs.append({"url": url, "session": session, "kind": kind, "wayback": True})
        match = SESSION_RE.search(url)
        if match:
            folders.add((match.group(1), match.group(2).title()))

    for year, mon in folders:
        session = f"{year}-{month_code(mon)}"
        stamp = short_month(session)
        base = f"https://hstta.hktta.org.hk/html/BadgeScheme/{year}/{mon}/"
        extras = [f"{base}Timetable for web ({stamp}).pdf"]
        extras.extend(result_guess_urls(session))
        for extra in extras:
            if extra in seen:
                continue
            seen.add(extra)
            kind = "timetable" if "Timetable" in extra else "result"
            docs.append({"url": extra, "session": session, "kind": kind, "wayback": False})
    for item in guessed_session_docs(use_cdx):
        if item["url"] in seen:
            continue
        seen.add(item["url"])
        docs.append(item)
    return docs


def pdf_text(path: Path) -> str:
    import pdfplumber

    chunks = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
    return "\n".join(chunks)


def code_letters(code: str) -> str:
    return re.sub(r"[^A-Z]", "", str(code or "").upper())


def badge_from_code(code: str) -> str:
    first = code_letters(code)[:1]
    return LEVEL_FROM_LETTER.get(first, "")


def badge_level_name(badge: str) -> str:
    text = str(badge or "")
    if "鑽章（二）" in text or "鑽章(二)" in text:
        return "鑽章（二）"
    if "鑽" in text:
        return "鑽章"
    if "白金" in text:
        return "白金章"
    if "金" in text or "金" in text:
        return "金章"
    if "銀" in text:
        return "銀章"
    if "銅" in text:
        return "銅章"
    return ""


def canonical_badge(code: str, badge: str = "") -> str:
    text = str(badge or "")
    if "鑽章（二）" in text or "鑽章(二)" in text:
        return "削球鑽章（二）" if "削球" in text else "鑽章（二）"
    level = badge_from_code(code)
    if not level:
        return text
    if "削球" in text and "削球" not in level:
        return f"削球{level}"
    return level


def badge_from_filename(url: str) -> str:
    path = unquote(urlparse(url).path)
    low = path.lower()
    # Read the letter after Result_, not the BS (badge scheme) prefix.
    # Apr2023_BS_Result_P.pdf must be 白金章, not 銅章 from "_B" inside "_BS_".
    match = re.search(r"result[^/]*[_/\-]([bsgpd])(?:[_\s\(\-\.]|\.pdf|$)", low)
    if match:
        return FILE_BADGE[f"_{match.group(1).upper()}"]
    match = re.search(r"(?:result.*/|result[_-]web[_-])([bsgpd])(?:[_-]|\.pdf)", low)
    if match:
        return FILE_BADGE[f"_{match.group(1).upper()}"]
    match = re.search(r"/([bsgpd])\.pdf$", low)
    if match and "result" in low:
        return FILE_BADGE[f"_{match.group(1).upper()}"]
    # Older names like "June G result.pdf" — require a space so "_BS_result" is not silver.
    match = re.search(r"[\s_-]([bsgpd])\s+result", low)
    if match:
        return FILE_BADGE[f"_{match.group(1).upper()}"]
    for word, label in (
        ("bronze", "銅章"),
        ("silver", "銀章"),
        ("gold", "金章"),
        ("platinum", "白金章"),
        ("diamond", "鑽章"),
    ):
        if word in low:
            return label
    return ""


def result_fits_code(code: str, result: dict | None) -> bool:
    if not result:
        return False
    sitting = badge_from_code(code)
    if not sitting:
        return True
    file_level = badge_from_filename(result.get("url") or "")
    if file_level:
        return file_level == sitting
    result_level = badge_level_name(result.get("badge") or "")
    if not result_level or result_level == "鑽章（二）":
        return True
    return result_level == sitting


def parse_timetable(text: str, meta: dict) -> list[dict]:
    rows = []
    for raw in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw).strip()
        compact = NAME_COMPACT_RE.match(line)
        spaced = None if compact else NAME_SPACED_RE.match(line)
        if compact:
            code, name = compact.group(1).upper(), compact.group(2)
        elif spaced:
            code, name = f"{spaced.group(1).upper()}{spaced.group(2)}", spaced.group(3)
        else:
            continue
        label_match = BADGE_LABEL_RE.search(line)
        rows.append(
            {
                "name": name,
                "norm": normalize_name(name),
                "code": code,
                "badge": canonical_badge(code, label_match.group(1) if label_match else ""),
                "session": meta["session"],
                "url": meta["url"],
            }
        )
    return rows


def apply_result_fields(rec: dict, result: dict) -> None:
    rec["passed"] = result["passed"]
    rec["absent"] = result["absent"]
    rec["waitResult"] = False
    rec["url"] = result["url"]
    rec["badge"] = canonical_badge(
        rec.get("code") or result.get("code") or "",
        result.get("badge") or rec.get("badge") or "",
    )
    for field in ("tech", "written", "carry"):
        if field in result:
            rec[field] = result[field]


def parse_result_segment(segment: str, file_badge: str, session: str, url: str) -> dict | None:
    match = CODE_RE.search(segment)
    if not match:
        return None
    code = (match.group(1) + match.group(2)).upper()
    body = segment[match.end() :]
    if "考獲" not in body and "未達合格水平" not in body and "缺席" not in body:
        return None
    award = PASS_RE.search(body)
    badge = canonical_badge(code, (award.group(1) if award else file_badge) or file_badge)
    carry = None
    carry_match = CARRY_RE.search(body)
    if carry_match:
        carry = f"{carry_match.group(1)}-{int(carry_match.group(2)):02d}"
        body = CARRY_RE.sub(" ", body)
    body_scores = PASS_RE.sub(" ", body)
    tokens = re.findall(r"未達合格水平|缺席|合格", body_scores)
    tech = written = None
    if carry:
        tech = True
        if tokens:
            written = tokens[0] == "合格"
    elif len(tokens) >= 2:
        tech = tokens[0] == "合格"
        written = tokens[1] == "合格"
    elif len(tokens) == 1:
        tech = tokens[0] == "合格"
    awarded = bool(award)
    absent = (not awarded) and bool(tokens) and all(tok == "缺席" for tok in tokens)
    if not awarded and not tokens and "缺席" in segment:
        absent = True
    row = {
        "code": code,
        "passed": awarded,
        "absent": absent,
        "badge": badge,
        "session": session,
        "url": url,
    }
    if tech is not None:
        row["tech"] = tech
    if written is not None:
        row["written"] = written
    if carry:
        row["carry"] = carry
    return row


def parse_results(text: str, meta: dict) -> dict[str, dict]:
    file_badge = badge_from_filename(meta["url"])
    out: dict[str, dict] = {}
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        found = list(CODE_RE.finditer(line))
        if not found:
            continue
        for i, match in enumerate(found):
            end = found[i + 1].start() if i + 1 < len(found) else len(line)
            row = parse_result_segment(line[match.start() : end], file_badge, meta["session"], meta["url"])
            if row:
                out[row["code"]] = row
    return out


def parse_name_results(text: str, meta: dict) -> dict[str, dict]:
    """Older result PDFs list Chinese names instead of candidate codes."""
    file_badge = badge_from_filename(meta["url"])
    out: dict[str, dict] = {}
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        match = NAME_RESULT_RE.match(line)
        if not match:
            continue
        name = match.group(1)
        if name in NAME_STOP:
            continue
        passed = "考獲" in line
        pass_match = PASS_RE.search(line)
        badge = (pass_match.group(1) if pass_match else file_badge) or file_badge
        out[normalize_name(name)] = {
            "name": name,
            "passed": passed,
            "absent": "缺席" in line and "考獲" not in line,
            "badge": badge,
            "session": meta["session"],
            "url": meta["url"],
        }
    return out


def merge_players(
    sittings: list[dict],
    results: dict[tuple[str, str], dict],
    name_results: dict[tuple[str, str], dict] | None = None,
) -> dict[str, list[dict]]:
    name_results = name_results or {}
    players: dict[str, list[dict]] = defaultdict(list)
    for row in sittings:
        key = (row["session"], row["code"])
        result = results.get(key)
        if result and not result_fits_code(row["code"], result):
            result = None
        if not result:
            named = name_results.get((row["session"], row["norm"]))
            if named and result_fits_code(row["code"], named):
                result = named
        badge = canonical_badge(row["code"], (result or {}).get("badge") or row["badge"])
        item = {
            "name": row["name"],
            "code": row["code"],
            "badge": badge,
            "session": row["session"],
            "passed": result["passed"] if result else None,
            "absent": result["absent"] if result else False,
            "waitResult": result is None,
            "url": (result or row)["url"],
            "listUrl": row["url"],
        }
        if result:
            for field in ("tech", "written", "carry"):
                if field in result:
                    item[field] = result[field]
        existing = {(r.get("session"), r.get("code")) for r in players[row["norm"]]}
        if key not in existing:
            players[row["norm"]].append(item)
    return players


def overlay_results(players: dict, results: dict[tuple[str, str], dict]) -> int:
    filled = 0
    for recs in players.values():
        for rec in recs:
            result = results.get((rec.get("session"), rec.get("code")))
            if not result or not result_fits_code(rec.get("code") or "", result):
                continue
            was_null = rec.get("passed") is None
            apply_result_fields(rec, result)
            if was_null:
                filled += 1
    return filled


def overlay_name_results(players: dict, name_results: dict[tuple[str, str], dict]) -> int:
    filled = 0
    for key, recs in players.items():
        sittings_by_year: dict[str, list] = defaultdict(list)
        for rec in recs:
            sittings_by_year[(rec.get("session") or "")[:4]].append(rec)
        for rec in recs:
            if rec.get("passed") is not None:
                continue
            session = rec.get("session") or ""
            result = name_results.get((session, key)) or name_results.get(
                (session, normalize_name(rec.get("name") or ""))
            )
            if not result:
                year_catch = name_results.get((f"{session[:4]}-00", key))
                if year_catch and len(sittings_by_year.get(session[:4], [])) == 1:
                    result = year_catch
            if not result or not result_fits_code(rec.get("code") or "", result):
                continue
            apply_result_fields(rec, result)
            filled += 1
    return filled


def add_name_only_players(players: dict, name_results: dict[tuple[str, str], dict]) -> int:
    added = 0
    for (session, norm), result in name_results.items():
        recs = players.setdefault(norm, [])
        if any((rec.get("session") or "") == session for rec in recs):
            continue
        recs.append(
            {
                "name": result.get("name") or norm,
                "code": "",
                "badge": result.get("badge") or "",
                "session": session,
                "passed": result["passed"],
                "absent": result["absent"],
                "waitResult": False,
                "url": result["url"],
                "listUrl": result["url"],
            }
        )
        added += 1
    return added


def stamp_wait_result(players: dict) -> None:
    has_outcome: set[str] = set()
    for recs in players.values():
        for rec in recs:
            if rec.get("passed") is True or rec.get("passed") is False or rec.get("absent"):
                has_outcome.add(rec.get("session") or "")
    for recs in players.values():
        for rec in recs:
            if rec.get("passed") is None:
                rec["waitResult"] = (rec.get("session") or "") not in has_outcome
            else:
                rec["waitResult"] = False


def repair_record(rec: dict) -> str | None:
    """Fix stored label vs candidate code, and drop results copied from another badge PDF."""
    code = rec.get("code") or ""
    sitting = badge_from_code(code)
    if not sitting:
        return None
    file_level = badge_from_filename(rec.get("url") or "")
    list_url = rec.get("listUrl") or ""
    result_url = rec.get("url") or ""
    mismatched_file = bool(file_level and file_level != sitting and result_url and result_url != list_url)
    if mismatched_file:
        rec["badge"] = canonical_badge(code, rec.get("badge") or "")
        rec["passed"] = None
        rec["absent"] = False
        rec["waitResult"] = True
        rec["url"] = list_url or result_url
        for field in ("tech", "written", "carry"):
            rec.pop(field, None)
        return "detach"
    new_badge = canonical_badge(code, rec.get("badge") or "")
    if rec.get("badge") != new_badge:
        rec["badge"] = new_badge
        return "relabel"
    return None


def repair_players(players: dict) -> dict[str, int]:
    counts = {"relabel": 0, "detach": 0}
    for recs in players.values():
        for rec in recs:
            change = repair_record(rec)
            if change:
                counts[change] += 1
    stamp_wait_result(players)
    return counts


def repair_json() -> None:
    if not OUT_PATH.exists():
        print("missing badges.json")
        return
    data = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    counts = repair_players(data.get("players") or {})
    data["updated"] = datetime.now(HKT).strftime("%Y-%m-%d %H:%M")
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"repaired badges.json relabel {counts['relabel']} detach {counts['detach']}")


def load_miss() -> set[str]:
    if not MISS_PATH.exists():
        return set()
    try:
        data = json.loads(MISS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    if isinstance(data, list):
        return set(data)
    return set()


def save_miss(miss: set[str]) -> None:
    MISS_PATH.write_text(json.dumps(sorted(miss), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def known_badge_urls(old: dict) -> set[str]:
    found: set[str] = set()
    for recs in (old.get("players") or {}).values():
        for rec in recs:
            for key in ("url", "listUrl"):
                url = rec.get(key)
                if url:
                    found.add(url)
    return found


def arg_max() -> int:
    for arg in sys.argv[1:]:
        if arg.startswith("--max="):
            return int(arg.split("=", 1)[1])
    return 0


def main() -> None:
    import pdfplumber  # noqa: F401

    max_new = arg_max()
    old = json.loads(OUT_PATH.read_text(encoding="utf-8")) if OUT_PATH.exists() else {}
    miss = load_miss()
    known = known_badge_urls(old)
    live = listing_urls() + news_pdfs()
    listed = live + extra_urls()
    listed_set = {canon_url(url) for url in listed}
    live_set = {canon_url(url) for url in live}
    print(f"listing pdfs: {len(listed)}")
    years = {
        str(rec.get("session") or "")[:4]
        for recs in (old.get("players") or {}).values()
        for rec in recs
    }
    need_history = not any(year and year < "2025" for year in years)
    use_cdx = need_history or archive_state.due("badgeCdx", days=7) or "--force-cdx" in sys.argv
    if not use_cdx:
        print("skip Wayback CDX (ran within 7 days)")
    elif need_history:
        print("Wayback CDX forced (no pre-2025 badge sessions yet)")
    docs = related_docs(listed, use_cdx)
    if use_cdx:
        archive_state.mark("badgeCdx")
    pending = []
    skipped = 0
    for meta in docs:
        url = meta["url"]
        if url not in live_set:
            if url in known:
                skipped += 1
                continue
            if url in miss and not meta.get("wayback"):
                skipped += 1
                continue
        pending.append(meta)
    head = [meta for meta in pending if meta["url"] in live_set]
    tail = [meta for meta in pending if meta["url"] not in live_set]
    if max_new:
        tail = tail[:max_new]
    pending = head + tail
    print(f"candidate docs: {len(pending)} skipped {skipped}")

    sittings: list[dict] = []
    results: dict[tuple[str, str], dict] = {}
    name_results: dict[tuple[str, str], dict] = {}
    parsed = 0
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for i, meta in enumerate(pending, 1):
            url = meta["url"]
            print(f"[{i}/{len(pending)}] {meta['kind']} {meta['session']} {url}")
            body = get_pdf(url, referer=LISTING, wayback=meta.get("wayback", True))
            if not body:
                print("  skip (no pdf)")
                if url not in listed_set:
                    miss.add(url)
                continue
            path = tmp_dir / f"{i}.pdf"
            path.write_bytes(body)
            try:
                text = pdf_text(path)
            except Exception as exc:  # noqa: BLE001
                print(f"  parse error: {exc}")
                continue
            parsed += 1
            rows = parse_timetable(text, meta)
            if rows:
                sittings.extend(rows)
            mapped = parse_results(text, meta)
            for cand, row in mapped.items():
                results[(row["session"], cand)] = row
            named = parse_name_results(text, meta)
            for norm, row in named.items():
                name_results[(row["session"], norm)] = row
            print(f"  names {len(rows)} results {len(mapped)} named {len(named)}")

    players = merge_players(sittings, results, name_results)
    if old:
        kept = 0
        filled_old = 0
        for name, recs in (old.get("players") or {}).items():
            by_key = {(r.get("session"), r.get("code")): r for r in players.get(name, [])}
            existing = set(by_key)
            for rec in recs:
                key = (rec.get("session"), rec.get("code"))
                current = by_key.get(key)
                if current is not None:
                    if current.get("passed") is None and (
                        rec.get("passed") is not None or rec.get("absent")
                    ):
                        current["passed"] = rec.get("passed")
                        current["absent"] = rec.get("absent")
                        current["waitResult"] = False
                        if rec.get("url"):
                            current["url"] = rec["url"]
                        current["badge"] = canonical_badge(
                            current.get("code") or rec.get("code") or "",
                            rec.get("badge") or current.get("badge") or "",
                        )
                        filled_old += 1
                    continue
                players[name].append(rec)
                existing.add(key)
                by_key[key] = rec
                kept += 1
        print(f"kept {kept} historical badge rows, restored {filled_old} outcomes")

    filled = overlay_results(players, results)
    filled += overlay_name_results(players, name_results)
    added = add_name_only_players(players, name_results)
    print(f"filled results on {filled} existing rows, added {added} name-only rows")
    repaired = repair_players(players)
    print(f"repaired relabel {repaired['relabel']} detach {repaired['detach']}")

    year = datetime.now(HKT).strftime("%Y")
    year_count = sum(
        1
        for recs in players.values()
        if any(str(rec.get("session") or "").startswith(year) for rec in recs)
    )
    old_year_count = old.get("count") if old.get("countYear") == year else None
    payload = {
        "source": "恒生乒乓球學院公開章別考試（考生時間表／成績 PDF）",
        "sourceUrl": LISTING,
        "updated": datetime.now(HKT).strftime("%Y-%m-%d %H:%M"),
        "count": year_count,
        "countAll": len(players),
        "countYear": year,
        "prevCount": old_year_count if old_year_count is not None else year_count,
        "documents": parsed,
        "players": players,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    save_miss(miss)
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes, {len(players)} names)")
    waiting = any(rec.get("waitResult") for recs in players.values() for rec in recs)
    if waiting and (archive_state.due("badgeBackfill", days=7) or "--backfill" in sys.argv):
        backfill_results(max_new=max_new)
        archive_state.mark("badgeBackfill")


def backfill_results(max_new: int = 0) -> None:
    """Re-read result PDFs for sessions that still have unmatched timetable rows."""
    import pdfplumber  # noqa: F401

    if not OUT_PATH.exists():
        print("missing badges.json")
        return
    data = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    players = data.get("players") or {}
    sessions: set[str] = set()
    folders: set[str] = set()
    for recs in players.values():
        for rec in recs:
            if rec.get("passed") is not None:
                continue
            session = rec.get("session") or ""
            if session:
                sessions.add(session)
            for key in ("listUrl", "url"):
                url = rec.get(key) or ""
                if url and "/" in url:
                    folders.add(url.rsplit("/", 1)[0] + "/")
    print(f"sessions needing results: {len(sessions)}")
    urls: list[tuple[str, str]] = []
    seen: set[str] = set()
    for session in sorted(sessions):
        for url in result_guess_urls(session):
            if url not in seen:
                seen.add(url)
                urls.append((session, url))
        year, month = session.split("-")
        names = {v: k for k, v in MONTH.items()}
        mon = names.get(month, "")
        for folder in folders:
            if f"/{year}/" not in folder and (not mon or f"/{year}/{mon}/" not in folder):
                continue
            for letter in "BSGPD":
                for extra in (
                    f"{folder}Result_{letter}.pdf",
                    f"{folder}Result/{letter}.pdf",
                    f"{folder}{letter}.pdf",
                ):
                    if extra not in seen:
                        seen.add(extra)
                        urls.append((session, extra))
    if max_new:
        urls = urls[:max_new]
    print(f"candidate result pdfs: {len(urls)}")
    results: dict[tuple[str, str], dict] = {}
    name_results: dict[tuple[str, str], dict] = {}
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for i, (session, url) in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] {session} {url}")
            body = get_pdf(url, referer=LISTING, wayback=True)
            if not body:
                print("  skip (no pdf)")
                continue
            path = tmp_dir / f"{i}.pdf"
            path.write_bytes(body)
            try:
                text = pdf_text(path)
            except Exception as exc:  # noqa: BLE001
                print(f"  parse error: {exc}")
                continue
            mapped = parse_results(text, {"url": url, "session": session})
            named = parse_name_results(text, {"url": url, "session": session})
            print(f"  results {len(mapped)} names {len(named)}")
            for cand, row in mapped.items():
                results[(row["session"], cand)] = row
            for norm, row in named.items():
                name_results[(row["session"], norm)] = row
    filled = overlay_results(players, results)
    filled += overlay_name_results(players, name_results)
    added = add_name_only_players(players, name_results)
    repaired = repair_players(players)
    data["players"] = players
    data["updated"] = datetime.now(HKT).strftime("%Y-%m-%d %H:%M")
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"filled {filled} rows, added {added} name-only, relabel {repaired['relabel']} detach {repaired['detach']}, wrote {OUT_PATH}")


if __name__ == "__main__":
    if "--repair" in sys.argv:
        repair_json()
    elif "--backfill" in sys.argv:
        backfill_results(max_new=arg_max())
    else:
        main()
