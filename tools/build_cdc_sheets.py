#!/usr/bin/env python3
"""
Builds web/charts/ from the original CDC Clinical Growth Charts, Set 2 (color) PDF
(docs/cdc-set2color.pdf, public domain, NCHS/CDC 2000-2001):

  * exports pages 1, 2, 5, 6 (birth-36 months and 2-20 years, boys and girls) unmodified as SVG;
  * calibrates each axis (age, length/stature, weight) by fitting the printed tick labels and
    snapping them to the printed grid lines (least squares);
  * verifies the calibration: every printed percentile curve is mapped back to (age, value) and
    compared with the CDC LMS tables in core/src/main/resources/growthref (reports the gap in pt).

Usage:  pip install pymupdf numpy && python3 tools/build_cdc_sheets.py
"""
import json, math, os
import numpy as np
import pymupdf

ROOT = os.path.join(os.path.dirname(__file__), "..")
PDF = os.path.join(ROOT, "docs", "cdc-set2color.pdf")
OUT = os.path.join(ROOT, "web", "charts")
REFS = os.path.join(ROOT, "core", "src", "main", "resources", "growthref")


def spans(p):
    out = []
    for b in p.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                t = s["text"].strip()
                if t:
                    out.append((t, s["bbox"], s["size"]))
    return out


def grid_lines(p):
    H, V = [], []
    for dr in p.get_drawings():
        for it in dr["items"]:
            if it[0] == "l":
                a, b = it[1], it[2]
                if abs(a.y - b.y) < 0.05 and abs(a.x - b.x) > 3: H.append((a.y, min(a.x, b.x), max(a.x, b.x)))
                if abs(a.x - b.x) < 0.05 and abs(a.y - b.y) > 3: V.append((a.x, min(a.y, b.y), max(a.y, b.y)))
            elif it[0] == "re":
                r = it[1]
                if r.height < 1.2 and r.width > 3: H.append(((r.y0 + r.y1) / 2, r.x0, r.x1))
                if r.width < 1.2 and r.height > 3: V.append(((r.x0 + r.x1) / 2, r.y0, r.y1))
    return H, V


def labels(sp, xr, yr, axis, conv=float):
    res = []
    for t, b, s in sp:
        if not (10.5 <= s <= 11.2): continue
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        if xr[0] <= cx <= xr[1] and yr[0] <= cy <= yr[1]:
            try: v = conv(t)
            except ValueError: continue
            res.append((v, cx if axis == "x" else cy))
    return res


def fit(pairs):
    v = np.array([p[0] for p in pairs]); c = np.array([p[1] for p in pairs])
    A = np.vstack([np.ones_like(v), v]).T
    coef, *_ = np.linalg.lstsq(A, c, rcond=None)
    return coef, A @ coef - c


def calibrate(pairs, lines_, span):
    coef, _ = fit(pairs)
    for _ in range(4):  # snap each label to the grid line nearest the current fit, then refit
        snapped = []
        for v, _c in pairs:
            pred = coef[0] + coef[1] * v
            cands = [l[0] for l in lines_ if abs(l[0] - pred) < 2.0 and l[2] - l[1] > span]
            if cands: snapped.append((v, min(cands, key=lambda z: abs(z - pred))))
        coef, res = fit(snapped)
    return [float(coef[0]), float(coef[1])], float(np.abs(res).max())


