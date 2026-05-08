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
    render(input: string, context?: Record<string, unknown>, options?: CompileOptions): Promise<string>;
}
export interface CompileOptions {
    components?: ComponentMap;
    globalStyles?: GlobalStyles;
    /** Async function to read included files. Required when NML uses @include. */
    readFile?: (path: string) => Promise<string>;
    /** Absolute path of the NML file being rendered — resolves relative @include paths. */
    basePath?: string;
}
export declare const nmlCompiler: CompilerAdapter;
export { buildAst, generateHtml, renderVariables, NMLParserError, findComponentRootNode, parseLineRaw, isTruthy, postProcessConditionalsPass };
export type { RenderOptions };
export type { ASTNode, ComponentMap, GlobalStyles };
export { NMLLexerError } from "./lexer.js";
export type { SourceLocation, Token, TokenKind } from "./lexer.js";
//# sourceMappingURL=index.d.ts.map