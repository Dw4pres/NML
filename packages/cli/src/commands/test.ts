/**
 * commands/test.ts
 * `nml test` pipeline:
 * 1. Glob all *.nml files under views/ and templates/
 * 2. Dry-run lint each file via nmlCompiler.render()
 * 3. Fail-fast on any parse error (print file + line, exit 1)
 * 4. If all clean → spawn `bun test` and inherit its exit code
 */

import { readFile, access } from "fs/promises";
import { join, relative } from "path";
import { nmlCompiler, NMLParserError } from "@nml/compiler-ts";
import { spawn } from "child_process";

async function findNmlFiles(cwd: string): Promise<string[]> {
  const dirs = ["views", "templates"];
  const files: string[] = [];

  for (const dir of dirs) {
    const dirPath = join(cwd, dir);
    const exists = await access(dirPath).then(() => true).catch(() => false);
    if (!exists) continue;

    // Use manual recursive glob via fs
    const found = await collectNmlFiles(dirPath);
    files.push(...found);
  }

  return files;
}

async function collectNmlFiles(dir: string): Promise<string[]> {
  const { readdir, stat } = await import("fs/promises");
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

function spawnBunTest(cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["test"], {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function runTest(cwd: string = process.cwd()): Promise<void> {
  const files = await findNmlFiles(cwd);

  if (files.length > 0) {
    console.log(`\nNML lint: checking ${files.length} file(s)...\n`);

    for (const filePath of files) {
      const src = await readFile(filePath, "utf-8");
      try {
        await nmlCompiler.render(src);
      } catch (err) {
        if (err instanceof NMLParserError) {
          const rel = relative(cwd, filePath);
          console.error(`\n  Error in ${rel}:${err.loc.line}:${err.loc.column}`);
          console.error(`  ${err.message}\n`);
        } else {
          console.error(`\n  Unexpected error in ${filePath}:`, err);
        }
        process.exit(1);
      }
    }

    console.log("  All NML files are valid.\n");
  } else {
    console.log("\nNML lint: no .nml files found, skipping lint.\n");
  }

  // Delegate to Vitest
  const exitCode = await spawnBunTest(cwd);
  process.exit(exitCode);
}
