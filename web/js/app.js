import * as G from "./growth.js";
import * as S from "./store.js";
import { drawChart, fullBounds, zoomVp, clampVp, buildChart } from "./chart.js";
import { Sync, newSyncCode } from "./sync.js";
import { loadSheets, sheetMeta, sheetFor, sheetImage, sheetPoints, drawSheet, px, py, viewForAge as sheetViewForAge } from "./sheet.js";

const $app = document.getElementById("app");
let session = null;
let sync = null;
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (location.hash === "#home" || !location.hash) route(); });

// ------------------------------------------------------------ helpers
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (s) => { const v = parseFloat(String(s ?? "").trim().replace(",", ".")); return Number.isFinite(v) ? v : null; };
const go = (h) => { location.hash = h; };
const settings = {
  get family() { try { const f = localStorage.getItem("pgc.family"); return f && G.FAMILIES[f] ? f : "CDC"; } catch { return "CDC"; } },
  set family(v) { try { localStorage.setItem("pgc.family", v); } catch {} },
  get connect() { try { return localStorage.getItem("pgc.connect") !== "0"; } catch { return true; } },
  set connect(v) { try { localStorage.setItem("pgc.connect", v ? "1" : "0"); } catch {} },
  get showMph() { try { return localStorage.getItem("pgc.mph") !== "0"; } catch { return true; } },
  set showMph(v) { try { localStorage.setItem("pgc.mph", v ? "1" : "0"); } catch {} },
  get showPct() { try { return localStorage.getItem("pgc.pct") !== "0"; } catch { return true; } },
  set showPct(v) { try { localStorage.setItem("pgc.pct", v ? "1" : "0"); } catch {} },
};
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}
function bar(title, back, actions = "") {
  return `<header class="bar">${back ? `<button class="icon" data-back aria-label="Back">←</button>` : ""}<h1>${esc(title)}</h1><div class="acts">${actions}</div></header>`;
}
function bindBack() { $app.querySelector("[data-back]")?.addEventListener("click", () => history.length > 1 ? history.back() : go("#home")); }
function rangeErr(txt, lo, hi, unit) {
  if (!String(txt).trim()) return null; const v = num(txt);
  if (v == null) return "Not a number"; return v < lo || v > hi ? `Expected ${lo}–${hi} ${unit}` : null;
}
function assessFor(p, m, key) {
  const v = key === "height" ? m.height : m.weight; if (v == null) return null;
  const age = G.exactAge(p.dob, m.date).months; if (age < 0) return null;
  const ref = G.getRef(G.defaultRefFor(settings.family, age));
  return G.assess(ref.measures[key], p.sex, age, v);
}
async function saveOrShare(blob, name, share) {
  const file = new File([blob], name, { type: blob.type });
  if (share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  if (share) toast("Sharing is not available here — the file was downloaded instead.");
}

// ------------------------------------------------------------ router
async function route() {
  const h = location.hash.slice(1) || "home";
  const [view, a, b] = h.split("/");
  window.scrollTo(0, 0);
  if (!session) return viewUnlock();
  switch (view) {
    case "login": return go("#home");
    case "home": return viewHome();
    case "list": return viewList(a || "browse");
    case "new": return viewPatientForm(null);
    case "edit": return viewPatientForm(a);
    case "p": return viewPatient(a);
    case "m": return viewMeasure(a, b || null);
    case "inv": return viewInvestigation(a, b || null);
    case "chart": return viewChart(a, b || "height");
    case "backup": return viewBackup(a === "restore");
    case "settings": return viewSettings();
    default: return viewHome();
  }
}
window.addEventListener("hashchange", route);

// ------------------------------------------------------------ login
let unlockLocked = [];
/** Shown only when records from an earlier version (which had sign-in) exist and are not yet opened. */
function viewUnlock() {
  $app.innerHTML = `
  <main class="login">
    <svg viewBox="0 0 24 24" class="logo" aria-hidden="true"><path d="M3.5 18.5l6-6 4 4L22 6.9l-1.4-1.4-7.1 8-4-4L2 17z"/></svg>
    <h1 class="brand">Pediatric Growth Chart</h1>
    <p class="sub">Open your existing records (one time only)</p>
    <form id="f" class="stack narrow">
      <p class="hint">This app no longer asks for a sign-in. Records saved with the earlier version are protected by the password you used then. Enter it once; afterwards the app opens directly.</p>
      <label>Email used before<select id="email">${unlockLocked.map((e) => `<option>${esc(e)}</option>`).join("")}</select></label>
      <label>Password<input id="pw" type="password" autocomplete="current-password" required></label>
      <p class="err" id="err" hidden></p>
      <button class="primary" id="go">Open records</button>
      <button type="button" class="ghost" id="fresh">Start without the old records</button>
    </form>
  </main>`;
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById("err"), btn = document.getElementById("go");
    err.hidden = true; btn.disabled = true;
    try { session = await S.signIn(document.getElementById("email").value, document.getElementById("pw").value); navigator.storage?.persist?.(); await initSync(); location.hash = "#home"; route(); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  };
  document.getElementById("fresh").onclick = () => confirmBox("Start without the old records?", "The old records stay stored (still locked) on this device; you can restore a backup at any time.", "Start", async () => {
    session = await S.createDeviceWorkspace(); await initSync(); location.hash = "#home"; route();
  });
}

// ------------------------------------------------------------ home
const ICONS = {
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z",
  search: "M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.2-1.6l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z",
  list: "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z",
  edit: "M3 17.3V21h3.8L17.8 9.9l-3.7-3.7L3 17.3zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7L20.7 7z",
  chart: "M3.5 18.5l6-6 4 4L22 6.9l-1.4-1.4-7.1 8-4-4L2 17z",
  pdf: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  lock: "M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z",
  restore: "M17.65 6.35A8 8 0 1 0 19.73 14h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  gear: "M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5-2.1-1.6zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
  out: "M10.1 15.6 11.5 17l5-5-5-5-1.4 1.4 2.6 2.6H3v2h9.7l-2.6 2.6zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z",
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>`;

function patientRow(p) {
  return `<a class="prow" href="#p/${p.id}"><span><b>${esc(p.name)}</b><small>File ${esc(p.fileNumber)} · ${p.sex === "F" ? "Female" : "Male"} · DOB ${G.fmtDate(p.dob)}</small></span><em>${G.exactAge(p.dob, G.todayIso()).short}</em></a>`;
}

function viewHome() {
  const n = session.patients.size;
  const tiles = [
    ["New Patient", "add", "#new"], ["Search Patient", "search", "#list/search"], ["Patient List", "list", "#list/browse"],
    ["Add Measurement", "edit", "#list/measure"], ["Growth Charts", "chart", "#list/chart"], ["Export PDF", "pdf", "#list/pdf"],
    ["Backup", "lock", "#backup"], ["Restore", "restore", "#backup/restore"], ["Settings", "gear", "#settings"],
  ];
  const recent = session.recent(6);
  $app.innerHTML = bar("Pediatric Growth Chart", false) + `
  <main class="page">
    <div class="who"><b>${n} patient${n === 1 ? "" : "s"}</b><small id="syncline">${syncText()}</small></div>
    ${installEvt ? `<button class="install" id="inst">Install app on this device</button>` : ""}
    <nav class="tiles">
      ${tiles.map(([t, i, h]) => `<a class="tile" href="${h}">${icon(i)}<span>${t}</span></a>`).join("")}

    </nav>
    ${recent.length ? `<h2>Recently updated</h2><div class="plist">${recent.map(patientRow).join("")}</div>` : ""}
  </main>`;
  document.getElementById("inst")?.addEventListener("click", async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; route(); });
}

function confirmBox(title, text, okText, onOk, danger) {
  const d = document.createElement("dialog");
  d.innerHTML = `<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row end"><button class="ghost" value="c">Cancel</button><button class="${danger ? "danger" : "primary"}" value="ok">${esc(okText)}</button></div>`;
  document.body.append(d); d.showModal();
  d.querySelectorAll("button").forEach((b) => b.onclick = () => { d.close(); d.remove(); if (b.value === "ok") onOk(); });
}

// ------------------------------------------------------------ list / search
function viewList(mode) {
  const titles = { browse: "Patient List", search: "Search Patient", measure: "Add Measurement: choose patient", chart: "Growth Charts: choose patient", pdf: "Export PDF: choose patient" };
  $app.innerHTML = bar(titles[mode] || "Patients", true) + `
  <main class="page">
    <input id="q" type="search" placeholder="Search by name or file number" autocomplete="off" aria-label="Search">
    <div class="plist" id="res"></div>
    <a class="fab" href="#new">+ New patient</a>
  </main>`;
  bindBack();
  const q = document.getElementById("q"), res = document.getElementById("res");
  const target = (id) => ({ measure: `#m/${id}`, chart: `#chart/${id}/height`, pdf: `#p/${id}` }[mode] || `#p/${id}`);
  const render = () => {
    const list = session.patientList(q.value);
    res.innerHTML = list.length ? list.map((p) => patientRow(p).replace(`href="#p/${p.id}"`, `href="${target(p.id)}"${mode === "pdf" ? ` data-pdf="${p.id}"` : ""}`)).join("")
      : `<p class="muted">${q.value ? `No patient matches “${esc(q.value)}”.` : "No patients yet. Tap “New patient” to register the first one."}</p>`;
    if (mode === "pdf") res.querySelectorAll("[data-pdf]").forEach((a) => a.onclick = () => { sessionStorage.setItem("pgc.autopdf", a.dataset.pdf); });
  };
  q.oninput = render; render();
  if (mode !== "browse") q.focus();
}

// ------------------------------------------------------------ patient form
function viewPatientForm(id) {
  const p = id ? session.patients.get(id) : null;
  if (id && !p) return go("#home");
  const isNew = !p;
  $app.innerHTML = bar(isNew ? "New Patient" : "Edit Patient", true) + `
  <main class="page">
  <form id="f" class="stack" novalidate>
    <section class="card stack"><h2>Patient</h2>
      <label>Patient name<input id="name" required value="${esc(p?.name)}"><small class="e" data-for="name"></small></label>
      <fieldset class="seg" id="sex"><legend>Sex</legend>
        <label><input type="radio" name="sex" value="M" ${p?.sex === "M" ? "checked" : ""}><span>Male</span></label>
        <label><input type="radio" name="sex" value="F" ${p?.sex === "F" ? "checked" : ""}><span>Female</span></label>
      </fieldset><small class="e" data-for="sex"></small>
      <label>File / medical record number<input id="file" required value="${esc(p?.fileNumber)}"><small class="e" data-for="file"></small></label>
      <div id="dup"></div>
      <label>Date of birth<input id="dob" type="date" required max="${G.todayIso()}" value="${esc(p?.dob)}"><small class="e" data-for="dob"></small></label>
      <p class="hint" id="agenow"></p>
    </section>
    ${isNew ? `<section class="card stack"><h2>First measurement</h2>
      <label>Measurement date<input id="mdate" type="date" max="${G.todayIso()}" value="${G.todayIso()}"><small class="e" data-for="mdate"></small></label>
      <p class="hi" id="mage"></p>
      <div class="two"><label>Height / length (cm)<input id="h" inputmode="decimal"><small class="e" data-for="h"></small></label>
      <label>Weight (kg)<input id="w" inputmode="decimal"><small class="e" data-for="w"></small></label></div>
      <p class="hint">Leave both empty to register the patient without a measurement.</p>
    </section>` : ""}
    <section class="card stack"><h2>Mid-parental height</h2>
      <div class="two"><label>Father's height (cm)<input id="fa" inputmode="decimal" value="${esc(p?.father ?? "")}"><small class="e" data-for="fa"></small></label>
      <label>Mother's height (cm)<input id="mo" inputmode="decimal" value="${esc(p?.mother ?? "")}"><small class="e" data-for="mo"></small></label></div>
      <label class="switch"><input type="checkbox" id="man" ${p?.mphManual ? "checked" : ""}> Enter MPH manually</label>
      <label id="manwrap" hidden>Mid-parental height (cm)<input id="mph" inputmode="decimal" value="${p?.mphManual ? esc(p?.mph ?? "") : ""}"><small class="e" data-for="mph"></small></label>
      <p class="hi" id="mphout"></p>
      <p class="hint">Boys (father + mother + 13) / 2 · Girls (father + mother − 13) / 2 · target range ± 8.5 cm.</p>
    </section>
    <section class="card stack"><h2>Notes</h2><textarea id="notes" rows="3" aria-label="Clinical notes">${esc(p?.notes)}</textarea></section>
    <p class="err" id="err" hidden>Please correct the highlighted fields.</p>
    <button class="primary">${isNew ? "Save patient" : "Save changes"}</button>
  </form></main>`;
  bindBack();
  const $ = (i) => document.getElementById(i);
  const sexVal = () => $app.querySelector('input[name="sex"]:checked')?.value || null;
  const calcMph = () => {
    const s = sexVal(), f = num($("fa").value), m = num($("mo").value);
    if ($("man").checked) return num($("mph").value);
    return s && f && m && !rangeErr($("fa").value, 120, 230, "cm") && !rangeErr($("mo").value, 110, 220, "cm") ? G.mph(s, f, m) : null;
  };
  const update = () => {
    const dob = $("dob").value;
    $("agenow").textContent = dob && dob <= G.todayIso() ? "Age today: " + G.exactAge(dob, G.todayIso()).text : "";
    if (isNew) {
      const d = $("mdate").value;
      $("mage").textContent = dob && d && d >= dob ? `Exact age at measurement: ${G.exactAge(dob, d).text} (${G.exactAge(dob, d).yearsDec.toFixed(3)} years)` : "";
    }
    $("manwrap").hidden = !$("man").checked;
    const v = calcMph();
    $("mphout").textContent = v ? `MPH ${G.fmtNum(v)} cm · target range ${G.fmtNum(v - 8.5)}–${G.fmtNum(v + 8.5)} cm` : "";
    const dup = session.byFileNumber($("file").value);
    $("dup").innerHTML = dup && dup.id !== id ? `<div class="note">File ${esc(dup.fileNumber)} already belongs to <b>${esc(dup.name)}</b> (DOB ${G.fmtDate(dup.dob)}). <a href="#p/${dup.id}">Open this patient</a></div>` : "";
  };
  $app.querySelector("form").addEventListener("input", update); update();

  $("f").onsubmit = async (e) => {
    e.preventDefault();
    const errs = {}, today = G.todayIso(), dob = $("dob").value;
    if (!$("name").value.trim()) errs.name = "Required";
    if (!sexVal()) errs.sex = "Select sex";
    if (!$("file").value.trim()) errs.file = "Required";
    if (!dob) errs.dob = "Required"; else if (dob > today) errs.dob = "In the future";
    for (const [k, lo, hi] of [["fa", 120, 230], ["mo", 110, 220]]) { const r = rangeErr($(k).value, lo, hi, "cm"); if (r) errs[k] = r; }
    if ($("man").checked) { const r = $("mph").value.trim() ? rangeErr($("mph").value, 130, 210, "cm") : "Enter MPH or switch off manual entry"; if (r) errs.mph = r; }
    let hasM = false;
    if (isNew) {
      hasM = !!($("h").value.trim() || $("w").value.trim());
      const rh = rangeErr($("h").value, 30, 230, "cm"), rw = rangeErr($("w").value, 0.3, 250, "kg");
      if (rh) errs.h = rh; if (rw) errs.w = rw;
      const d = $("mdate").value;
      if (hasM && (!d || d > today || (dob && d < dob))) errs.mdate = !d ? "Required" : d > today ? "In the future" : "Before date of birth";
    }
    $app.querySelectorAll(".e").forEach((el) => { el.textContent = errs[el.dataset.for] || ""; });
    $("err").hidden = !Object.keys(errs).length;
    if (Object.keys(errs).length) return;
    const pid = await session.savePatient({
      id: p?.id, name: $("name").value.trim(), sex: sexVal(), fileNumber: $("file").value.trim(), dob,
      father: num($("fa").value), mother: num($("mo").value), mph: calcMph(), mphManual: $("man").checked, notes: $("notes").value.trim(),
    });
    if (isNew && hasM) await session.saveMeasurement({ patientId: pid, date: $("mdate").value, height: num($("h").value), weight: num($("w").value), notes: "" });
    toast("Saved");
    if (isNew) location.replace(`#p/${pid}`); else history.back();
  };
}

// ------------------------------------------------------------ patient record
function viewPatient(id) {
  const p = session.patients.get(id); if (!p) return go("#home");
  const ms = session.measurementsFor(id);
  const tgt = G.mphTarget(p.sex, p.mph);
  const mphTxt = p.mph ? `${G.fmtNum(p.mph)} cm = ${G.fmtAssess({ p: tgt.pct })} at 20 y (target ${G.fmtNum(p.mph - 8.5)}–${G.fmtNum(p.mph + 8.5)} cm)${p.mphManual ? ", manual" : ""}` : "not recorded";
  const cell = (m, key) => {
    const v = key === "height" ? m.height : m.weight; if (v == null) return "–";
    return `${v} ${key === "height" ? "cm" : "kg"}<small>${G.fmtAssess(assessFor(p, m, key))}</small>`;
  };
  $app.innerHTML = bar(p.name, true, `<a class="icon" href="#edit/${id}" aria-label="Edit patient">✎</a><button class="icon" id="del" aria-label="Delete patient">🗑</button>`) + `
  <main class="page">
    <section class="card"><h2>Patient information</h2>
      <dl class="info">
        <dt>Name</dt><dd>${esc(p.name)}</dd><dt>Sex</dt><dd>${p.sex === "F" ? "Female" : "Male"}</dd>
        <dt>File number</dt><dd>${esc(p.fileNumber)}</dd><dt>Date of birth</dt><dd>${G.fmtDate(p.dob)}</dd>
        <dt>Current age</dt><dd>${G.exactAge(p.dob, G.todayIso()).text}</dd>
        ${p.father ? `<dt>Father's height</dt><dd>${p.father} cm</dd>` : ""}${p.mother ? `<dt>Mother's height</dt><dd>${p.mother} cm</dd>` : ""}
        <dt>Mid-parental height</dt><dd>${mphTxt}</dd>
        ${p.notes ? `<dt>Notes</dt><dd class="pre">${esc(p.notes)}</dd>` : ""}
      </dl>
    </section>
    <div class="btnrow">
      <a class="primary" href="#m/${id}">+ Add measurement</a>
      <a class="tonal" href="#chart/${id}/height">Height chart</a>
      <a class="tonal" href="#chart/${id}/weight">Weight chart</a>
      <a class="tonal" href="#inv/${id}">+ Investigation</a>
      <button class="ghost" id="pdf">Export PDF</button>
    </div>
    <section class="card"><h2>Measurements (${ms.length})</h2>
      ${ms.length ? `<p class="hint">Percentiles: ${G.FAMILIES[settings.family]}. Tap a row to edit.</p>
      <div class="scrollx"><table class="mt"><thead><tr><th>Date</th><th>Age</th><th>Height</th><th>Weight</th></tr></thead><tbody>
      ${[...ms].reverse().map((m) => `<tr data-m="${m.id}"><td>${G.fmtDate(m.date)}</td><td>${G.exactAge(p.dob, m.date).text}</td><td>${cell(m, "height")}</td><td>${cell(m, "weight")}</td></tr>${m.notes ? `<tr class="nt" data-m="${m.id}"><td colspan="4">${esc(m.notes)}</td></tr>` : ""}`).join("")}
      </tbody></table></div>` : `<p class="muted">No measurements yet.</p>`}
    </section>
    ${investigationsSection(p)}
  </main>`;
  bindBack();
  $app.querySelectorAll("tr[data-m]").forEach((tr) => tr.onclick = () => go(`#m/${id}/${tr.dataset.m}`));
  bindInvestigationsSection();
  document.getElementById("del").onclick = () => confirmBox(`Delete ${p.name}?`, `The patient, all ${ms.length} measurements and all investigations will be permanently deleted${sync?.enabled ? " on all synced devices" : " from this device"}. This cannot be undone.`, "Delete", async () => {
    await session.deletePatient(id); toast("Patient deleted"); go("#home");
  }, true);
  document.getElementById("pdf").onclick = () => pdfDialog(p);
  if (sessionStorage.getItem("pgc.autopdf") === id) { sessionStorage.removeItem("pgc.autopdf"); pdfDialog(p); }
}

function pdfDialog(p) {
  const d = document.createElement("dialog");
  d.innerHTML = `<h3>Export patient report (PDF)</h3><p>Patient information, notes, measurements, investigations (with photos), and the growth charts with every red × marker.</p>
  <div class="row end"><button class="ghost" value="c">Cancel</button><button class="tonal" value="share">Share / print</button><button class="primary" value="save">Download</button></div>`;
  document.body.append(d); d.showModal();
  d.querySelectorAll("button").forEach((b) => b.onclick = async () => {
    d.close(); d.remove(); if (b.value === "c") return;
    toast("Creating PDF…");
    const { buildPdf } = await import("./pdf.js");
    const blob = await buildPdf(p, session.measurementsFor(p.id), settings.family, settings.connect, session.email === "this device" ? "clinician" : session.email, session.investigationsFor(p.id), (id) => session.getFile(id));
    await saveOrShare(blob, `GrowthReport_${(p.fileNumber || p.name).replace(/[^A-Za-z0-9._-]+/g, "_")}_${G.todayIso()}.pdf`, b.value === "share");
  });
}

// ------------------------------------------------------------ measurement form
function viewMeasure(pid, mid) {
  const p = session.patients.get(pid); if (!p) return go("#home");
  const m = mid ? session.measurements.get(mid) : null;
  $app.innerHTML = bar(m ? "Edit Measurement" : "Add Measurement", true, m ? `<button class="icon" id="del" aria-label="Delete measurement">🗑</button>` : "") + `
  <main class="page"><form id="f" class="stack" novalidate>
    <section class="card"><h2>${esc(p.name)}</h2><p class="muted">File ${esc(p.fileNumber)} · ${p.sex === "F" ? "Female" : "Male"} · DOB ${G.fmtDate(p.dob)}</p></section>
    <section class="card stack"><h2>Measurement</h2>
      <label>Measurement date<input id="d" type="date" min="${p.dob}" max="${G.todayIso()}" value="${m?.date || G.todayIso()}"><small class="e" data-for="d"></small></label>
      <p class="hi" id="age"></p>
      <div class="two"><label>Height / length (cm)<input id="h" inputmode="decimal" value="${m?.height ?? ""}"><small class="e" data-for="h"></small></label>
      <label>Weight (kg)<input id="w" inputmode="decimal" value="${m?.weight ?? ""}"><small class="e" data-for="w"></small></label></div>
      <small class="e" data-for="hw"></small>
      <label>Notes (optional)<input id="n" value="${esc(m?.notes)}"></label>
      <div id="prev" class="hint"></div>
    </section>
    <button class="primary" value="save">Save measurement</button>
    <button class="ghost" type="button" id="savechart">Save and view chart</button>
  </form></main>`;
  bindBack();
  const $ = (i) => document.getElementById(i);
  const update = () => {
    const d = $("d").value;
    if (!d || d < p.dob) { $("age").textContent = ""; $("prev").textContent = ""; return; }
    const a = G.exactAge(p.dob, d);
    $("age").textContent = `Exact age: ${a.text} · ${a.days} days · ${a.yearsDec.toFixed(3)} years`;
    const ref = G.getRef(G.defaultRefFor(settings.family, a.months));
    $("prev").innerHTML = [["height", num($("h").value)], ["weight", num($("w").value)]].filter(([, v]) => v)
      .map(([k, v]) => `${ref.measures[k].label}: ${G.fmtAssess(G.assess(ref.measures[k], p.sex, a.months, v))} · ${ref.shortTitle}`).join("<br>");
  };
  $("f").addEventListener("input", update); update();
  const save = async (thenChart) => {
    const errs = {}, d = $("d").value;
    if (!d) errs.d = "Required"; else if (d < p.dob) errs.d = "Before date of birth"; else if (d > G.todayIso()) errs.d = "In the future";
    const rh = rangeErr($("h").value, 30, 230, "cm"), rw = rangeErr($("w").value, 0.3, 250, "kg");
    if (rh) errs.h = rh; if (rw) errs.w = rw;
    if (!$("h").value.trim() && !$("w").value.trim()) errs.hw = "Enter height and/or weight";
    $app.querySelectorAll(".e").forEach((el) => { el.textContent = errs[el.dataset.for] || ""; });
    if (Object.keys(errs).length) return;
    await session.saveMeasurement({ id: m?.id, patientId: pid, date: d, height: num($("h").value), weight: num($("w").value), notes: $("n").value.trim() });
    toast("Measurement saved");
    if (thenChart) location.replace(`#chart/${pid}/height`); else history.back();
  };
  $("f").onsubmit = (e) => { e.preventDefault(); save(false); };
  $("savechart").onclick = () => save(true);
  $("del")?.addEventListener("click", () => confirmBox("Delete this measurement?", `${G.fmtDate(m.date)}: this cannot be undone.`, "Delete", async () => {
    await session.deleteMeasurement(m.id); toast("Deleted"); history.back();
  }, true));
}

// ------------------------------------------------------------ chart

// Chart views: original CDC Set 2 sheets ("sheet:0_36", "sheet:2_20") or computed WHO charts (reference ids).
const VIEW_TITLES = {
  "sheet:0_36": "CDC birth–36 months (original)",
  "sheet:2_20": "CDC 2–20 years (original)",
  who2006_0_2: "WHO Birth–24 months", who2006: "WHO Birth–5 years", who2007: "WHO 5–19 years",
};
const viewForAge = (ageMonths) => sheetViewForAge(settings.family, ageMonths);

async function viewChart(pid, key) {
  const p = session.patients.get(pid); if (!p) return go("#home");
  await loadSheets();
  const ms = session.measurementsFor(pid);
  const latest = ms[ms.length - 1];
  const autoView = () => viewForAge(G.exactAge(p.dob, latest ? latest.date : G.todayIso()).months);
  let manual = null, view = autoView();
  let connect = settings.connect, sel = null, data, bounds, vp, geo, sheet, img, sgeo;
  const isSheet = () => view.startsWith("sheet:");

  $app.innerHTML = bar(`${p.name} · growth chart`, true, `<a class="icon" href="#m/${pid}" aria-label="Add measurement">＋</a>`) + `
  <main class="chartpage">
    <div class="ctl">
      <div class="seg2" role="tablist" id="tabs"><button data-k="height">Height-for-age</button><button data-k="weight">Weight-for-age</button></div>
      <div class="row wrap">
        <select id="ref" aria-label="Growth chart"><option value="auto">Auto: ${esc(VIEW_TITLES[autoView()])}</option>${Object.entries(VIEW_TITLES).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select>
        <label class="switch"><input type="checkbox" id="line" ${connect ? "checked" : ""}> Line</label>
        <label class="switch"><input type="checkbox" id="smph" ${settings.showMph ? "checked" : ""} ${p.mph ? "" : "disabled"}> MPH</label>
        <label class="switch"><input type="checkbox" id="spct" ${settings.showPct ? "checked" : ""}> Percentiles</label>
        <span class="grow"></span>
        <button class="round" id="zi" aria-label="Zoom in">+</button><button class="round" id="zo" aria-label="Zoom out">−</button><button class="round" id="zr" aria-label="Reset zoom">⟲</button>
      </div>
      <p class="warn" id="out" hidden></p>
    </div>
    <div class="cwrap"><canvas id="cv"></canvas></div>
    <div id="pop" class="pop"></div>
  </main>`;
  bindBack();
  const cv = document.getElementById("cv"), wrap = cv.parentElement;
  const dpr = () => window.devicePixelRatio || 1;
  const hint = () => `<span class="hint">Pinch or scroll to zoom · drag to pan · double-tap to reset · tap a red × for details</span>`;

  const rebuild = async (resetVp) => {
    document.getElementById("tabs").hidden = isSheet();
    document.getElementById("ref").value = manual || "auto";
    let outside, coverTxt;
    if (isSheet()) {
      sheet = sheetFor(view.slice(6), p.sex); img = await sheetImage(sheet);
      data = { p, ...sheetPoints(sheet, p, ms), connect, sel };
      bounds = { x0: 0, y0: 0, x1: sheet.page[0], y1: sheet.page[1] };
      outside = data.outside; coverTxt = sheet.ageMax <= 36 ? "birth–36 months" : "2–20 years";
    } else {
      data = buildChart(p, ms, view, key, connect, sel);
      bounds = fullBounds(data.m, p.sex, data.points.map((q) => q.v));
      outside = data.outside; coverTxt = `${G.fmtNum(data.m.ageMin / 12)}–${G.fmtNum(data.m.ageMax / 12)} y`;
    }
    if (resetVp || !vp) vp = { ...bounds };
    $app.querySelectorAll(".seg2 button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === key));
    const out = document.getElementById("out");
    out.hidden = !outside;
    const other = outside ? ms.map((x) => viewForAge(G.exactAge(p.dob, x.date).months)).find((v) => v !== view) : null;
    out.innerHTML = `${outside} measurement(s) are on another chart (this one covers ${coverTxt}).` +
      (other ? ` <button class="link" id="other">Show ${esc(VIEW_TITLES[other])}</button>` : "");
    document.getElementById("other")?.addEventListener("click", () => { manual = other; view = other; sel = null; showPop(); rebuild(true); });
    draw();
  };
  const draw = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    cv.width = Math.round(w * dpr()); cv.height = Math.round(h * dpr());
    cv.style.width = w + "px"; cv.style.height = h + "px";
    data.sel = sel; data.showMph = settings.showMph; data.showPct = settings.showPct;
    const ctx = cv.getContext("2d");
    if (isSheet()) { sgeo = drawSheet(ctx, cv.width, cv.height, sheet, img, vp, data); geo = null; }
    else { geo = drawChart(ctx, cv.width, cv.height, data, vp, dpr()); sgeo = null; }
  };
  const allPts = () => isSheet() ? data.pts : data.points;
  const showPop = () => {
    const pop = document.getElementById("pop");
    const q = data && allPts().find((x) => x.id === sel);
    if (!q) { pop.innerHTML = hint(); return; }
    const k = isSheet() ? q.key : key;
    const refId = isSheet() ? sheet.ref : view;
    const m = G.getRef(refId).measures[k];
    const label = isSheet() ? (sheet.ageMax <= 36 ? (k === "height" ? "Length" : "Weight") : (k === "height" ? "Stature" : "Weight")) : m.label;
    pop.innerHTML = `<div><b>${q.latest ? "Latest measurement · " : ""}${G.fmtDate(q.date)}</b><br>Age ${q.ageText} (${(q.age / 12).toFixed(3)} y)<br>
      <b>${label}: ${q.v} ${m.unit} · ${G.fmtAssess(G.assess(m, p.sex, q.age, q.v))}</b><br><small>${esc(isSheet() ? sheet.title : G.getRef(refId).title)}</small>${q.notes ? `<br><small>${esc(q.notes)}</small>` : ""}</div>
      <button class="icon" id="px" aria-label="Close">✕</button>`;
    document.getElementById("px").onclick = () => { sel = null; draw(); showPop(); };
  };
  showPop();

  $app.querySelectorAll(".seg2 button").forEach((b) => b.onclick = () => { key = b.dataset.k; sel = null; showPop(); history.replaceState(null, "", `#chart/${pid}/${key}`); rebuild(true); });
  document.getElementById("ref").onchange = (e) => { manual = e.target.value === "auto" ? null : e.target.value; view = manual || autoView(); sel = null; showPop(); rebuild(true); };
  document.getElementById("line").onchange = (e) => { connect = e.target.checked; rebuild(false); };
  document.getElementById("smph").onchange = (e) => { settings.showMph = e.target.checked; draw(); };
  document.getElementById("spct").onchange = (e) => { settings.showPct = e.target.checked; draw(); };

  // viewport helpers: data units for computed charts, page points for original sheets
  const toData = (X, Y) => {
    if (sgeo) { const [x, y] = sgeo.toPage(X, Y); return { x, y }; }
    return { x: vp.x0 + (X - geo.L) / geo.pw * (vp.x1 - vp.x0), y: vp.y0 + (geo.T + geo.ph - Y) / geo.ph * (vp.y1 - vp.y0) };
  };
  const pan = (dx, dy) => {
    if (sgeo) { const k = 1 / sgeo.scale; vp = clampVp({ x0: vp.x0 - dx * k, x1: vp.x1 - dx * k, y0: vp.y0 - dy * k, y1: vp.y1 - dy * k }, bounds); }
    else vp = clampVp({ x0: vp.x0 - dx / geo.pw * (vp.x1 - vp.x0), x1: vp.x1 - dx / geo.pw * (vp.x1 - vp.x0), y0: vp.y0 + dy / geo.ph * (vp.y1 - vp.y0), y1: vp.y1 + dy / geo.ph * (vp.y1 - vp.y0) }, bounds);
  };
  const screenOf = (q) => sgeo ? sgeo.toScreen(px(sheet, q.age), py(sheet, q.key, q.v)) : [geo.X(q.age), geo.Y(q.v)];
  const center = () => {
    const q = allPts().filter((x) => x.latest).map((x) => (sgeo ? [px(sheet, x.age), py(sheet, x.key, x.v)] : [x.age, x.v]))[0];
    return q && q[0] >= vp.x0 && q[0] <= vp.x1 && q[1] >= Math.min(vp.y0, vp.y1) && q[1] <= Math.max(vp.y0, vp.y1) ? q : [(vp.x0 + vp.x1) / 2, (vp.y0 + vp.y1) / 2];
  };
  document.getElementById("zi").onclick = () => { vp = zoomVp(vp, 1.6, ...center(), bounds); draw(); };
  document.getElementById("zo").onclick = () => { vp = zoomVp(vp, 1 / 1.6, ...center(), bounds); draw(); };
  document.getElementById("zr").onclick = () => { vp = { ...bounds }; draw(); };

  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr(), y: (e.clientY - r.top) * dpr() }; };
  const ptrs = new Map(); let moved = false, pinch = null, lastTap = 0;
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e)); moved = false;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } };
  cv.onpointermove = (e) => {
    if (!ptrs.has(e.pointerId)) return; const q = pos(e), prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, q);
    if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), c = toData((a.x + b.x) / 2, (a.y + b.y) / 2);
      vp = zoomVp(vp, d / pinch, c.x, c.y, bounds); pinch = d; moved = true; draw(); return; }
    const dx = q.x - prev.x, dy = q.y - prev.y; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    pan(dx, dy); draw();
  };
  cv.onpointerup = (e) => {
    if (!moved && ptrs.size === 1) {
      const now = Date.now();
      if (now - lastTap < 300) { vp = { ...bounds }; draw(); lastTap = 0; }
      else {
        lastTap = now; const q = pos(e); let best = null, bd = 26 * dpr();
        allPts().forEach((pt) => { const [X, Y] = screenOf(pt); const d = Math.hypot(X - q.x, Y - q.y); if (d < bd) { bd = d; best = pt.id; } });
        sel = best; draw(); showPop();
      }
    }
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  };
  cv.onpointercancel = (e) => { ptrs.delete(e.pointerId); pinch = null; };
  cv.onwheel = (e) => { e.preventDefault(); const q = pos(e), c = toData(q.x, q.y); vp = zoomVp(vp, e.deltaY < 0 ? 1.2 : 1 / 1.2, c.x, c.y, bounds); draw(); };
  new ResizeObserver(() => data && draw()).observe(wrap);
  rebuild(true);
}

