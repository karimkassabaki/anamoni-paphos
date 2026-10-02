"""Generate the synthetic ANAMONI demo district.

Geometry is procedural (streets -> blocks -> plots -> footprints) and every
attribute is drawn from seeded distributions. Nothing here describes a real
building: the demo deliberately never pairs a real address with a score.
Output: poc/district.json (local metres, y grows downward for SVG).
"""
import json, math, random
from shapely.geometry import LineString, Polygon, box, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity

random.seed(1953)
W, H = 640, 440
site = box(0, 0, W, H)

def curve(pts, n=12):
    """Catmull-Rom through pts for gently curved streets."""
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(pts[-1])
    return out

# name, centreline, half-width (m), class
streets = [
    ("avenue", curve([(-20, 300), (150, 262), (330, 214), (500, 170), (660, 128)]), 7.5, "avenue"),
    ("s1", curve([(40, -20), (58, 120), (70, 250), (86, 460)]), 4.2, "street"),
    ("s2", curve([(190, -20), (196, 110), (206, 240), (214, 460)]), 4.2, "street"),
    ("s3", curve([(340, -20), (336, 100), (344, 205), (352, 330), (356, 460)]), 4.2, "street"),
    ("s4", curve([(480, -20), (476, 90), (486, 170), (500, 300), (505, 460)]), 4.2, "street"),
    ("s5", curve([(-20, 110), (120, 98), (260, 92), (420, 76), (660, 52)]), 4.0, "street"),
    ("s6", curve([(-20, 390), (130, 372), (280, 360), (430, 352), (660, 330)]), 4.0, "street"),
    ("lane1", [(70, 180), (205, 170)], 3.0, "lane"),
    ("lane2", [(345, 280), (500, 268)], 3.0, "lane"),
    ("lane3", [(205, 20), (340, 30)], 3.0, "lane"),
    ("lane4", [(560, 60), (575, 150)], 3.0, "lane"),
]
street_polys = [LineString(c).buffer(hw, cap_style=2, join_style=1) for _, c, hw, _ in streets]
street_union = unary_union(street_polys).intersection(site)
blocks_geom = site.difference(street_union.buffer(1.2))
blocks = [g for g in (blocks_geom.geoms if isinstance(blocks_geom, MultiPolygon) else [blocks_geom]) if g.area > 900]

def long_axis(poly):
    mrr = poly.minimum_rotated_rectangle
    c = list(mrr.exterior.coords)
    e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1])
    e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1])
    l1, l2 = math.hypot(*e1), math.hypot(*e2)
    return (math.atan2(e1[1], e1[0]), l1, l2) if l1 >= l2 else (math.atan2(e2[1], e2[0]), l2, l1)

avenue_line = LineString(streets[0][1])
plots = []
for bi, b in enumerate(blocks):
    ang, L, S = long_axis(b)
    cx, cy = b.centroid.x, b.centroid.y
    # rotate block so its long axis is horizontal
    rb = affinity.rotate(b, -ang, origin=(cx, cy), use_radians=True)
    minx, miny, maxx, maxy = rb.bounds
    depth = maxy - miny
    nrows = max(1, round(depth / 27))
    edges = [miny + depth * k / nrows + (random.uniform(-2.5, 2.5) if 0 < k < nrows else 0) for k in range(nrows + 1)]
    rows = list(zip(edges[:-1], edges[1:]))
    for (y0, y1) in rows:
        x = minx
        while x < maxx - 6:
            wdt = random.choice([14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 30])
            cell = box(x, y0, min(x + wdt, maxx), y1)
            x += wdt
            piece = rb.intersection(cell)
            if piece.is_empty or piece.area < 110:
                continue
            if piece.geom_type != "Polygon":
                piece = max(piece.geoms, key=lambda g: g.area)
            plots.append(affinity.rotate(piece, ang, origin=(cx, cy), use_radians=True))

# controlled archaeological area (south-west) and a soft-soil (marl) zone (north-east)
arch_zone = Polygon([(-10, 330), (120, 300), (190, 330), (175, 450), (-10, 450)])
marl_zone = Polygon([(470, -10), (650, -10), (650, 190), (560, 210), (500, 150), (455, 60)])

def r(a, b):
    return random.uniform(a, b)

