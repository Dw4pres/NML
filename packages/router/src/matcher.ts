/**
 * matcher.ts
 * Pure function — no I/O. Matches a URL pathname against a sorted RouteMap.
 *
 * The RouteMap is pre-sorted by specificity score (highest first), so the
 * first match is always the most specific one.
 *
 * Returns null if no route matches (caller should serve 404).
 */

import type { RouteMap, MatchResult, RouteSegment } from "./types.js";

/**
 * Match a URL pathname against a RouteMap.
 *
 * @param routeMap  Sorted RouteMap (highest score first) from scanRoutes().
 * @param pathname  The URL pathname, e.g. "/users/42"
 * @returns MatchResult with matched file + extracted params, or null.
 */
export function matchRoute(
  routeMap: RouteMap,
  pathname: string
): MatchResult | null {
  const normalizedPath = normalizePath(pathname);
  const incomingSegments = normalizedPath === "/" ? [] : normalizedPath.split("/").filter(Boolean);

  for (const route of routeMap) {
    const params = tryMatch(route.segments, incomingSegments);
    if (params !== null) {
      return { file: route.file, params };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizePath(pathname: string): string {
  const stripped = pathname.split("?")[0].split("#")[0];
  return stripped || "/";
}

function tryMatch(
  segments: RouteSegment[],
  incoming: string[]
): Record<string, string> | null {
  if (segments.length !== incoming.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const part = incoming[i];

    switch (seg.kind) {
      case "static":
        if (seg.value !== part) return null;
        break;
      case "param":
        params[seg.name] = decodeURIComponent(part);
        break;
      case "wildcard":
        break;
    }
  }

  return params;
}
