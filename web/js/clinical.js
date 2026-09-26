// Clinical decision-support helpers: growth alerts, height velocity, bone-age projection, blood pressure,
// puberty, laboratory trends, developmental milestones and vaccines. All thresholds are shown to the user
// with their source; nothing here replaces clinical judgement.
import * as G from "./growth.js";

const MAJOR = [5, 10, 25, 50, 75, 90, 95]; // major percentile lines used for "crossing" rules
const linesBetween = (a, b) => MAJOR.filter((c) => c > Math.min(a, b) && c < Math.max(a, b)).length;

/** Visits with plotting age, sorted by date. */
function visits(p, ms) {
  return [...ms].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((m) => ({ m, a: G.plotAge(p, m.date) })).filter((v) => v.a.chrono.days >= 0);
}
/** Percentile of one measure at one visit on the family's standard reference. */
export function pctOf(p, family, key, v) {
  if (v.a.days < 0) return null;
  const id = G.refForKey(family, key, v.a.months); if (!id) return null;
  const a = G.assessKey(id, key, p.sex, v.a.months, v.m);
  return a ? { ...a, refId: id } : null;
}

// ------------------------------------------------------------------ BMI / weight-for-length category
export function weightStatus(p, family, v) {
  const b = pctOf(p, family, "bmi", v);
  if (b) {
    const id = b.refId;
    if (id === "cdc2000_bmi") {
      const bmi = G.mValue(v.m, "bmi"), m = G.getRef(id).measures.bmi, p95 = G.centileValue(m, p.sex, v.a.months, 95);
      const r = bmi / p95 * 100;
      const cls = b.p < 5 ? ["Underweight (BMI < 5th percentile)", "warn"]
        : b.p < 85 ? ["Healthy weight (BMI 5th to < 85th percentile)", "ok"]
          : b.p < 95 ? ["Overweight (BMI 85th to < 95th percentile)", "warn"]
            : r >= 140 ? [`Severe obesity, class 3 (BMI ${G.fmtNum(r, 0)}% of the 95th percentile, ≥ 140%)`, "bad"]
              : r >= 120 ? [`Severe obesity, class 2 (BMI ${G.fmtNum(r, 0)}% of the 95th percentile, ≥ 120%)`, "bad"]
                : [`Obesity, class 1 (BMI ≥ 95th percentile, ${G.fmtNum(r, 0)}% of P95)`, "bad"];
      return { text: `${cls[0]} · BMI ${G.fmtNum(bmi)} kg/m², ${G.fmtNum(b.p, (b.p >= 84.5 && b.p < 85) || (b.p >= 94.5 && b.p < 95) ? 2 : 1)}th percentile`, level: cls[1], basis: "CDC 2000 BMI-for-age with CDC 2022 extended BMI; AAP 2023 obesity classes", a: b };
    }
    const z = b.z, older = id === "who2007_bmi";
    const cls = older
      ? (z > 2 ? ["Obesity (BMI > +2 SD, WHO 2007)", "bad"] : z > 1 ? ["Overweight (BMI > +1 SD, WHO 2007)", "warn"] : z < -3 ? ["Severe thinness (BMI < −3 SD)", "bad"] : z < -2 ? ["Thinness (BMI < −2 SD)", "warn"] : ["Normal BMI-for-age (WHO 2007)", "ok"])
      : (z > 3 ? ["Obese (BMI > +3 SD, WHO 2006)", "bad"] : z > 2 ? ["Overweight (BMI > +2 SD, WHO 2006)", "warn"] : z > 1 ? ["Possible risk of overweight (BMI > +1 SD)", "warn"] : z < -3 ? ["Severely wasted (BMI < −3 SD)", "bad"] : z < -2 ? ["Wasted (BMI < −2 SD)", "warn"] : ["Normal BMI-for-age (WHO 2006)", "ok"]);
    return { text: cls[0], level: cls[1], basis: G.getRef(id).title, a: b };
  }
  const w = pctOf(p, family, "wfl", v);
  if (w) {
    const cdc = w.refId === "cdc2000_wfl";
    const cls = cdc
      ? (w.p >= 95 ? ["High weight-for-length (≥ 95th percentile)", "warn"] : w.p < 5 ? ["Low weight-for-length (< 5th percentile)", "warn"] : ["Weight-for-length 5th–95th percentile", "ok"])
      : (w.z > 2 ? ["High weight-for-length (> 97.7th percentile, +2 SD)", "warn"] : w.z < -3 ? ["Severe wasting (weight-for-length < −3 SD)", "bad"] : w.z < -2 ? ["Wasting (weight-for-length < −2 SD)", "warn"] : ["Weight-for-length within ±2 SD", "ok"]);
    return { text: cls[0], level: cls[1], basis: G.getRef(w.refId).title, a: w };
  }
  return null;
}

