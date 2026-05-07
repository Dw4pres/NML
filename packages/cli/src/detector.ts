/**
 * detector.ts
 * Walks a compiled HTML string or NML source and detects prefix-bearing
 * attributes (hx-*, x-*, or any registered custom prefix).
 *
 * Phase 9: DetectionResult refactored from boolean struct to Map<prefix, boolean>
 * so the engine is open-ended: any library prefix is detectable without code changes.
 */

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Map of prefix → CDN URL registered via registerLibrary() */
const _prefixRegistry: Map<string, string> = new Map([
  ["hx-", "https://unpkg.com/htmx.org/dist/htmx.min.js"],
  ["x-", "https://cdn.jsdelivr.net/npm/alpinejs/dist/cdn.min.js"],
]);

/**
 * Register a custom library prefix + CDN URL.
 * After calling this, detector and localizer both become aware of the new prefix.
 *
 * @example
 * registerLibrary("_", "https://cdn.example.com/hyperscript.js");
 */
export function registerLibrary(prefix: string, cdnUrl: string): void {
  _prefixRegistry.set(prefix, cdnUrl);
}

/** Returns a copy of the current prefix → cdnUrl registry. */
export function getRegistry(): Map<string, string> {
  return new Map(_prefixRegistry);
}

// ---------------------------------------------------------------------------
// DetectionResult
// ---------------------------------------------------------------------------

/**
 * Map from prefix (e.g. "hx-", "x-") to whether it was found.
 * Replaces the old { hasHtmx, hasAlpine } struct.
 * Vanilla Mode = every entry is false (or map is empty).
 */
export type DetectionResult = Map<string, boolean>;

/** Returns true if any registered prefix was detected (non-Vanilla Mode). */
export function anyDetected(result: DetectionResult): boolean {
  for (const found of result.values()) {
    if (found) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Detection functions
// ---------------------------------------------------------------------------

/**
 * Scan a compiled HTML string for registered prefix attributes.
 */
export function detectLibraries(html: string): DetectionResult {
  const result: DetectionResult = new Map();
  for (const prefix of _prefixRegistry.keys()) {
    // Match space + prefix + letter (attribute in HTML)
    const escaped = prefix.replace(/-/g, "\\-");
    result.set(prefix, new RegExp(`\\s${escaped}[a-z]`).test(html));
  }
  return result;
}

/**
 * Scan NML source text for registered prefix attribute chains without compiling.
 * Looks for patterns like `.hx-post(`, `.x-data(`, or bare `.hx-boost`.
 * Also matches colon-form: `.hx:post(`, `.x:data(` (Phase 9 sugar).
 */
export function detectLibrariesInNml(nml: string): DetectionResult {
  const result: DetectionResult = new Map();
  for (const prefix of _prefixRegistry.keys()) {
    // prefix may be "hx-" → also match "hx:" sugar form
    const stem = prefix.endsWith("-") ? prefix.slice(0, -1) : prefix;
    const escapedPrefix = prefix.replace(/-/g, "\\-");
    const dashForm = new RegExp(`\\.${escapedPrefix}[a-z]`).test(nml);
    const colonForm = new RegExp(`\\.${stem}:[a-z]`).test(nml);
    result.set(prefix, dashForm || colonForm);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Legacy compat helpers (used by build.ts until it's updated to new API)
// ---------------------------------------------------------------------------

/** @deprecated Use detectLibrariesInNml() + result.get("hx-") / result.get("x-") */
export function detectLibrariesInNmlLegacy(nml: string): { hasHtmx: boolean; hasAlpine: boolean } {
  const r = detectLibrariesInNml(nml);
  return { hasHtmx: r.get("hx-") ?? false, hasAlpine: r.get("x-") ?? false };
}
