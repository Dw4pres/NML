/**
 * @nml/compiler-ts — public API
 *
 * Exports the CompilerAdapter interface so consumers (CLI, Vite plugin,
 * Cloudflare Worker, MCP server) always program against the interface,
 * never a concrete class. A future @nml/compiler-wasm package will export
 * a WasmCompiler satisfying the same interface.
 */
import { buildAst, renderVariables, NMLParserError, findComponentRootNode, parseLineRaw, isTruthy, postProcessConditionalsPass } from "./parser.js";
import { generateHtml } from "./renderer.js";
// ---------------------------------------------------------------------------
// Default TypeScript engine
// ---------------------------------------------------------------------------
class TSCompiler {
    async render(input, context = {}, options = {}) {
        const components = options.components ?? {};
        const globalStyles = options.globalStyles ?? {};
        const renderOpts = {
            readFile: options.readFile,
            basePath: options.basePath,
        };
        const ast = buildAst(input, { components, globalStyles });
        let html = await generateHtml(ast, 0, context, renderOpts);
        // Inject scoped styles if any are present
        if (Object.keys(globalStyles).length > 0) {
            const usedScopeIds = collectScopeIds(ast);
            const usedStyles = [];
            for (const sid of usedScopeIds) {
                if (sid in globalStyles) {
                    usedStyles.push(globalStyles[sid]);
                }
            }
            if (usedStyles.length > 0) {
                const styleTag = `<style data-nml-scoped-styles>\n${usedStyles.join("\n")}\n</style>`;
                if (html.includes("</head>")) {
                    html = html.replace("</head>", `${styleTag}\n</head>`);
                }
                else {
                    html = styleTag + "\n" + html;
                }
            }
        }
        return html;
    }
}
function collectScopeIds(nodes) {
    const ids = new Set();
    function walk(items) {
        for (const n of items) {
            for (const k of Object.keys(n.attributes)) {
                if (k.startsWith("nml-c-"))
                    ids.add(k);
            }
            if (n.children.length > 0)
                walk(n.children);
        }
    }
    walk(nodes);
    return ids;
}
// ---------------------------------------------------------------------------
// Singleton default export — V8-optimised TS engine
// ---------------------------------------------------------------------------
export const nmlCompiler = new TSCompiler();
// ---------------------------------------------------------------------------
// Re-exports for advanced consumers
// ---------------------------------------------------------------------------
export { buildAst, generateHtml, renderVariables, NMLParserError, findComponentRootNode, parseLineRaw, isTruthy, postProcessConditionalsPass };
export { NMLLexerError } from "./lexer.js";
//# sourceMappingURL=index.js.map