// ------------------------------------------------------------ backup / restore
function viewBackup(restoreFirst) {
  const backupCard = `<section class="card stack"><h2>Back up all patients</h2>
    <p>Creates one encrypted file (AES-256) with every patient, measurement and note. Choose a backup password: it is needed to restore the file on any device and cannot be recovered.</p>
    <label>Backup password<input id="bp" type="password" autocomplete="new-password"></label>
    <label>Repeat password<input id="bp2" type="password" autocomplete="new-password"></label>
    <small class="e" id="be"></small>
    <div class="row wrap"><button class="primary" id="bdl">Download backup</button><button class="tonal" id="bsh">Share…</button></div>
    <p class="hint">Share the file to your email, Google Drive or another phone, then use Restore there. The file also restores in the Android version of the app.</p></section>`;
  const restoreCard = `<section class="card stack"><h2>Restore from a backup file</h2>
    <p>Select a <b>.bgcbackup</b> file created by this app (web or Android).</p>
    <input type="file" id="rf" accept=".bgcbackup,application/octet-stream">
    <label>Backup password<input id="rp" type="password" autocomplete="off"></label>
    <fieldset class="stack"><legend>How to restore</legend>
      <label class="radio"><input type="radio" name="mode" value="merge" checked> Merge: add these records and keep existing ones (the newest edit wins)</label>
      <label class="radio"><input type="radio" name="mode" value="replace"> Replace: make this account identical to the backup</label>
    </fieldset>
    <small class="e" id="re"></small>
    <button class="primary" id="rgo">Restore</button></section>`;
  $app.innerHTML = bar(restoreFirst ? "Restore" : "Backup", true) + `<main class="page stack">${restoreFirst ? restoreCard + backupCard : backupCard + restoreCard}</main>`;
  bindBack();
  const $ = (i) => document.getElementById(i);
  const make = async (share) => {
    const pw = $("bp").value;
    $("be").textContent = pw.length < 8 ? "Use at least 8 characters." : pw !== $("bp2").value ? "Passwords do not match." : "";
    if ($("be").textContent) return;
    toast("Encrypting backup…");
    const bytes = await S.encodeBackup(await session.exportContents(), pw);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1_");
    await saveOrShare(new Blob([bytes], { type: "application/octet-stream" }), `GrowthChart_backup_${stamp}.bgcbackup`, share);
  };
  $("bdl").onclick = () => make(false);
  $("bsh").onclick = () => make(true);
  $("rgo").onclick = async () => {
    $("re").textContent = "";
    const f = $("rf").files[0];
    if (!f) { $("re").textContent = "Choose a backup file first."; return; }
    try {
      const c = await S.decodeBackup(new Uint8Array(await f.arrayBuffer()), $("rp").value);
      const replace = $app.querySelector('input[name="mode"]:checked').value === "replace";
      const go2 = async () => { const r = await session.restore(c, replace);
        confirmBox("Restore complete", `Restored ${r.np} patients, ${r.nm} measurements and ${r.ni} investigations${r.skipped ? ` (${r.skipped} older copies skipped)` : ""}.`, "OK", () => go("#home")); };
      if (replace) confirmBox("Replace all records?", `This account will contain exactly the ${c.patients.length} patients in the backup. Records not in the backup are deleted.`, "Replace", go2, true);
      else go2();
    } catch (ex) { $("re").textContent = ex.message; }
  };
}

