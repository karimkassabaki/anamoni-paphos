/* ANAMONI UI, part 3: photo screening, Studio, permit & assistant, co-owners, scenario, method, boot */
"use strict";
// ---------- AI availability ----------
function setAIChip() {
  const c = $("#aimode"); if (!c) return;
  c.classList.toggle("live", S.aiState === "live"); c.classList.toggle("rec", S.aiState !== "live");
  $("span:last-child", c).textContent = S.aiState === "live" ? "AI: live · Claude" : S.aiState === "checking" ? "AI: checking…" : "AI: recorded runs";
  c.title = S.aiState === "live" ? "AI calls run live on your Claude account (you will be asked to allow them)." : "Live AI is not available in this view, so AI panels replay recorded runs. Every calculation still runs live.";
}
async function initAI() {
  if (!window.claude || typeof window.claude.use !== "function") { S.aiState = "recorded"; setAIChip(); return; }
  try {
    const s = await window.claude.use("sample");
    if (s) { S.ai = s; S.aiState = "live"; try { const lim = await s.limits(); S.aiImages = !!(lim && lim.images); } catch { S.aiImages = false; } }
    else S.aiState = "recorded";
  } catch { S.aiState = "recorded"; }
  setAIChip();
}
const aiBadge = src => src === "live" ? `<span class="tag" style="border-color:var(--accent);color:var(--accent)">${ICON.spark}live · Claude</span>` : `<span class="tag">recorded run</span>`;
function aiErr(e) {
  const c = e && e.code;
  if (c === "not_granted" || c === "sampling_disabled" || c === "capability_disabled" || c === "not_declared") { S.aiState = "recorded"; setAIChip(); return "Live AI is switched off for this view, so the recorded run is shown instead."; }
  if (c === "rate_limited") return "Too many requests just now. Wait a minute and try again.";
  if (c === "images_unavailable") { S.aiImages = false; return "This view cannot send images to Claude. The recorded run is shown instead."; }
  if (c === "cancelled") return "Stopped.";
  return "The AI call did not complete. Try again, or use the recorded run.";
}

// ---------- Screen a photo (vision-language model fills the screening form) ----------
const SCAN_PROMPT = `You are the screening model inside ANAMONI, a building-safety tool for the Municipality of Paphos, Cyprus. Look at the attached image of a building's street facade and fill in rapid visual screening fields in the spirit of ETEK's rapid visual inspection forms. You rank and describe. You never certify a building as safe.

Reply with only a JSON object in exactly this shape:
{"image_ok": true, "image_note": "one short sentence on image quality and viewpoint",
 "fields": [
  {"key": "storeys", "label": "Storeys above ground", "value": "2", "confidence": 0.9, "region": "whole", "evidence": "two slab lines and two rows of windows"}
 ],
 "screening_priority": 3, "priority_reason": "one sentence",
 "engineer_checks": ["short imperative sentence", "..."],
 "limitations": "one sentence on what a photo cannot show"}

Include exactly these field keys, in this order, each with label, value, confidence (0 to 1), region and evidence (max 15 words):
storeys (a number or "unknown"); structure ("RC frame with infill", "unreinforced masonry", "steel", or "unknown"); ground_floor ("closed", "open on columns (pilotis)", "glazed shop front", "partly open", or "unknown"); balconies ("none", "cantilever, sound", "cantilever, cracked", "cantilever, spalling or exposed rebar", or "unknown"); deterioration (short description or "none seen"); anamones (rooftop steel starter bars left for a future floor: "present", "not seen", or "roof not visible"); rooftop_equipment (short description or "none seen"); irregularity (short description or "none seen"); era_estimate ("before 1974", "1974 to 1993", "1994 to 2011", "2012 or later", or "unknown").
region is one of: top-left, top, top-right, left, centre, right, bottom-left, bottom, bottom-right, whole.
screening_priority is 1 to 5, where 1 means inspect first. Uncertainty must push the priority towards 1, never towards 5. Never use the word "safe". If a feature is not visible, say so and give a low confidence. Do not describe people, number plates or addresses.`;
const REGION = { "top-left": 0, top: 1, "top-right": 2, left: 3, centre: 4, center: 4, right: 5, "bottom-left": 6, bottom: 7, "bottom-right": 8 };
async function samplePNG() {
  if (S.sample) return S.sample;
  const svg = elevation(HERO, { pal: PAL_HEX, scale: 26 }).replace('class="elev" ', "");
  const img = new Image(); const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const cv = document.createElement("canvas"); cv.width = img.naturalWidth || 900; cv.height = img.naturalHeight || 600;
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const blob = await new Promise(r => cv.toBlob(r, "image/png"));
  S.sample = { blob, url: URL.createObjectURL(blob), name: "Sample facade (demo house KT-156)", isSample: true };
  return S.sample;
}
function renderScan() {
  const v = $("#v-scan");
  v.innerHTML = `
  <div class="callout"><b>Scan, live.</b> Upload a street photo of any building, for example your own family house. A vision-language model reads the facade and fills in the screening fields with evidence and a confidence for each. The engines then turn those readings into a draft passport. Photos stay in your browser and are sent only to Claude for this one reading.</div>
  <div class="g-2">
    <div class="stack">
      <div class="panel"><div class="ph"><h3>Facade image</h3><span class="sp"></span><button class="btn" id="useSample">Use the sample facade</button></div>
        <div class="pb" style="display:grid;gap:12px">
          <label class="drop" id="drop" for="file">${ICON.upload}<b>Drop a street photo here, or choose one</b><span class="small muted">JPEG, PNG or WebP. Take it from the public street, with no people or number plates in view.</span><input type="file" id="file" accept="image/jpeg,image/png,image/webp" hidden></label>
          <div id="shot"></div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" id="runScan" disabled>${ICON.spark}Screen this facade</button><button class="btn ghost" id="stopScan" hidden>${ICON.stop}Stop</button><span id="scanState" class="aistate"></span></div>
          <details><summary class="small muted">Show the instruction the model receives</summary><pre style="white-space:pre-wrap;font:11.5px/1.5 var(--mono);color:var(--ink-2);background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:10px;margin:8px 0 0">${esc(SCAN_PROMPT)}</pre></details>
        </div></div>
    </div>
    <div class="stack" id="scanOut"></div>
  </div>`;
  const setImg = (o) => { S.scanImg = o; $("#shot").innerHTML = `<div class="shot"><img alt="${esc(o.name)}" src="${o.url}"><div class="cells">${[...Array(9)].map(() => "<div></div>").join("")}</div></div><div class="note" style="margin-top:6px">${esc(o.name)}</div>`; $("#runScan").disabled = false; if (S.scanRes && S.scanRes.img === o) paintScan(); else $("#scanOut").innerHTML = scanEmpty(); };
  const file = $("#file"), drop = $("#drop");
  file.addEventListener("change", () => { const f = file.files[0]; if (f) setImg({ blob: f, url: URL.createObjectURL(f), name: f.name }); });
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) setImg({ blob: f, url: URL.createObjectURL(f), name: f.name }); });
  $("#useSample").addEventListener("click", async () => setImg(await samplePNG()));
  let ctl = null;
  $("#stopScan").addEventListener("click", () => ctl && ctl.abort());
  $("#runScan").addEventListener("click", async () => {
    const o = S.scanImg; if (!o) return;
    const stEl = $("#scanState");
    if (S.aiState === "live" && S.aiImages !== false) {
      ctl = new AbortController(); $("#runScan").disabled = true; $("#stopScan").hidden = false;
      stEl.innerHTML = `<span class="pulse"></span>Claude is reading the facade…`;
      try {
        const res = await S.ai.json(SCAN_PROMPT, { images: o.blob, modelTier: "default", signal: ctl.signal });
        if (!res || !Array.isArray(res.fields)) throw { code: "invalid_json" };
        S.scanRes = { img: o, data: res, src: "live" }; stEl.textContent = "";
      } catch (e) {
        stEl.textContent = aiErr(e);
        if (o.isSample) S.scanRes = { img: o, data: REC.screen, src: "recorded" };
      } finally { $("#runScan").disabled = false; $("#stopScan").hidden = true; }
    } else if (o.isSample) {
      stEl.innerHTML = `<span class="pulse"></span>Replaying the recorded run…`; await new Promise(r => setTimeout(r, 650));
      S.scanRes = { img: o, data: REC.screen, src: "recorded" }; stEl.textContent = "";
    } else { stEl.textContent = "Live AI is not available in this view, so only the sample facade has a recorded run. Open the live link to screen your own photo."; return; }
    paintScan();
  });
  if (S.scanImg) setImg(S.scanImg);
  else samplePNG().then(o => { S.scanRes = { img: o, data: REC.screen, src: "recorded" }; setImg(o); }).catch(() => { $("#scanOut").innerHTML = scanEmpty(); });
}
const scanEmpty = () => `<div class="panel"><div class="pb"><div class="eyebrow">Waiting for an image</div><p class="muted" style="margin:6px 0 0">Choose a photo or the sample facade, then press <b>Screen this facade</b>. The readings appear here with their evidence, and you can turn them into a draft passport.</p></div></div>`;
function photoBuilding(data, inp) {
  const f = Object.fromEntries((data.fields || []).map(x => [x.key, x]));
  const val = k => String((f[k] && f[k].value) || "").toLowerCase();
  const storeys = Math.max(1, Math.min(8, parseInt(val("storeys")) || 2));
  const gfv = val("ground_floor"), bv = val("balconies");
  const b = {
    id: "PHOTO", use: storeys >= 3 && /open|pilotis/.test(gfv) ? "block" : "house", year: inp.year, storeys,
    gf: /open|pilotis/.test(gfv) ? "pilotis" : /glaz|shop/.test(gfv) ? "shopfront" : "closed",
    balconies: /cantilever/.test(bv) ? "cantilever" : "none",
    bal_cond: /spall|expos/.test(bv) ? "spalling" : /crack/.test(bv) ? "cracked" : /cantilever/.test(bv) ? "sound" : "none",
    anamones: /present/.test(val("anamones")), solar_heater: /solar|heater|tank/.test(val("rooftop_equipment")),
    irregular: !/none/.test(val("irregularity")) && val("irregularity") !== "", in_marl: inp.marl, in_arch: false,
    footprint: inp.fp, plot: inp.plot, households: storeys >= 3 ? storeys * 2 : 1,
  };
  const st = val("structure");
  const ev = { frame: /rc|frame|concrete/.test(st) ? "yes" : "no", detail: inp.year < 1994 ? "old" : "modern" };
  b.prior = ENG.eraPrior(b.year); b.post = ENG.posterior(b.prior, ev); b.conf = Math.max(...b.post); b.typeIdx = b.post.indexOf(b.conf);
  b.mod = ENG.modifiers(b); b.exRef = ENG.exceed(b.post, b.mod.m, ENG.REF_PGA * (b.in_marl ? ENG.SOIL.marl / ENG.SOIL.base : 1));
  b.cap = ENG.capacity(b, b.post); b.growth = ENG.growth(b, b.cap); b.prio = ENG.priority(b, b.exRef, b.conf);
  return b;
}
function paintScan() {
  const r = S.scanRes, d = r.data, out = $("#scanOut");
  $$(".shot .cells div").forEach(c => { c.className = ""; c.innerHTML = ""; });
  const cells = $$(".shot .cells div");
  for (const fl of d.fields || []) { const i = REGION[fl.region]; if (i != null && cells[i] && !/not seen|none seen|unknown|roof not visible/i.test(String(fl.value))) { cells[i].className = "hit"; cells[i].insertAdjacentHTML("beforeend", `<span>${esc(fl.label || fl.key)}</span>`); } }
  const eraMid = { "before 1974": 1968, "1974 to 1993": 1982, "1994 to 2011": 2003, "2012 or later": 2016 };
  const ev = ((d.fields || []).find(x => x.key === "era_estimate") || {}).value || "";
  const y0 = eraMid[String(ev).toLowerCase()] || 1980;
  out.innerHTML = `
  <div class="panel"><div class="ph"><h3>Screening readings</h3><span class="sp"></span>${aiBadge(r.src)}</div>
    <div class="scroll"><table class="tbl"><thead><tr><th>Field</th><th>Reading</th><th>Conf.</th><th>Evidence</th></tr></thead><tbody>
    ${(d.fields || []).map(x => { const c = Math.max(0, Math.min(1, +x.confidence || 0)); return `<tr><td>${esc(x.label || x.key)}</td><td>${esc(x.value)}</td><td class="n"><span class="meter${c < 0.7 ? " lo" : ""}"><i style="width:${c * 100}%"></i></span> ${c.toFixed(2)}</td><td class="muted small">${esc(x.evidence || "")}</td></tr>`; }).join("")}
    </tbody></table></div>
    <div class="pb" style="display:grid;gap:8px;border-top:1px solid var(--line)">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="eyebrow">Model's screening priority</span>${d.screening_priority ? prioTag(Math.max(1, Math.min(5, +d.screening_priority))) : ""}</div>
      <div class="small">${esc(d.priority_reason || "")}</div>
      ${d.engineer_checks && d.engineer_checks.length ? `<ul style="margin:0;padding-left:18px;font-size:12.5px;display:grid;gap:4px">${d.engineer_checks.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
      <div class="note">${esc(d.image_note || "")} ${esc(d.limitations || "")}</div>
    </div></div>
  <div class="panel"><div class="ph"><h3>Turn it into a draft passport</h3><span class="sub">add what a photo cannot show</span></div>
    <div class="pb" style="display:grid;gap:12px">
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
        <div class="field"><label for="pYear">Permit year</label><input id="pYear" type="number" min="1900" max="2026" value="${r.img.isSample ? 1979 : y0}"></div>
        <div class="field"><label for="pFp">Footprint m²</label><input id="pFp" type="number" min="30" max="1200" value="${r.img.isSample ? 135 : 110}"></div>
        <div class="field"><label for="pPlot">Plot m²</label><input id="pPlot" type="number" min="60" max="5000" value="${r.img.isSample ? 587 : 380}"></div>
      </div>
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pMarl"> Plot lies on a soft-soil (marl) zone</label>
      <div id="pOut"></div>
    </div></div>`;
  const upd = () => {
    const b = photoBuilding(d, { year: +$("#pYear").value || 1980, fp: +$("#pFp").value || 110, plot: +$("#pPlot").value || 380, marl: $("#pMarl").checked });
    $("#pOut").innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">${prioTag(b.prio.p)}${growTag(b.growth)}<span class="tag">${ENG.TYPES[b.typeIdx].tax} · ${pct(b.conf)}</span><span class="tag">P(extensive) ${pct(b.exRef[2])}</span></div>${chartCapacity(b.cap)}<div class="verdict" style="margin-top:8px"><span class="st info">${ICON.info}</span><div><b>${esc(ENG.GROWTH[b.growth].label)}</b><span>${esc(growthWhy(b))}</span></div></div>`;
  };
  ["pYear", "pFp", "pPlot", "pMarl"].forEach(id => $("#" + id).addEventListener("input", upd)); upd();
}