// ------------------------------------------------------------------ height velocity
/** Conventional screening thresholds for low prepubertal height velocity (cm/year). */
export function hvThreshold(sex, ageMonths) {
  if (ageMonths < 24) return null;
  if (ageMonths < 48) return 5.5;
  if (ageMonths < 72) return 5.0;
  if (ageMonths < (sex === "F" ? 132 : 156)) return sex === "F" ? 4.5 : 4.0;
  return null; // pubertal ages: velocity depends on pubertal stage
}
export const HV_NOTE = "Not applied to children with a syndrome-specific growth pattern. Low-velocity flags use commonly applied prepubertal screening thresholds (2–4 y < 5.5, 4–6 y < 5.0, 6 y to puberty < 4.0 cm/y in boys, < 4.5 cm/y in girls) over intervals ≥ 6 months. " +
  "“Same-percentile velocity” is the growth needed to stay on the same height percentile, derived from the distance chart (not a velocity-reference percentile).";

/** Height velocity for each height measurement, using the earlier measurement nearest to 12 months before it (6–24 months apart). */
export function heightVelocity(p, ms, family) {
  const hs = visits(p, ms).filter((v) => v.m.height != null);
  const out = [];
  hs.forEach((v, i) => {
    let best = null;
    for (let j = 0; j < i; j++) {
      const dt = (G.epochDay(v.m.date) - G.epochDay(hs[j].m.date)) / 365.25;
      if (dt >= 0.5 && dt <= 2 && (!best || Math.abs(dt - 1) < Math.abs(best.dt - 1))) best = { v0: hs[j], dt };
    }
    if (!best) return;
    const { v0, dt } = best;
    const hv = (v.m.height - v0.m.height) / dt;
    let expected = null;
    const id0 = G.refForKey(family, "height", v0.a.months), id1 = G.refForKey(family, "height", v.a.months);
    if (id0 && id1 && v0.a.days >= 0) {
      const a0 = G.assess(G.getRef(id0).measures.height, p.sex, v0.a.months, v0.m.height);
      const exp = a0 && G.zValue(G.getRef(id1).measures.height, p.sex, v.a.months, a0.z);
      if (exp != null) expected = (exp - v0.m.height) / dt;
    }
    const mid = (v.a.months + v0.a.months) / 2, thr = hvThreshold(p.sex, mid);
    const pubertal = (Number(v.m.tanB) || 0) >= 2;
    out.push({ from: v0.m.date, to: v.m.date, dt, hv, expected, thr: p.condition ? null : thr, low: !p.condition && thr != null && !pubertal && hv < thr, midAge: mid });
  });
  return out;
}

// ------------------------------------------------------------------ bone age
/** Approximate adult height: the child's height percentile for BONE age, carried to 20 years on CDC stature-for-age. */
export function projectedAdultHeight(p, m) {
  if (!(m.boneAge >= 2 && m.boneAge < 20) || !m.height) return null;
  const h = G.getRef("cdc2000_child").measures.height;
  const a = G.assess(h, p.sex, m.boneAge * 12, m.height); if (!a) return null;
  return { cm: G.zValue(h, p.sex, 240, a.z), pctForBA: a.p };
}
export const PAH_NOTE = "Approximate projection only: height percentile for bone age (CDC 2000 stature) carried to 20 years. Not the Bayley–Pinneau or TW3 method; less reliable at extremes of bone age and in pathological growth.";