// ------------------------------------------------------------ settings
function viewSettings() {
  $app.innerHTML = bar("Settings", true) + `
  <main class="page stack">
    <section class="card stack"><h2>Default growth reference</h2>
      ${Object.entries(G.FAMILIES).map(([k, v]) => `<label class="radio"><input type="radio" name="fam" value="${k}" ${settings.family === k ? "checked" : ""}> ${v}</label>`).join("")}
      <p class="hint">Chooses the chart from the child's age and is used for the percentiles in tables and reports. Any chart can still be picked on the chart screen.</p></section>
    <section class="card stack"><h2>Display</h2>
      <label class="switch"><input type="checkbox" id="cl" ${settings.connect ? "checked" : ""}> Connect measurements with a line (trajectory)</label></section>
    <section class="card stack" id="synccard"><h2>Sync between phone and computer</h2><div id="syncbody"></div></section>
    <section class="card stack"><h2>Storage on this device</h2>
      <p class="hint">Records are encrypted (AES-256) with a key kept by this browser and stored on this device only. Clearing the browser's site data or uninstalling the app deletes them, so make regular backups. To use the same records on another device, restore a backup there.</p>
      <p class="hint" id="pers"></p></section>
    <section class="card stack"><h2>Original CDC growth charts</h2>
      <p class="hint">${esc(sheetMeta()?.source || "")}</p><p class="hint">${esc(sheetMeta()?.calibration || "")}</p></section>
    <section class="card stack"><h2>Growth references (bundled, work offline)</h2>
      ${G.allRefs().map((r) => `<div><b>${esc(r.title)}</b><br><small>Version: ${esc(r.version)} · Percentile curves ${r.centiles.join(", ")}</small><br><small class="muted">Source: ${esc(r.source)}</small></div>`).join("<hr>")}
      <p class="hint">Curves are generated from the official LMS parameters. Each measurement is plotted at the exact age (days ÷ 30.4375 months) with no rounding.</p></section>
    <section class="card"><h2>About</h2><p>Pediatric Growth Chart (web app). Clinical decision support only; verify measurements and interpret results in clinical context.</p></section>
  </main>`;
  bindBack();
  $app.querySelectorAll('input[name="fam"]').forEach((r) => r.onchange = () => { settings.family = r.value; toast("Saved"); });
  document.getElementById("cl").onchange = (e) => { settings.connect = e.target.checked; };
  renderSyncCard();
  navigator.storage?.persisted?.().then((ok) => { document.getElementById("pers").textContent = ok ? "Storage is marked persistent: the browser will not clear it automatically." : "Tip: install the app to the home screen so the browser keeps its storage."; });
}

