/**
 * vite-plugin-nml
 *
 * Vite transform plugin for NML files.
 *
 * In dev mode: transforms *.nml imports to an ES module exporting:
 *   - default: () => string  (render function, accepts optional context)
 *   - html: string           (pre-rendered with empty context)
 *
 * In build mode: also emits a compiled HTML file for each NML file
 * found under views/ (for static/SSG builds).
 *
 * HMR: invalidates the module when the .nml source changes.
 */

import type { Plugin, ViteDevServer } from "vite";
import { readFile } from "fs/promises";
import { resolve, relative, join } from "path";
import { buildAst, generateHtml, NMLParserError } from "@nml-lang/compiler-ts";

export interface NmlPluginOptions {
  /** Directory to scan for .nml files in build mode. Default: "views" */
  viewsDir?: string;
  /**
   * Map of named component maps to load from a .nml file on disk.
   * Key = component map name (unused for now — loaded via componentsFile).
   */
  componentsFile?: string;
  /** Extra context variables available to all templates. Default: {} */
  globalContext?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Module transform: .nml → ES module
// ---------------------------------------------------------------------------

function nmlToEsm(source: string, id: string, globalContext: Record<string, unknown>): string {
  // Validate by parsing (throws NMLParserError on bad input)
  buildAst(source);

  // Emit an ES module that re-parses + renders at runtime.
  // This keeps the module hot-reloadable and context-dynamic.
  const escaped = JSON.stringify(source);
  const ctxJson = JSON.stringify(globalContext);
  // Use the module id as the HMR channel key so each .nml file patches its own DOM nodes.
  const hmrKey = JSON.stringify(id);

  return `
import { buildAst, generateHtml } from "@nml-lang/compiler-ts";

const _source = ${escaped};
const _globalContext = ${ctxJson};
const _hmrKey = ${hmrKey};

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
`.trimStart();
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export default function nmlPlugin(options: NmlPluginOptions = {}): Plugin {
  const {
    viewsDir = "views",
    globalContext = {},
  } = options;

  let root = process.cwd();

  return {
    name: "vite-plugin-nml",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    // Transform *.nml imports to ES modules
    async transform(code, id) {
      if (!id.endsWith(".nml")) return null;

      try {
        return {
          code: nmlToEsm(code, id, globalContext),
          map: null,
        };
      } catch (err) {
        if (err instanceof NMLParserError) {
          const rel = relative(root, id);
          this.error(`NML parse error in ${rel}:${err.loc.line}:${err.loc.column} — ${err.message}`);
        }
        throw err;
      }
    },

    // Resolve bare .nml imports without extension
    resolveId(id, importer) {
      if (id.endsWith(".nml") && importer) {
        return resolve(importer, "..", id);
      }
      return null;
    },

    // Load .nml files from disk (needed when Vite doesn't auto-read them)
    async load(id) {
      if (!id.endsWith(".nml")) return null;
      try {
        return await readFile(id, "utf-8");
      } catch {
        return null;
      }
    },

    // HMR: DOM-patch .nml files without a full page reload
    async handleHotUpdate({ file, server }: { file: string; server: ViteDevServer }) {
      if (!file.endsWith(".nml")) return;

      const mod = server.moduleGraph.getModuleById(file);
      if (mod) server.moduleGraph.invalidateModule(mod);

      // Re-render the changed file and push an nml:update event to the client.
      // The client-side HMR handler (injected by nmlToEsm) patches the DOM in place.
      try {
        const src = await readFile(file, "utf-8");
        const ast = buildAst(src);
        const html = await generateHtml(ast, 0, globalContext);
        server.ws.send({
          type: "custom",
          event: "nml:update",
          data: { id: file, html },
        });
      } catch {
        // Parse error — fall back to full reload so Vite can show the overlay
        server.ws.send({ type: "full-reload" });
      }

      return [];
    },

    // Build mode: emit compiled HTML for each views/*.nml
    async generateBundle() {
      const viewsPath = join(root, viewsDir);
      const files = await collectNmlFiles(viewsPath);

      for (const filePath of files) {
        const src = await readFile(filePath, "utf-8").catch(() => null);
        if (!src) continue;

        try {
          const ast = buildAst(src);
          const html = await generateHtml(ast, 0, globalContext);
          const rel = relative(viewsPath, filePath).replace(/\.nml$/, ".html");

          this.emitFile({
            type: "asset",
            fileName: rel,
            source: html,
          });
        } catch (err) {
          if (err instanceof NMLParserError) {
            const rel = relative(root, filePath);
            this.error(`NML parse error in ${rel}:${err.loc.line}:${err.loc.column} — ${err.message}`);
          }
          throw err;
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectNmlFiles(dir: string): Promise<string[]> {
  const { readdir } = await import("fs/promises");
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
