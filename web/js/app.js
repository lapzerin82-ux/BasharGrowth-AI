import * as G from "./growth.js";
import * as S from "./store.js";
import { drawChart, fullBounds, zoomVp, clampVp, buildChart } from "./chart.js";
import { Sync, newSyncCode } from "./sync.js";
import { INV_CATS, unitFor, FEATURE_GROUPS, COMPLAINTS } from "./catalog.js";
import * as C from "./clinical.js";
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
  get alerts() { try { return localStorage.getItem("pgc.alerts") !== "0"; } catch { return true; } },
  set alerts(v) { try { localStorage.setItem("pgc.alerts", v ? "1" : "0"); } catch {} },
  get corr() { try { return localStorage.getItem("pgc.corr") !== "0"; } catch { return true; } },
  set corr(v) { try { localStorage.setItem("pgc.corr", v ? "1" : "0"); } catch {} G.setCorrection(v); },
  get clinician() { try { return JSON.parse(localStorage.getItem("pgc.clin") || "{}"); } catch { return {}; } },
  set clinician(v) { try { localStorage.setItem("pgc.clin", JSON.stringify(v)); } catch {} },
};
G.setCorrection(settings.corr);
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
/** Percentile of a measure at a visit on the standard reference (age corrected for prematurity when that applies). */
function assessFor(p, m, key) {
  const a = G.plotAge(p, m.date); if (a.days < 0) return null;
  const id = G.refForKey(settings.family, key, a.months); if (!id) return null;
  return G.assessKey(id, key, p.sex, a.months, m);
}
/** Percentile on the condition-specific chart (Down / Turner syndrome), if the patient has one. */
function condAssess(p, m, key) {
  if (!p.condition || !G.CONDITIONS[p.condition]) return null;
  const a = G.plotAge(p, m.date); if (a.days < 0) return null;
  const id = G.condRefFor(p.condition, key, a.months);
  return id ? G.assessKey(id, key, p.sex, a.months, m) : null;
}
const COND_SHORT = { down: "DS", turner: "Turner" };
const lvlIcon = { bad: "⚠", warn: "▲", info: "ℹ", ok: "✓" };
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
    case "dev": return viewMilestones(a);
    case "vax": return viewVaccines(a);
    case "letter": return viewLetter(a);
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
// Cartoon for the home banner: sun, clouds, a growth ruler and three children of increasing height.
const HERO_ART = `<svg class="art" viewBox="0 0 150 130" aria-hidden="true">
  <circle cx="126" cy="22" r="13" fill="#ffc83d"/><g stroke="#ffc83d" stroke-width="3" stroke-linecap="round"><path d="M126 2v5M126 37v5M106 22h5M141 22h5M112 8l3 3M137 33l3 3M140 8l-3 3M115 33l-3 3"/></g>
  <g fill="#fff"><ellipse cx="34" cy="20" rx="16" ry="8"/><ellipse cx="46" cy="16" rx="11" ry="8"/><ellipse cx="88" cy="36" rx="12" ry="6"/><ellipse cx="97" cy="33" rx="8" ry="6"/></g>
  <rect x="8" y="30" width="16" height="96" rx="4" fill="#ff8a65"/><g stroke="#fff" stroke-width="2"><path d="M8 44h8M8 58h11M8 72h8M8 86h11M8 100h8M8 114h11"/></g>
  <path d="M0 122c30-10 60-10 150 0v8H0z" fill="#8fdcb0"/>
  <g><rect x="36" y="96" width="18" height="24" rx="8" fill="#4cc3f7"/><circle cx="45" cy="88" r="10" fill="#ffd7b5"/><path d="M35 86c2-9 18-9 20 0-6-3-14-3-20 0z" fill="#6b3f1d"/><circle cx="41.5" cy="88" r="1.3" fill="#2b2350"/><circle cx="48.5" cy="88" r="1.3" fill="#2b2350"/><path d="M41.5 92q3.5 3 7 0" stroke="#2b2350" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>
  <g><rect x="62" y="80" width="20" height="40" rx="9" fill="#ff7eb3"/><circle cx="72" cy="70" r="11" fill="#f2c29b"/><path d="M60 70c0-12 24-12 24 0-3-5-9-6-12-6s-9 1-12 6z" fill="#2e2a3a"/><circle cx="61" cy="73" r="3.5" fill="#2e2a3a"/><circle cx="83" cy="73" r="3.5" fill="#2e2a3a"/><circle cx="68" cy="70" r="1.4" fill="#2b2350"/><circle cx="76" cy="70" r="1.4" fill="#2b2350"/><path d="M68 75q4 3.5 8 0" stroke="#2b2350" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>
  <g><rect x="92" y="64" width="22" height="56" rx="10" fill="#9d7bf0"/><circle cx="103" cy="53" r="12" fill="#c98d62"/><path d="M91 52c1-13 23-13 24 0-4-4-20-4-24 0z" fill="#1f1a2a"/><circle cx="99" cy="53" r="1.5" fill="#2b2350"/><circle cx="107" cy="53" r="1.5" fill="#2b2350"/><path d="M98.5 58q4.5 4 9 0" stroke="#2b2350" stroke-width="1.5" fill="none" stroke-linecap="round"/></g>
  <path d="M126 58l3 6 6.5 1-4.7 4.6 1.1 6.4-5.9-3.1-5.9 3.1 1.1-6.4-4.7-4.6 6.5-1z" fill="#ffc83d"/>
</svg>`;
// Developer credit (home screen and Settings → About)
const CREDIT = `<footer class="credit"><img src="img/developer.png" alt="Dr. Bashar Ibrahim" width="56" height="56">
  <div><small>Developed &amp; designed by</small><b>Dr. Bashar Ibrahim</b><span>Pediatrician</span>
  <a href="mailto:bashar.mohammed@uoz.edu.krd">bashar.mohammed@uoz.edu.krd</a></div></footer>`;
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[k]}"/></svg>`;