// ------------------------------------------------------------ investigations
const INV_CATS = {
  "Hematology": ["Hemoglobin (Hb)", "WBC", "Platelets", "MCV", "Ferritin", "Serum iron", "ESR", "CRP"],
  "Biochemistry": ["Creatinine", "Urea", "Sodium", "Potassium", "Calcium", "Phosphate", "Alkaline phosphatase", "ALT", "AST", "Albumin", "Glucose", "HbA1c", "25-OH vitamin D"],
  "Endocrine": ["TSH", "Free T4", "IGF-1", "IGFBP-3", "GH peak (stimulation test)", "Cortisol (8 am)", "LH", "FSH", "Testosterone", "Estradiol", "Prolactin"],
  "Celiac / GI": ["tTG-IgA", "Total IgA", "EMA", "Fecal calprotectin"],
  "Bone age / X-ray": ["Bone age (Greulich–Pyle)", "Bone age (TW3)", "Skeletal survey", "Chest X-ray"],
  "Imaging": ["Brain / pituitary MRI", "Abdominal ultrasound", "Pelvic ultrasound", "Echocardiography"],
  "Urine": ["Urinalysis", "Urine protein/creatinine ratio", "Urine osmolality"],
  "Genetics": ["Karyotype", "Chromosomal microarray", "SHOX analysis", "Gene panel / exome"],
  "Other": [],
};
const photoUrls = new Map(); // fileId -> object URL (decrypted on demand)
async function photoUrl(fid) {
  if (photoUrls.has(fid)) return photoUrls.get(fid);
  const bytes = await session.getFile(fid); if (!bytes) return null;
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" })); photoUrls.set(fid, url); return url;
}
async function fillThumbs(root) {
  for (const img of root.querySelectorAll("img[data-fid]")) {
    const url = await photoUrl(img.dataset.fid);
    if (url) img.src = url; else img.replaceWith(Object.assign(document.createElement("span"), { className: "thumb missing", textContent: "Photo not yet synced" }));
  }
}
function viewPhoto(fid) {
  photoUrl(fid).then((url) => {
    if (!url) return toast("This photo is not on this device yet. Sync to download it.");
    const d = document.createElement("dialog"); d.className = "photo";
    d.innerHTML = `<img src="${url}" alt="Investigation photo"><div class="row end"><a class="ghost" href="${url}" target="_blank" rel="noopener">Open full size</a><button class="primary" value="c">Close</button></div>`;
    document.body.append(d); d.showModal(); d.querySelector("button").onclick = () => { d.close(); d.remove(); };
  });
}