// ------------------------------------------------------------------ blood pressure (AAP 2017, Flynn JT et al. Pediatrics 2017;140:e20171904)
// Table 6 "Screening BP values requiring further evaluation" (age in years: boys [SBP, DBP], girls [SBP, DBP]).
const BP_SCREEN = { 1: [[98, 52], [98, 54]], 2: [[100, 55], [101, 58]], 3: [[101, 58], [102, 60]], 4: [[102, 60], [103, 62]], 5: [[103, 63], [104, 64]], 6: [[105, 66], [105, 67]], 7: [[106, 68], [106, 68]], 8: [[107, 69], [107, 69]], 9: [[107, 70], [108, 71]], 10: [[108, 72], [109, 72]], 11: [[110, 74], [111, 74]], 12: [[113, 75], [114, 75]] };
export function classifyBp(sex, ageYears, sys, dia) {
  if (!sys && !dia) return null;
  if (ageYears < 1) return { text: "No AAP 2017 thresholds for infants < 1 year", level: "info" };
  if (ageYears >= 13) {
    if (sys >= 140 || dia >= 90) return { text: "Stage 2 hypertension range (≥ 140/90)", level: "bad" };
    if (sys >= 130 || dia >= 80) return { text: "Stage 1 hypertension range (130/80–139/89)", level: "bad" };
    if (sys >= 120) return { text: "Elevated BP (120/< 80 to 129/< 80)", level: "warn" };
    return { text: "Normal BP (< 120/< 80)", level: "ok" };
  }
  if (sys >= 140 || dia >= 90) return { text: "≥ 140/90: at least stage 2 hypertension range", level: "bad" };
  const [s, d] = BP_SCREEN[Math.floor(ageYears)][sex === "F" ? 1 : 0];
  if ((sys || 0) >= s || (dia || 0) >= d) return { text: `At or above AAP 2017 screening value (${s}/${d}): assess percentile for height (full tables) and repeat`, level: "warn" };
  return { text: `Below AAP 2017 screening value (${s}/${d})`, level: "ok" };
}
export const BP_NOTE = "AAP 2017 guideline (Flynn JT et al. Pediatrics 2017;140:e20171904): static cut-offs from 13 years; for 1–12 years the simplified screening table (Table 6) flags values needing full percentile assessment by height. Diagnosis needs repeated measurements (auscultation confirmation).";

// ------------------------------------------------------------------ puberty
export function pubertyFlag(p, ageYears, m) {
  const g = Number(m.tanB) || 0, tv = Number(m.testisVol) || 0;
  const started = p.sex === "F" ? g >= 2 : g >= 2 || tv >= 4;
  if (p.sex === "F" && started && ageYears < 8) return { text: "Breast development (Tanner B ≥ 2) before 8 years: evaluate for precocious puberty", level: "bad" };
  if (p.sex === "M" && started && ageYears < 9) return { text: "Genital development (G ≥ 2 or testes ≥ 4 mL) before 9 years: evaluate for precocious puberty", level: "bad" };
  if (p.sex === "F" && g === 1 && ageYears >= 13) return { text: "No breast development (Tanner B1) at ≥ 13 years: evaluate for delayed puberty", level: "warn" };
  if (p.sex === "M" && g === 1 && tv < 4 && ageYears >= 14) return { text: "No testicular enlargement (G1, < 4 mL) at ≥ 14 years: evaluate for delayed puberty", level: "warn" };
  return null;
}

// ------------------------------------------------------------------ alerts
export const ALERT_NOTE = "Rules: height or head circumference < 3rd / > 97th percentile or beyond ±2 SD; height below the mid-parental target range (from 2 years); crossing ≥ 2 major percentile lines (5, 10, 25, 50, 75, 90, 95) within 24 months (may be normal channel-shifting before 2 years); weight loss ≥ 5% (any loss under 2 years); BMI/weight-for-length categories; low height velocity; early or delayed puberty; BP category; bone age ± 2 years from chronological age; loss of developmental skills or missed milestones.";

