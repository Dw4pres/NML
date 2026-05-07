/**
 * @nml-lang/bun-server
 * Minimal Bun HTTP server using the @nml-lang/router universal fetch handler.
 *
 * Usage:
 *   import { startServer } from "@nml-lang/bun-server";
 *   await startServer({ port: 3000, viewsDir: "./views" });
 */

import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { nmlCompiler } from "@nml-lang/compiler-ts";
import { scanRoutes, createHandler } from "@nml-lang/router";
import type { NmlHandlerOptions } from "@nml-lang/router";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface BunServerOptions {
  /** Port to listen on. Default: 3000 */
  port?: number;
  /** Absolute or relative path to the views/ directory. Default: "./views" */
  viewsDir?: string;
  /** Base context merged into every page render. */
  baseContext?: Record<string, unknown>;
  /** NML source for 404 page. Defaults to built-in minimal page. */
  notFoundSrc?: string;
}

// ---------------------------------------------------------------------------
// startServer
// ---------------------------------------------------------------------------

export async function startServer(opts: BunServerOptions = {}): Promise<void> {
  const port = opts.port ?? 3000;
  const viewsDir = resolve(opts.viewsDir ?? "./views");

  const fsReadFile = (path: string) => readFile(path, "utf-8");

  const routeMap = await scanRoutes(viewsDir);

  const handlerOpts: NmlHandlerOptions = {
    readFile: fsReadFile,
    baseContext: opts.baseContext ?? {},
  };
  if (opts.notFoundSrc) handlerOpts.notFoundSrc = opts.notFoundSrc;

  const handler = createHandler(routeMap, nmlCompiler, handlerOpts);

  // Bun.serve is available globally in Bun runtime
  // @ts-ignore — Bun global not in @types
  Bun.serve({ port, fetch: handler });

  console.log(`NML Bun server listening on http://localhost:${port}`);
  console.log(`  Routes: ${routeMap.length} (from ${viewsDir})`);
}

// ---------------------------------------------------------------------------
// CLI entry point: bun run src/index.ts
// ---------------------------------------------------------------------------

// Auto-start when run directly (bun src/index.ts)
// Guard with typeof check so the module is safely importable under Vitest/Node.
// @ts-ignore — Bun global not in Node types
if (typeof Bun !== "undefined" && import.meta.url === Bun.pathToFileURL(process.argv[1] ?? "").href) {
  // @ts-ignore
  const port = parseInt(process.env.PORT ?? "3000", 10);
  // @ts-ignore
  const viewsDir = process.env.VIEWS_DIR ?? join(process.cwd(), "views");
  await startServer({ port, viewsDir });
}
