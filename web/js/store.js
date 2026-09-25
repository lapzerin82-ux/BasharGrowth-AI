// Accounts, encrypted local storage (IndexedDB + WebCrypto) and the backup file format.
// Backup files use the same ".bgcbackup" format as the Android app, so they restore on either.

const enc = new TextEncoder(), dec = new TextDecoder();
const ITER = 210000;
const b64 = (u8) => {
  const a = new Uint8Array(u8); let s = "";
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export { b64, unb64, gcmEncrypt, gcmDecrypt, pbkdf2Bits, aesKey, metaDb, idbGet, idbPut, idbDel };
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

async function pbkdf2Bits(password, salt, iterations, bits) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, bits));
}
const aesKey = (raw, extractable = false) => crypto.subtle.importKey("raw", raw, "AES-GCM", extractable, ["encrypt", "decrypt"]);
async function gcmEncrypt(key, data, aad) {
  const iv = rand(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, ...(aad ? { additionalData: aad } : {}) }, key, data));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
}
async function gcmDecrypt(key, data, aad) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12), ...(aad ? { additionalData: aad } : {}) }, key, data.slice(12)));
}
function eqConst(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0; }

// ---------------------------------------------------------------- IndexedDB helpers
function idb(name, stores, version = 1) {
  return new Promise((res, rej) => {
    const r = indexedDB.open(name, version);
    r.onupgradeneeded = () => stores.forEach((s) => r.result.objectStoreNames.contains(s) || r.result.createObjectStore(s));
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function tx(db, store, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode), s = t.objectStore(store); const out = fn(s);
    t.oncomplete = () => res(out && "result" in out ? out.result : out); t.onerror = () => rej(t.error);
  });
}
const idbGet = (db, store, key) => tx(db, store, "readonly", (s) => s.get(key));
const idbPut = (db, store, key, val) => tx(db, store, "readwrite", (s) => s.put(val, key));
const idbDel = (db, store, key) => tx(db, store, "readwrite", (s) => s.delete(key));
const idbAll = (db, store) => tx(db, store, "readonly", (s) => s.getAll());
const idbClear = (db, store) => tx(db, store, "readwrite", (s) => s.clear());

// ---------------------------------------------------------------- accounts
// Accounts: { email, salt, iter, verifier, wrappedKey, dbName }. The password is never stored:
// PBKDF2 yields 512 bits = 256-bit verifier + 256-bit key-encryption key that unwraps the data key.
let meta;
async function metaDb() { return meta || (meta = await idb("pgc-meta", ["accounts", "session"])); }

export async function lastEmail() { const m = await metaDb(); return (await idbGet(m, "session", "lastEmail")) || ""; }

async function deriveAccountKeys(password, salt, iter) {
  const bits = await pbkdf2Bits(password, salt, iter, 512);
  return { verifier: bits.slice(0, 32), kek: await aesKey(bits.slice(32)) };
}

export async function register(emailRaw, password) {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const m = await metaDb();
  if (await idbGet(m, "accounts", email)) throw new Error("This account already exists on this device. Please sign in.");
  const salt = rand(16);
  const { verifier, kek } = await deriveAccountKeys(password, salt, ITER);
  const dataKey = rand(32);
  const acc = { email, salt: b64(salt), iter: ITER, verifier: b64(verifier), wrappedKey: b64(await gcmEncrypt(kek, dataKey)), dbName: "pgc-data-" + b64(rand(9)).replace(/[^A-Za-z0-9]/g, "x") };
  await idbPut(m, "accounts", email, acc);
  return openSession(acc, dataKey);
}

export async function signIn(emailRaw, password) {
  const email = emailRaw.trim().toLowerCase();
  const m = await metaDb();
  const acc = await idbGet(m, "accounts", email);
  if (!acc) throw new Error("No account with this email on this device. Choose \"Create account\", or restore a backup after creating one.");
  const { verifier, kek } = await deriveAccountKeys(password, unb64(acc.salt), acc.iter);
  if (!eqConst(verifier, unb64(acc.verifier))) throw new Error("Incorrect email or password.");
  const dataKey = await gcmDecrypt(kek, unb64(acc.wrappedKey));
  return openSession(acc, dataKey);
}