// ---------- Design studio ----------
function scatter(res, pickKey) {
  const W = 620, H = 300, l = 52, r = 14, t = 12, bt = 36;
  const all = res.cands, xs = all.map(c => c.cost), ys = all.map(c => c.a);
  const x0 = Math.floor(Math.min(...xs) / 20000) * 20000, x1 = Math.ceil(Math.max(...xs) / 20000) * 20000, y0 = 40, y1 = Math.max(res.limit + 12, Math.ceil(Math.max(...ys) / 20) * 20 + 5);
  const X = v => l + (v - x0) / (x1 - x0) * (W - l - r), Y = v => t + (1 - (v - y0) / (y1 - y0)) * (H - t - bt);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Design options: cost against floor area">`;
  for (let v = x0; v <= x1; v += 40000) s += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${t}" y2="${H - bt}"/><text x="${X(v)}" y="${H - bt + 14}" text-anchor="middle">€${v / 1000}k</text>`;
  for (let v = 40; v <= y1; v += 20) s += `<line class="grid" x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${l - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`;
  s += `<text x="${l - 6}" y="${t - 2}" text-anchor="end">m²</text><text x="${W - r}" y="${H - 4}" text-anchor="end">total cost incl. design and platform fees</text>`;
  s += `<line x1="${X(S.brief.budget)}" x2="${X(S.brief.budget)}" y1="${t}" y2="${H - bt}" stroke="var(--ink-2)" stroke-width="1"/><text x="${X(S.brief.budget) + 4}" y="${t + 10}" style="fill:var(--ink-2)">budget</text>`;
  s += `<line x1="${l}" x2="${W - r}" y1="${Y(res.limit)}" y2="${Y(res.limit)}" stroke="var(--ink-2)" stroke-width="1"/><text x="${W - r}" y="${Y(res.limit) - 4}" text-anchor="end" style="fill:var(--ink-2)">scheme limit ${res.limit} m²</text>`;
  for (const c of all) if (!c.feasible) s += `<circle cx="${X(c.cost).toFixed(1)}" cy="${Y(c.a).toFixed(1)}" r="2" fill="none" stroke="var(--line-2)" stroke-width="1"/>`;
  for (const c of all) if (c.feasible && !c.pareto) s += `<circle cx="${X(c.cost).toFixed(1)}" cy="${Y(c.a).toFixed(1)}" r="2.2" fill="var(--ink-3)" opacity=".45"/>`;
  for (const c of all) if (c.pareto) s += `<circle cx="${X(c.cost).toFixed(1)}" cy="${Y(c.a).toFixed(1)}" r="3.6" fill="var(--accent)" stroke="var(--panel)" stroke-width="1.5"/>`;
  res.picks.forEach((p, i) => { const L = "ABC"[i]; const sel = p.key === pickKey; s += `<circle cx="${X(p.cost)}" cy="${Y(p.a)}" r="${sel ? 9 : 7.5}" fill="${sel ? "var(--accent)" : "var(--ink)"}" stroke="var(--panel)" stroke-width="2"/><text x="${X(p.cost)}" y="${Y(p.a) + 3.5}" text-anchor="middle" style="fill:var(--panel);font-weight:600">${L}</text>`; });
  s += `<rect class="hit" x="${l}" y="${t}" width="${W - l - r}" height="${H - t - bt}"/>`;
  return { svg: s + `</svg>`, X, Y, W };
}
function renderStudio() {
  const v = $("#v-studio"); let b = BY[S.sel];
  if (!b.eligible) {
    v.innerHTML = `<div class="panel"><div class="pb" style="display:grid;gap:10px"><div class="eyebrow">${b.id}</div><h3>${b.use === "block" ? "Apartment blocks follow the exoskeleton route" : "This building sits in an excluded zone"}</h3><p class="muted" style="margin:0">${esc(growthWhy(b))}</p><div style="display:flex;gap:8px"><button class="btn primary" id="toHero">Design for demo house ${HERO.id}</button>${b.use === "block" ? `<button class="btn" data-go="coown">Open co-owner split</button>` : ""}</div></div></div>`;
    $("#toHero").addEventListener("click", () => { select(HERO.id); renderStudio(); }); return;
  }
  v.innerHTML = `
  <div class="g-st">
    <div class="stack">
      <div class="panel"><div class="ph"><h3>Family brief</h3><span class="sub">${b.id}</span></div>
        <div class="pb" style="display:grid;gap:14px">
          <div class="field"><label>Bedrooms</label><div class="seg" id="rooms">${[1, 2, 3].map(n => `<button data-n="${n}" aria-pressed="${S.brief.rooms === n}">${n}</button>`).join("")}</div></div>
          <div class="field"><label for="budget">Budget, all-in</label><input id="budget" type="range" min="100000" max="320000" step="5000" value="${S.brief.budget}"><div class="mono small" id="budgetV">${eur(S.brief.budget)}</div></div>
          <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="stepfree" ${S.brief.stepfree ? "checked" : ""}> Grandparents stay downstairs with step-free access</label>
          <button class="btn primary" id="runStudio">${ICON.spark}Generate options</button>
          <div class="note" id="studioStats"></div>
        </div></div>
      <div class="panel"><div class="ph"><h3>What the search varies</h3></div><div class="pb small" style="display:grid;gap:6px;color:var(--ink-2)">
        <div>Floor area 45 m² up to the roof or the scheme limit, in 5 m² steps</div><div>Frame: light-gauge steel, or steel with timber floor cassettes</div><div>Ground floor: as built, column jackets, or steel X-bracing</div><div>Pergola PV 3–8 kWp and a 0, 5 or 10 kWh battery</div>
        <div class="note">Every option is checked against the capacity index. Only options with C ≥ 1 in at least 90% of simulations are kept.</div></div></div>
    </div>
    <div class="stack" id="studioOut"></div>
  </div>
  <div id="studio3d" style="margin-top:14px"></div>`;
  $("#rooms").addEventListener("click", e => { const bt = e.target.closest("button"); if (!bt) return; S.brief.rooms = +bt.dataset.n; $$("#rooms button").forEach(x => x.setAttribute("aria-pressed", x === bt)); });
  $("#budget").addEventListener("input", e => { S.brief.budget = +e.target.value; $("#budgetV").textContent = eur(S.brief.budget); });
  $("#stepfree").addEventListener("change", e => S.brief.stepfree = e.target.checked);
  $("#runStudio").addEventListener("click", () => runStudio(b));
  if (S.studio[b.id]) paintStudio(b); else runStudio(b);
}
function runStudio(b) {
  const res = ENG.studio(b, S.brief); S.studio[b.id] = res;
  const cur = S.pick[b.id]; S.pick[b.id] = (res.picks.find(p => cur && p.key === cur.key) || res.picks[0] || null);
  paintStudio(b);
}
function paintStudio(b) {
  const res = S.studio[b.id], out = $("#studioOut"), pk = S.pick[b.id];
  $("#studioStats").innerHTML = `Searched <b class="mono">${nf(res.cands.length)}</b> kit configurations in <b class="mono">${nf(res.ms, 0)} ms</b>. <b class="mono">${nf(res.feasible)}</b> pass the safety threshold and the brief, and <b class="mono">${nf(res.pareto)}</b> are on the best-trade-off front.`;
  if (!pk) { if (S.m3d) { S.m3d.dispose(); S.m3d = null; } $("#studio3d").innerHTML = ""; out.innerHTML = `<div class="panel"><div class="pb"><h3>No option meets the brief</h3><p class="muted">Try fewer bedrooms or a higher budget. If none pass the safety threshold, the plot route (build beside) applies.</p></div></div>`; return; }
  const sc = scatter(res, pk.key);
  out.innerHTML = `
  <div class="panel"><div class="ph"><h3>Options explored</h3><span class="sub">each dot is a checked design</span><span class="sp"></span><div class="legend-row"><span><i style="background:var(--accent);height:8px;width:8px;border-radius:50%"></i>best trade-offs</span><span><i style="background:var(--ink-3);height:6px;width:6px;border-radius:50%;opacity:.6"></i>feasible</span><span><i style="border:1px solid var(--line-2);height:6px;width:6px;border-radius:50%"></i>fails safety or brief</span></div></div>
    <div class="pb" id="scat">${sc.svg}</div></div>
  <div class="opts" id="opts">${res.picks.map((p, i) => `<button class="opt" data-k="${p.key}" aria-pressed="${p.key === pk.key}"><div class="l"><span class="badge">${"ABC"[i]}</span><span class="name">${esc(p.name)}</span></div><div class="price">${eurk(p.cost)}</div><div class="small muted">${esc(p.why)}</div><div class="mini"><span>Area</span><b>${p.a} m² · ${p.rooms} bed</b><span>Strengthening</span><b>${esc(p.str.id === "none" ? "none" : p.str.id === "jacket" ? "jackets" : "X-bracing")}</b><span>P(C ≥ 1)</span><b>${pct(p.pOK)}</b><span>Bill saving</span><b>${eur(p.save)}/yr</b></div></button>`).join("")}</div>
  <div class="panel"><div class="ph"><h3>Option ${"ABC"[res.picks.indexOf(pk)]} · ${esc(pk.name)}</h3><span class="sub">parametric preview of the same house, before and after</span></div>
    <div class="pb g-2" style="gap:14px">
      <div><div class="elev-wrap">${elevation(b, { reserve: true })}<div class="elev-cap"><span>Today</span><span>${b.storeys} storeys · ${b.anamones ? "anamones on roof" : "flat roof"}</span></div></div></div>
      <div><div class="elev-wrap">${elevation(b, { add: { a: pk.a, pv: pk.pv, str: pk.str.id } })}<div class="elev-cap"><span>With the new home</span><span>Paphos Palette · not a photo</span></div></div></div>
    </div>
    <div class="pb g-2" style="gap:18px;padding-top:0">
      <table class="tbl"><thead><tr><th>Bill of quantities</th><th class="n">Qty</th><th class="n">Cost</th></tr></thead><tbody>
        <tr><td>${esc(pk.frame.name)}, fitted out</td><td class="n">${pk.a} m²</td><td class="n">${eur(pk.a * pk.frame.eur)}</td></tr>
        <tr><td>Ground-floor strengthening: ${esc(pk.str.name.toLowerCase())}</td><td class="n">1</td><td class="n">${eur(pk.str.cost(b))}</td></tr>
        <tr><td>Timber pergola structure</td><td class="n">1</td><td class="n">${eur(ENG.KIT.pergolaEur)}</td></tr>
        <tr><td>Pergola PV</td><td class="n">${pk.pv} kWp</td><td class="n">${eur(pk.pv * ENG.KIT.pvEur)}</td></tr>
        <tr><td>Battery</td><td class="n">${pk.batt} kWh</td><td class="n">${eur(pk.batt * ENG.KIT.battEur)}</td></tr>
        <tr><td>Design, engineering and permits (6%)</td><td class="n"></td><td class="n">${eur(pk.works * ENG.KIT.feeDesign)}</td></tr>
        <tr><td>ANAMONI platform fee (3%)</td><td class="n"></td><td class="n">${eur(pk.works * ENG.KIT.feePlatform)}</td></tr>
        <tr><td><b>Total</b></td><td class="n"></td><td class="n"><b>${eur(pk.cost)}</b></td></tr>
      </tbody></table>
      <div style="display:grid;gap:12px;align-content:start">
        <dl class="kv">
          <dt>Kit rate (frame and fit-out)</dt><dd>€${nf(pk.frame.eur)}/m²</dd>
          <dt>All-in cost per m²</dt><dd>€${nf(pk.cost / pk.a)}/m²</dd>
          <dt>Added load on the old frame</dt><dd>${nf(pk.a * (pk.frame.load + ENG.CAP.pergola))} kN (concrete floor: ${nf(pk.a * ENG.CAP.addRC)} kN)</dd>
          <dt>Capacity index C, median</dt><dd>${pk.c50.toFixed(2)} · P(C ≥ 1) ${pct(pk.pOK)}</dd>
          <dt>Solar yield</dt><dd>${nf(pk.kwh)} kWh/yr</dd>
          <dt>Used on site</dt><dd>${nf(pk.self)} kWh/yr · ${pct(pk.self / pk.kwh)}</dd>
          <dt>Bill saving at €${ENG.KIT.tariff.toFixed(2)}/kWh</dt><dd>${eur(pk.save)}/yr</dd>
        </dl>
        <div class="note">Costs are planning estimates to be replaced by quotes from certified kit makers. Outputs for the engineer: IFC model, bill of quantities and a screening-level pre-calculation. A licensed engineer reviews and signs before anything is built.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-go="flow">Pre-check the permit ${ICON.arrow}</button></div>
      </div>
    </div></div>`;
  $("#studio3d").innerHTML = `<div class="panel" id="m3dPanel"><div class="ph"><h3>Build it in 3D</h3><span class="sub">option ${"ABC"[res.picks.indexOf(pk)]} · ${esc(pk.name)}, generated from the passport and the chosen design · drag to turn, scroll to zoom</span><span class="sp"></span><div class="seg" id="m3dMode"><button data-m="0" aria-pressed="${!S.m3dEx}">Assembled</button><button data-m="1" aria-pressed="${!!S.m3dEx}">Exploded</button></div></div>
    <div class="m3d-grid"><div class="m3d" id="m3d"></div>
      <div class="m3d-side">
        <div><div class="eyebrow">Assembly step <span class="mono" id="m3dN"></span></div><h3 id="m3dT" style="margin-top:4px;font-size:15px"></h3><p class="small" id="m3dD" style="margin:4px 0 0;color:var(--ink-2);min-height:54px"></p></div>
        <ol class="m3d-steps" id="m3dSteps">${A3D.STEPS.map((x, i) => `<li><button data-s="${i}"><span class="mono">${i}</span>${esc(x.t)}</button></li>`).join("")}</ol>
        <div style="display:flex;gap:6px"><button class="btn" id="m3dPrev" aria-label="Previous step">${ICON.chevL || "‹"}</button><button class="btn" id="m3dPlay" style="flex:1;justify-content:center">${ICON.play || ICON.spark}Play the build</button><button class="btn" id="m3dNext" aria-label="Next step">${ICON.chevR || "›"}</button></div>
        <div class="seg" id="m3dView"><button data-v="axo" aria-pressed="true">3/4</button><button data-v="front" aria-pressed="false">Front</button><button data-v="left" aria-pressed="false">Left</button><button data-v="back" aria-pressed="false">Rear</button><button data-v="top" aria-pressed="false">Top</button></div>
        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="m3dX"> X-ray the existing walls</label>
      </div></div>
    <div class="m3d-q"><div class="eyebrow">Kit schedule, counted from the model</div><dl id="m3dQ"></dl></div></div>`;
  $("#opts").addEventListener("click", e => { const bt = e.target.closest(".opt"); if (!bt) return; S.pick[b.id] = res.picks.find(p => p.key === bt.dataset.k); paintStudio(b); });
  mount3d(b, pk);
  const box = $("#scat");
  box.addEventListener("pointermove", e => {
    const svg = $("svg", box), r = svg.getBoundingClientRect(), k = sc.W / r.width, vx = (e.clientX - r.left) * k, vy = (e.clientY - r.top) * k;
    let best = null, bd = 1e9; for (const c of res.cands) { const d = (sc.X(c.cost) - vx) ** 2 + (sc.Y(c.a) - vy) ** 2; if (d < bd) { bd = d; best = c; } }
    if (!best || bd > 200) { hideTip(); return; }
    showTip(e, tipRows(`${best.a} m² · ${best.rooms} bed`, [["Cost", eurk(best.cost)], ["Frame", best.frame.id], ["Ground floor", best.str.id], ["PV · battery", `${best.pv} kWp · ${best.batt} kWh`], ["P(C ≥ 1)", pct(best.pOK)], ["Status", best.pareto ? "best trade-off" : best.feasible ? "feasible" : best.pOK < 0.9 ? "fails safety" : "outside brief"]]));
  });
  box.addEventListener("pointerleave", hideTip);
}

