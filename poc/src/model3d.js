/* ANAMONI 3D: a buildable model of the demo house and its kit, generated from the passport and the chosen design.
   Units are metres, y is up, the front façade faces -z. Needs THREE (r128) as a global. */
"use strict";
const A3D = (() => {
  const C = {
    render: 0xE6E0D2, conc: 0xBDBAB0, concDark: 0xA9A69C, rust: 0x7A2B12, weak: 0xBE4E22,
    steel: 0x1E4D38, lgs: 0xB9BFC3, osb: 0xC9A66B, insul: 0xE6D39C, membrane: 0xD6D6D0,
    panel: 0xF5F2EB, frame: 0x3B3F3A, glass: 0x9FB7C9, timber: 0x9A6B3F, pv: 0x1E2A38, pvFrame: 0xC0C5C9,
    ground: 0xD9D6CC, street: 0xC4C2B9, curb: 0xB3B1A8, grass: 0xBFC7AA, cypress: 0x40594A, olive: 0x8A9A78, trunk: 0x6B5A48,
    ghost: 0xFFFFFF, tank: 0xE8E6E0, tile1: 0xD4773F, tile2: 0x1E4D38, battery: 0x3B3F3A,
  };
  const STEPS = [
    { t: "Today", d: "A 1979 two-storey house. Rusted starter bars, the anamones, wait on the roof for a child's floor." },
    { t: "Screen and assess", d: "X-ray view: the ground-floor columns (highlighted) will carry the new home. The engineer tests them on site." },
    { t: "Strengthen the ground floor", d: "New steel, in green, stiffens the ground floor before any load is added." },
    { t: "Prepare the roof", d: "The rusted bars are cut back and a steel transfer frame is bolted to the column heads, so the new load goes to the columns, not the old slab." },
    { t: "Floor cassette", d: "Factory-made light-gauge steel joists at 400 mm centres with a structural deck, lifted on in panels." },
    { t: "Wall frames", d: "Light-gauge steel studs at 600 mm centres with cross-bracing straps, pre-cut and pre-drilled in the factory." },
    { t: "Roof and insulation", d: "Roof joists, rigid insulation and a waterproof membrane close the home in days, not months." },
    { t: "Façade and windows", d: "Paphos Palette panels, large windows and a screen patterned on the Paphos mosaics." },
    { t: "Pergola, solar and stair", d: "Timber pergola with solar panels over the terrace, a battery, and a separate stair so the grandparents keep their door." },
  ];
  const mats = {};
  function mat(hex, o = {}) {
    const k = hex + JSON.stringify(o);
    if (!mats[k]) mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.82, metalness: 0.0 }, o));
    return mats[k];
  }
  let edgeMat, boxGeo, edgeGeo;
  function init() { if (boxGeo) return; edgeMat = new THREE.LineBasicMaterial({ color: 0x2A2D29, transparent: true, opacity: 0.32 }); boxGeo = new THREE.BoxGeometry(1, 1, 1); edgeGeo = new THREE.EdgesGeometry(boxGeo); }

  function dims(b) { // shared with the 2D elevation
    const w = Math.max(8.5, Math.min(16, b.frontage || Math.sqrt(b.footprint)));
    const d = Math.max(6, Math.min(16, b.footprint / w));
    const ncol = Math.max(2, Math.round(w / 4.2) + 1), nz = Math.max(2, Math.round(d / 4.6) + 1);
    const xs = [...Array(ncol)].map((_, i) => 0.15 + (w - 0.3) * i / (ncol - 1));
    const zs = [...Array(nz)].map((_, i) => 0.15 + (d - 0.3) * i / (nz - 1));
    return { w, d, ncol, nz, xs, zs };
  }
  function layout(b, a) { // where the new home and the terrace go on the roof
    const { w, d } = dims(b);
    let wm = a / (d - 0.4), dm = d - 0.4, side = true;
    if (w - 0.4 - wm < 2.6) { side = false; wm = w - 0.4; dm = Math.min(d - 0.4, a / wm); }
    return { w, d, wm, dm, side, terW: side ? w - 0.4 - wm : w - 0.4, terD: side ? d - 0.4 : d - 0.4 - dm };
  }

  function build(b, design) {
    init();
    const D = dims(b), { w, d, xs, zs } = D;
    const n = b.storeys, slab = 0.2, hG = 3.3, hU = 3.0;
    const lv = [0]; for (let i = 1; i <= n; i++) lv.push(i === 1 ? hG : lv[i - 1] + hU);
    const roofTop = lv[n] + slab;
    const root = new THREE.Group();
    const G = {}; // named layers, each explodable
    const layer = (name, step, explode, label, anchor) => { const g = new THREE.Group(); g.userData = { step, explode: explode || [0, 0, 0], label, anchor, base: [0, 0, 0] }; G[name] = g; root.add(g); return g; };
    const box = (g, sx, sy, sz, x, y, z, m, edges = true, cast = true) => {
      const mesh = new THREE.Mesh(boxGeo, m); mesh.scale.set(sx, sy, sz); mesh.position.set(x, y, z);
      mesh.castShadow = cast; mesh.receiveShadow = true; g.add(mesh);
      if (edges) { const e = new THREE.LineSegments(edgeGeo, edgeMat); e.scale.copy(mesh.scale); e.position.copy(mesh.position); g.add(e); }
      return mesh;
    };
    const inst = (g, list, m, cast = true) => { // list of [sx,sy,sz,x,y,z,rx,ry,rz]
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(boxGeo, m, list.length); const o = new THREE.Object3D();
      list.forEach((v, i) => { o.scale.set(v[0], v[1], v[2]); o.position.set(v[3], v[4], v[5]); o.rotation.set(v[6] || 0, v[7] || 0, v[8] || 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
      im.castShadow = cast; im.receiveShadow = true; g.add(im); return im;
    };
    const cyl = (g, r, h, x, y, z, m, rot) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = true; c.receiveShadow = true; g.add(c); return c; };
    const bar = (g, x1, y1, z1, x2, y2, z2, t, m) => { // a straight member between two points
      const v = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1), L = v.length();
      const mesh = new THREE.Mesh(boxGeo, m); mesh.scale.set(t, L, t); mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); mesh.castShadow = true; g.add(mesh); return mesh;
    };
    const windowAt = (g, axis, pos, x0, y0, ow, oh, depth) => { // frame + glass in a wall plane
      const fm = mat(C.frame, { roughness: 0.6 }), gm = mat(C.glass, { transparent: true, opacity: 0.42, roughness: 0.15, metalness: 0.1 });
      const t = 0.06;
      if (axis === "z") { // wall in x-y plane at z=pos
        box(g, ow, t, depth, x0 + ow / 2, y0 + t / 2, pos, fm, false); box(g, ow, t, depth, x0 + ow / 2, y0 + oh - t / 2, pos, fm, false);
        box(g, t, oh, depth, x0 + t / 2, y0 + oh / 2, pos, fm, false); box(g, t, oh, depth, x0 + ow - t / 2, y0 + oh / 2, pos, fm, false);
        box(g, t * 0.7, oh, depth * 0.8, x0 + ow / 2, y0 + oh / 2, pos, fm, false);
        box(g, ow - 2 * t, oh - 2 * t, 0.02, x0 + ow / 2, y0 + oh / 2, pos, gm, false, false);
      } else { // wall in z-y plane at x=pos
        box(g, depth, t, ow, pos, y0 + t / 2, x0 + ow / 2, fm, false); box(g, depth, t, ow, pos, y0 + oh - t / 2, x0 + ow / 2, fm, false);
        box(g, depth, oh, t, pos, y0 + oh / 2, x0 + t / 2, fm, false); box(g, depth, oh, t, pos, y0 + oh / 2, x0 + ow - t / 2, fm, false);
        box(g, 0.02, oh - 2 * t, ow - 2 * t, pos, y0 + oh / 2, x0 + ow / 2, gm, false, false);
      }
    };
    // wall segment with an optional opening, in the x-y plane (front/back) or z-y plane (sides)
    const wall = (g, axis, pos, a0, a1, y0, y1, th, op, m) => {
      const L = a1 - a0, H = y1 - y0; if (L <= 0.05) return;
      const put = (s0, s1, h0, h1) => { if (s1 - s0 < 0.02 || h1 - h0 < 0.02) return; if (axis === "z") box(g, s1 - s0, h1 - h0, th, (s0 + s1) / 2, (h0 + h1) / 2, pos, m); else box(g, th, h1 - h0, s1 - s0, pos, (h0 + h1) / 2, (s0 + s1) / 2, m); };
      if (!op) { put(a0, a1, y0, y1); return; }
      const ow = Math.min(op.w, L - 0.3), o0 = a0 + (L - ow) / 2, o1 = o0 + ow, s = y0 + op.sill, t = Math.min(y1 - 0.15, s + op.h);
      put(a0, o0, y0, y1); put(o1, a1, y0, y1); put(o0, o1, y0, s); put(o0, o1, t, y1);
      windowAt(g, axis, pos, o0, s, ow, t - s, th * 0.5);
    };

    // ---------- site ----------
    const site = layer("site", 0);
    box(site, w + 14, 0.1, d + 12, w / 2, -0.05, d / 2 + 1.5, mat(C.ground), false, false);
    box(site, w + 14, 0.02, 6, w / 2, 0.01, -5.5, mat(C.street), false, false);
    box(site, w + 14, 0.14, 0.25, w / 2, 0.07, -2.4, mat(C.curb), false);
    box(site, 3.2, 0.03, 2.2, w / 2, 0.015, -1.2, mat(0xD9D5CB), false, false);
    box(site, w + 3, 0.02, 3.5, w / 2, 0.012, d + 2.2, mat(C.grass), false, false);
    // low plot walls
    const pw = mat(0xE6E2D8);
    box(site, 0.2, 0.9, d + 5, -1.6, 0.45, d / 2 + 0.3, pw); box(site, 0.2, 0.9, d + 5, w + 1.6 + 1.3, 0.45, d / 2 + 0.3, pw);
    box(site, w + 3.4 + 1.3, 0.9, 0.2, w / 2 + 0.65, 0.45, d + 2.8, pw);
    // cypresses and an olive tree
    const cypress = (x, z, h) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.55, h, 10), mat(C.cypress)); c.position.set(x, h / 2 + 0.3, z); c.castShadow = true; site.add(c); cyl(site, 0.08, 0.4, x, 0.2, z, mat(C.trunk)); };
    cypress(-0.9, d + 1.8, 7.5); cypress(-0.9, d + 0.3, 6.2);
    cyl(site, 0.12, 1.6, w + 2.2, 0.8, -0.9, mat(C.trunk));
    [[0, 2.2, 0, 1.1], [0.6, 2.6, 0.3, 0.8], [-0.5, 2.5, -0.2, 0.85], [0.1, 3.0, 0.2, 0.7]].forEach(([dx, y, dz, r]) => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(C.olive, { flatShading: true })); s.position.set(w + 2.2 + dx, y, -0.9 + dz); s.castShadow = true; site.add(s); });
    // neighbours as white massing
    const gh = mat(C.ghost, { transparent: true, opacity: 0.38, depthWrite: false });
    box(site, 8, 6.8, 9, -8.5, 3.4, d / 2, gh); box(site, 9, 3.6, 10, w + 10.5, 1.8, d / 2 + 0.5, gh);

    // ---------- existing house ----------
    const ex = layer("existing", 0, [0, 0, 0], "Existing RC frame, 1979", [w * 0.15, lv[1] + 1.2, 0]);
    const cm = mat(C.conc), rm = mat(C.render), weakM = mat(C.weak);
    const gfCols = [];
    for (let i = 0; i < n; i++) {
      const y0 = i ? lv[i] + slab : 0, y1 = lv[i + 1];
      for (const x of xs) for (const z of zs) { const c = box(ex, 0.3, y1 - y0, 0.3, x, (y0 + y1) / 2, z, cm); if (i === 0) gfCols.push(c); }
      // slab and downstand beams above
      box(ex, w + 0.1, slab, d + 0.1, w / 2, y1 + slab / 2, d / 2, cm);
      for (const z of zs) box(ex, w - 0.3, 0.4, 0.25, w / 2, y1 - 0.2, z, mat(C.concDark), false);
      for (const x of xs) box(ex, 0.25, 0.4, d - 0.3, x, y1 - 0.2, d / 2, mat(C.concDark), false);
    }
    ex.userData.gfCols = gfCols;
    // infill walls with openings
    const walls = new THREE.Group(); ex.add(walls); ex.userData.walls = walls;
    const ncb = xs.length - 1, doorBay = Math.floor(ncb / 2);
    for (let i = 0; i < n; i++) {
      const y0 = i ? lv[i] + slab : 0, y1 = lv[i + 1] - 0.4;
      for (let k = 0; k < ncb; k++) {
        const a0 = xs[k] + 0.15, a1 = xs[k + 1] - 0.15;
        const front = i === 0 && k === doorBay ? { w: 1.0, h: 2.2, sill: 0 } : (i >= 1 && k === doorBay && b.balconies === "cantilever") ? { w: 1.0, h: 2.2, sill: 0 } : { w: 1.5, h: 1.3, sill: 0.9 };
        wall(walls, "z", 0.15, a0, a1, y0, y1, 0.2, front, rm);
        wall(walls, "z", d - 0.15, a0, a1, y0, y1, 0.2, { w: 1.2, h: 1.2, sill: 1.0 }, rm);
      }
      for (let k = 0; k < zs.length - 1; k++) {
        const a0 = zs[k] + 0.15, a1 = zs[k + 1] - 0.15;
        wall(walls, "x", 0.15, a0, a1, y0, y1, 0.2, i ? { w: 1.0, h: 1.1, sill: 1.0 } : null, rm);
        wall(walls, "x", w - 0.15, a0, a1, y0, y1, 0.2, { w: 1.0, h: 1.1, sill: 1.0 }, rm);
      }
      // wall above openings up to the beam
      for (let k = 0; k < ncb; k++) { box(walls, xs[k + 1] - xs[k] - 0.3, 0.4, 0.2, (xs[k] + xs[k + 1]) / 2, lv[i + 1] - 0.2, 0.15, rm, false); box(walls, xs[k + 1] - xs[k] - 0.3, 0.4, 0.2, (xs[k] + xs[k + 1]) / 2, lv[i + 1] - 0.2, d - 0.15, rm, false); }
    }
    // balcony
    if (b.balconies === "cantilever" && n >= 2) {
      const bx0 = xs[doorBay] - 0.4, bx1 = Math.min(w + 0.3, xs[doorBay + 1] + 0.4), yb = lv[1];
      box(ex, bx1 - bx0, 0.18, 1.3, (bx0 + bx1) / 2, yb + 0.1, -0.6, cm);
      const rail = mat(C.frame, { roughness: 0.5 }); const bal = [];
      for (let x = bx0 + 0.06; x < bx1; x += 0.12) bal.push([0.025, 0.95, 0.025, x, yb + 0.66, -1.2]);
      for (let z = -1.2; z < 0; z += 0.12) { bal.push([0.025, 0.95, 0.025, bx0 + 0.03, yb + 0.66, z]); bal.push([0.025, 0.95, 0.025, bx1 - 0.03, yb + 0.66, z]); }
      inst(ex, bal, rail);
      box(ex, bx1 - bx0, 0.05, 0.06, (bx0 + bx1) / 2, yb + 1.15, -1.22, rail, false);
      box(ex, 0.06, 0.05, 1.25, bx0 + 0.03, yb + 1.15, -0.6, rail, false); box(ex, 0.06, 0.05, 1.25, bx1 - 0.03, yb + 1.15, -0.6, rail, false);
    }
    // parapet
    const par = new THREE.Group(); ex.add(par);
    box(par, w + 0.1, 0.6, 0.15, w / 2, roofTop + 0.3, 0.02, rm); box(par, w + 0.1, 0.6, 0.15, w / 2, roofTop + 0.3, d - 0.02, rm);
    box(par, 0.15, 0.6, d, 0.02, roofTop + 0.3, d / 2, rm); box(par, 0.15, 0.6, d, w - 0.02, roofTop + 0.3, d / 2, rm);

    // ---------- today's roof: anamones and solar water heater ----------
    const roofOld = layer("roofOld", 0, [0, 0, 0], "Anamones: rusted starter bars", [xs[1], roofTop + 1.0, zs[0]]);
    const rust = mat(C.rust, { roughness: 0.9 });
    for (const x of xs) for (const z of zs) for (const [dx, dz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) {
      const h = 0.85 + (Math.abs(x * 13 + z * 7 + dx * 50) % 0.3);
      cyl(roofOld, 0.02, h, x + dx, roofTop + h / 2, z + dz, rust);
      const hook = cyl(roofOld, 0.02, 0.18, x + dx + 0.05, roofTop + h - 0.02, z + dz, rust, [0, 0, -1.1]); hook.castShadow = false;
    }
    const hx = w - 2.2, hz = d * 0.55;
    cyl(roofOld, 0.28, 1.5, hx, roofTop + 1.35, hz, mat(C.tank, { roughness: 0.5 }), [0, 0, Math.PI / 2]);
    box(roofOld, 1.9, 0.06, 1.1, hx, roofTop + 0.75, hz - 0.9, mat(C.pv, { roughness: 0.3, metalness: 0.2 }), true).rotation.x = -0.6;
    bar(roofOld, hx - 0.7, roofTop, hz, hx - 0.7, roofTop + 1.1, hz, 0.05, mat(C.frame)); bar(roofOld, hx + 0.7, roofTop, hz, hx + 0.7, roofTop + 1.1, hz, 0.05, mat(C.frame));

    // ---------- new work ----------
    const a = design.a, L = layout(b, a), steel = mat(C.steel, { roughness: 0.45, metalness: 0.35 });
    // step 2: strengthening
    const str = layer("strengthen", 2, [0, 0, 0], design.str === "jacket" ? "Column jackets, ground floor" : "Steel X-bracing, ground floor", [xs[0] + 1.2, 1.6, 0]);
    if (design.str === "jacket") {
      for (const x of xs) for (const z of zs) box(str, 0.5, hG - 0.02, 0.5, x, hG / 2, z, mat(0x9FB8A8, { roughness: 0.7 }));
    } else {
      const braceBays = [...Array(ncb).keys()].filter(k => k !== doorBay);
      for (const k of braceBays) { const x0 = xs[k] + 0.2, x1 = xs[k + 1] - 0.2; bar(str, x0, 0.15, -0.05, x1, hG - 0.45, -0.05, 0.14, steel); bar(str, x1, 0.15, -0.05, x0, hG - 0.45, -0.05, 0.14, steel); box(str, x1 - x0, 0.14, 0.14, (x0 + x1) / 2, hG - 0.42, -0.05, steel, false); }
      for (let k = 0; k < zs.length - 1; k++) for (const x of [-0.05, w + 0.05]) { const z0 = zs[k] + 0.2, z1 = zs[k + 1] - 0.2; bar(str, x, 0.15, z0, x, hG - 0.45, z1, 0.14, steel); bar(str, x, 0.15, z1, x, hG - 0.45, z0, 0.14, steel); }
      for (const x of xs) box(str, 0.4, 0.3, 0.4, x, 0.15, 0.15, steel, false); // new footing pads at brace ends
    }
    // step 3: transfer frame on column heads
    const tf = layer("transfer", 3, [0, 1.0, 0], "Steel transfer frame on column heads", [L.wm * 0.5, roofTop + 0.3, zs[0]]);
    const tfTop = roofTop + 0.3;
    for (const z of zs) { box(tf, (L.side ? L.wm + 0.4 : w), 0.03, 0.2, (L.side ? (L.wm + 0.4) / 2 : w / 2), tfTop - 0.015, z, steel, false); box(tf, (L.side ? L.wm + 0.4 : w), 0.24, 0.02, (L.side ? (L.wm + 0.4) / 2 : w / 2), roofTop + 0.15, z, steel, false); }
    for (const x of xs) if (!L.side || x <= L.wm + 0.5) for (const z of zs) box(tf, 0.42, 0.04, 0.42, x, roofTop + 0.02, z, steel, false);
    // terrace deck
    box(tf, L.side ? L.terW : L.terW, 0.05, L.side ? L.terD : Math.max(0.1, L.terD), L.side ? L.wm + 0.2 + L.terW / 2 : w / 2, roofTop + 0.025, L.side ? d / 2 : L.dm + 0.2 + L.terD / 2, mat(0xD8CFC0), false);

    // module footprint
    const mx0 = 0.2, mx1 = 0.2 + L.wm, mz0 = 0.2, mz1 = 0.2 + L.dm;
    const fy0 = tfTop, fy1 = fy0 + 0.25, wy1 = fy1 + 2.75, ry1 = wy1 + 0.3;
    // step 4: floor cassette
    const fl = layer("floor", 4, [0, 2.3, 0], "Floor cassette · LGS joists 400 mm c/c", [(mx0 + mx1) / 2, fy1, mz0]);
    const lgs = mat(C.lgs, { roughness: 0.4, metalness: 0.55 }); const J = [];
    for (let x = mx0 + 0.05; x <= mx1 - 0.05; x += 0.4) J.push([0.05, 0.2, L.dm, x, fy0 + 0.1, (mz0 + mz1) / 2]);
    J.push([L.wm, 0.2, 0.05, (mx0 + mx1) / 2, fy0 + 0.1, mz0 + 0.025], [L.wm, 0.2, 0.05, (mx0 + mx1) / 2, fy0 + 0.1, mz1 - 0.025]);
    inst(fl, J, lgs);
    box(fl, L.wm, 0.025, L.dm, (mx0 + mx1) / 2, fy1 - 0.0125, (mz0 + mz1) / 2, mat(C.osb, { roughness: 0.9 }));
    // step 5: wall frames
    const wf = layer("walls", 5, [0, 3.7, 0], "Wall frames · LGS studs 600 mm c/c", [mx0, (fy1 + wy1) / 2, mz0]);
    const S = [], wy0 = fy1, H = wy1 - wy0;
    const openingsFront = [[0.18, 1.6, 0.4], [0.5, 1.6, 0.4], [0.8, 1.4, 0.0]]; // fraction along, width, sill (screen bay last)
    const addWallFrame = (axis, pos, a0, a1, ops) => {
      for (let s = a0; s <= a1 + 0.001; s += 0.6) {
        const inOp = ops.some(([f, ow, sill]) => { const c = a0 + (a1 - a0) * f; return s > c - ow / 2 && s < c + ow / 2 && sill >= 0 && ow > 0; });
        if (inOp) continue;
        if (axis === "z") S.push([0.05, H, 0.1, s, wy0 + H / 2, pos]); else S.push([0.1, H, 0.05, pos, wy0 + H / 2, s]);
      }
      // tracks
      if (axis === "z") { S.push([a1 - a0, 0.05, 0.1, (a0 + a1) / 2, wy0 + 0.025, pos], [a1 - a0, 0.05, 0.1, (a0 + a1) / 2, wy1 - 0.025, pos]); }
      else { S.push([0.1, 0.05, a1 - a0, pos, wy0 + 0.025, (a0 + a1) / 2], [0.1, 0.05, a1 - a0, pos, wy1 - 0.025, (a0 + a1) / 2]); }
      // opening jambs and headers
      for (const [f, ow, sill] of ops) {
        if (ow <= 0) continue; const c = a0 + (a1 - a0) * f;
        for (const s of [c - ow / 2, c + ow / 2]) { if (axis === "z") S.push([0.05, H, 0.1, s, wy0 + H / 2, pos]); else S.push([0.1, H, 0.05, pos, wy0 + H / 2, s]); }
        const hy = wy0 + sill + 2.1;
        if (axis === "z") { S.push([ow, 0.15, 0.1, c, Math.min(wy1 - 0.1, hy + 0.075), pos]); if (sill > 0) S.push([ow, 0.05, 0.1, c, wy0 + sill, pos]); }
        else { S.push([0.1, 0.15, ow, pos, Math.min(wy1 - 0.1, hy + 0.075), c]); if (sill > 0) S.push([0.1, 0.05, ow, pos, wy0 + sill, c]); }
      }
    };
    const fOps = [[0.2, 1.6, 0.35], [0.52, 1.6, 0.35]];
    const sideOps = L.side ? [[0.35, 1.8, 0], [0.75, 1.2, 0.8]] : [[0.5, 1.2, 0.8]];
    addWallFrame("z", mz0 + 0.05, mx0, mx1, fOps);
    addWallFrame("z", mz1 - 0.05, mx0, mx1, [[0.5, 1.4, 0.8]]);
    addWallFrame("x", mx0 + 0.05, mz0, mz1, [[0.5, 1.2, 0.8]]);
    addWallFrame("x", mx1 - 0.05, mz0, mz1, sideOps);
    inst(wf, S, lgs);
    // X-strap bracing on solid panels (front, right-hand bay)
    const strap = mat(0x8E969B, { metalness: 0.6, roughness: 0.35 });
    const sx0 = mx0 + (mx1 - mx0) * 0.72, sx1 = mx1 - 0.2;
    bar(wf, sx0, wy0 + 0.1, mz0 - 0.01, sx1, wy1 - 0.1, mz0 - 0.01, 0.03, strap); bar(wf, sx1, wy0 + 0.1, mz0 - 0.01, sx0, wy1 - 0.1, mz0 - 0.01, 0.03, strap);
    bar(wf, mx0 - 0.01, wy0 + 0.1, mz0 + 0.3, mx0 - 0.01, wy1 - 0.1, mz0 + 2.2, 0.03, strap); bar(wf, mx0 - 0.01, wy0 + 0.1, mz0 + 2.2, mx0 - 0.01, wy1 - 0.1, mz0 + 0.3, 0.03, strap);
    // step 6: roof
    const rf = layer("roof", 6, [0, 5.6, 0], "Insulated roof · joists, 120 mm insulation, membrane", [(mx0 + mx1) / 2, ry1, (mz0 + mz1) / 2]);
    const R = []; for (let x = mx0 + 0.05; x <= mx1 - 0.05; x += 0.6) R.push([0.05, 0.15, L.dm + 0.3, x, wy1 + 0.075, (mz0 + mz1) / 2]);
    inst(rf, R, lgs);
    box(rf, L.wm + 0.3, 0.12, L.dm + 0.3, (mx0 + mx1) / 2, wy1 + 0.21, (mz0 + mz1) / 2, mat(C.insul, { roughness: 0.95 }));
    box(rf, L.wm + 0.5, 0.04, L.dm + 0.5, (mx0 + mx1) / 2, wy1 + 0.29, (mz0 + mz1) / 2, mat(C.membrane));
    // step 7: façade, windows, mosaic screen
    const fc = layer("facade", 7, [0, 3.7, -3.2], "Paphos Palette façade · mosaic screen", [mx0 + (mx1 - mx0) * 0.86, (fy1 + wy1) / 2, mz0 - 0.1]);
    const pm = mat(C.panel, { roughness: 0.75 });
    const clad = (axis, pos, a0, a1, ops, out) => {
      const step = 1.2;
      for (let s = a0; s < a1 - 0.02; s += step) {
        const s1 = Math.min(a1, s + step - 0.012);
        let segs = [[wy0, wy1]];
        for (const [f, ow, sill] of ops) { const c = a0 + (a1 - a0) * f; if (s1 > c - ow / 2 && s < c + ow / 2) segs = [[wy0, wy0 + sill], [wy0 + sill + 2.1, wy1]]; }
        for (const [y0, y1] of segs) if (y1 - y0 > 0.05) {
          let p0 = s, p1 = s1;
          for (const [f, ow] of ops) { const c = a0 + (a1 - a0) * f; if (s < c - ow / 2 && s1 > c - ow / 2 && y0 === wy0 && y1 === wy1) p1 = c - ow / 2; if (s < c + ow / 2 && s1 > c + ow / 2 && y0 === wy0 && y1 === wy1) p0 = c + ow / 2; }
          if (p1 - p0 < 0.03) continue;
          if (axis === "z") box(fc, p1 - p0, y1 - y0, 0.04, (p0 + p1) / 2, (y0 + y1) / 2, pos + out * 0.08, pm); else box(fc, 0.04, y1 - y0, p1 - p0, pos + out * 0.08, (y0 + y1) / 2, (p0 + p1) / 2, pm);
        }
      }
      for (const [f, ow, sill] of ops) { const c = a0 + (a1 - a0) * f; windowAt(fc, axis, pos + out * 0.06, c - ow / 2, wy0 + sill, ow, 2.1 - (sill > 0.5 ? 0.6 : 0), 0.08); }
    };
    // front: two windows, then the mosaic screen bay (no cladding behind the screen)
    const scr0 = mx0 + (mx1 - mx0) * 0.72, scr1 = mx1 - 0.15;
    clad("z", mz0, mx0, scr0 - 0.05, fOps.map(([f, ow, s]) => [((mx0 + (mx1 - mx0) * f) - mx0) / (scr0 - 0.05 - mx0), ow, s]), -1);
    box(fc, scr1 - scr0 + 0.1, H, 0.04, (scr0 + scr1) / 2, (wy0 + wy1) / 2, mz0 - 0.02, mat(0x3B3F3A)); // dark reveal behind the screen
    const T1 = [], T2 = [], cell = 0.34;
    for (let yy = wy0 + 0.25, r = 0; yy < wy1 - 0.2; yy += cell, r++) for (let xx = scr0 + 0.2, c = 0; xx < scr1 - 0.1; xx += cell, c++) ((r + c) % 2 ? T1 : T2).push([0.17, 0.17, 0.04, xx, yy, mz0 - 0.12, 0, 0, Math.PI / 4]);
    inst(fc, T1, mat(C.tile1, { roughness: 0.6 })); inst(fc, T2, mat(C.tile2, { roughness: 0.6 }));
    box(fc, scr1 - scr0 + 0.14, 0.06, 0.1, (scr0 + scr1) / 2, wy1 - 0.03, mz0 - 0.12, mat(C.frame), false); box(fc, scr1 - scr0 + 0.14, 0.06, 0.1, (scr0 + scr1) / 2, wy0 + 0.03, mz0 - 0.12, mat(C.frame), false);
    clad("z", mz1, mx0, mx1, [[0.5, 1.4, 0.8]], 1);
    clad("x", mx0, mz0, mz1, [[0.5, 1.2, 0.8]], -1);
    clad("x", mx1, mz0, mz1, sideOps, 1);
    box(fc, L.wm + 0.6, 0.18, L.dm + 0.6, (mx0 + mx1) / 2, ry1 + 0.02, (mz0 + mz1) / 2, mat(0xE9E5DC), true); // roof fascia/parapet cap
    // step 8: pergola, PV, battery, stair
    const pg = layer("pergola", 8, [1.2, 7.4, 0], `Timber pergola · ${design.pv} kWp solar`, [L.side ? L.wm + 0.2 + L.terW / 2 : w / 2, roofTop + 3.0, L.side ? d * 0.3 : L.dm + 0.4]);
    const tm = mat(C.timber, { roughness: 0.85 }), pvm = mat(C.pv, { roughness: 0.25, metalness: 0.3 }), pfm = mat(C.pvFrame, { metalness: 0.6, roughness: 0.3 });
    const pgH = 2.6, py = roofTop + pgH;
    let px0, px1, pz0, pz1;
    if (L.side && L.terW > 2.4) { px0 = L.wm + 0.5; px1 = w - 0.35; pz0 = 0.35; pz1 = d - 0.35; }
    else if (!L.side && L.terD > 2.0) { px0 = 0.35; px1 = w - 0.35; pz0 = L.dm + 0.5; pz1 = d - 0.35; }
    else { px0 = mx0; px1 = mx1; pz0 = mz0; pz1 = mz1; }
    const onModule = px0 === mx0;
    const baseY = onModule ? ry1 + 0.1 : roofTop;
    const topY = onModule ? ry1 + 0.6 : py;
    if (!onModule) {
      const posts = [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1], [px0, (pz0 + pz1) / 2], [px1, (pz0 + pz1) / 2]];
      for (const [x, z] of posts) box(pg, 0.14, pgH, 0.14, x, baseY + pgH / 2, z, tm);
      box(pg, px1 - px0 + 0.4, 0.22, 0.1, (px0 + px1) / 2, topY - 0.11, pz0, tm); box(pg, px1 - px0 + 0.4, 0.22, 0.1, (px0 + px1) / 2, topY - 0.11, pz1, tm);
      box(pg, 0.1, 0.22, pz1 - pz0 + 0.3, px0, topY - 0.11, (pz0 + pz1) / 2, tm); box(pg, 0.1, 0.22, pz1 - pz0 + 0.3, px1, topY - 0.11, (pz0 + pz1) / 2, tm);
      const RA = []; for (let x = px0 + 0.3; x < px1 - 0.1; x += 0.6) RA.push([0.06, 0.16, pz1 - pz0 + 0.4, x, topY + 0.08, (pz0 + pz1) / 2]);
      inst(pg, RA, tm);
    }
    // PV panels (0.42 kWp each, 1.72 × 1.13 m), laid in rows
    const npv = Math.max(4, Math.round(design.pv / 0.42));
    const pw2 = 1.13, pl = 1.72, P = [], PF = [];
    const cols2 = Math.max(1, Math.floor((px1 - px0 + 0.2) / (pw2 + 0.04))), rows2 = Math.ceil(npv / cols2);
    let placed = 0;
    for (let r = 0; r < rows2 && placed < npv; r++) for (let c = 0; c < cols2 && placed < npv; c++, placed++) {
      const x = px0 + 0.02 + pw2 / 2 + c * (pw2 + 0.04), z = pz0 + 0.1 + pl / 2 + r * (pl + 0.08);
      if (z + pl / 2 > pz1 + 0.3) break;
      P.push([pw2 - 0.04, 0.035, pl - 0.04, x, topY + 0.2, z, 0.12, 0, 0]); PF.push([pw2, 0.03, pl, x, topY + 0.18, z, 0.12, 0, 0]);
    }
    inst(pg, PF, pfm); inst(pg, P, pvm);
    pg.userData.pvCount = P.length;
    box(pg, 0.6, 0.9, 0.25, onModule ? w - 0.6 : px1 - 0.3, roofTop + 0.5, onModule ? d - 0.5 : pz1 - 0.2, mat(C.battery, { roughness: 0.5 }));
    // external steel stair on the right side, from the garden to the roof terrace
    const st = layer("stair", 8, [3.4, 0, 0], "Separate stair · grandparents keep their door", [w + 0.9, lv[1], d * 0.55]);
    const sx = w + 0.45, sw = 1.1, rise = 0.18, going = 0.28, sm = mat(C.steel, { roughness: 0.45, metalness: 0.35 }), tr = mat(C.lgs, { metalness: 0.5, roughness: 0.4 });
    const nr1 = Math.round(lv[1] / rise), Ttr = [];
    const zStart = 0.6;
    for (let i = 0; i < nr1; i++) Ttr.push([sw, 0.04, going + 0.02, sx + sw / 2, (i + 1) * rise, zStart + i * going, 0, 0, 0]);
    const land1z = zStart + nr1 * going; box(st, sw, 0.08, 1.2, sx + sw / 2, lv[1] + 0.02, land1z + 0.5, tr);
    const nr2 = Math.round((roofTop - lv[1]) / rise);
    for (let i = 0; i < nr2; i++) Ttr.push([sw, 0.04, going + 0.02, sx + sw / 2, lv[1] + (i + 1) * rise, land1z + 1.0 + i * going, 0, 0, 0]);
    inst(st, Ttr, tr);
    const endZ = land1z + 1.0 + nr2 * going;
    bar(st, sx, 0.05, zStart - 0.1, sx, lv[1], land1z, 0.08, sm); bar(st, sx + sw, 0.05, zStart - 0.1, sx + sw, lv[1], land1z, 0.08, sm);
    bar(st, sx, lv[1], land1z + 1.0, sx, roofTop, Math.min(endZ, d + 1.5), 0.08, sm); bar(st, sx + sw, lv[1], land1z + 1.0, sx + sw, roofTop, Math.min(endZ, d + 1.5), 0.08, sm);
    bar(st, sx + sw, 0.9, zStart, sx + sw, lv[1] + 0.9, land1z, 0.04, sm); bar(st, sx + sw, lv[1] + 0.9, land1z + 1.0, sx + sw, roofTop + 0.9, Math.min(endZ, d + 1.5), 0.04, sm);
    for (const [x, z, h] of [[sx + 0.05, land1z + 1.0, lv[1]], [sx + sw - 0.05, land1z + 1.0, lv[1]], [sx + 0.05, land1z, lv[1]], [sx + sw - 0.05, land1z, lv[1]]]) box(st, 0.1, h, 0.1, x, h / 2, z, sm, false);

    // people and a car for scale (architectural-model white)
    const fig = mat(0xF7F6F2, { roughness: 0.9 });
    const person = (g, x, y, z, h = 1.72) => { cyl(g, 0.17, h * 0.62, x, y + h * 0.31 + 0.2, z, fig); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), fig); hd.position.set(x, y + h * 0.62 + 0.34, z); hd.castShadow = true; g.add(hd); cyl(g, 0.07, 0.4, x - 0.07, y + 0.2, z, fig); cyl(g, 0.07, 0.4, x + 0.07, y + 0.2, z, fig); };
    person(site, (xs[doorBay] + xs[doorBay + 1]) / 2 - 0.6, 0, -1.3, 1.62);
    person(site, (xs[doorBay] + xs[doorBay + 1]) / 2 + 0.2, 0, -1.6, 1.15);
    person(pg, L.side ? L.wm + 2.8 : w * 0.7, roofTop, d * 0.45, 1.75);
    const car = mat(0xF3F2EE, { roughness: 0.6 }), tyre = mat(0x55584F);
    box(site, 4.3, 0.75, 1.8, w * 0.72, 0.6, -5.2, car); box(site, 2.3, 0.6, 1.6, w * 0.72 - 0.2, 1.25, -5.2, car);
    for (const [dx, dz] of [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]]) cyl(site, 0.32, 0.22, w * 0.72 + dx, 0.32, -5.2 + dz, tyre, [Math.PI / 2, 0, 0]);
    // quantities for the kit schedule
    const Q = {
      moduleArea: +(L.wm * L.dm).toFixed(1), terrace: +((L.side ? L.terW * L.terD : L.terW * Math.max(0, L.terD))).toFixed(1),
      joists: J.length - 2, studs: S.filter(s => s[1] === H).length, roofJoists: R.length,
      panels: fc.children.filter(m => m.isMesh && m.material === pm).length, tiles: T1.length + T2.length, pv: P.length,
      braces: design.str === "brace" ? (ncb - 1) * 2 + (zs.length - 1) * 4 : 0, jackets: design.str === "jacket" ? xs.length * zs.length : 0,
      treads: Ttr.length, anamones: xs.length * zs.length * 4, tfBeams: zs.length,
    };
    root.scale.z = -1;
    return { root, G, Q, dims: D, L, lv, roofTop };
  }

  // ---------- viewer ----------
  function mount(el, b, design, opts = {}) {
    if (typeof THREE === "undefined") { el.innerHTML = '<div class="m3d-msg">The 3D viewer needs an internet connection to load its library.</div>'; return null; }
    const W = () => el.clientWidth, Hh = () => el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.still });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * (opts.scale || 1));
    renderer.setSize(W(), Hh()); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const bg = getComputedStyle(el).getPropertyValue("--m3d-bg").trim() || "#E7E5DF";
    scene.background = new THREE.Color(bg);
    const hemi = new THREE.HemisphereLight(0xFFFBF2, 0xA8A598, 0.55); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xFFF1D8, 1.35); sun.position.set(-12, 24, 20); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xDDE6F0, 0.25); fill.position.set(22, 10, -12); scene.add(fill);
    const M = build(b, design); scene.add(M.root);
    const center = new THREE.Vector3(M.dims.w / 2 + 0.6, 4.4, -M.dims.d / 2);
    sun.target.position.copy(center);
    const camera = new THREE.PerspectiveCamera(32, W() / Hh(), 0.5, 400);
    const st = { az: 0.62, el: 0.36, r: 33, target: center.clone(), step: STEPS.length - 1, explode: 0, explodeT: 0, xray: false, labels: opts.labels !== false, auto: false, autoRate: 0.18, dirty: true };
    let rise = null; // parts added by the current build step glide down into place: { keys, t0 }
    const DROP = 2.6, RISE_MS = 750;
    const VIEWS = { axo: [0.62, 0.36, 33], left: [-0.62, 0.38, 33], front: [0, 0.1, 34], top: [0.3, 1.25, 38], right: [0.95, 0.32, 33], back: [2.55, 0.42, 34] };
    function placeCam() { const { az, el: e } = st; const fit = Math.max(1, 1.5 / Math.max(0.3, camera.aspect)); const r = (st.r + st.explodeT * 11) * fit; const ty = st.target.y + st.explodeT * 3.4; camera.position.set(st.target.x + r * Math.sin(az) * Math.cos(e), ty + r * Math.sin(e), st.target.z + r * Math.cos(az) * Math.cos(e)); camera.lookAt(st.target.x, ty, st.target.z); }
    // labels
    const lab = document.createElement("div"); lab.className = "m3d-labels"; el.appendChild(lab);
    const labelEls = {};
    for (const [k, g] of Object.entries(M.G)) if (g.userData.label) { const d = document.createElement("div"); d.className = "m3d-label"; d.textContent = g.userData.label; lab.appendChild(d); labelEls[k] = d; }
    function applyStep() {
      const s = st.step;
      for (const [k, g] of Object.entries(M.G)) {
        const u = g.userData;
        if (k === "roofOld") g.visible = s < 3;
        else g.visible = u.step <= s;
      }
      // x-ray at step 1 or when toggled
      const xr = s === 1 || st.xray;
      const walls = M.G.existing.userData.walls;
      walls.traverse(o => { if (o.isMesh) { if (!o.userData.m0) o.userData.m0 = o.material; o.material = xr ? mat(C.render, { transparent: true, opacity: 0.1, depthWrite: false }) : o.userData.m0; } if (o.isLineSegments) o.visible = !xr; });
      for (const c of M.G.existing.userData.gfCols) c.material = (s === 1 || (xr && s < 2)) ? mat(C.weak, { roughness: 0.7 }) : mat(C.conc);
    }
    function applyExplode() {
      for (const [k, g] of Object.entries(M.G)) { const e = g.userData.explode; g.position.set(e[0] * st.explodeT, e[1] * st.explodeT + (g.userData.drop || 0), e[2] * st.explodeT); }
    }
    const lead = document.createElementNS("http://www.w3.org/2000/svg", "svg"); lead.setAttribute("class", "m3d-lead"); lab.prepend(lead);
    function drawLabels() {
      const w = W(), h = Hh(), items = [], dense = w < 560;
      for (const [k, d] of Object.entries(labelEls)) {
        const g = M.G[k], u = g.userData;
        const show = st.labels && g.visible && ((st.explodeT > 0.5 && !dense) ? true : (u.step === st.step && st.step > 0) || (k === "roofOld" && st.step === 0) || (k === "existing" && st.step === 1));
        if (!show) { d.style.opacity = 0; continue; }
        if (opts.num && !u.step) { d.style.opacity = 0; continue; }
        const txt = opts.num ? String(u.step) : dense ? u.label.split(" · ")[0] : u.label; if (d.textContent !== txt) d.textContent = txt;
        d.classList.toggle("num", !!opts.num);
        const p = M.root.localToWorld(new THREE.Vector3(...u.anchor).add(g.position)).project(camera);
        if (p.z > 1) { d.style.opacity = 0; continue; }
        const x = ((p.x + 1) / 2) * w, y = Math.max(12, Math.min(h - 12, ((1 - p.y) / 2) * h));
        const lw = d.offsetWidth || 200; const flip = x + 10 + lw > w - 6 && x - 10 - lw > 6;
        const l = flip ? x - 10 - lw : Math.max(16, Math.min(w - lw - 6, x + 10));
        items.push({ d, x, y0: y, y, flip, l, r: l + lw });
      }
      // keep labels from overlapping: push later ones down, then draw a leader back to the anchor
      items.sort((a, b) => a.y0 - b.y0);
      const placed = [];
      for (const it of items) {
        for (let n = 0; n < 12; n++) { const hit = placed.find(p => it.l < p.r + 6 && it.r > p.l - 6 && Math.abs(it.y - p.y) < 25); if (!hit) break; it.y = hit.y + 25; }
        it.y = Math.min(h - 12, it.y); placed.push(it);
      }
      let path = "";
      for (const it of items) {
        it.d.classList.toggle("flip", it.flip); it.d.style.opacity = 1;
        it.d.style.transform = `translate(${it.flip ? it.l : it.l - 10}px, ${it.y}px)`;
        const ax = it.flip ? it.r + 7 : it.l - 7;
        if (Math.hypot(ax - it.x, it.y - it.y0) > 5) path += `M${it.x.toFixed(1)} ${it.y0.toFixed(1)}L${ax.toFixed(1)} ${it.y.toFixed(1)}`;
      }
      lead.innerHTML = path ? `<path d="${path}"/>` : "";
    }
    let raf = 0, last = performance.now();
    function frame(t) {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const target = st.explode; if (Math.abs(st.explodeT - target) > 0.001) { st.explodeT += (target - st.explodeT) * Math.min(1, dt * 5); applyExplode(); st.dirty = true; }
      if (rise) {
        if (rise.t0 == null) rise.t0 = t;
        const p = Math.min(1, (t - rise.t0) / RISE_MS), e = 1 - Math.pow(1 - p, 3);
        for (const k of rise.keys) M.G[k].userData.drop = (1 - e) * DROP;
        applyExplode(); st.dirty = true; if (p >= 1) rise = null;
      }
      if (st.auto) { st.az += dt * st.autoRate; st.dirty = true; }
      if (st.dirty) { st.dirty = false; placeCam(); renderer.render(scene, camera); drawLabels(); } // render only when something changed
      raf = requestAnimationFrame(frame);
    }
    // pointer orbit + zoom
    let drag = null;
    renderer.domElement.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, az: st.az, el: st.el }; renderer.domElement.setPointerCapture(e.pointerId); st.auto = false; });
    renderer.domElement.addEventListener("pointermove", e => { if (!drag) return; st.dirty = true; st.az = drag.az - (e.clientX - drag.x) * 0.006; st.el = Math.max(0.05, Math.min(1.35, drag.el + (e.clientY - drag.y) * 0.005)); });
    renderer.domElement.addEventListener("pointerup", () => drag = null);
    renderer.domElement.addEventListener("wheel", e => { e.preventDefault(); st.r = Math.max(16, Math.min(80, st.r * (1 + Math.sign(e.deltaY) * 0.08))); st.dirty = true; }, { passive: false });
    const ro = new ResizeObserver(() => { renderer.setSize(W(), Hh()); camera.aspect = W() / Hh(); camera.updateProjectionMatrix(); st.dirty = true; }); ro.observe(el);
    applyStep(); applyExplode(); placeCam();
    if (!opts.still) raf = requestAnimationFrame(frame);
    const api = {
      STEPS, Q: M.Q, layout: M.L,
      setStep(s) {
        const prev = st.step; st.step = Math.max(0, Math.min(STEPS.length - 1, s)); applyStep();
        if (rise) { for (const k of rise.keys) M.G[k].userData.drop = 0; rise = null; }
        if (st.step === prev + 1 && !opts.still) {   // one step forward: the new parts glide down into place
          const keys = Object.keys(M.G).filter(k => k !== "roofOld" && M.G[k].userData.step === st.step);
          if (keys.length) { for (const k of keys) M.G[k].userData.drop = DROP; rise = { keys, t0: null }; }
        }
        applyExplode(); st.dirty = true;
      },
      setExplode(on, instant) { st.explode = on ? 1 : 0; if (instant) { st.explodeT = st.explode; applyExplode(); } st.dirty = true; },
      setView(v) { const p = VIEWS[v]; if (p) { st.az = p[0]; st.el = p[1]; st.r = p[2]; } st.dirty = true; },
      setOrbit(az, e, r) { if (az != null) st.az = az; if (e != null) st.el = e; if (r != null) st.r = r; st.dirty = true; },
      setXray(on) { st.xray = on; applyStep(); st.dirty = true; },
      setLabels(on) { st.labels = on; st.dirty = true; },
      setAuto(on, rate) { st.auto = on; if (rate) st.autoRate = rate; },
      renderNow() { placeCam(); renderer.render(scene, camera); drawLabels(); },
      dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); el.innerHTML = ""; },
    };
    return api;
  }
  return { mount, STEPS, layout, dims };
})();