async function openSession(acc, dataKeyRaw) {
  const key = await aesKey(dataKeyRaw, false); // non-extractable
  const m = await metaDb();
  await idbPut(m, "session", "current", { email: acc.email, key }); // CryptoKey stays non-extractable in IndexedDB
  await idbPut(m, "session", "lastEmail", acc.email);
  return Session.open(acc, key);
}

export async function restoreSession() {
  const m = await metaDb();
  const cur = await idbGet(m, "session", "current");
  if (!cur) return null;
  const acc = await idbGet(m, "accounts", cur.email);
  return acc ? Session.open(acc, cur.key) : null;
}

/**
 * Opens the app without a sign-in screen.
 *  - An existing session (earlier versions with sign-in) keeps being used, so no records are lost.
 *  - Otherwise, on first start, a device workspace is created: its records are encrypted with a random
 *    AES-256 key generated by the browser as a non-extractable CryptoKey and kept in IndexedDB.
 *  - If older password-protected accounts exist but none is open, returns { locked: [emails] } so the
 *    user can unlock them once (or start with an empty device workspace).
 */
export async function openDirect() {
  const existing = await restoreSession();
  if (existing) return existing;
  const m = await metaDb();
  const accounts = await tx(m, "accounts", "readonly", (st) => st.getAll());
  const device = accounts.find((a) => a.device);
  const deviceKey = await idbGet(m, "session", "deviceKey");
  if (device && deviceKey) {
    await idbPut(m, "session", "current", { email: device.email, key: deviceKey });
    return Session.open(device, deviceKey);
  }
  const locked = accounts.filter((a) => !a.device).map((a) => a.email);
  if (locked.length) return { locked };
  return createDeviceWorkspace();
}

export async function createDeviceWorkspace() {
  const m = await metaDb();
  const old = await idbGet(m, "accounts", "this device"), oldKey = await idbGet(m, "session", "deviceKey");
  if (old && oldKey) { await idbPut(m, "session", "current", { email: old.email, key: oldKey }); return Session.open(old, oldKey); }
  const acc = { email: "this device", device: true, dbName: "pgc-data-device-" + b64(rand(9)).replace(/[^A-Za-z0-9]/g, "x") };
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await idbPut(m, "accounts", acc.email, acc);
  await idbPut(m, "session", "deviceKey", key);
  await idbPut(m, "session", "current", { email: acc.email, key });
  return Session.open(acc, key);
}

export async function signOut() { const m = await metaDb(); await idbDel(m, "session", "current"); }

// ---------------------------------------------------------------- per-account encrypted records
// Record kinds: "p" patient, "m" measurement, "i" investigation. A deleted record is kept as a small
// tombstone { id, deleted: true, updatedAt } so the deletion also reaches other synced devices.
// Photos are stored separately (store "files"), each AES-GCM encrypted.
const KINDS = { p: "patients", m: "measurements", i: "investigations" };

export class Session {
  static async open(acc, key) {
    const s = new Session(); s.email = acc.email; s.key = key; s.onChange = () => {};
    s.db = await idb(acc.dbName, ["records", "files"], 2);
    s.patients = new Map(); s.measurements = new Map(); s.investigations = new Map(); s.tombs = new Map();
    for (const row of await idbAll(s.db, "records")) {
      const rec = JSON.parse(dec.decode(await gcmDecrypt(key, row.data)));
      if (rec.deleted) s.tombs.set(row.kind + ":" + rec.id, rec); else s[KINDS[row.kind]].set(rec.id, rec);
    }
    return s;
  }
  async _put(kind, rec, silent) {
    const data = await gcmEncrypt(this.key, enc.encode(JSON.stringify(rec)));
    await idbPut(this.db, "records", kind + ":" + rec.id, { kind, data });
    if (rec.deleted) { this[KINDS[kind]].delete(rec.id); this.tombs.set(kind + ":" + rec.id, rec); }
    else { this.tombs.delete(kind + ":" + rec.id); this[KINDS[kind]].set(rec.id, rec); }
    if (!silent) this.onChange();
  }
  async _del(kind, id) {
    const old = this[KINDS[kind]].get(id);
    await this._put(kind, { id, deleted: true, updatedAt: Math.max(Date.now(), (old?.updatedAt || 0) + 1) });
  }
  get(kind, id) { return this[KINDS[kind]].get(id) || this.tombs.get(kind + ":" + id) || null; }

