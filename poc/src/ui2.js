/* ANAMONI UI, part 2: charts, City scan, Passport */
"use strict";
// ---------- charts ----------
function chartTypology(b) {
  const W = 520, rowH = 30, top = 8, lw = 212, bw = W - lw - 56;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${top + rowH * 4 + 8}" role="img" aria-label="Structural type probabilities">`;
  ENG.TYPES.forEach((t, i) => {
    const y = top + i * rowH, v = b.post[i], pr = b.prior[i];
    s += `<text class="lbl" x="0" y="${y + 12}">${esc(t.name)}</text><text x="0" y="${y + 24}">${esc(t.tax)}</text>`;
    s += `<line class="grid" x1="${lw}" x2="${lw + bw}" y1="${y + 15}" y2="${y + 15}"/>`;
    if (v > 0.004) s += `<rect x="${lw}" y="${y + 9}" width="${Math.max(3, v * bw)}" height="12" rx="3" fill="var(--accent)"/>`;
    s += `<line x1="${lw + pr * bw}" x2="${lw + pr * bw}" y1="${y + 5}" y2="${y + 25}" stroke="var(--ink)" stroke-width="2"/>`;
    s += `<text class="val" x="${W}" y="${y + 19}" text-anchor="end">${pct(v)}</text>`;
    s += `<rect class="hit" data-i="${i}" x="0" y="${y}" width="${W}" height="${rowH}"/>`;
  });
  return s + `</svg>`;
}
function chartFragility(b, pgaSite) {
  const W = 520, H = 210, l = 40, r = 12, t = 10, bt = 30, pw = W - l - r, ph = H - t - bt;
  const xm = 1.0, X = x => l + (x / xm) * pw, Y = y => t + (1 - y) * ph;
  const cols = ["var(--p5)", "var(--p4)", "var(--p2)", "var(--p1)"];
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fragility curves">`;
  for (const g of [0, 0.25, 0.5, 0.75, 1]) s += `<line class="grid" x1="${l}" x2="${W - r}" y1="${Y(g)}" y2="${Y(g)}"/><text x="${l - 6}" y="${Y(g) + 3}" text-anchor="end">${g * 100}%</text>`;
  for (let g = 0; g <= 1.0001; g += 0.2) s += `<text x="${X(g)}" y="${H - 12}" text-anchor="middle">${g.toFixed(1)}</text>`;
  s += `<text x="${W - r}" y="${H - 1}" text-anchor="end">peak ground acceleration (g)</text>`;
  s += `<line class="axis" x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  for (let k = 0; k < 4; k++) {
    let d = ""; for (let i = 0; i <= 100; i++) { const x = 0.005 + i * (xm - 0.005) / 100; const y = ENG.exceed(b.post, b.mod.m, x)[k]; d += (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(y).toFixed(1); }
    s += `<path d="${d}" fill="none" stroke="${cols[k]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const ex = ENG.exceed(b.post, b.mod.m, pgaSite);
  s += `<line x1="${X(pgaSite)}" x2="${X(pgaSite)}" y1="${t}" y2="${Y(0)}" stroke="var(--ink-2)" stroke-width="1"/><text x="${X(pgaSite) + 5}" y="${Y(0) - 6}" style="fill:var(--ink-2)">reference ${pgaSite.toFixed(2)} g</text>`;
  ex.forEach((v, k) => s += `<circle cx="${X(pgaSite)}" cy="${Y(v)}" r="4.5" fill="${cols[k]}" stroke="var(--panel)" stroke-width="2"/>`);
  s += `<line class="xh" x1="0" x2="0" y1="${t}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-width="1" opacity="0"/><rect class="hit" x="${l}" y="${t}" width="${pw}" height="${ph}" data-l="${l}" data-pw="${pw}"/>`;
  return { svg: s + `</svg>`, ex, cols };
}
function chartCapacity(cap) {
  const W = 540, rowH = 40, lw = 170, rw = 70, top = 22, pw = W - lw - rw - 10, xm = 3;
  const X = v => lw + Math.min(xm, Math.max(0, v)) / xm * pw;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${top + cap.length * rowH + 22}" role="img" aria-label="Capacity index by scenario">`;
  for (const g of [0, 0.5, 1, 1.5, 2, 2.5, 3]) s += `<line class="grid" x1="${X(g)}" x2="${X(g)}" y1="${top - 6}" y2="${top + cap.length * rowH}"/><text x="${X(g)}" y="${top + cap.length * rowH + 14}" text-anchor="middle">${g}</text>`;
  s += `<line x1="${X(1)}" x2="${X(1)}" y1="${top - 8}" y2="${top + cap.length * rowH}" stroke="var(--ink)" stroke-width="1.4"/><text x="${X(1) - 4}" y="${top - 10}" text-anchor="end" style="fill:var(--ink-2)">demand</text><text x="${X(1) + 4}" y="${top - 10}" style="fill:var(--ink-2)">capacity ▸</text>`;
  s += `<text x="${W}" y="${top - 12}" text-anchor="end">P(C ≥ 1)</text>`;
  cap.forEach((c, i) => {
    const y = top + i * rowH + rowH / 2, col = capColor(c.pOK);
    s += `<text class="lbl" x="0" y="${y + 4}">${esc(c.label)}</text>`;
    s += `<rect x="${X(c.p10)}" y="${y - 3}" width="${Math.max(2, X(c.p90) - X(c.p10))}" height="6" rx="3" fill="${col}" opacity=".45"/>`;
    s += `<circle cx="${X(c.p50)}" cy="${y}" r="5.5" fill="${col}" stroke="var(--panel)" stroke-width="2"/>`;
    s += `<text class="val" x="${W}" y="${y + 4}" text-anchor="end">${pct(c.pOK)}</text>`;
    s += `<rect class="hit" data-i="${i}" x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}"/>`;
  });
  return s + `</svg>`;
}
function barsHTML(rows) { // rows: [label, value, color, max]
  const mx = Math.max(...rows.map(r => r[1]), 1);
  return `<div class="bars">${rows.map(([l, v, c, extra]) => `<div class="bar" data-tip="${esc(l)}|${v}"><span>${esc(l)}</span><div class="trk"><div class="fill" style="width:${(v / mx) * 100}%;background:${c}"></div></div><span class="n">${nf(v)}</span></div>`).join("")}</div>`;
}

