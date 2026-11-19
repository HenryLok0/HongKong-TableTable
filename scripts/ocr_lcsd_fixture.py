"""OCR a scanned LCSD fixture PDF and store the player names as schedule rows.

The Eastern 2026 draw is a scanned bracket. Text extraction returns nothing,
so names are read from the left-hand player column of each page.
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

import pymupdf
from rapidocr import RapidOCR

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_lcsd as lcsd  # noqa: E402
from build_lookup_index import shard_id  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.lcsd.gov.hk/ls/dagc/clpss/prop/b5/2_sch_b5_Result_of_Fixture_Draw_2026.pdf"
USER_AGENT = "Mozilla/5.0"
def group_from_title(texts: list[str]) -> str:
    # Headers look like "MA組", "MA (55歲或以上)", or "先進(FB 組)".
    title = " ".join(texts)
    for pattern in (
        r"\(([A-Z]{2,3})\s*組\)",
        r"([A-Z]{2,3})\s*組",
        r"([A-Z]{2,3})\.?\s*[(（]",
        r"([A-Z]{2,3})賽程",
    ):
        match = re.search(pattern, title)
        if match:
            return match.group(1)
    return ""
HAN_RE = re.compile(r"^[\u4e00-\u9fff]{2,4}$")
# First-round names sit on the left. Later-round boxes are match codes such as "MA 25".
NAME_COLUMN = 0.32


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    dest.write_bytes(urllib.request.urlopen(req, timeout=60).read())


def page_names(ocr: RapidOCR, page, zoom: float = 2.0, left_only: bool = True) -> tuple[str, list[tuple[str, float]], str]:
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
    width = pix.width
    height = pix.height
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
        image_path = Path(handle.name)
    pix.save(image_path)
    try:
        output = ocr(str(image_path))
    finally:
        image_path.unlink(missing_ok=True)
    txts = [] if output.txts is None else list(output.txts)
    boxes = [] if output.boxes is None else list(output.boxes)
    scores = [] if output.scores is None else list(output.scores)
    header = []
    for text, box in zip(txts, boxes):
        if float(box[0][1]) <= height * 0.22:
            header.append(str(text))
    group = group_from_title(header or txts[:12])
    title = " ".join(header or txts[:12])
    doubles = "雙打" in title or bool(re.match(r"^[MF]([KLM]|D)", group))
    found: list[tuple[str, float]] = []
    for text, box, score in zip(txts, boxes, scores):
        if float(score) < 0.8:
            continue
        left = float(box[0][0])
        # Fixture brackets put the players on the left. Result sheets use the whole page.
        if left_only and left > width * NAME_COLUMN:
            continue
        for name in split_names(str(text), doubles):
            if lcsd.is_person_name(name):
                found.append((name, float(score)))
    if "混合" in title:
        style = "mixed"
    elif "雙打" in title:
        style = "doubles"
    else:
        style = ""
    return group, found, style


def split_names(text: str, doubles: bool) -> list[str]:
    text = text.replace("*", "").replace("＊", "")
    text = re.sub(r"\s+", "", text)
    if HAN_RE.fullmatch(text):
        return [text]
    if not doubles or not re.fullmatch(r"[\u4e00-\u9fff]{4,8}", text):
        return []
    for cut in (2, 3, 4):
        left, right = text[:cut], text[cut:]
        if lcsd.is_person_name(left) and lcsd.is_person_name(right):
            return [left, right]
    return []


def ocr_fixture(path: Path, left_only: bool = True) -> dict[str, set[str]]:
    doc = pymupdf.open(path)
    try:
        ocr = RapidOCR()
        by_group: dict[str, set[str]] = {}
        mixed_groups: set[str] = set()
        doubles_groups: set[str] = set()
        for index, page in enumerate(doc, 1):
            group, names, style = page_names(ocr, page, left_only=left_only)
            if group and style == "mixed":
                mixed_groups.add(group)
            elif group and style == "doubles":
                doubles_groups.add(group)
            bucket = by_group.setdefault(group or "?", set())
            before = len(bucket)
            bucket.update(name for name, _score in names)
            print(f"page {index:02d} {group or '?':4} +{len(bucket) - before:3} total {len(bucket)}", flush=True)
        ocr_fixture.mixed_groups = mixed_groups
        ocr_fixture.doubles_groups = doubles_groups
        return by_group
    finally:
        doc.close()


def store(by_group: dict[str, set[str]]) -> None:
    data = json.loads(lcsd.OUT_PATH.read_text(encoding="utf-8"))
    players: dict[str, list] = data.setdefault("players", {})
    ages = (lcsd.load_age_maps().get("maps") or {}).get("東區|2026", {}).get("groups") or {}
    event = "東區分齡乒乓球比賽 2026"
    added = 0
    for group, names in by_group.items():
        if group == "?":
            continue
        for name in sorted(names):
            key = lcsd.normalize_name(name)
            rows = players.setdefault(key, [])
            if any(row.get("url") == URL and row.get("group") == group for row in rows):
                continue
            row = {
                "name": name,
                "district": "東區",
                "year": "2026",
                "kind": "schedule",
                "group": group,
                "event": event,
                "url": URL,
            }
            fields = lcsd.group_age_fields(group, ages)
            # MX / FX / OX brackets are doubles even when the prospectus age map missed that.
            if "X" in group:
                fields["doubles"] = True
            row.update(fields)
            rows.append(row)
            added += 1
    for doc in data.get("documents") or []:
        if doc.get("url") == URL:
            doc["district"] = "東區"
            doc["year"] = "2026"
            doc["kind"] = "schedule"
            doc["names"] = sum(
                1
                for rows in players.values()
                for row in rows
                if row.get("url") == URL
            )
            break
    data["updated"] = lcsd.datetime.now(lcsd.HKT).strftime("%Y-%m-%d %H:%M")
    lcsd.OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    patch_shards(players, by_group)
    print(f"stored {added} new rows")


def patch_shards(players: dict, by_group: dict[str, set[str]]) -> None:
    names = {lcsd.normalize_name(name) for names in by_group.values() for name in names}
    shards: dict[str, dict] = {}
    shard_dir = ROOT / "data" / "idx" / "s"
    for name in names:
        sid = shard_id(name)
        if sid not in shards:
            path = shard_dir / f"{sid}.json"
            shards[sid] = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        shards[sid].setdefault(name, {})["l"] = players.get(name) or []
    for sid, payload in shards.items():
        path = shard_dir / f"{sid}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"patched {len(shards)} lookup shards")


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "fixture.pdf"
        print(f"download {URL}", flush=True)
        download(URL, path)
        by_group = ocr_fixture(path)
    known = by_group.get("?", set())
    print("groups", {group: len(names) for group, names in sorted(by_group.items())})
    target = "駱俊亨"
    hits = [group for group, names in by_group.items() if target in names]
    print(f"{target}: {hits or 'not found'}")
    if known:
        print(f"ungrouped names {len(known)}")
    store(by_group)


if __name__ == "__main__":
    main()
