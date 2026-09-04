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
3. Site URL: `https://<user>.github.io/HongKong-TableTable/`

Enable **Actions** write permission if you want weekly ranking updates (`.github/workflows/update-rankings.yml`).
