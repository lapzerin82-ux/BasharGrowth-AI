// Vercel Blob adapter with the same small interface as Netlify Blobs (list / getWithMetadata / set / getMetadata),
// so the platform-independent handleSync() in _sync-core.mjs runs unchanged on Vercel.
// The store is private (readable only with the project's server token) and reads bypass the CDN cache,
// so a record overwritten on one device is never served stale to another.
export function makeBlobStore({ put, list, get }) {
  const etags = new Map(); // etags of blobs written during this request
  return {
    async list({ prefix }) {
      const blobs = []; let cursor;
      do {
        const r = await list({ prefix, cursor, limit: 1000 });
        for (const b of r.blobs) blobs.push({ key: b.pathname, etag: b.etag });
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      return { blobs };
    },
    async getWithMetadata(key) {
      const r = await get(key, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return { data: await new Response(r.stream).text(), etag: r.blob.etag };
    },
    async set(key, data) {
      const r = await put(key, data, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain", cacheControlMaxAge: 60 });
      etags.set(key, r.etag);
    },
    async getMetadata(key) { return etags.has(key) ? { etag: etags.get(key) } : null; },
  };
}