buildings = []
for i, p in enumerate(plots):
    c = p.centroid
    d_av = avenue_line.distance(c)
    on_avenue = d_av < 26
    area = p.area
    roll = random.random()
    if on_avenue and area > 300 and roll < 0.45:
        use = "block"
    elif on_avenue and roll < 0.8:
        use = "shophouse"
    elif area > 480 and roll < 0.3:
        use = "block"
    else:
        use = "house"
    setback = 2.2 if use == "house" else 1.0
    fp = p.buffer(-setback, join_style=2)
    if fp.is_empty or fp.area < 55:
        continue
    if fp.geom_type != "Polygon":
        fp = max(fp.geoms, key=lambda g: g.area)
    # houses rarely cover the whole plot: trim depth
    if use == "house" and fp.area > 170:
        k = math.sqrt(random.uniform(95, 165) / fp.area)
        fp = affinity.scale(fp, k, k, origin=fp.centroid)
    fp = fp.simplify(0.4)
    fa = fp.area

    if use == "block":
        year = random.choice([1972, 1976, 1979, 1981, 1983, 1985, 1987, 1990, 1992, 1996, 2001, 2006, 2011])
        storeys = random.choice([3, 3, 4, 4, 5])
        gf = random.choices(["pilotis", "closed", "shopfront"], [0.55 if year < 1994 else 0.25, 0.25, 0.2])[0]
        balconies = "cantilever"
    elif use == "shophouse":
        year = random.choice([1965, 1968, 1972, 1975, 1978, 1982, 1986, 1991, 1998, 2004, 2012])
        storeys = random.choice([2, 2, 3])
        gf = "shopfront"
        balconies = random.choice(["cantilever", "cantilever", "none"])
    else:
        year = int(random.choices(
            [random.randint(1958, 1973), random.randint(1974, 1993), random.randint(1994, 2008), random.randint(2009, 2023)],
            [0.2, 0.42, 0.24, 0.14])[0])
        storeys = random.choices([1, 2], [0.35, 0.65])[0]
        gf = random.choices(["closed", "pilotis"], [0.9, 0.1])[0]
        balconies = random.choices(["cantilever", "none"], [0.55, 0.45])[0]
    age = 2026 - year
    if balconies == "none":
        bal_cond = "none"
    else:
        pr_bad = min(0.75, max(0.03, (age - 15) / 60))
        bal_cond = random.choices(["sound", "cracked", "spalling"], [1 - pr_bad, pr_bad * 0.55, pr_bad * 0.45])[0]
    anamones = use != "block" and storeys <= 2 and year < 2005 and random.random() < 0.55
    solar_heater = random.random() < 0.86
    irregular = random.random() < (0.18 if use == "block" else 0.08)
    in_arch = arch_zone.contains(c)
    in_marl = marl_zone.contains(c)
    households = storeys * random.choice([1, 2]) if use == "block" else (1 if storeys == 1 else random.choice([1, 2]))
    buildings.append(dict(
        use=use, year=year, storeys=storeys, gf=gf, balconies=balconies, bal_cond=bal_cond,
        anamones=anamones, solar_heater=solar_heater, irregular=irregular,
        in_arch=in_arch, in_marl=in_marl, households=households,
        footprint=round(fa, 1), plot=round(area, 1), frontage=round(min(max(math.sqrt(fa) * r(0.9, 1.25), 7), 26), 1),
        geom=[[round(x, 1), round(y, 1)] for x, y in list(fp.exterior.coords)[:-1]],
        plotgeom=[[round(x, 1), round(y, 1)] for x, y in list(p.exterior.coords)[:-1]],
        cx=round(c.x, 1), cy=round(c.y, 1),
    ))

# stable IDs, west->east then north->south in 60 m bands
buildings.sort(key=lambda b: (int(b["cy"] // 60), b["cx"]))
for n, b in enumerate(buildings, 1):
    b["id"] = f"KT-{n:03d}"

def pick(pred, key):
    cands = [b for b in buildings if pred(b)]
    return min(cands, key=key) if cands else None

# Hero house: pre-1994 two-storey family house with anamones, closed ground floor, not in excluded zones
hero = pick(lambda b: b["use"] == "house" and not b["in_arch"] and 100 < b["footprint"] < 150 and b["plot"] > 260,
            key=lambda b: abs(b["cx"] - 270) + abs(b["cy"] - 140))
hero.update(year=1979, storeys=2, gf="closed", balconies="cantilever", bal_cond="cracked", anamones=True,
            solar_heater=True, irregular=False, households=1, hero=True)
# Hero block: 1980s apartment block with open ground floor and spalling balconies near the avenue
blk = pick(lambda b: b["use"] == "block" and not b["in_arch"], key=lambda b: abs(b["cx"] - 250) + abs(b["cy"] - 240))
blk.update(year=1983, storeys=4, gf="pilotis", balconies="cantilever", bal_cond="spalling", households=6, irregular=False, heroBlock=True)

streets_out = [dict(id=s[0], cls=s[3], hw=s[2], line=[[round(x, 1), round(y, 1)] for x, y in s[1]]) for s in streets]
def ring(poly):
    return [[round(x, 1), round(y, 1)] for x, y in list(poly.exterior.coords)[:-1]]
out = dict(
    meta=dict(name="Pilot district K (synthetic)", width=W, height=H, seed=1953,
              note="Synthetic geometry and attributes for demonstration. Not real buildings or addresses."),
    streets=streets_out,
    blocks=[ring(b) for b in blocks],
    zones=dict(arch=ring(arch_zone.intersection(site)), marl=ring(marl_zone.intersection(site))),
    buildings=buildings,
)
json.dump(out, open("poc/district.json", "w"), separators=(",", ":"))
from collections import Counter
print(len(buildings), "buildings;", Counter(b["use"] for b in buildings), "pre-1994:", sum(b["year"] < 1994 for b in buildings))
print("hero", hero["id"], hero["footprint"], hero["plot"], "block", blk["id"], blk["footprint"])
print("anamones", sum(b["anamones"] for b in buildings), "arch", sum(b["in_arch"] for b in buildings), "marl", sum(b["in_marl"] for b in buildings))
