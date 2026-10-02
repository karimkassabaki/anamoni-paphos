/* ANAMONI engines. Everything here runs in the browser and is deterministic.
   Parameters are screening-level and indicative; they are shown in the Method view.
   Nothing in this file certifies a building. */
"use strict";
const ENG = (() => {
  // ---------- maths ----------
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function normal(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const quant = (arr, q) => { const s = [...arr].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };

  // ---------- structural typologies (ESRM20-style classes, simplified) ----------
  const TYPES = [
    { id: "MUR", name: "Unreinforced masonry", tax: "MUR/LWAL/DNO", med: [0.06, 0.12, 0.22, 0.40], beta: 0.65 },
    { id: "CDN", name: "RC frame, no seismic design", tax: "CR/LFINF/CDN", med: [0.09, 0.18, 0.34, 0.60], beta: 0.60 },
    { id: "CDL", name: "RC frame, low seismic design", tax: "CR/LFINF/CDL", med: [0.13, 0.27, 0.50, 0.85], beta: 0.60 },
    { id: "CDM", name: "RC frame, moderate seismic design", tax: "CR/LFINF/CDM", med: [0.18, 0.37, 0.70, 1.20], beta: 0.60 },
  ];
  const DS = ["Slight", "Moderate", "Extensive", "Complete"];
  function eraPrior(year) {
    if (year < 1960) return [0.55, 0.45, 0, 0];
    if (year < 1974) return [0.20, 0.78, 0.02, 0];
    if (year < 1994) return [0.04, 0.90, 0.06, 0];
    if (year < 2012) return [0, 0.05, 0.80, 0.15];
    return [0, 0, 0.15, 0.85];
  }
  // likelihood of the visual evidence "RC column grid visible on facade" given each type
  const L_FRAME = { yes: [0.12, 0.85, 0.85, 0.85], no: [0.88, 0.15, 0.15, 0.15] };
  const L_DETAIL = { old: [0.7, 0.55, 0.25, 0.1], modern: [0.3, 0.45, 0.75, 0.9] }; // facade detailing era cue

  function trueType(b) { // hidden "truth" for the synthetic district, drawn from the prior
    const r = rng(hash(b.id + "type")); const p = eraPrior(b.year); let u = r(), acc = 0;
    for (let i = 0; i < 4; i++) { acc += p[i]; if (u <= acc) return i; } return 1;
  }
  function posterior(prior, ev) {
    let p = prior.map((x, i) => x * L_FRAME[ev.frame][i] * L_DETAIL[ev.detail][i]);
    const s = p.reduce((a, c) => a + c, 0) || 1; return p.map(x => x / s);
  }
  function modifiers(b) { // multiplicative factors on fragility medians
    let m = 1; const why = [];
    if (b.gf === "pilotis") { m *= 0.65; why.push(["Open ground floor (soft storey)", 0.65]); }
    else if (b.gf === "shopfront") { m *= 0.8; why.push(["Glazed ground floor (weak storey)", 0.8]); }
    if (b.storeys >= 4) { m *= 0.9; why.push(["Four or more storeys", 0.9]); }
    if (b.irregular) { m *= 0.9; why.push(["Plan or vertical irregularity", 0.9]); }
    return { m, why };
  }
  const SOIL = { base: 1.2, marl: 1.45 };
  function exceed(post, mod, pga) { // P(DS >= k) mixture over typology posterior
    return [0, 1, 2, 3].map(k => post.reduce((acc, w, t) => w ? acc + w * Phi(Math.log(pga / (TYPES[t].med[k] * mod)) / TYPES[t].beta) : acc, 0));
  }
  const REF_PGA = 0.25; // reference shaking for ranking (rock, g)

  // ---------- capacity screen: can the ground floor carry a new storey? ----------
  const CAP = {
    wFloor: [13, 11, 11, 11],               // kN/m2 per storey (masonry heavier)
    rhoC: [0.0, 0.011, 0.015, 0.019],        // column area / floor area (median)
    tauC: [0.0, 0.75, 1.0, 1.25],            // MPa effective column shear strength (median)
    rhoI: { closed: 0.020, shopfront: 0.006, pilotis: 0.002 }, tauI: 0.18,
    rhoWallMur: 0.040, tauMur: 0.10,
    q: 1.5, plateau: 2.5,
    addRC: 11.5, addLGS: 3.1, addHYB: 3.6, pergola: 0.25, upJacket: 2.2, upBrace: 1.75,
  };
  function demandCoef(b, aref = REF_PGA) { return CAP.plateau * aref * (b.in_marl ? SOIL.marl : SOIL.base) / CAP.q; }
  // Monte Carlo capacity index C = V_R / V_d for several scenarios
  function capacity(b, post, opt = {}) {
    const N = opt.N || 400, r = rng(hash(b.id + "cap" + (opt.salt || "")));
    const A = b.footprint, n = b.storeys, S = demandCoef(b);
    const addA = opt.addArea != null ? opt.addArea : Math.min(A, 150);
    const scen = opt.scen || [
      { key: "existing", label: "As built", add: 0, jacket: false },
      { key: "rc", label: "+ concrete floor", add: CAP.addRC, jacket: false },
      { key: "rcS", label: "+ concrete + strengthening", add: CAP.addRC, jacket: true },
      { key: "kit", label: "+ ANAMONI light kit", add: CAP.addLGS, jacket: false },
      { key: "kitS", label: "+ light kit + strengthening", add: CAP.addLGS, jacket: true },
    ];
    const cum = []; let acc = 0; post.forEach(p => { acc += p; cum.push(acc); });
    const out = scen.map(s => ({ ...s, samples: [] }));
    for (let i = 0; i < N; i++) {
      const u = r(); let t = cum.findIndex(c => u <= c); if (t < 0) t = 1;
      const w = CAP.wFloor[t] * Math.exp(0.08 * normal(r));
      const W = n * A * w;
      let vr;
      const rhoI = CAP.rhoI[b.gf] * Math.exp(0.3 * normal(r));
      if (t === 0) vr = A * (CAP.rhoWallMur * Math.exp(0.25 * normal(r)) * CAP.tauMur) * 1000;
      else vr = A * (CAP.rhoC[t] * Math.exp(0.22 * normal(r)) * CAP.tauC[t] * Math.exp(0.25 * normal(r)) + rhoI * CAP.tauI) * 1000;
      const zc = CAP.rhoC[t] * Math.exp(0.22 * normal(r)) * CAP.tauC[t];
      const vrUp = f => t === 0 ? vr * (f - 0.25) : vr + A * zc * (f - 1) * 1000; // strengthening uplift on the ground-floor resisting term
      for (const s of out) {
        const Wt = W + (s.add ? addA * (s.add + (s.pergola ? CAP.pergola : 0)) : 0);
        const f = s.jacket === "brace" ? CAP.upBrace : s.jacket ? CAP.upJacket : 0;
        s.samples.push((f ? vrUp(f) : vr) / (S * Wt));
      }
    }
    for (const s of out) {
      s.p10 = quant(s.samples, 0.1); s.p50 = quant(s.samples, 0.5); s.p90 = quant(s.samples, 0.9);
      s.pOK = s.samples.filter(x => x >= 1).length / s.samples.length;
    }
    return out;
  }

  // ---------- evidence for the synthetic district (what Scan "sees") ----------
  function evidence(b) {
    const r = rng(hash(b.id + "ev")), t = b._true;
    const frameSeen = (t === 0 ? r() < 0.12 : r() < 0.85);
    const oldDetail = r() < [0.7, 0.55, 0.25, 0.1][t];
    const conf = (x) => Math.round(clamp(x, 0.5, 0.99) * 100) / 100;
    const det = [];
    det.push({ k: "storeys", label: `Storeys above ground: ${b.storeys}`, c: conf(0.9 + r() * 0.08) });
    det.push({ k: "gf", label: { closed: "Closed ground floor", shopfront: "Glazed ground floor (shop front)", pilotis: "Open ground floor on columns (pilotis)" }[b.gf], c: conf(0.8 + r() * 0.17) });
    if (b.balconies === "cantilever") det.push({ k: "bal", label: `Cantilever balconies: ${b.bal_cond}`, c: conf(b.bal_cond === "sound" ? 0.7 + r() * 0.2 : 0.62 + r() * 0.25) });
    if (b.anamones) det.push({ k: "anam", label: "Rooftop starter bars (anamones)", c: conf(0.82 + r() * 0.16) });
    if (b.solar_heater) det.push({ k: "sol", label: "Solar water heater and tank", c: conf(0.9 + r() * 0.09) });
    if (b.irregular) det.push({ k: "irr", label: "Irregular plan or setbacks", c: conf(0.55 + r() * 0.2) });
    det.push({ k: "frame", label: frameSeen ? "RC column grid visible on facade" : "No column grid visible", c: conf(0.6 + r() * 0.3) });
    return { frame: frameSeen ? "yes" : "no", detail: oldDetail ? "old" : "modern", det };
  }

  // ---------- growth potential ----------
  const GROWTH = {
    ok: { label: "Light module", short: "Light module", color: "var(--g-ok)" },
    str: { label: "Light module after strengthening", short: "After strengthening", color: "var(--g-str)" },
    side: { label: "Build beside on the plot", short: "Build beside", color: "var(--g-side)" },
    block: { label: "Apartment block: exoskeleton route", short: "Block route", color: "var(--g-na)" },
    excl: { label: "Excluded zone (scheme does not apply)", short: "Excluded", color: "var(--g-na)" },
    none: { label: "No addition recommended", short: "No addition", color: "var(--g-na)" },
  };
  function growth(b, cap) {
    if (b.use === "block") return "block";
    if (b.in_arch) return "excl";
    const kit = cap.find(s => s.key === "kit"), kitS = cap.find(s => s.key === "kitS");
    if (kit.pOK >= 0.9) return "ok";
    if (kitS.pOK >= 0.9) return "str";
    return (b.plot - b.footprint) > 110 ? "side" : "none";
  }

  // ---------- solar ----------
  const SOLAR = { usable: 0.45, kwpPerM2: 0.2, yield: 1600 };
  const solar = b => { const kwp = b.footprint * SOLAR.usable * SOLAR.kwpPerM2; return { kwp, kwh: kwp * SOLAR.yield }; };

  // ---------- priority ----------
  const PRIO_T = [0.55, 0.40, 0.25, 0.12]; // P(Extensive+) at reference shaking -> P1..P5
  function priority(b, ex, conf) {
    let s = ex[2];
    if (b.bal_cond === "spalling") s += 0.08;
    if (b.households >= 4) s += 0.04;
    let p = s >= PRIO_T[0] ? 1 : s >= PRIO_T[1] ? 2 : s >= PRIO_T[2] ? 3 : s >= PRIO_T[3] ? 4 : 5;
    let bumped = false;
    if (conf < 0.6 && p > 1) { p -= 1; bumped = true; } // uncertainty means inspect, never "safe"
    return { p, score: s, bumped };
  }

  // ---------- engineer checklist ----------
  function checks(b, post, g) {
    const c = [];
    if (b.year < 1994) c.push("Obtain the original permit drawings from the EOA archive; confirm design code and reinforcement.");
    c.push("Rebound hammer and cover-meter survey on ground-floor columns; take cores if readings are low.");
    if (b.gf === "pilotis") c.push("Measure ground-floor column sizes and stirrup spacing; check for short-column effects at parking walls.");
    if (b.gf === "shopfront") c.push("Check continuity of infill above the glazed ground floor (weak-storey mechanism).");
    if (b.bal_cond === "spalling") c.push("Urgent: inspect cantilever balcony slabs for corroded top reinforcement; restrict use until checked.");
    else if (b.bal_cond === "cracked") c.push("Inspect balcony slab edges and soffits for corrosion cracking.");
    if (b.anamones) c.push("Check the rooftop starter bars: corrosion, lap length and whether columns were designed to continue.");
    if (Math.max(...post) < 0.7) c.push("Structural type uncertain from imagery: confirm the load-bearing system on site.");
    if (b.in_marl) c.push("Site on a marl/soft-soil zone: consult the Geological Survey suitability map before adding load.");
    if (g === "str") c.push("Verify foundation capacity for the added load and the strengthening scheme.");
    return c;
  }

  // ---------- run the whole district ----------
  function run(district) {
    for (const b of district.buildings) {
      b._true = trueType(b);
      b.ev = evidence(b);
      b.prior = eraPrior(b.year);
      b.post = posterior(b.prior, b.ev);
      b.conf = Math.max(...b.post);
      b.typeIdx = b.post.indexOf(b.conf);
      b.mod = modifiers(b);
      b.exRef = exceed(b.post, b.mod.m, REF_PGA * (b.in_marl ? SOIL.marl : SOIL.base) / SOIL.base);
      b.cap = capacity(b, b.post);
      b.growth = growth(b, b.cap);
      b.solar = solar(b);
      b.prio = priority(b, b.exRef, b.conf);
      b.eligible = b.use !== "block" && !b.in_arch;
    }
    return district;
  }

  // ---------- Studio: kit-of-parts search ----------
  const KIT = {
    frames: [
      { id: "LGS", name: "Light-gauge steel frame", load: CAP.addLGS, eur: 1650 },
      { id: "HYB", name: "Steel frame + timber floor cassettes", load: CAP.addHYB, eur: 1760 },
    ],
    strengthen: [
      { id: "none", name: "None", cost: () => 0 },
      { id: "jacket", name: "Column jackets", cost: b => 1600 + 2300 * Math.max(4, Math.round(b.footprint / 16)) },
      { id: "brace", name: "Steel X-bracing", cost: b => 11000 + 45 * b.footprint },
    ],
    pv: [3, 4, 5, 6, 8], batt: [0, 5, 10],
    pvEur: 1050, pergolaEur: 2500, battEur: 600, feeDesign: 0.06, feePlatform: 0.03,
    tariff: 0.30, load: 4200,
  };
  const selfShare = (kwh, batt) => Math.min(KIT.load, kwh * (batt === 0 ? 0.38 : batt === 5 ? 0.62 : 0.74));
  function studio(b, brief) {
    const t0 = performance.now();
    const limit = b.plot >= 1000 ? 180 : 150;
    const maxA = Math.floor(Math.min(limit, b.footprint * 0.95) / 5) * 5;
    const minA = brief.rooms >= 3 ? 90 : brief.rooms === 2 ? 65 : 45;
    const areas = []; for (let a = 45; a <= maxA; a += 5) areas.push(a);
    const capCache = {};
    const cands = [];
    for (const a of areas) for (const f of KIT.frames) for (const s of KIT.strengthen) {
      const key = a + f.id + s.id;
      if (!capCache[key]) {
        const res = capacity(b, b.post, { N: 240, addArea: a, salt: key, scen: [{ key: "x", add: f.load, pergola: true, jacket: s.id === "none" ? false : s.id }] })[0];
        capCache[key] = res;
      }
      const cap = capCache[key];
      for (const pv of KIT.pv) for (const batt of KIT.batt) {
        if (pv / SOLAR.kwpPerM2 > a * 0.9) continue; // pergola must fit over the module
        const works = a * f.eur + s.cost(b) + pv * KIT.pvEur + KIT.pergolaEur + batt * KIT.battEur;
        const cost = works * (1 + KIT.feeDesign + KIT.feePlatform);
        const kwh = pv * SOLAR.yield; const self = selfShare(kwh, batt);
        const save = self * KIT.tariff;
        const feasible = cap.pOK >= 0.9 && a >= minA && a <= limit;
        cands.push({ a, frame: f, str: s, pv, batt, cost, works, kwh, self, save, pOK: cap.pOK, c50: cap.p50, c10: cap.p10, feasible, rooms: a >= 90 ? 3 : a >= 65 ? 2 : 1, key: `${a}-${f.id}-${s.id}-${pv}-${batt}` });
      }
    }
    const F = cands.filter(c => c.feasible);
    // Pareto front on (cost min, area max, savings max)
    for (const c of F) c.pareto = !F.some(d => d !== c && d.cost <= c.cost && d.a >= c.a && d.save >= c.save && (d.cost < c.cost || d.a > c.a || d.save > c.save));
    const P = F.filter(c => c.pareto);
    const within = P.filter(c => c.cost <= brief.budget);
    const pool = within.length ? within : P;
    const pickA = [...pool].sort((x, y) => x.cost - y.cost)[0];
    const pickB = [...pool].sort((x, y) => (y.a - x.a) || (x.cost - y.cost))[0];
    const pickC = [...pool].filter(c => c.pv >= 5 && c.batt >= 5).sort((x, y) => (y.save / y.cost - x.save / x.cost))[0] || [...pool].sort((x, y) => (y.save - x.save))[0];
    const picks = [];
    for (const [c, name, why] of [[pickA, "Compact", "Lowest cost that meets the brief and the safety threshold"], [pickB, "Family", "Most floor area within the budget"], [pickC, "Solar pergola", "Best self-consumed energy per euro"]]) {
      if (c && !picks.some(p => p.key === c.key)) picks.push({ ...c, name, why });
    }
    return { cands, feasible: F.length, pareto: P.length, picks, ms: performance.now() - t0, limit, minA, maxA };
  }

  // ---------- co-ownership: exact Shapley cost allocation ----------
  function shapley(players, costFn) {
    const n = players.length, phi = new Array(n).fill(0);
    const perms = []; const permute = (arr, l) => { if (l === arr.length) { perms.push(arr.slice()); return; } for (let i = l; i < arr.length; i++) { [arr[l], arr[i]] = [arr[i], arr[l]]; permute(arr, l + 1); [arr[l], arr[i]] = [arr[i], arr[l]]; } };
    permute([...Array(n).keys()], 0);
    for (const p of perms) { const S = []; let prev = costFn(S); for (const i of p) { S.push(i); const c = costFn(S); phi[i] += c - prev; prev = c; } }
    return { phi: phi.map(x => x / perms.length), perms: perms.length };
  }

  // ---------- resilience: scenario ground motion ----------
  // Campbell (1997)-form attenuation for horizontal PGA on firm ground (indicative, for demonstration)
  function pgaRock(M, Rkm) { const f = 0.149 * Math.exp(0.647 * M); return Math.exp(-3.512 + 0.904 * M - 1.328 * Math.log(Math.sqrt(Rkm * Rkm + f * f))); }
  const SCEN = [
    { id: "arc", name: "Offshore, Cyprus Arc", M: 6.6, R: 50, note: "Similar to 11 Jan 2022, about 50 km off the Paphos coast" },
    { id: "y1953", name: "1953-type onshore", M: 6.3, R: 22, note: "Magnitude of the 10 Sep 1953 Paphos earthquake (Mw 6.3, Ms 6.5) at a near-field distance" },
    { id: "y1995", name: "1995-type", M: 5.9, R: 40, note: "Similar to 23 Feb 1995, about 40 km north-west of Paphos" },
  ];
  function scenario(district, M, R) {
    let expExt = 0, expDisp = 0; const dist = [0, 0, 0, 0, 0]; let pmin = 9, pmax = 0;
    const W = district.meta.width, H = district.meta.height;
    for (const b of district.buildings) {
      const dx = (b.cx - W / 2) / 1000, dy = (b.cy - H / 2) / 1000;
      const Rb = Math.max(1, Math.hypot(R + dx * 0.7, dy));
      const pga = pgaRock(M, Rb) * (b.in_marl ? SOIL.marl : SOIL.base);
      pmin = Math.min(pmin, pga); pmax = Math.max(pmax, pga);
      const ex = exceed(b.post, b.mod.m, pga);
      b.sc = { pga, ex };
      expExt += ex[2]; expDisp += ex[2] * b.households * 2.6;
      const probs = [1 - ex[0], ex[0] - ex[1], ex[1] - ex[2], ex[2] - ex[3], ex[3]];
      probs.forEach((p, i) => dist[i] += p);
    }
    return { expExt, expDisp, dist, pmin, pmax };
  }

  return { TYPES, DS, GROWTH, CAP, SOIL, SOLAR, KIT, REF_PGA, PRIO_T, SCEN, eraPrior, posterior, modifiers, exceed, capacity, growth, solar, priority, checks, run, studio, shapley, pgaRock, scenario, rng, hash, Phi, quant, demandCoef };
})();
