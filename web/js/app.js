import * as G from "./growth.js";
import * as S from "./store.js";
import { drawChart, fullBounds, zoomVp, clampVp, buildChart } from "./chart.js";

const $app = document.getElementById("app");
let session = null;
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (location.hash === "#home" || !location.hash) route(); });

// ------------------------------------------------------------ helpers
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (s) => { const v = parseFloat(String(s ?? "").trim().replace(",", ".")); return Number.isFinite(v) ? v : null; };
const go = (h) => { location.hash = h; };
const settings = {
  get family() { try { const f = localStorage.getItem("pgc.family"); return f && G.FAMILIES[f] ? f : "AUTO"; } catch { return "AUTO"; } },
  set family(v) { try { localStorage.setItem("pgc.family", v); } catch {} },
  get connect() { try { return localStorage.getItem("pgc.connect") !== "0"; } catch { return true; } },
  set connect(v) { try { localStorage.setItem("pgc.connect", v ? "1" : "0"); } catch {} },
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
  if (!session && view !== "login") return viewLogin();
  switch (view) {
    case "login": return session ? go("#home") : viewLogin();
    case "home": return viewHome();
    case "list": return viewList(a || "browse");
    case "new": return viewPatientForm(null);
    case "edit": return viewPatientForm(a);
    case "p": return viewPatient(a);
    case "m": return viewMeasure(a, b || null);
    case "chart": return viewChart(a, b || "height");
    case "backup": return viewBackup(a === "restore");
    case "settings": return viewSettings();
    default: return viewHome();
  }
}
window.addEventListener("hashchange", route);

// ------------------------------------------------------------ login
async function viewLogin(mode = "signin") {
  const email = await S.lastEmail();
  const reg = mode === "register";
  $app.innerHTML = `
  <main class="login">
    <svg viewBox="0 0 24 24" class="logo" aria-hidden="true"><path d="M3.5 18.5l6-6 4 4L22 6.9l-1.4-1.4-7.1 8-4-4L2 17z"/></svg>
    <h1 class="brand">Pediatric Growth Chart</h1>
    <p class="sub">${reg ? "Create a clinician account on this device" : "Clinician sign-in"}</p>
    <form id="f" class="stack narrow">
      <label>Email / username<input id="email" type="email" autocomplete="username" required value="${esc(reg ? "" : email)}"></label>
      <label>Password<input id="pw" type="password" autocomplete="${reg ? "new-password" : "current-password"}" required></label>
      ${reg ? `<label>Repeat password<input id="pw2" type="password" autocomplete="new-password" required><small>At least 8 characters. It encrypts your records and cannot be recovered.</small></label>` : ""}
      <p class="err" id="err" hidden></p>
      <button class="primary" id="go">${reg ? "Create account" : "Sign in"}</button>
      <button type="button" class="ghost" id="sw">${reg ? "I already have an account" : "Create account"}</button>
    </form>
    <p class="fine">Records are encrypted and stored only on this device. They work offline. Use Backup to move them to another phone.</p>
  </main>`;
  document.getElementById("sw").onclick = () => viewLogin(reg ? "signin" : "register");
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById("err"), btn = document.getElementById("go");
    err.hidden = true; btn.disabled = true; btn.textContent = "Please wait…";
    try {
      const em = document.getElementById("email").value, pw = document.getElementById("pw").value;
      if (reg && pw !== document.getElementById("pw2").value) throw new Error("Passwords do not match.");
      session = reg ? await S.register(em, pw) : await S.signIn(em, pw);
      navigator.storage?.persist?.();
      go("#home"); if (location.hash === "#home") route();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; btn.textContent = reg ? "Create account" : "Sign in"; }
  };
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
    <div class="who"><b>Signed in as ${esc(session.email)}</b><small>${n} patient${n === 1 ? "" : "s"} · stored encrypted on this device</small></div>
    ${installEvt ? `<button class="install" id="inst">Install app on this device</button>` : ""}
    <nav class="tiles">
      ${tiles.map(([t, i, h]) => `<a class="tile" href="${h}">${icon(i)}<span>${t}</span></a>`).join("")}
      <button class="tile" id="logout">${icon("out")}<span>Logout</span></button>
    </nav>
    ${recent.length ? `<h2>Recently updated</h2><div class="plist">${recent.map(patientRow).join("")}</div>` : ""}
  </main>`;
  document.getElementById("inst")?.addEventListener("click", async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; route(); });
  document.getElementById("logout").onclick = () => confirmBox("Log out?", "Your records stay encrypted on this device and will be available when you sign in again.", "Log out", async () => {
    await S.signOut(); session = null; go("#login");
  });
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
  const mphTxt = p.mph ? `${G.fmtNum(p.mph)} cm (target ${G.fmtNum(p.mph - 8.5)}–${G.fmtNum(p.mph + 8.5)} cm)${p.mphManual ? ", manual" : ""}` : "not recorded";
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
      <button class="ghost" id="pdf">Export PDF</button>
    </div>
    <section class="card"><h2>Measurements (${ms.length})</h2>
      ${ms.length ? `<p class="hint">Percentiles: ${G.FAMILIES[settings.family]}. Tap a row to edit.</p>
      <div class="scrollx"><table class="mt"><thead><tr><th>Date</th><th>Age</th><th>Height</th><th>Weight</th></tr></thead><tbody>
      ${[...ms].reverse().map((m) => `<tr data-m="${m.id}"><td>${G.fmtDate(m.date)}</td><td>${G.exactAge(p.dob, m.date).text}</td><td>${cell(m, "height")}</td><td>${cell(m, "weight")}</td></tr>${m.notes ? `<tr class="nt" data-m="${m.id}"><td colspan="4">${esc(m.notes)}</td></tr>` : ""}`).join("")}
      </tbody></table></div>` : `<p class="muted">No measurements yet.</p>`}
    </section>
  </main>`;
  bindBack();
  $app.querySelectorAll("tr[data-m]").forEach((tr) => tr.onclick = () => go(`#m/${id}/${tr.dataset.m}`));
  document.getElementById("del").onclick = () => confirmBox(`Delete ${p.name}?`, `The patient and all ${ms.length} measurements will be permanently deleted from this device. This cannot be undone.`, "Delete", async () => {
    await session.deletePatient(id); toast("Patient deleted"); go("#home");
  }, true);
  document.getElementById("pdf").onclick = () => pdfDialog(p);
  if (sessionStorage.getItem("pgc.autopdf") === id) { sessionStorage.removeItem("pgc.autopdf"); pdfDialog(p); }
}

