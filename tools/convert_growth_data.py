#!/usr/bin/env python3
"""
Regenerates core/src/main/resources/growthref/*.json from official LMS tables.

Sources (numerical values are the official published LMS parameters; nothing is
digitised from chart images):

  * CDC 2000, birth-36 months (length-for-age, weight-for-age):
      CDC's own `cdcanthro` R package, data/cdc__ref__data.rda
      https://github.com/CDC-DNPAO/CDCAnthro  (mirrors lenageinf.csv / wtageinf.csv)
  * CDC 2000, 2-20 years (stature-for-age, weight-for-age):
      rcpchgrowth (PyPI) data_tables/cdc2-20.json  (mirrors statage.csv / wtage.csv)
  * WHO Child Growth Standards 2006, 0-5 years (daily LMS, length/height & weight):
      rcpchgrowth data_tables/who/who_infants.json + who_children.json
      (mirrors WHO lhfa/wfa expanded daily tables)
  * WHO Growth Reference 2007, 5-19 years (height 5-19 y, weight 5-10 y):
      rcpchgrowth data_tables/who/who_2007_children.json

Usage:
  pip download --no-deps rcpchgrowth && unzip rcpchgrowth-*.whl -d rcpch
  git clone --depth 1 https://github.com/CDC-DNPAO/CDCAnthro && tar xzf CDCAnthro/cdcanthro_*.tar.gz
  pip install pyreadr
  python3 tools/convert_growth_data.py <path-to-rcpch-data_tables> <path-to-cdcanthro>

Ages are written in months (decimal years x 12, or days / 30.4375).
Each row is [ageMonths, L, M, S].
"""
import json
import math
import os
import sys

OUT = os.path.join(os.path.dirname(__file__), "..", "core", "src", "main", "resources", "growthref")


def rows_from_rcpch(lst):
    return [[round(r["decimal_age"] * 12.0, 6), r["L"], r["M"], r["S"]] for r in lst]


def dedupe_sorted(rows):
    rows = sorted(rows, key=lambda r: r[0])
    out = []
    for r in rows:
        if out and abs(out[-1][0] - r[0]) < 1e-9:
            out[-1] = r
        else:
            out.append(r)
    return out


def write(ref):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, ref["id"] + ".json")
    with open(path, "w") as f:
        json.dump(ref, f, separators=(",", ":"))
    n = sum(len(m[s]) for m in ref["measures"].values() for s in ("male", "female"))
    print(f"wrote {path} ({n} rows)")


