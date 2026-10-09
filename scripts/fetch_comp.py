"""Download public match-result PDFs: HKSSF, HKTTA opens, Hong Kong Games.

PDF / HTML listings only. Does not call HKTTA CGI ranking pages.
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from archive_http import cdx_prefix, get_pdf, http_get  # noqa: E402
import archive_state  # noqa: E402

OUT_PATH = ROOT / "data" / "comp.json"
EXTRA_PATH = ROOT / "data" / "comp_extra_urls.json"
HKT = timezone(timedelta(hours=8))
HREF_RE = re.compile(r"""(?:href\s*=\s*|url\s*\(\s*)['"]?([^'"\s>)]+)""", re.I)
YEAR_RE = re.compile(r"(20\d{2})")
NAME_RE = re.compile(r"[\u4e00-\u9fff]{2,4}")
PLACE_WORD = {
    "冠軍": 1,
    "第一名": 1,
    "亞軍": 2,
    "第二名": 2,
    "季軍": 3,
    "第三名": 3,
    "殿軍": 4,
    "第四名": 4,
}
PLACE_RE = re.compile(
    r"(冠\s*軍|亞\s*軍|季\s*軍|殿\s*軍|第一名|第二名|第三名|第四名)\s*[:：]?\s*"
    r"([\u4e00-\u9fff]{2,4})(?:\s+([\u4e00-\u9fff]{2,4}))?"
)
GAMES_NAME_RE = re.compile(r"([\u4e00-\u9fff]{2,4})\s*[（(](東區|灣仔|中西區|南區|油尖旺|深水埗|九龍城|黃大仙|觀塘|沙田|西貢|屯門|葵青|元朗|北區|大埔|荃灣|離島)區?[）)]")
GROUP_RE = re.compile(
    r"(男子[甲乙丙丁戊]組|女子[甲乙丙丁]組|男子單打|女子單打|"
    r"Boys?\s*[ABC]\s*Grade|Girls?\s*[ABC]\s*Grade|"
    r"[男女]子(?:單打)?[ABC]組|小學[男女]子|中學[男女]子|"
    r"菁英賽|個人賽|學界)"
)
SKIP_PDF_RE = re.compile(
    r"prospectus|entryform|章程|報名|cgi-bin|handbook|notice|guideline|"
    r"past_record|registered_player",
    re.I,
)
STOPWORDS = {
    "乒乓球", "單打", "雙打", "混合", "比賽", "賽程", "成績", "得獎", "名單",
    "冠軍", "亞軍", "季軍", "殿軍", "第一名", "第二名", "第三名", "第四名",
    "男子", "女子", "青少年", "先進", "成年", "組別", "項目", "參加", "參加者",
    "主辦", "贊助", "日期", "時間", "地點", "姓名", "獎項", "章程", "公開",
    "學校", "學界", "菁英", "港運", "代表", "分區", "小學", "中學", "書院",
    "運動員", "總冊", "秩序", "抽籤", "對賽", "決賽", "初賽", "複賽",
    "中國", "香港", "總會", "學體會", "康樂", "文化", "事務",
}

HKSSF_URL_RE = re.compile(r"tabletennis|table.?tennis|/tt_|乒乓球|jing.?ying|菁英|result.?book", re.I)
OPEN_URL_RE = re.compile(r"local_hkopen|公開乒乓球|hkopen", re.I)
GAMES_URL_RE = re.compile(r"hongkonggames|hkg20|HKG_PUBLIC|乒乓球|tabletennis|sportid=6", re.I)
TT_TEXT_RE = re.compile(r"乒\s*乓\s*球|table\s*tennis", re.I)

LISTINGS = {
    "hkssf": [
        "http://www.hkssf-hk.org.hk/hk/sec/events/tabletennis/",
        "http://www.hkssf-hk.org.hk/hk/pri/",
        "http://www.hkssf-hk.org.hk/hk/pri/Past%20Results/",
        "http://www.hkssf-nt.org.hk/",
    ],
    "open": [
        "https://web.hktta.org.hk/gameinfo/local/local_hkopen/",
        "https://www.hktta.org.hk/gameinfo/local/local_hkopen/",
        "https://web.hktta.org.hk/gameinfo/local/local_hkopen_ranking/",
        "https://www.hktta.org.hk/gameinfo/local/local_hkopen_ranking/",
    ],
    "hkgames": [
        "https://www.hongkonggames.hk/",
        "https://www.hongkonggames.hk/hkg2024/",
    ],
}

CDX_PREFIXES = {
    "hkssf": [
        "www.hkssf-hk.org.hk/hk/sec/events/tabletennis/",
        "www.hkssf-hk.org.hk/hk/pri/Past Results/",
        "www.hkssf-nt.org.hk/",
    ],
    "open": [
        "web.hktta.org.hk/gameinfo/local/local_hkopen/",
        "www.hktta.org.hk/gameinfo/local/local_hkopen/",
        "web.hktta.org.hk/gameinfo/local/local_hkopen_ranking/",
        "www.hktta.org.hk/gameinfo/local/local_hkopen_ranking/",
    ],
    "hkgames": [
        "www.hongkonggames.hk/",
        "www3.lcsd.gov.hk/HKG_PUBLIC_9TH/",
        "www3.lcsd.gov.hk/HKG_PUBLIC_8TH/",
    ],
}

def now_stamp() -> str:
    return datetime.now(HKT).strftime("%Y-%m-%d %H:%M")


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", "", name)


def is_person_name(name: str) -> bool:
    if name in STOPWORDS or len(name) < 2 or len(name) > 4:
        return False
    if not NAME_RE.fullmatch(name):
        return False
    if name[0] == name[-1] and len(set(name)) == 1:
        return False
    return True


def canon_url(url: str) -> str:
    url = unquote((url or "").replace("&amp;", "&").strip())
    if url.startswith("//"):
        url = "https:" + url
    return url.split("#")[0]


def abs_url(href: str, base: str) -> str:
    return canon_url(urljoin(base, href))


def year_from_blob(*parts: str) -> str:
    for part in parts:
        match = YEAR_RE.search(part or "")
        if match:
            year = int(match.group(1))
            if 2004 <= year <= 2099:
                return str(year)
    return ""


def url_ok(src: str, url: str) -> bool:
    if not url.lower().endswith(".pdf"):
        return False
    if SKIP_PDF_RE.search(url):
        return False
    if src == "hkssf":
        if re.search(r"circular|umpire|course|knock.?out|cover\.pdf|newservicelaw", url, re.I):
            return False
        return bool(HKSSF_URL_RE.search(url))
    if src == "open":
        if re.search(r"InitialScore|EntryForm|prospectus|章程|PlayerList|DrawResult|Waiting|Schedule", url, re.I):
            return False
        return bool(OPEN_URL_RE.search(url))
    if src == "hkgames":
        return bool(GAMES_URL_RE.search(url))
    return False


def guess_event(src: str, url: str, year: str, text: str = "") -> str:
    head = (text or "")[:400]
    if src == "open":
        if "排名錦標賽" in head or "ranking" in url.lower():
            return f"{year}全港公開排名錦標賽".strip()
        return f"{year}全港公開乒乓球單項錦標賽".strip()
    if src == "hkgames":
        edition = ""
        found = re.search(r"第([一二三四五六七八九十兩\d]+)屆", head) or re.search(r"第([一二三四五六七八九十兩\d]+)屆", url)
        if found:
            edition = f"第{found.group(1)}屆"
        return f"{edition}全港運動會乒乓球".strip()
    if "菁英" in url or "jing" in url.lower() or "菁英" in head:
        return f"{year}學界乒乓球菁英賽".strip()
    if "pri" in url.lower() or "小學" in head:
        return f"{year}小學校際乒乓球".strip()
    return f"{year}學界乒乓球".strip()


def gender_from_group(group: str) -> str:
    text = group or ""
    if re.search(r"女子|Girls|\bF\b", text, re.I):
        return "F"
    if re.search(r"男子|Boys|\bM\b", text, re.I):
        return "M"
    return ""


def empty_store() -> dict:
    return {
        "source": "學界／乒總公開賽／全港運動會已公布成績 PDF",
        "updated": "",
        "count": 0,
        "documents": [],
        "players": {},
    }


def load_store() -> dict:
    if not OUT_PATH.exists():
        return empty_store()
    try:
        data = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return empty_store()
    data.setdefault("documents", [])
    data.setdefault("players", {})
    return data


def load_extra() -> list[dict]:
    if not EXTRA_PATH.exists():
        return []
    try:
        raw = json.loads(EXTRA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    out = []
    for item in raw:
        if isinstance(item, str):
            url = canon_url(item)
            src = guess_src(url)
            if url and src:
                out.append({"url": url, "src": src})
            continue
        url = canon_url((item or {}).get("url") or "")
        src = (item or {}).get("src") or guess_src(url)
        if url and src:
            rec = dict(item)
            rec["url"] = url
            rec["src"] = src
            out.append(rec)
    return out


def guess_src(url: str) -> str:
    if OPEN_URL_RE.search(url) and "hktta" in url.lower():
        return "open"
    if "hongkonggames" in url.lower() or "HKG_PUBLIC" in url:
        return "hkgames"
    if HKSSF_URL_RE.search(url) and "hkssf" in url.lower():
        return "hkssf"
    if "hktta" in url.lower() and "local" in url.lower():
        return "open"
    return ""


def persist_extra(items: list[dict]) -> None:
    extra = load_extra()
    seen = {d.get("url") for d in extra}
    added = 0
    for item in items:
        url = item.get("url")
        if not url or url in seen:
            continue
        extra.append({"url": url, "src": item.get("src") or "", "year": item.get("year") or ""})
        seen.add(url)
        added += 1
    if added:
        EXTRA_PATH.write_text(json.dumps(extra, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"stored {added} extra urls")


def guessed_docs() -> list[dict]:
    year_now = datetime.now(HKT).year
    docs: list[dict] = []
    for year in range(year_now - 8, year_now + 1):
        y = str(year)
        docs.append(
            {
                "url": f"https://web.hktta.org.hk/gameinfo/local/local_hkopen/Result/{year}.pdf",
                "src": "open",
                "year": y,
                "event": f"{year}全港公開乒乓球單項錦標賽",
            }
        )
        docs.append(
            {
                "url": f"https://www.hktta.org.hk/gameinfo/local/local_hkopen/Result/{year}.pdf",
                "src": "open",
                "year": y,
                "event": f"{year}全港公開乒乓球單項錦標賽",
            }
        )
        yy = f"{str(year)[2:]}{str(year + 1)[2:]}"
        docs.append(
            {
                "url": (
                    "http://www.hkssf-hk.org.hk/hk/pri/Past%20Results/"
                    f"result%20book/6_Results-Book_{yy}.pdf"
                ),
                "src": "hkssf",
                "year": y,
                "event": f"{year}小學體育比賽成績總冊",
            }
        )
    return docs


def collect_hrefs(html: str, base: str) -> list[str]:
    found = []
    seen: set[str] = set()
    for href in HREF_RE.findall(html or ""):
        url = abs_url(href, base)
        if not url or url in seen:
            continue
        seen.add(url)
        found.append(url)
    return found


def crawl_listings() -> list[dict]:
    docs: list[dict] = []
    seen: set[str] = set()
    pages: list[tuple[str, str, int]] = []
    for src, urls in LISTINGS.items():
        for url in urls:
            pages.append((src, url, 0))
    year_now = datetime.now(HKT).year
    for year in range(year_now - 6, year_now + 1):
        pages.append(("open", f"https://web.hktta.org.hk/gameinfo/local/local_hkopen/{year}/", 0))
        pages.append(("open", f"https://www.hktta.org.hk/gameinfo/local/local_hkopen_ranking/{year}/", 0))
    for src, page, depth in pages:
        code, body = http_get(page)
        if code != 200 or not body:
            continue
        html = body.decode("utf-8", errors="replace")
        for href in collect_hrefs(html, page):
            if href.lower().endswith(".pdf"):
                if not url_ok(src, href) or href in seen:
                    continue
                seen.add(href)
                docs.append({"url": href, "src": src, "year": year_from_blob(href, html[:1500])})
            elif depth < 1 and src == "hkssf" and HKSSF_URL_RE.search(href) and href not in seen:
                seen.add(href)
                pages.append((src, href, depth + 1))
    print(f"listing pdfs: {len(docs)}")
    return docs


def discover_wayback() -> list[dict]:
    found: list[dict] = []
    seen: set[str] = set()
    for src, prefixes in CDX_PREFIXES.items():
        for prefix in prefixes:
            for _ts, original in cdx_prefix(prefix, limit=8000):
                url = canon_url(original)
                if not url_ok(src, url) or url in seen:
                    continue
                seen.add(url)
                found.append({"url": url, "src": src, "year": year_from_blob(url), "wayback": True})
    print(f"wayback pdfs: {len(found)}")
    return found


def _cell_text(value: object) -> str:
    return str(value or "").replace("\n", " ").strip()


def _place_columns(row: list) -> list[tuple[int, int]]:
    found: list[tuple[int, int]] = []
    for idx, cell in enumerate(row):
        text = _cell_text(cell)
        for word, place in PLACE_WORD.items():
            if word in text:
                found.append((idx, place))
                break
    seen: set[int] = set()
    unique: list[tuple[int, int]] = []
    for idx, place in found:
        if place in seen:
            continue
        seen.add(place)
        unique.append((idx, place))
    return unique


def extract_table_places(pdf) -> list[dict]:
    out: list[dict] = []
    for page in pdf.pages:
        for table in page.extract_tables() or []:
            place_cols: list[tuple[int, int]] = []
            header_end = 0
            current_group = ""
            for row_idx, row in enumerate(table[:6]):
                cols = _place_columns(row)
                if len(cols) >= 2:
                    place_cols = cols
                    header_end = row_idx
            if not place_cols:
                continue
            for row in table[header_end + 1 :]:
                joined = " ".join(_cell_text(cell) for cell in row)
                group_match = GROUP_RE.search(joined)
                if group_match:
                    current_group = group_match.group(1)
                for col_idx, place in place_cols:
                    if col_idx >= len(row):
                        continue
                    names = [n for n in NAME_RE.findall(_cell_text(row[col_idx])) if is_person_name(n)]
                    if not names:
                        continue
                    out.append({"name": names[0], "place": place, "group": current_group, "school": names[1] if len(names) > 1 else ""})
    return out


def extract_text_places(text: str) -> list[dict]:
    out: list[dict] = []
    current_group = ""
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        group_match = GROUP_RE.search(line)
        if group_match:
            current_group = group_match.group(1)
        for match in PLACE_RE.finditer(line):
            name = match.group(2)
            if not is_person_name(name):
                continue
            school = match.group(3) or ""
            if school and not is_person_name(school):
                school = ""
            word = re.sub(r"\s+", "", match.group(1))
            place = PLACE_WORD.get(word)
            if not place:
                continue
            out.append({"name": name, "place": place, "group": current_group, "school": school})
    return out


def extract_games_entries(text: str) -> list[dict]:
    out: list[dict] = []
    current_group = ""
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        group_match = GROUP_RE.search(line)
        if group_match:
            current_group = group_match.group(1)
        for match in GAMES_NAME_RE.finditer(line):
            name = match.group(1)
            if not is_person_name(name):
                continue
            out.append({"name": name, "district": match.group(2), "group": current_group, "kind": "entry"})
    return out


NEXT_SPORT_RE = re.compile(
    r"\n\s*(田\s*徑|游\s*泳|籃\s*球|足\s*球|排\s*球|羽\s*毛\s*球|手\s*球|網\s*球|壁\s*球|劍\s*擊|體\s*操|軟\s*式\s*排球)",
)


def tt_section(text: str) -> str:
    matches = list(TT_TEXT_RE.finditer(text))
    if not matches:
        return ""
    best = ""
    best_score = -1
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[start:end]
        nxt = NEXT_SPORT_RE.search(chunk[12:])
        if nxt:
            chunk = chunk[: nxt.start() + 12]
        score = len(PLACE_RE.findall(chunk))
        if score > best_score:
            best = chunk
            best_score = score
    return best


def parse_pdf(path: Path, meta: dict) -> list[dict]:
    import pdfplumber

    chunks = []
    table_rows: list[dict] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
        table_rows = [] if meta.get("src") == "hkssf" else extract_table_places(pdf)
    text = "\n".join(chunks)
    if meta.get("src") == "hkssf":
        text = tt_section(text)
        if not text:
            return []
    elif not TT_TEXT_RE.search(text) and meta.get("src") != "open":
        return []
    year = meta.get("year") or year_from_blob(meta.get("url") or "", text[:1500])
    event = meta.get("event") or guess_event(meta["src"], meta["url"], year, text)
    by_name: dict[str, dict] = {}

    def put(row: dict) -> None:
        name = row.get("name") or ""
        if not is_person_name(name):
            return
        key = normalize_name(name)
        rec = by_name.get(key)
        place = row.get("place")
        if rec and place and rec.get("place") and rec["place"] <= place:
            return
        group = row.get("group") or (rec or {}).get("group") or ""
        item = {
            "name": name,
            "src": meta["src"],
            "year": year,
            "event": event,
            "group": group,
            "kind": row.get("kind") or "result",
            "url": meta["url"],
        }
        if place:
            item["place"] = place
            item["kind"] = "result"
        school = row.get("school") or ""
        if school:
            item["school"] = school
        district = row.get("district") or ""
        if district:
            item["district"] = district
        gender = gender_from_group(group)
        if gender:
            item["gender"] = gender
        by_name[key] = item

    for row in table_rows:
        put(row)
        if meta.get("src") in {"open", "hkgames"} and row.get("school") and is_person_name(row["school"]):
            put({**row, "name": row["school"], "school": ""})
    for row in extract_text_places(text):
        put(row)
        if meta.get("src") in {"open", "hkgames"} and row.get("school") and is_person_name(row["school"]):
            put({**row, "name": row["school"], "school": ""})
    if meta.get("src") == "hkgames":
        for row in extract_games_entries(text):
            put(row)
    return list(by_name.values())


def rec_key(rec: dict) -> tuple:
    return (rec.get("src"), rec.get("url"), rec.get("year"), rec.get("event"), rec.get("group"))


def main() -> None:
    import pdfplumber  # noqa: F401

    wanted = ""
    for arg in sys.argv[1:]:
        if arg.startswith("--src="):
            wanted = arg.split("=", 1)[1]
    max_new = 0
    for arg in sys.argv[1:]:
        if arg.startswith("--max="):
            max_new = int(arg.split("=", 1)[1])

    docs: list[dict] = []
    seen: set[str] = set()

    def add_doc(item: dict) -> None:
        url = canon_url(item.get("url") or "")
        src = item.get("src") or guess_src(url)
        if not url or not src or url in seen:
            return
        if not url_ok(src, url):
            return
        if wanted and src != wanted:
            return
        seen.add(url)
        rec = dict(item)
        rec["url"] = url
        rec["src"] = src
        rec.setdefault("year", year_from_blob(url))
        docs.append(rec)

    for item in guessed_docs() + load_extra() + crawl_listings():
        add_doc(item)
    if archive_state.due("compCdx", days=7) or "--force-cdx" in sys.argv:
        archived = discover_wayback()
        persist_extra(archived)
        for item in archived:
            add_doc(item)
        archive_state.mark("compCdx")
    else:
        print("skip Wayback CDX (ran within 7 days)")

    old = load_store()
    done_urls = {d.get("url") for d in (old.get("documents") or []) if d.get("url")}
    pending = [d for d in docs if d["url"] not in done_urls]
    if max_new:
        pending = pending[:max_new]
    print(f"candidate pdfs: {len(docs)} pending {len(pending)}")

    players: dict[str, list[dict]] = defaultdict(list)
    parsed_docs = list(old.get("documents") or [])
    parsed_urls = {d.get("url") for d in parsed_docs}

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for i, meta in enumerate(pending, 1):
            url = meta["url"]
            print(f"[{i}/{len(pending)}] {meta['src']} {url}")
            body = get_pdf(url, wayback=True)
            if not body:
                print("  skip (no pdf)")
                continue
            path = tmp_dir / f"{i}.pdf"
            path.write_bytes(body)
            try:
                records = parse_pdf(path, meta)
            except Exception as exc:  # noqa: BLE001
                print(f"  parse error: {exc}")
                continue
            print(f"  names {len(records)}")
            if url not in parsed_urls:
                parsed_docs.append(
                    {
                        "url": url,
                        "src": meta["src"],
                        "year": meta.get("year") or "",
                        "names": len(records),
                    }
                )
                parsed_urls.add(url)
            for rec in records:
                key = normalize_name(rec["name"])
                existing = {rec_key(row) for row in players.get(key, [])}
                if rec_key(rec) in existing:
                    continue
                row = {k: v for k, v in rec.items() if k != "name"}
                players[key].append(row)

    kept = 0
    for name, recs in (old.get("players") or {}).items():
        existing = {rec_key(row) for row in players.get(name, [])}
        for rec in recs:
            key = rec_key(rec)
            if key in existing:
                continue
            players[name].append(rec)
            existing.add(key)
            kept += 1
    print(f"kept {kept} historical rows")

    payload = {
        "source": "學界／乒總公開賽／全港運動會已公布成績 PDF",
        "updated": now_stamp(),
        "count": len(players),
        "prevCount": old.get("count"),
        "counts": {
            src: sum(1 for recs in players.values() if any(r.get("src") == src for r in recs))
            for src in ("hkssf", "open", "hkgames")
        },
        "documents": parsed_docs,
        "players": players,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes, {len(players)} names)")


if __name__ == "__main__":
    main()
