// Printable patient report built with jsPDF (vendor/jspdf.umd.min.js, loaded on demand).
import * as G from "./growth.js";
import { drawChart, fullBounds, buildChart } from "./chart.js";
import { loadSheets, sheetFor, sheetImage, sheetPoints, drawSheet, viewForAge } from "./sheet.js";
import * as C from "./clinical.js";

function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  return new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "vendor/jspdf.umd.min.js";
    s.onload = () => res(window.jspdf); s.onerror = () => rej(new Error("PDF library failed to load"));
    document.head.append(s);
  });
}

export async function buildPdf(p, ms, family, connect, clinician, invs = [], getFile = null) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  // The built-in PDF fonts only cover Western European characters: map symbols outside that set.
  const MAP = { "≈": "approx.", "≤": "<=", "≥": ">=", "⁰": "^0", "⁴": "^4", "⁵": "^5", "⁶": "^6", "⁷": "^7", "⁸": "^8", "⁹": "^9", "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "→": "->", "↑": "(H)", "↓": "(L)", "✓": "yes", "•": "-", "−": "-", "⚠": "!", "▲": "!", "ℹ": "i", "“": '"', "”": '"', "’": "'", "‘": "'", "“": '"', "”": '"' };
  const safe = (t) => String(t).replace(/[≈≤≥⁰⁴-⁹₀-₄→↑↓✓•‘’“”−⚠▲ℹ]/g, (c) => MAP[c] ?? c).replace(/[^\u0000-\u00ff–—…€×µ²³¹]/g, "?");
  const origText = doc.text.bind(doc), origSplit = doc.splitTextToSize.bind(doc);
  doc.text = (t, ...a) => origText(Array.isArray(t) ? t.map(safe) : safe(t), ...a);
  doc.splitTextToSize = (t, ...a) => origSplit(safe(t), ...a);
  const W = 595, H = 842, M = 40;
  const teal = [11, 85, 99];
  let y = M + 10, page = 1;
  let onSheet = false; // original CDC pages are left exactly as printed (no footer)
  const footer = () => { if (onSheet) return; doc.setFontSize(7.5); doc.setTextColor(90); doc.text(`Generated ${new Date().toLocaleString()} by ${clinician} · Pediatric Growth Chart (developed by Dr. Bashar Ibrahim, Pediatrician) · page ${page}`, M, doc.internal.pageSize.getHeight() - 20); doc.setTextColor(0); };
  const newPage = (orientation = "p") => { footer(); doc.addPage("a4", orientation); page++; y = M + 10; };
  const ensure = (need) => { if (y + need > H - 40) newPage(); };
  const h2 = (t) => { ensure(30); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(...teal); doc.text(t, M, y); doc.setTextColor(0); y += 16; };

  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...teal); doc.text("Pediatric Growth Report", M, y); y += 26;
  h2("Patient information");
  const today = G.todayIso();
  const tgt = G.mphTarget(p.sex, p.mph);
  const mphTxt = p.mph ? `${G.fmtNum(p.mph)} cm = ${G.fmtAssess({ p: tgt.pct })} at 20 y (target range ${G.fmtNum(p.mph - 8.5)}–${G.fmtNum(p.mph + 8.5)} cm)${p.mphManual ? ", entered manually" : ""}` : "-";
  const info = [["Name", p.name || "-"], ["Sex", p.sex === "F" ? "Female" : "Male"], ["File number", p.fileNumber || "-"], ["Date of birth", G.fmtDob(p)],
    ["Current age", `${G.exactAge(p.dob, today).text} (on ${G.fmtDate(today)})`], ["Father's height", p.father ? p.father + " cm" : "-"],
    ["Mother's height", p.mother ? p.mother + " cm" : "-"], ["Mid-parental height", mphTxt]];
  const nowA = G.plotAge(p, today);
  if (nowA.corrected) info.splice(5, 0, ["Corrected age", nowA.days < 0 ? "before term" : nowA.text]);
  if (p.gaWeeks) info.push(["Gestational age", `${p.gaWeeks}+${p.gaDays || 0} weeks${p.gaWeeks < 37 ? " (preterm)" : ""}`]);
  if (p.birthWeight) info.push(["Birth weight", `${p.birthWeight} kg`]);
  if (p.condition) info.push(["Condition", G.CONDITIONS[p.condition] || p.condition]);
  if (p.diagnoses) info.push(["Other diagnoses", p.diagnoses]);
  const lwm = [...ms].reverse().find((m) => m.weight != null && m.height != null);
  const wst = lwm ? C.weightStatus(p, family, { m: lwm, a: G.plotAge(p, lwm.date) }) : null;
  if (wst) info.push(["Weight status", `${wst.text} (${G.fmtDate(lwm.date)})`]);
  doc.setFontSize(10);
  for (const [k, v] of info) {
    doc.setFont("helvetica", "bold"); doc.text(k, M, y); doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(v), W - 2 * M - 120); lines.forEach((l, i) => doc.text(l, M + 120, y + i * 12)); y += 2 + 12 * lines.length;
  }
  const para = (text, size = 9.5, color = 0, indent = 0) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...[].concat(color)); for (const l of doc.splitTextToSize(text, W - 2 * M - indent)) { ensure(13); doc.text(l, M + indent, y); y += size + 3; } doc.setTextColor(0); };
  const alerts = C.growthAlerts(p, ms, family);
  if (alerts.length) {
    y += 6; h2("Growth & clinical alerts");
    for (const a of alerts) para(`${a.level === "bad" ? "!!" : a.level === "warn" ? "!" : "i"}  ${a.text}${a.date ? ` (${G.fmtDate(a.date)})` : ""}`, 9.5, a.level === "bad" ? [170, 0, 0] : a.level === "warn" ? [140, 80, 0] : [60, 60, 60]);
    para(C.ALERT_NOTE, 7.5, 90);
  }
  for (const [title, text] of [["Main complaint", p.complaint], ["Clinical features", p.features], ["Notes", p.notes]]) {
    if (!text) continue;
    y += 6; h2(title);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const line of doc.splitTextToSize(text, W - 2 * M)) { ensure(14); doc.text(line, M, y); y += 13; }
  }
  y += 8; h2("Visits & growth measurements");
  const hasB = ms.some((m) => m.height && m.weight), hasH = ms.some((m) => m.hc != null);
  const heads = ["Date", "Age", "Height (percentile)", "Weight (percentile)"].concat(hasB ? ["BMI (percentile)"] : [], hasH ? ["Head circ. (percentile)"] : []);
  const cw = (W - 2 * M) / (heads.length + 0.6), cols = heads.map((_, i) => M + (i === 0 ? 0 : cw * (i + 0.6)));
  const head = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); heads.forEach((t, i) => doc.text(t, cols[i], y)); y += 5; doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 12; doc.setFont("helvetica", "normal"); };
  head();
  const refsUsed = new Set();
  for (const m of ms) {
    if (y + 26 > H - 40) { newPage(); head(); }
    const pa = G.plotAge(p, m.date);
    // e.g. "120 cm (25%)" and "23 kg (2%)"
    const cellA = (key, unit) => {
      const v = G.mValue(m, key); if (v == null) return "-";
      const shown = key === "bmi" ? G.fmtNum(v) : v;
      if (pa.days < 0) return `${shown} ${unit}`;
      const id = G.refForKey(family, key, pa.months); if (!id) return `${shown} ${unit}`;
      const ref = G.getRef(id); refsUsed.add(ref.shortTitle);
      return G.withPct(shown, unit, G.assessKey(id, key, p.sex, pa.months, m));
    };
    doc.setFontSize(9);
    const ageT = G.ageLabel(p, m.date);
    const row = [G.fmtDate(m.date), ageT, cellA("height", "cm"), cellA("weight", "kg")].concat(hasB ? [cellA("bmi", "kg/m²")] : [], hasH ? [cellA("hc", "cm")] : []);
    let hMax = 1;
    row.forEach((t, i) => { const ls = doc.splitTextToSize(String(t), (cols[i + 1] || W - M) - cols[i] - 3); ls.forEach((l, j) => doc.text(l, cols[i], y + j * 10)); hMax = Math.max(hMax, ls.length); });
    y += 3 + 10 * hMax;
    if (p.condition) {
      const cps = ["height", "weight", "bmi", "hc"].map((k) => { const id = pa.days >= 0 && G.condRefFor(p.condition, k, pa.months); const a = id && G.assessKey(id, k, p.sex, pa.months, m); return a ? `${G.MEASURES[k]} ${G.pctTxt(a)}%` : ""; }).filter(Boolean);
      if (cps.length) { doc.setFontSize(8); doc.setTextColor(60); doc.text(`${G.CONDITIONS[p.condition]} chart: ${cps.join(", ")}`, cols[1], y); y += 10; doc.setTextColor(0); }
    }
    const extra = [...C.visitDetails(p, m), ...C.SOAP.filter(([k]) => m[k]).map(([k, l]) => `${l}: ${m[k]}`), m.notes ? "Note: " + m.notes : ""].filter(Boolean);
    if (extra.length) { doc.setFontSize(8); doc.setTextColor(70); for (const e of extra) for (const l of doc.splitTextToSize(e, W - 2 * M - (cols[1] - M))) { if (y + 12 > H - 40) newPage(); doc.text(l, cols[1], y); y += 10; } doc.setTextColor(0); }
    doc.setDrawColor(230); doc.line(M, y - 7, W - M, y - 7);
  }
  if (!ms.length) { doc.text("No measurements recorded.", M, y); y += 14; }
  y += 8; doc.setFontSize(8); doc.setTextColor(80);
  for (const l of doc.splitTextToSize(`Percentiles (in brackets) calculated with the LMS method using ${G.FAMILIES[family]}; references used: ${[...refsUsed].join(", ") || "-"}. Age is exact chronological age (days / 30.4375 months)${ms.some((m) => G.plotAge(p, m.date).corrected) ? "; for preterm infants percentiles use the age corrected for prematurity until 24 months" : ""}. BMI percentiles above the 95th use the CDC 2022 extended BMI method. For clinical decision support only.`, W - 2 * M)) { ensure(10); doc.text(l, M, y); y += 10; }
  doc.setTextColor(0);

  const simpleTable = (title, heads, rows, widths, note) => {
    if (!rows.length) return;
    y += 10; h2(title);
    const xs = widths.reduce((a, w) => (a.push(a[a.length - 1] + w), a), [M]);
    const th = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); heads.forEach((t, i) => doc.text(t, xs[i], y)); y += 5; doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 11; doc.setFont("helvetica", "normal"); };
    th();
    for (const r of rows) { if (y + 14 > H - 40) { newPage(); th(); } doc.setFontSize(8.5); r.forEach((t, i) => doc.text(doc.splitTextToSize(String(t), (xs[i + 1] || W - M) - xs[i] - 4)[0] || "", xs[i], y)); y += 12; }
    if (note) { y += 2; para(note, 7.5, 90); }
  };
  simpleTable("Height velocity", ["From", "To", "Interval", "Velocity", "Same-percentile velocity", "Flag"],
    C.heightVelocity(p, ms, family).map((r) => [G.fmtDate(r.from), G.fmtDate(r.to), `${G.fmtNum(r.dt, 2)} y`, `${G.fmtNum(r.hv)} cm/y`, r.expected != null ? `${G.fmtNum(r.expected)} cm/y` : "-", r.low ? `Low (< ${r.thr})` : ""]),
    [70, 70, 60, 70, 130, 110], C.HV_NOTE);
  simpleTable("Bone age", ["Date", "Chronological age", "Bone age", "BA - CA", "Projected adult height"],
    ms.filter((m) => m.boneAge != null).map((m) => { const ca = G.exactAge(p.dob, m.date).yearsDec, pr = C.projectedAdultHeight(p, m); return [G.fmtDate(m.date), `${G.fmtNum(ca)} y`, `${m.boneAge} y ${m.boneAgeMethod || ""}`, `${m.boneAge - ca >= 0 ? "+" : ""}${G.fmtNum(m.boneAge - ca)} y`, pr ? `approx. ${G.fmtNum(pr.cm)} cm` : "-"]; }),
    [80, 100, 110, 80, 145], C.PAH_NOTE);
  const dv = C.milestoneSummary(p), st = p.milestones || {};
  if (dv.yes || dv.missed || dv.lost || p.devNotes) {
    y += 10; h2("Development");
    para(`${dv.yes} milestones achieved; ${dv.missed} not yet achieved at or after the expected age; ${dv.lost} lost.`);
    const lst = (s, label) => Object.entries(st).filter(([, v]) => v.s === s).map(([k]) => { const [b, i] = k.split(":").map(Number); return `${C.ageBandLabel(b)}: ${(C.MILESTONES[b]?.[i] || "").slice(2)}`; });
    const lost = lst("lost"), no = lst("no");
    if (lost.length) para("Lost: " + lost.join("; "), 8.5);
    if (no.length) para("Not yet: " + no.join("; "), 8.5);
    if (p.devNotes) para("Notes: " + p.devNotes, 8.5);
    para(C.MILESTONE_SOURCE, 7.5, 90);
  }
  const od = new Set(C.overdueVaccines(p));
  simpleTable("Vaccinations", ["Vaccine", "Dose", "Given", "Next due", "Notes"],
    [...(p.vaccines || [])].sort((a, b) => (a.date || a.due || "").localeCompare(b.date || b.due || "")).map((v) => [v.name, v.dose || "", v.date ? G.fmtDate(v.date) : "-", v.due ? G.fmtDate(v.due) + (od.has(v) ? " OVERDUE" : "") : "-", v.notes || ""]),
    [150, 60, 80, 110, 115]);

  // investigations (numbers)
  if (invs.length) {
    y += 10; h2("Investigations");
    const ic = [M, M + 62, M + 150, M + 300, M + 400];
    const ihead = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); ["Date", "Section", "Test", "Result", "Reference"].forEach((t, i) => doc.text(t, ic[i], y)); y += 5; doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 12; doc.setFont("helvetica", "normal"); };
    ihead();
    for (const x of [...invs].sort((a, b) => a.date.localeCompare(b.date))) {
      const rows = (x.results || []).length ? x.results : [{ test: (x.photos || []).length ? `(${x.photos.length} photo${x.photos.length > 1 ? "s" : ""})` : "", value: "", unit: "", ref: "" }];
      rows.forEach((r, i) => {
        if (y + 16 > H - 40) { newPage(); ihead(); }
        doc.setFontSize(9);
        [i ? "" : G.fmtDate(x.date), i ? "" : x.category, r.test || "", `${r.value || ""} ${r.unit || ""}`.trim() + (C.labFlag(r) ? ` (${C.labFlag(r)})` : ""), r.ref || ""]
          .forEach((t, j) => doc.text(doc.splitTextToSize(String(t), (ic[j + 1] || W - M) - ic[j] - 4)[0] || "", ic[j], y));
        y += 12;
      });
      if (x.notes) { doc.setFontSize(8); doc.setTextColor(80); for (const l of doc.splitTextToSize("Note: " + x.notes, W - 2 * M - 62)) { if (y + 12 > H - 40) newPage(); doc.text(l, ic[1], y); y += 10; } doc.setTextColor(0); }
      doc.setDrawColor(230); doc.line(M, y - 8, W - M, y - 8);
    }
  }

  // charts: every chart that holds this child's measurements (the chart for the current age if none)
  const hw = ms.filter((m) => m.height != null || m.weight != null);
  const views = [...new Set(hw.map((m) => viewForAge(family, Math.max(0, G.plotAge(p, m.date).months))))];
  if (!views.length) views.push(viewForAge(family, Math.max(0, G.plotAge(p, today).months)));
  await loadSheets();
  for (const view of views) {
    if (view.startsWith("sheet:")) {
      // Original CDC Set 2 page (US Letter), unmodified, with the patient's data written on it.
      const sheet = sheetFor(view.slice(6), p.sex), img = await sheetImage(sheet);
      const cvs = document.createElement("canvas"), SC = 3.2; cvs.width = Math.round(612 * SC); cvs.height = Math.round(792 * SC);
      drawSheet(cvs.getContext("2d"), cvs.width, cvs.height, sheet, img, { x0: 0, y0: 0, x1: 612, y1: 792 }, { p, ...sheetPoints(sheet, p, ms), connect, sel: null, showMph: true, showPct: true });
      footer(); doc.addPage([612, 792], "p"); page++; onSheet = true;
      doc.addImage(cvs.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 612, 792);
      continue;
    }
    await chartPages(view, ["height", "weight"]);
  }
  // additional computed charts: BMI, head circumference, weight-for-length, condition-specific charts
  const extraViews = [];
  for (const m of ms) {
    const age = G.plotAge(p, m.date).months; if (age < 0) continue;
    for (const key of ["bmi", "hc", "wfl"]) { const id = G.mValue(m, key) != null && G.refForKey(family, key, age); if (id) extraViews.push(id + "|" + key); }
    if (p.condition) for (const key of ["height", "weight", "hc", "bmi"]) { const id = G.mValue(m, key) != null && G.condRefFor(p.condition, key, age); if (id) extraViews.push(id + "|" + key); }
  }
  for (const vk of [...new Set(extraViews)]) { const [id, key] = vk.split("|"); await chartPages(id, [key]); }

  async function chartPages(view, keys) {
    const cv = document.createElement("canvas"); const S = 2.2; cv.width = Math.round(802 * S); cv.height = Math.round(551 * S);
    for (const key of keys) {
      const d = buildChart(p, ms, view, key, connect, null); d.showMph = true; d.showPct = true;
      if (!d.points.length && keys.length === 1) continue;
      footer(); doc.addPage("a4", "l"); page++; onSheet = false;
      drawChart(cv.getContext("2d"), cv.width, cv.height, d, fullBounds(d.m, d.sex, d.points.map((q) => q.v)), S);
      doc.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", 20, 16, 802, 551);
      doc.setFontSize(6.5); doc.setTextColor(80);
      doc.text(doc.splitTextToSize(`Red × = measurement (circled = latest), plotted at exact ${d.m.xKind === "length" ? "length/height" : d.corrected ? "age (corrected for prematurity < 24 months)" : "chronological age"}${d.boneAge?.length ? "; blue circle BA = bone age" : ""}. Source: ${d.ref.source}`, 800), 20, 578);
      doc.setTextColor(0);
    }
  }
  // photos of investigation reports, one per page
  if (getFile) for (const x of [...invs].sort((a, b) => a.date.localeCompare(b.date))) for (const f of x.photos || []) {
    const bytes = await getFile(f.id); if (!bytes) continue;
    const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(new Blob([bytes], { type: "image/jpeg" })); });
    footer(); doc.addPage("a4", "p"); page++; onSheet = false;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...teal);
    doc.text(`${x.category} · ${G.fmtDate(x.date)} · ${p.name} (File ${p.fileNumber})`, M, M + 4); doc.setTextColor(0); doc.setFont("helvetica", "normal");
    const maxW = W - 2 * M, maxH = H - 2 * M - 40, iw = f.w || 1000, ih = f.h || 1000, k = Math.min(maxW / iw, maxH / ih);
    doc.addImage(url, "JPEG", M + (maxW - iw * k) / 2, M + 16, iw * k, ih * k);
  }
  footer();
  return doc.output("blob");
}

