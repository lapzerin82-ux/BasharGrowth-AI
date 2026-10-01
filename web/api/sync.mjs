// Vercel Function: end-to-end encrypted sync storage for the Pediatric Growth Chart web app.
// Same protocol as the Netlify function; the server only stores opaque encrypted blobs (see _sync-core.mjs).
// Needs a Vercel Blob store connected to the project (provides BLOB_READ_WRITE_TOKEN).
import { put, list, get } from "@vercel/blob";
import { handleSync } from "./_sync-core.mjs";
import { makeBlobStore } from "./_blob-store.mjs";

export async function POST(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    return Response.json({ error: "Sync storage is not configured (connect a Vercel Blob store to the project)." }, { status: 503 });
  }
  try {
    return await handleSync(request, makeBlobStore({ put, list, get }));
  } catch (e) {
    console.error("sync error", e);
    return Response.json({ error: "storage error" }, { status: 502 });
  }
}
export function GET() { return Response.json({ error: "POST only" }, { status: 405 }); }
