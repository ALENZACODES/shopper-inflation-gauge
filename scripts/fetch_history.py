"""Download monthly CPI index history for the eight major groups and all-items.

Run from the repo root: python3 scripts/fetch_history.py
Uses the Statistics Canada Web Data Service and the vector ids in site/data/cpi.json.
"""
import json
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

MONTHS = 72  # 60 twelve-month changes need 72 index values
WDS = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods"

cpi = json.load(open("site/data/cpi.json"))
wanted = []
for geo, g in cpi["geographies"].items():
    wanted.append((geo, "All-items", g["all_items"]["index_vector"]))
    for c in g["categories"]:
        wanted.append((geo, c["id"], c["index_vector"]))

body = json.dumps([{"vectorId": int(v[1:]), "latestN": MONTHS} for _, _, v in wanted]).encode()
req = urllib.request.Request(WDS, data=body, headers={"Content-Type": "application/json"})
res = json.load(urllib.request.urlopen(req, timeout=60))

out = {
    "source": "Statistics Canada table 18-10-0004-01, Web Data Service",
    "retrieved": datetime.now(ZoneInfo("America/Toronto")).strftime("%Y-%m-%d"),
    "retrieved_zone": "America/Toronto",
    "geographies": {},
}
for (geo, cid, vec), r in zip(wanted, res):
    pts = r["object"]["vectorDataPoint"]
    g = out["geographies"].setdefault(geo, {"months": [p["refPer"][:7] for p in pts], "series": {}})
    assert g["months"] == [p["refPer"][:7] for p in pts], (geo, cid)
    g["series"][cid] = {"vector": vec, "index": [p["value"] for p in pts]}

with open("site/data/cpi-history.json", "w") as f:
    json.dump(out, f, separators=(",", ":"))
    f.write("\n")
for geo, g in out["geographies"].items():
    print(geo, g["months"][0], g["months"][-1], len(g["months"]), list(g["series"])[:3])
