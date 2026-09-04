# HongKong-TableTable

Paste a list of names. The app looks them up against:

- HKTTA published ranking PDFs (`scripts/fetch_rankings.py`)
- LCSD district age-group table tennis schedule/result PDFs (`scripts/fetch_lcsd.py`)

LCSD document filenames change every year. The listing portal is [地區分齡比賽](https://www.lcsd.gov.hk/clpss/tc/webApp/Dagc.do) (filter 乒乓球). Older PDFs that are still online can be added to `data/lcsd_extra_urls.json`.

## Local

```bash
pip install -r requirements.txt
python scripts/fetch_rankings.py
python scripts/fetch_lcsd.py
python -m http.server 8080
```

Open `http://localhost:8080`.

## GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Deploy from a branch → `main` / `/ (root)`.
3. Site URL: `https://henrylok0.github.io/HongKong-TableTable/`

## Auto update

GitHub Pages is static, so the site cannot scrape HKTTA/LCSD in the browser. `.github/workflows/update-rankings.yml` runs every day at 10:00 HKT (`cron: 0 2 * * *`) and on manual **Actions → Update ranking data → Run workflow**.

Required on GitHub:

1. Settings → Actions → General → Workflow permissions → **Read and write**.
2. Keep Actions enabled on the default branch. Scheduled workflows only run after the file is on that branch.
3. First push of this workflow, then optionally run it once by hand to confirm.

The job downloads the latest HKTTA ranking PDFs and LCSD table tennis PDFs, writes `data/rankings.json` and `data/lcsd.json`, and commits if they changed. Old LCSD documents are kept so history is not wiped when the listing page only shows the current year.
