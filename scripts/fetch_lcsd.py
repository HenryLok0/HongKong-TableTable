"""Download LCSD district age-group table tennis PDFs and index player names."""

from __future__ import annotations

import json
import re
import ssl
import tempfile
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from archive_http import cdx_prefix, get_pdf  # noqa: E402
import archive_state  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data" / "lcsd.json"
EXTRA_PATH = ROOT / "data" / "lcsd_extra_urls.json"
AGE_MAP_PATH = ROOT / "data" / "lcsd_age_maps.json"
SEARCH_URL = "https://www.lcsd.gov.hk/clpss/tc/search/common/searchResult.do"
PORTAL_URL = "https://www.lcsd.gov.hk/clpss/tc/webApp/Dagc.do"
HKT = timezone(timedelta(hours=8))
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

NAME_RE = re.compile(r"[\u4e00-\u9fff]{2,4}")
NUMBERED_NAME_RE = re.compile(r"(?:^|[^\u4e00-\u9fff])(\d{1,3})\s*([\u4e00-\u9fff]{2,4})(?:\s+|$)")
GROUP_RE = re.compile(r"\b([MF][A-Z]{1,2}\d?)\b")
YEAR_RE = re.compile(r"(20\d{2})")
AGE_SPAN_RE = re.compile(
    r"(?P<min>\d+)\s*[-–至到]\s*(?P<max>\d+)\s*歲.{0,80}?(?P<code>[MF](?:AA|[YS][1-5]|D[SAY]|[A-Z]{1,2}))",
    re.DOTALL,
)
AGE_PLUS_RE = re.compile(
    r"(?P<min>\d+)\s*歲或以上.{0,80}?(?P<code>[MF](?:AA|[YS][1-5]|D[SAY]|[A-Z]{1,2}))",
    re.DOTALL,
)
AGE_UNDER_RE = re.compile(
    r"(?P<max>\d+)\s*歲或以下.{0,80}?(?P<code>[MF](?:AA|[YS][1-5]|D[SAY]|[A-Z]{1,2}))",
    re.DOTALL,
)
DOUBLES_NEAR_RE = re.compile(r"雙打")
DISTRICT_RE = re.compile(
    r"(東區|灣仔|中西區|南區|油尖旺|深水埗|九龍城|黃大仙|觀塘|沙田|西貢|屯門|葵青|元朗|北區|大埔|荃灣|離島)"
)

STOPWORDS = {
    "乒乓球", "單打", "雙打", "混合", "比賽", "賽程", "賽程表", "成績", "得獎", "名單",
    "冠軍", "亞軍", "季軍", "殿軍", "第一名", "第二名", "第三名", "第四名",
    "男子", "女子", "青少年", "先進", "成年", "組別", "項目", "參加", "參加者",
    "主辦", "贊助", "康樂", "文化", "事務", "署主", "地區", "分齡", "分區",
    "日期", "時間", "地點", "星期", "星期六", "星期日", "後備", "報到",
    "體育館", "活動", "編號", "備註", "姓名", "獎項", "下載", "章程",
    "以上", "或以下", "歲或", "或以上", "公開", "報名", "抽籤", "對賽",
    "中國", "香港", "總會", "規則", "採用", "決賽", "初賽", "複賽",
    "容後", "提供", "不適", "適用", "請參", "須知", "注意", "棄權",
    "上午", "下午", "晚上", "中午", "星期", "週六", "週日",
}


def ssl_context() -> ssl.SSLContext:
    return ssl.create_default_context()


def http_request(url: str, data: bytes | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": PORTAL_URL,
            "Accept": "*/*",
        },
        method="POST" if data is not None else "GET",
    )
    try:
        with urllib.request.urlopen(req, context=ssl_context(), timeout=60) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read() if exc.fp else b""


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


def kind_from_url(url: str) -> str:
    lower = url.lower()
    if "_pro_" in lower or "prospectus" in lower:
        return "prospectus"
    if "_res_" in lower or "result" in lower or "winner" in lower:
        return "result"
    if "_sch_" in lower or "schedule" in lower or "fixture" in lower:
        return "schedule"
    return "other"