// ---------- 3D viewer in the Studio ----------
function mount3d(b, pk) {
  if (S.m3d) { S.m3d.dispose(); S.m3d = null; }
  clearInterval(S.m3dTimer);
  const el = $("#m3d"); if (!el) return;
  const api = A3D.mount(el, b, { a: pk.a, pv: pk.pv, str: pk.str.id });
  if (!api) { $(".m3d-side").hidden = true; return; }
  S.m3d = api;
  const q = api.Q, rows = [["New home, floor area", `${nf(q.moduleArea)} m²`], ["Roof terrace", `${nf(q.terrace)} m²`], ["Floor joists, LGS", q.joists], ["Wall studs, LGS", q.studs], ["Roof joists, LGS", q.roofJoists], ["Façade panels", q.panels], ["Mosaic-screen tiles", q.tiles], ["PV modules, 420 W", `${q.pv} · ${nf(q.pv * 0.42, 1)} kWp`], [pk.str.id === "jacket" ? "Column jackets" : "Steel braces, ground floor", pk.str.id === "jacket" ? q.jackets : q.braces], ["Transfer beams, steel", q.tfBeams], ["Stair treads", q.treads], ["Starter bars cut back", q.anamones]];
  $("#m3dQ").innerHTML = rows.map(r => `<div><dt>${esc(r[0])}</dt><dd>${esc(String(r[1]))}</dd></div>`).join("");
  const setStep = n => { n = Math.max(0, Math.min(8, n)); S.m3dStep = n; api.setStep(n); $("#m3dN").textContent = `${n} of 8`; $("#m3dT").textContent = A3D.STEPS[n].t; $("#m3dD").textContent = A3D.STEPS[n].d; $$("#m3dSteps button").forEach((x, i) => { x.classList.toggle("done", i < n); if (i === n) x.setAttribute("aria-current", "step"); else x.removeAttribute("aria-current"); }); };
  setStep(S.m3dStep ?? 8); api.setExplode(!!S.m3dEx, true);
  $("#m3dSteps").addEventListener("click", e => { const bt = e.target.closest("button"); if (!bt) return; clearInterval(S.m3dTimer); setStep(+bt.dataset.s); });
  $("#m3dPrev").addEventListener("click", () => { clearInterval(S.m3dTimer); setStep(S.m3dStep - 1); });
  $("#m3dNext").addEventListener("click", () => { clearInterval(S.m3dTimer); setStep(S.m3dStep + 1); });
  $("#m3dPlay").addEventListener("click", () => { clearInterval(S.m3dTimer); let n = 0; setStep(0); S.m3dTimer = setInterval(() => { n++; if (n > 8) { clearInterval(S.m3dTimer); return; } setStep(n); }, 1700); });
  $("#m3dMode").addEventListener("click", e => { const bt = e.target.closest("button"); if (!bt) return; S.m3dEx = bt.dataset.m === "1"; $$("#m3dMode button").forEach(x => x.setAttribute("aria-pressed", x === bt)); api.setExplode(S.m3dEx); });
  $("#m3dView").addEventListener("click", e => { const bt = e.target.closest("button"); if (!bt) return; $$("#m3dView button").forEach(x => x.setAttribute("aria-pressed", x === bt)); api.setView(bt.dataset.v); });
  $("#m3dX").addEventListener("change", e => api.setXray(e.target.checked));
}

