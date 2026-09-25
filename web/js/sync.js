// End-to-end encrypted synchronisation between devices through the site's /api/sync function.
// A random "sync code" (100 bits) is created on one device and typed on the others. From it each
// device derives (PBKDF2-SHA-256) a vault id, which is all the server knows, and an AES-256 key.
// Records and photos are encrypted with that key before upload; the server stores opaque blobs.
import { b64, unb64, gcmEncrypt, gcmDecrypt, pbkdf2Bits, aesKey, metaDb, idbGet, idbPut, idbDel } from "./store.js";

const enc = new TextEncoder(), dec = new TextDecoder();
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

export function newSyncCode() {
  const r = crypto.getRandomValues(new Uint8Array(20));
  const c = [...r].map((b) => ALPH[b % 32]).join("");
  return c.match(/.{4}/g).join("-");
}
export function normalizeCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

async function derive(code) {
  const bits = await pbkdf2Bits(normalizeCode(code), enc.encode("pgc-sync-v1"), 150000, 512);
  return { vault: hex(bits.slice(0, 32)), key: await aesKey(bits.slice(32)) };
}

async function api(body) {
  let r;
  try {
    r = await fetch("api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch { throw Object.assign(new Error("No internet connection. Changes are saved on this device and will sync later."), { offline: true }); }
  if (r.status === 404) throw new Error("The sync service is not deployed. Deploy the site from GitHub (see Settings → Sync) to enable it.");
  if (!r.ok) throw new Error(`Sync server error (${r.status})`);
  return r.json();
}

export class Sync {
  constructor(session) { this.session = session; this.state = null; this.running = null; this.listeners = new Set(); this.status = { state: "off" }; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(st) { this.status = st; this.listeners.forEach((f) => f(st)); }

  async load() {
    const m = await metaDb();
    const saved = await idbGet(m, "session", "sync");
    if (saved) {
      const code = dec.decode(await gcmDecrypt(this.session.key, saved.codeEnc));
      this.state = { ...saved, code, ...(await derive(code)) };
      this._emit({ state: "idle", at: saved.lastSync || null });
    }
    return !!this.state;
  }
  get enabled() { return !!this.state; }
  get code() { return this.state?.code; }

  async enable(code) {
    const c = normalizeCode(code);
    if (c.length < 20) throw new Error("A sync code has 20 characters (e.g. ABCD-EFGH-JKLM-NPQR-STUV).");
    await api({ op: "ping" });
    const d = await derive(c);
    this.state = { code: c.match(/.{4}/g).join("-"), ...d, etags: {}, pushed: {}, lastSync: null };
    await this._save();
    return this.sync();
  }
  async disable() { this.state = null; const m = await metaDb(); await idbDel(m, "session", "sync"); this._emit({ state: "off" }); }
  async _save() {
    const m = await metaDb();
    const { code, etags, pushed, lastSync } = this.state;
    await idbPut(m, "session", "sync", { codeEnc: await gcmEncrypt(this.session.key, enc.encode(code)), etags, pushed, lastSync });
  }

  schedule(ms = 3000) {
    if (!this.state) return;
    clearTimeout(this._t); this._t = setTimeout(() => this.sync().catch(() => {}), ms);
  }

  /** One full round: download what changed elsewhere, upload local changes, then photos. */
  sync() {
    if (!this.state) return Promise.resolve(null);
    if (this.running) return this.running;
    this.running = this._round().finally(() => { this.running = null; });
    return this.running;
  }

  async _round() {
    const st = this.state, s = this.session, vault = st.vault;
    this._emit({ state: "running" });
    try {
      let down = 0, up = 0;
      const remote = new Map((await api({ op: "list", vault })).items.map((x) => [x.key, x.etag]));

      // 1. download changed records
      const changed = [...remote].filter(([k, e]) => k.startsWith("r/") && st.etags[k] !== e).map(([k]) => k);
      for (let i = 0; i < changed.length; i += 50) {
        const { items } = await api({ op: "get", vault, keys: changed.slice(i, i + 50) });
        for (const [k, v] of Object.entries(items)) {
          try {
            const { kind, rec } = JSON.parse(dec.decode(await gcmDecrypt(st.key, unb64(v.data), enc.encode(k))));
            if (await s.applyRemote(kind, rec)) down++;
            st.pushed[k] = rec.updatedAt;
          } catch { /* not decryptable with this code: ignore */ }
          st.etags[k] = v.etag;
        }
      }

      // 2. upload local changes (including deletions)
      const out = [];
      for (const [kind, rec] of s.allRecords()) {
        const k = `r/${kind}.${rec.id}`;
        if (st.pushed[k] === rec.updatedAt) continue;
        out.push({ k, rec: { kind, rec } });
      }
      for (let i = 0; i < out.length; i += 50) {
        const items = [];
        for (const { k, rec } of out.slice(i, i + 50)) items.push({ key: k, data: b64(await gcmEncrypt(st.key, enc.encode(JSON.stringify(rec)), enc.encode(k))) });
        const { etags } = await api({ op: "put", vault, items });
        for (const { k, rec } of out.slice(i, i + 50)) { st.pushed[k] = rec.rec.updatedAt; if (etags[k]) st.etags[k] = etags[k]; }
        up += items.length;
      }

      // 3. photos: upload ones the server lacks, download ones this device lacks
      const want = new Set();
      for (const x of s.investigations.values()) for (const f of x.photos || []) want.add(f.id);
      for (const id of want) {
        const k = "f/" + id, local = await s.hasFile(id);
        if (local && !remote.has(k)) {
          const bytes = await s.getFile(id);
          await api({ op: "put", vault, items: [{ key: k, data: b64(await gcmEncrypt(st.key, bytes, enc.encode(k))) }] });
          up++;
        } else if (!local && remote.has(k)) {
          const { items } = await api({ op: "get", vault, keys: [k] });
          if (items[k]) { await s.putFile(await gcmDecrypt(st.key, unb64(items[k].data), enc.encode(k)), id); down++; }
        }
      }

      st.lastSync = Date.now();
      await this._save();
      const res = { state: "done", at: st.lastSync, down, up };
      this._emit(res);
      return res;
    } catch (e) {
      await this._save().catch(() => {});
      this._emit({ state: e.offline ? "offline" : "error", message: e.message });
      throw e;
    }
  }
}
