/**
 * scanner.ts
 * Scans a views/ directory tree and builds a RouteMap.
 *
 * Naming conventions:
 *   views/index.nml          → /
 *   views/about.nml          → /about
 *   views/users/index.nml    → /users
 *   views/users/[id].nml     → /users/:id
 *   views/404.nml            → registered as the fallback (not a URL pattern)
 *
 * Route specificity scoring per segment:
 *   static   = 2
 *   param    = 1
 *   wildcard = 0
 * Routes are sorted highest total score first so static paths always win
 * over parameterized ones at match time.
 */

import { readdir } from "fs/promises";
import { join, relative, sep } from "path";
import type { RouteEntry, RouteMap, RouteSegment } from "./types.js";

export type ReadDirFn = (dir: string) => Promise<Array<{ name: string; isDirectory(): boolean }>>;

const defaultReadDir: ReadDirFn = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.map((e) => ({ name: e.name, isDirectory: () => e.isDirectory() }));
};

/**
 * Scan a views directory and return a sorted RouteMap.
 * @param viewsDir  Absolute path to the views directory.
 * @param readDirFn Injected for testing; defaults to fs.readdir.
 */
export async function scanRoutes(
  viewsDir: string,
  readDirFn: ReadDirFn = defaultReadDir
): Promise<RouteMap> {
  const files = await collectNmlFiles(viewsDir, readDirFn);
  const entries: RouteEntry[] = [];

  for (const filePath of files) {
    const rel = relative(viewsDir, filePath);
    const entry = filePathToRouteEntry(rel, filePath);
    if (entry) entries.push(entry);
  }

  // Sort: highest score first (static before param before wildcard)
  entries.sort((a, b) => b.score - a.score);

  return entries;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function collectNmlFiles(dir: string, readDirFn: ReadDirFn): Promise<string[]> {
  const entries = await readDirFn(dir);
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectNmlFiles(fullPath, readDirFn)));
    } else if (entry.name.endsWith(".nml")) {
      results.push(fullPath);
    }
  }
  return results;
}

function filePathToRouteEntry(
  relativePath: string,
  absolutePath: string
): RouteEntry | null {
  // Normalize path separators
  const normalized = relativePath.split(sep).join("/");

  // Strip .nml extension
  const withoutExt = normalized.slice(0, -4);

  // Strip trailing "index" → parent route
  const routePath = withoutExt === "index"
    ? "/"
    : withoutExt.endsWith("/index")
      ? withoutExt.slice(0, -6) || "/"
      : withoutExt;

  // Build segments from the URL pattern
  const rawSegments = routePath === "/" ? [] : routePath.split("/").filter(Boolean);
  const segments: RouteSegment[] = rawSegments.map(segmentFromPart);

  // Score = sum of per-segment scores
  const score = segments.reduce((sum, seg) => sum + segmentScore(seg), 0);

  // Build the URL pattern string (e.g. "/users/:id")
  const pattern = routePath === "/"
    ? "/"
    : "/" + segments.map(segmentToString).join("/");

  return { pattern, file: absolutePath, segments, score };
}

function segmentFromPart(part: string): RouteSegment {
  if (part.startsWith("[") && part.endsWith("]")) {
    return { kind: "param", name: part.slice(1, -1) };
  }
  if (part === "*") {
    return { kind: "wildcard" };
  }
  return { kind: "static", value: part };
}

function segmentScore(seg: RouteSegment): number {
  switch (seg.kind) {
    case "static":   return 2;
    case "param":    return 1;
    case "wildcard": return 0;
  }
}

function segmentToString(seg: RouteSegment): string {
  switch (seg.kind) {
    case "static":   return seg.value;
    case "param":    return `:${seg.name}`;
    case "wildcard": return "*";
  }
}