def parse_listing_html(html: str) -> list[dict]:
    events = []
    seen = set()
    rows = re.findall(r"<tr>(.*?)</tr>", html, flags=re.S | re.I)
    for row in rows:
        if "乒乓球" not in row:
            continue
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, flags=re.S | re.I)
        texts = [re.sub(r"<[^>]+>", " ", c) for c in cells]
        texts = [re.sub(r"\s+", " ", t).strip() for t in texts]
        if len(texts) < 3:
            continue
        district = texts[1] if len(texts) > 1 else ""
        dates = texts[2] if len(texts) > 2 else ""
        year_match = YEAR_RE.search(dates)
        year = year_match.group(1) if year_match else ""
        for href in re.findall(r"href\s*=\s*'([^']+\.pdf)'", row, flags=re.I):
            url = href.strip()
            kind = kind_from_url(url)
            if kind not in {"schedule", "result", "prospectus"}:
                continue
            key = (url, kind)
            if key in seen:
                continue
            seen.add(key)
            events.append(
                {
                    "url": url,
                    "district": district,
                    "year": year,
                    "kind": kind,
                    "event": f"{district}分齡乒乓球比賽 {year}".strip(),
                    "dates": dates,
                }
            )
    return events


def fetch_listing() -> list[dict]:
    events: list[dict] = []
    seen: set[str] = set()
    for page_no in range(1, 16):
        payload = urllib.parse.urlencode(
            {
                "searchFormPath": "/webApp/Dagc",
                "act": "060",
                "dist": "ALL",
                "pageNo": str(page_no),
                "sortField": "",
                "sortOrder": "",
            }
        ).encode()
        code, body = http_request(SEARCH_URL, payload)
        if code != 200:
            print(f"listing failed page {page_no} ({code})")
            break
        html = body.decode("utf-8", errors="replace")
        batch = parse_listing_html(html)
        fresh = 0
        for item in batch:
            if item["url"] in seen:
                continue
            seen.add(item["url"])
            events.append(item)
            fresh += 1
        print(f"listing page {page_no}: {fresh} new")
        if not batch or fresh == 0:
            break
    return events


TT_URL_RE = re.compile(
    r"table[-_ ]?tennis|乒乓球|ttn|_tt[._]|/tt_|dagc.*tt",
    re.I,
)


def guess_lcsd_meta(url: str) -> dict:
    kind = kind_from_url(url)
    year_match = YEAR_RE.search(url)
    district_match = DISTRICT_RE.search(urllib.parse.unquote(url))
    year = year_match.group(1) if year_match else ""
    district = district_match.group(1) if district_match else ""
    return {
        "url": url,
        "district": district,
        "year": year,
        "kind": kind,
        "event": f"{district}分齡乒乓球比賽 {year}".strip(),
    }


def discover_wayback() -> list[dict]:
    prefixes = [
        "www.lcsd.gov.hk/ls/dagc/clpss/prop/",
        "www.lcsd.gov.hk/ls/dagc/",
    ]
    found: list[dict] = []
    seen: set[str] = set()
    for prefix in prefixes:
        for _ts, original in cdx_prefix(prefix, limit=8000):
            if not original.lower().endswith(".pdf"):
                continue
            if not TT_URL_RE.search(original):
                continue
            if original in seen:
                continue
            seen.add(original)
            found.append(guess_lcsd_meta(original))
    print(f"wayback table-tennis pdfs: {len(found)}")
    return found


CODE_TOKEN = r"(?P<code>[MF](?:AA|[YS][1-5]|D[SAY]|[A-Z]{1,2}))"