// ---------- Permit pre-check and assistant ----------
const KBBY = Object.fromEntries(KB.map(k => [k.id, k]));
const cite = ids => ids.map(id => `<a class="cite" href="${esc(KBBY[id].url)}" target="_blank" rel="noopener" title="${esc(KBBY[id].source_title)}">${id}</a>`).join("");
function precheck(b) {
  const pk = S.pick[b.id]; const area = pk ? pk.a : Math.min(120, Math.round(b.footprint * 0.8 / 5) * 5);
  const limit = b.plot >= 1000 ? 180 : 150, free = b.plot - b.footprint;
  const R = [];
  R.push([b.use === "block" ? "fail" : "pass", "Building type", b.use === "block" ? "Units in apartment blocks are excluded. Use the block route." : "A house on its own plot, not a unit in an apartment block.", ["K09", "K10"]]);
  R.push([b.in_arch ? "fail" : "pass", "Protected and controlled areas", b.in_arch ? "Plot lies in an area controlled under the Antiquities Law." : "Not in a controlled archaeological area, listed building or Area of Special Character (demo zone data).", ["K09", "K10"]]);
  R.push(["check", "Tourist zone and development boundary", "Confirm with the EOA that the plot is inside the development boundary and outside a tourist zone.", ["K09"]]);
  R.push(["check", "Existing house is legal", "Attach the planning permission and building permit of the existing house, with all permit conditions met.", ["K08"]]);
  R.push([area <= limit ? "pass" : "fail", "Size of the new home", `${area} m² against a limit of ${limit} m²${b.plot >= 1000 ? " (plot of 1,000 m² or more)" : ""}.`, ["K07"]]);
  R.push([free >= 25 ? "pass" : "check", "Parking", free >= 25 ? `About ${nf(free)} m² of free plot area for the required parking space.` : "Little free plot area: plan for the €2,000 parking buyout.", ["K11"]]);
  R.push(["check", "All co-owners sign", "If the plot is co-owned and someone will not sign, the application can go through Article 90.", ["K18"]]);
  R.push(["info", "Structural check of the house below", b.year < 1994 ? "The scheme texts do not mention one. ANAMONI requires an engineer's assessment for pre-1994 houses, in line with ETEK practice for major renovations." : "The scheme texts do not mention one. ANAMONI requires the engineer to confirm the capacity check.", ["K19", "K37", "K38"]]);
  R.push(["info", "Deadlines", `Apply to the EOA by 31 Dec 2027 (${nf(daysLeft())} days left). After planning permission, apply for the building permit within one year.`, ["K12", "K13", "K14"]]);
  R.push(["info", "After completion", "The new home cannot be sold or transferred for 10 years, except by inheritance.", ["K16"]]);
  return { R, area };
}
const SUGG = REC.chat.map(c => c.q);
function renderFlow() {
  const v = $("#v-flow"), b = BY[S.sel], pc = precheck(b);
  const n = k => pc.R.filter(r => r[0] === k).length;
  v.innerHTML = `
  <div class="g-2">
    <div class="stack">
      <div class="panel"><div class="ph"><h3>Permit pre-check</h3><span class="sub">${b.id} · new home ${pc.area} m²</span><span class="sp"></span><span class="st pass">${ICON.pass}${n("pass")}</span><span class="st check">${ICON.check}${n("check")}</span><span class="st fail">${ICON.fail}${n("fail")}</span></div>
        <div class="scroll"><table class="tbl"><thead><tr><th>Status</th><th>Rule</th><th>Finding</th><th>Source</th></tr></thead><tbody>
        ${pc.R.map(([k, rule, f, ids]) => `<tr><td>${st(k, { pass: "Pass", check: "Check", fail: "Fail", info: "Note" }[k])}</td><td style="font-weight:500">${esc(rule)}</td><td class="small">${esc(f)}</td><td style="white-space:nowrap">${cite(ids)}</td></tr>`).join("")}
        </tbody></table></div>
        <div class="pb note" style="border-top:1px solid var(--line)">A pre-check finds gaps before the file reaches the EOA. It is not a planning decision. Every rule cites the source it was checked against.</div></div>
      <div class="panel"><details><summary class="ph"><h3>Knowledge base</h3><span class="sub">${KB.length} sourced rules the assistant may use</span><span class="sp"></span><span class="tag">show</span></summary>
        <div class="pb" style="max-height:420px;overflow:auto">${KB.map(k => `<div class="kbitem"><b>${k.id}</b>${esc(k.en)} <a href="${esc(k.url)}" target="_blank" rel="noopener" class="small">${esc(k.source_title)}</a></div>`).join("")}</div></details></div>
    </div>
    <div class="panel chat"><div class="ph"><h3>Scheme assistant</h3><span class="sub">answers only from the sourced rules, in Greek or English</span><span class="sp"></span><span id="chatMode"></span></div>
      <div class="msgs" id="msgs"></div>
      <div class="sugg">${SUGG.map((q, i) => `<button data-i="${i}">${esc(q)}</button>`).join("")}</div>
      <form class="composer" id="composer"><input id="q" placeholder="Ask about the family-home scheme…" autocomplete="off" aria-label="Question"><button class="btn primary" id="sendBtn" type="submit">${ICON.send}Ask</button><button class="btn" id="stopBtn" type="button" hidden>${ICON.stop}Stop</button></form>
    </div>
  </div>`;
  $("#chatMode").innerHTML = S.aiState === "live" ? aiBadge("live") : `<span class="tag">recorded answers</span>`;
  paintChat();
  $(".sugg").addEventListener("click", e => { const bt = e.target.closest("button"); if (bt) ask(SUGG[+bt.dataset.i]); });
  $("#composer").addEventListener("submit", e => { e.preventDefault(); const q = $("#q").value.trim(); if (q) { $("#q").value = ""; ask(q); } });
  $("#stopBtn").addEventListener("click", () => S.chatCtl && S.chatCtl.abort());
}
function answerHTML(text) {
  const ids = [...new Set((text.match(/K\d{2}/g) || []).filter(id => KBBY[id]))];
  const body = esc(text).replace(/\[((?:K\d{2}(?:,\s*)?)+)\]/g, (m, g) => g.split(/,\s*/).filter(id => KBBY[id]).map(id => `<a class="cite" href="${esc(KBBY[id].url)}" target="_blank" rel="noopener">${id}</a>`).join(""));
  const groups = new Map(); for (const id of ids) { const k = KBBY[id]; if (!groups.has(k.url)) groups.set(k.url, { t: k.source_title, ids: [] }); groups.get(k.url).ids.push(id); }
  const srcs = ids.length ? `<div class="srcs">${[...groups].map(([u, g]) => `<a href="${esc(u)}" target="_blank" rel="noopener"><span class="mono">${g.ids.join(", ")}</span> · ${esc(g.t)}</a>`).join("")}</div>` : "";
  return body + srcs;
}
function paintChat() {
  const m = $("#msgs"); if (!m) return;
  if (!S.chat.length) { m.innerHTML = `<div class="muted small" style="margin:auto;text-align:center;max-width:320px">Ask a question about building a home for your child on your roof, or pick a suggestion below.</div>`; return; }
  m.innerHTML = S.chat.map(c => c.role === "user" ? `<div class="msg u">${esc(c.content)}</div>` : `<div class="msg a">${c.pending ? `<span class="aistate"><span class="pulse"></span>Thinking…</span>` : answerHTML(c.content)}${c.pending ? "" : `<div class="meta">${aiBadge(c.src)}${c.note ? `<span>${esc(c.note)}</span>` : ""}</div>`}</div>`).join("");
  const last = m.lastElementChild; if (last) m.scrollTop = Math.max(0, last.offsetTop - m.offsetTop - 12); 
}
function kbPrompt() {
  return `You are the ANAMONI scheme assistant for residents of Paphos, Cyprus. Answer ONLY from the knowledge base entries below, which summarise official announcements of the housing schemes announced on 9 September 2026 and related rules.
Rules:
- End every factual sentence with the IDs of the entries that support it, in square brackets, for example [K07] or [K12, K13].
- If the knowledge base does not answer the question, say so plainly and suggest asking EOA Paphos (the District Self-Government Organisation). Never use outside knowledge and never guess.
- Where sources disagree, say so.
- Never make a legal determination, and never say a building is safe. For structural questions, say that a licensed civil engineer must assess the house.
- Reply in the language of the question (Greek or English), in plain words, in at most 170 words. No headings.

Knowledge base:
` + KB.map(k => `${k.id} | ${k.topic} | ${k.en} | ${k.el} | ${k.source_title} (${k.date})`).join("\n");
}
async function ask(q) {
  if (S.chatBusy) return;
  S.chat.push({ role: "user", content: q });
  const a = { role: "assistant", content: "", pending: true, src: S.aiState === "live" ? "live" : "recorded" }; S.chat.push(a); paintChat();
  const rec = REC.chat.find(c => c.q === q);
  const replay = async (note) => { a.pending = false; a.src = "recorded"; a.note = note || ""; const full = rec.a; for (let i = 0; i <= full.length; i += 6) { a.content = full.slice(0, i); paintChat(); await new Promise(r => setTimeout(r, 12)); } a.content = full; paintChat(); };
  if (S.aiState === "live") {
    S.chatBusy = true; S.chatCtl = new AbortController(); $("#sendBtn").hidden = true; $("#stopBtn").hidden = false;
    const turns = [{ role: "user", content: kbPrompt() }];
    for (const c of S.chat.slice(0, -1).slice(-7)) if (!c.pending && c.content) turns.push({ role: c.role, content: c.content });
    try {
      await S.ai(turns, { cache: false, signal: S.chatCtl.signal, onText: ({ text }) => { a.pending = false; a.content = text; paintChat(); } });
      a.pending = false; a.src = "live"; paintChat();
    } catch (e) {
      const msg = aiErr(e);
      if (rec && !e.text) await replay(msg); else { a.pending = false; a.content = (e.text || "") + (e.text ? "\n\n" : "") + msg; a.src = "live"; paintChat(); }
    } finally { S.chatBusy = false; const sb = $("#sendBtn"), xb = $("#stopBtn"); if (sb) sb.hidden = false; if (xb) xb.hidden = true; }
  } else if (rec) { await replay(); }
  else { a.pending = false; a.src = "recorded"; a.content = "Live AI is not available in this view, so I can only replay the suggested questions below. Open the live link to ask your own question."; paintChat(); }
}