def main(rcpch_dir, cdcanthro_dir):
    import pyreadr

    # ---------------- CDC 2000 birth-36 months ----------------
    d = pyreadr.read_r(os.path.join(cdcanthro_dir, "data", "cdc__ref__data.rda"))["cdc__ref__data"]
    d = d[d["denom"] == "age"]

    def cdc_inf(sex, lcol, mcol, scol, lcol2, mcol2, scol2, max_age):
        a = d[d["SEX"] == sex].sort_values("_AGEMOS1")
        rows = []
        for _, r in a.iterrows():
            if r["_AGEMOS1"] <= max_age and not math.isnan(r[lcol]):
                rows.append([float(r["_AGEMOS1"]), float(r[lcol]), float(r[mcol]), float(r[scol])])
        # append the upper end-point (the "_2" columns of the last row) so the
        # table covers the full 0-36 month chart width
        last = a[a["_AGEMOS1"] == rows[-1][0]].iloc[0]
        if not math.isnan(last[lcol2]):
            rows.append([float(last["_AGEMOS2"]), float(last[lcol2]), float(last[mcol2]), float(last[scol2])])
        return dedupe_sorted(rows)

    cdc_infant = {
        "id": "cdc2000_infant",
        "title": "CDC 2000 Growth Charts: Birth to 36 months",
        "shortTitle": "CDC 0-36 mo",
        "organisation": "CDC / NCHS",
        "source": "CDC 2000 Growth Charts for the United States (Kuczmarski RJ et al. Vital Health Stat 11. 2002;(246)); "
                  "LMS tables lenageinf / wtageinf, as distributed in CDC's cdcanthro package (CDC-DNPAO/CDCAnthro).",
        "version": "CDC 2000 (Set 2 clinical charts, 3rd-97th percentiles)",
        "centiles": [3, 10, 25, 50, 75, 90, 97],
        "family": "CDC",
        "measures": {
            "height": {
                "label": "Length-for-age", "axisLabel": "Length (cm)", "unit": "cm",
                "method": "Recumbent length",
                "ageMin": 0.0, "ageMax": 36.0,
                "male": cdc_inf(1, "_LLG1", "_MLG1", "_SLG1", "_LLG2", "_MLG2", "_SLG2", 36.0),
                "female": cdc_inf(2, "_LLG1", "_MLG1", "_SLG1", "_LLG2", "_MLG2", "_SLG2", 36.0),
            },
            "weight": {
                "label": "Weight-for-age", "axisLabel": "Weight (kg)", "unit": "kg",
                "method": "Weight",
                "ageMin": 0.0, "ageMax": 36.0,
                "male": cdc_inf(1, "_LWT1", "_MWT1", "_SWT1", "_LWT2", "_MWT2", "_SWT2", 36.5),
                "female": cdc_inf(2, "_LWT1", "_MWT1", "_SWT1", "_LWT2", "_MWT2", "_SWT2", 36.5),
            },
        },
    }
    write(cdc_infant)

    # ---------------- CDC 2000 2-20 years ----------------
    c = json.load(open(os.path.join(rcpch_dir, "cdc2-20.json")))["measurement"]
    cdc_child = {
        "id": "cdc2000_child",
        "title": "CDC 2000 Growth Charts: 2 to 20 years",
        "shortTitle": "CDC 2-20 y",
        "organisation": "CDC / NCHS",
        "source": "CDC 2000 Growth Charts for the United States (Kuczmarski RJ et al. Vital Health Stat 11. 2002;(246)); "
                  "LMS tables statage / wtage.",
        "version": "CDC 2000 (Set 2 clinical charts, 3rd-97th percentiles)",
        "centiles": [3, 10, 25, 50, 75, 90, 97],
        "family": "CDC",
        "measures": {
            "height": {
                "label": "Stature-for-age", "axisLabel": "Stature (cm)", "unit": "cm",
                "method": "Standing height",
                "ageMin": 24.0, "ageMax": 240.0,
                "male": dedupe_sorted(rows_from_rcpch(c["height"]["male"])),
                "female": dedupe_sorted(rows_from_rcpch(c["height"]["female"])),
            },
            "weight": {
                "label": "Weight-for-age", "axisLabel": "Weight (kg)", "unit": "kg",
                "method": "Weight",
                "ageMin": 24.0, "ageMax": 240.0,
                "male": dedupe_sorted(rows_from_rcpch(c["weight"]["male"])),
                "female": dedupe_sorted(rows_from_rcpch(c["weight"]["female"])),
            },
        },
    }
    write(cdc_child)

    # ---------------- WHO 2006 0-5 years ----------------
    wi = json.load(open(os.path.join(rcpch_dir, "who", "who_infants.json")))["measurement"]
    wc = json.load(open(os.path.join(rcpch_dir, "who", "who_children.json")))["measurement"]

    def who05(measure, sex):
        rows = rows_from_rcpch(wi[measure][sex]) + rows_from_rcpch(wc[measure][sex])
        return dedupe_sorted(rows)

    who2006 = {
        "id": "who2006",
        "title": "WHO Child Growth Standards: Birth to 5 years",
        "shortTitle": "WHO 0-5 y",
        "organisation": "World Health Organization",
        "source": "WHO Multicentre Growth Reference Study Group. WHO Child Growth Standards: length/height-for-age, "
                  "weight-for-age, weight-for-length, weight-for-height and BMI-for-age. Geneva: WHO; 2006. "
                  "Daily LMS tables (lhfa, wfa).",
        "version": "WHO 2006 (3rd-97th percentiles)",
        "centiles": [3, 15, 50, 85, 97],
        "family": "WHO",
        "measures": {
            "height": {
                "label": "Length/height-for-age", "axisLabel": "Length/Height (cm)", "unit": "cm",
                "method": "Recumbent length < 24 months, standing height >= 24 months",
                "ageMin": 0.0, "ageMax": 60.0,
                "male": who05("height", "male"), "female": who05("height", "female"),
            },
            "weight": {
                "label": "Weight-for-age", "axisLabel": "Weight (kg)", "unit": "kg",
                "method": "Weight",
                "ageMin": 0.0, "ageMax": 60.0,
                "male": who05("weight", "male"), "female": who05("weight", "female"),
            },
        },
    }
    write(who2006)

    # ---------------- WHO 2006, birth-24 months (CDC/AAP-recommended chart for under-2s) ----------------
    # Same LMS as above, restricted to 0-24 months, drawn with the 2nd-98th percentile set that
    # CDC uses on its WHO charts for US clinical use.
    def upto24(rows):
        return [r for r in rows if r[0] <= 731 / 30.4375 + 1e-9]

    who02 = {
        "id": "who2006_0_2",
        "title": "WHO Growth Standards: Birth to 24 months",
        "shortTitle": "WHO 0-2 y",
        "organisation": "World Health Organization",
        "source": who2006["source"] + " Use of WHO charts for children < 24 months as recommended by CDC/AAP "
                  "(MMWR Recomm Rep 2010;59(RR-9)).",
        "version": "WHO 2006 (CDC/AAP clinical charts for 0-24 months, 2nd-98th percentiles)",
        "centiles": [2, 5, 10, 25, 50, 75, 90, 95, 98],
        "family": "WHO",
        "measures": {
            "height": dict(who2006["measures"]["height"], label="Length-for-age", axisLabel="Length (cm)",
                           method="Recumbent length", ageMax=24.0,
                           male=upto24(who2006["measures"]["height"]["male"]),
                           female=upto24(who2006["measures"]["height"]["female"])),
            "weight": dict(who2006["measures"]["weight"], ageMax=24.0,
                           male=upto24(who2006["measures"]["weight"]["male"]),
                           female=upto24(who2006["measures"]["weight"]["female"])),
        },
    }
    write(who02)

    # ---------------- WHO 2007 5-19 years ----------------
    w7 = json.load(open(os.path.join(rcpch_dir, "who", "who_2007_children.json")))["measurement"]
    who2007 = {
        "id": "who2007",
        "title": "WHO Growth Reference: 5 to 19 years",
        "shortTitle": "WHO 5-19 y",
        "organisation": "World Health Organization",
        "source": "de Onis M et al. Development of a WHO growth reference for school-aged children and adolescents. "
                  "Bull World Health Organ. 2007;85:660-7. LMS tables hfa (5-19 y) and wfa (5-10 y).",
        "version": "WHO 2007 (3rd-97th percentiles)",
        "centiles": [3, 15, 50, 85, 97],
        "family": "WHO",
        "measures": {
            "height": {
                "label": "Height-for-age", "axisLabel": "Height (cm)", "unit": "cm",
                "method": "Standing height",
                "ageMin": 60.0, "ageMax": 228.0,
                "male": dedupe_sorted(rows_from_rcpch(w7["height"]["male"])),
                "female": dedupe_sorted(rows_from_rcpch(w7["height"]["female"])),
            },
            "weight": {
                "label": "Weight-for-age", "axisLabel": "Weight (kg)", "unit": "kg",
                "method": "Weight (WHO reference provided to 10 years only)",
                "ageMin": 60.0, "ageMax": 120.0,
                "male": dedupe_sorted(rows_from_rcpch(w7["weight"]["male"])),
                "female": dedupe_sorted(rows_from_rcpch(w7["weight"]["female"])),
            },
        },
    }
    write(who2007)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