function investigationsSection(p) {
  const list = session.investigationsFor(p.id);
  const byCat = {};
  for (const x of list) (byCat[x.category] ||= []).push(x);
  const entry = (x) => `<div class="inv" data-inv="${x.id}">
      <div class="invhead"><b>${G.fmtDate(x.date)}</b><span class="muted">${esc(G.exactAge(p.dob, x.date).short)}</span></div>
      ${(x.results || []).filter((r) => r.test || r.value).map((r) => `<div class="invrow"><span>${esc(r.test)}</span><b>${esc(r.value)} ${esc(r.unit || "")}</b>${r.ref ? `<small class="muted">ref ${esc(r.ref)}</small>` : ""}</div>`).join("")}
      ${x.notes ? `<p class="hint pre">${esc(x.notes)}</p>` : ""}
      ${(x.photos || []).length ? `<div class="thumbs">${x.photos.map((f) => `<img data-fid="${f.id}" alt="Investigation photo" class="thumb">`).join("")}</div>` : ""}
    </div>`;
  return `<section class="card" id="invsec"><div class="row"><h2 class="grow">Investigations (${list.length})</h2><a class="tonal small" href="#inv/${p.id}">+ Add</a></div>
    ${list.length ? Object.keys(INV_CATS).filter((c) => byCat[c]).concat(Object.keys(byCat).filter((c) => !INV_CATS[c]))
      .map((c) => `<h3 class="invcat">${esc(c)}</h3>${byCat[c].map(entry).join("")}`).join("")
      : `<p class="muted">No investigations yet. Add results as numbers, or take a photo of the report.</p>`}
  </section>`;
}
function bindInvestigationsSection() {
  const sec = document.getElementById("invsec"); if (!sec) return;
  const pid = location.hash.split("/")[1];
  sec.querySelectorAll("[data-inv]").forEach((el) => el.onclick = (e) => {
    const img = e.target.closest("img[data-fid]");
    if (img) { e.stopPropagation(); viewPhoto(img.dataset.fid); } else go(`#inv/${pid}/${el.dataset.inv}`);
  });
  fillThumbs(sec);
}

