/* ANAMONI UI, part 1: helpers, state, drawing primitives, map, elevation */
"use strict";
const D = JSON.parse(document.getElementById("d-district").textContent);
const KB = JSON.parse(document.getElementById("d-kb").textContent);
const REC = JSON.parse(document.getElementById("d-rec").textContent);
ENG.run(D);
const B = D.buildings;
const BY = Object.fromEntries(B.map(b => [b.id, b]));
const HERO = B.find(b => b.hero), HBLOCK = B.find(b => b.heroBlock);

const S = {
  view: "overview", sel: HERO.id, layer: "prio", sample: null, ai: null, aiState: "checking",
  brief: { rooms: 2, budget: 190000, stepfree: true }, studio: {}, pick: {},
  chat: [], scen: { id: "y1953", M: 6.3, R: 22 }, rlayer: "ext", scanRes: null, scanImg: null,
};

// ---------- tiny helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = x => "€" + nf(Math.round(x / 100) * 100);
const eurk = x => "€" + nf(x / 1000, x < 100000 ? 1 : 0) + "k";
const pct = (x, d = 0) => nf(x * 100, d) + "%";
const PCOL = p => `var(--p${p})`;
const PNAME = { 1: "Highest", 2: "High", 3: "Medium", 4: "Low", 5: "Lowest" };
const USE = { house: "Family house", block: "Apartment block", shophouse: "Shop-house" };
const GFN = { closed: "Closed", shopfront: "Glazed shop front", pilotis: "Open (pilotis)" };
const DEADLINE = new Date("2027-12-31T23:59:59+02:00");
const daysLeft = () => Math.max(0, Math.ceil((DEADLINE - new Date()) / 86400000));
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2200); }
const ICON = {
  pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/></svg>',
  fail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 20 4l-6 16-3-7z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4.5v15l12-7.5z"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
};
const st = (kind, label) => `<span class="st ${kind}">${ICON[kind]}${esc(label)}</span>`;
const prioTag = p => `<span class="prio"><i style="background:${PCOL(p)}"></i>P${p} · ${PNAME[p]}</span>`;
const growTag = g => `<span class="gk"><i style="background:${ENG.GROWTH[g].color}"></i>${esc(ENG.GROWTH[g].short)}</span>`;
function capColor(p) { return p >= 0.9 ? "var(--good)" : p >= 0.5 ? "var(--warn)" : "var(--crit)"; }
function capKind(p) { return p >= 0.9 ? "pass" : p >= 0.5 ? "check" : "fail"; }

