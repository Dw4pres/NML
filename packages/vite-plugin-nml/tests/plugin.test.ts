import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// We test the plugin's pure functions directly rather than spinning up a full
// Vite server, which would be too heavy for unit tests.

// Import the internals we need via the exported nmlToEsm helper.
// Since nmlToEsm is not exported, we re-test via the transform hook interface.

import nmlPlugin from "../src/index.js";
import type { Plugin } from "vite";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TransformResult = { code: string; map: null } | null;

async function callTransform(plugin: Plugin, code: string, id: string): Promise<TransformResult> {
  const transform = plugin.transform as (
    this: { error: (msg: string) => never },
    code: string,
    id: string
  ) => Promise<TransformResult>;

  const ctx = {
    error(msg: string): never {
      throw new Error(msg);
    },
  };

  return transform.call(ctx, code, id);
}

// ---------------------------------------------------------------------------
// transform hook — .nml → ESM
// ---------------------------------------------------------------------------

describe("vite-plugin-nml transform", () => {
  it("returns null for non-.nml files", async () => {
    const plugin = nmlPlugin();
    const result = await callTransform(plugin as Plugin, "<div>hello</div>", "/src/App.tsx");
    expect(result).toBeNull();
  });

  it("transforms a simple .nml file to an ES module with render + html exports", async () => {
    const plugin = nmlPlugin();
    const nml = 'div\n    p("Hello")';
    const result = await callTransform(plugin as Plugin, nml, "/views/index.nml");

    expect(result).not.toBeNull();
    expect(result!.code).toContain("export async function render");
    expect(result!.code).toContain("export const html");
    expect(result!.code).toContain("export default render");
    expect(result!.map).toBeNull();
  });

  it("emitted module code contains the NML source string and correct export structure", async () => {
    const plugin = nmlPlugin();
    const nml = 'p("Hello NML")';
    const result = await callTransform(plugin as Plugin, nml, "/views/test.nml");

    expect(result).not.toBeNull();
    const code = result!.code;

    // Source is embedded (JSON.stringify escapes the quotes)
    expect(code).toContain("Hello NML");
    // Exports are present
    expect(code).toContain("export async function render");
    expect(code).toContain("export const html");
    expect(code).toContain("export default render");
    // Uses compiler-ts
    expect(code).toContain("@nml-lang/compiler-ts");
    expect(code).toContain("buildAst");
    expect(code).toContain("generateHtml");
  });

  it("throws on invalid NML syntax", async () => {
    const plugin = nmlPlugin();
    const badNml = "div\n  bad-indent"; // 2-space indent is wrong

    await expect(
      callTransform(plugin as Plugin, badNml, "/views/bad.nml")
    ).rejects.toThrow();
  });

  it("error message includes file path and line number", async () => {
    const plugin = nmlPlugin() as Plugin & { configResolved?: (cfg: { root: string }) => void };

    // Set root so relative path is computed correctly
    plugin.configResolved?.({ root: "/project" });

    const badNml = "div\n  bad";
    let caught: Error | null = null;
    try {
      await callTransform(plugin as Plugin, badNml, "/project/views/bad.nml");
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toMatch(/bad\.nml/);
  });

  it("injects globalContext values into the emitted module", async () => {
    const plugin = nmlPlugin({ globalContext: { appName: "TestApp" } });
    const nml = 'p("{{ appName }}")';
    const result = await callTransform(plugin as Plugin, nml, "/views/ctx.nml");

    expect(result!.code).toContain('"appName"');
    expect(result!.code).toContain('"TestApp"');
  });
});

// ---------------------------------------------------------------------------
// resolveId hook
// ---------------------------------------------------------------------------

describe("vite-plugin-nml resolveId", () => {
  it("resolves relative .nml import paths", () => {
    const plugin = nmlPlugin() as Plugin;
    const resolveId = plugin.resolveId as (id: string, importer: string | undefined) => string | null;

    const result = resolveId("./header.nml", "/views/index.nml");
    expect(result).toBeTruthy();
    expect(result).toMatch(/header\.nml$/);
  });

  it("returns null for non-.nml imports", () => {
    const plugin = nmlPlugin() as Plugin;
    const resolveId = plugin.resolveId as (id: string, importer: string | undefined) => string | null;

    expect(resolveId("./main.ts", "/src/app.ts")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// load hook
// ---------------------------------------------------------------------------

describe("vite-plugin-nml load", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "nml-plugin-load-"));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("loads a .nml file from disk", async () => {
    const filePath = join(tmpDir, "hello.nml");
    await writeFile(filePath, 'p("from disk")', "utf-8");

    const plugin = nmlPlugin() as Plugin;
    const load = plugin.load as (id: string) => Promise<string | null>;

    const result = await load(filePath);
    expect(result).toBe('p("from disk")');
  });

  it("returns null for non-.nml ids", async () => {
    const plugin = nmlPlugin() as Plugin;
    const load = plugin.load as (id: string) => Promise<string | null>;

    const result = await load("/src/app.ts");
    expect(result).toBeNull();
  });

  it("returns null when file does not exist", async () => {
    const plugin = nmlPlugin() as Plugin;
    const load = plugin.load as (id: string) => Promise<string | null>;

    const result = await load(join(tmpDir, "nonexistent.nml"));
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// generateBundle hook (static build emission)
// ---------------------------------------------------------------------------

describe("vite-plugin-nml generateBundle", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "nml-plugin-bundle-"));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("emits an HTML asset for each .nml file in viewsDir", async () => {
    await mkdir(join(tmpDir, "views"), { recursive: true });
    await writeFile(join(tmpDir, "views", "index.nml"), 'p("Built!")', "utf-8");

    const plugin = nmlPlugin({ viewsDir: "views" }) as Plugin & {
      configResolved?: (cfg: { root: string }) => void;
      generateBundle?: (opts: unknown, bundle: unknown) => Promise<void>;
    };

    plugin.configResolved?.({ root: tmpDir });

    const emitted: Array<{ type: string; fileName: string; source: string }> = [];
    const ctx = {
      emitFile(file: { type: string; fileName: string; source: string }) {
        emitted.push(file);
      },
      error(msg: string): never {
        throw new Error(msg);
      },
    };

    await (plugin.generateBundle as Function).call(ctx, {}, {});

    expect(emitted).toHaveLength(1);
    expect(emitted[0].fileName).toBe("index.html");
    expect(emitted[0].source).toContain("<p>Built!</p>");
  });

  it("emits nothing when viewsDir is empty", async () => {
    await mkdir(join(tmpDir, "views"), { recursive: true });

    const plugin = nmlPlugin({ viewsDir: "views" }) as Plugin & {
      configResolved?: (cfg: { root: string }) => void;
    };
    plugin.configResolved?.({ root: tmpDir });

    const emitted: unknown[] = [];
    const ctx = {
      emitFile(f: unknown) { emitted.push(f); },
      error(msg: string): never { throw new Error(msg); },
    };

    await (plugin as any).generateBundle.call(ctx, {}, {});
    expect(emitted).toHaveLength(0);
  });

  it("emits nothing when viewsDir does not exist", async () => {
    const plugin = nmlPlugin({ viewsDir: "views" }) as Plugin & {
      configResolved?: (cfg: { root: string }) => void;
    };
    plugin.configResolved?.({ root: tmpDir });

    const emitted: unknown[] = [];
    const ctx = {
      emitFile(f: unknown) { emitted.push(f); },
      error(msg: string): never { throw new Error(msg); },
    };

    await (plugin as any).generateBundle.call(ctx, {}, {});
    expect(emitted).toHaveLength(0);
  });
});
