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
// handleHotUpdate — true HMR (nml:update custom event, no full-reload)
// ---------------------------------------------------------------------------

describe("vite-plugin-nml handleHotUpdate", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "nml-plugin-hmr-"));
  });
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("sends nml:update custom event with rendered html on .nml change", async () => {
    const filePath = join(tmpDir, "index.nml");
    await writeFile(filePath, 'p("Hello HMR")', "utf-8");

    const plugin = nmlPlugin() as Plugin & {
      handleHotUpdate?: (ctx: { file: string; server: unknown }) => Promise<unknown[]>;
    };

    const sentMessages: unknown[] = [];
    const fakeServer = {
      moduleGraph: { getModuleById: () => null, invalidateModule: () => {} },
      ws: {
        send(msg: unknown) { sentMessages.push(msg); },
      },
    };

    await plugin.handleHotUpdate!({ file: filePath, server: fakeServer as any });

    expect(sentMessages).toHaveLength(1);
    const msg = sentMessages[0] as { type: string; event: string; data: { id: string; html: string } };
    expect(msg.type).toBe("custom");
    expect(msg.event).toBe("nml:update");
    expect(msg.data.id).toBe(filePath);
    expect(msg.data.html).toContain("<p>Hello HMR</p>");
  });

  it("returns [] (suppresses Vite's default full-reload) on .nml change", async () => {
    const filePath = join(tmpDir, "page.nml");
    await writeFile(filePath, "h1 | Page", "utf-8");

    const plugin = nmlPlugin() as Plugin & {
      handleHotUpdate?: (ctx: { file: string; server: unknown }) => Promise<unknown[]>;
    };

    const fakeServer = {
      moduleGraph: { getModuleById: () => null, invalidateModule: () => {} },
      ws: { send: () => {} },
    };

    const result = await plugin.handleHotUpdate!({ file: filePath, server: fakeServer as any });
    expect(result).toEqual([]);
  });

  it("falls back to full-reload when .nml has a parse error", async () => {
    const filePath = join(tmpDir, "broken.nml");
    await writeFile(filePath, "div\n  bad-indent", "utf-8");

    const plugin = nmlPlugin() as Plugin & {
      handleHotUpdate?: (ctx: { file: string; server: unknown }) => Promise<unknown[]>;
    };

    const sentMessages: unknown[] = [];
    const fakeServer = {
      moduleGraph: { getModuleById: () => null, invalidateModule: () => {} },
      ws: { send(msg: unknown) { sentMessages.push(msg); } },
    };

    await plugin.handleHotUpdate!({ file: filePath, server: fakeServer as any });

    const msg = sentMessages[0] as { type: string };
    expect(msg.type).toBe("full-reload");
  });

  it("returns undefined (no-op) for non-.nml files", async () => {
    const plugin = nmlPlugin() as Plugin & {
      handleHotUpdate?: (ctx: { file: string; server: unknown }) => Promise<unknown[] | undefined>;
    };

    const fakeServer = {
      moduleGraph: { getModuleById: () => null, invalidateModule: () => {} },
      ws: { send: () => {} },
    };

    const result = await plugin.handleHotUpdate!({ file: "/src/app.ts", server: fakeServer as any });
    expect(result).toBeUndefined();
  });
});