def extract_group_ages(text: str) -> dict[str, dict]:
    """Map group codes to age ranges found in this PDF (district prospectuses differ)."""
    out: dict[str, dict] = {}

    def add(code: str, min_age: int, max_age: int | None, doubles: bool) -> None:
        key = (code or "").upper()
        if not key or key in out:
            return
        doubles_code = bool(re.match(r"^[MF]([KLM]|D[SAYBC])$", key))
        out[key] = {"ageMin": min_age, "ageMax": max_age, "doubles": doubles or doubles_code}

    def scan(chunk: str) -> None:
        compact = re.sub(r"\s+", "", chunk)
        if not compact:
            return
        doubles = "雙打" in compact
        span = re.search(rf"(?P<min>\d+)[-–至到](?P<max>\d+)歲.{{0,32}}?{CODE_TOKEN}", compact)
        if span:
            add(span.group("code"), int(span.group("min")), int(span.group("max")), doubles)
            return
        span_rev = re.search(rf"{CODE_TOKEN}.{{0,16}}?(?P<min>\d+)[-–至到](?P<max>\d+)歲", compact)
        if span_rev:
            add(span_rev.group("code"), int(span_rev.group("min")), int(span_rev.group("max")), doubles)
            return
        plus = re.search(rf"(?P<min>\d+)歲或以上.{{0,32}}?{CODE_TOKEN}", compact)
        if plus:
            add(plus.group("code"), int(plus.group("min")), None, doubles)
            return
        plus_rev = re.search(rf"{CODE_TOKEN}.{{0,16}}?(?P<min>\d+)歲或以上", compact)
        if plus_rev:
            add(plus_rev.group("code"), int(plus_rev.group("min")), None, doubles)
            return
        under = re.search(rf"(?P<max>\d+)歲或以下.{{0,32}}?{CODE_TOKEN}", compact)
        if under:
            add(under.group("code"), 0, int(under.group("max")), doubles)
            return
        under_rev = re.search(rf"{CODE_TOKEN}.{{0,16}}?(?P<max>\d+)歲或以下", compact)
        if under_rev:
            add(under_rev.group("code"), 0, int(under_rev.group("max")), doubles)

    for line in text.splitlines():
        scan(line)
    if len(out) < 4:
        for match in AGE_SPAN_RE.finditer(text):
            add(match.group("code"), int(match.group("min")), int(match.group("max")), bool(DOUBLES_NEAR_RE.search(match.group(0))))
        for match in AGE_PLUS_RE.finditer(text):
            add(match.group("code"), int(match.group("min")), None, bool(DOUBLES_NEAR_RE.search(match.group(0))))
        for match in AGE_UNDER_RE.finditer(text):
            add(match.group("code"), 0, int(match.group("max")), bool(DOUBLES_NEAR_RE.search(match.group(0))))
    return out


def group_age_fields(group: str, ages: dict[str, dict]) -> dict:
    code = (group or "").upper()
    info = ages.get(code)
    if not info:
        base = re.sub(r"\d+$", "", code)
        info = ages.get(base)
    if not info:
        return {}
    return {"ageMin": info["ageMin"], "ageMax": info["ageMax"], "doubles": info["doubles"]}


def extract_group_near(text: str, name: str) -> str:
    idx = text.find(name)
    if idx < 0:
        return ""
    window = text[max(0, idx - 24) : idx + len(name) + 24]
    found = GROUP_RE.findall(window)
    return found[0] if found else ""


def extract_names(text: str) -> list[tuple[str, str]]:
    found: dict[str, str] = {}
    for _num, name in NUMBERED_NAME_RE.findall(text):
        if is_person_name(name):
            found.setdefault(name, extract_group_near(text, name))
    for name in NAME_RE.findall(text):
        if is_person_name(name):
            found.setdefault(name, extract_group_near(text, name))
    return list(found.items())


def _cell_text(value: object) -> str:
    return str(value or "").replace("\n", " ").strip()


