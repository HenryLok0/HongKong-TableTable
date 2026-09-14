"""Shared HTTP helpers for public PDF / HTML fetches."""

from __future__ import annotations

import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


def ssl_context() -> ssl.SSLContext:
    return ssl.create_default_context()


def http_get(url: str, referer: str = "", timeout: int = 45) -> tuple[int, bytes]:
    url = url.replace(" ", "%20")
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ssl_context(), timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read() if exc.fp else b""
    except Exception:  # noqa: BLE001
        return 0, b""


def pdf_complete(body: bytes) -> bool:
    return body.startswith(b"%PDF") and b"%%EOF" in body[-4096:]


def get_pdf(url: str, referer: str = "", wayback: bool = True) -> bytes | None:
    code, body = http_get(url, referer=referer, timeout=90)
    if code == 200 and pdf_complete(body):
        return body
    if wayback:
        archived = wayback_pdf(url)
        if archived and pdf_complete(archived):
            return archived
        if archived and archived.startswith(b"%PDF") and (not body or len(archived) > len(body)):
            return archived
    if code == 200 and body.startswith(b"%PDF"):
        return body
    return None


def wayback_pdf(url: str) -> bytes | None:
    query = urllib.parse.urlencode(
        {
            "url": url,
            "output": "json",
            "fl": "timestamp,original,statuscode",
            "filter": "statuscode:200",
            "limit": "5",
        }
    )
    code, body = http_get("https://web.archive.org/cdx/search/cdx?" + query)
    if code != 200 or not body:
        return None
    try:
        rows = json_rows(body)
    except Exception:  # noqa: BLE001
        return None
    for row in rows:
        ts = row[0]
        original = row[1] if len(row) > 1 else url
        snapshot = f"https://web.archive.org/web/{ts}id_/{original}"
        got, data = http_get(snapshot, timeout=90)
        if got == 200 and data.startswith(b"%PDF"):
            return data
    return None


def json_rows(body: bytes) -> list[list[str]]:
    import json

    data = json.loads(body.decode("utf-8", errors="replace"))
    if not isinstance(data, list) or len(data) < 2:
        return []
    return [row for row in data[1:] if isinstance(row, list)]


def cdx_prefix(prefix: str, limit: int = 20000) -> list[tuple[str, str]]:
    """Return (timestamp, original_url) for 200 responses under a URL prefix."""
    query = urllib.parse.urlencode(
        {
            "url": prefix,
            "matchType": "prefix",
            "output": "json",
            "fl": "timestamp,original,mimetype,statuscode",
            "filter": "statuscode:200",
            "collapse": "urlkey",
            "limit": str(limit),
        }
    )
    url = "https://web.archive.org/cdx/search/cdx?" + query
    code, body = 0, b""
    for attempt in range(4):
        code, body = http_get(url, timeout=25)
        if code == 200 and body:
            break
        time.sleep(2 * (attempt + 1))
    if code != 200 or not body:
        print(f"cdx failed {prefix} ({code})")
        return []
    out: list[tuple[str, str]] = []
    try:
        rows = json_rows(body)
    except Exception as exc:  # noqa: BLE001
        print(f"cdx parse failed {prefix}: {exc}")
        return []
    for row in rows:
        if len(row) < 2:
            continue
        ts, original = row[0], row[1]
        mime = row[2].lower() if len(row) > 2 else ""
        if mime and "pdf" not in mime and "html" not in mime:
            continue
        out.append((ts, original))
    return out
