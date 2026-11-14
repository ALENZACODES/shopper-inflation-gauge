# Shopper Inflation Gauge

See a 12-month inflation rate that uses your own monthly spending and official Statistics Canada prices.

You enter typical monthly amounts in the eight major CPI product groups. The page weights each group's published 12-month change by your share of spending, then places that personal rate next to the official all-items rate for Ontario or Canada. The two groups that add the most to your rate are highlighted. Official 2025 basket weights are shown for comparison.

Built for ML Empowerment Build Challenge 4.0 (solo entry by John Khan, Toronto, Ontario).

Live demo: https://alenzacodes.github.io/shopper-inflation-gauge/

## Features

- Ontario or Canada official prices, not seasonally adjusted, 2002=100
- Latest bundled month: September 2026
- Personal weighted rate, official all-items rate, and the gap between them
- Category table with your share, the official basket share, and each group's contribution
- Toronto all-items rate shown only as context, because the city series has no eight-group split in this table
- A ridge regression trained in the browser on five years of price changes, which learns each group's weight in the all-items rate and is scored on the last 12 months it never saw
- A labelled demo month that is not a real household
- No accounts and no invented index values

## Run locally

From this folder:

```bash
python3 -m http.server 8080 --directory site
```

Open http://localhost:8080/.

## Tests

```bash
node tests/test_cpi.mjs
node tests/test_model.mjs
```

Checks the bundled September 2026 indexes and 12-month changes against the official extract, and checks that basket weights sum to 100.

## Refresh the model data

```bash
python3 scripts/fetch_history.py
```

Downloads 72 months of index values for the eight groups and all-items (October 2020 to September 2026 in the saved copy) into `site/data/cpi-history.json`.

## Data sources

- Statistics Canada table 18-10-0004-01, Consumer Price Index, monthly, not seasonally adjusted: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401
- Statistics Canada table 18-10-0007-01, Basket weights of the Consumer Price Index: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000701

CSV packages were downloaded on 9 November 2026, America/Toronto, through the Statistics Canada Web Data Service. The CPI zip's last-modified time was 19 October 2026, 12:30 UTC, and the table metadata lists an end reference period of 2026-09-01. Basket weights are the 2025 weights at basket link month prices, with distribution to selected geographies.

Every bundled index and basket weight was checked again against the Statistics Canada Web Data Service on 13 November 2026, America/Toronto, and all values matched.

Twelve-month change is (index this month divided by the index 12 months earlier, minus 1), times 100, rounded to two decimal places for display.

## Deploy

A GitHub Actions workflow in `.github/workflows/pages.yml` runs the tests and publishes `site/` to GitHub Pages on every push to `main`.

## Stack

HTML, CSS and JavaScript. No build step. Deep blue `#011F5B` and deep red `#990000` on white.

## License

MIT. See `LICENSE`.
