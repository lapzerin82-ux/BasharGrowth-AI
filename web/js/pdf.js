// Printable patient report built with jsPDF (vendor/jspdf.umd.min.js, loaded on demand).
import * as G from "./growth.js";
import { drawChart, fullBounds, buildChart } from "./chart.js";

function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  return new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "vendor/jspdf.umd.min.js";
    s.onload = () => res(window.jspdf); s.onerror = () => rej(new Error("PDF library failed to load"));
    document.head.append(s);
  });
}

export async function buildPdf(p, ms, family, connect, clinician) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = 595, H = 842, M = 40;
  const teal = [11, 85, 99];
  let y = M + 10, page = 1;
  const footer = () => { doc.setFontSize(7.5); doc.setTextColor(90); doc.text(`Generated ${new Date().toLocaleString()} by ${clinician} · Pediatric Growth Chart · page ${page}`, M, doc.internal.pageSize.getHeight() - 20); doc.setTextColor(0); };
  const newPage = (orientation = "p") => { footer(); doc.addPage("a4", orientation); page++; y = M + 10; };
  const ensure = (need) => { if (y + need > H - 40) newPage(); };
  const h2 = (t) => { ensure(30); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(...teal); doc.text(t, M, y); doc.setTextColor(0); y += 16; };

  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...teal); doc.text("Pediatric Growth Report", M, y); y += 26;
  h2("Patient information");
  const today = G.todayIso();
  const mphTxt = p.mph ? `${G.fmtNum(p.mph)} cm (target range ${G.fmtNum(p.mph - 8.5)}–${G.fmtNum(p.mph + 8.5)} cm)${p.mphManual ? ", entered manually" : ""}` : "-";
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

  // charts: one landscape page per chart of the family that contains measurements
  const ids = family === "AUTO" ? ["who2006_0_2", "cdc2000_child"] : family === "WHO" ? ["who2006", "who2007"] : ["cdc2000_infant", "cdc2000_child"];
  const latest = ms[ms.length - 1];
  const defId = G.defaultRefFor(family, G.exactAge(p.dob, latest ? latest.date : today).months);
  const cv = document.createElement("canvas"); const S = 2.2; cv.width = Math.round(802 * S); cv.height = Math.round(551 * S);
  for (const key of ["height", "weight"]) {
    const charts = ids.map((id) => [id, buildChart(p, ms, id, key, connect, null)]);
    let draw = charts.filter(([, d]) => d.points.length); if (!draw.length) draw = charts.filter(([id]) => id === defId);
    for (const [, d] of draw) {
      footer(); doc.addPage("a4", "l"); page++;
      drawChart(cv.getContext("2d"), cv.width, cv.height, d, fullBounds(d.m, d.sex, d.points.map((q) => q.v)), S);
      doc.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", 20, 16, 802, 551);
      doc.setFontSize(6.5); doc.setTextColor(80);
      doc.text(doc.splitTextToSize(`Red × = measurement (circled = latest), plotted at exact chronological age. Source: ${d.ref.source}`, 800), 20, 578);
      doc.setTextColor(0);
    }
  }
  footer();
  return doc.output("blob");
}