// ---------- tooltip ----------
const tip = $("#tip");
function showTip(e, html) { tip.innerHTML = html; tip.classList.add("on"); moveTip(e); }
function moveTip(e) { const pad = 14, r = tip.getBoundingClientRect(); let x = e.clientX + pad, y = e.clientY + pad; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad; tip.style.left = x + "px"; tip.style.top = y + "px"; }
function hideTip() { tip.classList.remove("on"); }
const tipRows = (title, rows) => `<div class="h">${esc(title)}</div>` + rows.map(([k, v]) => `<div class="r"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
function bindTips(root, sel, fn) { root.addEventListener("pointermove", e => { const t = e.target.closest(sel); if (!t || !root.contains(t)) { hideTip(); return; } const h = fn(t); if (h) showTip(e, h); else hideTip(); }); root.addEventListener("pointerleave", hideTip); }

// ---------- map ----------
const pts = a => a.map(p => p.join(",")).join(" ");
const MAPBASE = (() => {
  const W = D.meta.width, H = D.meta.height;
  let s = `<defs><pattern id="hatch-arch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-3)" stroke-width=".5" opacity=".55"/></pattern></defs>`;
  s += `<rect width="${W}" height="${H}" fill="var(--map-street)"/>`;
  s += D.blocks.map(b => `<polygon class="bl" points="${pts(b)}"/>`).join("");
  s += B.map(b => `<polygon class="plot" points="${pts(b.plotgeom)}"/>`).join("");
  s += `<polygon class="zone-marl" points="${pts(D.zones.marl)}"/>`;
  return s;
})();
const ZARCH = `<text class="zlabel" x="${D.meta.width - 8}" y="16" text-anchor="end">SOFT-SOIL (MARL) ZONE</text><polygon class="zone-arch" points="${pts(D.zones.arch)}"/><text class="zlabel" x="10" y="343">CONTROLLED AREA</text><text class="zlabel" x="10" y="353">ANTIQUITIES LAW</text>`;
const SEQ = (i, n = 5) => `color-mix(in srgb, var(--accent) ${Math.round(22 + (78 * i) / (n - 1))}%, var(--map-block))`;
const ERA = [[0, 1960, "Before 1960"], [1960, 1974, "1960–1973"], [1974, 1994, "1974–1993"], [1994, 2012, "1994–2011"], [2012, 3000, "2012 onwards"]];
const LAYERS = {
  prio: { name: "Priority", color: b => PCOL(b.prio.p), legend: () => [1, 2, 3, 4, 5].map(p => [PCOL(p), `P${p} ${PNAME[p]}`]) },
  growth: { name: "Growth potential", color: b => ENG.GROWTH[b.growth].color, legend: () => ["ok", "str", "side"].map(g => [ENG.GROWTH[g].color, ENG.GROWTH[g].short]).concat([["var(--g-na)", "Block / excluded / none"]]) },
  solar: { name: "Rooftop solar", color: b => SEQ(Math.min(4, Math.floor(b.solar.kwp / 3))), legend: () => ["< 3", "3–6", "6–9", "9–12", "≥ 12"].map((l, i) => [SEQ(i), l + " kWp"]) },
  era: { name: "Construction era", color: b => { const i = ERA.findIndex(e => b.year >= e[0] && b.year < e[1]); return `color-mix(in srgb, var(--ink-2) ${Math.round(88 - i * 17)}%, var(--map-block))`; }, legend: () => ERA.map((e, i) => [`color-mix(in srgb, var(--ink-2) ${Math.round(88 - i * 17)}%, var(--map-block))`, e[2]]) },
};
function mapSVG(colorFn, opts = {}) {
  const W = D.meta.width, H = D.meta.height;
  const bd = B.map(b => `<polygon class="bd${b.id === S.sel ? " sel" : ""}" data-id="${b.id}" points="${pts(b.geom)}" fill="${colorFn(b)}"/>`).join("");
  const sel = BY[S.sel];
  const ring = sel ? `<circle cx="${sel.cx}" cy="${sel.cy}" r="16" fill="none" stroke="var(--ink)" stroke-width="1" opacity=".55"/><circle cx="${sel.cx}" cy="${sel.cy}" r="2.2" fill="var(--ink)"/>` : "";
  return `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || "District map")}">${MAPBASE}${bd}${ZARCH}${ring}</svg>`;
}
function mapChrome(legendTitle, items) {
  return `<div class="maplegend"><div class="t">${esc(legendTitle)}</div><div class="items">${items.map(([c, l]) => `<span class="gk"><i style="background:${c}"></i>${esc(l)}</span>`).join("")}</div></div>
  <div class="scalebar"><svg width="92" height="10" viewBox="0 0 92 10"><path d="M1 2v6h90V2M46 5v3" fill="none" stroke="currentColor" stroke-width="1"/></svg><span>100 m</span></div>
  <svg class="northarrow" width="16" height="28" viewBox="0 0 18 30" aria-label="North"><path d="M9 2 15 18 9 14 3 18z" fill="currentColor"/><text x="9" y="29" text-anchor="middle" font-family="var(--mono)" font-size="9" fill="currentColor">N</text></svg>`;
}
function scaleFix(wrap) { // 100 m at the map's current rendered width
  const svg = $("svg.map", wrap), sb = $(".scalebar svg", wrap); if (!svg || !sb) return;
  const px = svg.getBoundingClientRect().width * 100 / D.meta.width; sb.setAttribute("width", Math.max(20, px + 2)); sb.setAttribute("viewBox", `0 0 ${Math.max(20, px + 2)} 10`); sb.innerHTML = `<path d="M1 2v6h${px}V2" fill="none" stroke="currentColor" stroke-width="1"/>`;
}
function bindMap(wrap, onPick, tipFn) {
  wrap.addEventListener("click", e => { const t = e.target.closest(".bd"); if (t) onPick(t.dataset.id); });
  wrap.addEventListener("dblclick", e => { const t = e.target.closest(".bd"); if (t) { select(t.dataset.id); go("passport"); } });
  bindTips(wrap, ".bd", t => tipFn(BY[t.dataset.id]));
  requestAnimationFrame(() => scaleFix(wrap));
}
const bTip = b => tipRows(b.id, [["Type", USE[b.use]], ["Permit year", b.year], ["Storeys", b.storeys], ["Priority", `P${b.prio.p} ${PNAME[b.prio.p]}`], ["Growth", ENG.GROWTH[b.growth].short], ["Solar", nf(b.solar.kwp, 1) + " kWp"]]);