describe("vite-plugin-nml HMR client injection", () => {
  it("injects import.meta.hot handler into transformed module", async () => {
    const plugin = nmlPlugin();
    const result = await callTransform(plugin as Plugin, "p | Hello", "/views/index.nml");

    expect(result).not.toBeNull();
    expect(result!.code).toContain("import.meta.hot");
    expect(result!.code).toContain("nml:update");
    expect(result!.code).toContain("import.meta.hot.accept()");
  });

  it("injects the module id as the HMR key", async () => {
    const plugin = nmlPlugin();
    const result = await callTransform(plugin as Plugin, "p | Hello", "/views/about.nml");

    expect(result!.code).toContain("/views/about.nml");
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

// ---------------------------------------------------------------------------
// transform hook — @state (stateful files)
// ---------------------------------------------------------------------------

describe("vite-plugin-nml transform — @state", () => {
  it("emits byte-identical output for stateless files (regression)", async () => {
    const plugin = nmlPlugin();
    const result = await callTransform(
      plugin as Plugin,
      'div\n    p("Hello")',
      "/views/index.nml"
    );
    expect(result).not.toBeNull();
    expect(result!.code).toBe(STATELESS_GOLDEN);
  });

  it("stateful full page emits mount import, auto-mount, and state seeding", async () => {
    const plugin = nmlPlugin();
    const nml = [
      "@state.count(0)",
      "doctype.html",
      "html",
      "    head",
      "        title | Counter",
      "    body",
      "        p | Count: {{ count }}",
      '        button.on:click("count++") | Increment',
    ].join("\n");
    const result = await callTransform(plugin as Plugin, nml, "/views/index.nml");
    expect(result).not.toBeNull();
    const code = result!.code;
    expect(code).toContain('import { mountNmlState } from "@nml-lang/state";');
    expect(code).toContain('document.querySelector("script[data-nml-state]")');
    expect(code).toContain("mountNmlState({ render: render, initial: _initial })");
    expect(code).toContain("const _initialState = {\"count\":0};");
    expect(code).toContain("_withStatePayload");
    // Full-page heuristic: the auto-mount runs only in the browser.
    expect(code).toContain('typeof document !== "undefined"');
  });

  it("emitted payload escape survives codegen (double backslash)", async () => {
    // The emitted module is parsed as JS, so its replacement string must
    // contain a DOUBLED backslash ("\\u003c" in the emitted text), which
    // parses to the 6-char escape. A single backslash would emit "\u003c",
    // which parses to "<" and silently disables the escape on every
    // client-side re-render — a state value like "a</script>b" would then
    // break out of the payload script block.
    const plugin = nmlPlugin();
    const nml = [
      "@state.count(0)",
      "doctype.html",
      "html",
      "    body",
      "        p | {{ count }}",
    ].join("\n");
    const result = await callTransform(plugin as Plugin, nml, "/views/index.nml");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(String.raw`.replace(/</g, "\\u003c")`);
  });

  it("stateful fragment gets state seeding but no auto-mount", async () => {
    const plugin = nmlPlugin();
    const nml = [
      "@state.count(0)",
      "div",
      "    p | Count: {{ count }}",
      '    button.on:click("count++") | Increment',
    ].join("\n");
    const result = await callTransform(plugin as Plugin, nml, "/views/counter.nml");
    expect(result).not.toBeNull();
    const code = result!.code;
    expect(code).toContain("const _initialState = {\"count\":0};");
    expect(code).toContain("_withStatePayload");
    expect(code).not.toContain("@nml-lang/state");
    expect(code).not.toContain("mountNmlState");
    expect(code).not.toContain('document.querySelector("script[data-nml-state]")');
  });

  it("stateful file with top-level html but no doctype still auto-mounts", async () => {
    const plugin = nmlPlugin();
    const nml = [
      "@state.count(0)",
      "html",
      "    body",
      "        p | {{ count }}",
    ].join("\n");
    const result = await callTransform(plugin as Plugin, nml, "/views/index.nml");
    expect(result!.code).toContain('import { mountNmlState } from "@nml-lang/state";');
  });
});

// Golden output of nmlToEsm for a stateless file, captured from the
// pre-@state implementation. Any change to the stateless template must
// update this deliberately — it guards the zero-cost default.
const STATELESS_GOLDEN = String.raw`import { buildAst, generateHtml } from "@nml-lang/compiler-ts";

const _source = "div\n    p(\"Hello\")";
const _globalContext = {};
const _hmrKey = "/views/index.nml";

export async function render(context = {}) {
  const ast = buildAst(_source);
  return generateHtml(ast, 0, { ..._globalContext, ...context });
}

export const html = await render();
export default render;

if (import.meta.hot) {
  import.meta.hot.on("nml:update", async (data) => {
    if (data.id !== _hmrKey) return;
    const newHtml = data.html;
    document.querySelectorAll("[data-nml-src]").forEach((el) => {
      if (el.getAttribute("data-nml-src") === _hmrKey) {
        el.innerHTML = newHtml;
      }
    });
    if (!document.querySelector("[data-nml-src]")) {
      import.meta.hot.invalidate();
    }
  });
  import.meta.hot.accept();
}
`;