def _place_columns(row: list) -> list[tuple[int, int]]:
    found: list[tuple[int, int]] = []
    for idx, cell in enumerate(row):
        text = _cell_text(cell)
        if "冠軍" in text or "第一名" in text:
            found.append((idx, 1))
        elif "亞軍" in text or "第二名" in text or "1st Runner" in text:
            found.append((idx, 2))
        elif "季軍" in text or "第三名" in text or "2nd Runner" in text:
            found.append((idx, 3))
        elif "殿軍" in text or "第四名" in text or "3rd Runner" in text:
            found.append((idx, 4))
    seen: set[int] = set()
    unique: list[tuple[int, int]] = []
    for idx, place in found:
        if place in seen:
            continue
        seen.add(place)
        unique.append((idx, place))
    return unique


def extract_result_places(pdf) -> dict[str, dict]:
    """Best placing per name from winner-list tables (1=champion ... 4=fourth)."""
    out: dict[str, dict] = {}
    for page in pdf.pages:
        for table in page.extract_tables() or []:
            place_cols: list[tuple[int, int]] = []
            header_end = 0
            for row_idx, row in enumerate(table[:5]):
                cols = _place_columns(row)
                if len(cols) >= 2:
                    place_cols = cols
                    header_end = row_idx
            if not place_cols:
                continue
            current_group = ""
            for row in table[header_end + 1 :]:
                for cell in row:
                    match = GROUP_RE.search(_cell_text(cell))
                    if match:
                        current_group = match.group(1)
                        break
                for col_idx, place in place_cols:
                    if col_idx >= len(row):
                        continue
                    for name in NAME_RE.findall(_cell_text(row[col_idx])):
                        if not is_person_name(name):
                            continue
                        prev = out.get(name)
                        if prev and prev["place"] <= place:
                            continue
                        out[name] = {"place": place, "group": current_group}
    return out


def enrich_from_text(meta: dict, text: str) -> dict:
    out = dict(meta)
    if not out.get("district"):
        match = DISTRICT_RE.search(text[:800] + " " + out.get("url", ""))
        if match:
            out["district"] = match.group(1)
    if not out.get("year"):
        match = YEAR_RE.search(out.get("url", "") + "\n" + text[:1200])
        if match:
            out["year"] = match.group(1)
    if not out.get("event"):
        out["event"] = f"{out.get('district', '')}分齡乒乓球比賽 {out.get('year', '')}".strip()
    return out


def parse_pdf(path: Path, meta: dict) -> tuple[list[dict], dict[str, dict], dict]:
    import pdfplumber

    chunks = []
    kind = meta.get("kind") or kind_from_url(meta.get("url") or "")
    places: dict[str, dict] = {}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
        if kind == "result":
            places = extract_result_places(pdf)
    text = "\n".join(chunks)
    meta = enrich_from_text(meta, text)
    ages = extract_group_ages(text)
    by_name: dict[str, dict] = {}
    for name, group in extract_names(text):
        by_name[name] = {"group": group}
    for name, info in places.items():
        row = by_name.setdefault(name, {"group": ""})
        if info.get("group"):
            row["group"] = info["group"]
        row["place"] = info["place"]
    records = []
    for name, info in by_name.items():
        group = info.get("group") or ""
        rec = {
            "name": name,
            "norm": normalize_name(name),
            "group": group,
            "district": meta.get("district") or "",
            "year": meta.get("year") or "",
            "kind": meta.get("kind") or kind_from_url(meta["url"]),
            "event": meta.get("event") or "",
            "url": meta["url"],
            **group_age_fields(group, ages),
        }
        if info.get("place"):
            rec["place"] = info["place"]
        records.append(rec)
    return records, ages, meta


def load_age_maps() -> dict:
    if not AGE_MAP_PATH.exists():
        return {"source": "", "maps": {}}
    try:
        data = json.loads(AGE_MAP_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"source": "", "maps": {}}
    data.setdefault("maps", {})
    return data


def put_age_map(maps: dict, key: str, groups: dict, source: str, overwrite: bool) -> None:
    if not key or not groups:
        return
    existing = maps.get(key)
    if existing and not overwrite:
        merged = dict(existing.get("groups") or {})
        for code, info in groups.items():
            merged.setdefault(code, info)
        existing["groups"] = merged
        return
    maps[key] = {"source": source, "groups": groups}


