# 香港乒乓球排名查詢

Static site: paste a list of Chinese names and look them up against published Hong Kong table tennis records.

Live: [https://henrylok0.github.io/HongKong-TableTable/](https://henrylok0.github.io/HongKong-TableTable/)

## What it matches

| Source | Script | Snapshot |
| --- | --- | --- |
| HKTTA computer ranking PDFs (points, official rank, U-groups, club / school / coach) | `scripts/fetch_rankings.py` | `data/rankings.json` |
| LCSD district age-group schedule / result PDFs | `scripts/fetch_lcsd.py` | `data/lcsd.json`, `data/lcsd_age_maps.json` |
| Hang Seng public badge-exam timetables (and result PDFs for pass/fail) | `scripts/fetch_badges.py` | `data/badges.json` |
| HKSSF / HKTTA open events / Hong Kong Games result PDFs | `scripts/fetch_comp.py` | `data/comp.json` |

The browser only reads those JSON files. It does not scrape HKTTA / LCSD / HSTTA at runtime.

LCSD filenames change every year. The listing is [地區分齡比賽](https://www.lcsd.gov.hk/clpss/tc/webApp/Dagc.do) (filter 乒乓球). Older PDFs still online can be added to `data/lcsd_extra_urls.json`. Previous LCSD names are kept when the portal only lists the current year.

## Local

```bash
pip install -r requirements.txt
python scripts/fetch_rankings.py
python scripts/fetch_lcsd.py
python scripts/fetch_badges.py
python scripts/fetch_comp.py
python -m http.server 8080
```

Open `http://localhost:8080`.

## GitHub Pages

Settings → Pages → Deploy from a branch → `main` / `/ (root)`.

After each push, hard-refresh the live site (CSS/JS are cache-busted with `?v=` in `index.html`).

## Auto update

`.github/workflows/update-rankings.yml` runs daily at **10:00 HKT** (`cron: 0 2 * * *` UTC) and on **Actions → Update ranking data → Run workflow**.

The job re-downloads the latest published PDFs and commits `data/rankings.json`, `data/lcsd.json`, `data/lcsd_age_maps.json`, `data/badges.json`, and `data/comp.json` if they changed.

Older HKSSF / open / Hong Kong Games PDFs can be added to `data/comp_extra_urls.json`.

That is a **daily check**, not a daily new ranking. HKTTA lists are issued by period (期); LCSD and badge PDFs appear when those events are published. GitHub may delay or skip scheduled workflows on inactive repos.

Required:

1. Settings → Actions → General → Workflow permissions → **Read and write**.
2. Keep Actions enabled on the default branch.

LCSD, badge, and competition-result fetches use `continue-on-error` so a broken PDF listing does not block the HKTTA snapshot.
