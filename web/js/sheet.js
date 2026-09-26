// Original CDC Set 2 clinical growth-chart pages (vector, unmodified) with the patient's data
// written onto them: each measurement is a red × at (exact age, value) using an axis calibration
// fitted to the printed grid lines, and the sheet's own form fields are filled in.
import * as G from "./growth.js";
import { drawPointLabels } from "./labels.js";

let META = null;
const images = {};
export async function loadSheets() {
  if (!META) META = await (await fetch("charts/sheets.json")).json();
  return META;
}
export const sheetMeta = () => META;
export function sheetFor(kind, sex) { return META.sheets.find((s) => s.id === `cdc_${kind}_${sex === "F" ? "girls" : "boys"}`); }
export function sheetImage(s) {
  if (!images[s.id]) images[s.id] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s.file; });
  return images[s.id];
}

/** Page coordinates (pt) of a measurement. */
export const px = (s, ageMonths) => s.x[0] + s.x[1] * ageMonths;
export const py = (s, key, v) => s[key][0] + s[key][1] * v;

/** Measurements that belong on this sheet, with their exact ages. */
export function sheetPoints(s, p, ms) {
  // plotted at the age corrected for prematurity when that applies (G.plotAge); a.chrono = chronological age
  const withAge = ms.map((m) => ({ m, a: G.plotAge(p, m.date) })).filter(({ a }) => a.days >= 0 && a.months >= s.ageMin - 1e-9 && a.months <= s.ageMax + 1e-9);
  const latest = {};
  for (const key of ["height", "weight"]) {
    const w = withAge.filter(({ m }) => m[key] != null).sort((x, y) => x.m.date.localeCompare(y.m.date) || x.m.createdAt - y.m.createdAt);
    latest[key] = w.length ? w[w.length - 1].m.id : null;
  }
  const pts = [];
  for (const { m, a } of withAge) for (const key of ["height", "weight"]) {
    if (m[key] == null) continue;
    pts.push({ id: m.id + ":" + key, mid: m.id, key, age: a.months, ageText: G.ageLabel(p, m.date), v: m[key], date: m.date, notes: m.notes, latest: m.id === latest[key] });
  }
  const boneAge = withAge.filter(({ m }) => m.boneAge != null && m.height != null && m.boneAge * 12 >= s.ageMin && m.boneAge * 12 <= s.ageMax)
    .map(({ m, a }) => ({ age: a.months, ba: m.boneAge * 12, v: m.height }));
  const outside = ms.filter((m) => m.height != null || m.weight != null).length - withAge.filter(({ m }) => m.height != null || m.weight != null).length;
  return { pts, rows: withAge.filter(({ m }) => m.height != null || m.weight != null), outside, boneAge };
}