// ---------- City scan ----------
function renderOverview() {
  const v = $("#v-overview");
  const pre = B.filter(b => b.year < 1994).length;
  const p12 = B.filter(b => b.prio.p <= 2).length;
  const elig = B.filter(b => b.eligible);
  const light = elig.filter(b => b.growth === "ok" || b.growth === "str").length;
  const kwp = B.reduce((a, b) => a + b.solar.kwp, 0);
  const counts = k => B.filter(k).length;
  v.innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="eyebrow">Screened</div><div class="v">${nf(B.length)}</div><div class="d">every building in pilot district K</div></div>
    <div class="kpi"><div class="eyebrow">Pre-1994</div><div class="v">${nf(pre)}<small>${pct(pre / B.length)}</small></div><div class="d">before the anti-seismic law</div></div>
    <div class="kpi"><div class="eyebrow">Inspect first</div><div class="v">${nf(p12)}</div><div class="d">P1–P2 buildings, visited first by engineers</div></div>
    <div class="kpi"><div class="eyebrow">Can grow up</div><div class="v">${nf(light)}<small>/ ${nf(elig.length)}</small></div><div class="d">eligible houses, ${nf(elig.filter(b => b.growth === "str").length)} after strengthening</div></div>
    <div class="kpi"><div class="eyebrow">Rooftop PV</div><div class="v">${nf(kwp / 1000, 1)}<small>MWp</small></div><div class="d">≈ ${nf(kwp * ENG.SOLAR.yield / 1e6, 1)} GWh a year</div></div>
    <div class="kpi"><div class="eyebrow">Scheme closes</div><div class="v">${nf(daysLeft())}<small>days</small></div><div class="d">applications to the EOA by 31 Dec 2027</div></div>
  </div>
  <div class="g-ov">
    <div class="panel">
      <div class="ph"><h3>Pilot district K</h3><span class="sub">Colour by</span><div class="seg" id="layerSeg" role="group" aria-label="Map layer">${Object.entries(LAYERS).map(([k, l]) => `<button data-l="${k}" aria-pressed="${S.layer === k}">${l.name}</button>`).join("")}</div></div>
      <div class="mapwrap" id="ovMap"></div>
    </div>
    <div class="stack">
      <div class="panel" id="ovSel"></div>
    <div class="panel"><div class="ph"><h3>What the cameras found</h3><span class="sub">features detected</span></div><div class="pb" style="padding-top:6px;padding-bottom:6px"><table class="tbl"><tbody>
      <tr><td>Roofs with anamones (starter bars)</td><td class="n">${nf(counts(b => b.anamones))}</td></tr>
      <tr><td>Open ground floors (pilotis)</td><td class="n">${nf(counts(b => b.gf === "pilotis"))}</td></tr>
      <tr><td>Glazed shop-front ground floors</td><td class="n">${nf(counts(b => b.gf === "shopfront"))}</td></tr>
      <tr><td>Balconies with spalling or exposed rebar</td><td class="n">${nf(counts(b => b.bal_cond === "spalling"))}</td></tr>
      <tr><td>Balconies with visible cracking</td><td class="n">${nf(counts(b => b.bal_cond === "cracked"))}</td></tr>
      <tr><td>Solar water heaters</td><td class="n">${nf(counts(b => b.solar_heater))}</td></tr>
      <tr><td>Uncertain type (confidence &lt; 60%)</td><td class="n">${nf(counts(b => b.conf < 0.6))}</td></tr>
    </tbody></table></div></div>
    </div>
  </div>
  <div class="g-3b">
      <div class="panel">
        <div class="ph"><h3>Engineer visit queue</h3><span class="sub">highest priority first</span></div>
        <div class="scroll" style="max-height:292px"><table class="tbl" id="queue"><thead><tr><th>ID</th><th>Type</th><th class="n">Year</th><th>Priority</th><th class="n">P(ext.)</th></tr></thead><tbody>
        ${[...B].sort((a, b) => b.prio.score - a.prio.score).slice(0, 40).map(b => `<tr class="click" data-id="${b.id}" aria-selected="${b.id === S.sel}" tabindex="0"><td class="mono" style="white-space:nowrap">${b.id}</td><td style="white-space:nowrap">${USE[b.use]}</td><td class="n">${b.year}</td><td>${prioTag(b.prio.p)}</td><td class="n">${pct(b.exRef[2])}</td></tr>`).join("")}
        </tbody></table></div>
      </div>
    <div class="panel"><div class="ph"><h3>Screening priority</h3><span class="sub">buildings per level</span></div><div class="pb">${barsHTML([1, 2, 3, 4, 5].map(p => [`P${p} ${PNAME[p]}`, counts(b => b.prio.p === p), PCOL(p)]))}<p class="note" style="margin:12px 0 0">Ranked by the probability of extensive damage at a reference shaking of ${ENG.REF_PGA} g, raised for failing balconies and occupancy. Low confidence moves a building up a level, never down.</p></div></div>
    <div class="panel"><div class="ph"><h3>Growth potential</h3><span class="sub">${nf(elig.length)} scheme-eligible houses</span></div><div class="pb">
      <div class="stackbar" style="height:16px;margin-bottom:12px">${["ok", "str", "side", "none"].map(g => { const n = elig.filter(b => b.growth === g).length; return n ? `<span style="flex:${n};background:${ENG.GROWTH[g].color}" title="${esc(ENG.GROWTH[g].label)}: ${n}"></span>` : ""; }).join("")}</div>
      <table class="tbl"><tbody>${["ok", "str", "side", "none"].map(g => `<tr><td>${growTag(g)}</td><td class="n">${nf(elig.filter(b => b.growth === g).length)}</td><td class="n muted">${pct(elig.filter(b => b.growth === g).length / elig.length)}</td></tr>`).join("")}
      <tr><td class="muted">Blocks and excluded zones</td><td class="n">${nf(B.length - elig.length)}</td><td class="n muted">separate route</td></tr></tbody></table>
      <p class="note" style="margin:10px 0 0">With no strengthening at all, <b class="mono">${nf(elig.filter(b => b.cap.find(c => c.key === "kit").pOK >= 0.9).length)}</b> of these houses pass the capacity screen with the light kit, against <b class="mono">${nf(elig.filter(b => b.cap.find(c => c.key === "rc").pOK >= 0.9).length)}</b> with a concrete floor.</p></div></div>
  </div>`;
  drawOverviewMap(); renderSelSummary();
  $("#layerSeg").addEventListener("click", e => { const bt = e.target.closest("button"); if (!bt) return; S.layer = bt.dataset.l; $$("#layerSeg button").forEach(x => x.setAttribute("aria-pressed", x === bt)); drawOverviewMap(); });
  const q = $("#queue");
  q.addEventListener("click", e => { const tr = e.target.closest("tr[data-id]"); if (tr) select(tr.dataset.id); });
  q.addEventListener("keydown", e => { if (e.key === "Enter") { const tr = e.target.closest("tr[data-id]"); if (tr) select(tr.dataset.id); } });
  bindTips(v.querySelector(".g-3b"), ".bar", t => { const [l, n] = t.dataset.tip.split("|"); return tipRows(l, [["Buildings", n], ["Share", pct(n / B.length)]]); });
}
function drawOverviewMap() {
  const w = $("#ovMap"); const L = LAYERS[S.layer];
  w.innerHTML = mapSVG(L.color, { label: "Pilot district coloured by " + L.name }) + mapChrome(L.name, L.legend());
  if (!w._bound) { bindMap(w, id => select(id), bTip); w._bound = true; } else scaleFix(w);
}
function renderSelSummary() {
  const el = $("#ovSel"); if (!el) return; const b = BY[S.sel];
  const g = ENG.GROWTH[b.growth], ex = b.cap[0];
  const gIcon = b.growth === "ok" ? "pass" : b.growth === "str" ? "check" : "info";
  el.innerHTML = `<div class="ph"><span class="eyebrow">Selected building</span><span class="sp"></span>${prioTag(b.prio.p)}</div>
  <div class="pb bsum">
    <div><div class="id">${b.id}</div><div class="muted small">${USE[b.use]} · permit ${b.year} · ${b.storeys} storey${b.storeys > 1 ? "s" : ""}${b.hero ? " · demo hero house" : ""}${b.heroBlock ? " · demo hero block" : ""}</div></div>
    <dl class="kv">
      <dt>Most likely type</dt><dd>${ENG.TYPES[b.typeIdx].tax} · ${pct(b.conf)}</dd>
      <dt>Ground floor</dt><dd>${GFN[b.gf]}</dd>
      <dt>Footprint / plot</dt><dd>${nf(b.footprint)} / ${nf(b.plot)} m²</dd>
      <dt>P(extensive) at ${ENG.REF_PGA} g</dt><dd>${pct(b.exRef[2])}</dd>
      <dt>Capacity index, as built</dt><dd>${ex.p50.toFixed(2)} (${ex.p10.toFixed(2)}–${ex.p90.toFixed(2)})</dd>
      <dt>Rooftop solar</dt><dd>${nf(b.solar.kwp, 1)} kWp · ${nf(b.solar.kwh / 1000, 1)} MWh/yr</dd>
    </dl>
    <div class="verdict"><span class="st ${gIcon}">${ICON[gIcon]}</span><div><b>${esc(g.label)}</b><span>${esc(growthWhy(b))}</span></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn primary" data-go="passport">Open passport ${ICON.arrow}</button>
      ${b.use === "block" ? `<button class="btn" data-go="coown">Co-owner split</button>` : b.eligible ? `<button class="btn" data-go="studio">Design a floor</button>` : ""}
    </div>
  </div>`;
}
function growthWhy(b) {
  const k = b.cap.find(c => c.key === "kit"), ks = b.cap.find(c => c.key === "kitS"), rc = b.cap.find(c => c.key === "rc"), rcs = b.cap.find(c => c.key === "rcS");
  switch (b.growth) {
    case "ok": return `A light module passes the capacity screen in ${pct(k.pOK)} of simulations with no strengthening; a concrete floor in ${pct(rc.pOK)}.`;
    case "str": return `The ground floor needs strengthening first. Strengthened, a light module passes in ${pct(ks.pOK)} of simulations and a concrete floor in ${pct(rcs.pOK)}; the light module adds about a quarter of the weight.`;
    case "side": return `Even strengthened, the frame stays below the threshold (${pct(ks.pOK)}). The plot has room to build beside the house instead.`;
    case "none": return `The frame stays below the threshold even when strengthened, and the plot has little free space.`;
    case "block": return `Apartment blocks are excluded from the scheme. Route: exoskeleton retrofit with a co-owner cost split.`;
    case "excl": return `Inside the controlled archaeological area, where the scheme does not apply. Screening still sets its safety priority.`;
  }
  return "";
}

// ---------- Building passport ----------
function screeningRows(b) {
  const d = Object.fromEntries(b.ev.det.map(x => [x.k, x]));
  const rows = [
    ["Storeys above ground", `${b.storeys}`, d.storeys.c, "Street image: floor-slab lines"],
    ["Structural system", ENG.TYPES[b.typeIdx].name, b.conf, "Fusion of imagery with permit year"],
    ["Ground floor", GFN[b.gf], d.gf.c, "Street image: ground-floor openings"],
    ["Cantilever balconies", b.balconies === "cantilever" ? `Yes · ${b.bal_cond}` : "None seen", d.bal ? d.bal.c : 0.8, "Street image: slab edges and soffits"],
    ["Rooftop starter bars", b.anamones ? "Present (anamones)" : "Not seen", d.anam ? d.anam.c : 0.75, "Aerial and street images: roof line"],
    ["Rooftop equipment", b.solar_heater ? "Solar water heater and tank" : "None seen", d.sol ? d.sol.c : 0.8, "Aerial image"],
    ["Irregularity", b.irregular ? "Plan or setback irregularity" : "Regular", d.irr ? d.irr.c : 0.7, "Footprint shape (cadastre)"],
    ["Permit year", `${b.year} · ${b.year < 1994 ? "before" : "after"} the 1994 seismic law`, 0.95, "EOA permit archive sample"],
    ["Ground conditions", b.in_marl ? "Soft soil (marl) zone" : "Firm ground", 0.9, "Geological Survey suitability zones"],
  ];
  return rows;
}
function renderPassport() {
  const v = $("#v-passport"), b = BY[S.sel];
  const siteFactor = (b.in_marl ? ENG.SOIL.marl : ENG.SOIL.base) / ENG.SOIL.base;
  const fr = chartFragility(b, ENG.REF_PGA * siteFactor);
  const chk = ENG.checks(b, b.post, b.growth);
  const g = ENG.GROWTH[b.growth];
  v.innerHTML = `
  <div class="panel"><div class="pb" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
    <div><div class="eyebrow">Building passport · v1 (screening)</div><div style="font:600 26px var(--mono);letter-spacing:-.02em;margin-top:2px">${b.id}</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">${USE[b.use]}</span><span class="tag">permit ${b.year}</span><span class="tag">${b.storeys} storeys</span><span class="tag">${nf(b.footprint)} m² footprint</span><span class="tag">${b.households} household${b.households > 1 ? "s" : ""}</span></div>
    <div class="sp" style="flex:1"></div>
    <div style="display:grid;gap:4px;justify-items:end">${prioTag(b.prio.p)}${growTag(b.growth)}</div>
    <div style="display:flex;gap:8px">${b.use === "block" ? `<button class="btn primary" data-go="coown">Co-owner split ${ICON.arrow}</button>` : b.eligible ? `<button class="btn primary" data-go="studio">Design a floor ${ICON.arrow}</button>` : ""}<button class="btn" data-go="flow">Permit pre-check</button></div>
  </div></div>
  <div class="g-pp">
    <div class="stack">
      <div class="panel">
        <div class="ph"><h3>What the cameras see</h3><span class="sub">front elevation with detected features</span><span class="sp"></span><div class="seg" id="detSeg"><button aria-pressed="true" data-d="1">Detections</button><button aria-pressed="false" data-d="0">Clean</button></div></div>
        <div class="pb"><div class="elev-wrap" id="elevBox">${elevation(b, { detect: true })}</div>
        <p class="note" style="margin:10px 0 0">Demo district: this elevation is drawn from the building's detected features, and no real facade or address is shown. In the pilot, 360° street imagery is captured from municipal vehicles, with faces and plates blurred on the device.</p></div>
      </div>
      <div class="panel">
        <div class="ph"><h3>Screening form</h3><span class="sub">ETEK rapid visual screening fields, filled automatically</span></div>
        <div class="scroll"><table class="tbl"><thead><tr><th>Field</th><th>Reading</th><th>Confidence</th><th>Evidence</th></tr></thead><tbody>
        ${screeningRows(b).map(([f, r, c, e]) => `<tr><td>${esc(f)}</td><td>${esc(r)}</td><td class="n"><span class="meter${c < 0.7 ? " lo" : ""}"><i style="width:${c * 100}%"></i></span> ${c.toFixed(2)}</td><td class="muted small">${esc(e)}</td></tr>`).join("")}
        </tbody></table></div>
      </div>
    </div>
    <div class="stack">
      <div class="panel"><div class="ph"><h3>Structural type</h3><span class="sub">Bayesian fusion of construction year and image evidence</span></div>
        <div class="pb">${chartTypology(b)}<div class="legend-row" style="margin-top:8px"><span><i style="background:var(--accent);height:8px;width:14px;border-radius:2px"></i>after image evidence</span><span><i style="background:var(--ink);width:2px;height:12px"></i>prior from permit year</span></div></div></div>
      <div class="panel"><div class="ph"><h3>Damage probability</h3><span class="sub">fragility curves, mixed over the type probabilities</span></div>
        <div class="pb"><div class="legend-row" style="margin-bottom:8px">${ENG.DS.map((d, k) => `<span><i style="background:${fr.cols[k]}"></i>${d} <b class="mono">${pct(fr.ex[k])}</b></span>`).join("")}</div><div id="fragBox">${fr.svg}</div>
        ${b.mod.why.length ? `<p class="note" style="margin:8px 0 0">Adjusted for: ${b.mod.why.map(w => `${esc(w[0])} (×${w[1]})`).join(", ")}.</p>` : ""}</div></div>
      <div class="panel"><div class="ph"><h3>Can it carry a new floor?</h3><span class="sub">capacity index C, 400 simulations</span></div>
        <div class="pb"><div id="capBox">${chartCapacity(b.cap)}</div>
        <div class="verdict" style="margin-top:10px"><span class="st ${b.growth === "ok" ? "pass" : b.growth === "str" ? "check" : "info"}">${ICON[b.growth === "ok" ? "pass" : b.growth === "str" ? "check" : "info"]}</span><div><b>${esc(g.label)}</b><span>${esc(growthWhy(b))}</span></div></div>
        <p class="note" style="margin:10px 0 0">C is the estimated ground-floor lateral resistance divided by the seismic demand at ${ENG.REF_PGA} g, sampled over uncertain materials, geometry and structural type. The screen passes an option when C ≥ 1 in at least 90% of simulations. Screening only: it ranks and advises, and a licensed engineer assesses and signs.</p></div></div>
      <div class="panel"><div class="ph"><h3>What the engineer should check on site</h3></div>
        <div class="pb"><ul style="margin:0;padding-left:18px;display:grid;gap:6px;font-size:12.5px">${chk.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div></div>
    </div>
  </div>`;
  $("#detSeg").addEventListener("click", e => { const bt = e.target.closest("button"); if (!bt) return; $$("#detSeg button").forEach(x => x.setAttribute("aria-pressed", x === bt)); $("#elevBox").innerHTML = elevation(b, { detect: bt.dataset.d === "1" }); });
  // fragility crosshair
  const fb = $("#fragBox");
  fb.addEventListener("pointermove", e => {
    const svg = $("svg", fb), hit = $(".hit", fb); if (!hit || e.target !== hit) { hideTip(); $(".xh", fb).setAttribute("opacity", 0); return; }
    const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) * 520 / r.width, l = +hit.dataset.l, pw = +hit.dataset.pw;
    const x = Math.max(0.005, Math.min(1, (vx - l) / pw)); const ex = ENG.exceed(b.post, b.mod.m, x);
    const xh = $(".xh", fb); xh.setAttribute("x1", vx); xh.setAttribute("x2", vx); xh.setAttribute("opacity", 1);
    showTip(e, tipRows(`PGA ${x.toFixed(2)} g`, ENG.DS.map((d, k) => [d + " or worse", pct(ex[k])]).reverse()));
  });
  fb.addEventListener("pointerleave", () => { hideTip(); const xh = $(".xh", fb); if (xh) xh.setAttribute("opacity", 0); });
  bindTips($("#capBox"), ".hit", t => { const c = b.cap[+t.dataset.i]; return tipRows(c.label, [["Median C", c.p50.toFixed(2)], ["10th–90th pct", `${c.p10.toFixed(2)}–${c.p90.toFixed(2)}`], ["P(C ≥ 1)", pct(c.pOK)]]); });
  bindTips(v.querySelector(".g-pp .stack:last-child .panel"), ".hit", t => { const i = +t.dataset.i; return tipRows(ENG.TYPES[i].tax, [["Prior (permit year)", pct(b.prior[i])], ["Posterior (with images)", pct(b.post[i])]]); });
}