  patientList(q = "") {
    q = q.trim().toLowerCase();
    let list = [...this.patients.values()];
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.fileNumber || "").toLowerCase().includes(q));
    return list.sort((a, b) => ((b.fileNumber || "").toLowerCase() === q) - ((a.fileNumber || "").toLowerCase() === q) || a.name.localeCompare(b.name));
  }
  recent(n = 5) { return [...this.patients.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, n); }
  byFileNumber(f) { f = f.trim().toLowerCase(); return f ? [...this.patients.values()].find((p) => (p.fileNumber || "").toLowerCase() === f) : null; }
  measurementsFor(pid) { return [...this.measurements.values()].filter((m) => m.patientId === pid).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt); }
  investigationsFor(pid) { return [...this.investigations.values()].filter((x) => x.patientId === pid).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt); }

  async _save(kind, r, touchPatient) {
    const now = Date.now(); const old = r.id && this[KINDS[kind]].get(r.id);
    const rec = { ...old, ...r, id: r.id || crypto.randomUUID(), createdAt: old?.createdAt || now, updatedAt: Math.max(now, (old?.updatedAt || 0) + 1) };
    await this._put(kind, rec);
    if (touchPatient) { const p = this.patients.get(rec.patientId); if (p) await this._put("p", { ...p, updatedAt: Math.max(now, p.updatedAt + 1) }); }
    return rec.id;
  }
  savePatient(p) { return this._save("p", p, false); }
  saveMeasurement(m) { return this._save("m", m, true); }
  saveInvestigation(x) { return this._save("i", x, true); }
  async deleteMeasurement(id) { await this._del("m", id); }
  async deleteInvestigation(id) {
    const x = this.investigations.get(id);
    for (const f of x?.photos || []) await this.deleteFile(f.id);
    await this._del("i", id);
  }
  async deletePatient(id) {
    for (const m of this.measurementsFor(id)) await this._del("m", m.id);
    for (const x of this.investigationsFor(id)) await this.deleteInvestigation(x.id);
    await this._del("p", id);
  }

  // ---- photos (encrypted blobs)
  async putFile(bytes, id = crypto.randomUUID()) { await idbPut(this.db, "files", id, await gcmEncrypt(this.key, bytes)); return id; }
  async getFile(id) { const d = await idbGet(this.db, "files", id); return d ? gcmDecrypt(this.key, d) : null; }
  async hasFile(id) { return !!(await idbGet(this.db, "files", id)); }
  async deleteFile(id) { await idbDel(this.db, "files", id); }

  /** Every record including tombstones, for synchronisation. */
  allRecords() {
    const out = [];
    for (const [k, name] of Object.entries(KINDS)) for (const r of this[name].values()) out.push([k, r]);
    for (const [key, r] of this.tombs) out.push([key.split(":")[0], r]);
    return out;
  }
  /** Last-writer-wins merge of a record received from another device. */
  async applyRemote(kind, rec) {
    const local = this.get(kind, rec.id);
    if (local && local.updatedAt >= rec.updatedAt) return false;
    if (kind === "i" && rec.deleted) for (const f of local?.photos || []) await this.deleteFile(f.id);
    await this._put(kind, rec, true);
    return true;
  }

  // ---- backup (format shared with the Android app; field names match its PatientRecord/MeasurementRecord;
  //      investigations and photos are extra fields the Android version ignores)
  async exportContents() {
    const E = (iso) => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);
    const files = {};
    for (const x of this.investigations.values()) for (const f of x.photos || []) {
      const b = await this.getFile(f.id); if (b) files[f.id] = b64(b);
    }
    return {
      format: "bashar-growth-chart-backup", formatVersion: 1, createdAt: Date.now(), appVersion: "web-1.1", account: this.email,
      patients: [...this.patients.values()].map((p) => ({ id: p.id, name: p.name, sex: p.sex, fileNumber: p.fileNumber, dobEpochDay: E(p.dob), fatherHeightCm: p.father ?? null, motherHeightCm: p.mother ?? null, mphCm: p.mph ?? null, mphManual: !!p.mphManual, notes: p.notes || "", complaint: p.complaint || "", features: p.features || "", preferredReference: p.preferredReference || null, createdAt: p.createdAt, updatedAt: p.updatedAt, deleted: false })),
      measurements: [...this.measurements.values()].map((m) => ({ id: m.id, patientId: m.patientId, dateEpochDay: E(m.date), heightCm: m.height ?? null, weightKg: m.weight ?? null, notes: m.notes || "", createdAt: m.createdAt, updatedAt: m.updatedAt, deleted: false })),
      investigations: [...this.investigations.values()],
      files,
    };
  }
  async restore(c, replace) {
    const iso = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
    const now = Date.now(); let np = 0, nm = 0, ni = 0, skipped = 0;
    if (replace) {
      // deletions become tombstones so that synced devices also drop records missing from the backup
      const keep = new Set([...(c.patients || []).map((r) => "p:" + r.id), ...(c.measurements || []).map((r) => "m:" + r.id), ...(c.investigations || []).map((r) => "i:" + r.id)]);
      for (const [k, r] of this.allRecords()) if (!r.deleted && !keep.has(k + ":" + r.id)) await this._put(k, { id: r.id, deleted: true, updatedAt: Math.max(now, r.updatedAt + 1) }, true);
    }
    const take = (kind, r) => { const old = this.get(kind, r.id); return replace || !old || old.deleted || old.updatedAt <= r.updatedAt; };
    const stamp = (kind, r) => replace ? Math.max(now, (this.get(kind, r.id)?.updatedAt || 0) + 1) : r.updatedAt || now;
    for (const r of c.patients || []) {
      if (r.deleted) continue;
      if (!take("p", r)) { skipped++; continue; }
      await this._put("p", { id: r.id, name: r.name, sex: r.sex, fileNumber: r.fileNumber, dob: iso(r.dobEpochDay), father: r.fatherHeightCm ?? null, mother: r.motherHeightCm ?? null, mph: r.mphCm ?? null, mphManual: !!r.mphManual, notes: r.notes || "", complaint: r.complaint || "", features: r.features || "", preferredReference: r.preferredReference || null, createdAt: r.createdAt || now, updatedAt: stamp("p", r) }, true);
      np++;
    }
    for (const r of c.measurements || []) {
      if (r.deleted) continue;
      if (!take("m", r)) { skipped++; continue; }
      await this._put("m", { id: r.id, patientId: r.patientId, date: iso(r.dateEpochDay), height: r.heightCm ?? null, weight: r.weightKg ?? null, notes: r.notes || "", createdAt: r.createdAt || now, updatedAt: stamp("m", r) }, true);
      nm++;
    }
    for (const r of c.investigations || []) {
      if (r.deleted) continue;
      if (!take("i", r)) { skipped++; continue; }
      await this._put("i", { ...r, updatedAt: stamp("i", r) }, true);
      ni++;
    }
    for (const [id, data] of Object.entries(c.files || {})) await this.putFile(unb64(data), id);
    this.onChange();
    return { np, nm, ni, skipped };
  }
}