// ---------- elevation drawing (architectural front elevation, metres -> px) ----------
const PAL_CSS = { bg: "var(--raised)", wall: "var(--panel-2)", line: "var(--ink-2)", fine: "var(--line-2)", conc: "color-mix(in srgb, var(--ink-3) 30%, var(--panel))", glass: "color-mix(in srgb, var(--g-side) 16%, var(--raised))", void: "color-mix(in srgb, var(--ink) 16%, var(--raised))", rust: "var(--p2)", steel: "var(--ink)", timber: "#9A6B3F", pv: "#2C3E50", render: "var(--raised)", scr1: "var(--p4)", scr2: "var(--accent)", txt: "var(--ink-3)", det: "var(--accent)", detTxt: "var(--accent-ink)", jacket: "color-mix(in srgb, var(--accent) 45%, var(--panel))" };
const PAL_HEX = { bg: "#FFFFFF", wall: "#EFEEE9", line: "#3F423C", fine: "#BDBFB6", conc: "#CFCFC8", glass: "#DCE6EF", void: "#C9CAC4", rust: "#963314", steel: "#1C1E1B", timber: "#8B5E34", pv: "#2C3E50", render: "#F7F6F2", scr1: "#D4773F", scr2: "#1E4D38", txt: "#6E716A", det: "#1E4D38", detTxt: "#FFFFFF", jacket: "#9FB8A8" };
function elevation(b, o = {}) {
  const P = o.pal || PAL_CSS, sc = o.scale || 17;
  const w = Math.max(8.5, Math.min(b.use === "block" ? 22 : 16, b.use === "block" ? Math.sqrt(b.footprint) * 1.25 : b.frontage));
  const hG = 3.3, hU = 3.0, slab = 0.25, par = 0.6;
  const lv = [0]; for (let i = 1; i <= b.storeys; i++) lv.push(i === 1 ? hG : lv[i - 1] + hU);
  const roof = lv[b.storeys];
  const add = o.add, hM = 3.0;
  const roofItems = (add || o.reserve) ? hM + 2.6 : (b.solar_heater ? 1.9 : b.anamones ? 1.2 : 0.4);
  const mL = 3.4, mR = (add || o.reserve) ? 5.0 : 2.2, mT = 0.9, mB = 2.5;
  const Wm = mL + w + mR, Hm = mT + roof + slab + roofItems + mB;
  const X = x => (mL + x) * sc, G = (Hm - mB) * sc, Y = y => G - y * sc;
  const ncol = Math.max(2, Math.round(w / 4.2) + 1), cx = [...Array(ncol)].map((_, i) => (w - 0.3) * i / (ncol - 1));
  const colW = 0.3;
  let s = `<svg class="elev" viewBox="0 0 ${Wm * sc} ${Hm * sc}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.label || "Front elevation of " + b.id)}">`;
  if (o.pal === PAL_HEX) s += `<rect width="100%" height="100%" fill="${P.bg}"/>`;
  // ground + hatch
  s += `<line x1="${X(-2.6)}" x2="${X(w + 1.8)}" y1="${G}" y2="${G}" stroke="${P.line}" stroke-width="1.6"/>`;
  for (let x = -2.4; x < w + 1.8; x += 0.5) s += `<line x1="${X(x)}" y1="${G + 2}" x2="${X(x - 0.35)}" y2="${G + 0.4 * sc}" stroke="${P.fine}" stroke-width="1"/>`;
  // storeys
  for (let i = 0; i < b.storeys; i++) {
    const y0 = lv[i] + (i ? slab : 0), y1 = lv[i + 1];
    for (let k = 0; k < ncol - 1; k++) {
      const x0 = cx[k] + colW, x1 = cx[k + 1], bw = x1 - x0;
      if (i === 0 && b.gf === "pilotis") {
        s += `<rect x="${X(x0)}" y="${Y(y1)}" width="${bw * sc}" height="${(y1 - y0) * sc}" fill="${P.void}"/>`;
        s += `<rect x="${X(x0 + bw * 0.2)}" y="${Y(0.95)}" width="${bw * 0.6 * sc}" height="${0.55 * sc}" rx="${0.2 * sc}" fill="none" stroke="${P.fine}" stroke-width="1.2"/>`;
        continue;
      }
      if (i === 0 && b.gf === "shopfront") {
        s += `<rect x="${X(x0)}" y="${Y(y1 - 0.35)}" width="${bw * sc}" height="${(y1 - 0.35 - y0) * sc}" fill="${P.glass}" stroke="${P.line}" stroke-width="1"/>`;
        s += `<rect x="${X(x0)}" y="${Y(y1)}" width="${bw * sc}" height="${0.35 * sc}" fill="${P.wall}" stroke="${P.line}" stroke-width=".8"/>`;
        s += `<line x1="${X(x0 + bw / 2)}" x2="${X(x0 + bw / 2)}" y1="${Y(y1 - 0.35)}" y2="${Y(y0)}" stroke="${P.line}" stroke-width=".8"/>`;
        continue;
      }
      s += `<rect x="${X(x0)}" y="${Y(y1)}" width="${bw * sc}" height="${(y1 - y0) * sc}" fill="${P.wall}" stroke="${P.fine}" stroke-width=".8"/>`;
      const door = i === 0 && k === Math.floor((ncol - 1) / 2);
      if (door) { s += `<rect x="${X(x0 + bw / 2 - 0.5)}" y="${Y(y0 + 2.2)}" width="${sc}" height="${2.2 * sc}" fill="${P.void}" stroke="${P.line}" stroke-width="1"/>`; continue; }
      const ww = Math.min(1.6, bw * 0.45), wx = x0 + (bw - ww) / 2, wy = y0 + 0.95;
      s += `<rect x="${X(wx)}" y="${Y(wy + 1.3)}" width="${ww * sc}" height="${1.3 * sc}" fill="${P.glass}" stroke="${P.line}" stroke-width="1"/><line x1="${X(wx + ww / 2)}" x2="${X(wx + ww / 2)}" y1="${Y(wy + 1.3)}" y2="${Y(wy)}" stroke="${P.line}" stroke-width=".7"/>`;
    }
    // columns
    for (let k = 0; k < ncol; k++) {
      const jack = i === 0 && add && add.str === "jacket";
      const cw = jack ? 0.5 : colW, xx = cx[k] - (jack ? 0.1 : 0);
      s += `<rect x="${X(xx)}" y="${Y(y1)}" width="${cw * sc}" height="${(y1 - y0) * sc}" fill="${jack ? P.jacket : P.conc}" stroke="${P.line}" stroke-width="${jack ? 1.2 : .8}"/>`;
    }
    if (i === 0 && add && add.str === "brace") for (let k = 0; k < ncol - 1; k++) {
      if (k === Math.floor((ncol - 1) / 2) && ncol > 2) continue; // keep the entrance bay open
      const x0 = cx[k] + colW, x1 = cx[k + 1];
      s += `<path d="M${X(x0)} ${Y(y1)}L${X(x1)} ${Y(y0)}M${X(x1)} ${Y(y1)}L${X(x0)} ${Y(y0)}" stroke="${P.steel}" stroke-width="2.2" fill="none"/>`;
    }
    // slab above storey
    s += `<rect x="${X(-0.15)}" y="${Y(y1 + slab)}" width="${(w + 0.3) * sc}" height="${slab * sc}" fill="${P.conc}" stroke="${P.line}" stroke-width="1"/>`;
  }
  // balconies (cantilevers at upper floors)
  const balBoxes = [];
  if (b.balconies === "cantilever" && b.storeys >= 2) {
    const bx0 = cx[Math.floor((ncol - 1) / 2)] - 0.4, bx1 = Math.min(w + 0.4, bx0 + Math.max(3.6, w * 0.45));
    for (let i = 1; i < b.storeys; i++) {
      const yb = lv[i] + slab;
      s += `<rect x="${X(bx0)}" y="${Y(yb)}" width="${(bx1 - bx0) * sc}" height="${0.22 * sc}" fill="${P.conc}" stroke="${P.line}" stroke-width="1"/>`;
      s += `<line x1="${X(bx0)}" x2="${X(bx1)}" y1="${Y(yb + 1.0)}" y2="${Y(yb + 1.0)}" stroke="${P.line}" stroke-width="1.4"/>`;
      for (let x = bx0 + 0.1; x < bx1; x += 0.22) s += `<line x1="${X(x)}" x2="${X(x)}" y1="${Y(yb + 1.0)}" y2="${Y(yb)}" stroke="${P.line}" stroke-width=".55"/>`;
      if (!add || !add.newBal) {
        if (b.bal_cond === "cracked") s += `<path d="M${X(bx0 + 0.6)} ${Y(yb - 0.02)}l${0.2 * sc} ${0.12 * sc}l${0.18 * sc} -${0.08 * sc}l${0.22 * sc} ${0.1 * sc}M${X(bx1 - 1.2)} ${Y(yb - 0.02)}l${0.15 * sc} ${0.1 * sc}l${0.2 * sc} -${0.05 * sc}" stroke="${P.line}" stroke-width=".9" fill="none"/>`;
        if (b.bal_cond === "spalling") {
          s += `<path d="M${X(bx0 + 0.7)} ${Y(yb)}q${0.3 * sc} ${0.28 * sc} ${0.8 * sc} ${0.05 * sc}M${X(bx1 - 1.6)} ${Y(yb)}q${0.25 * sc} ${0.25 * sc} ${0.7 * sc} ${0.02 * sc}" fill="${P.void}" stroke="${P.line}" stroke-width=".8"/>`;
          s += `<path d="M${X(bx0 + 0.75)} ${Y(yb - 0.1)}h${0.7 * sc}M${X(bx1 - 1.55)} ${Y(yb - 0.1)}h${0.6 * sc}" stroke="${P.rust}" stroke-width="1.8"/>`;
        }
      }
      balBoxes.push([bx0, yb - 0.3, bx1, yb + 1.05]);
    }
  }
  // parapet
  s += `<rect x="${X(-0.15)}" y="${Y(roof + slab + par)}" width="${(w + 0.3) * sc}" height="${par * sc}" fill="${P.wall}" stroke="${P.line}" stroke-width="1"/>`;
  const top = roof + slab + par;
  let anamBox = null, solBox = null, modBox = null;
  if (!add) {
    if (b.anamones) {
      for (let k = 0; k < ncol; k++) {
        const x = cx[k] + 0.08;
        s += `<path d="M${X(x)} ${Y(top)}v-${0.95 * sc}q0 -${0.12 * sc} ${0.1 * sc} -${0.14 * sc}M${X(x + 0.14)} ${Y(top)}v-${0.8 * sc}q0 -${0.1 * sc} -${0.08 * sc} -${0.15 * sc}" stroke="${P.rust}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`;
      }
      anamBox = [-0.2, top, w + 0.2, top + 1.15];
    }
    if (b.solar_heater) {
      const sx = w - 3.3;
      s += `<path d="M${X(sx)} ${Y(top)}l${0.2 * sc} -${0.7 * sc}M${X(sx + 2.2)} ${Y(top)}v-${1.3 * sc}" stroke="${P.line}" stroke-width="1.1"/>`;
      s += `<polygon points="${X(sx)},${Y(top + 0.6)} ${X(sx + 2.2)},${Y(top + 1.35)} ${X(sx + 2.2)},${Y(top + 1.55)} ${X(sx)},${Y(top + 0.8)}" fill="${P.pv}" stroke="${P.line}" stroke-width=".8"/>`;
      s += `<rect x="${X(sx + 0.5)}" y="${Y(top + 1.85)}" width="${1.6 * sc}" height="${0.5 * sc}" rx="${0.25 * sc}" fill="${P.wall}" stroke="${P.line}" stroke-width="1"/>`;
      solBox = [sx - 0.1, top, sx + 2.4, top + 1.95];
    }
  } else {
    // new light-frame home, laid out exactly as in the 3D model
    const m0 = top - par, m1 = m0 + hM;
    const LY = A3D.layout(b, add.a), wm = LY.side ? Math.min(w - 0.4, LY.wm * w / LY.w) : w - 0.4;
    const inset = 0.2, mEnd = inset + wm;
    s += `<rect x="${X(inset)}" y="${Y(m1)}" width="${wm * sc}" height="${hM * sc}" fill="${P.render}" stroke="${P.line}" stroke-width="1.2"/>`;
    for (let x = inset + 1.2; x < mEnd - 0.05; x += 1.2) s += `<line x1="${X(x)}" x2="${X(x)}" y1="${Y(m1)}" y2="${Y(m0)}" stroke="${P.fine}" stroke-width=".7"/>`;
    const nb = Math.max(2, Math.round(wm / 2.3));
    for (let k = 0; k < nb; k++) {
      const bx = inset + wm * k / nb, bw = wm / nb;
      if (k === nb - 1) { // mosaic-pattern shading screen (Paphos Palette)
        const sx0 = bx + 0.2, sw = bw - 0.4, sy0 = m0 + 0.3, sh = hM - 0.7;
        s += `<rect x="${X(sx0)}" y="${Y(sy0 + sh)}" width="${sw * sc}" height="${sh * sc}" fill="${P.render}" stroke="${P.line}" stroke-width="1"/>`;
        const cell = 0.42;
        for (let yy = sy0 + cell / 2; yy < sy0 + sh - 0.1; yy += cell) for (let xx = sx0 + cell / 2; xx < sx0 + sw - 0.1; xx += cell) {
          const c = ((Math.round(xx / cell) + Math.round(yy / cell)) % 2) ? P.scr1 : P.scr2;
          s += `<rect x="${X(xx) - 0.11 * sc}" y="${Y(yy) - 0.11 * sc}" width="${0.22 * sc}" height="${0.22 * sc}" transform="rotate(45 ${X(xx)} ${Y(yy)})" fill="${c}" opacity=".85"/>`;
        }
      } else {
        const ww = Math.min(2.0, bw * 0.7), wx = bx + (bw - ww) / 2;
        s += `<rect x="${X(wx)}" y="${Y(m0 + 2.35)}" width="${ww * sc}" height="${1.95 * sc}" fill="${P.glass}" stroke="${P.line}" stroke-width="1.1"/><line x1="${X(wx + ww / 2)}" x2="${X(wx + ww / 2)}" y1="${Y(m0 + 2.35)}" y2="${Y(m0 + 0.4)}" stroke="${P.line}" stroke-width=".7"/>`;
      }
    }
    s += `<rect x="${X(inset - 0.15)}" y="${Y(m1 + 0.2)}" width="${(wm + 0.3) * sc}" height="${0.2 * sc}" fill="${P.steel}"/>`;
    // pergola with PV over the terrace (or over the module roof when there is no side terrace)
    const onMod = !(LY.side && w - mEnd > 2.2);
    const pBase = onMod ? m1 + 0.2 : m0, pH = onMod ? 0.5 : 2.6, p0 = pBase;
    const px0 = onMod ? inset + 0.2 : mEnd + 0.3, px1 = w - 0.3;
    if (!onMod) for (const x of [px0, (px0 + px1) / 2, px1]) s += `<rect x="${X(x - 0.07)}" y="${Y(p0 + pH)}" width="${0.14 * sc}" height="${pH * sc}" fill="${P.timber}"/>`;
    s += `<rect x="${X(px0 - 0.3)}" y="${Y(p0 + pH + 0.12)}" width="${(px1 - px0 + 0.6) * sc}" height="${0.14 * sc}" fill="${P.timber}"/>`;
    const nP = Math.max(3, Math.round((add.pv || 4) / 0.42 / 2));
    for (let k = 0; k < nP; k++) { const x = px0 - 0.25 + (px1 - px0 + 0.5) * k / nP; s += `<rect x="${X(x) + 1}" y="${Y(p0 + pH + 0.3)}" width="${(px1 - px0 + 0.5) / nP * sc - 2}" height="${0.16 * sc}" fill="${P.pv}"/>`; }
    // external stair to the terrace, on the right-hand side
    const stx = w + 0.25;
    s += `<path d="M${X(stx)} ${G}L${X(stx + 1.2)} ${Y(m0)}" stroke="${P.steel}" stroke-width="2"/>`;
    for (let y = 0.3; y < top - 0.4; y += 0.36) s += `<line x1="${X(stx + y / top * 1.2 - 0.18)}" x2="${X(stx + y / top * 1.2 + 0.18)}" y1="${Y(y)}" y2="${Y(y)}" stroke="${P.steel}" stroke-width="1.2"/>`;
    const pl = p0 + pH;
    modBox = [0, m0, w, pl + 0.3];
    s += `<text x="${X(w + 1.6)}" y="${Y(m0 + 1.6)}" font-family="IBM Plex Mono, PlexMono, monospace" font-size="${Math.max(9, sc * 0.55)}" fill="${P.txt}">NEW HOME</text><text x="${X(w + 1.6)}" y="${Y(m0 + 1.0)}" font-family="IBM Plex Mono, PlexMono, monospace" font-size="${Math.max(9, sc * 0.55)}" fill="${P.txt}">${add.a} m²</text>`;
  }
  // level marks + width dimension
  const lvls = [...lv.slice(0, b.storeys), roof].concat(add ? [roof + slab + hM] : []);
  for (const l of lvls) {
    const y = Y(l);
    s += `<path d="M${X(-2.1)} ${y}h${1.6 * sc}" stroke="${P.fine}" stroke-width=".8"/><path d="M${X(-0.9)} ${y}l-${0.18 * sc} -${0.3 * sc}h${0.36 * sc}z" fill="${P.line}"/>`;
    s += `<text x="${X(-3.3)}" y="${y - 3}" font-family="IBM Plex Mono, PlexMono, monospace" font-size="${Math.max(8.5, sc * 0.5)}" fill="${P.txt}">+${l.toFixed(2)}</text>`;
  }
  const dy = G + 1.2 * sc;
  s += `<path d="M${X(0)} ${dy}h${w * sc}M${X(0)} ${dy - 5}v10M${X(w)} ${dy - 5}v10" stroke="${P.line}" stroke-width=".9"/><text x="${X(w / 2)}" y="${dy + 13}" text-anchor="middle" font-family="IBM Plex Mono, PlexMono, monospace" font-size="${Math.max(8.5, sc * 0.5)}" fill="${P.txt}">${w.toFixed(1)} m frontage</text>`;
  // detections overlay
  if (o.detect && b.ev) {
    const box = (bx, label, c, inside) => {
      const [x0, y0, x1, y1] = bx; const fs = Math.max(8, sc * 0.4);
      const t = `${label} ${c.toFixed(2)}`; const tw = t.length * fs * 0.61 + 8, th = fs + 5;
      const above = !inside && Y(y1) - th > 2;
      const ly = above ? Y(y1) - th : Y(y1) + 1, lx = Math.min(X(x0), Wm * sc - tw - 2);
      return `<rect x="${X(x0)}" y="${Y(y1)}" width="${(x1 - x0) * sc}" height="${(y1 - y0) * sc}" fill="none" stroke="${P.det}" stroke-width="1.5"/><rect x="${lx}" y="${ly}" width="${tw}" height="${th}" fill="${P.det}"/><text x="${lx + 4}" y="${ly + th - 3.5}" font-family="IBM Plex Mono, PlexMono, monospace" font-size="${fs}" fill="${P.detTxt}">${esc(t)}</text>`;
    };
    const dmap = Object.fromEntries(b.ev.det.map(d => [d.k, d]));
    if (dmap.gf) s += box([-0.25, 0, w + 0.25, hG - 0.05], { closed: "closed ground floor", shopfront: "glazed ground floor", pilotis: "open ground floor" }[b.gf], dmap.gf.c, true);
    if (dmap.bal && balBoxes.length) { const bb = balBoxes[balBoxes.length - 1]; s += box([bb[0] - 0.1, bb[1], bb[2] + 0.1, bb[3]], "balcony: " + b.bal_cond, dmap.bal.c); }
    if (dmap.anam && anamBox) s += box(anamBox, "anamones", dmap.anam.c);
    if (dmap.sol && solBox) s += box(solBox, "solar heater", dmap.sol.c);
  }
  s += `</svg>`;
  return s;
}
