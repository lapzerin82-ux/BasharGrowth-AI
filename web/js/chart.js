// Growth chart renderer (same layout and maths as the Android app's GrowthChartRenderer).
// Everything is computed: curves from LMS, each red × at (exact age in months, measured value).
import { centileValue, zValue, invNorm, MPH_RANGE, fmtNum, DAYS_PER_MONTH } from "./growth.js";
import * as G from "./growth.js";

export function niceStep(span, n) {
  if (span <= 0) return 1;
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), x = raw / mag;
  return (x <= 1 ? 1 : x <= 2 ? 2 : x <= 2.5 ? 2.5 : x <= 5 ? 5 : 10) * mag;
}
export function ticks(a, b, s) { const o = []; for (let v = Math.ceil(a / s - 1e-9) * s; v <= b + 1e-9; v += s) o.push(Math.abs(v) < 1e-9 ? 0 : +v.toFixed(6)); return o; }

export function fullBounds(m, sex, values) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const a = m.ageMin + (m.ageMax - m.ageMin) * i / 200;
    const l = zValue(m, sex, a, -2.6), h = zValue(m, sex, a, 2.6);
    if (l != null) lo = Math.min(lo, l); if (h != null) hi = Math.max(hi, h);
  }
  values.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); });
  const step = hi - lo > 60 ? 10 : hi - lo > 20 ? 5 : 1;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  if (m.unit === "kg") lo = Math.max(0, lo);
  return { x0: m.ageMin, x1: m.ageMax, y0: lo, y1: hi };
}
export function zoomVp(vp, f, fx, fy, b, maxZoom = 12) {
  const w = Math.min(Math.max((vp.x1 - vp.x0) / f, (b.x1 - b.x0) / maxZoom), b.x1 - b.x0);
  const h = Math.min(Math.max((vp.y1 - vp.y0) / f, (b.y1 - b.y0) / maxZoom), b.y1 - b.y0);
  const rx = (fx - vp.x0) / (vp.x1 - vp.x0), ry = (fy - vp.y0) / (vp.y1 - vp.y0);
  return clampVp({ x0: fx - rx * w, x1: fx - rx * w + w, y0: fy - ry * h, y1: fy - ry * h + h }, b);
}
export function clampVp(v, b) {
  const w = Math.min(v.x1 - v.x0, b.x1 - b.x0), h = Math.min(v.y1 - v.y0, b.y1 - b.y0);
  const x0 = Math.min(Math.max(v.x0, b.x0), b.x1 - w), y0 = Math.min(Math.max(v.y0, b.y0), b.y1 - h);
  return { x0, x1: x0 + w, y0, y1: y0 + h };
}

function title(ref, m, sex) {
  const who = sex === "F" ? "Girls" : "Boys";
  const age = (x) => x === 0 ? "birth" : x % 12 === 0 ? `${x / 12} years` : `${x} months`;
  const range = m.ageMax <= 36 ? `birth to ${m.ageMax} months` : `${age(m.ageMin)} to ${age(m.ageMax)}`;
  return `${m.label}: ${who}, ${range}`;
}

/**
 * data = { ref, m, sex, points:[{id, age, v, latest}], connect, mph, label, sel }
 * u = device pixels per CSS pixel (or PDF scale). Returns geometry for hit-testing.
 */
