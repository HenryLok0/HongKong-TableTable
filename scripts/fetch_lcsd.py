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
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data" / "lcsd.json"
EXTRA_PATH = ROOT / "data" / "lcsd_extra_urls.json"
SEARCH_URL = "https://www.lcsd.gov.hk/clpss/tc/search/common/searchResult.do"
PORTAL_URL = "https://www.lcsd.gov.hk/clpss/tc/webApp/Dagc.do"
HKT = timezone(timedelta(hours=8))
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

VARIANT = str.maketrans({"鸣": "鳴", "证": "証", "杰": "傑", "启": "啟", "升": "陞", "恒": "恆"})
NAME_RE = re.compile(r"[\u4e00-\u9fff]{2,4}")
NUMBERED_NAME_RE = re.compile(r"(?:^|[^\u4e00-\u9fff])(\d{1,3})\s*([\u4e00-\u9fff]{2,4})(?:\s+|$)")
GROUP_RE = re.compile(r"\b([MF][A-Z]{1,2}\d?)\b")
YEAR_RE = re.compile(r"(20\d{2})")
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
    return re.sub(r"\s+", "", name).translate(VARIANT)


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
            if kind not in {"schedule", "result"}:
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
    payload = urllib.parse.urlencode(
        {
            "searchFormPath": "/webApp/Dagc",
            "act": "060",
            "dist": "ALL",
            "pageNo": "1",
            "sortField": "",
            "sortOrder": "",
        }
    ).encode()
    code, body = http_request(SEARCH_URL, payload)
    if code != 200:
        print(f"listing failed ({code})")
        return []
    html = body.decode("utf-8", errors="replace")
    return parse_listing_html(html)


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


def parse_pdf(path: Path, meta: dict) -> list[dict]:
    import pdfplumber

    chunks = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
    text = "\n".join(chunks)
    meta = enrich_from_text(meta, text)
    records = []
    for name, group in extract_names(text):
        records.append(
            {
                "name": name,
                "norm": normalize_name(name),
                "group": group,
                "district": meta.get("district") or "",
                "year": meta.get("year") or "",
                "kind": meta.get("kind") or kind_from_url(meta["url"]),
                "event": meta.get("event") or "",
                "url": meta["url"],
            }
        )
    return records


def load_extra() -> list[dict]:
    if not EXTRA_PATH.exists():
        return []
    return json.loads(EXTRA_PATH.read_text(encoding="utf-8"))


def main() -> None:
    import pdfplumber  # noqa: F401

    docs = fetch_listing()
    print(f"listing documents: {len(docs)}")
    extra = load_extra()
    seen = {d["url"] for d in docs}
    for item in extra:
        if item["url"] not in seen:
            docs.append(item)
            seen.add(item["url"])
            print(f"extra {item['url']}")

    players: dict[str, list[dict]] = defaultdict(list)
    parsed_docs = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for i, meta in enumerate(docs, 1):
            url = meta["url"]
            print(f"[{i}/{len(docs)}] {url}")
            code, body = http_request(url)
            if code != 200 or not body.startswith(b"%PDF"):
                print(f"  skip ({code})")
                continue
            path = tmp_dir / f"{i}.pdf"
            path.write_bytes(body)
            try:
                records = parse_pdf(path, meta)
            except Exception as exc:  # noqa: BLE001
                print(f"  parse error: {exc}")
                continue
            parsed_docs.append(
                {
                    "url": url,
                    "district": meta.get("district") or "",
                    "year": meta.get("year") or "",
                    "kind": meta.get("kind") or kind_from_url(url),
                    "names": len(records),
                }
            )
            print(f"  names {len(records)}")
            for rec in records:
                players[rec["norm"]].append(
                    {
                        "name": rec["name"],
                        "district": rec["district"],
                        "year": rec["year"],
                        "kind": rec["kind"],
                        "group": rec["group"],
                        "event": rec["event"],
                        "url": rec["url"],
                    }
                )

    if OUT_PATH.exists():
        old = json.loads(OUT_PATH.read_text(encoding="utf-8"))
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

    payload = {
        "source": "康樂及文化事務署地區分齡乒乓球比賽（賽程表／成績 PDF）",
        "sourceUrl": PORTAL_URL,
        "updated": datetime.now(HKT).strftime("%Y-%m-%d %H:%M"),
        "documents": parsed_docs,
        "players": players,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes, {len(players)} names)")


if __name__ == "__main__":
    main()
