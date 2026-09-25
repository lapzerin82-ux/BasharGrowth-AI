// Original CDC Set 2 clinical growth-chart pages (vector, unmodified) with the patient's data
// written onto them: each measurement is a red × at (exact age, value) using an axis calibration
// fitted to the printed grid lines, and the sheet's own form fields are filled in.
import * as G from "./growth.js";

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
  const withAge = ms.map((m) => ({ m, a: G.exactAge(p.dob, m.date) })).filter(({ a }) => a.months >= s.ageMin - 1e-9 && a.months <= s.ageMax + 1e-9);
  const latest = {};
  for (const key of ["height", "weight"]) {
    const w = withAge.filter(({ m }) => m[key] != null).sort((x, y) => x.m.date.localeCompare(y.m.date) || x.m.createdAt - y.m.createdAt);
    latest[key] = w.length ? w[w.length - 1].m.id : null;
  }
  const pts = [];
  for (const { m, a } of withAge) for (const key of ["height", "weight"]) {
    if (m[key] == null) continue;
    pts.push({ id: m.id + ":" + key, mid: m.id, key, age: a.months, ageText: a.text, v: m[key], date: m.date, notes: m.notes, latest: m.id === latest[key] });
  }
  const outside = ms.length - withAge.length;
  return { pts, rows: withAge, outside };
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
      date: G.fmtDate(r.m.date), age: isBirth ? "" : r.a.short, // the birth row already reads "Birth"
      weight: r.m.weight != null ? `${r.m.weight} kg` : "", height: r.m.height != null ? `${r.m.height} cm` : "",
      bmi: r.m.weight != null && r.m.height ? (r.m.weight / (r.m.height / 100) ** 2).toFixed(1) : "",
    };
    t.cols.forEach((c, i) => { const x0 = t.x[i], x1 = t.x[i + 1]; txt(vals[c], (x0 + x1) / 2, bottom - (bottom - top) * 0.22, 6.8, "center", x1 - x0 - 2); });
  };
  if (birth) cell(birth, t.birthRow[0], t.birthRow[1], true);
  shown.forEach((r, i) => cell(r, t.rows[i], t.rows[i + 1]));

  // trajectory lines and red crosses
  const pts = data.pts;
  if (data.connect) for (const key of ["height", "weight"]) {
    const q = pts.filter((z) => z.key === key).sort((a, b) => a.age - b.age);
    if (q.length < 2) continue;
    ctx.strokeStyle = "rgba(200,16,28,.8)"; ctx.lineWidth = 0.8; ctx.beginPath();
    q.forEach((z, i) => (i ? ctx.lineTo(px(s, z.age), py(s, key, z.v)) : ctx.moveTo(px(s, z.age), py(s, key, z.v)))); ctx.stroke();
  }
  pts.forEach((z) => cross(ctx, px(s, z.age), py(s, z.key, z.v), z.latest, k, z.id === data.sel));
  ctx.restore();
  return { toScreen: (x, y) => [x * scale + ox, y * scale + oy], toPage: (X, Y) => [(X - ox) / scale, (Y - oy) / scale], scale };
}

/** Which chart a measurement at this age belongs on, for a reference family setting. */
export function viewForAge(family, ageMonths) {
  if (family === "WHO") return ageMonths < 60 ? "who2006" : "who2007";
  if (ageMonths >= 24) return "sheet:2_20";
  return family === "AUTO" ? "who2006_0_2" : "sheet:0_36";
}