export function drawChart(ctx, W, H, data, vp, u) {
  const { ref, m, sex } = data;
  const L = 50 * u, R = 34 * u, T = 46 * u, B = 40 * u, pw = W - L - R, ph = H - T - B;
  const X = (a) => L + (a - vp.x0) / (vp.x1 - vp.x0) * pw, Y = (v) => T + ph - (v - vp.y0) / (vp.y1 - vp.y0) * ph;
  const accent = sex === "F" ? "#b02a68" : "#1558a0", curve = sex === "F" ? "#78204e" : "#1c4678";
  const font = (px, bold) => `${bold ? "600 " : ""}${px * u}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.save();
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent; ctx.font = font(13, true); fitText(ctx, title(ref, m, sex), L, 16 * u, W - L - 6 * u);
  ctx.fillStyle = "#444"; ctx.font = font(9);
  fitText(ctx, `${ref.title} · ${ref.version}${data.label ? "   |   " + data.label : ""}`, L, 29 * u, W - L - 6 * u);
  // legend
  let lx = L + 5 * u; const ly = 41 * u;
  cross(ctx, lx, ly - 3 * u, false, u); ctx.fillStyle = "#444"; ctx.fillText("measurement", lx + 9 * u, ly);
  lx += 94 * u; cross(ctx, lx, ly - 3 * u, true, u); ctx.fillStyle = "#444"; ctx.fillText("latest", lx + 13 * u, ly);
  lx += 50 * u; fitText(ctx, "Percentiles: " + ref.centiles.join(", "), lx, ly, W - lx - 6 * u);

  ctx.fillStyle = "#fffffc"; ctx.fillRect(L, T, pw, ph);
  const span = vp.x1 - vp.x0, years = m.ageMax > 36 && span > 18;
  const xMaj = years ? Math.max(12, Math.floor(niceStep(span / 12, 10)) * 12) : span <= 4 ? 0.5 : span <= 12 ? 1 : 3;
  const xMin = years ? (xMaj <= 12 ? 3 : 12) : xMaj >= 3 ? 1 : xMaj / 2;
  const yMaj = niceStep(vp.y1 - vp.y0, 12);
  const yMin = yMaj >= 5 && (yMaj / 5) / (vp.y1 - vp.y0) * ph > 4 * u ? yMaj / 5 : yMaj / 2;
  const line = (x1, y1, x2, y2, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

  ctx.save(); ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();
  ticks(vp.x0, vp.x1, xMin).forEach((x) => line(X(x), T, X(x), T + ph, "#e4e8ec", 0.5 * u));
  ticks(vp.y0, vp.y1, yMin).forEach((y) => line(L, Y(y), L + pw, Y(y), "#e4e8ec", 0.5 * u));
  ticks(vp.x0, vp.x1, xMaj).forEach((x) => line(X(x), T, X(x), T + ph, "#bec6ce", 0.8 * u));
  ticks(vp.y0, vp.y1, yMaj).forEach((y) => line(L, Y(y), L + pw, Y(y), "#bec6ce", 0.8 * u));

  // WHO 0-5 y: length (< 24 mo) and height (>= 24 mo) are separate curves
  const segs = ref.id === "who2006" && m.key === "height"
    ? [[m.ageMin, 730 / DAYS_PER_MONTH], [731 / DAYS_PER_MONTH, m.ageMax]] : [[m.ageMin, m.ageMax]];
  const labels = [], xEnd = Math.min(vp.x1, m.ageMax);
  ref.centiles.forEach((c, i) => {
    const z = invNorm(c / 100);
    ctx.strokeStyle = curve; ctx.lineWidth = (c === 50 ? 1.8 : i === 0 || i === ref.centiles.length - 1 ? 1.3 : 1) * u; ctx.lineJoin = "round";
    for (const [s0, s1] of segs) {
      const a0 = Math.max(s0, vp.x0), a1 = Math.min(s1, vp.x1); if (a1 <= a0) continue;
      const n = Math.max(2, Math.round((X(a1) - X(a0)) / (2 * u)));
      ctx.beginPath(); let first = true;
      for (let k = 0; k <= n; k++) {
        const a = a0 + (a1 - a0) * k / n, v = zValue(m, sex, a, z); if (v == null) continue;
        first ? ctx.moveTo(X(a), Y(v)) : ctx.lineTo(X(a), Y(v)); first = false;
      }
      ctx.stroke();
    }
    if (xEnd > vp.x0) { const v = centileValue(m, sex, xEnd, c); if (v != null) labels.push([c, Y(v)]); }
  });

  if (m.key === "height" && data.mph && m.ageMax >= 216) {
    const x = X(m.ageMax) - 10 * u;
    if (x >= L && x <= L + pw) {
      const g = "#00785a";
      line(x, Y(data.mph + MPH_RANGE), x, Y(data.mph - MPH_RANGE), g, 2 * u);
      line(x - 4 * u, Y(data.mph + MPH_RANGE), x + 4 * u, Y(data.mph + MPH_RANGE), g, 2 * u);
      line(x - 4 * u, Y(data.mph - MPH_RANGE), x + 4 * u, Y(data.mph - MPH_RANGE), g, 2 * u);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, Y(data.mph), 3.5 * u, 0, 7); ctx.fill();
      ctx.font = font(9, true); ctx.textAlign = "right"; ctx.fillText("MPH " + fmtNum(data.mph), x - 6 * u, Y(data.mph) + 3 * u); ctx.textAlign = "left";
    }
  }

  // genetic target channel from MPH (percentile at 20 y on CDC stature, traced back on this chart)
  const tgt = data.showMph && m.key === "height" ? G.mphTarget(sex, data.mph) : null;
  if (tgt) {
    const a0 = Math.max(m.ageMin, vp.x0), a1 = Math.min(m.ageMax, vp.x1);
    const n = Math.max(2, Math.round((X(a1) - X(a0)) / (3 * u)));
    const curve = (z) => { const o = []; for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n, v = zValue(m, sex, a, z); if (v != null) o.push([X(a), Y(v)]); } return o; };
    const lo = curve(tgt.zlo), hi = curve(tgt.zhi), mid = curve(tgt.z);
    if (mid.length > 1) {
      ctx.fillStyle = "rgba(0,150,90,.16)"; ctx.beginPath();
      hi.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); [...lo].reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,120,70,.95)"; ctx.lineWidth = 1.6 * u; ctx.setLineDash([6 * u, 3 * u]); ctx.beginPath();
      mid.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
      haloTxt(ctx, `MPH ${fmtNum(tgt.mph)} cm = ${G.pctShort({ p: tgt.pct })} at 20 y · target channel`, mid[0][0] + 4 * u, mid[0][1] - 6 * u, font(9, true), "#006b44", u);
    }
  }

  const pts = [...data.points].sort((a, b) => a.age - b.age);
  if (data.connect && pts.length > 1) {
    ctx.strokeStyle = "rgba(200,20,30,.8)"; ctx.lineWidth = 1.4 * u; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(p.age), Y(p.v)) : ctx.moveTo(X(p.age), Y(p.v)))); ctx.stroke();
  }
  pts.forEach((p) => cross(ctx, X(p.age), Y(p.v), p.latest, u, p.id === data.sel));
  if (data.showPct) pts.forEach((p) => {
    const t = G.pctShort(G.assess(m, sex, p.age, p.v));
    if (t) haloTxt(ctx, t, X(p.age) + 8 * u, Y(p.v) - 6 * u, font(9.5, true), p.latest ? "#8a0008" : "#b0000e", u);
  });
  ctx.restore();

  ctx.strokeStyle = "#505a64"; ctx.lineWidth = u; ctx.strokeRect(L, T, pw, ph);
  ctx.fillStyle = curve; ctx.font = font(9.5, true);
  let last = Infinity;
  labels.sort((a, b) => b[1] - a[1]).forEach(([c, y]) => {
    if (y < T - 2 * u || y > T + ph + 2 * u) return;
    const yy = Math.min(y + 3.5 * u, last - 10 * u); ctx.fillText(String(c), L + pw + 3 * u, yy); last = yy;
  });
  ctx.fillStyle = "#282828"; ctx.font = font(10); ctx.textAlign = "center";
  ticks(vp.x0, vp.x1, xMaj).forEach((x) => ctx.fillText(years ? fmtNum(x / 12) : fmtNum(x), X(x), T + ph + 13 * u));
  ctx.textAlign = "right";
  ticks(vp.y0, vp.y1, yMaj).forEach((y) => ctx.fillText(fmtNum(y), L - 4 * u, Y(y) + 3.5 * u));
  ctx.font = font(10.5, true); ctx.textAlign = "center";
  ctx.fillText(years ? "Age (years)" : "Age (months)", L + pw / 2, T + ph + 29 * u);
  ctx.save(); ctx.translate(12 * u, T + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(m.axisLabel, 0, 4 * u); ctx.restore();
  ctx.restore();
  return { X, Y, L, T, pw, ph, pts };
}

function fitText(ctx, text, x, y, maxW) {
  if (ctx.measureText(text).width <= maxW) return ctx.fillText(text, x, y);
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  ctx.fillText(t + "…", x, y);
}

function haloTxt(ctx, text, x, y, f, color, u) {
  ctx.font = f; ctx.textAlign = "left"; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 3 * u; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function cross(ctx, x, y, latest, u, selected) {
  const h = (latest ? 6.5 : 5) * u;
  const seg = (c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - h, y - h); ctx.lineTo(x + h, y + h); ctx.moveTo(x - h, y + h); ctx.lineTo(x + h, y - h); ctx.stroke(); };
  seg("#fff", (latest ? 5 : 4) * u); seg(latest ? "#a0000a" : "#dc141e", (latest ? 2.6 : 2) * u);
  if (latest) { ctx.setLineDash([2 * u, 1.5 * u]); ctx.lineWidth = 1.2 * u; ctx.strokeStyle = "#a0000a"; ctx.beginPath(); ctx.arc(x, y, h + 4 * u, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  if (selected) { ctx.lineWidth = 1.6 * u; ctx.strokeStyle = "#0b5563"; ctx.beginPath(); ctx.arc(x, y, h + 8 * u, 0, 7); ctx.stroke(); }
}

/** Chart data for one patient, reference and measure (points outside the chart's age range are counted, not drawn). */
export function buildChart(p, ms, refId, key, connect, sel) {
  const ref = G.getRef(refId), m = ref.measures[key];
  const withV = ms.filter((x) => (key === "height" ? x.height : x.weight) != null);
  const latest = [...withV].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt).pop()?.id;
  let outside = 0; const points = [];
  for (const x of withV) {
    const a = G.exactAge(p.dob, x.date);
    if (!G.covers(m, a.months)) { outside++; continue; }
    points.push({ id: x.id, age: a.months, v: key === "height" ? x.height : x.weight, latest: x.id === latest, date: x.date, ageText: a.text, notes: x.notes });
  }
  return { ref, m, sex: p.sex, points, connect, mph: p.mph, label: `${p.name} · File ${p.fileNumber}`, sel, outside };
}
