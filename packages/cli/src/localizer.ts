/**
 * localizer.ts
 * Downloads registered prefix libraries from CDN to dist/assets/ during `nml build`.
 * Rewrites CDN <script> tags in HTML output to local paths.
 *
 * Phase 9: CDN_URLS replaced by extensible registry driven by detector.ts.
 * Use registerLibrary() in detector.ts to add new libraries — localizer picks them up automatically.
 */

import { mkdir, writeFile, access } from "fs/promises";
import { join } from "path";
import { getRegistry } from "./detector.js";

// ---------------------------------------------------------------------------
// Legacy CDN_URLS export (backward compat with build.ts)
// ---------------------------------------------------------------------------

/** @deprecated Access the registry via getRegistry() from detector.ts */
export const CDN_URLS = {
  htmx: "https://unpkg.com/htmx.org/dist/htmx.min.js",
  alpine: "https://cdn.jsdelivr.net/npm/alpinejs/dist/cdn.min.js",
} as const;

export type LibraryName = keyof typeof CDN_URLS;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LocalizerOptions {
  distDir: string;
  /** Override fetch for testing */
  fetchFn?: typeof fetch;
}

// ---------------------------------------------------------------------------
// Core: download any registered prefix library by prefix key
// ---------------------------------------------------------------------------

/**
 * Download the CDN asset for `prefix` to dist/assets/.
 * Uses the CDN URL registered via registerLibrary() in detector.ts.
 * Returns the local relative path used to rewrite script tags.
 */
export async function downloadByPrefix(
  prefix: string,
  opts: LocalizerOptions
): Promise<string> {
  const registry = getRegistry();
  const cdnUrl = registry.get(prefix);
  if (!cdnUrl) throw new Error(`No CDN URL registered for prefix "${prefix}"`);

  const assetsDir = join(opts.distDir, "assets");
  // Well-known prefix → canonical filename mapping
  const FILENAME_MAP: Record<string, string> = {
    "hx-": "htmx.js",
    "x-": "alpine.js",
  };
  const fileName = FILENAME_MAP[prefix] ?? `${prefix.replace(/-$/, "").replace(/[^a-z0-9_]/g, "_")}.js`;
  const localPath = join(assetsDir, fileName);
  const relativePath = `/assets/${fileName}`;

  const exists = await access(localPath).then(() => true).catch(() => false);
  if (exists) return relativePath;

  await mkdir(assetsDir, { recursive: true });

  const fetchFn = opts.fetchFn ?? fetch;
  const response = await fetchFn(cdnUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${prefix} from ${cdnUrl}: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  await writeFile(localPath, text, "utf-8");

  return relativePath;
}

// ---------------------------------------------------------------------------
// Legacy: download by LibraryName (backward compat with build.ts)
// ---------------------------------------------------------------------------

/**
 * Download a CDN library to dist/assets/ if it doesn't already exist.
 * Returns the local relative path used to rewrite script tags.
 */
export async function downloadLibrary(
  name: LibraryName,
  opts: LocalizerOptions
): Promise<string> {
  const prefix: string = name === "htmx" ? "hx-" : "x-";
  return downloadByPrefix(prefix, opts);
}

// ---------------------------------------------------------------------------
// Rewrite CDN src paths in HTML
// ---------------------------------------------------------------------------

/**
 * Rewrite CDN script src attributes in HTML to local /assets/* paths.
 */
export function rewriteCdnSrcs(
  html: string,
  rewrites: Record<string, string>
): string {
  let result = html;
  for (const [cdnUrl, localPath] of Object.entries(rewrites)) {
    result = result.split(cdnUrl).join(localPath);
  }
  return result;
}
