// Offline support: every file the app needs is cached on first visit.
const CACHE = "pgc-v12";
const FILES = [
  "./", "index.html", "app.css", "manifest.webmanifest",
  "js/app.js", "js/growth.js", "js/store.js", "js/chart.js", "js/pdf.js", "js/sheet.js", "js/sync.js", "js/catalog.js", "js/labels.js", "js/clinical.js",
  "charts/sheets.json", "charts/cdc_0_36_boys.svg", "charts/cdc_0_36_girls.svg", "charts/cdc_2_20_boys.svg", "charts/cdc_2_20_girls.svg",
  "vendor/jspdf.umd.min.js", "fonts/nunito-latin-wght-normal.woff2", "fonts/nunito-latin-ext-wght-normal.woff2",
  "data/who2006_0_2.json", "data/cdc2000_infant.json", "data/cdc2000_child.json", "data/who2006.json", "data/who2007.json",
  "data/cdc2000_hc.json", "data/cdc2000_wfl.json", "data/cdc2000_bmi.json", "data/who2006_hc.json", "data/who2006_bmi.json",
  "data/who2006_wfl.json", "data/who2006_wfh.json", "data/who2007_bmi.json", "data/ds_infant.json", "data/ds_child.json", "data/turner.json",
  "img/developer.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates arrive when online), cache fallback (so the app works offline).
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin || new URL(e.request.url).pathname.includes("/api/")) return;
  e.respondWith(
    fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
