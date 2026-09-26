#!/usr/bin/env python3
"""
Builds the additional growth references used by the web app (web/data/*.json):

  cdc2000_hc     CDC 2000 head circumference-for-age, birth-36 months     (cdcanthro, _HC columns)
  cdc2000_wfl    CDC 2000 weight-for-length, 45-103.5 cm (0-36 months)     (cdcanthro, denom "length")
  cdc2000_bmi    CDC 2000 BMI-for-age 2-20 y + CDC 2022 extended-BMI sigma (rcpchgrowth cdc2-20.json)
  who2006_hc     WHO 2006 head circumference-for-age 0-5 y                 (rcpchgrowth who_infants/children)
  who2006_bmi    WHO 2006 BMI-for-age 0-5 y                                (rcpchgrowth who_infants/children)
  who2006_wfl    WHO 2006 weight-for-length 45-110 cm (0-2 y)              (pygrowup wfl_*_0_2 tables)
  who2006_wfh    WHO 2006 weight-for-height 65-120 cm (2-5 y)              (pygrowup wfh_*_2_5 tables)
  who2007_bmi    WHO 2007 BMI-for-age 5-19 y                               (rcpchgrowth who_2007_children)
  ds_infant      Down syndrome, birth-36 months (Zemel et al. Pediatrics 2015;136:e1204)  (rcpchgrowth)
  ds_child       Down syndrome, 2-20 years (Zemel et al. 2015)                             (rcpchgrowth)
  turner         Turner syndrome, height 1-20 years (girls)                                (rcpchgrowth)

Every value is a published LMS parameter; nothing is digitised from chart images.
Usage: python3 tools/build_web_extras.py <rcpch data_tables> <cdcanthro dir> <pygrowup tables dir>
Rows are [x, L, M, S] (x = age in months, or length/height in cm); CDC BMI rows add sigma.
"""
import json
import math
import os
import sys

OUT = os.path.join(os.path.dirname(__file__), "..", "web", "data")


def dedupe(rows):
    rows = sorted(rows, key=lambda r: r[0])
    out = []
    for r in rows:
        if out and abs(out[-1][0] - r[0]) < 1e-9:
            out[-1] = r
        else:
            out.append(r)
    return out


def rc(lst, extra=()):
    return dedupe([[round(r["decimal_age"] * 12.0, 6), r["L"], r["M"], r["S"], *[r[e] for e in extra]] for r in lst])


def write(ref):
    with open(os.path.join(OUT, ref["id"] + ".json"), "w") as f:
        json.dump(ref, f, separators=(",", ":"))
    print("wrote", ref["id"], {k: (len(m["male"]), len(m["female"])) for k, m in ref["measures"].items()})


def measure(label, axis, unit, method, lo, hi, male, female, **kw):
    return dict(label=label, axisLabel=axis, unit=unit, method=method, ageMin=lo, ageMax=hi, male=male, female=female, **kw)


