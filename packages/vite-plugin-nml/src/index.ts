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
import {
  buildAstWithState,
  generateHtml,
  NMLParserError,
} from "@nml-lang/compiler-ts";

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
  // Validate by parsing (throws NMLParserError on bad input) and collect
  // the file's @state declarations. buildAstWithState runs the same
  // pipeline as buildAst, so validation behavior is unchanged.
  const { ast, state } = buildAstWithState(source);
  const hasState = Object.keys(state).length > 0;

  // Emit an ES module that re-parses + renders at runtime.
  // This keeps the module hot-reloadable and context-dynamic.
  const escaped = JSON.stringify(source);
  const ctxJson = JSON.stringify(globalContext);
  // Use the module id as the HMR channel key so each .nml file patches its own DOM nodes.
  const hmrKey = JSON.stringify(id);

  // Stateless files emit the original module byte-for-byte (regression-tested).
  // Stateful files get @state seeding, an SSR payload, and — for full pages —
  // an auto-mount block. See the stateful branch below.
  if (!hasState) {
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

  // Stateful files: seed @state into render() (mirroring TSCompiler.render —
  // explicit context wins on name collision) and append the SSR payload, so
  // the emitted module renders initial state correctly on its own.
  const stateJson = JSON.stringify(state);
  // Full-page heuristic: a top-level `html` element or `doctype.html`. Only
  // full pages auto-mount; a fragment with @state is mounted manually by the
  // app (see docs/templating.md). Nested `html` elements do not count.
  const isFullPage = ast.some(
    (n) => n.element === "html" || n.element === "doctype"
  );

  const mountImport = isFullPage
    ? `import { mountNmlState } from "@nml-lang/state";\n`
    : "";
  const autoMount = isFullPage
    ? `
let _stateMount = null;

if (typeof document !== "undefined") {
  // The page is already server-rendered with initial state; mounting only
  // wires the listeners. Prefer the SSR payload script when present (it
  // reflects context overrides); fall back to the embedded initial state.
  var _payloadEl = document.querySelector("script[data-nml-state]");
  var _initial = _initialState;
  try {
    if (_payloadEl && _payloadEl.textContent) _initial = JSON.parse(_payloadEl.textContent);
  } catch (e) { /* fall back to the embedded initial state */ }
  _stateMount = mountNmlState({ render: render, initial: _initial });
}
`
    : "";

  return `
import { buildAst, generateHtml } from "@nml-lang/compiler-ts";
${mountImport}
const _source = ${escaped};
const _globalContext = ${ctxJson};
const _hmrKey = ${hmrKey};
const _initialState = ${stateJson};
const _stateKeys = Object.keys(_initialState);

function _withStatePayload(html, merged) {
  var effective = {};
  for (var k = 0; k < _stateKeys.length; k++) {
    var key = _stateKeys[k];
    var v = merged[key];
    effective[key] = v === undefined ? _initialState[key] : v;
  }
  // NOTE: this string is GENERATED code, not code that runs here. The
  // generated module is parsed as JS, so the replacement string must be
  // written with a doubled backslash in this template (four here) — the
  // emitted text needs "\\u003c", which parses to the 6-char escape. A
  // single backslash here would emit "\u003c", which parses to "<" and
  // silently disables the escape on every client-side re-render.
  var script = '<script type="application/json" data-nml-state>' + JSON.stringify(effective).replace(/</g, "\\\\u003c") + '</script>';
  if (html.indexOf("</body>") !== -1) return html.replace("</body>", script + "\\n</body>");
  return html + "\\n" + script;
}

export async function render(context = {}) {
  const ast = buildAst(_source);
  const merged = { ..._initialState, ..._globalContext, ...context };
  const html = await generateHtml(ast, 0, merged);
  return _withStatePayload(html, merged);
}

export const html = await render();
export default render;
${autoMount}
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

/**
 * Render NML source with @state seeded, plus the SSR payload when state is
 * present — the build-time / HMR equivalent of TSCompiler.render. Used by
 * handleHotUpdate and generateBundle so server-rendered and SSG HTML for
 * stateful pages show initial values and carry the payload.
 */
async function renderWithState(
  source: string,
  context: Record<string, unknown>
): Promise<string> {
  const { ast, state } = buildAstWithState(source);
  const merged = { ...state, ...context };
  let html = await generateHtml(ast, 0, merged);
  if (Object.keys(state).length > 0) {
    const effective: Record<string, unknown> = {};
    for (const key of Object.keys(state)) {
      const v = merged[key];
      effective[key] = v === undefined ? state[key] : v;
    }
    const script = `<script type="application/json" data-nml-state>${JSON.stringify(effective).replace(/</g, "\\u003c")}</script>`;
    html = html.includes("</body>")
      ? html.replace("</body>", `${script}\n</body>`)
      : html + `\n${script}`;
  }
  return html;
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
      // State is seeded so stateful fragments re-render with initial values.
      // NOTE (v1 limit): HMR resets state to initial values. The auto-mount
      // block re-mounts on module re-import, and mountNmlState destroys any
      // previous mount for the same root, so listeners never double-fire —
      // but state changed since page load is lost on a hot update.
      try {
        const src = await readFile(file, "utf-8");
        const html = await renderWithState(src, globalContext);
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
          const html = await renderWithState(src, globalContext);
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