// ---------------------------------------------------------------- .bgcbackup codec
const MAGIC = [66, 71, 67, 66]; // "BGCB"
async function gzip(u8) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()); }
async function gunzip(u8) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()); }

export async function encodeBackup(contents, password) {
  const salt = rand(16);
  const header = new Uint8Array(25); header.set(MAGIC); header[4] = 1;
  new DataView(header.buffer).setInt32(5, ITER); header.set(salt, 9);
  const key = await aesKey((await pbkdf2Bits(password, salt, ITER, 256)));
  const body = await gcmEncrypt(key, await gzip(enc.encode(JSON.stringify(contents))), header);
  const out = new Uint8Array(header.length + body.length); out.set(header); out.set(body, 25); return out;
}
export async function decodeBackup(u8, password) {
  if (u8.length <= 25 || MAGIC.some((v, i) => u8[i] !== v)) throw new Error("This is not a Pediatric Growth Chart backup file.");
  if (u8[4] !== 1) throw new Error("Unsupported backup version.");
  const iter = new DataView(u8.buffer, u8.byteOffset).getInt32(5);
  if (iter < 10000 || iter > 10000000) throw new Error("Invalid backup header.");
  const header = u8.slice(0, 25), key = await aesKey(await pbkdf2Bits(password, u8.slice(9, 25), iter, 256));
  let gz;
  try { gz = await gcmDecrypt(key, u8.slice(25), header); } catch { throw new Error("Incorrect backup password, or the file is damaged."); }
  return JSON.parse(dec.decode(await gunzip(gz)));
}