// ---------- Co-owner split (exact Shapley value) ----------
const FLATS = [
  { id: "1A", floor: 1, side: "S", area: 92 }, { id: "1B", floor: 1, side: "N", area: 78 },
  { id: "2A", floor: 2, side: "S", area: 92 }, { id: "2B", floor: 2, side: "N", area: 78 },
  { id: "3A", floor: 3, side: "S", area: 92, top: true }, { id: "3B", floor: 3, side: "N", area: 78, top: true },
];
const COST = { G: 68000, FS: 54000, FN: 46000, R: 9000, mS: 7500, mN: 6000 };
function coCost(Sx) {
  if (!Sx.length) return 0; const f = Sx.map(i => FLATS[i]);
  return COST.G + (f.some(x => x.side === "S") ? COST.FS : 0) + (f.some(x => x.side === "N") ? COST.FN : 0) + (f.some(x => x.top) ? COST.R : 0) + f.reduce((a, x) => a + (x.side === "S" ? COST.mS : COST.mN), 0);
}
function renderCoown() {
  const v = $("#v-coown"), b = HBLOCK;
  const t0 = performance.now(); const sh = ENG.shapley(FLATS, coCost); const ms = performance.now() - t0;
  const total = coCost(FLATS.map((_, i) => i)), A = FLATS.reduce((a, f) => a + f.area, 0);
  const before = b.exRef[2], after = ENG.exceed([0, 0, 1, 0], 1, ENG.REF_PGA * (b.in_marl ? ENG.SOIL.marl / ENG.SOIL.base : 1))[2];
  const rows = FLATS.map((f, i) => {
    const energy = (f.side === "S" ? 380 : 260) + (f.top ? 220 : 0), value = 0.07 * f.area * 1900;
    const share = sh.phi[i];
    const parts = { G: COST.G / 6, F: (f.side === "S" ? COST.FS / 3 : COST.FN / 3), R: f.top ? COST.R / 2 : 0, m: f.side === "S" ? COST.mS : COST.mN };
    return { f, share, eq: total / 6, ar: total * f.area / A, energy, value, benefit: value + 15 * energy, net: share - value - 15 * energy, parts };
  });
  const mx = Math.max(...rows.map(r => r.share));
  v.innerHTML = `
  <div class="panel"><div class="pb" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
    <div><div class="eyebrow">Apartment block · exoskeleton route</div><div style="font:600 26px var(--mono);letter-spacing:-.02em;margin-top:2px">${b.id}</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">permit ${b.year}</span><span class="tag">${b.storeys} storeys</span><span class="tag">open ground floor</span><span class="tag">balconies: ${b.bal_cond}</span><span class="tag">6 flats</span></div>
    <span style="flex:1"></span>${prioTag(b.prio.p)}<button class="btn" id="selBlock">Show on map</button>
  </div></div>
  <div class="g-2">
    <div class="panel"><div class="ph"><h3>Fair cost split</h3><span class="sub">exact Shapley value over ${nf(sh.perms)} joining orders · ${nf(ms, 1)} ms</span></div>
      <div class="scroll"><table class="tbl"><thead><tr><th>Flat</th><th class="n">m²</th><th>Shapley share</th><th class="n">Equal split</th><th class="n">15-yr benefit</th><th class="n">Gap</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="mono" style="white-space:nowrap">${r.f.id}<div class="small muted" style="font-family:var(--sans)">${r.f.side === "S" ? "street" : "rear"}${r.f.top ? " · top" : ""}</div></td><td class="n">${r.f.area}</td>
        <td style="min-width:130px"><div class="stackbar" style="height:10px;width:${(r.share / mx) * 100}%;margin-top:4px" title="Ground floor and foundations ${eur(r.parts.G)}, facade frame ${eur(r.parts.F)}${r.parts.R ? ", roof " + eur(r.parts.R) : ""}, own balcony module ${eur(r.parts.m)}"><span style="flex:${r.parts.G};background:var(--accent)"></span><span style="flex:${r.parts.F};background:var(--g-side)"></span>${r.parts.R ? `<span style="flex:${r.parts.R};background:var(--g-str)"></span>` : ""}<span style="flex:${r.parts.m};background:var(--ink-3)"></span></div><div class="mono small" style="margin-top:3px">${eur(r.share)}</div></td>
        <td class="n muted">${eur(r.eq)}</td><td class="n">${eur(r.benefit)}</td><td class="n">${eur(r.net)}</td></tr>`).join("")}
      <tr><td><b>Total</b></td><td class="n">${A}</td><td class="mono"><b>${eur(total)}</b></td><td class="n muted">${eur(total)}</td><td class="n">${eur(rows.reduce((a, r) => a + r.benefit, 0))}</td><td class="n">${eur(rows.reduce((a, r) => a + r.net, 0))}</td></tr>
      </tbody></table></div>
      <div class="pb" style="border-top:1px solid var(--line);display:grid;gap:8px"><div class="legend-row"><span><i style="background:var(--accent);height:8px;border-radius:2px"></i>ground floor and foundations</span><span><i style="background:var(--g-side);height:8px;border-radius:2px"></i>facade frame</span><span><i style="background:var(--g-str);height:8px;border-radius:2px"></i>roof insulation</span><span><i style="background:var(--ink-3);height:8px;border-radius:2px"></i>own balcony module</span></div>
      <div class="note">15-year benefit = value uplift (7% of flat value at €1,900/m²) + 15 years of energy savings. The gap, about €${nf(Math.min(...rows.map(r => r.net)) / 180)} to €${nf(Math.max(...rows.map(r => r.net)) / 180)} a month per flat over 15 years, is what energy-renovation grants and green loans must close, and it is why blocks are a public-safety case as well as a private one. The split gives the owners' general meeting a transparent basis for its decision.</div></div></div>
    <div class="stack">
      <div class="panel"><div class="ph"><h3>Why Shapley and not an equal split</h3></div><div class="pb small" style="display:grid;gap:8px;color:var(--ink-2)">
        <p style="margin:0">Each flat pays the average extra cost it adds when it joins, taken over every possible order of joining. Costs that only some flats cause stay with them: the rear frame is shared by the rear flats, and roof insulation by the top floor. The strengthened ground floor, which protects everyone, is shared equally.</p>
        <p style="margin:0">The split is transparent, and each owner can check it line by line. It is the only split that is efficient, symmetric and additive at the same time, which makes it easy to defend at a general meeting.</p></div></div>
      <div class="panel"><div class="ph"><h3>What the retrofit buys</h3><span class="sub">at the reference shaking of ${ENG.REF_PGA} g</span></div><div class="pb" style="display:grid;gap:12px">
        ${barsHTML([["As built", Math.round(before * 100), "var(--p1)"], ["With exoskeleton", Math.round(after * 100), "var(--p4)"]]).replace(/<span class="n">(\d+)<\/span>/g, '<span class="n">$1%</span>')}
        <div class="note">Probability of extensive damage or worse. The retrofit removes the soft-storey effect and lifts the frame to a low-seismic-design class (screening model, to be confirmed by the engineer's design).</div>
        <table class="tbl"><tbody>
          <tr><td>Ground-floor strengthening and exoskeleton foundations</td><td class="n">${eur(COST.G)}</td></tr>
          <tr><td>Street-side steel frame with new balconies and shading</td><td class="n">${eur(COST.FS)}</td></tr>
          <tr><td>Rear steel frame</td><td class="n">${eur(COST.FN)}</td></tr>
          <tr><td>Roof insulation (top floor)</td><td class="n">${eur(COST.R)}</td></tr>
          <tr><td>Balcony and shading modules, per flat</td><td class="n">${eur(COST.mS)} / ${eur(COST.mN)}</td></tr>
        </tbody></table></div></div>
    </div>
  </div>`;
  $("#selBlock").addEventListener("click", () => { select(b.id); go("overview"); });
}

// ---------- Earthquake scenario ----------
const RBINS = [[0, 0.05, "p5", "< 5%"], [0.05, 0.15, "p4", "5–15%"], [0.15, 0.3, "p3", "15–30%"], [0.3, 0.5, "p2", "30–50%"], [0.5, 1.01, "p1", "≥ 50%"]];
const rcol = p => `var(--${RBINS.find(r => p >= r[0] && p < r[1])[2]})`;
function renderResil() {
  const v = $("#v-resil");
  v.innerHTML = `
  <div class="panel"><div class="ph"><h3>Scenario</h3><span class="sub">the same passports, run against an earthquake</span><span class="sp"></span><div class="seg" id="scSeg">${ENG.SCEN.map(s => `<button data-s="${s.id}" aria-pressed="${S.scen.id === s.id}">${esc(s.name)}</button>`).join("")}<button data-s="custom" aria-pressed="${S.scen.id === "custom"}">Custom</button></div></div>
    <div class="pb" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:end">
      <div class="field"><label for="scM">Magnitude <span class="mono" id="scMv"></span></label><input id="scM" type="range" min="5" max="7.5" step="0.1" value="${S.scen.M}"></div>
      <div class="field"><label for="scR">Distance to pilot district <span class="mono" id="scRv"></span></label><input id="scR" type="range" min="5" max="80" step="1" value="${S.scen.R}"></div>
      <div class="note" id="scNote"></div>
    </div></div>
  <div class="kpis" id="scK" style="grid-template-columns:repeat(5,minmax(0,1fr))"></div>
  <div class="g-ov">
    <div class="panel"><div class="ph"><h3>Probability of extensive damage or worse</h3><span class="sub">by building</span></div><div class="mapwrap" id="scMap"></div></div>
    <div class="stack">
      <div class="panel"><div class="ph"><h3>Inspection order after the shaking</h3><span class="sub">risk to people first</span></div>
        <div class="scroll" style="max-height:360px"><table class="tbl" id="scList"><thead><tr><th class="n">#</th><th>ID</th><th>Type</th><th class="n">PGA</th><th class="n">P(ext.)</th><th class="n">Hh</th></tr></thead><tbody></tbody></table></div></div>
      <div class="panel"><div class="ph"><h3>Expected damage mix</h3></div><div class="pb" id="scDist"></div></div>
    </div>
  </div>
  <div class="callout"><b>After a real earthquake</b> the list is re-ranked with new imagery from fleet cameras, drones and satellites, compared with each building's baseline, and with readings from low-cost accelerometers on the Municipality's LoRaWAN network: a drop in a building's natural frequency moves it up the list. Engineers then inspect with ETEK's post-earthquake form.</div>`;
  const upd = () => {
    const M = +$("#scM").value, R = +$("#scR").value; S.scen.M = M; S.scen.R = R;
    $("#scMv").textContent = "M" + M.toFixed(1); $("#scRv").textContent = R + " km";
    const sc = ENG.scenario(D, M, R);
    const pref = ENG.SCEN.find(s => s.id === S.scen.id);
    $("#scNote").textContent = pref ? pref.note + "." : "Custom scenario.";
    const insp = B.filter(b => b.sc.ex[2] >= 0.3).length;
    $("#scK").innerHTML = `
      <div class="kpi"><div class="eyebrow">Ground shaking</div><div class="v">${sc.pmin.toFixed(2)}–${sc.pmax.toFixed(2)}<small>g</small></div><div class="d">peak ground acceleration at the buildings</div></div>
      <div class="kpi"><div class="eyebrow">Extensive damage+</div><div class="v">${nf(sc.expExt)}</div><div class="d">expected buildings, of ${nf(B.length)}</div></div>
      <div class="kpi"><div class="eyebrow">People needing shelter</div><div class="v">${nf(Math.round(sc.expDisp / 10) * 10)}</div><div class="d">estimate, 2.6 people per household</div></div>
      <div class="kpi"><div class="eyebrow">Inspect first</div><div class="v">${nf(insp)}</div><div class="d">buildings with P(extensive) ≥ 30%</div></div>
      <div class="kpi"><div class="eyebrow">Engineer-days</div><div class="v">${nf(Math.ceil(insp / 6))}</div><div class="d">first pass, about six rapid inspections a day</div></div>`;
    const w = $("#scMap"); w.innerHTML = mapSVG(b => rcol(b.sc.ex[2]), { label: "Scenario damage map" }) + mapChrome("P(extensive or worse)", RBINS.map(r => [`var(--${r[2]})`, r[3]]));
    if (!w._bound) { bindMap(w, id => { select(id); }, b => tipRows(b.id, [["Type", USE[b.use]], ["PGA", b.sc.pga.toFixed(3) + " g"], ["P(extensive+)", pct(b.sc.ex[2])], ["P(complete)", pct(b.sc.ex[3])], ["Households", b.households]])); w._bound = true; } else scaleFix(w);
    const L = [...B].sort((a, c) => (c.sc.ex[2] * (1 + Math.log(c.households))) - (a.sc.ex[2] * (1 + Math.log(a.households)))).slice(0, 30);
    $("#scList tbody").innerHTML = L.map((b, i) => `<tr class="click" data-id="${b.id}" aria-selected="${b.id === S.sel}"><td class="n muted">${i + 1}</td><td class="mono">${b.id}</td><td>${USE[b.use]}</td><td class="n">${b.sc.pga.toFixed(2)}</td><td class="n">${pct(b.sc.ex[2])}</td><td class="n">${b.households}</td></tr>`).join("");
    const dcol = ["var(--line-2)", "var(--p5)", "var(--p4)", "var(--p2)", "var(--p1)"], dn = ["None", "Slight", "Moderate", "Extensive", "Complete"];
    $("#scDist").innerHTML = `<div class="stackbar" style="height:16px;margin-bottom:12px">${sc.dist.map((x, i) => x > 0.3 ? `<span style="flex:${x};background:${dcol[i]}"></span>` : "").join("")}</div><table class="tbl"><tbody>${sc.dist.map((x, i) => `<tr><td><span class="gk"><i style="background:${dcol[i]}"></i>${dn[i]}</span></td><td class="n">${nf(x, 0)}</td><td class="n muted">${pct(x / B.length)}</td></tr>`).join("")}</tbody></table><div class="note" style="margin-top:8px">Expected number of buildings in each damage state. Ground motion from a simplified attenuation relation (Campbell 1997 form) with site factors; the pilot uses the ESHM20 hazard model through OpenQuake.</div>`;
  };
  let raf = 0; const sched = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(upd); };
  $("#scSeg").addEventListener("click", e => { const bt = e.target.closest("button"); if (!bt) return; S.scen.id = bt.dataset.s; $$("#scSeg button").forEach(x => x.setAttribute("aria-pressed", x === bt)); const p = ENG.SCEN.find(s => s.id === S.scen.id); if (p) { $("#scM").value = p.M; $("#scR").value = p.R; } sched(); });
  ["scM", "scR"].forEach(id => $("#" + id).addEventListener("input", () => { S.scen.id = "custom"; $$("#scSeg button").forEach(x => x.setAttribute("aria-pressed", x.dataset.s === "custom")); sched(); }));
  $("#scList").addEventListener("click", e => { const tr = e.target.closest("tr[data-id]"); if (tr) { select(tr.dataset.id); $$("#scList tr").forEach(r => r.setAttribute("aria-selected", r === tr)); } });
  upd();
}

// ---------- Method & safeguards ----------
function renderMethod() {
  const v = $("#v-method");
  const K = [
    ["Screening form from a photo", "Live AI", "A vision-language model (Claude) reads a facade photo and fills rapid-visual-screening fields with evidence, region and confidence.", "Pilot: an open-weight model hosted in the Municipality's data centre, checked against engineers' ratings."],
    ["Feature detection on the district", "Synthetic data", "Pilot district K is procedurally generated: geometry, attributes and detections are demo data. No real building or address appears.", "Pilot: YOLO and Segment Anything fine-tuned on 300–500 engineer-labelled Paphos buildings."],
    ["Structural type", "Computed live", "Bayesian fusion: a prior from the permit year, updated by image evidence (column grid visible, facade detailing).", "Pilot: adds census period, footprint shape and satellite ground motion (EGMS)."],
    ["Damage probability", "Computed live", "Lognormal fragility curves per type, mixed over the type probabilities and adjusted for soft storeys, glazed ground floors, height and irregularity.", "Pilot: ESRM20 fragility models plus Cypriot studies."],
    ["Can it carry a floor?", "Computed live", "Capacity index C = ground-floor lateral resistance ÷ seismic demand, 400 Monte Carlo samples over materials, geometry and type, for concrete and light floors, with and without strengthening.", "Pilot: a physics-informed surrogate trained on OpenSees simulations of Cypriot frames, updated with site tests."],
    ["Design options", "Computed live", "Exhaustive search over the kit of parts (up to about 1,500 configurations), each capacity-checked, then filtered to the Pareto front on cost, area and energy savings.", "Pilot: continuous NSGA-II search, room-graph layouts, EnergyPlus and IFC export."],
    ["Scheme assistant", "Live AI", "Answers only from the sourced knowledge base shown in Permit & assistant, cites every claim and refuses legal determinations.", "Pilot: retrieval over the full official texts in Greek and English."],
    ["Co-owner split", "Computed live", "Exact Shapley value over all 720 joining orders of a six-flat block.", "Pilot: benefits from the passport and real quotes."],
    ["Earthquake scenario", "Computed live", "Simplified attenuation (Campbell 1997 form) with site factors, run through the same fragility models.", "Pilot: ESHM20 hazard and OpenQuake scenario engine."],
  ];
  const tagFor = s => s === "Live AI" ? `<span class="tag" style="border-color:var(--accent);color:var(--accent)">${ICON.spark}${s}</span>` : s === "Synthetic data" ? `<span class="tag" style="color:var(--warn-ink)">${s}</span>` : `<span class="tag">${s}</span>`;
  const P = [["Reference shaking for ranking", `${ENG.REF_PGA} g on firm ground; soft-soil factor ${(ENG.SOIL.marl / ENG.SOIL.base).toFixed(2)}`], ["Priority cut-offs, P(extensive)", ENG.PRIO_T.map((t, i) => `P${i + 1} ≥ ${t}`).join(" · ")], ["Seismic demand", `2.5 × a × S / q, with q = ${ENG.CAP.q}`], ["Floor weights", `concrete ${ENG.CAP.addRC} kN/m² · light kit ${ENG.CAP.addLGS} kN/m² · pergola ${ENG.CAP.pergola} kN/m²`], ["Safety threshold", "C ≥ 1 in at least 90% of simulations"], ["Kit rates", `light-gauge steel €${ENG.KIT.frames[0].eur}/m² · hybrid €${ENG.KIT.frames[1].eur}/m²`], ["Solar", `${ENG.SOLAR.kwpPerM2} kWp/m² on ${pct(ENG.SOLAR.usable)} of the roof · ${ENG.SOLAR.yield} kWh/kWp a year`]];
  v.innerHTML = `
  <div class="callout"><b>What this proof of concept is.</b> It runs the full ANAMONI chain on a synthetic pilot district of ${nf(B.length)} buildings: screen, passport, capacity check, design, permit pre-check, co-owner split and earthquake scenario. The two AI steps that read images and law run live on Claude where the viewer allows it, and replay recorded runs elsewhere. Every other number on screen is computed in your browser from the models below. Parameters are screening-level and indicative, and they are replaced by engineer-validated values in the pilot.</div>
  <div class="panel" id="tbPanel"><div class="ph"><h3>Test bench</h3><span class="sub">automated checks on the engines, the safety rules and the data, run in your browser</span><span class="sp"></span><span id="tbSum" class="mono small"></span><button class="btn" id="tbRun">${ICON.play}Run again</button></div>
    <div class="scroll"><table class="tbl tb"><thead><tr><th style="width:74px">Result</th><th style="width:46px">ID</th><th>Check</th><th>What was measured</th><th class="n" style="width:70px">Time</th></tr></thead><tbody id="tbRows"><tr><td colspan="5" class="muted small">Running…</td></tr></tbody></table></div></div>
  <div class="panel" id="evPanel"><div class="ph"><h3>Assistant evaluation</h3><span class="sub">${TESTS.EVAL.length} resident questions in Greek and English, scored automatically</span><span class="sp"></span><div class="seg" id="evMode"><button data-m="rec" aria-pressed="true">Recorded answers</button><button data-m="live" aria-pressed="false">Run live on Claude</button></div></div>
    <div class="ev-metrics" id="evM"></div>
    <div class="scroll"><table class="tbl tb"><thead><tr><th>Question</th><th style="width:88px">Expected</th><th class="n" style="width:78px">Cites valid</th><th class="n" style="width:80px">Right rule</th><th class="n" style="width:82px">Sentences cited</th><th class="n" style="width:76px">Behaviour</th><th style="width:70px">Result</th></tr></thead><tbody id="evRows"></tbody></table></div>
    <div class="pb note small" style="border-top:1px solid var(--line)">A pass needs every citation to point to a real rule, at least one citation to the rule the question is about, the expected behaviour (answer, flag conflicting sources, say the sources are silent and point to the EOA, defer to an engineer, or decline a legal ruling), no claim that a building is safe, and a reply in the language of the question. The live run sends all ${TESTS.EVAL.length} questions to Claude in one call.</div></div>
  <div class="panel"><div class="ph"><h3>Components</h3><span class="sub">what runs in this demo and what the pilot adds</span></div>
    <div class="scroll"><table class="tbl"><thead><tr><th>Component</th><th>In this demo</th><th>Method</th><th>In the pilot</th></tr></thead><tbody>
    ${K.map(k => `<tr><td style="font-weight:500">${esc(k[0])}</td><td>${tagFor(k[1])}</td><td class="small">${esc(k[2])}</td><td class="small muted">${esc(k[3].replace(/^Pilot: /, ""))}</td></tr>`).join("")}
    </tbody></table></div></div>
  <div class="g-2">
    <div class="panel"><div class="ph"><h3>Safeguards</h3><span class="sub">built to the EU AI Act's high-risk standard</span></div><div class="pb"><table class="tbl"><tbody>
      <tr><td style="font-weight:500">Never says "safe"</td><td class="small">Outputs are priority levels and probabilities. Uncertainty moves a building up the list, never down.</td></tr>
      <tr><td style="font-weight:500">Engineer signs</td><td class="small">ANAMONI ranks and designs. A licensed engineer assesses on site and signs every design.</td></tr>
      <tr><td style="font-weight:500">Privacy by design</td><td class="small">Public-street imagery only, faces and plates blurred on the device, a DPIA before capture, scores visible only to owners and authorities.</td></tr>
      <tr><td style="font-weight:500">No public red list</td><td class="small">Public maps are aggregated to street or block level. This demo uses synthetic buildings so that no real address sits next to a score.</td></tr>
      <tr><td style="font-weight:500">Transparent evidence</td><td class="small">Each reading shows its evidence and confidence, and each rule shows its source.</td></tr>
      <tr><td style="font-weight:500">Bias checks</td><td class="small">Error rates audited by neighbourhood, building age and owner profile; extra labelled data for older areas.</td></tr>
      <tr><td style="font-weight:500">Works without AI</td><td class="small">If a model is unsure or offline, the case falls back to today's manual route: ETEK forms and conventional design.</td></tr>
    </tbody></table></div></div>
    <div class="panel"><div class="ph"><h3>Model parameters</h3><span class="sub">indicative values used here</span></div><div class="pb"><table class="tbl"><tbody>
      ${P.map(p => `<tr><td>${esc(p[0])}</td><td class="mono small" style="text-align:right">${esc(p[1])}</td></tr>`).join("")}
      ${ENG.TYPES.map(t => `<tr><td>${esc(t.tax)} medians (g)</td><td class="mono small" style="text-align:right">${t.med.join(" / ")} · β ${t.beta}</td></tr>`).join("")}
    </tbody></table></div></div>
  </div>
  <div class="panel"><div class="ph"><h3>Sources</h3></div><div class="pb small" style="columns:2 320px;column-gap:28px">
    ${[...new Map(KB.map(k => [k.url, k])).values()].map(k => `<div style="break-inside:avoid;margin-bottom:6px"><a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.source_title)}</a> <span class="muted">${/^\d/.test(k.date) ? esc(k.date.slice(0, 10)) : ""}</span></div>`).join("")}
    <div style="break-inside:avoid;margin-bottom:6px"><a href="https://nhess.copernicus.org/articles/24/3049/2024/" target="_blank" rel="noopener">ESHM20 European seismic hazard model (NHESS, 2024)</a></div>
  </div></div>`;
  const paintTB = r => {
    const G = { Models: "Models", Safety: "Safety rules", Data: "Data and sources" }; let last = "";
    $("#tbRows").innerHTML = r.results.map(t => { const h = t.group !== last ? `<tr class="grp"><td colspan="5">${G[t.group]}</td></tr>` : ""; last = t.group; return h + `<tr><td>${st(t.ok ? "pass" : "fail", t.ok ? "Pass" : "Fail")}</td><td class="mono small">${t.id}</td><td style="font-weight:500">${esc(t.name)}</td><td class="small">${esc(t.detail)}</td><td class="n mono small">${nf(t.ms, 0)} ms</td></tr>`; }).join("");
    $("#tbSum").innerHTML = `<b style="color:${r.pass === r.total ? "var(--good-ink)" : "var(--crit-ink)"}">${r.pass} / ${r.total} pass</b> · ${nf(r.ms / 1000, 1)} s`;
  };
  const runTB = () => { $("#tbSum").textContent = "running…"; setTimeout(() => { S.tests = TESTS.runEngine(); paintTB(S.tests); }, 30); };
  if (S.tests) paintTB(S.tests); else runTB();
  $("#tbRun").addEventListener("click", runTB);
  const KIND = { answer: "answer", conflict: "flag conflict", unknown: "say unknown", defer: "defer to engineer", refuse: "decline" };
  const yes = (v, t) => v ? `<span class="mono small" style="color:var(--good-ink)">${t || "yes"}</span>` : `<span class="mono small" style="color:var(--crit-ink)">${t || "no"}</span>`;
  const paintEv = (r, label) => {
    const m = r.sum;
    $("#evM").innerHTML = [["Questions", `${m.n}`], ["Passed", `${m.pass} / ${m.n}`], ["Citations valid", pct(m.valid)], ["Cites the right rule", pct(m.grounded)], ["Sentences with a citation", pct(m.coverage)], ["Expected behaviour", pct(m.behaviour)], ["Language matched", pct(m.lang)]].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("") + `<div class="ev-src">${label}</div>`;
    $("#evRows").innerHTML = r.rows.map((x, i) => `<tr class="evr" data-i="${i}"><td class="small">${esc(x.q)}</td><td><span class="tag">${KIND[x.kind]}</span></td><td class="n mono small">${pct(x.s.valid)}</td><td class="n">${yes(x.s.grounded)}</td><td class="n mono small">${pct(x.s.coverage)}</td><td class="n">${yes(x.s.behaviour)}</td><td>${st(x.s.pass ? "pass" : "fail", x.s.pass ? "Pass" : "Fail")}</td></tr><tr class="eva" hidden><td colspan="7"><div class="small" style="white-space:pre-wrap;color:var(--ink-2)">${x.a ? answerHTML(x.a) : "No answer returned."}</div></td></tr>`).join("")
      + (r.live ? "" : `<tr class="grp"><td colspan="7">Live set · run on Claude to score</td></tr>` + TESTS.EVAL.map(x => `<tr><td class="small muted">${esc(x.q)}</td><td><span class="tag">${KIND[x.kind]}</span></td><td class="n mono small muted">·</td><td class="n mono small muted">${x.ids.join(", ") || "none"}</td><td class="n mono small muted">·</td><td class="n mono small muted">·</td><td class="small muted">not run</td></tr>`).join(""));
  };
  const showRec = () => paintEv(TESTS.scoreRecorded(), "recorded answers from the Permit & assistant view");
  if (S.evLive) paintEv(S.evLive, `live run on Claude · ${nf(S.evLive.ms / 1000, 0)} s`); else showRec();
  if (S.evLive) $$("#evMode button").forEach(x => x.setAttribute("aria-pressed", x.dataset.m === "live"));
  $("#evRows").addEventListener("click", e => { const tr = e.target.closest("tr.evr"); if (!tr) return; const n = tr.nextElementSibling; n.hidden = !n.hidden; });
  $("#evMode").addEventListener("click", async e => {
    const bt = e.target.closest("button"); if (!bt) return;
    if (bt.dataset.m === "rec") { $$("#evMode button").forEach(x => x.setAttribute("aria-pressed", x === bt)); if (S.evCtl) S.evCtl.abort(); showRec(); return; }
    if (S.aiState !== "live" || !S.ai) { toast("Live AI is not available in this view. Open the live link to run the evaluation."); return; }
    $$("#evMode button").forEach(x => x.setAttribute("aria-pressed", x === bt));
    $("#evM").innerHTML = `<div class="ev-src"><span class="aistate"><span class="pulse"></span>Claude is answering ${TESTS.EVAL.length} questions. This usually takes one to two minutes.</span></div>`; $("#evRows").innerHTML = "";
    S.evCtl = new AbortController();
    try { S.evLive = await TESTS.runEval(S.ai, S.evCtl.signal); S.evLive.live = true; if (S.view === "method") paintEv(S.evLive, `live run on Claude · ${nf(S.evLive.ms / 1000, 0)} s`); }
    catch (err) { if (S.view === "method") { toast(aiErr(err)); $$("#evMode button").forEach(x => x.setAttribute("aria-pressed", x.dataset.m === "rec")); showRec(); } }
  });
}

// ---------- navigation ----------
const VIEWS = { overview: ["City", "City scan", renderOverview], resil: ["City", "Earthquake scenario", renderResil], passport: ["Building", "Building passport", renderPassport], scan: ["Building", "Screen a photo", renderScan], studio: ["Delivery", "Design studio", renderStudio], flow: ["Delivery", "Permit & assistant", renderFlow], coown: ["Delivery", "Co-owner split", renderCoown], method: ["About", "Method & safeguards", renderMethod] };
function go(view) {
  if (!VIEWS[view]) return; S.view = view; hideTip();
  if (view !== "studio" && S.m3d) { S.m3d.dispose(); S.m3d = null; clearInterval(S.m3dTimer); }
  for (const k of Object.keys(VIEWS)) $("#v-" + k).hidden = k !== view;
  $$("#nav button").forEach(bt => bt.setAttribute("aria-current", bt.dataset.view === view ? "page" : "false"));
  $("#crumb").textContent = VIEWS[view][0]; $("#vtitle").textContent = VIEWS[view][1];
  VIEWS[view][2](); $("#app").classList.remove("nav-open");
  try { history.replaceState(null, "", "#" + view); } catch { }
  window.scrollTo({ top: 0 });
}
function select(id) {
  if (!BY[id]) return; S.sel = id;
  if (S.view === "overview") { drawOverviewMap(); renderSelSummary(); $$("#queue tr[data-id]").forEach(r => r.setAttribute("aria-selected", r.dataset.id === id)); }
  if (S.view === "resil") { const w = $("#scMap"); $$(".bd", w).forEach(p => p.classList.toggle("sel", p.dataset.id === id)); }
}
function boot() {
  $("#sf-n").textContent = `K · ${B.length} bldgs`;
  $("#ids").innerHTML = B.map(b => `<option value="${b.id}">`).join("");
  $("#deadline span:last-child").textContent = `${nf(daysLeft())} days to scheme deadline`;
  $("#nav").addEventListener("click", e => { const bt = e.target.closest("button[data-view]"); if (bt) go(bt.dataset.view); });
  document.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) go(g.dataset.go); });
  $("#menuBtn").addEventListener("click", () => $("#app").classList.toggle("nav-open"));
  $("#pick").addEventListener("change", e => { const id = e.target.value.trim().toUpperCase(); if (BY[id]) { select(id); if (S.view !== "overview" && S.view !== "resil") VIEWS[S.view][2](); toast(`Selected ${id}`); e.target.value = ""; } else toast("No building with that ID"); });
  document.addEventListener("keydown", e => { if (e.target.closest("input,textarea,select") || e.metaKey || e.ctrlKey || e.altKey) return; const k = +e.key; const keys = Object.keys(VIEWS); const order = ["overview", "resil", "passport", "scan", "studio", "flow", "coown", "method"]; if (k >= 1 && k <= 8) go(order[k - 1]); });
  addEventListener("resize", () => $$(".mapwrap").forEach(scaleFix));
  setAIChip(); initAI().then(() => { if (S.view === "flow") $("#chatMode").innerHTML = S.aiState === "live" ? aiBadge("live") : `<span class="tag">recorded answers</span>`; });
  addEventListener("hashchange", () => { const h = (location.hash || "").slice(1); if (VIEWS[h] && h !== S.view) go(h); });
  const h = (location.hash || "").slice(1); go(VIEWS[h] ? h : "overview");
}
boot();
