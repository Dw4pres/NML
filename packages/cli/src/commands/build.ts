/**
 * commands/build.ts
 * `nml build`: run detector → download CDN assets → compile all .nml → bundle via Vite.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";
import { detectLibrariesInNml, getRegistry } from "../detector.js";
import { downloadByPrefix, rewriteCdnSrcs } from "../localizer.js";
import { scanRoutes, serializeRouteMap } from "@nml-lang/router";

async function collectNmlFiles(dir: string): Promise<string[]> {
  const { readdir } = await import("fs/promises");
  const { stat } = await import("fs/promises");
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectNmlFiles(fullPath)));
    } else if (entry.name.endsWith(".nml")) {
      results.push(fullPath);
    }
  }
  return results;
}

function spawnProcess(cmd: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function runBuild(cwd: string = process.cwd()): Promise<void> {
  const distDir = join(cwd, "dist");
  await mkdir(distDir, { recursive: true });

  // 1. Detect HTMX/Alpine usage across all NML files
  const viewsDir = join(cwd, "views");
  const nmlFiles = await collectNmlFiles(viewsDir);

  // Accumulate per-prefix detection across all files
  const detectedPrefixes = new Map<string, boolean>();

  for (const f of nmlFiles) {
    const src = await readFile(f, "utf-8");
    const det = detectLibrariesInNml(src);
    for (const [prefix, found] of det) {
      if (found) detectedPrefixes.set(prefix, true);
    }
  }

  // 2. Download detected libraries
  const rewrites: Record<string, string> = {};
  const registry = getRegistry();

  for (const [prefix, found] of detectedPrefixes) {
    if (!found) continue;
    const cdnUrl = registry.get(prefix);
    if (!cdnUrl) continue;
    const localPath = await downloadByPrefix(prefix, { distDir });
    rewrites[cdnUrl] = localPath;
    console.log(`  Downloaded ${prefix} →`, localPath);
  }

  // 3. Run Vite build
  console.log("\nRunning Vite build...");
  const exitCode = await spawnProcess("bun", ["x", "vite", "build"], cwd);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  // 4. Rewrite CDN src paths in built HTML files
  if (Object.keys(rewrites).length > 0) {
    const { readdir } = await import("fs/promises");
    const distEntries = await readdir(distDir, { withFileTypes: true });
    for (const entry of distEntries) {
      if (entry.name.endsWith(".html")) {
        const htmlPath = join(distDir, entry.name);
        const html = await readFile(htmlPath, "utf-8");
        const rewritten = rewriteCdnSrcs(html, rewrites);
        await writeFile(htmlPath, rewritten, "utf-8");
        console.log("  Rewrote CDN srcs in", entry.name);
      }
    }
  }

  // 5. Serialize RouteMap manifest for edge worker startup
  const routeMap = await scanRoutes(viewsDir).catch(() => []);
  if (routeMap.length > 0) {
    const manifestPath = join(distDir, "routes.json");
    await writeFile(manifestPath, serializeRouteMap(routeMap), "utf-8");
    console.log(`  Wrote route manifest → dist/routes.json (${routeMap.length} routes)`);
  }

  console.log("\nBuild complete! Output in dist/");
}