/** Letter (referral / clinic summary) as a simple A4 PDF. */
export async function buildLetter({ title, date, body, clinician = {} }) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const MAP = { "≈": "approx.", "≤": "<=", "≥": ">=", "→": "->", "–": "-", "—": "-", "−": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "•": "-" };
  const safe = (t) => String(t).replace(/[≈≤≥→–—−‘’“”•]/g, (c) => MAP[c]).replace(/[^\u0000-\u00ff€×µ²³¹]/g, "?");
  const W = 595, H = 842, M = 56; let y = M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(11, 85, 99);
  if (clinician.clinic) { doc.text(safe(clinician.clinic), M, y); y += 15; }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(80);
  for (const t of [clinician.name && `${clinician.name}${clinician.title ? ", " + clinician.title : ""}`, clinician.contact].filter(Boolean)) { doc.text(safe(t), M, y); y += 12; }
  doc.setTextColor(0); y += 8; doc.setDrawColor(11, 85, 99); doc.line(M, y, W - M, y); y += 22;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(safe(title), M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(G.fmtDate(date), W - M, y, { align: "right" }); y += 24;
  doc.setFontSize(10.5);
  for (const para of String(body).split("\n")) {
    const lines = para.trim() ? doc.splitTextToSize(safe(para), W - 2 * M) : [""];
    for (const l of lines) { if (y > H - M) { doc.addPage(); y = M; } doc.text(l, M, y); y += 14; }
  }
  return doc.output("blob");
}