const pname = (p) => p.name || (p.fileNumber ? `File ${p.fileNumber}` : "Unnamed patient");
function patientRow(p) {
  return `<a class="prow" href="#p/${p.id}"><span class="av ${p.sex === "F" ? "f" : ""}" aria-hidden="true">${p.sex === "F" ? "👧" : "👦"}</span><span><b>${esc(pname(p))}</b><small>File ${esc(p.fileNumber)} · ${p.sex === "F" ? "Female" : "Male"} · DOB ${esc(G.fmtDob(p, false))}</small></span><em>${G.exactAge(p.dob, G.todayIso()).short}</em></a>`;
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
    <section class="hero">
      <div><h2>Watch them grow!</h2><p>Growth charts, visits and milestones for every child</p>
        <span class="count">${n} patient${n === 1 ? "" : "s"}</span><small class="sync" id="syncline">${syncText()}</small></div>
      ${HERO_ART}
    </section>
    ${installEvt ? `<button class="install" id="inst">Install app on this device</button>` : ""}
    <nav class="tiles">
      ${tiles.map(([t, i, h]) => `<a class="tile" href="${h}">${icon(i)}<span>${t}</span></a>`).join("")}

    </nav>
    ${recent.length ? `<h2>Recently updated</h2><div class="plist">${recent.map(patientRow).join("")}</div>` : ""}
    ${CREDIT}
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
      <label>Patient name (optional)<input id="name" value="${esc(p?.name)}"><small class="e" data-for="name"></small></label>
      <fieldset class="seg" id="sex"><legend>Sex</legend>
        <label><input type="radio" name="sex" value="M" ${p?.sex === "M" ? "checked" : ""}><span>Male</span></label>
        <label><input type="radio" name="sex" value="F" ${p?.sex === "F" ? "checked" : ""}><span>Female</span></label>
      </fieldset><small class="e" data-for="sex"></small>
      <label>File / medical record number (optional)<input id="file" value="${esc(p?.fileNumber)}"><small class="e" data-for="file"></small></label>
      <div id="dup"></div>
      <label id="dobwrap">Date of birth<input id="dob" type="date" required max="${G.todayIso()}" value="${esc(p?.dobEstimated ? "" : p?.dob)}"><small class="e" data-for="dob"></small></label>
      <label class="switch"><input type="checkbox" id="dobunk" ${p?.dobEstimated ? "checked" : ""}> Birth date not known – enter age instead</label>
      <div id="agewrap" class="stack" hidden>
        <div class="three">
          <label>Years<input id="ay" inputmode="numeric" value="${esc(p?.ageEntered?.y ?? "")}"></label>
          <label>Months<input id="am" inputmode="numeric" value="${esc(p?.ageEntered?.m ?? "")}"></label>
          <label>Days (optional)<input id="ad" inputmode="numeric" value="${esc(p?.ageEntered?.d ?? "")}"></label>
        </div>
        <label>Age on (date)<input id="aon" type="date" max="${G.todayIso()}" value="${esc(p?.ageEntered?.on || G.todayIso())}"></label>
        <small class="e" data-for="age"></small>
        <p class="hint">The date of birth is estimated from this age and marked as estimated everywhere. Ages at later visits are counted from this estimate.</p>
      </div>
      <p class="hint" id="agenow"></p>
    </section>
    <section class="card stack"><h2>Birth history &amp; condition <small class="muted">(optional)</small></h2>
      <div class="three">
        <label>Gestational age (weeks)<input id="gaw" inputmode="numeric" value="${esc(p?.gaWeeks ?? "")}"></label>
        <label>+ days<input id="gad" inputmode="numeric" value="${esc(p?.gaDays ?? "")}"></label>
        <label>Birth weight (kg)<input id="bw" inputmode="decimal" value="${esc(p?.birthWeight ?? "")}"></label>
      </div>
      <small class="e" data-for="ga"></small>
      <p class="hint">Below 37 weeks, growth is plotted and assessed at the age corrected for prematurity (40 weeks − gestational age) until 24 months of chronological age. This can be switched off in Settings.</p>
      <label>Condition with its own growth charts<select id="cond">
        <option value="">None</option>${Object.entries(G.CONDITIONS).map(([k, t]) => `<option value="${k}" ${p?.condition === k ? "selected" : ""}>${esc(t)}</option>`).join("")}
      </select><small class="e" data-for="cond"></small></label>
      <label>Other diagnoses<input id="dx" value="${esc(p?.diagnoses)}" placeholder="e.g. Celiac disease, congenital heart disease…"></label>
      <p class="hint">Down syndrome: Zemel 2015 (CDC/AAP) charts; Turner syndrome: height reference for girls. Standard-chart percentiles are still shown.</p>
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
    <section class="card stack"><h2>Main complaint <small class="muted">(optional)</small></h2>
      <input id="complaint" list="complaints" placeholder="e.g. Short stature, poor weight gain…" value="${esc(p?.complaint)}" aria-label="Main complaint">
      <datalist id="complaints">${COMPLAINTS.map((f) => `<option value="${esc(f)}">`).join("")}</datalist>
    </section>
    <section class="card stack"><h2>Clinical features <small class="muted">(optional)</small></h2>
      <div id="chips" class="chipgroups">${Object.entries(FEATURE_GROUPS).map(([g, list]) => `<details${g === "General" || g === "Growth & nutrition" ? " open" : ""}><summary>${esc(g)}</summary><div class="chips">${list.map((f) => `<button type="button" class="chip" data-f="${esc(f)}">${esc(f)}</button>`).join("")}</div></details>`).join("")}</div>
      <textarea id="features" rows="4" placeholder="History and examination findings, e.g. vital signs, systemic examination, pubertal stage (Tanner)…" aria-label="Clinical features">${esc(p?.features)}</textarea>
      <p class="hint">Tap a chip to add it to the text; edit freely.</p>
    </section>
    <section class="card stack"><h2>Notes <small class="muted">(optional)</small></h2><textarea id="notes" rows="3" aria-label="Notes">${esc(p?.notes)}</textarea></section>
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
  // estimated date of birth when the real one is unknown
  const ageParts = () => ({ y: parseInt($("ay").value) || 0, m: parseInt($("am").value) || 0, d: parseInt($("ad").value) || 0, on: $("aon").value });
  const dobValue = () => {
    if (!$("dobunk").checked) return $("dob").value;
    const a = ageParts();
    return a.on && (a.y || a.m || a.d || $("ay").value.trim() !== "") ? G.dobFromAge(a.on, a.y, a.m, a.d) : "";
  };
  const update = () => {
    $("dobwrap").hidden = $("dobunk").checked; $("agewrap").hidden = !$("dobunk").checked;
    if ($("dobunk").checked && isNew && !$("aon").dataset.touched) $("aon").value = $("mdate").value || G.todayIso();
    const dob = dobValue();
    $("agenow").textContent = dob && dob <= G.todayIso() ? "Age today: " + G.exactAge(dob, G.todayIso()).text : "";
    if (isNew) {
      const d = $("mdate").value;
      $("mage").textContent = dob && d && d >= dob ? `Exact age at measurement: ${G.exactAge(dob, d).text} (${G.exactAge(dob, d).yearsDec.toFixed(3)} years)` : "";
    }
    $("manwrap").hidden = !$("man").checked;
    const v = calcMph();
    $("mphout").textContent = v ? `MPH ${G.fmtNum(v)} cm · target range ${G.fmtNum(v - 8.5)}–${G.fmtNum(v + 8.5)} cm` : "";
    const dup = session.byFileNumber($("file").value);
    $("dup").innerHTML = dup && dup.id !== id ? `<div class="note">File ${esc(dup.fileNumber)} already belongs to <b>${esc(pname(dup))}</b> (DOB ${G.fmtDate(dup.dob)}). <a href="#p/${dup.id}">Open this patient</a></div>` : "";
  };
  $("aon").addEventListener("input", () => { $("aon").dataset.touched = "1"; });
  $app.querySelector("form").addEventListener("input", update); $("dobunk").addEventListener("change", update); update();
  $("chips").querySelectorAll(".chip").forEach((c) => c.onclick = () => {
    const t = $("features"), f = c.dataset.f;
    if (!t.value.toLowerCase().includes(f.toLowerCase())) t.value = t.value.trim() ? `${t.value.trim()}\n${f}` : f;
    c.classList.add("on"); t.focus();
  });

  $("f").onsubmit = async (e) => {
    e.preventDefault();
    const errs = {}, today = G.todayIso(), dob = dobValue();
    if (!sexVal()) errs.sex = "Select sex";
    if ($("dobunk").checked) {
      const a = ageParts();
      if (!$("ay").value.trim() && !$("am").value.trim() && !$("ad").value.trim()) errs.age = "Enter the age (years and/or months)";
      else if (a.y > 20 || a.m > 11 || a.d > 31 || a.y < 0 || a.m < 0 || a.d < 0) errs.age = "Years 0–20, months 0–11, days 0–31";
      else if (!a.on) errs.age = "Enter the date the age refers to";
    } else if (!dob) errs.dob = "Required"; else if (dob > today) errs.dob = "In the future";
    for (const [k, lo, hi] of [["fa", 120, 230], ["mo", 110, 220]]) { const r = rangeErr($(k).value, lo, hi, "cm"); if (r) errs[k] = r; }
    { const r = rangeErr($("gaw").value, 22, 44, "weeks") || rangeErr($("gad").value, 0, 6, "days") || rangeErr($("bw").value, 0.3, 6.5, "kg"); if (r) errs.ga = r; }
    if ($("cond").value === "turner" && sexVal() === "M") errs.cond = "Turner syndrome charts are for girls";
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
      dobEstimated: $("dobunk").checked, ageEntered: $("dobunk").checked ? ageParts() : null,
      father: num($("fa").value), mother: num($("mo").value), mph: calcMph(), mphManual: $("man").checked, notes: $("notes").value.trim(),
      complaint: $("complaint").value.trim(), features: $("features").value.trim(),
      gaWeeks: num($("gaw").value), gaDays: $("gaw").value.trim() ? num($("gad").value) || 0 : null, birthWeight: num($("bw").value),
      condition: $("cond").value || null, diagnoses: $("dx").value.trim(),
    });
    if (isNew && hasM) await session.saveMeasurement({ patientId: pid, date: $("mdate").value, height: num($("h").value), weight: num($("w").value), notes: "" });
    toast("Saved");
    if (isNew) location.replace(`#p/${pid}`); else history.back();
  };
}

// ------------------------------------------------------------ patient record
const SOAP = [["subj", "S"], ["obj", "O"], ["assess", "A"], ["plan", "P"]];

