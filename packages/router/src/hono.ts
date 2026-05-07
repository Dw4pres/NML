/**
 * hono.ts
 * Thin Hono adapter for @nml/router.
 *
 * Usage in worker/index.ts:
 *   import { scanRoutes } from "@nml/router";
 *   import { registerNmlRoutes } from "@nml/router/hono";
 *
 *   const routeMap = await scanRoutes(join(import.meta.dir, "../views"));
 *   registerNmlRoutes(app, routeMap, nmlCompiler, { readFile });
 */

import { matchRoute } from "./matcher.js";
import type { RouteMap } from "./types.js";

export interface NmlRouteOptions {
  /** Read a .nml file by absolute path. Defaults to fs.readFile. */
  readFile?: (path: string) => Promise<string>;
  /** Base context merged into every page render. */
  baseContext?: Record<string, unknown>;
  /** Path to serve as 404. Defaults to "404.nml" matched by pattern name. */
  notFoundPattern?: string;
}

export interface HonoLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(pattern: string, handler: (c: HonoContextLike) => any): void;
}

export interface HonoContextLike {
  req: { param: (name: string) => string; path: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  html(content: string, status?: number): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notFound(): any;
}

export interface NmlCompilerLike {
  render(input: string, context?: Record<string, unknown>): Promise<string>;
}

/**
 * Register all routes from a RouteMap onto a Hono app instance.
 * Each route reads its .nml file, compiles it, and returns HTML.
 */
export function registerNmlRoutes(
  app: HonoLike,
  routeMap: RouteMap,
  compiler: NmlCompilerLike,
  opts: NmlRouteOptions = {}
): void {
  const { baseContext = {} } = opts;

  const readFileFn = opts.readFile ?? defaultReadFile;

  for (const route of routeMap) {
    const { pattern, file } = route;

    app.get(pattern, async (c) => {
      const src = await readFileFn(file).catch(() => null);
      if (src === null) {
        return c.html("<h1>Template not found</h1>", 404);
      }

      const params = extractParams(c, route.segments);
      const context = { ...baseContext, ...params };
      const html = await compiler.render(src, context);
      return c.html(html);
    });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function defaultReadFile(path: string): Promise<string> {
  const { readFile } = await import("fs/promises");
  return readFile(path, "utf-8");
}

function extractParams(
  c: HonoContextLike,
  segments: RouteMap[number]["segments"]
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const seg of segments) {
    if (seg.kind === "param") {
      params[seg.name] = c.req.param(seg.name) ?? "";
    }
  }
  return params;
}