def main(rcpch, cdcanthro, pyg):
    import pyreadr
    d = pyreadr.read_r(os.path.join(cdcanthro, "data", "cdc__ref__data.rda"))["cdc__ref__data"]
    age = d[d["denom"] == "age"]
    length = d[d["denom"] == "length"]
    CDC_SRC = "CDC 2000 Growth Charts for the United States (Kuczmarski RJ et al. Vital Health Stat 11. 2002;(246)); LMS tables as distributed in CDC's cdcanthro package."
    WHO_SRC = "WHO Multicentre Growth Reference Study Group. WHO Child Growth Standards. Geneva: WHO; 2006/2007."

    def cdc_hc(sex):
        a = age[age["SEX"] == sex].sort_values("_AGEMOS1")
        rows = [[float(r["_AGEMOS1"]), float(r["_LHC1"]), float(r["_MHC1"]), float(r["_SHC1"])] for _, r in a.iterrows() if not math.isnan(r["_LHC1"])]
        last = a[a["_AGEMOS1"] == rows[-1][0]].iloc[0]
        rows.append([float(last["_AGEMOS2"]), float(last["_LHC2"]), float(last["_MHC2"]), float(last["_SHC2"])])
        return dedupe(rows)

    def cdc_wfl(sex):
        a = length[length["SEX"] == sex].sort_values("_LG1")
        rows = [[float(r["_LG1"]), float(r["_LWLG1"]), float(r["_MWLG1"]), float(r["_SWLG1"])] for _, r in a.iterrows()]
        last = a.iloc[-1]
        rows.append([float(last["_LG2"]), float(last["_LWLG2"]), float(last["_MWLG2"]), float(last["_SWLG2"])])
        return dedupe(rows)

    base = dict(organisation="CDC / NCHS", family="CDC", centiles=[3, 10, 25, 50, 75, 90, 97])
    write(dict(base, id="cdc2000_hc", title="CDC 2000: Head circumference-for-age, birth to 36 months", shortTitle="CDC HC 0-36 mo",
               source=CDC_SRC + " (hcageinf)", version="CDC 2000 (3rd-97th percentiles)",
               measures={"hc": measure("Head circumference-for-age", "Head circumference (cm)", "cm", "Occipitofrontal circumference", 0.0, 36.0, cdc_hc(1), cdc_hc(2))}))
    write(dict(base, id="cdc2000_wfl", title="CDC 2000: Weight-for-length, birth to 36 months", shortTitle="CDC WFL",
               source=CDC_SRC + " (wtleninf)", version="CDC 2000 (3rd-97th percentiles)", centiles=[3, 5, 10, 25, 50, 75, 90, 95, 97],
               measures={"wfl": measure("Weight-for-length", "Weight (kg)", "kg", "Weight and recumbent length", 45.0, 103.5, cdc_wfl(1), cdc_wfl(2),
                                        xKind="length", xLabel="Length (cm)", ageFrom=0.0, ageTo=36.0)}))

    c = json.load(open(os.path.join(rcpch, "cdc2-20.json")))["measurement"]["bmi"]
    write(dict(base, id="cdc2000_bmi", title="CDC 2000: BMI-for-age, 2 to 20 years (with CDC 2022 extended BMI)", shortTitle="CDC BMI 2-20 y",
               source=CDC_SRC + " (bmiagerev). Percentiles above the 95th use the CDC 2022 extended BMI-for-age method "
                      "(Wei R et al. NCHS; 2022): percentile = 90 + 10 x Phi((BMI - P95) / sigma).",
               version="CDC 2000 BMI (5th-95th percentiles) + CDC 2022 extended BMI", centiles=[5, 10, 25, 50, 75, 85, 90, 95],
               measures={"bmi": measure("BMI-for-age", "BMI (kg/m²)", "kg/m²", "Weight / height²", 24.0, 240.0,
                                        [r for r in rc(c["male"], ("sigma",)) if r[0] <= 240.0 + 1e-6], [r for r in rc(c["female"], ("sigma",)) if r[0] <= 240.0 + 1e-6], extBmi=True)}))

    wi = json.load(open(os.path.join(rcpch, "who", "who_infants.json")))["measurement"]
    wc = json.load(open(os.path.join(rcpch, "who", "who_children.json")))["measurement"]
    w7 = json.load(open(os.path.join(rcpch, "who", "who_2007_children.json")))["measurement"]
    both = lambda k, s: dedupe(rc(wi[k][s]) + rc(wc[k][s]))
    wbase = dict(organisation="World Health Organization", family="WHO", centiles=[3, 15, 50, 85, 97])
    write(dict(wbase, id="who2006_hc", title="WHO 2006: Head circumference-for-age, birth to 5 years", shortTitle="WHO HC 0-5 y",
               source=WHO_SRC + " Head circumference-for-age (hcfa).", version="WHO 2006 (3rd-97th percentiles)",
               measures={"hc": measure("Head circumference-for-age", "Head circumference (cm)", "cm", "Occipitofrontal circumference", 0.0, 60.0, both("ofc", "male"), both("ofc", "female"))}))
    write(dict(wbase, id="who2006_bmi", title="WHO 2006: BMI-for-age, birth to 5 years", shortTitle="WHO BMI 0-5 y",
               source=WHO_SRC + " BMI-for-age (bfa).", version="WHO 2006 (3rd-97th percentiles)",
               measures={"bmi": measure("BMI-for-age", "BMI (kg/m²)", "kg/m²", "Weight / length or height²", 0.0, 60.0, both("bmi", "male"), both("bmi", "female"))}))
    write(dict(wbase, id="who2007_bmi", title="WHO 2007: BMI-for-age, 5 to 19 years", shortTitle="WHO BMI 5-19 y",
               source="de Onis M et al. Bull World Health Organ. 2007;85:660-7. BMI-for-age (bfa 5-19 y).", version="WHO 2007 (3rd-97th percentiles)",
               measures={"bmi": measure("BMI-for-age", "BMI (kg/m²)", "kg/m²", "Weight / height²", 60.0, 228.0, rc(w7["bmi"]["male"]), rc(w7["bmi"]["female"]))}))

    def pyg_rows(name, xkey):
        t = json.load(open(os.path.join(pyg, name)))
        return dedupe([[float(r[xkey]), float(r["L"]), float(r["M"]), float(r["S"])] for r in t])
    write(dict(wbase, id="who2006_wfl", title="WHO 2006: Weight-for-length, birth to 2 years", shortTitle="WHO WFL 0-2 y",
               source=WHO_SRC + " Weight-for-length tables (wfl 45-110 cm), as distributed in pygrowup.", version="WHO 2006 (3rd-97th percentiles)",
               measures={"wfl": measure("Weight-for-length", "Weight (kg)", "kg", "Weight and recumbent length", 45.0, 110.0,
                                        pyg_rows("wfl_boys_0_2_zscores.json", "Length"), pyg_rows("wfl_girls_0_2_zscores.json", "Length"),
                                        xKind="length", xLabel="Length (cm)", ageFrom=0.0, ageTo=24.0)}))
    write(dict(wbase, id="who2006_wfh", title="WHO 2006: Weight-for-height, 2 to 5 years", shortTitle="WHO WFH 2-5 y",
               source=WHO_SRC + " Weight-for-height tables (wfh 65-120 cm), as distributed in pygrowup.", version="WHO 2006 (3rd-97th percentiles)",
               measures={"wfl": measure("Weight-for-height", "Weight (kg)", "kg", "Weight and standing height", 65.0, 120.0,
                                        pyg_rows("wfh_boys_2_5_zscores.json", "Height"), pyg_rows("wfh_girls_2_5_zscores.json", "Height"),
                                        xKind="length", xLabel="Height (cm)", ageFrom=24.0, ageTo=60.0)}))

    ti = json.load(open(os.path.join(rcpch, "trisomy_21_aap_infants.json")))["measurement"]
    tc = json.load(open(os.path.join(rcpch, "trisomy_21_aap_children.json")))["measurement"]
    DS_SRC = "Zemel BS, Pipan M, Stallings VA, et al. Growth charts for children with Down syndrome in the United States. Pediatrics. 2015;136(5):e1204-11 (LMS as distributed in rcpchgrowth)."
    dbase = dict(organisation="CDC / Children's Hospital of Philadelphia", family="COND", condition="down", centiles=[5, 10, 25, 50, 75, 90, 95])
    write(dict(dbase, id="ds_infant", title="Down syndrome growth charts: birth to 36 months", shortTitle="Down syndrome 0-36 mo", source=DS_SRC, version="Zemel 2015 (5th-95th percentiles)",
               measures={"height": measure("Length-for-age (Down syndrome)", "Length (cm)", "cm", "Recumbent length", 1.0, 36.0, rc(ti["height"]["male"]), rc(ti["height"]["female"])),
                         "weight": measure("Weight-for-age (Down syndrome)", "Weight (kg)", "kg", "Weight", 0.0, 36.0, rc(ti["weight"]["male"]), rc(ti["weight"]["female"])),
                         "hc": measure("Head circumference-for-age (Down syndrome)", "Head circumference (cm)", "cm", "OFC", 1.0, 36.0, rc(ti["ofc"]["male"]), rc(ti["ofc"]["female"]))}))
    write(dict(dbase, id="ds_child", title="Down syndrome growth charts: 2 to 20 years", shortTitle="Down syndrome 2-20 y", source=DS_SRC, version="Zemel 2015 (5th-95th percentiles)",
               measures={"height": measure("Stature-for-age (Down syndrome)", "Stature (cm)", "cm", "Standing height", 24.0, 240.0, rc(tc["height"]["male"]), rc(tc["height"]["female"])),
                         "weight": measure("Weight-for-age (Down syndrome)", "Weight (kg)", "kg", "Weight", 24.0, 240.0, rc(tc["weight"]["male"]), rc(tc["weight"]["female"])),
                         "hc": measure("Head circumference-for-age (Down syndrome)", "Head circumference (cm)", "cm", "OFC", 24.0, 240.0, rc(tc["ofc"]["male"]), rc(tc["ofc"]["female"])),
                         "bmi": measure("BMI-for-age (Down syndrome)", "BMI (kg/m²)", "kg/m²", "Weight / height²", 24.0, 240.0, rc(tc["bmi"]["male"]), rc(tc["bmi"]["female"]))}))
    tu = json.load(open(os.path.join(rcpch, "turner.json")))["measurement"]
    write(dict(organisation="Turner syndrome reference", family="COND", condition="turner", id="turner", centiles=[3, 10, 25, 50, 75, 90, 97],
               title="Turner syndrome: height-for-age, 1 to 20 years (girls)", shortTitle="Turner syndrome",
               source="Lyon AJ, Preece MA, Grant DB. Growth curve for girls with Turner syndrome. Arch Dis Child. 1985;60:932-5 (LMS as distributed in rcpchgrowth).",
               version="Turner syndrome reference (3rd-97th percentiles)",
               measures={"height": measure("Height-for-age (Turner syndrome)", "Height (cm)", "cm", "Standing height", 12.0, 240.0, [], rc(tu["height"]["female"]))}))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    main(*sys.argv[1:])
