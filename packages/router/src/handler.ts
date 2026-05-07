/**
 * handler.ts
 * Universal fetch-API handler for NML file-based routing.
 *
 * createHandler(routeMap, compiler, opts) → (Request) => Promise<Response>
 *
 * Compatible with: CF Workers, Bun.serve, Deno, Vercel Edge, Node 22 fetch handler.
 * Zero framework coupling — only the standard Web Fetch API is used.
 */

import { matchRoute } from "./matcher.js";
import type { RouteMap } from "./types.js";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface NmlHandlerCompiler {
  render(src: string, context?: Record<string, unknown>): Promise<string>;
}

export interface NmlHandlerOptions {
  /** Read a .nml file by absolute path. Defaults to fs.readFile (Node/Bun). */
  readFile?: (path: string) => Promise<string>;
  /** Base context merged into every page render. */
  baseContext?: Record<string, unknown>;
  /** NML source to render for 404 responses. Defaults to a minimal 404 page. */
  notFoundSrc?: string;
}

export type FetchHandler = (request: Request) => Promise<Response>;

// ---------------------------------------------------------------------------
// createHandler
// ---------------------------------------------------------------------------

const DEFAULT_404_NML = `doctype.html
html.lang("en")
    head
        meta.charset("UTF-8")
        title("404 Not Found")
    body
        h1("404 Not Found")
        p("The page you requested could not be found.")
`;

/**
 * Build a standard fetch handler from a RouteMap.
 *
 * @example
 * // CF Workers / Bun.serve / Deno
 * const handler = createHandler(routeMap, nmlCompiler, { readFile, baseContext });
 * export default { fetch: handler };           // CF Workers
 * Bun.serve({ fetch: handler });               // Bun
 */
export function createHandler(
  routeMap: RouteMap,
  compiler: NmlHandlerCompiler,
  opts: NmlHandlerOptions = {}
): FetchHandler {
  const readFileFn = opts.readFile ?? defaultReadFile;
  const baseContext = opts.baseContext ?? {};
  const notFoundSrc = opts.notFoundSrc ?? DEFAULT_404_NML;

  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = matchRoute(routeMap, url.pathname);

    if (!match) {
      const html = await compiler.render(notFoundSrc, { ...baseContext, path: url.pathname });
      return new Response(html, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const src = await readFileFn(match.file).catch(() => null);
    if (src === null) {
      const html = await compiler.render(notFoundSrc, { ...baseContext, path: url.pathname });
      return new Response(html, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const context = { ...baseContext, ...match.params };
    const html = await compiler.render(src, context);
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function defaultReadFile(path: string): Promise<string> {
  const { readFile } = await import("fs/promises");
  return readFile(path, "utf-8");
}
