import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const M = require(join(root, "site/model.js"));
const cpi = JSON.parse(readFileSync(join(root, "site/data/cpi.json"), "utf8"));
const hist = JSON.parse(readFileSync(join(root, "site/data/cpi-history.json"), "utf8"));

let failed = 0;
function check(name, ok, info = "") {
  if (!ok) { failed += 1; console.error("FAIL", name, info); } else console.log("ok", name);
}

// Solver on a known system
const x = M.solve([[2, 1], [1, 3]], [3, 5]);
check("solve 2x2", Math.abs(x[0] - 0.8) < 1e-12 && Math.abs(x[1] - 1.4) < 1e-12, x);

// Ridge with lambda 0 recovers exact weights on synthetic data
const Xs = [[1, 0], [0, 1], [1, 1], [2, 1]];
const ys = Xs.map((r) => 0.3 * r[0] + 0.7 * r[1]);
const ws = M.fitRidge(Xs, ys, 0);
check("ridge recovers weights", Math.abs(ws[0] - 0.3) < 1e-9 && Math.abs(ws[1] - 0.7) < 1e-9, ws);

for (const geo of ["Ontario", "Canada"]) {
  const h = hist.geographies[geo];
  check(geo + " history ends at latest month", h.months.at(-1) === cpi.latest_month, h.months.at(-1));
  check(geo + " 72 months", h.months.length === 72);
  // History agrees with the bundled latest and prior index values
  const g = cpi.geographies[geo];
  check(geo + " all-items latest matches", h.series["All-items"].index.at(-1) === g.all_items.latest_index);
  check(geo + " all-items prior matches", h.series["All-items"].index.at(-13) === g.all_items.prior_index);
  for (const c of g.categories) {
    const s = h.series[c.id].index;
    check(geo + " " + c.id + " latest matches", s.at(-1) === c.latest_index && s.at(-13) === c.prior_index);
  }
  const ids = g.categories.map((c) => c.id);
  const m = M.learnWeights(h, ids, { lambda: 1, holdout: 12 });
  const sum = m.weights.reduce((s, w) => s + w, 0);
  check(geo + " learned weights sum near 1", Math.abs(sum - 1) < 0.05, sum);
  check(geo + " holdout error under 0.2 points", m.testMAE < 0.2, m.testMAE);
  check(geo + " test window is the last 12 months", m.testMonths[1] === cpi.latest_month && m.testPred.length === 12);
  // Shelter should get the largest learned weight, as in the official basket
  const top = ids[m.weights.indexOf(Math.max(...m.weights))];
  check(geo + " shelter has the largest learned weight", top === "Shelter", top);
  console.log(geo, "MAE", m.testMAE.toFixed(3), "weights", m.weights.map((w) => (w * 100).toFixed(1)).join(" "));
}

if (failed) { console.error(failed, "failed"); process.exit(1); }
console.log("all model tests passed");
