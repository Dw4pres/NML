/**
 * @nml/compiler-ts — public API
 *
 * Exports the CompilerAdapter interface so consumers (CLI, Vite plugin,
 * Cloudflare Worker, MCP server) always program against the interface,
 * never a concrete class. A future @nml/compiler-wasm package will export
 * a WasmCompiler satisfying the same interface.
 */

import { buildAst, renderVariables, NMLParserError, findComponentRootNode, parseLineRaw, isTruthy, postProcessConditionalsPass } from "./parser.js";
import { generateHtml, type RenderOptions } from "./renderer.js";
import type { ASTNode, ComponentMap, GlobalStyles } from "./parser.js";

// ---------------------------------------------------------------------------
// Public interface contract
// ---------------------------------------------------------------------------

export interface CompilerAdapter {
  /**
   * Compile a raw NML string to an HTML string.
   * Returns a Promise — async to support @include directives that read
   * files from the filesystem, Cloudflare R2, D1, or in-memory stores.
   *
   * @param input   - Raw NML source
   * @param context - Optional template variable context
   * @param options - Optional components, global styles, readFile, basePath
   */
  render(
    input: string,
    context?: Record<string, unknown>,
    options?: CompileOptions
  ): Promise<string>;
}

export interface CompileOptions {
  components?: ComponentMap;
  globalStyles?: GlobalStyles;
  /** Async function to read included files. Required when NML uses @include. */
  readFile?: (path: string) => Promise<string>;
  /** Absolute path of the NML file being rendered — resolves relative @include paths. */
  basePath?: string;
}

// ---------------------------------------------------------------------------
// Default TypeScript engine
// ---------------------------------------------------------------------------

class TSCompiler implements CompilerAdapter {
  async render(
    input: string,
    context: Record<string, unknown> = {},
    options: CompileOptions = {}
  ): Promise<string> {
    const components: ComponentMap = options.components ?? {};
    const globalStyles: GlobalStyles = options.globalStyles ?? {};

    const renderOpts: RenderOptions = {
      readFile: options.readFile,
      basePath: options.basePath,
    };

    const ast = buildAst(input, { components, globalStyles });
    let html = await generateHtml(ast, 0, context, renderOpts);

    // Inject scoped styles if any are present
    if (Object.keys(globalStyles).length > 0) {
      const usedScopeIds = collectScopeIds(ast);
      const usedStyles: string[] = [];
      for (const sid of usedScopeIds) {
        if (sid in globalStyles) {
          usedStyles.push(globalStyles[sid]);
        }
      }
      if (usedStyles.length > 0) {
        const styleTag = `<style data-nml-scoped-styles>\n${usedStyles.join("\n")}\n</style>`;
        if (html.includes("</head>")) {
          html = html.replace("</head>", `${styleTag}\n</head>`);
        } else {
          html = styleTag + "\n" + html;
        }
      }
    }

    return html;
  }
}

function collectScopeIds(nodes: ASTNode[]): Set<string> {
  const ids = new Set<string>();
  function walk(items: ASTNode[]) {
    for (const n of items) {
      for (const k of Object.keys(n.attributes)) {
        if (k.startsWith("nml-c-")) ids.add(k);
      }
      if (n.children.length > 0) walk(n.children);
    }
  }
  walk(nodes);
  return ids;
}

// ---------------------------------------------------------------------------
// Singleton default export — V8-optimised TS engine
// ---------------------------------------------------------------------------

export const nmlCompiler: CompilerAdapter = new TSCompiler();

// ---------------------------------------------------------------------------
// Re-exports for advanced consumers
// ---------------------------------------------------------------------------

export { buildAst, generateHtml, renderVariables, NMLParserError, findComponentRootNode, parseLineRaw, isTruthy, postProcessConditionalsPass };
export type { RenderOptions };
export type { ASTNode, ComponentMap, GlobalStyles };
export { NMLLexerError } from "./lexer.js";
export type { SourceLocation, Token, TokenKind } from "./lexer.js";
