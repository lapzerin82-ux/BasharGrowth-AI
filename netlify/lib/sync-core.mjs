// Storage logic of the sync endpoint, independent of Netlify so it can be tested locally.
// The server only ever sees opaque, end-to-end encrypted blobs:
//   <vault>/r/<kind>.<id>   an encrypted record (patient / measurement / investigation / tombstone)
//   <vault>/f/<id>          an encrypted photo
// <vault> is a 64-hex identifier derived on the device from the sync code; it is not the key.

const VAULT = /^[0-9a-f]{64}$/;
const KEY = /^(r\/[pmi]\.[A-Za-z0-9-]{1,80}|f\/[A-Za-z0-9-]{1,80})$/;
const MAX_BATCH = 100;
const MAX_ITEM = 8 * 1024 * 1024; // base64 characters

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function handleSync(req, store) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { op, vault } = body || {};
  if (op === "ping") return json({ ok: true });
  if (typeof vault !== "string" || !VAULT.test(vault)) return json({ error: "bad vault" }, 400);

  if (op === "list") {
    const { blobs } = await store.list({ prefix: vault + "/" });
    return json({ items: blobs.map((b) => ({ key: b.key.slice(vault.length + 1), etag: b.etag })) });
  }
  if (op === "get") {
    const keys = Array.isArray(body.keys) ? body.keys.slice(0, MAX_BATCH) : [];
    const items = {};
    for (const k of keys) {
      if (typeof k !== "string" || !KEY.test(k)) continue;
      const r = await store.getWithMetadata(vault + "/" + k);
      if (r) items[k] = { data: r.data, etag: r.etag };
    }
    return json({ items });
  }
  if (op === "put") {
    const list = Array.isArray(body.items) ? body.items.slice(0, MAX_BATCH) : [];
    const etags = {};
    for (const it of list) {
      if (!it || typeof it.key !== "string" || !KEY.test(it.key) || typeof it.data !== "string" || it.data.length > MAX_ITEM) continue;
      await store.set(vault + "/" + it.key, it.data);
      const m = await store.getMetadata(vault + "/" + it.key);
      if (m) etags[it.key] = m.etag;
    }
    return json({ etags });
  }
  return json({ error: "unknown op" }, 400);
}
