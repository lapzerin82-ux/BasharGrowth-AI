// Growth references, LMS maths and exact age. Mirrors core/ (Kotlin) of the Android app.
export const REF_IDS = ["cdc2000_infant", "cdc2000_child", "who2006", "who2007"];
export const FAMILIES = {
  CDC: "CDC 2000 (birth–36 months, then 2–20 years)",
  WHO: "WHO (2006 standards 0–5 y, then 2007 reference 5–19 y)",
};
export const DAYS_PER_MONTH = 365.25 / 12;

const refs = {};
export async function loadReferences() {
  await Promise.all(REF_IDS.map(async (id) => {
    const r = await (await fetch(`data/${id}.json`)).json();
    for (const k of Object.keys(r.measures)) {
      const m = r.measures[k];
      m.key = k;
      m.whoTails = r.family === "WHO" && k === "weight";
    }
    refs[id] = r;
  }));
}
export const getRef = (id) => refs[id];
export const allRefs = () => REF_IDS.map((id) => refs[id]);

export function defaultRefFor(family, ageMonths) {
  if (family === "WHO") return ageMonths < 60 ? "who2006" : "who2007";
  return ageMonths < 24 ? "cdc2000_infant" : "cdc2000_child";
}

export function covers(m, age) { return age >= m.ageMin - 1e-9 && age <= m.ageMax + 1e-9; }

export function lms(m, sex, age) {
  if (!covers(m, age)) return null;
  const t = m[sex === "F" ? "female" : "male"];
  if (age < t[0][0] - 1e-9 || age > t[t.length - 1][0] + 1e-9) return null;
  let lo = 0, hi = t.length - 1;
  if (age <= t[0][0]) return t[0].slice(1);
  if (age >= t[hi][0]) return t[hi].slice(1);
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid][0] <= age) lo = mid; else hi = mid; }
  const f = (age - t[lo][0]) / (t[hi][0] - t[lo][0]);
  return [1, 2, 3].map((i) => t[lo][i] + (t[hi][i] - t[lo][i]) * f);
}
export function valueAt([L, M, S], z) { return Math.abs(L) < 1e-9 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L); }
export function zOf([L, M, S], x) { return Math.abs(L) < 1e-9 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S); }

export function centileValue(m, sex, age, c) { const p = lms(m, sex, age); return p ? valueAt(p, invNorm(c / 100)) : null; }
export function zValue(m, sex, age, z) { const p = lms(m, sex, age); return p ? valueAt(p, z) : null; }

export function assess(m, sex, age, x) {
  if (!(x > 0)) return null;
  const p = lms(m, sex, age); if (!p) return null;
  let z = zOf(p, x);
  if (m.whoTails && Math.abs(z) > 3) {
    if (z > 3) { const s3 = valueAt(p, 3), s2 = valueAt(p, 2); z = 3 + (x - s3) / (s3 - s2); }
    else { const s3 = valueAt(p, -3), s2 = valueAt(p, -2); z = -3 + (x - s3) / (s2 - s3); }
  }
  return { z, p: cdf(z) * 100 };
}

export function fmtAssess(a) {
  if (!a) return "–";
  const p = a.p;
  const pt = p < 0.1 ? "<P0.1" : p > 99.9 ? ">P99.9" : (p < 1 || p > 99) ? "P" + p.toFixed(1) : "P" + Math.min(99, Math.max(1, Math.round(p)));
  return `${pt} (z ${a.z >= 0 ? "+" : ""}${a.z.toFixed(2)})`;
}

// ---- normal distribution
export function cdf(z) { return 0.5 * erfc(-z / Math.SQRT2); }
const COF = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2, -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4, 4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6, 1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8, 6.529054439e-9, 5.059343495e-9, -9.91364156e-10, -2.27365122e-10, 9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13, 3.13092e-13, -1.12708e-13, 3.81e-16, 7.106e-15, -1.523e-15, -9.4e-17, 1.21e-16, -2.8e-17];
function erfc(x) {
  const z = Math.abs(x), t = 2 / (2 + z), ty = 4 * t - 2;
  let d = 0, dd = 0;
  for (let j = COF.length - 1; j > 0; j--) { const tmp = d; d = ty * d - dd + COF[j]; dd = tmp; }
  const r = t * Math.exp(-z * z + 0.5 * (COF[0] + ty * d) - dd);
  return x >= 0 ? r : 2 - r;
}
export function invNorm(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  let x, q, r;
  if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p <= 1 - 0.02425) { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  else { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const e = cdf(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return x - u / (1 + x * u / 2);
}

// ---- dates (stored as "YYYY-MM-DD"; all arithmetic in UTC days)
export function epochDay(iso) { const [y, m, d] = iso.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
export function todayIso() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; }
export function fmtDate(iso) { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); } // m = 1..12

/** Exact chronological age. Same rules as java.time.Period.between (used by the Android app). */
export function exactAge(dobIso, dateIso) {
  const days = epochDay(dateIso) - epochDay(dobIso);
  const [y1, m1, d1] = dobIso.split("-").map(Number);
  const [y2, m2, d2] = dateIso.split("-").map(Number);
  let total = (y2 * 12 + m2 - 1) - (y1 * 12 + m1 - 1);
  let dd = d2 - d1;
  if (total > 0 && dd < 0) {
    total--;
    const ty = y1 + Math.floor((m1 - 1 + total) / 12), tm = ((m1 - 1 + total) % 12) + 1;
    const td = Math.min(d1, daysInMonth(ty, tm));
    dd = epochDay(dateIso) - Math.round(Date.UTC(ty, tm - 1, td) / 86400000);
  } else if (total < 0 && dd > 0) {
    total++;
    dd -= daysInMonth(y2, m2);
  }
  const years = Math.trunc(total / 12), months = total % 12;
  return {
    days, months: days / DAYS_PER_MONTH, yearsDec: days / 365.25, y: years, m: months, d: dd,
    text: days < 0 ? "before birth" : years > 0 ? `${years} y ${months} m ${dd} d` : months > 0 ? `${months} m ${dd} d` : `${dd} d`,
    short: days < 0 ? "–" : years > 0 ? `${years} y ${months} m` : `${months} m ${dd} d`,
  };
}

export function mph(sex, father, mother) { return (father + mother + (sex === "M" ? 13 : -13)) / 2; }
export const MPH_RANGE = 8.5;

export function fmtNum(v, dp = 1) { const r = Math.round(v * 10 ** dp) / 10 ** dp; return String(r); }