def apply_age_maps(players: dict, maps: dict) -> int:
    filled = 0
    for recs in players.values():
        for rec in recs:
            if rec.get("ageMin") is not None:
                continue
            groups = (maps.get(rec.get("url") or "") or {}).get("groups") or (
                maps.get(f"{rec.get('district', '')}|{rec.get('year', '')}") or {}
            ).get("groups")
            fields = group_age_fields(rec.get("group") or "", groups or {})
            if not fields:
                continue
            rec.update(fields)
            filled += 1
    return filled


def load_extra() -> list[dict]:
    if not EXTRA_PATH.exists():
        return []
    return json.loads(EXTRA_PATH.read_text(encoding="utf-8"))


def persist_extra(items: list[dict]) -> None:
    extra = load_extra()
    seen = {d.get("url") for d in extra}
    added = 0
    for item in items:
        url = item.get("url")
        if not url or url in seen:
            continue
        extra.append(
            {
                "url": url,
                "district": item.get("district") or "",
                "year": item.get("year") or "",
                "kind": item.get("kind") or kind_from_url(url),
                "event": item.get("event") or "",
            }
        )
        seen.add(url)
        added += 1
    if added:
        EXTRA_PATH.write_text(json.dumps(extra, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"stored {added} LCSD extra urls")


def main() -> None:
    import pdfplumber  # noqa: F401

    docs = fetch_listing()
    listing_urls = {d["url"] for d in docs}
    print(f"listing documents: {len(docs)}")
    extra = load_extra()
    seen = {d["url"] for d in docs}
    archived: list[dict] = []
    if archive_state.due("lcsdCdx", days=7):
        archived = discover_wayback()
        persist_extra(archived)
        archive_state.mark("lcsdCdx")
    else:
        print("skip Wayback CDX (ran within 7 days)")
    for item in extra + archived:
        url = item.get("url")
        if not url or url in seen:
            continue
        docs.append(item)
        seen.add(url)
        print(f"extra {url}")

    old = json.loads(OUT_PATH.read_text(encoding="utf-8")) if OUT_PATH.exists() else {}
    done_urls = {d.get("url") for d in (old.get("documents") or []) if d.get("url")}
    skip_urls = done_urls - listing_urls
    if skip_urls:
        print(f"skip {len(skip_urls)} already-parsed LCSD pdfs")

    players: dict[str, list[dict]] = defaultdict(list)
    parsed_docs = []
    age_bundle = load_age_maps()
    age_maps: dict = age_bundle.get("maps") or {}
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for i, meta in enumerate(docs, 1):
            url = meta["url"]
            if url in skip_urls:
                continue
            print(f"[{i}/{len(docs)}] {url}")
            body = get_pdf(url, referer=PORTAL_URL)
            if not body:
                print("  skip (no pdf)")
                continue
            path = tmp_dir / f"{i}.pdf"
            path.write_bytes(body)
            try:
                records, ages, parsed_meta = parse_pdf(path, meta)
            except Exception as exc:  # noqa: BLE001
                print(f"  parse error: {exc}")
                continue
            kind = parsed_meta.get("kind") or kind_from_url(url)
            district = parsed_meta.get("district") or ""
            year = parsed_meta.get("year") or ""
            parsed_docs.append(
                {
                    "url": url,
                    "district": district,
                    "year": year,
                    "kind": kind,
                    "names": len(records),
                    "ageCodes": len(ages),
                }
            )
            print(f"  names {len(records)} age-codes {len(ages)}")
            if ages:
                overwrite = kind == "prospectus"
                put_age_map(age_maps, url, ages, kind, overwrite)
                put_age_map(age_maps, f"{district}|{year}", ages, kind, overwrite)
            for rec in records:
                row = {
                    "name": rec["name"],
                    "district": rec["district"],
                    "year": rec["year"],
                    "kind": rec["kind"],
                    "group": rec["group"],
                    "event": rec["event"],
                    "url": rec["url"],
                }
                if rec.get("place"):
                    row["place"] = rec["place"]
                if "ageMin" in rec:
                    row["ageMin"] = rec["ageMin"]
                    row["ageMax"] = rec["ageMax"]
                    row["doubles"] = rec["doubles"]
                players[rec["norm"]].append(row)

    prev_count = None
    if old:
        prev_count = old.get("count")
        if prev_count is None:
            prev_count = len(old.get("players") or {})
        current_urls = {d["url"] for d in parsed_docs}
        kept = 0
        for doc in old.get("documents", []):
            url = doc.get("url")
            if url and url not in current_urls:
                parsed_docs.append(doc)
                current_urls.add(url)
        for name, recs in (old.get("players") or {}).items():
            existing = {(r.get("url"), r.get("group"), r.get("year")) for r in players.get(name, [])}
            for rec in recs:
                key = (rec.get("url"), rec.get("group"), rec.get("year"))
                if rec.get("url") and key not in existing:
                    players[name].append(rec)
                    existing.add(key)
                    kept += 1
        print(f"kept {kept} historical LCSD name rows")

    filled = apply_age_maps(players, age_maps)
    print(f"filled ages from maps: {filled}")
    age_bundle["maps"] = age_maps
    age_bundle["updated"] = datetime.now(HKT).strftime("%Y-%m-%d %H:%M")
    AGE_MAP_PATH.write_text(json.dumps(age_bundle, ensure_ascii=False, indent=2), encoding="utf-8")

    payload = {
        "source": "康樂及文化事務署地區分齡乒乓球比賽（賽程表／成績 PDF）",
        "sourceUrl": PORTAL_URL,
        "updated": datetime.now(HKT).strftime("%Y-%m-%d %H:%M"),
        "count": len(players),
        "prevCount": prev_count,
        "documents": parsed_docs,
        "players": players,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes, {len(players)} names)")


def refresh_result_places() -> None:
    """Re-read existing result PDFs and stamp champion/runner-up place onto records."""
    import pdfplumber

    if not OUT_PATH.exists():
        print("missing lcsd.json")
        return
    data = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    urls: list[str] = []
    seen: set[str] = set()
    for recs in (data.get("players") or {}).values():
        for rec in recs or []:
            if rec.get("kind") != "result":
                continue
            url = rec.get("url") or ""
            if url and url not in seen:
                seen.add(url)
                urls.append(url)
    print(f"result pdfs: {len(urls)}")
    url_places: dict[str, dict[str, dict]] = {}
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] {url}")
            body = get_pdf(url, referer=PORTAL_URL)
            if not body:
                print("  skip (no pdf)")
                continue
            path = tmp_dir / f"{i}.pdf"
            path.write_bytes(body)
            try:
                with pdfplumber.open(path) as pdf:
                    url_places[url] = extract_result_places(pdf)
            except Exception as exc:  # noqa: BLE001
                print(f"  parse error: {exc}")
                continue
            print(f"  placed {len(url_places[url])}")

    updated = 0
    filled_group = 0
    for key, recs in (data.get("players") or {}).items():
        for rec in recs or []:
            places = url_places.get(rec.get("url") or "") or {}
            by_norm = {normalize_name(name): info for name, info in places.items()}
            info = by_norm.get(normalize_name(rec.get("name") or "")) or by_norm.get(key)
            if not info:
                continue
            if rec.get("place") != info["place"]:
                rec["place"] = info["place"]
                updated += 1
            elif "place" not in rec:
                rec["place"] = info["place"]
                updated += 1
            if info.get("group") and not rec.get("group"):
                rec["group"] = info["group"]
                filled_group += 1

    data["updated"] = datetime.now(HKT).strftime("%Y-%m-%d %H:%M")
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"stamped place on {updated} rows, filled group {filled_group}")


if __name__ == "__main__":
    if "--places" in sys.argv:
        refresh_result_places()
    else:
        main()