/** Text with a white outline so it stays readable over the chart grid. */
function halo(ctx, text, x, y, size, color, bold) {
  ctx.font = `${bold ? "700 " : "600 "}${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "left"; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = size * 0.45; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function cross(ctx, x, y, latest, k, selected) {
  const h = (latest ? 3.6 : 2.8) * k;
  const seg = (c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - h, y - h); ctx.lineTo(x + h, y + h); ctx.moveTo(x - h, y + h); ctx.lineTo(x + h, y - h); ctx.stroke(); };
  seg("rgba(255,255,255,.9)", (latest ? 2.6 : 2.1) * k); seg(latest ? "#a0000a" : "#e0101c", (latest ? 1.35 : 1.05) * k);
  if (latest) { ctx.setLineDash([1.1 * k, 0.8 * k]); ctx.lineWidth = 0.6 * k; ctx.strokeStyle = "#a0000a"; ctx.beginPath(); ctx.arc(x, y, h + 2.2 * k, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  if (selected) { ctx.lineWidth = 0.9 * k; ctx.strokeStyle = "#0b5563"; ctx.beginPath(); ctx.arc(x, y, h + 4.4 * k, 0, 7); ctx.stroke(); }
}

/**
 * Draws the sheet. vp = visible page region {x0,y0,x1,y1} in pt; the canvas W×H shows it
 * uniformly scaled and centred. Returns a mapper for hit-testing.
 */
export function drawSheet(ctx, W, H, s, img, vp, data) {
  const scale = Math.min(W / (vp.x1 - vp.x0), H / (vp.y1 - vp.y0));
  const ox = (W - (vp.x1 - vp.x0) * scale) / 2 - vp.x0 * scale, oy = (H - (vp.y1 - vp.y0) * scale) / 2 - vp.y0 * scale;
  ctx.save();
  ctx.fillStyle = "#e9eef0"; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, s.page[0], s.page[1]);
  ctx.drawImage(img, 0, 0, s.page[0], s.page[1]);
  const k = 1; // strokes in page points (scale with zoom like ink on paper)
  const ink = "#b0000e";
  const txt = (t, x, y, size = 8, align = "left", maxW) => {
    ctx.font = `${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; ctx.fillStyle = ink; ctx.textAlign = align;
    let str = String(t);
    if (maxW) while (str.length > 1 && ctx.measureText(str).width > maxW) str = str.slice(0, -1);
    ctx.fillText(str, x, y);
  };
  const { p, rows } = data;
  // form fields
  txt(p.name, s.fields.name[0], s.fields.name[1], 9.5, "left", 210);
  txt(p.fileNumber, s.fields.record[0], s.fields.record[1], 9.5, "left", 95);
  if (p.mother) txt(`${p.mother} cm`, s.fields.mother[0], s.fields.mother[1], 7.5);
  if (p.father) txt(`${p.father} cm`, s.fields.father[0], s.fields.father[1], 7.5);
  // measurement table (most recent entries if there are more than the printed rows)
  const t = s.table, sorted = [...rows].sort((a, b) => a.m.date.localeCompare(b.m.date));
  const birth = t.birthRow ? sorted.find((r) => r.a.days === 0) : null;
  const rest = sorted.filter((r) => r !== birth);
  const nRows = t.rows.length - 1, shown = rest.slice(-nRows);
  const cell = (r, top, bottom, isBirth) => {
    const vals = {
      date: G.fmtDate(r.m.date), age: isBirth ? "" : r.a.chrono.short, // the birth row already reads "Birth"
      weight: r.m.weight != null ? `${r.m.weight} kg` : "", height: r.m.height != null ? `${r.m.height} cm` : "",
      bmi: r.m.weight != null && r.m.height ? (r.m.weight / (r.m.height / 100) ** 2).toFixed(1) : "",
    };
    t.cols.forEach((c, i) => { const x0 = t.x[i], x1 = t.x[i + 1]; txt(vals[c], (x0 + x1) / 2, bottom - (bottom - top) * 0.22, 6.8, "center", x1 - x0 - 2); });
  };
  if (birth) cell(birth, t.birthRow[0], t.birthRow[1], true);
  shown.forEach((r, i) => cell(r, t.rows[i], t.rows[i + 1]));

  // genetic target channel (MPH percentile at 20 y traced back to the start of the sheet)
  const tgt = data.showMph ? G.mphTarget(p.sex, p.mph) : null;
  if (tgt) {
    const hm = G.getRef(s.ref).measures.height;
    const curve = (z) => { const o = []; for (let a = s.ageMin; a <= s.ageMax + 1e-9; a += 0.25) { const v = G.zValue(hm, p.sex, Math.min(a, s.ageMax), z); if (v != null) o.push([px(s, a), py(s, "height", v)]); } return o; };
    const lo = curve(tgt.zlo), hi = curve(tgt.zhi), mid = curve(tgt.z);
    ctx.fillStyle = "rgba(0,150,90,.16)"; ctx.beginPath();
    hi.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); [...lo].reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,120,70,.95)"; ctx.lineWidth = 1.1; ctx.setLineDash([3, 1.6]); ctx.beginPath();
    mid.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
    const [lx, ly] = mid[0];
    halo(ctx, `MPH ${G.fmtNum(tgt.mph)} cm = ${G.pctShort({ p: tgt.pct })} at 20 y · target channel`, lx + 3, ly - 5, 7, "#006b44");
  }

  // trajectory lines and red crosses
  const pts = data.pts;
  if (data.connect) for (const key of ["height", "weight"]) {
    const q = pts.filter((z) => z.key === key).sort((a, b) => a.age - b.age);
    if (q.length < 2) continue;
    ctx.strokeStyle = "rgba(200,16,28,.8)"; ctx.lineWidth = 0.8; ctx.beginPath();
    q.forEach((z, i) => (i ? ctx.lineTo(px(s, z.age), py(s, key, z.v)) : ctx.moveTo(px(s, z.age), py(s, key, z.v)))); ctx.stroke();
  }
  for (const b of data.boneAge || []) { // bone age: hollow blue circle at (bone age, height), dashed link to the cross
    const y = py(s, "height", b.v);
    ctx.strokeStyle = "#1f5fbf"; ctx.lineWidth = 0.8; ctx.setLineDash([2, 1.5]); ctx.beginPath(); ctx.moveTo(px(s, b.age), y); ctx.lineTo(px(s, b.ba), y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#fff"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(px(s, b.ba), y, 3, 0, 7); ctx.fill(); ctx.stroke();
    halo(ctx, "BA", px(s, b.ba) - 4, y + 10, 6.5, "#1f5fbf", true);
  }
  pts.forEach((z) => cross(ctx, px(s, z.age), py(s, z.key, z.v), z.latest, k, z.id === data.sel));
  if (data.showPct) {
    const ref = G.getRef(s.ref), size = 13;
    const items = pts.map((z) => ({ x: px(s, z.age), y: py(s, z.key, z.v), text: G.pctShort(G.assess(ref.measures[z.key], p.sex, z.age, z.v)), color: z.latest ? "#8a0008" : "#b0000e" })).filter((it) => it.text);
    drawPointLabels(ctx, items, { size, font: `800 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`, r: 4.5 });
  }
  ctx.restore();
  return { toScreen: (x, y) => [x * scale + ox, y * scale + oy], toPage: (X, Y) => [(X - ox) / scale, (Y - oy) / scale], scale };
}

/** Which chart a measurement at this age belongs on, for a reference family setting. */
export function viewForAge(family, ageMonths) {
  if (family === "WHO") return ageMonths < 60 ? "who2006" : "who2007";
  if (ageMonths >= 24) return "sheet:2_20";
  return family === "AUTO" ? "who2006_0_2" : "sheet:0_36";
}