async function processPhoto(file) {
  // Downscale large camera images (max 2000 px) and store as JPEG to keep the database and sync small.
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
}

function viewInvestigation(pid, iid) {
  const p = session.patients.get(pid); if (!p) return go("#home");
  const x = iid ? session.investigations.get(iid) : null;
  if (iid && !x) return go(`#p/${pid}`);
  let photos = [...(x?.photos || [])];
  const added = []; // photos stored during this edit (removed again if the form is abandoned)
  const rows = x?.results?.length ? x.results.map((r) => ({ ...r })) : [{ test: "", value: "", unit: "", ref: "" }];
  $app.innerHTML = bar(x ? "Edit Investigation" : "Add Investigation", true, x ? `<button class="icon" id="del" aria-label="Delete investigation">🗑</button>` : "") + `
  <main class="page"><form id="f" class="stack" novalidate>
    <section class="card"><h2>${esc(p.name)}</h2><p class="muted">File ${esc(p.fileNumber)} · DOB ${G.fmtDate(p.dob)}</p></section>
    <section class="card stack">
      <div class="two">
        <label>Date<input id="d" type="date" min="${p.dob}" max="${G.todayIso()}" value="${x?.date || G.todayIso()}"></label>
        <label>Section<select id="cat">${Object.keys(INV_CATS).map((c) => `<option ${c === (x?.category || "Endocrine") ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      </div>
      <h2>Results</h2>
      <div id="rows" class="stack"></div>
      <button type="button" class="ghost" id="addrow">+ Add result row</button>
      <datalist id="tests"></datalist>
      <label>Notes / interpretation<textarea id="n" rows="2">${esc(x?.notes)}</textarea></label>
    </section>
    <section class="card stack"><h2>Photos of reports / images</h2>
      <div class="thumbs" id="thumbs"></div>
      <div class="row wrap">
        <button type="button" class="tonal" id="cambtn">📷 Take photo</button>
        <button type="button" class="ghost" id="filebtn">Upload photo</button>
      </div>
      <input type="file" id="cam" accept="image/*" capture="environment" hidden>
      <input type="file" id="file" accept="image/*" multiple hidden>
      <p class="hint">The camera opens on phones; on a computer choose an image file. Photos are stored encrypted and synced with your other devices.</p>
    </section>
    <p class="err" id="err" hidden></p>
    <button class="primary">Save investigation</button>
  </form></main>`;
  bindBack();
  const $ = (i) => document.getElementById(i);
  const fillTests = () => { $("tests").innerHTML = (INV_CATS[$("cat").value] || []).map((t) => `<option value="${esc(t)}">`).join(""); };
  const renderRows = () => {
    $("rows").innerHTML = rows.map((r, i) => `<div class="resrow" data-i="${i}">
      <input placeholder="Test" list="tests" data-f="test" value="${esc(r.test)}" aria-label="Test">
      <input placeholder="Result" data-f="value" value="${esc(r.value)}" aria-label="Result">
      <input placeholder="Unit" data-f="unit" value="${esc(r.unit)}" aria-label="Unit">
      <input placeholder="Reference range" data-f="ref" value="${esc(r.ref)}" aria-label="Reference range">
      <button type="button" class="icon rm" aria-label="Remove row">✕</button></div>`).join("");
    $("rows").querySelectorAll(".resrow").forEach((el) => {
      const i = +el.dataset.i;
      el.querySelectorAll("input").forEach((inp) => inp.oninput = () => { rows[i][inp.dataset.f] = inp.value; });
      el.querySelector(".rm").onclick = () => { rows.splice(i, 1); if (!rows.length) rows.push({ test: "", value: "", unit: "", ref: "" }); renderRows(); };
    });
  };
  const renderThumbs = () => {
    $("thumbs").innerHTML = photos.map((f) => `<div class="tw"><img data-fid="${f.id}" class="thumb" alt="Photo"><button type="button" class="icon rm" data-rm="${f.id}" aria-label="Remove photo">✕</button></div>`).join("");
    fillThumbs($("thumbs"));
    $("thumbs").querySelectorAll("img").forEach((img) => img.onclick = () => viewPhoto(img.dataset.fid));
    $("thumbs").querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { photos = photos.filter((f) => f.id !== b.dataset.rm); renderThumbs(); });
  };
  const addFiles = async (files) => {
    for (const f of files) {
      try {
        toast("Saving photo…");
        const { bytes, w, h } = await processPhoto(f);
        const id = await session.putFile(bytes);
        added.push(id); photos.push({ id, w, h });
      } catch { toast("Could not read this image."); }
    }
    renderThumbs();
  };
  $("cat").onchange = fillTests; fillTests(); renderRows(); renderThumbs();
  $("addrow").onclick = () => { rows.push({ test: "", value: "", unit: "", ref: "" }); renderRows(); $("rows").lastElementChild.querySelector("input").focus(); };
  $("cambtn").onclick = () => $("cam").click();
  $("filebtn").onclick = () => $("file").click();
  $("cam").onchange = (e) => { addFiles([...e.target.files]); e.target.value = ""; };
  $("file").onchange = (e) => { addFiles([...e.target.files]); e.target.value = ""; };
  let saved = false;
  window.addEventListener("hashchange", async function cleanup() {
    window.removeEventListener("hashchange", cleanup);
    if (!saved) for (const id of added) await session.deleteFile(id); // abandoned: discard photos taken in this visit
  });
  $("f").onsubmit = async (e) => {
    e.preventDefault();
    const results = rows.map((r) => ({ test: r.test.trim(), value: r.value.trim(), unit: r.unit.trim(), ref: r.ref.trim() })).filter((r) => r.test || r.value);
    const d = $("d").value;
    const err = !d ? "Choose the date." : d < p.dob ? "The date is before the date of birth." : !results.length && !photos.length ? "Add at least one result or photo." : "";
    $("err").textContent = err; $("err").hidden = !err; if (err) return;
    // photos removed from an existing entry are deleted from storage
    for (const f of x?.photos || []) if (!photos.find((q) => q.id === f.id)) await session.deleteFile(f.id);
    saved = true;
    await session.saveInvestigation({ id: x?.id, patientId: pid, date: d, category: $("cat").value, results, notes: $("n").value.trim(), photos });
    toast("Investigation saved");
    history.back();
  };
  $("del")?.addEventListener("click", () => confirmBox("Delete this investigation?", "Its results and photos will be deleted" + (sync?.enabled ? " on all synced devices." : "."), "Delete", async () => {
    saved = true; await session.deleteInvestigation(x.id); toast("Deleted"); history.back();
  }, true));
}

// ------------------------------------------------------------ sync
async function initSync() {
  sync = new Sync(session);
  session.onChange = () => sync.schedule();
  sync.on(() => {
    const el = document.getElementById("syncline"); if (el) el.textContent = syncText();
    if (document.getElementById("syncbody")) renderSyncCard();
  });
  await sync.load().catch(() => false);
  if (sync.enabled) sync.sync().then((r) => { if (r && r.down) route(); }).catch(() => {});
  if (!initSync.timer) {
    initSync.timer = setInterval(() => { if (document.visibilityState === "visible" && sync?.enabled) sync.sync().then((r) => { if (r?.down && !document.querySelector("form, dialog[open]")) route(); }).catch(() => {}); }, 60000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && sync?.enabled) sync.sync().then((r) => { if (r?.down && !document.querySelector("form, dialog[open]")) route(); }).catch(() => {}); });
  }
}
function syncText() {
  if (!sync || !sync.enabled) return "Stored encrypted on this device · works offline";
  const st = sync.status;
  const t = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  switch (st.state) {
    case "running": return "Syncing…";
    case "done": case "idle": return st.at ? `Synced ${t(st.at)} · encrypted` : "Sync on";
    case "offline": return "Offline · changes will sync when connected";
    case "error": return "Sync problem: " + st.message;
    default: return "Sync on";
  }
}
function renderSyncCard() {
  const box = document.getElementById("syncbody"); if (!box) return;
  if (sync?.enabled) {
    box.innerHTML = `<p><b>${esc(syncText())}</b></p>
      <p class="hint">Enter this sync code on your other devices (phone, computer) to see the same patients:</p>
      <p class="code" id="codetxt">${esc(sync.code)}</p>
      <div class="row wrap"><button class="primary" id="snow">Sync now</button><button class="ghost" id="scopy">Copy code</button><button class="ghost" id="soff">Stop syncing on this device</button></div>
      <p class="hint">Records and photos are encrypted on the device with a key made from this code before they are uploaded; the server cannot read them. Anyone with the code can read your records, so keep it private.</p>`;
    document.getElementById("snow").onclick = () => sync.sync().then((r) => toast(`Synced: ${r.down} received, ${r.up} sent`)).catch((e) => toast(e.message));
    document.getElementById("scopy").onclick = () => navigator.clipboard?.writeText(sync.code).then(() => toast("Code copied")).catch(() => toast("Select the code and copy it"));
    document.getElementById("soff").onclick = () => confirmBox("Stop syncing on this device?", "Records stay on this device. Other devices keep syncing with each other.", "Stop", async () => { await sync.disable(); renderSyncCard(); });
    return;
  }
  box.innerHTML = `<p class="hint">Use the same patients on your phone and computer. Changes, investigations and photos synchronise automatically, end-to-end encrypted.</p>
    <div class="row wrap"><button class="primary" id="snew">Start syncing (create code)</button></div>
    <p class="hint">Already syncing on another device? Enter its sync code:</p>
    <div class="row wrap"><input id="sjoin" placeholder="ABCD-EFGH-JKLM-NPQR-STUV" autocomplete="off" autocapitalize="characters" style="flex:1 1 220px"><button class="tonal" id="sjoinb">Join</button></div>
    <p class="err" id="serr" hidden></p>`;
  const fail = (e) => { const el = document.getElementById("serr"); if (el) { el.textContent = e.message; el.hidden = false; } };
  document.getElementById("snew").onclick = () => sync.enable(newSyncCode()).then(() => { toast("Sync started"); renderSyncCard(); }).catch(async (e) => { await sync.disable(); renderSyncCard(); fail(e); });
  document.getElementById("sjoinb").onclick = () => sync.enable(document.getElementById("sjoin").value).then((r) => { toast(`Joined: ${r.down} records received`); renderSyncCard(); }).catch(async (e) => { if (!e.offline) await sync.disable(); renderSyncCard(); fail(e); });
}

// ------------------------------------------------------------ start
(async function start() {
  try { await G.loadReferences(); await loadSheets(); }
  catch { $app.innerHTML = `<main class="page"><p class="err">Could not load growth reference data. Connect to the internet once and reload.</p></main>`; return; }
  let res = null;
  try { res = await S.openDirect(); } catch { res = null; }
  if (res && res.locked) { unlockLocked = res.locked; session = null; }
  else if (res) session = res;
  else { try { session = await S.createDeviceWorkspace(); } catch { session = null; } }
  if (session) { navigator.storage?.persist?.(); await initSync(); }
  route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