function viewPatient(id) {
  const p = session.patients.get(id); if (!p) return go("#home");
  const ms = session.measurementsFor(id), fam = settings.family;
  const tgt = G.mphTarget(p.sex, p.mph);
  const mphTxt = p.mph ? `${G.fmtNum(p.mph)} cm = ${G.fmtAssess({ p: tgt.pct })} at 20 y (target ${G.fmtNum(p.mph - 8.5)}–${G.fmtNum(p.mph + 8.5)} cm)${p.mphManual ? ", manual" : ""}` : "not recorded";
  const cell = (m, key, unit, dp) => {
    const v = G.mValue(m, key); if (v == null) return "–";
    const main = esc(G.withPct(dp != null ? G.fmtNum(v, dp) : v, unit, assessFor(p, m, key)));
    const ca = condAssess(p, m, key);
    return main + (ca ? `<small>${COND_SHORT[p.condition]} chart ${G.pctTxt(ca)}%</small>` : "");
  };
  const hasHc = ms.some((m) => m.hc != null), hasBmi = ms.some((m) => m.height && m.weight);
  const ncol = 4 + hasBmi + hasHc;
  const nowA = G.plotAge(p, G.todayIso());
  const alerts = settings.alerts ? C.growthAlerts(p, ms, fam) : [];
  const lw = [...ms].reverse().find((m) => m.weight != null && m.height != null);
  const ws = lw ? C.weightStatus(p, fam, { m: lw, a: G.plotAge(p, lw.date) }) : null;
  const hv = C.heightVelocity(p, ms, fam);
  const bas = ms.filter((m) => m.boneAge != null);
  const dev = C.milestoneSummary(p), vax = p.vaccines || [], overdue = C.overdueVaccines(p);
  const nextDue = vax.filter((v) => v.due && v.due >= G.todayIso()).sort((a, b) => a.due.localeCompare(b.due))[0];
  $app.innerHTML = bar(pname(p), true, `<a class="icon" href="#edit/${id}" aria-label="Edit patient">✎</a><button class="icon" id="del" aria-label="Delete patient">🗑</button>`) + `
  <main class="page">
    ${alerts.length ? `<section class="card alerts"><h2>Growth &amp; clinical alerts (${alerts.length})</h2>
      <ul>${alerts.map((a) => `<li class="${a.level}"><span aria-hidden="true">${lvlIcon[a.level]}</span> ${esc(a.text)}${a.date ? ` <small>${G.fmtDate(a.date)}</small>` : ""}</li>`).join("")}</ul>
      <details><summary>Alert rules</summary><p class="hint">${esc(C.ALERT_NOTE)}</p></details></section>` : ""}
    <section class="card"><h2>Patient information</h2>
      <dl class="info">
        <dt>Name</dt><dd>${esc(p.name || "–")}</dd><dt>Sex</dt><dd>${p.sex === "F" ? "Female" : "Male"}</dd>
        <dt>File number</dt><dd>${esc(p.fileNumber)}</dd><dt>Date of birth</dt><dd>${esc(G.fmtDob(p))}</dd>
        <dt>Current age</dt><dd>${G.exactAge(p.dob, G.todayIso()).text}${nowA.corrected ? `<br><small>Corrected for prematurity: ${nowA.text}</small>` : ""}</dd>
        ${p.gaWeeks ? `<dt>Gestational age</dt><dd>${p.gaWeeks}+${p.gaDays || 0} weeks${p.gaWeeks < 37 ? " (preterm)" : ""}</dd>` : ""}
        ${p.birthWeight ? `<dt>Birth weight</dt><dd>${p.birthWeight} kg${p.birthWeight < 1.5 ? " (VLBW)" : p.birthWeight < 2.5 ? " (LBW)" : ""}</dd>` : ""}
        ${p.condition ? `<dt>Condition</dt><dd>${esc(G.CONDITIONS[p.condition] || p.condition)}</dd>` : ""}
        ${p.diagnoses ? `<dt>Other diagnoses</dt><dd>${esc(p.diagnoses)}</dd>` : ""}
        ${p.father ? `<dt>Father's height</dt><dd>${p.father} cm</dd>` : ""}${p.mother ? `<dt>Mother's height</dt><dd>${p.mother} cm</dd>` : ""}
        <dt>Mid-parental height</dt><dd>${mphTxt}</dd>
        ${ws ? `<dt>Weight status</dt><dd>${esc(ws.text)}<br><small class="muted">${G.fmtDate(lw.date)} · ${esc(ws.basis)}</small></dd>` : ""}
        ${p.complaint ? `<dt>Main complaint</dt><dd>${esc(p.complaint)}</dd>` : ""}
        ${p.features ? `<dt>Clinical features</dt><dd class="pre">${esc(p.features)}</dd>` : ""}
        ${p.notes ? `<dt>Notes</dt><dd class="pre">${esc(p.notes)}</dd>` : ""}
      </dl>
    </section>
    <div class="btnrow">
      <a class="primary" href="#m/${id}">+ Add visit / measurement</a>
      <a class="tonal" href="#chart/${id}/height">Height</a>
      <a class="tonal" href="#chart/${id}/weight">Weight</a>
      <a class="tonal" href="#chart/${id}/bmi">BMI</a>
      <a class="tonal" href="#chart/${id}/hc">Head circ.</a>
      <a class="tonal" href="#chart/${id}/wfl">Wt-for-length</a>
      <a class="tonal" href="#inv/${id}">+ Investigation</a>
      <a class="tonal" href="#dev/${id}">Development</a>
      <a class="tonal" href="#vax/${id}">Vaccinations</a>
      <a class="tonal" href="#letter/${id}">Letter</a>
      <button class="ghost" id="pdf">Export PDF</button>
    </div>
    <section class="card"><h2>Visits &amp; measurements (${ms.length})</h2>
      ${ms.length ? `<p class="hint">Percentiles in brackets: ${G.FAMILIES[fam]}${ms.some((m) => G.plotAge(p, m.date).corrected) ? "; ages marked “corrected” are used for preterm plotting" : ""}. Tap a row to edit.</p>
      <div class="scrollx"><table class="mt"><thead><tr><th>Date</th><th>Age</th><th>Height</th><th>Weight</th>${hasBmi ? "<th>BMI</th>" : ""}${hasHc ? "<th>Head circ.</th>" : ""}</tr></thead><tbody>
      ${[...ms].reverse().map((m) => {
        const det = C.visitDetails(p, m), soap = SOAP.filter(([k]) => m[k]).map(([k, l]) => `<b>${l}:</b> ${esc(m[k])}`);
        const extra = [...det.map(esc), ...soap, m.notes ? esc(m.notes) : ""].filter(Boolean);
        return `<tr data-m="${m.id}"><td>${G.fmtDate(m.date)}</td><td>${esc(G.ageLabel(p, m.date))}</td><td>${cell(m, "height", "cm")}</td><td>${cell(m, "weight", "kg")}</td>${hasBmi ? `<td>${cell(m, "bmi", "kg/m²", 1)}</td>` : ""}${hasHc ? `<td>${cell(m, "hc", "cm")}</td>` : ""}</tr>${extra.length ? `<tr class="nt" data-m="${m.id}"><td colspan="${ncol}">${extra.join("<br>")}</td></tr>` : ""}`;
      }).join("")}
      </tbody></table></div>` : `<p class="muted">No measurements yet.</p>`}
    </section>
    ${hv.length ? `<section class="card"><h2>Height velocity</h2>
      <div class="scrollx"><table class="mt"><thead><tr><th>Interval</th><th>Velocity</th><th>Same-percentile velocity</th><th></th></tr></thead><tbody>
      ${[...hv].reverse().map((r) => `<tr><td>${G.fmtDate(r.from)} → ${G.fmtDate(r.to)}<small>${G.fmtNum(r.dt, 2)} y</small></td><td><b>${G.fmtNum(r.hv)} cm/y</b></td><td>${r.expected != null ? G.fmtNum(r.expected) + " cm/y" : "–"}</td><td>${r.low ? `<span class="flag">Low (&lt; ${r.thr})</span>` : ""}</td></tr>`).join("")}
      </tbody></table></div><p class="hint">${esc(C.HV_NOTE)}</p></section>` : ""}
    ${bas.length ? `<section class="card"><h2>Bone age</h2>
      <div class="scrollx"><table class="mt"><thead><tr><th>Date</th><th>Chronological</th><th>Bone age</th><th>BA − CA</th><th>Projected adult height</th></tr></thead><tbody>
      ${[...bas].reverse().map((m) => { const ca = G.exactAge(p.dob, m.date).yearsDec, d = m.boneAge - ca, pr = C.projectedAdultHeight(p, m);
        return `<tr><td>${G.fmtDate(m.date)}</td><td>${G.fmtNum(ca)} y</td><td>${m.boneAge} y${m.boneAgeMethod ? `<small>${esc(m.boneAgeMethod)}</small>` : ""}</td><td class="${Math.abs(d) >= 2 ? "flag" : ""}">${d >= 0 ? "+" : ""}${G.fmtNum(d)} y</td><td>${pr ? `≈ ${G.fmtNum(pr.cm)} cm${p.mph ? `<small>MPH target ${G.fmtNum(p.mph - 8.5)}–${G.fmtNum(p.mph + 8.5)} cm</small>` : ""}` : "–"}</td></tr>`; }).join("")}
      </tbody></table></div><p class="hint">${esc(C.PAH_NOTE)} On the height chart the bone age is shown as a blue circle (BA) linked to the red ×.</p></section>` : ""}
    <section class="card"><div class="row"><h2 class="grow">Development</h2><a class="tonal small" href="#dev/${id}">Milestones</a></div>
      <p class="hint">${dev.yes || dev.missed || dev.lost ? `${dev.yes} achieved · ${dev.missed} not yet at expected age · ${dev.lost} lost` : "No milestones recorded."}${p.devNotes ? `<br>${esc(p.devNotes)}` : ""}</p></section>
    <section class="card"><div class="row"><h2 class="grow">Vaccinations (${vax.length})</h2><a class="tonal small" href="#vax/${id}">Open</a></div>
      <p class="hint">${overdue.length ? `<span class="flag">Overdue: ${overdue.map((v) => esc(`${v.name} ${v.dose || ""}`.trim())).join(", ")}</span><br>` : ""}${nextDue ? `Next due: ${esc(nextDue.name)} on ${G.fmtDate(nextDue.due)}` : vax.length ? "No upcoming due date recorded." : "No vaccinations recorded."}</p></section>
    ${investigationsSection(p)}
  </main>`;
  bindBack();
  $app.querySelectorAll("tr[data-m]").forEach((tr) => tr.onclick = () => go(`#m/${id}/${tr.dataset.m}`));
  bindInvestigationsSection();
  document.getElementById("del").onclick = () => confirmBox(`Delete ${pname(p)}?`, `The patient, all ${ms.length} visits and all investigations will be permanently deleted${sync?.enabled ? " on all synced devices" : " from this device"}. This cannot be undone.`, "Delete", async () => {
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

// ------------------------------------------------------------ visit / measurement form
// Number fields of a visit: [id, record field, min, max, unit]. Every field is optional; at least one must be filled.
const VISIT_NUM = [["h", "height", 30, 230, "cm"], ["w", "weight", 0.3, 250, "kg"], ["hc", "hc", 20, 70, "cm"],
  ["bps", "bpSys", 50, 250, "mmHg"], ["bpd", "bpDia", 20, 160, "mmHg"], ["ba", "boneAge", 0, 20, "years"],
  ["tv", "testisVol", 1, 30, "mL"], ["ls", "lowerSeg", 10, 120, "cm"], ["span", "armSpan", 30, 240, "cm"]];
const VISIT_TXT = [["subj", "subj"], ["obj", "obj"], ["assess", "assess"], ["plan", "plan"], ["n", "notes"]];

function viewMeasure(pid, mid) {
  const p = session.patients.get(pid); if (!p) return go("#home");
  const m = mid ? session.measurements.get(mid) : null;
  const v = (k) => esc(m?.[k] ?? "");
  const open = (...ks) => ks.some((k) => m?.[k] != null && m?.[k] !== "") ? " open" : "";
  const sel = (id, val, label) => `<label>${label}<select id="${id}"><option value="">–</option>${[1, 2, 3, 4, 5].map((i) => `<option ${String(val) === String(i) ? "selected" : ""}>${i}</option>`).join("")}</select></label>`;
  $app.innerHTML = bar(m ? "Edit Visit" : "Add Visit / Measurement", true, m ? `<button class="icon" id="del" aria-label="Delete visit">🗑</button>` : "") + `
  <main class="page"><form id="f" class="stack" novalidate>
    <section class="card"><h2>${esc(pname(p))}</h2><p class="muted">File ${esc(p.fileNumber)} · ${p.sex === "F" ? "Female" : "Male"} · DOB ${esc(G.fmtDob(p, false))}</p></section>
    <section class="card stack"><h2>Measurements</h2>
      <label>Visit date<input id="d" type="date" min="${p.dob}" max="${G.todayIso()}" value="${m?.date || G.todayIso()}"><small class="e" data-for="d"></small></label>
      <p class="hi" id="age"></p>
      <div class="two"><label>Height / length (cm)<input id="h" inputmode="decimal" value="${v("height")}"><small class="e" data-for="h"></small></label>
      <label>Weight (kg)<input id="w" inputmode="decimal" value="${v("weight")}"><small class="e" data-for="w"></small></label></div>
      <label>Head circumference (cm) <small class="muted">optional</small><input id="hc" inputmode="decimal" value="${v("hc")}"><small class="e" data-for="hc"></small></label>
      <small class="e" data-for="any"></small>
      <div id="prev" class="hint"></div>
    </section>
    <details class="card opt"${open("bpSys", "bpDia")}><summary>Blood pressure <small class="muted">(optional)</small></summary><div class="stack">
      <div class="two"><label>Systolic (mmHg)<input id="bps" inputmode="numeric" value="${v("bpSys")}"><small class="e" data-for="bps"></small></label>
      <label>Diastolic (mmHg)<input id="bpd" inputmode="numeric" value="${v("bpDia")}"><small class="e" data-for="bpd"></small></label></div>
      <p class="hi" id="bpout"></p><p class="hint">${esc(C.BP_NOTE)}</p></div></details>
    <details class="card opt"${open("tanB", "tanPH", "testisVol", "menarche")}><summary>Puberty – Tanner stage <small class="muted">(optional)</small></summary><div class="stack">
      <div class="two">${sel("tanB", m?.tanB, p.sex === "F" ? "Breast (B)" : "Genitalia (G)")}${sel("tanPH", m?.tanPH, "Pubic hair (PH)")}</div>
      ${p.sex === "M" ? `<label>Testicular volume (mL, orchidometer)<input id="tv" inputmode="decimal" value="${v("testisVol")}"><small class="e" data-for="tv"></small></label>`
        : `<label class="switch"><input type="checkbox" id="men" ${m?.menarche ? "checked" : ""}> Menarche has occurred</label>`}
      <p class="hi" id="pubout"></p></div></details>
    <details class="card opt"${open("boneAge")}><summary>Bone age <small class="muted">(optional)</small></summary><div class="stack">
      <div class="two"><label>Bone age (years)<input id="ba" inputmode="decimal" value="${v("boneAge")}"><small class="e" data-for="ba"></small></label>
      <label>Method<select id="bam">${["", "Greulich–Pyle", "TW3", "BoneXpert", "Other"].map((o) => `<option ${m?.boneAgeMethod === o ? "selected" : ""}>${o}</option>`).join("")}</select></label></div>
      <p class="hi" id="baout"></p><p class="hint">${esc(C.PAH_NOTE)}</p></div></details>
    <details class="card opt"${open("lowerSeg", "armSpan")}><summary>Body proportions <small class="muted">(optional)</small></summary><div class="stack">
      <div class="two"><label>Lower segment (cm, symphysis pubis to floor)<input id="ls" inputmode="decimal" value="${v("lowerSeg")}"><small class="e" data-for="ls"></small></label>
      <label>Arm span (cm)<input id="span" inputmode="decimal" value="${v("armSpan")}"><small class="e" data-for="span"></small></label></div>
      <p class="hi" id="propout"></p>
      <p class="hint">Upper segment = height − lower segment. Typical US/LS ratio ≈ 1.7 at birth, ≈ 1.3 at 3 years and ≈ 1.0 from about 7–10 years (slightly below 1 in adults). Arm span is close to height in childhood.</p></div></details>
    <details class="card opt"${open("subj", "obj", "assess", "plan", "notes")}><summary>Visit notes (SOAP) <small class="muted">(optional)</small></summary><div class="stack">
      <label>Subjective – history / complaint at this visit<textarea id="subj" rows="2">${v("subj")}</textarea></label>
      <label>Objective – examination findings<textarea id="obj" rows="2">${v("obj")}</textarea></label>
      <label>Assessment<textarea id="assess" rows="2">${v("assess")}</textarea></label>
      <label>Plan<textarea id="plan" rows="2">${v("plan")}</textarea></label>
      <label>Other notes<input id="n" value="${v("notes")}"></label></div></details>
    <button class="primary" value="save">Save visit</button>
    <button class="ghost" type="button" id="savechart">Save and view chart</button>
  </form></main>`;
  bindBack();
  const $ = (i) => document.getElementById(i);
  const val = (i) => $(i) ? num($(i).value) : null;
  const rec = () => ({ height: val("h"), weight: val("w"), hc: val("hc") });
  const update = () => {
    const d = $("d").value;
    if (!d || d < p.dob) { $("age").textContent = ""; $("prev").textContent = ""; return; }
    const a = G.exactAge(p.dob, d), pa = G.plotAge(p, d);
    $("age").textContent = `Exact age: ${a.text} · ${a.days} days · ${a.yearsDec.toFixed(3)} years${pa.corrected ? ` · corrected ${pa.days < 0 ? "before term" : pa.text}` : ""}`;
    const r = rec(), lines = [];
    for (const key of ["height", "weight", "bmi", "hc", "wfl"]) {
      if (G.mValue(r, key) == null) continue;
      const id = pa.days >= 0 ? G.refForKey(settings.family, key, pa.months) : null;
      const as = id && G.assessKey(id, key, p.sex, pa.months, r);
      const ci = p.condition && pa.days >= 0 ? G.condRefFor(p.condition, key, pa.months) : null, ca = ci && G.assessKey(ci, key, p.sex, pa.months, r);
      if (!as && !ca) continue;
      const ref = G.getRef(id || ci);
      const vtxt = key === "bmi" ? ` ${G.fmtNum(G.mValue(r, "bmi"))} kg/m²` : "";
      lines.push(`${esc(ref.measures[key].label)}${vtxt}: ${as ? `${G.fmtAssess(as)}${as.ext ? ` (${G.fmtNum(as.pctOfP95, 0)}% of P95)` : ""} · ${esc(ref.shortTitle)}` : ""}${ca ? `${as ? " · " : ""}${G.fmtAssess(ca)} on ${esc(G.getRef(ci).shortTitle)}` : ""}`);
    }
    if (r.height && r.weight && pa.days >= 0) { const w = C.weightStatus(p, settings.family, { m: r, a: pa }); if (w) lines.push(`<b>${esc(w.text)}</b>`); }
    $("prev").innerHTML = lines.join("<br>");
    const bp = C.classifyBp(p.sex, a.yearsDec, val("bps"), val("bpd")); $("bpout").textContent = bp ? bp.text : "";
    const tn = { tanB: $("tanB").value, testisVol: val("tv") }, pf = C.pubertyFlag(p, a.yearsDec, tn);
    $("pubout").textContent = pf ? pf.text : "";
    const ba = val("ba");
    if (ba != null) { const pr = C.projectedAdultHeight(p, { boneAge: ba, height: r.height }); $("baout").textContent = `BA − CA = ${ba - a.yearsDec >= 0 ? "+" : ""}${G.fmtNum(ba - a.yearsDec)} years${pr ? ` · approximate adult height ≈ ${G.fmtNum(pr.cm)} cm` : ""}${pr && p.mph ? ` (MPH ${G.fmtNum(p.mph)} cm)` : ""}`; }
    else $("baout").textContent = "";
    const ls = val("ls"), sp = val("span"), pr = [];
    if (ls && r.height) pr.push(`Upper segment ${G.fmtNum(r.height - ls)} cm · US/LS ratio ${G.fmtNum((r.height - ls) / ls, 2)}`);
    if (sp && r.height) pr.push(`Arm span − height ${sp - r.height >= 0 ? "+" : ""}${G.fmtNum(sp - r.height)} cm`);
    $("propout").textContent = pr.join(" · ");
  };
  $("f").addEventListener("input", update); $("f").addEventListener("change", update); update();
  const save = async (thenChart) => {
    const errs = {}, d = $("d").value;
    if (!d) errs.d = "Required"; else if (d < p.dob) errs.d = "Before date of birth"; else if (d > G.todayIso()) errs.d = "In the future";
    for (const [id, , lo, hi, unit] of VISIT_NUM) if ($(id)) { const r = rangeErr($(id).value, lo, hi, unit); if (r) errs[id] = r; }
    const rec2 = { patientId: pid, date: d };
    for (const [id, k] of VISIT_NUM) rec2[k] = val(id);
    for (const [id, k] of VISIT_TXT) rec2[k] = $(id).value.trim();
    rec2.tanB = $("tanB").value ? +$("tanB").value : null; rec2.tanPH = $("tanPH").value ? +$("tanPH").value : null;
    rec2.menarche = $("men") ? $("men").checked : false; rec2.boneAgeMethod = rec2.boneAge != null ? $("bam").value : "";
    const any = VISIT_NUM.some(([, k]) => rec2[k] != null) || VISIT_TXT.some(([, k]) => rec2[k]) || rec2.tanB || rec2.tanPH || rec2.menarche;
    if (!any) errs.any = "Enter at least one measurement or note";
    $app.querySelectorAll(".e").forEach((el) => { el.textContent = errs[el.dataset.for] || ""; });
    if (Object.keys(errs).length) { $app.querySelector(".e:not(:empty)")?.closest("details")?.setAttribute("open", ""); return; }
    await session.saveMeasurement({ id: m?.id, ...rec2 });
    toast("Visit saved");
    if (thenChart) location.replace(`#chart/${pid}/${rec2.height != null ? "height" : rec2.weight != null ? "weight" : rec2.hc != null ? "hc" : "height"}`); else history.back();
  };
  $("f").onsubmit = (e) => { e.preventDefault(); save(false); };
  $("savechart").onclick = () => save(true);
  $("del")?.addEventListener("click", () => confirmBox("Delete this visit?", `${G.fmtDate(m.date)}: this cannot be undone.`, "Delete", async () => {
    await session.deleteMeasurement(m.id); toast("Deleted"); history.back();
  }, true));
}

// ------------------------------------------------------------ chart

// Chart views: original CDC Set 2 sheets ("sheet:0_36", "sheet:2_20", height and weight together)
// or computed charts (reference ids; one measure at a time).
const VIEW_TITLES = {
  "sheet:0_36": "CDC birth–36 months (original)",
  "sheet:2_20": "CDC 2–20 years (original)",
  who2006_0_2: "WHO Birth–24 months", who2006: "WHO Birth–5 years", who2007: "WHO 5–19 years",
  cdc2000_bmi: "CDC BMI 2–20 years (+ extended BMI)", who2006_bmi: "WHO BMI birth–5 years", who2007_bmi: "WHO BMI 5–19 years",
  cdc2000_hc: "CDC head circumference 0–36 months", who2006_hc: "WHO head circumference 0–5 years",
  cdc2000_wfl: "CDC weight-for-length", who2006_wfl: "WHO weight-for-length 0–2 years", who2006_wfh: "WHO weight-for-height 2–5 years",
  ds_infant: "Down syndrome 0–36 months", ds_child: "Down syndrome 2–20 years", turner: "Turner syndrome height 1–20 years",
};
const viewForAge = (ageMonths) => sheetViewForAge(settings.family, ageMonths);
/** Views that can show this measure for this patient. */
function viewsFor(p, key) {
  return Object.keys(VIEW_TITLES).filter((v) => {
    if (v.startsWith("sheet:")) return key === "height" || key === "weight";
    const r = G.getRef(v), m = r?.measures[key]; if (!m) return false;
    if (r.condition) return r.condition === p.condition && m[p.sex === "F" ? "female" : "male"].length > 0;
    return true;
  });
}
/** Chart chosen automatically: condition chart if one covers the age, else the family's chart for this measure and age. */
function autoViewFor(p, ms, key) {
  const withV = ms.filter((x) => G.mValue(x, key) != null);
  const last = withV[withV.length - 1] || ms[ms.length - 1];
  const age = Math.max(0, G.plotAge(p, last ? last.date : G.todayIso()).months);
  if (p.condition) { const c = G.condRefFor(p.condition, key, age); if (c) return c; }
  if (key === "height" || key === "weight") return viewForAge(age);
  return G.refForKey(settings.family, key, age) || viewsFor(p, key).find((v) => !G.getRef(v).condition) || "cdc2000_bmi";
}

async function viewChart(pid, key) {
  const p = session.patients.get(pid); if (!p) return go("#home");
  if (!G.MEASURES[key]) key = "height";
  await loadSheets();
  const ms = session.measurementsFor(pid);
  let manual = null, view = autoViewFor(p, ms, key);
  let connect = settings.connect, sel = null, data, bounds, vp, geo, sheet, img, sgeo;
  const isSheet = () => view.startsWith("sheet:");

  $app.innerHTML = bar(`${pname(p)} · growth chart`, true, `<a class="icon" href="#m/${pid}" aria-label="Add measurement">＋</a>`) + `
  <main class="chartpage">
    <div class="ctl">
      <div class="tabs5" role="tablist" id="tabs">${Object.entries(G.MEASURES).map(([k, t]) => `<button data-k="${k}">${esc(t)}</button>`).join("")}</div>
      <div class="row wrap">
        <select id="ref" aria-label="Growth chart"></select>
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
  const fillSelect = () => {
    const auto = autoViewFor(p, ms, key);
    document.getElementById("ref").innerHTML = `<option value="auto">Auto: ${esc(VIEW_TITLES[auto])}</option>` + viewsFor(p, key).map((k) => `<option value="${k}">${esc(VIEW_TITLES[k])}</option>`).join("");
    document.getElementById("ref").value = manual || "auto";
  };

  const rebuild = async (resetVp) => {
    fillSelect();
    let outside, coverTxt;
    if (isSheet()) {
      sheet = sheetFor(view.slice(6), p.sex); img = await sheetImage(sheet);
      data = { p, ...sheetPoints(sheet, p, ms), connect, sel };
      bounds = { x0: 0, y0: 0, x1: sheet.page[0], y1: sheet.page[1] };
      outside = data.outside; coverTxt = sheet.ageMax <= 36 ? "birth–36 months" : "2–20 years";
    } else {
      data = buildChart(p, ms, view, key, connect, sel);
      bounds = fullBounds(data.m, p.sex, data.points.map((q) => q.v));
      outside = data.outside;
      coverTxt = data.m.xKind === "length" ? `${G.fmtNum(data.m.ageMin)}–${G.fmtNum(data.m.ageMax)} cm, ages ${G.fmtNum(data.m.ageFrom)}–${G.fmtNum(data.m.ageTo)} months` : `${G.fmtNum(data.m.ageMin / 12)}–${G.fmtNum(data.m.ageMax / 12)} y`;
    }
    if (resetVp || !vp) vp = { ...bounds };
    $app.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === key));
    const out = document.getElementById("out");
    const none = !ms.some((x) => G.mValue(x, key) != null);
    out.hidden = !outside && !none;
    const other = outside ? [...new Set(ms.filter((x) => G.mValue(x, key) != null).map((x) => {
      const age = G.plotAge(p, x.date).months;
      return (p.condition && G.condRefFor(p.condition, key, age)) || (key === "height" || key === "weight" ? viewForAge(age) : G.refForKey(settings.family, key, age));
    }))].find((v) => v && v !== view) : null;
    out.innerHTML = none ? `No ${esc(G.MEASURES[key].toLowerCase())} data recorded yet${key === "wfl" || key === "bmi" ? " (needs height and weight at the same visit)" : ""}.`
      : `${outside} measurement(s) are not on this chart (it covers ${coverTxt}).` + (other ? ` <button class="link" id="other">Show ${esc(VIEW_TITLES[other])}</button>` : "");
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
    const a = G.assess(m, p.sex, q.age, q.v);
    const where = m.xKind === "length" ? `Length/height ${q.age} cm · age ${q.ageText}` : `Age ${q.ageText} (${(q.age / 12).toFixed(3)} y)`;
    pop.innerHTML = `<div><b>${q.latest ? "Latest measurement · " : ""}${G.fmtDate(q.date)}</b><br>${esc(where)}<br>
      <b>${esc(label)}: ${k === "bmi" ? G.fmtNum(q.v) : q.v} ${m.unit} · ${G.fmtAssess(a)}${a?.ext ? ` (${G.fmtNum(a.pctOfP95, 0)}% of P95)` : ""}</b><br><small>${esc(isSheet() ? sheet.title : G.getRef(refId).title)}</small>${q.notes ? `<br><small>${esc(q.notes)}</small>` : ""}</div>
      <button class="icon" id="px" aria-label="Close">✕</button>`;
    document.getElementById("px").onclick = () => { sel = null; draw(); showPop(); };
  };
  showPop();

  $app.querySelectorAll("#tabs button").forEach((b) => b.onclick = () => {
    key = b.dataset.k; sel = null; showPop(); history.replaceState(null, "", `#chart/${pid}/${key}`);
    if (!manual || !viewsFor(p, key).includes(manual)) { manual = null; view = autoViewFor(p, ms, key); }
    rebuild(true);
  });
  document.getElementById("ref").onchange = (e) => { manual = e.target.value === "auto" ? null : e.target.value; view = manual || autoViewFor(p, ms, key); sel = null; showPop(); rebuild(true); };
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
    <section class="card stack"><h2>Clinical tools</h2>
      <label class="switch"><input type="checkbox" id="sal" ${settings.alerts ? "checked" : ""}> Show growth &amp; clinical alerts on the patient record</label>
      <label class="switch"><input type="checkbox" id="scor" ${settings.corr ? "checked" : ""}> Correct age for prematurity (&lt; 37 weeks) until 24 months</label>
      <p class="hint">${esc(C.ALERT_NOTE)}</p></section>
    <section class="card stack" id="synccard"><h2>Sync between phone and computer</h2><div id="syncbody"></div></section>
    <section class="card stack"><h2>Storage on this device</h2>
      <p class="hint">Records are encrypted (AES-256) with a key kept by this browser and stored on this device only. Clearing the browser's site data or uninstalling the app deletes them, so make regular backups. To use the same records on another device, restore a backup there.</p>
      <p class="hint" id="pers"></p></section>
    <section class="card stack"><h2>Original CDC growth charts</h2>
      <p class="hint">${esc(sheetMeta()?.source || "")}</p><p class="hint">${esc(sheetMeta()?.calibration || "")}</p></section>
    <section class="card stack"><h2>Growth references (bundled, work offline)</h2>
      ${G.allRefs().map((r) => `<div><b>${esc(r.title)}</b><br><small>Version: ${esc(r.version)} · Percentile curves ${r.centiles.join(", ")}</small><br><small class="muted">Source: ${esc(r.source)}</small></div>`).join("<hr>")}
      <p class="hint">Curves are generated from the official LMS parameters. Each measurement is plotted at the exact age (days ÷ 30.4375 months) with no rounding.</p></section>
    <section class="card stack"><h2>About</h2><p>Pediatric Growth Chart (web app). Clinical decision support only; verify measurements and interpret results in clinical context.</p>${CREDIT}</section>
  </main>`;
  bindBack();
  $app.querySelectorAll('input[name="fam"]').forEach((r) => r.onchange = () => { settings.family = r.value; toast("Saved"); });
  document.getElementById("cl").onchange = (e) => { settings.connect = e.target.checked; };
  document.getElementById("sal").onchange = (e) => { settings.alerts = e.target.checked; };
  document.getElementById("scor").onchange = (e) => { settings.corr = e.target.checked; };
  renderSyncCard();
  navigator.storage?.persisted?.().then((ok) => { document.getElementById("pers").textContent = ok ? "Storage is marked persistent: the browser will not clear it automatically." : "Tip: install the app to the home screen so the browser keeps its storage."; });
}

// ------------------------------------------------------------ investigations
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
  const trends = C.labTrends(list);
  const byCat = {};
  for (const x of list) (byCat[x.category] ||= []).push(x);
  const entry = (x) => `<div class="inv" data-inv="${x.id}">
      <div class="invhead"><b>${G.fmtDate(x.date)}</b><span class="muted">${esc(G.exactAge(p.dob, x.date).short)}</span></div>
      ${(x.results || []).filter((r) => r.test || r.value).map((r) => { const f = C.labFlag(r); return `<div class="invrow"><span>${esc(r.test)}</span><b class="${f ? "flag" : ""}">${esc(r.value)} ${esc(r.unit || "")}${f ? ` ${f === "H" ? "↑ H" : "↓ L"}` : ""}</b>${r.ref ? `<small class="muted">ref ${esc(r.ref)}</small>` : ""}</div>`; }).join("")}
      ${x.notes ? `<p class="hint pre">${esc(x.notes)}</p>` : ""}
      ${(x.photos || []).length ? `<div class="thumbs">${x.photos.map((f) => `<img data-fid="${f.id}" alt="Investigation photo" class="thumb">`).join("")}</div>` : ""}
    </div>`;
  return `<section class="card" id="invsec"><div class="row"><h2 class="grow">Investigations (${list.length})</h2><a class="tonal small" href="#inv/${p.id}">+ Add</a></div>
    ${list.length ? Object.keys(INV_CATS).filter((c) => byCat[c]).concat(Object.keys(byCat).filter((c) => !INV_CATS[c]))
      .map((c) => `<h3 class="invcat">${esc(c)}</h3>${byCat[c].map(entry).join("")}`).join("")
      : `<p class="muted">No investigations yet. Add results as numbers, or take a photo of the report.</p>`}
    ${trends.length ? `<h3 class="invcat">Trends (tests with 2 or more numeric results)</h3><div class="trends">${trends.map((t) => { const l = t.pts[t.pts.length - 1];
      return `<div class="trend"><div><b>${esc(t.test)}</b><small class="muted"> ${esc(t.unit)}</small></div>${C.sparkline(t)}<small>${t.pts.map((q) => `<span class="${q.flag ? "flag" : ""}">${G.fmtDate(q.date).slice(0, 5)}: ${esc(q.raw)}${q.flag ? (q.flag === "H" ? "↑" : "↓") : ""}</span>`).join(" · ")}</small>${l.ref ? `<small class="muted">ref ${esc(l.ref)} (green band)</small>` : ""}</div>`; }).join("")}</div>
      <p class="hint">Results are flagged ↑/↓ when outside the reference range typed with them (e.g. “3.5-5.1”, “&lt;5”).</p>` : ""}
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
    <section class="card"><h2>${esc(pname(p))}</h2><p class="muted">File ${esc(p.fileNumber)} · DOB ${esc(G.fmtDob(p, false))}</p></section>
    <section class="card stack">
      <div class="two">
        <label>Date<input id="d" type="date" min="${p.dob}" max="${G.todayIso()}" value="${x?.date || G.todayIso()}"></label>
        <label>Section<select id="cat">${Object.keys(INV_CATS).concat(x?.category && !INV_CATS[x.category] ? [x.category] : []).map((c) => `<option ${c === (x?.category || "Hematology") ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
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
  const fillTests = () => { $("tests").innerHTML = (INV_CATS[$("cat").value] || []).map(([t]) => `<option value="${esc(t)}">`).join(""); };
  const renderRows = () => {
    $("rows").innerHTML = rows.map((r, i) => `<div class="resrow" data-i="${i}">
      <input placeholder="Test" list="tests" data-f="test" value="${esc(r.test)}" aria-label="Test">
      <input placeholder="Result" data-f="value" value="${esc(r.value)}" aria-label="Result">
      <input placeholder="Unit" data-f="unit" value="${esc(r.unit)}" aria-label="Unit">
      <input placeholder="Reference range" data-f="ref" value="${esc(r.ref)}" aria-label="Reference range">
      <button type="button" class="icon rm" aria-label="Remove row">✕</button></div>`).join("");
    $("rows").querySelectorAll(".resrow").forEach((el) => {
      const i = +el.dataset.i;
      el.querySelectorAll("input").forEach((inp) => inp.oninput = () => {
        rows[i][inp.dataset.f] = inp.value;
        if (inp.dataset.f === "test") { // pre-fill the usual unit for a known test if the unit is still empty
          const u = unitFor(inp.value), ub = el.querySelector('[data-f="unit"]');
          if (u && !ub.value) { ub.value = u; rows[i].unit = u; }
        }
      });
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

// ------------------------------------------------------------ developmental milestones
function viewMilestones(pid) {
  const p = session.patients.get(pid); if (!p) return go("#home");
  const st = { ...(p.milestones || {}) };
  const age = Math.max(0, G.plotAge(p, G.todayIso()).months);
  const bands = Object.keys(C.MILESTONES).map(Number);
  const current = bands.filter((b) => b <= age + 0.01).pop();
  const next = bands.find((b) => b > age + 0.01);
  $app.innerHTML = bar(`${pname(p)} · development`, true) + `
  <main class="page">
    <section class="card"><p>Age ${esc(G.ageLabel(p, G.todayIso()))}. Mark each milestone as achieved, not yet, or lost. Only milestones for the child's age and younger count as “not yet at expected age”.</p>
      <p class="hint">${esc(C.MILESTONE_SOURCE)}</p>
      <p class="hint">Red flag at any age: loss of skills the child once had.</p></section>
    ${bands.map((b) => { const list = C.MILESTONES[b], due = b <= age + 0.01;
      return `<details class="card opt"${b === current || b === next ? " open" : ""}><summary>${esc(C.ageBandLabel(b))}${b === current ? " · current" : b === next ? " · next" : ""} <small class="muted">${list.filter((_, i) => st[C.msId(b, i)]?.s === "yes").length}/${list.length}</small></summary>
        ${Object.entries(C.DOMAINS).map(([d, dn]) => { const items = list.map((t, i) => [t, i]).filter(([t]) => t[0] === d); if (!items.length) return "";
          return `<h3 class="invcat">${esc(dn)}</h3>${items.map(([t, i]) => { const idd = C.msId(b, i), s = st[idd]?.s || "";
            return `<div class="ms ${s === "no" && due ? "late" : ""} ${s}"><span>${esc(t.slice(2))}</span><div class="msb" data-id="${idd}">${[["yes", "✓ Yes"], ["no", "Not yet"], ["lost", "Lost"]].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${s === v}">${l}</button>`).join("")}</div></div>`; }).join("")}`; }).join("")}
      </details>`; }).join("")}
    <section class="card stack"><h2>Developmental notes / screening results</h2>
      <textarea id="dn" rows="3" placeholder="e.g. ASQ-3 at 18 m: communication below cut-off; M-CHAT-R/F low risk…">${esc(p.devNotes)}</textarea>
      <button class="primary" id="savedn">Save notes</button></section>
  </main>`;
  bindBack();
  const persist = async () => { await session.savePatient({ ...session.patients.get(pid), milestones: st, devNotes: document.getElementById("dn").value.trim() }); };
  $app.querySelectorAll(".msb").forEach((g) => g.querySelectorAll("button").forEach((btn) => btn.onclick = async () => {
    const id = g.dataset.id, v = btn.dataset.v;
    if (st[id]?.s === v) delete st[id]; else st[id] = { s: v, date: G.todayIso() };
    g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", st[id]?.s === x.dataset.v));
    const row = g.closest(".ms"); row.className = `ms ${st[id]?.s || ""} ${st[id]?.s === "no" && +id.split(":")[0] <= age + 0.01 ? "late" : ""}`;
    await persist();
  }));
  document.getElementById("savedn").onclick = async () => { await persist(); toast("Saved"); };
}

// ------------------------------------------------------------ vaccinations
function viewVaccines(pid, editIdx = null) {
  const p = session.patients.get(pid); if (!p) return go("#home");
  const list = [...(p.vaccines || [])].sort((a, b) => (b.date || b.due || "").localeCompare(a.date || a.due || ""));
  const e = editIdx != null ? list[editIdx] : null;
  const overdue = new Set(C.overdueVaccines(p));
  $app.innerHTML = bar(`${pname(p)} · vaccinations`, true) + `
  <main class="page">
    <section class="card stack"><h2>${e ? "Edit dose" : "Add a dose"}</h2>
      <div class="two"><label>Vaccine<input id="vn" list="vlist" value="${esc(e?.name)}" placeholder="e.g. MMR"></label>
      <label>Dose<input id="vd" value="${esc(e?.dose)}" placeholder="e.g. 1, 2, booster"></label></div>
      <datalist id="vlist">${C.VACCINES.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>
      <div class="two"><label>Date given<input id="vg" type="date" max="${G.todayIso()}" value="${esc(e?.date)}"></label>
      <label>Next dose due<input id="vu" type="date" value="${esc(e?.due)}"></label></div>
      <label>Batch / notes<input id="vo" value="${esc(e?.notes)}"></label>
      <small class="e" id="ve"></small>
      <div class="row wrap"><button class="primary" id="vsave">${e ? "Save changes" : "Add dose"}</button>${e ? `<button class="ghost" id="vcancel">Cancel</button><button class="danger" id="vdel">Delete</button>` : ""}</div>
      <p class="hint">Record doses according to your national schedule. A dose is flagged overdue when its next-due date has passed and no later dose of the same vaccine is recorded.</p>
    </section>
    <section class="card"><h2>Record (${list.length})</h2>
      ${list.length ? `<div class="scrollx"><table class="mt"><thead><tr><th>Vaccine</th><th>Dose</th><th>Given</th><th>Next due</th></tr></thead><tbody>
      ${list.map((v, i) => `<tr data-i="${i}"><td>${esc(v.name)}${v.notes ? `<small>${esc(v.notes)}</small>` : ""}</td><td>${esc(v.dose)}</td><td>${v.date ? G.fmtDate(v.date) : "–"}</td><td class="${overdue.has(v) ? "flag" : ""}">${v.due ? G.fmtDate(v.due) + (overdue.has(v) ? " · overdue" : "") : "–"}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="muted">No vaccinations recorded.</p>`}
    </section>
  </main>`;
  bindBack();
  const $ = (i) => document.getElementById(i);
  const saveAll = async (arr) => { await session.savePatient({ ...session.patients.get(pid), vaccines: arr }); viewVaccines(pid); };
  $("vsave").onclick = async () => {
    const rec = { name: $("vn").value.trim(), dose: $("vd").value.trim(), date: $("vg").value, due: $("vu").value, notes: $("vo").value.trim() };
    $("ve").textContent = !rec.name ? "Enter the vaccine name." : !rec.date && !rec.due ? "Enter the date given and/or the next due date." : rec.date && rec.date < p.dob ? "Date is before the date of birth." : "";
    if ($("ve").textContent) return;
    const arr = list.filter((v) => v !== e); arr.push(rec); await saveAll(arr); toast("Saved");
  };
  $("vcancel")?.addEventListener("click", () => viewVaccines(pid));
  $("vdel")?.addEventListener("click", () => confirmBox("Delete this dose?", `${e.name} ${e.dose || ""}`, "Delete", () => saveAll(list.filter((v) => v !== e)), true));
  $app.querySelectorAll("tr[data-i]").forEach((tr) => tr.onclick = () => { viewVaccines(pid, +tr.dataset.i); window.scrollTo(0, 0); });
}

// ------------------------------------------------------------ letters
function letterDraft(p, type, reason, to) {
  const ms = session.measurementsFor(p.id), fam = settings.family, L = [];
  const last = (f) => [...ms].reverse().find(f);
  const sexT = p.sex === "F" ? "girl" : "boy";
  const age = G.exactAge(p.dob, G.todayIso());
  L.push(`Dear ${to || "Colleague"},`, "");
  L.push(`Re: ${p.name || "(name not recorded)"}, ${p.sex === "F" ? "female" : "male"}, date of birth ${G.fmtDob(p, false)}, age ${age.text}${p.fileNumber ? `, file ${p.fileNumber}` : ""}`, "");
  L.push(type === "referral" ? `I would be grateful if you could review this ${age.y} year old ${sexT}${reason ? ` regarding ${reason}` : ""}.` : `Thank you for your interest in this ${age.y} year old ${sexT}. Summary of the clinic review${reason ? ` (${reason})` : ""}:`, "");
  if (p.complaint) L.push(`Main complaint: ${p.complaint}`);
  if (p.gaWeeks || p.birthWeight) L.push(`Birth history: ${p.gaWeeks ? `${p.gaWeeks}+${p.gaDays || 0} weeks' gestation` : ""}${p.gaWeeks && p.birthWeight ? ", " : ""}${p.birthWeight ? `birth weight ${p.birthWeight} kg` : ""}.`);
  if (p.condition || p.diagnoses) L.push(`Background: ${[G.CONDITIONS[p.condition], p.diagnoses].filter(Boolean).join("; ")}.`);
  if (p.features) L.push(`Clinical features: ${p.features.replace(/\n+/g, "; ")}.`);
  const lm = last((m) => m.height != null || m.weight != null);
  if (lm) {
    const parts = [["height", "Height", "cm"], ["weight", "Weight", "kg"], ["bmi", "BMI", "kg/m²"], ["hc", "Head circumference", "cm"]]
      .filter(([k]) => G.mValue(lm, k) != null).map(([k, n, u]) => `${n} ${G.withPct(k === "bmi" ? G.fmtNum(G.mValue(lm, k)) : G.mValue(lm, k), u, assessFor(p, lm, k))}`);
    L.push("", `Growth (${G.fmtDate(lm.date)}, age ${G.ageLabel(p, lm.date)}): ${parts.join(", ")}. Percentiles: ${G.FAMILIES[fam]}.`);
    const ws = lm.height && lm.weight ? C.weightStatus(p, fam, { m: lm, a: G.plotAge(p, lm.date) }) : null;
    if (ws) L.push(`Weight status: ${ws.text}.`);
  }
  if (p.mph) { const t = G.mphTarget(p.sex, p.mph); L.push(`Mid-parental height ${G.fmtNum(p.mph)} cm (${G.fmtAssess({ p: t.pct })} at 20 years; target range ${G.fmtNum(p.mph - 8.5)}–${G.fmtNum(p.mph + 8.5)} cm).`); }
  const hv = C.heightVelocity(p, ms, fam).pop();
  if (hv) L.push(`Height velocity ${G.fmtNum(hv.hv)} cm/year (${G.fmtDate(hv.from)}–${G.fmtDate(hv.to)})${hv.expected != null ? `; ${G.fmtNum(hv.expected)} cm/year would maintain the same percentile` : ""}.`);
  const ba = last((m) => m.boneAge != null);
  if (ba) { const pr = C.projectedAdultHeight(p, ba); L.push(`Bone age ${ba.boneAge} years at chronological age ${G.fmtNum(G.exactAge(p.dob, ba.date).yearsDec)} years (${G.fmtDate(ba.date)})${pr ? `; approximate adult height projection ${G.fmtNum(pr.cm)} cm` : ""}.`); }
  const tn = last((m) => m.tanB || m.tanPH || m.testisVol);
  if (tn) L.push(`Puberty (${G.fmtDate(tn.date)}): Tanner ${C.tannerText(p, tn)}.`);
  const bp = last((m) => m.bpSys || m.bpDia);
  if (bp) { const c = C.classifyBp(p.sex, G.exactAge(p.dob, bp.date).yearsDec, bp.bpSys, bp.bpDia); L.push(`Blood pressure ${bp.bpSys ?? "–"}/${bp.bpDia ?? "–"} mmHg (${G.fmtDate(bp.date)})${c ? `: ${c.text}` : ""}.`); }
  const al = C.growthAlerts(p, ms, fam);
  if (al.length) { L.push("", "Points of concern:"); al.forEach((a) => L.push(`- ${a.text}`)); }
  const invs = session.investigationsFor(p.id);
  const abn = [], recent = [];
  for (const x of invs) for (const r of x.results || []) { const f = C.labFlag(r); const t = `${r.test} ${r.value} ${r.unit || ""}`.trim() + (r.ref ? ` (ref ${r.ref})` : "") + ` – ${G.fmtDate(x.date)}`; if (f) abn.push(t + (f === "H" ? " HIGH" : " LOW")); else if (recent.length < 8) recent.push(t); }
  if (abn.length || recent.length) { L.push("", "Investigations:"); abn.forEach((t) => L.push(`- ${t}`)); recent.forEach((t) => L.push(`- ${t}`)); }
  const lv = last((m) => m.assess || m.plan || m.obj);
  if (lv?.obj) L.push("", `Examination (${G.fmtDate(lv.date)}): ${lv.obj}`);
  if (lv?.assess) L.push("", `Assessment: ${lv.assess}`);
  if (lv?.plan) L.push("", `Plan: ${lv.plan}`);
  const od = C.overdueVaccines(p);
  if (od.length) L.push("", `Vaccinations overdue: ${od.map((v) => `${v.name} ${v.dose || ""}`.trim()).join(", ")}.`);
  L.push("", type === "referral" ? "Thank you for seeing this child. Please do not hesitate to contact me for further information." : "Please do not hesitate to contact me if you need further information.");
  const c = settings.clinician;
  L.push("", "Yours sincerely,", "", c.name || "", c.title || "", c.clinic || "", c.contact || "");
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function viewLetter(pid) {
  const p = session.patients.get(pid); if (!p) return go("#home");
  const c = settings.clinician;
  $app.innerHTML = bar(`${pname(p)} · letter`, true) + `
  <main class="page"><div class="stack">
    <section class="card stack">
      <div class="two"><label>Letter type<select id="lt"><option value="referral">Referral letter</option><option value="summary">Clinic summary</option></select></label>
      <label>Date<input id="ld" type="date" value="${G.todayIso()}"></label></div>
      <label>To (name / department)<input id="lto" placeholder="e.g. Dr … , Paediatric Endocrinology"></label>
      <label>Reason / subject<input id="lr" placeholder="e.g. short stature with low height velocity"></label>
      <details class="opt"><summary>Your details (saved on this device)</summary><div class="stack">
        <div class="two"><label>Name<input id="cn" value="${esc(c.name)}"></label><label>Title / position<input id="ct" value="${esc(c.title)}"></label></div>
        <div class="two"><label>Clinic / hospital<input id="cc" value="${esc(c.clinic)}"></label><label>Contact<input id="cx" value="${esc(c.contact)}"></label></div>
      </div></details>
      <button class="tonal" id="lbuild">Create draft from the record</button>
    </section>
    <section class="card stack"><h2>Letter (edit freely)</h2>
      <textarea id="lbody" rows="22"></textarea>
      <div class="row wrap"><button class="primary" id="lpdf">Download PDF</button><button class="tonal" id="lshare">Share / print</button><button class="ghost" id="lcopy">Copy text</button></div>
      <p class="hint">The draft is built from the recorded data; review and edit before sending.</p>
    </section></div>
  </main>`;
  bindBack();
  const $ = (i) => document.getElementById(i);
  const saveClin = () => { settings.clinician = { name: $("cn").value.trim(), title: $("ct").value.trim(), clinic: $("cc").value.trim(), contact: $("cx").value.trim() }; };
  const build = () => { saveClin(); $("lbody").value = letterDraft(p, $("lt").value, $("lr").value.trim(), $("lto").value.trim()); };
  $("lbuild").onclick = build; build();
  const make = async (share) => {
    saveClin();
    const { buildLetter } = await import("./pdf.js");
    const title = $("lt").value === "referral" ? "Referral letter" : "Clinic summary";
    const blob = await buildLetter({ title, date: $("ld").value, body: $("lbody").value, clinician: settings.clinician });
    await saveOrShare(blob, `${title.replace(/ /g, "")}_${(p.fileNumber || p.name || "patient").replace(/[^A-Za-z0-9._-]+/g, "_")}_${$("ld").value}.pdf`, share);
  };
  $("lpdf").onclick = () => make(false);
  $("lshare").onclick = () => make(true);
  $("lcopy").onclick = () => navigator.clipboard?.writeText($("lbody").value).then(() => toast("Copied")).catch(() => toast("Select the text and copy it"));
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
