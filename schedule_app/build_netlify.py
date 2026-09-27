#!/usr/bin/env python3
"""Packages index.html as an installable, offline-capable website for Netlify Drop.

Output:
  netlify/                       the site folder (can also be dragged onto Netlify Drop)
  physician-schedule-netlify.zip the same files, zipped at the root

Run from anywhere:  python3 schedule_app/build_netlify.py
"""
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "netlify"
ZIP = HERE / "physician-schedule-netlify.zip"
ICONS = ["icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]

source = (HERE / "index.html").read_text(encoding="utf-8")

# index.html is written without <html>/<head>/<body> (the artifact host adds them).
# Split it at the end of the <style> block: everything before goes into <head>.
split = source.index("</style>") + len("</style>")
head, body = source[:split], source[split:]
head = head.replace('<meta charset="utf-8">\n', "").replace(
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n', ""
)

pwa_head = """<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0E6E62">
<meta name="description" content="جدول أعمال شهري للمحاضرات والاستشارية والخفارات والاستشاريات الليلية مع كشف التعارض">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="جدولي">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
"""

sw_register = """
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
</script>
"""

page = (
    '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n'
    + pwa_head
    + head.strip()
    + "\n</head>\n<body>\n"
    + body.strip()
    + "\n"
    + sw_register
    + "</body>\n</html>\n"
)

manifest = {
    "name": "جدول أعمالي الشهري",
    "short_name": "جدولي",
    "description": "المحاضرات والاستشارية والخفارات والاستشاريات الليلية في تقويم شهري واحد",
    "lang": "ar",
    "dir": "rtl",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "background_color": "#F3F5F4",
    "theme_color": "#0E6E62",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        {"src": "icon.svg", "sizes": "any", "type": "image/svg+xml"},
    ],
}

# The cache name changes whenever the page changes, so installed copies pick up updates.
version = hashlib.sha256(page.encode("utf-8")).hexdigest()[:10]
sw = f"""// Offline support: the app shell is cached on first visit; the page is refreshed
// from the network when online, so a new upload reaches installed copies.
const CACHE = "schedule-{version}";
const SHELL = ["./", "index.html", "manifest.webmanifest", {", ".join(json.dumps(i) for i in ICONS)}];

self.addEventListener("install", e => {{
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
}});

self.addEventListener("activate", e => {{
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
}});

self.addEventListener("fetch", e => {{
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {{
    // Network first for the page, falling back to the cached copy offline.
    e.respondWith(
      fetch(req).then(res => {{
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("index.html", copy));
        return res;
      }}).catch(() => caches.match("index.html"))
    );
    return;
  }}
  // Everything else (icons, fonts): cache first, then network, storing what we fetch.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {{
      if (res.ok || res.type === "opaque") {{
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }}
      return res;
    }}))
  );
}});
"""

headers = """/sw.js
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/
  Cache-Control: no-cache
"""

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
(OUT / "index.html").write_text(page, encoding="utf-8")
(OUT / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
(OUT / "sw.js").write_text(sw, encoding="utf-8")
(OUT / "_headers").write_text(headers, encoding="utf-8")
for name in ICONS:
    shutil.copy(HERE / "icons" / name, OUT / name)

if ZIP.exists():
    ZIP.unlink()
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(OUT.iterdir()):
        z.write(f, f.name)  # files at the zip root, as Netlify expects

print(f"Built {OUT.relative_to(HERE.parent)} and {ZIP.relative_to(HERE.parent)} ({ZIP.stat().st_size // 1024} KB)")
