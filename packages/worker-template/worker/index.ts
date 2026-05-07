import { Hono } from "hono";
import { cors } from "hono/cors";
import { nmlCompiler } from "@nml/compiler-ts";
import { scanRoutes, createHandler } from "@nml/router";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Bindings = {
  // Add D1 / KV / R2 bindings here, e.g.:
  // DB: D1Database;
};

// ---------------------------------------------------------------------------
// Bootstrap — scan views/ once at startup
// ---------------------------------------------------------------------------

// CF Workers: use fetch() from R2 or KV; here we use the injected env for bindings.
// For local Wrangler dev, views/ are served via the abstract handler below.
const viewsDir = "/views"; // relative to worker root; resolved by readFile below

// In CF Workers there is no fs — readFile must be injected. This scaffold uses
// dynamic import so wrangler doesn't bundle node:fs for edge builds.
const readFile = async (path: string): Promise<string> => {
  const { readFile: fsRead } = await import("node:fs/promises");
  return fsRead(path, "utf-8");
};

const routeMap = await scanRoutes(viewsDir, readFile as never).catch(() => []);

// ---------------------------------------------------------------------------
// Abstract fetch handler (framework-agnostic, Phase 10)
// ---------------------------------------------------------------------------

const nmlHandler = createHandler(routeMap, nmlCompiler, {
  readFile,
  baseContext: {
    // Global context available in every template — add app-wide data here
  },
});

// ---------------------------------------------------------------------------
// Hono app — API routes only; page routes delegate to nmlHandler
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: "http://localhost:5173" }));

app.get("/api/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// Delegate all non-API requests to the abstract NML handler
app.all("*", (c) => nmlHandler(c.req.raw));

// ---------------------------------------------------------------------------
// CF Workers export
// ---------------------------------------------------------------------------

export default app;
