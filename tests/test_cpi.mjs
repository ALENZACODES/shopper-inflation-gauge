import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cpi = JSON.parse(readFileSync(join(root, "site/data/cpi.json"), "utf8"));

let failed = 0;
function eq(name, a, b) {
  const ok = a === b || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9);
  if (!ok) {
    failed += 1;
    console.error("FAIL", name, "got", a, "expected", b);
  } else console.log("ok", name);
}
function close(name, a, b, tol = 0.005) {
  if (Math.abs(a - b) > tol) {
    failed += 1;
    console.error("FAIL", name, "got", a, "expected", b);
  } else console.log("ok", name);
}

eq("latest month", cpi.latest_month, "2026-09");
eq("Canada all items yoy", cpi.geographies.Canada.all_items.latest_yoy, 3.09);
eq("Ontario all items yoy", cpi.geographies.Ontario.all_items.latest_yoy, 2.53);
eq("Toronto all items yoy", cpi.toronto_all_items.latest_yoy, 2.08);
eq("Canada index", cpi.geographies.Canada.all_items.latest_index, 170);
eq("Canada prior", cpi.geographies.Canada.all_items.prior_index, 164.9);

// Recalc yoy from indexes
const can = cpi.geographies.Canada.all_items;
const yoy = (can.latest_index / can.prior_index - 1) * 100;
close("Canada yoy from indexes", can.latest_yoy, Math.round(yoy * 100) / 100);

const ontW = cpi.geographies.Ontario.categories.reduce((s, c) => s + c.weight_2025, 0);
close("Ontario weights sum to 100", ontW, 100, 0.011);
const canW = cpi.geographies.Canada.categories.reduce((s, c) => s + c.weight_2025, 0);
close("Canada weights sum to 100", canW, 100, 0.011);

// Equal spend should equal the spend-weighted mean of category yoys, not necessarily official all-items
const cats = cpi.geographies.Ontario.categories;
const equal = Object.fromEntries(cats.map((c) => [c.id, 100]));
const total = 100 * cats.length;
const personal = cats.reduce((s, c) => s + (100 / total) * c.latest_yoy, 0);
// Transportation was the high one in Ontario
const trans = cats.find((c) => c.id === "Transportation");
eq("Ontario transport yoy", trans.latest_yoy, 8.64);

// Demo sample contribution order
const sample = {
  "Food": 650,
  "Shelter": 1800,
  "Household operations, furnishings and equipment": 200,
  "Clothing and footwear": 80,
  "Transportation": 400,
  "Health and personal care": 120,
  "Recreation, education and reading": 150,
  "Alcoholic beverages, tobacco products and recreational cannabis": 40
};
const sum = Object.values(sample).reduce((s, n) => s + n, 0);
const rows = cats.map((c) => ({
  id: c.id,
  contribution: (sample[c.id] / sum) * c.latest_yoy
}));
const rate = rows.reduce((s, r) => s + r.contribution, 0);
const top = rows.slice().sort((a, b) => b.contribution - a.contribution).slice(0, 2).map((r) => r.id);
console.log("demo personal rate", rate.toFixed(4), "top", top);
eq("top 1 shelter or transport", top.includes("Shelter") || top.includes("Transportation"), true);
if (rate <= 0 || rate > 20) {
  failed += 1;
  console.error("FAIL rate out of range", rate);
} else console.log("ok rate in range");

if (!cpi.index_table.url.includes("1810000401")) {
  failed += 1;
  console.error("FAIL missing index url");
} else console.log("ok index url");

if (failed) {
  console.error(failed, "failed");
  process.exit(1);
}
console.log("all cpi tests passed");
