let cpi = null;

const SAMPLE = {
  label: "Labelled demo month, not a real household",
  amounts: {
    "Food": 650,
    "Shelter": 1800,
    "Household operations, furnishings and equipment": 200,
    "Clothing and footwear": 80,
    "Transportation": 400,
    "Health and personal care": 120,
    "Recreation, education and reading": 150,
    "Alcoholic beverages, tobacco products and recreational cannabis": 40
  }
};

function money(n) {
  return n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(n) {
  if (n === null || Number.isNaN(n)) return "n/a";
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}

function readAmounts(cats) {
  const out = {};
  for (const c of cats) {
    const raw = document.getElementById("spend-" + c.id).value;
    const n = raw === "" ? 0 : Number(raw);
    out[c.id] = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return out;
}

function compute(geoName, amounts) {
  const geo = cpi.geographies[geoName];
  const cats = geo.categories;
  const total = cats.reduce((s, c) => s + (amounts[c.id] || 0), 0);
  const rows = cats.map((c) => {
    const spend = amounts[c.id] || 0;
    const share = total > 0 ? spend / total : 0;
    const yoy = c.latest_yoy;
    const contribution = yoy === null ? 0 : share * yoy;
    return {
      id: c.id,
      label: c.label,
      official_name: c.official_name,
      spend,
      share,
      official_weight: c.weight_2025,
      yoy,
      contribution,
      vector: c.index_vector
    };
  });
  const personal = total > 0 ? rows.reduce((s, r) => s + r.contribution, 0) : null;
  const hurt = rows
    .filter((r) => r.spend > 0)
    .slice()
    .sort((a, b) => b.contribution - a.contribution);
  return {
    total,
    personal,
    official: geo.all_items.latest_yoy,
    official_index: geo.all_items.latest_index,
    official_prior: geo.all_items.prior_index,
    month: cpi.latest_month,
    rows,
    top: hurt.slice(0, 2)
  };
}

function renderFields(geoName) {
  const cats = cpi.geographies[geoName].categories;
  const box = document.getElementById("spend-fields");
  box.innerHTML = cats
    .map(
      (c) => `<div>
        <label for="spend-${c.id}">${c.label}</label>
        <input id="spend-${c.id}" type="number" min="0" step="0.01" value="" inputmode="decimal" />
        <p class="hint">Official name: ${c.official_name}. 12-month change to ${cpi.latest_month}: ${pct(c.latest_yoy)}.</p>
      </div>`
    )
    .join("");
  box.querySelectorAll("input").forEach((el) => el.addEventListener("input", () => {
    const amounts = readAmounts(cats);
    const total = Object.values(amounts).reduce((s, n) => s + n, 0);
    document.getElementById("total").textContent = money(total);
  }));
}

function renderResult(geoName, amounts, usedSample) {
  const out = compute(geoName, amounts);
  document.getElementById("total").textContent = money(out.total);
  const kpis = document.getElementById("kpis");
  if (out.total <= 0) {
    kpis.innerHTML = "";
    document.getElementById("story").textContent = "Enter at least one monthly amount to get a personal rate.";
    document.querySelector("#table tbody").innerHTML = "";
    return out;
  }
  const gap = out.personal - out.official;
  kpis.innerHTML = `
    <div class="box"><div class="lbl">Your weighted 12-month change</div><div class="num">${pct(out.personal)}</div></div>
    <div class="box"><div class="lbl">Official all-items, ${geoName}, ${out.month}</div><div class="num">${pct(out.official)}</div></div>
    <div class="box"><div class="lbl">Difference (your rate minus official)</div><div class="num">${pct(gap)}</div></div>`;
  const topBits = out.top
    .map((r) => `${r.label} (${pct(r.yoy)}, adding ${pct(r.contribution)})`)
    .join(", and ");
  const sampleLine = usedSample ? " The amounts used are the labelled demo month, not a real household." : "";
  const compare =
    gap > 0.005
      ? `That is higher than the published all-items rate of ${pct(out.official)} for ${geoName}.`
      : gap < -0.005
        ? `That is lower than the published all-items rate of ${pct(out.official)} for ${geoName}.`
        : `That is about the same as the published all-items rate of ${pct(out.official)} for ${geoName}.`;
  document.getElementById("story").textContent =
    `Weighted by the amounts you entered, your 12-month rate is ${pct(out.personal)}. ${compare} The two groups adding the most to your rate are ${topBits || "not available"}.` +
    sampleLine;
  const topIds = new Set(out.top.map((r) => r.id));
  document.querySelector("#table tbody").innerHTML = out.rows
    .map(
      (r) => `<tr class="${topIds.has(r.id) ? "hurt" : ""}">
        <td>${r.label}</td>
        <td>$${money(r.spend)}</td>
        <td>${(r.share * 100).toFixed(1)}%</td>
        <td>${r.official_weight.toFixed(2)}%</td>
        <td>${pct(r.yoy)}</td>
        <td>${pct(r.contribution)}</td>
      </tr>`
    )
    .join("");
  return out;
}

function currentAmounts() {
  const geo = document.getElementById("geo").value;
  return readAmounts(cpi.geographies[geo].categories);
}

function fillSample() {
  const geo = document.getElementById("geo").value;
  const cats = cpi.geographies[geo].categories;
  for (const c of cats) {
    document.getElementById("spend-" + c.id).value = SAMPLE.amounts[c.id] ?? 0;
  }
}

function clearAmounts() {
  const geo = document.getElementById("geo").value;
  for (const c of cpi.geographies[geo].categories) {
    document.getElementById("spend-" + c.id).value = "";
  }
}

async function init() {
  const res = await fetch("data/cpi.json");
  if (!res.ok) {
    document.getElementById("story").textContent = "Could not load Statistics Canada figures. Serve this folder over HTTP and try again.";
    return;
  }
  cpi = await res.json();
  const t = cpi.toronto_all_items;
  document.getElementById("data-meta").textContent =
    `Latest month in the bundled file is ${cpi.latest_month}. Retrieved ${cpi.retrieved} (${cpi.retrieved_zone}). Indexes are not seasonally adjusted, 2002=100.`;
  document.getElementById("toronto-note").textContent =
    `Toronto all-items in the same month was ${pct(t.latest_yoy)} (index ${t.latest_index}, vector ${t.index_vector}). ${t.note}`;
  document.getElementById("source-list").innerHTML = `
    <li><a href="${cpi.index_table.url}">${cpi.index_table.title}</a> (table ${cpi.index_table.id}).</li>
    <li><a href="${cpi.basket_table.url}">${cpi.basket_table.title}</a> (table ${cpi.basket_table.id}), 2025 basket, ${cpi.basket_table.price_period}, ${cpi.basket_table.geographic_distribution}.</li>
    <li>CSV packages: <a href="${cpi.index_table.download}">${cpi.index_table.download}</a> and <a href="${cpi.basket_table.download}">${cpi.basket_table.download}</a>.</li>`;
  renderFields(document.getElementById("geo").value);
  document.getElementById("geo").addEventListener("change", () => {
    const prev = {};
    // keep numbers already typed if switching geo: fields are recreated
    renderFields(document.getElementById("geo").value);
  });
  let usedSample = false;
  document.getElementById("run").addEventListener("click", () => {
    renderResult(document.getElementById("geo").value, currentAmounts(), usedSample);
  });
  document.getElementById("sample").addEventListener("click", () => {
    fillSample();
    usedSample = true;
    renderResult(document.getElementById("geo").value, currentAmounts(), true);
  });
  document.getElementById("clear").addEventListener("click", () => {
    usedSample = false;
    clearAmounts();
    renderResult(document.getElementById("geo").value, currentAmounts(), false);
  });
}

init();
window.ShopperInflation = { compute, SAMPLE };
