import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { handleSync } from "../lib/sync-core.mjs";

// Encrypted sync storage for the Pediatric Growth Chart web app (see netlify/lib/sync-core.mjs).
export default async (req: Request, context: Context) => {
  const store = getStore({ name: "pgc-sync", consistency: "strong" });
  return handleSync(req, store);
};

export const config: Config = {
  path: "/api/sync",
};
