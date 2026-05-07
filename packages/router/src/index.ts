/**
 * @nml/router
 *
 * File-based routing for NML applications.
 * Framework-agnostic — works with Hono, Bun.serve, Deno, CF Workers, Node fetch.
 *
 * Exports:
 *   scanRoutes(viewsDir, readDirFn?)  — build a RouteMap from a views/ directory
 *   matchRoute(routeMap, pathname)    — pure function, returns matched file + params
 *   serializeRouteMap(routeMap)       — JSON string for build-time manifest
 *   deserializeRouteMap(json)         — restore RouteMap from manifest
 */

export { scanRoutes } from "./scanner.js";
export { matchRoute } from "./matcher.js";
export { serializeRouteMap, deserializeRouteMap } from "./manifest.js";
export type { RouteMap, RouteEntry, MatchResult } from "./types.js";

export { registerNmlRoutes } from "./hono.js";
export type { HonoLike, HonoContextLike, NmlCompilerLike, NmlRouteOptions } from "./hono.js";

export { createHandler } from "./handler.js";
export type { FetchHandler, NmlHandlerCompiler, NmlHandlerOptions } from "./handler.js";