function pdfDialog(p) {
  const d = document.createElement("dialog");
  d.innerHTML = `<h3>Export patient report (PDF)</h3><p>Patient information, notes, the measurement table, and height- and weight-for-age charts with every red × marker.</p>
  <div class="row end"><button class="ghost" value="c">Cancel</button><button class="tonal" value="share">Share / print</button><button class="primary" value="save">Download</button></div>`;
  document.body.append(d); d.showModal();
  d.querySelectorAll("button").forEach((b) => b.onclick = async () => {
    d.close(); d.remove(); if (b.value === "c") return;
    toast("Creating PDF…");
    const { buildPdf } = await import("./pdf.js");
    const blob = await buildPdf(p, session.measurementsFor(p.id), settings.family, settings.connect, session.email);
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

function viewChart(pid, key) {
  const p = session.patients.get(pid); if (!p) return go("#home");
  const ms = session.measurementsFor(pid);
  const latest = ms[ms.length - 1];
  const autoRef = () => G.defaultRefFor(settings.family, G.exactAge(p.dob, latest ? latest.date : G.todayIso()).months);
  let manual = null; // null = automatic chart choice for the child's age
  let refId = autoRef();
  let connect = settings.connect, sel = null, data, bounds, vp, geo;

  $app.innerHTML = bar(`${p.name} · growth chart`, true, `<a class="icon" href="#m/${pid}" aria-label="Add measurement">＋</a>`) + `
  <main class="chartpage">
    <div class="ctl">
      <div class="seg2" role="tablist"><button data-k="height">Height-for-age</button><button data-k="weight">Weight-for-age</button></div>
      <div class="row wrap">
        <select id="ref" aria-label="Growth chart"><option value="auto">Automatic by age (${esc(G.getRef(autoRef()).shortTitle)})</option>${G.allRefs().map((r) => `<option value="${r.id}">${esc(r.title)}</option>`).join("")}</select>
        <label class="switch"><input type="checkbox" id="line" ${connect ? "checked" : ""}> Line</label>
        <span class="grow"></span>
        <button class="round" id="zi" aria-label="Zoom in">+</button><button class="round" id="zo" aria-label="Zoom out">−</button><button class="round" id="zr" aria-label="Reset zoom">⟲</button>
      </div>
      <p class="warn" id="out" hidden></p>
    </div>
    <div class="cwrap"><canvas id="cv"></canvas></div>
    <div id="pop" class="pop"><span class="hint">Pinch or scroll to zoom · drag to pan · double-tap to reset · tap a red × for details</span></div>
  </main>`;
  bindBack();
  const cv = document.getElementById("cv"), wrap = cv.parentElement;
  const dpr = () => window.devicePixelRatio || 1;

  const rebuild = (resetVp) => {
    data = buildChart(p, ms, refId, key, connect, sel);
    bounds = fullBounds(data.m, p.sex, data.points.map((q) => q.v));
    if (resetVp || !vp) vp = { ...bounds };
    $app.querySelectorAll(".seg2 button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === key));
    document.getElementById("ref").value = manual || "auto";
    const out = document.getElementById("out");
    out.hidden = !data.outside;
    // Offer the chart that holds the hidden measurements (e.g. WHO 0-24 months for earlier visits).
    const other = data.outside ? ms.map((x) => G.defaultRefFor(settings.family, G.exactAge(p.dob, x.date).months)).find((id) => id !== refId) : null;
    out.innerHTML = `${data.outside} measurement(s) are on another chart (this one covers ${G.fmtNum(data.m.ageMin / 12)}–${G.fmtNum(data.m.ageMax / 12)} y).` +
      (other ? ` <button class="link" id="other">Show ${esc(G.getRef(other).title)}</button>` : " Select another chart to see them.");
    document.getElementById("other")?.addEventListener("click", () => { manual = other; refId = other; sel = null; showPop(); rebuild(true); });
    draw();
  };
  const draw = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    cv.width = Math.round(w * dpr()); cv.height = Math.round(h * dpr());
    cv.style.width = w + "px"; cv.style.height = h + "px";
    data.sel = sel;
    geo = drawChart(cv.getContext("2d"), cv.width, cv.height, data, vp, dpr());
  };
  const showPop = () => {
    const q = data.points.find((x) => x.id === sel), pop = document.getElementById("pop");
    if (!q) { pop.innerHTML = `<span class="hint">Pinch or scroll to zoom · drag to pan · double-tap to reset · tap a red × for details</span>`; return; }
    const a = G.assess(data.m, p.sex, q.age, q.v);
    pop.innerHTML = `<div><b>${q.latest ? "Latest measurement · " : ""}${G.fmtDate(q.date)}</b><br>Age ${q.ageText} (${(q.age / 12).toFixed(3)} y)<br>
      <b>${data.m.label}: ${q.v} ${data.m.unit} · ${G.fmtAssess(a)}</b><br><small>${esc(data.ref.title)} · ${esc(data.ref.version)}</small>${q.notes ? `<br><small>${esc(q.notes)}</small>` : ""}</div>
      <button class="icon" id="px" aria-label="Close">✕</button>`;
    document.getElementById("px").onclick = () => { sel = null; draw(); showPop(); };
  };

  $app.querySelectorAll(".seg2 button").forEach((b) => b.onclick = () => { key = b.dataset.k; sel = null; showPop(); history.replaceState(null, "", `#chart/${pid}/${key}`); rebuild(true); });
  document.getElementById("ref").onchange = (e) => { manual = e.target.value === "auto" ? null : e.target.value; refId = manual || autoRef(); sel = null; showPop(); rebuild(true); };
  document.getElementById("line").onchange = (e) => { connect = e.target.checked; rebuild(false); };
  // Zoom buttons focus on the latest measurement when it is in view, otherwise on the centre.
  const center = () => {
    const q = data.points.find((x) => x.latest);
    return q && q.age >= vp.x0 && q.age <= vp.x1 && q.v >= vp.y0 && q.v <= vp.y1 ? [q.age, q.v] : [(vp.x0 + vp.x1) / 2, (vp.y0 + vp.y1) / 2];
  };
  document.getElementById("zi").onclick = () => { vp = zoomVp(vp, 1.6, ...center(), bounds); draw(); };
  document.getElementById("zo").onclick = () => { vp = zoomVp(vp, 1 / 1.6, ...center(), bounds); draw(); };
  document.getElementById("zr").onclick = () => { vp = { ...bounds }; draw(); };

  // gestures
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr(), y: (e.clientY - r.top) * dpr() }; };
  const toData = (px, py) => ({ x: vp.x0 + (px - geo.L) / geo.pw * (vp.x1 - vp.x0), y: vp.y0 + (geo.T + geo.ph - py) / geo.ph * (vp.y1 - vp.y0) });
  const ptrs = new Map(); let moved = false, pinch = null, lastTap = 0;
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e)); moved = false;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } };
  cv.onpointermove = (e) => {
    if (!ptrs.has(e.pointerId)) return; const q = pos(e), prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, q);
    if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), c = toData((a.x + b.x) / 2, (a.y + b.y) / 2);
      vp = zoomVp(vp, d / pinch, c.x, c.y, bounds); pinch = d; moved = true; draw(); return; }
    const dx = q.x - prev.x, dy = q.y - prev.y; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    vp = clampVp({ x0: vp.x0 - dx / geo.pw * (vp.x1 - vp.x0), x1: vp.x1 - dx / geo.pw * (vp.x1 - vp.x0), y0: vp.y0 + dy / geo.ph * (vp.y1 - vp.y0), y1: vp.y1 + dy / geo.ph * (vp.y1 - vp.y0) }, bounds); draw();
  };
  cv.onpointerup = (e) => {
    if (!moved && ptrs.size === 1) {
      const now = Date.now();
      if (now - lastTap < 300) { vp = { ...bounds }; draw(); lastTap = 0; }
      else {
        lastTap = now; const q = pos(e); let best = null, bd = 26 * dpr();
        geo.pts.forEach((pt) => { const d = Math.hypot(geo.X(pt.age) - q.x, geo.Y(pt.v) - q.y); if (d < bd) { bd = d; best = pt.id; } });
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
    const bytes = await S.encodeBackup(session.exportContents(), pw);
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
        confirmBox("Restore complete", `Restored ${r.np} patients and ${r.nm} measurements${r.skipped ? ` (${r.skipped} older copies skipped)` : ""}.`, "OK", () => go("#home")); };
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
    <section class="card stack"><h2>Account & storage</h2>
      <p>Signed in as <b>${esc(session.email)}</b>.</p>
      <p class="hint">Records are encrypted with a key protected by your password and stored in this browser only. Clearing the browser's site data or uninstalling the app deletes them, so make regular backups. To use the same records on another device, restore a backup there.</p>
      <p class="hint" id="pers"></p></section>
    <section class="card stack"><h2>Growth references (bundled, work offline)</h2>
      ${G.allRefs().map((r) => `<div><b>${esc(r.title)}</b><br><small>Version: ${esc(r.version)} · Percentile curves ${r.centiles.join(", ")}</small><br><small class="muted">Source: ${esc(r.source)}</small></div>`).join("<hr>")}
      <p class="hint">Curves are generated from the official LMS parameters. Each measurement is plotted at the exact age (days ÷ 30.4375 months) with no rounding.</p></section>
    <section class="card"><h2>About</h2><p>Pediatric Growth Chart (web app). Clinical decision support only; verify measurements and interpret results in clinical context.</p></section>
  </main>`;
  bindBack();
  $app.querySelectorAll('input[name="fam"]').forEach((r) => r.onchange = () => { settings.family = r.value; toast("Saved"); });
  document.getElementById("cl").onchange = (e) => { settings.connect = e.target.checked; };
  navigator.storage?.persisted?.().then((ok) => { document.getElementById("pers").textContent = ok ? "Storage is marked persistent: the browser will not clear it automatically." : "Tip: install the app to the home screen so the browser keeps its storage."; });
}

// ------------------------------------------------------------ start
(async function start() {
  try { await G.loadReferences(); }
  catch { $app.innerHTML = `<main class="page"><p class="err">Could not load growth reference data. Connect to the internet once and reload.</p></main>`; return; }
  try { session = await S.restoreSession(); } catch { session = null; }
  route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
