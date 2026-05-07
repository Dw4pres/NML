/**
 * manifest.ts
 * Serialize/deserialize a RouteMap to/from JSON for build-time manifests.
 *
 * During `nml build`, the RouteMap is written to dist/routes.json.
 * The edge worker imports this pre-computed manifest at startup,
 * eliminating per-request filesystem scanning.
 */

import type { RouteMap } from "./types.js";

/**
 * Serialize a RouteMap to a JSON string.
 * The full RouteEntry (including segments and score) is preserved
 * so the worker can skip re-scanning on startup.
 */
export function serializeRouteMap(routeMap: RouteMap): string {
  return JSON.stringify(routeMap, null, 2);
}

/**
 * Restore a RouteMap from a serialized JSON string.
 * Safe: returns an empty array if the JSON is invalid.
 */
export function deserializeRouteMap(json: string): RouteMap {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed as RouteMap;
  } catch {
    return [];
  }
}