export function growthAlerts(p, ms, family) {
  const out = [], vs = visits(p, ms);
  const add = (level, text, date) => out.push({ level, text, date });
  const last = (key) => [...vs].reverse().find((v) => G.mValue(v.m, key) != null && v.a.days >= 0);
  // latest values
  for (const [key, name] of [["height", "Height"], ["weight", "Weight"], ["hc", "Head circumference"]]) {
    const v = last(key); if (!v) continue;
    const a = pctOf(p, family, key, v); if (!a) continue;
    const pt = G.fmtAssess(a);
    if (key === "hc") {
      if (a.z < -3) add("bad", `Severe microcephaly: head circumference < −3 SD (${pt})`, v.m.date);
      else if (a.z < -2) add("bad", `Microcephaly: head circumference < −2 SD (${pt})`, v.m.date);
      else if (a.z > 2) add("warn", `Macrocephaly: head circumference > +2 SD (${pt})`, v.m.date);
    } else if (key === "height") {
      if (a.z < -2) add("bad", `Short stature: height < −2 SD (${pt})`, v.m.date);
      else if (a.p < 3) add("warn", `Height below the 3rd percentile (${pt})`, v.m.date);
      else if (a.p > 97) add("info", `Tall stature: height above the 97th percentile (${pt})`, v.m.date);
      const t = G.mphTarget(p.sex, p.mph);
      if (t && v.a.months >= 24 && a.z < t.zlo) add("warn", `Height (${pt}) is below the mid-parental target range (MPH ${G.fmtNum(p.mph)} cm = ${G.fmtAssess({ p: t.pct })}; range ± 8.5 cm)`, v.m.date);
    } else if (a.z < -2) add("bad", `Weight < −2 SD (${pt})`, v.m.date);
  }
  // percentile crossing within 24 months before the latest value
  for (const [key, name] of [["height", "Height"], ["weight", "Weight"], ["hc", "Head circumference"], ["bmi", "BMI"]]) {
    const v = last(key); if (!v) continue;
    const a = pctOf(p, family, key, v); if (!a) continue;
    let worst = null;
    for (const u of vs) {
      if (u === v || u.a.days < 0 || G.mValue(u.m, key) == null) continue;
      const gap = (G.epochDay(v.m.date) - G.epochDay(u.m.date)) / 365.25; if (gap <= 0 || gap > 2) continue;
      const b = pctOf(p, family, key, u); if (!b) continue;
      const n = linesBetween(a.p, b.p);
      if (n >= 2 && (!worst || n > worst.n)) worst = { n, b, u };
    }
    if (worst) {
      const down = a.p < worst.b.p;
      const infant = worst.u.a.months < 24;
      const lvl = key === "hc" ? "bad" : down ? (key === "bmi" ? "warn" : "bad") : key === "height" ? "info" : "warn";
      add(lvl, `${name} crossed ${worst.n} major percentile lines ${down ? "downward" : "upward"} (${G.fmtAssess(worst.b).replace(" percentile", "")} → ${G.fmtAssess(a)}) since ${G.fmtDate(worst.u.m.date)}${infant ? " — may be normal channel-shifting under 2 years" : ""}`, v.m.date);
    }
  }
  // weight loss between consecutive weights
  const ws = vs.filter((v) => v.m.weight != null);
  if (ws.length >= 2) {
    const [a, b] = ws.slice(-2), loss = a.m.weight - b.m.weight, pc = loss / a.m.weight * 100;
    if (loss > 0 && (pc >= 5 || b.a.chrono.months < 24)) add(pc >= 10 ? "bad" : "warn", `Weight loss of ${G.fmtNum(loss, 2)} kg (${G.fmtNum(pc)}%) since ${G.fmtDate(a.m.date)}`, b.m.date);
  }
  // BMI / weight-for-length category
  const lw = [...vs].reverse().find((v) => v.m.weight != null && v.m.height != null && v.a.days >= 0);
  if (lw) { const s = weightStatus(p, family, lw); if (s && s.level !== "ok") add(s.level, s.text, lw.m.date); }
  // velocity
  const hvs = heightVelocity(p, ms, family), lastTo = hvs.length ? G.epochDay(hvs[hvs.length - 1].to) : 0;
  const hv = p.condition ? null : [...hvs].reverse().find((r) => r.low && lastTo - G.epochDay(r.to) <= 366);
  if (hv) add("warn", `Low height velocity: ${G.fmtNum(hv.hv)} cm/year (screening threshold ${hv.thr} cm/year) between ${G.fmtDate(hv.from)} and ${G.fmtDate(hv.to)}`, hv.to);
  // latest visit: BP, puberty, bone age
  const lv = (f) => [...vs].reverse().find((v) => f(v.m));
  const bp = lv((m) => m.bpSys || m.bpDia);
  if (bp) { const c = classifyBp(p.sex, bp.a.chrono.yearsDec, bp.m.bpSys, bp.m.bpDia); if (c && (c.level === "warn" || c.level === "bad")) add(c.level, `BP ${bp.m.bpSys || "–"}/${bp.m.bpDia || "–"} mmHg: ${c.text}`, bp.m.date); }
  const tn = lv((m) => m.tanB || m.testisVol);
  if (tn) { const f = pubertyFlag(p, tn.a.chrono.yearsDec, tn.m); if (f) add(f.level, f.text, tn.m.date); }
  const ba = lv((m) => m.boneAge != null);
  if (ba) { const d = ba.m.boneAge - ba.a.chrono.yearsDec; if (Math.abs(d) >= 2) add("warn", `Bone age ${d > 0 ? "advanced" : "delayed"} by ${G.fmtNum(Math.abs(d))} years (BA ${ba.m.boneAge} y, CA ${G.fmtNum(ba.a.chrono.yearsDec)} y)`, ba.m.date); }
  // development
  const dv = milestoneSummary(p);
  if (dv.lost) add("bad", `Loss of previously acquired skills (${dv.lost} milestone${dv.lost > 1 ? "s" : ""}) — developmental red flag`, null);
  if (dv.missed) add("warn", `${dv.missed} milestone${dv.missed > 1 ? "s" : ""} not yet achieved at or after the expected age (CDC 2022: ≥ 75% of children achieve them) — consider developmental screening`, null);
  // vaccines
  const od = overdueVaccines(p);
  if (od.length) add("warn", `Vaccination overdue: ${od.map((v) => `${v.name}${v.dose ? " " + v.dose : ""} (due ${G.fmtDate(v.due)})`).join(", ")}`, null);
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// ------------------------------------------------------------------ laboratory values
export function parseNum(s) { const m = String(s ?? "").replace(",", ".").match(/^\s*([-+]?\d*\.?\d+)/); return m ? parseFloat(m[1]) : null; }
/** "3.5-5.1", "3.5 – 5.1", "<5", "≤ 5", ">10" -> {lo, hi} */
export function parseRange(s) {
  const t = String(s ?? "").replace(/,/g, ".").trim(); if (!t) return null;
  let m = t.match(/^([-+]?\d*\.?\d+)\s*(?:-|–|—|to)\s*([-+]?\d*\.?\d+)/i); if (m) return { lo: +m[1], hi: +m[2] };
  m = t.match(/^(?:<|≤|<=)\s*([-+]?\d*\.?\d+)/); if (m) return { lo: null, hi: +m[1] };
  m = t.match(/^(?:>|≥|>=)\s*([-+]?\d*\.?\d+)/); if (m) return { lo: +m[1], hi: null };
  return null;
}
/** "H", "L" or "" for a result row. */
export function labFlag(r) {
  const v = parseNum(r.value), rg = parseRange(r.ref); if (v == null || !rg) return "";
  if (rg.hi != null && v > rg.hi) return "H";
  if (rg.lo != null && v < rg.lo) return "L";
  return "";
}
/** Numeric series per test (≥ 2 values), oldest first. */
export function labTrends(invs) {
  const by = {};
  for (const x of invs) for (const r of x.results || []) {
    const v = parseNum(r.value); if (v == null || !r.test) continue;
    const k = r.test.trim().toLowerCase();
    (by[k] ||= { test: r.test.trim(), unit: r.unit || "", pts: [] }).pts.push({ date: x.date, v, ref: r.ref || "", flag: labFlag(r), raw: r.value });
  }
  return Object.values(by).filter((s) => s.pts.length >= 2).map((s) => ({ ...s, pts: s.pts.sort((a, b) => a.date.localeCompare(b.date)) }));
}
/** Small inline SVG line chart with the reference band. */
export function sparkline(s, w = 220, h = 54) {
  const vs = s.pts.map((q) => q.v), rg = parseRange(s.pts[s.pts.length - 1].ref);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (rg?.lo != null) lo = Math.min(lo, rg.lo); if (rg?.hi != null) hi = Math.max(hi, rg.hi);
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const t0 = G.epochDay(s.pts[0].date), t1 = Math.max(t0 + 1, G.epochDay(s.pts[s.pts.length - 1].date));
  const X = (d) => 6 + (G.epochDay(d) - t0) / (t1 - t0) * (w - 12), Y = (v) => h - 6 - (v - lo) / (hi - lo) * (h - 12);
  const band = rg ? `<rect x="0" width="${w}" y="${Y(rg.hi ?? hi)}" height="${Math.max(0, Y(rg.lo ?? lo) - Y(rg.hi ?? hi))}" fill="rgba(0,150,90,.14)"/>` : "";
  const path = s.pts.map((q, i) => `${i ? "L" : "M"}${X(q.date).toFixed(1)},${Y(q.v).toFixed(1)}`).join("");
  const dots = s.pts.map((q) => `<circle cx="${X(q.date).toFixed(1)}" cy="${Y(q.v).toFixed(1)}" r="3.2" fill="${q.flag ? "#c0101c" : "#0b5563"}"/>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="spark" role="img" aria-label="Trend of ${s.test}">${band}<path d="${path}" fill="none" stroke="#0b5563" stroke-width="1.6"/>${dots}</svg>`;
}

// ------------------------------------------------------------------ developmental milestones
// Adapted (wording shortened) from the CDC "Learn the Signs. Act Early." checklists revised in 2022
// (Zubler JM et al. Evidence-informed milestones for developmental surveillance tools. Pediatrics 2022;149:e2021052138).
// Each milestone is one that ≥ 75% of children are expected to reach by that age.
export const MILESTONES = {
  2: ["S|Calms down when spoken to or picked up", "S|Looks at your face", "S|Seems happy to see you when you walk up", "S|Smiles when you talk to or smile at them", "L|Makes sounds other than crying", "L|Reacts to loud sounds", "C|Watches you as you move", "C|Looks at a toy for several seconds", "M|Holds head up when on tummy", "M|Moves both arms and both legs", "M|Opens hands briefly"],
  4: ["S|Smiles on their own to get your attention", "S|Chuckles when you try to make them laugh", "S|Looks at you, moves or makes sounds to get or keep your attention", "L|Makes sounds like “oooo”, “aahh” (cooing)", "L|Makes sounds back when you talk", "L|Turns head towards the sound of your voice", "C|If hungry, opens mouth on seeing breast or bottle", "C|Looks at their hands with interest", "M|Holds head steady without support when held", "M|Holds a toy when you put it in their hand", "M|Uses arm to swing at toys", "M|Brings hands to mouth", "M|Pushes up onto elbows/forearms when on tummy"],
  6: ["S|Knows familiar people", "S|Likes to look at self in a mirror", "S|Laughs", "L|Takes turns making sounds with you", "L|Blows “raspberries”", "L|Makes squealing noises", "C|Puts things in mouth to explore them", "C|Reaches to grab a toy they want", "C|Closes lips to show they don't want more food", "M|Rolls from tummy to back", "M|Pushes up with straight arms when on tummy", "M|Leans on hands to support self when sitting"],
  9: ["S|Is shy, clingy or fearful around strangers", "S|Shows several facial expressions (happy, sad, angry, surprised)", "S|Looks when you call their name", "S|Reacts when you leave", "S|Smiles or laughs when you play peek-a-boo", "L|Makes different sounds like “mamamama” and “babababa”", "L|Lifts arms up to be picked up", "C|Looks for objects when dropped out of sight", "C|Bangs two things together", "M|Gets to a sitting position by self", "M|Moves things from one hand to the other", "M|Uses fingers to “rake” food towards self", "M|Sits without support"],
  12: ["S|Plays games with you, like pat-a-cake", "L|Waves “bye-bye”", "L|Calls a parent “mama”, “dada” or another special name", "L|Understands “no”", "C|Puts something in a container", "C|Looks for things they see you hide", "M|Pulls up to stand", "M|Walks, holding on to furniture", "M|Drinks from a cup without a lid, as you hold it", "M|Picks things up between thumb and pointer finger"],
  15: ["S|Copies other children while playing", "S|Shows you an object they like", "S|Claps when excited", "S|Hugs a stuffed doll or other toy", "S|Shows you affection", "L|Tries to say one or two words besides “mama” or “dada”", "L|Looks at a familiar object when you name it", "L|Follows directions given with both a gesture and words", "L|Points to ask for something or to get help", "C|Tries to use things the right way (phone, cup, book)", "C|Stacks at least two small objects", "M|Takes a few steps on their own", "M|Uses fingers to feed self some food"],
  18: ["S|Moves away from you, but looks to make sure you are close by", "S|Points to show you something interesting", "S|Puts hands out for you to wash them", "S|Looks at a few pages in a book with you", "S|Helps you dress them", "L|Tries to say three or more words besides “mama” or “dada”", "L|Follows one-step directions without gestures", "C|Copies you doing chores", "C|Plays with toys in a simple way, like pushing a toy car", "M|Walks without holding on", "M|Scribbles", "M|Drinks from a cup without a lid (may spill)", "M|Feeds self with fingers", "M|Tries to use a spoon", "M|Climbs on and off a couch or chair without help"],
  24: ["S|Notices when others are hurt or upset", "S|Looks at your face to see how to react in a new situation", "L|Points to things in a book when asked", "L|Says at least two words together, like “More milk”", "L|Points to at least two body parts when asked", "L|Uses more gestures than just waving and pointing", "C|Holds something in one hand while using the other hand", "C|Tries to use switches, knobs or buttons on a toy", "C|Plays with more than one toy at the same time", "M|Kicks a ball", "M|Runs", "M|Walks (not climbs) up a few stairs with or without help", "M|Eats with a spoon"],
  30: ["S|Plays next to other children and sometimes plays with them", "S|Shows you what they can do by saying “Look at me!”", "S|Follows simple routines when told", "L|Says about 50 words", "L|Says two or more words together, with one action word", "L|Names things in a book when you point and ask", "L|Says words like “I”, “me” or “we”", "C|Uses things to pretend", "C|Shows simple problem-solving skills", "C|Follows two-step instructions", "C|Shows they know at least one colour", "M|Uses hands to twist things (doorknobs, lids)", "M|Takes some clothes off by self", "M|Jumps off the ground with both feet", "M|Turns book pages, one at a time"],
  36: ["S|Calms down within 10 minutes after you leave", "S|Notices other children and joins them to play", "L|Talks with you in conversation using at least two back-and-forth exchanges", "L|Asks “who”, “what”, “where” or “why” questions", "L|Says what action is happening in a picture or book", "L|Says first name when asked", "L|Talks well enough for others to understand, most of the time", "C|Draws a circle when shown how", "C|Avoids touching hot objects when warned", "M|Strings items together, like large beads", "M|Puts on some clothes by self", "M|Uses a fork"],
  48: ["S|Pretends to be something else during play", "S|Asks to go play with children if none are around", "S|Comforts others who are hurt or sad", "S|Avoids danger (e.g. does not jump from tall heights)", "S|Likes to be a “helper”", "S|Changes behaviour based on where they are", "L|Says sentences with four or more words", "L|Says some words from a song, story or nursery rhyme", "L|Talks about at least one thing that happened during the day", "L|Answers simple questions like “What is a coat for?”", "C|Names a few colours of items", "C|Tells what comes next in a well-known story", "C|Draws a person with three or more body parts", "M|Catches a large ball most of the time", "M|Serves self food or pours water, with supervision", "M|Unbuttons some buttons", "M|Holds crayon or pencil between fingers and thumb (not a fist)"],
  60: ["S|Follows rules or takes turns when playing games", "S|Sings, dances or acts for you", "S|Does simple chores at home", "L|Tells a story with at least two events", "L|Answers simple questions about a book or story", "L|Keeps a conversation going with more than three back-and-forth exchanges", "L|Uses or recognises simple rhymes", "C|Counts to 10", "C|Names some numbers between 1 and 5 when you point to them", "C|Uses words about time, like “yesterday”, “tomorrow”, “morning”", "C|Pays attention for 5 to 10 minutes during activities", "C|Writes some letters in their name", "C|Names some letters when you point to them", "M|Buttons some buttons", "M|Hops on one foot"],
};
export const DOMAINS = { S: "Social / emotional", L: "Language / communication", C: "Cognitive", M: "Movement / physical" };
export const ageBandLabel = (mo) => mo < 24 ? `${mo} months` : mo === 30 ? "30 months" : `${mo / 12} years`;
export const MILESTONE_SOURCE = "Adapted from CDC “Learn the Signs. Act Early.” milestone checklists (2022 revision; Zubler JM et al. Pediatrics 2022;149:e2021052138). Missing milestones are a reason for developmental screening with a validated tool, not a diagnosis.";
export const msId = (band, i) => `${band}:${i}`;

/** Counts of lost milestones and milestones marked "not yet" for age bands the child has reached (corrected age). */
export function milestoneSummary(p) {
  const st = p.milestones || {};
  const age = p.dob ? G.plotAge(p, G.todayIso()).months : 0;
  let lost = 0, missed = 0, yes = 0;
  for (const [k, v] of Object.entries(st)) {
    const band = +k.split(":")[0];
    if (v.s === "lost") lost++; else if (v.s === "no" && age >= band) missed++; else if (v.s === "yes") yes++;
  }
  return { lost, missed, yes };
}

// ------------------------------------------------------------------ vaccines
export const VACCINES = ["BCG", "Hepatitis B", "OPV (oral polio)", "IPV (inactivated polio)", "DTaP / DTwP", "Hib", "Pentavalent (DTP-HepB-Hib)", "Hexavalent (DTaP-IPV-HepB-Hib)", "Pneumococcal conjugate (PCV)", "Rotavirus", "MMR", "Measles / MR", "Varicella", "MMRV", "Hepatitis A", "Meningococcal ACWY", "Meningococcal B", "Typhoid conjugate", "HPV", "Tdap / Td", "Influenza", "COVID-19", "RSV (nirsevimab)", "Yellow fever", "Japanese encephalitis", "Rabies"];
/** Doses whose next-due date has passed without a later dose of the same vaccine recorded. */
export function overdueVaccines(p) {
  const list = p.vaccines || [], today = G.todayIso();
  return list.filter((v) => v.due && v.due < today && !list.some((w) => w !== v && w.name === v.name && w.date && w.date >= v.due));
}

// ------------------------------------------------------------------ text helpers
/** "B3 PH2" / "G3 PH2, testes 8 mL" */
export function tannerText(p, m) {
  const t = [];
  if (m.tanB) t.push(`${p.sex === "F" ? "B" : "G"}${m.tanB}`);
  if (m.tanPH) t.push(`PH${m.tanPH}`);
  let s = t.join(" ");
  if (m.testisVol) s += `${s ? ", " : ""}testes ${m.testisVol} mL`;
  if (m.menarche) s += `${s ? ", " : ""}menarche`;
  return s;
}
/** Extra per-visit findings as short text parts. */
export function visitDetails(p, m) {
  const out = [], a = G.exactAge(p.dob, m.date);
  if (m.bpSys || m.bpDia) { const c = classifyBp(p.sex, a.yearsDec, m.bpSys, m.bpDia); out.push(`BP ${m.bpSys ?? "–"}/${m.bpDia ?? "–"} mmHg${c ? ` (${c.text})` : ""}`); }
  const tn = tannerText(p, m); if (tn) out.push(`Tanner ${tn}`);
  if (m.boneAge != null) out.push(`Bone age ${m.boneAge} y${m.boneAgeMethod ? ` (${m.boneAgeMethod})` : ""}, CA ${G.fmtNum(a.yearsDec)} y`);
  if (m.lowerSeg && m.height) out.push(`US/LS ${G.fmtNum((m.height - m.lowerSeg) / m.lowerSeg, 2)} (LS ${m.lowerSeg} cm)`);
  if (m.armSpan) out.push(`Arm span ${m.armSpan} cm${m.height ? ` (span − height ${m.armSpan - m.height >= 0 ? "+" : ""}${G.fmtNum(m.armSpan - m.height)} cm)` : ""}`);
  return out;
}
export const SOAP = [["subj", "S"], ["obj", "O"], ["assess", "A"], ["plan", "P"]];