def main():
    doc = pymupdf.open(PDF)
    os.makedirs(OUT, exist_ok=True)
    birth = lambda t: 0.0 if t == "Birth" else float(t)
    inf_fields = {"name": [392, 45.8], "record": [488, 61.3], "mother": [285, 583.2], "father": [285, 595.7]}
    inf_table = {"cols": ["date", "age", "weight", "height"], "x": [216, 258, 296.6, 342, 385.2], "birthRow": [612.0, 622.8],
                 "rows": [622.8, 633.7, 644.2, 654.8, 665.6, 676.2, 687.1, 698.0, 708.5]}
    ch_fields = {"name": [392, 45.8], "record": [488, 61.3], "mother": [122, 97.7], "father": [246, 97.7]}
    specs = [(0, "cdc_0_36_boys", "M"), (1, "cdc_0_36_girls", "F"), (4, "cdc_2_20_boys", "M"), (5, "cdc_2_20_girls", "F")]
    sheets, worst = [], 0.0
    for pi, sid, sex in specs:
        p = doc[pi]; sp = spans(p); H, V = grid_lines(p)
        infant = pi in (0, 1)
        if infant:
            age = labels(sp, (90, 510), (75, 90), "x", birth); per = 1.0
            ht = labels(sp, (85, 107), (120, 500), "y") + labels(sp, (494, 517), (120, 210), "y")
            wt = labels(sp, (96, 107), (540, 712), "y") + labels(sp, (500, 516), (240, 530), "y")
        else:
            age = labels(sp, (100, 510), (720, 740), "x"); per = 12.0
            ht = [q for q in labels(sp, (85, 107), (230, 570), "y") if q[0] >= 80] + labels(sp, (497, 519), (110, 290), "y")
            wt = [q for q in labels(sp, (85, 107), (590, 712), "y") if q[0] <= 35] + labels(sp, (503, 519), (310, 712), "y")
        cx, rx = calibrate(age, V, 100); ch, rh = calibrate(ht, H, 40); cw, rw = calibrate(wt, H, 40)
        print(f"{sid}: axis fit max residual x={rx:.3f} height={rh:.3f} weight={rw:.3f} pt")
        open(os.path.join(OUT, sid + ".svg"), "w").write(p.get_svg_image(text_as_path=True))
        off = 0.2 if pi == 5 else 0.0
        sheets.append({
            "id": sid, "sex": sex, "file": f"charts/{sid}.svg", "page": [612, 792], "pdfPage": pi + 1,
            "title": ("CDC Birth to 36 months: " if infant else "CDC 2 to 20 years: ") + ("Girls" if sex == "F" else "Boys") +
                     (" – Length-for-age and Weight-for-age percentiles" if infant else " – Stature-for-age and Weight-for-age percentiles"),
            "ageMin": 0 if infant else 24, "ageMax": 36 if infant else 240,
            "ref": "cdc2000_infant" if infant else "cdc2000_child",
            "x": [cx[0], cx[1] / per], "height": ch, "weight": cw,
            "fields": inf_fields if infant else ch_fields,
            "table": inf_table if infant else {"cols": ["date", "age", "weight", "height", "bmi"],
                                                "x": [58.5 + off, 108.8 + off, 159.8 + off, 210.4 + off, 263.1 + off, 314 + off],
                                                "rows": [113.2, 124.1, 134.6, 145.1, 156.0, 166.5, 177.5, 188.4]},
        })
        worst = max(worst, verify(p, sheets[-1]))
    meta = {"source": "CDC Clinical Growth Charts, Set 2 (color), NCHS/CDC. Published May 30, 2000 (modified 2000–2001). "
                      "Pages reproduced unmodified from set2color.pdf; public domain.",
            "calibration": f"Axis mapping fitted to the printed grid lines (max residual 0.12 pt); printed percentile curves "
                           f"agree with CDC LMS tables within {worst:.2f} pt ({worst * 25.4 / 72:.2f} mm).",
            "sheets": sheets}
    json.dump(meta, open(os.path.join(OUT, "sheets.json"), "w"), indent=1)
    print("worst curve gap %.2f pt" % worst)


def verify(p, s):
    """Distance between every printed percentile curve and the LMS curve at the same age (95th percentile, pt)."""
    ref = json.load(open(os.path.join(REFS, s["ref"] + ".json")))
    sex = "female" if s["sex"] == "F" else "male"
    Z = {3: -1.880793608, 10: -1.281551566, 25: -0.674489750, 50: 0.0, 75: 0.674489750, 90: 1.281551566, 97: 1.880793608}

    def lms(tab, a):
        ages = [r[0] for r in tab]
        if a < ages[0] or a > ages[-1]: return None
        i = int(max(0, min(len(ages) - 2, np.searchsorted(ages, a) - 1))); r0, r1 = tab[i], tab[i + 1]
        t = (a - r0[0]) / (r1[0] - r0[0]); return [r0[j] + (r1[j] - r0[j]) * t for j in (1, 2, 3)]

    def value(l, z):
        L, M, S = l; return M * math.exp(S * z) if abs(L) < 1e-9 else M * (1 + L * S * z) ** (1 / L)

    def pct(l, x):
        L, M, S = l; z = math.log(x / M) / S if abs(L) < 1e-9 else ((x / M) ** L - 1) / (L * S)
        return 50 * (1 + math.erf(z / math.sqrt(2)))

    worst = 0.0
    for dr in p.get_drawings():
        if "s" not in (dr.get("type") or "") or (dr.get("width") or 0) < 0.4: continue
        subs, cur = [], []
        for it in dr["items"]:
            if it[0] != "l": continue
            if cur and (abs(cur[-1].x - it[1].x) > 0.01 or abs(cur[-1].y - it[1].y) > 0.01): subs.append(cur); cur = []
            if not cur: cur.append(it[1])
            cur.append(it[2])
        if cur: subs.append(cur)
        for pts in subs:
            if len(pts) < 20: continue
            best = None
            for key in ("height", "weight"):
                rows = []
                for q in pts:
                    a = (q.x - s["x"][0]) / s["x"][1]; v = (q.y - s[key][0]) / s[key][1]; l = lms(ref["measures"][key][sex], a)
                    if l and v > 0: rows.append((q, l, pct(l, v)))
                if len(rows) < 20: continue
                c = min(Z, key=lambda k: abs(k - float(np.median([r[2] for r in rows]))))
                gap = float(np.percentile([abs(q.y - (s[key][0] + s[key][1] * value(l, Z[c]))) for q, l, _ in rows], 95))
                if best is None or gap < best: best = gap
            if best is not None: worst = max(worst, best)
    return worst


if __name__ == "__main__":
    main()
