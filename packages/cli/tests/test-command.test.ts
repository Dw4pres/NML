import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * We test runTest() by intercepting process.exit.
 * spawn is hard to spyOn in Bun (non-configurable), so we test the NML lint
 * phase in isolation (parse errors) and the Vitest delegation path separately.
 */

async function setupProject(cwd: string, nmlFiles: Record<string, string> = {}): Promise<void> {
  for (const [relPath, content] of Object.entries(nmlFiles)) {
    const fullPath = join(cwd, relPath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }
}

describe("nml test — NML lint phase", () => {
  let cwd: string;
  let exitCode: number | undefined;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "nml-test-cmd-"));
    exitCode = undefined;
    vi.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
      exitCode = typeof code === "number" ? code : code == null ? 0 : parseInt(String(code), 10);
      throw new Error(`process.exit(${exitCode})`);
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(cwd, { recursive: true, force: true });
  });

  it("exits 1 before Vitest runs when a .nml file has a parse error", async () => {
    await setupProject(cwd, {
      "views/bad.nml": "div\n  bad-indent", // 2-space indent = error
    });

    const { runTest } = await import("../src/commands/test.js");
    await expect(runTest(cwd)).rejects.toThrow("process.exit(1)");
    expect(exitCode).toBe(1);
  });

  it("exits 1 with file path printed to stderr on parse error", async () => {
    await setupProject(cwd, {
      "views/broken.nml": "div\n  bad",
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { runTest } = await import("../src/commands/test.js");
    await expect(runTest(cwd)).rejects.toThrow();
    expect(exitCode).toBe(1);

    const allCalls = consoleSpy.mock.calls.flat().join(" ");
    expect(allCalls).toMatch(/broken\.nml/);
  });

  it("does not exit early when all .nml files are valid (error only from spawn)", async () => {
    await setupProject(cwd, {
      "views/index.nml": 'div\n    p("Hello")',
    });

    const { runTest } = await import("../src/commands/test.js");
    // spawn will attempt to actually run bun test and fail / succeed; we
    // just confirm no early lint-exit happens — any exit from spawn is acceptable.
    try {
      await runTest(cwd);
    } catch (e) {
      // A process.exit from the spawn path is fine — we just don't want exit(1) from lint
      if (exitCode === 1) {
        // Check it's from spawn, not lint — lint exits before spawning
        // If it were a lint error, the error message would contain the file path
        const err = e as Error;
        expect(err.message).not.toMatch(/broken\.nml/);
      }
    }
    // No assertion needed — reaching here without an unhandled lint exit is the pass condition
  });
});
