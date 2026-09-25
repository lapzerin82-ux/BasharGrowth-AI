// Printable patient report built with jsPDF (vendor/jspdf.umd.min.js, loaded on demand).
import * as G from "./growth.js";
import { drawChart, fullBounds, buildChart } from "./chart.js";
import { loadSheets, sheetFor, sheetImage, sheetPoints, drawSheet, viewForAge } from "./sheet.js";

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
  const W = 595, H = 842, M = 40;
  const teal = [11, 85, 99];
  let y = M + 10, page = 1;
  let onSheet = false; // original CDC pages are left exactly as printed (no footer)
  const footer = () => { if (onSheet) return; doc.setFontSize(7.5); doc.setTextColor(90); doc.text(`Generated ${new Date().toLocaleString()} by ${clinician} · Pediatric Growth Chart · page ${page}`, M, doc.internal.pageSize.getHeight() - 20); doc.setTextColor(0); };
  const newPage = (orientation = "p") => { footer(); doc.addPage("a4", orientation); page++; y = M + 10; };
  const ensure = (need) => { if (y + need > H - 40) newPage(); };
  const h2 = (t) => { ensure(30); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(...teal); doc.text(t, M, y); doc.setTextColor(0); y += 16; };

  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...teal); doc.text("Pediatric Growth Report", M, y); y += 26;
  h2("Patient information");
  const today = G.todayIso();
  const tgt = G.mphTarget(p.sex, p.mph);
  const mphTxt = p.mph ? `${G.fmtNum(p.mph)} cm = ${G.fmtAssess({ p: tgt.pct })} at 20 y (target range ${G.fmtNum(p.mph - 8.5)}–${G.fmtNum(p.mph + 8.5)} cm)${p.mphManual ? ", entered manually" : ""}` : "-";
  const info = [["Name", p.name], ["Sex", p.sex === "F" ? "Female" : "Male"], ["File number", p.fileNumber], ["Date of birth", G.fmtDate(p.dob)],
    ["Current age", `${G.exactAge(p.dob, today).text} (on ${G.fmtDate(today)})`], ["Father's height", p.father ? p.father + " cm" : "-"],
    ["Mother's height", p.mother ? p.mother + " cm" : "-"], ["Mid-parental height", mphTxt]];
  doc.setFontSize(10);
  for (const [k, v] of info) { doc.setFont("helvetica", "bold"); doc.text(k, M, y); doc.setFont("helvetica", "normal"); doc.text(String(v), M + 120, y); y += 14; }
  y += 6; h2("Clinical notes");
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  for (const line of doc.splitTextToSize(p.notes || "-", W - 2 * M)) { ensure(14); doc.text(line, M, y); y += 13; }
  y += 8; h2("Growth measurements");
  const cols = [M, M + 68, M + 160, M + 222, M + 345, M + 400];
  const head = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); ["Date", "Age", "Height (cm)", "Height percentile", "Weight (kg)", "Weight percentile"].forEach((t, i) => doc.text(t, cols[i], y)); y += 5; doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 12; doc.setFont("helvetica", "normal"); };
  head();
  const refsUsed = new Set();
  for (const m of ms) {
    if (y + 26 > H - 40) { newPage(); head(); }
    const age = G.exactAge(p.dob, m.date).months;
    const cellA = (key, v) => {
      if (v == null || age < 0) return "-";
      const ref = G.getRef(G.defaultRefFor(family, age)); refsUsed.add(ref.shortTitle);
      return G.fmtAssess(G.assess(ref.measures[key], p.sex, age, v));
    };
    [G.fmtDate(m.date), G.exactAge(p.dob, m.date).text, m.height ?? "-", cellA("height", m.height), m.weight ?? "-", cellA("weight", m.weight)]
      .forEach((t, i) => doc.text(String(t), cols[i], y));
    y += 13;
    if (m.notes) { doc.setFontSize(8); doc.setTextColor(80); for (const l of doc.splitTextToSize("Note: " + m.notes, W - 2 * M - 70)) { doc.text(l, cols[1], y); y += 10; } doc.setTextColor(0); doc.setFontSize(9.5); }
    doc.setDrawColor(230); doc.line(M, y - 9, W - M, y - 9);
  }
  if (!ms.length) { doc.text("No measurements recorded.", M, y); y += 14; }
  y += 8; doc.setFontSize(8); doc.setTextColor(80);
  for (const l of doc.splitTextToSize(`Percentiles calculated with the LMS method using ${G.FAMILIES[family]}; references used: ${[...refsUsed].join(", ") || "-"}. Age is exact chronological age (days / 30.4375 months). For clinical decision support only.`, W - 2 * M)) { ensure(10); doc.text(l, M, y); y += 10; }
  doc.setTextColor(0);

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
        [i ? "" : G.fmtDate(x.date), i ? "" : x.category, r.test || "", `${r.value || ""} ${r.unit || ""}`.trim(), r.ref || ""]
          .forEach((t, j) => doc.text(doc.splitTextToSize(String(t), (ic[j + 1] || W - M) - ic[j] - 4)[0] || "", ic[j], y));
        y += 12;
      });
      if (x.notes) { doc.setFontSize(8); doc.setTextColor(80); for (const l of doc.splitTextToSize("Note: " + x.notes, W - 2 * M - 62)) { if (y + 12 > H - 40) newPage(); doc.text(l, ic[1], y); y += 10; } doc.setTextColor(0); }
      doc.setDrawColor(230); doc.line(M, y - 8, W - M, y - 8);
    }
  }

  // charts: every chart that holds this child's measurements (the chart for the current age if none)
  const views = [...new Set(ms.map((m) => viewForAge(family, G.exactAge(p.dob, m.date).months)))];
  if (!views.length) views.push(viewForAge(family, G.exactAge(p.dob, today).months));
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
    const cv = document.createElement("canvas"); const S = 2.2; cv.width = Math.round(802 * S); cv.height = Math.round(551 * S);
    for (const key of ["height", "weight"]) {
      const d = buildChart(p, ms, view, key, connect, null); d.showMph = true; d.showPct = true;
      footer(); doc.addPage("a4", "l"); page++; onSheet = false;
      drawChart(cv.getContext("2d"), cv.width, cv.height, d, fullBounds(d.m, d.sex, d.points.map((q) => q.v)), S);
      doc.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", 20, 16, 802, 551);
      doc.setFontSize(6.5); doc.setTextColor(80);
      doc.text(doc.splitTextToSize(`Red × = measurement (circled = latest), plotted at exact chronological age. Source: ${d.ref.source}`, 800), 20, 578);
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
