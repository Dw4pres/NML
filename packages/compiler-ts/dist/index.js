/**
 * @nml/compiler-ts — public API
 *
 * Exports the CompilerAdapter interface so consumers (CLI, Vite plugin,
 * Cloudflare Worker, MCP server) always program against the interface,
 * never a concrete class. A future @nml/compiler-wasm package will export
 * a WasmCompiler satisfying the same interface.
 */
import { buildAst, buildAstWithState, renderVariables, NMLParserError, findComponentRootNode, parseLineRaw, isTruthy, postProcessConditionalsPass } from "./parser.js";
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
        const { ast, state } = buildAstWithState(input, { components, globalStyles });
        // Declared @state seeds the render context; explicit context passed to
        // render() wins on name collision (see docs/templating.md).
        const effectiveContext = seedStateContext(state, context);
        let html = await generateHtml(ast, 0, effectiveContext, renderOpts);
        // SSR state payload — the contract the future client runtime consumes.
        // Files with no @state render byte-identical to before (no script tag).
        if (Object.keys(state).length > 0) {
            const script = `<script type="application/json" data-nml-state>${buildStatePayload(state, context)}</script>`;
            if (html.includes("</body>")) {
                html = html.replace("</body>", `${script}\n</body>`);
            }
            else {
                html += `\n${script}`;
            }
        }
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
/**
 * Merge declared @state initial values under the explicit render context.
 * Explicit context wins on name collision; an explicit `undefined` does not
 * shadow an initial value.
 */
function seedStateContext(state, context) {
    const seeded = { ...state };
    for (const [key, value] of Object.entries(context)) {
        if (value !== undefined)
            seeded[key] = value;
    }
    return seeded;
}
/**
 * Serialise the effective initial state (context overrides applied) for the
 * SSR payload. `<` is escaped so a state string value can never break out of
 * the <script> block. Falls back to the declared initial values if an
 * explicit context override is not JSON-serialisable.
 */
function buildStatePayload(state, context) {
    const effective = {};
    for (const [name, initial] of Object.entries(state)) {
        effective[name] = name in context && context[name] !== undefined ? context[name] : initial;
    }
    const escape = (json) => json.replace(/</g, "\\u003c");
    try {
        return escape(JSON.stringify(effective));
    }
    catch {
        return escape(JSON.stringify(state));
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
export { buildAst, buildAstWithState, generateHtml, renderVariables, NMLParserError, findComponentRootNode, parseLineRaw, isTruthy, postProcessConditionalsPass };
export { NMLLexerError } from "./lexer.js";
//# sourceMappingURL=index.js.map