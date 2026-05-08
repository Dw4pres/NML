/**
 * NML Renderer
 * Ports generate_html from nml_parse.py to TypeScript.
 * Walks the expanded AST and produces a formatted HTML string.
 *
 * generateHtml is async to support @include directives which may
 * read files from the filesystem, Cloudflare R2, D1, or memory.
 */
import { type ASTNode } from "./parser.js";
export interface RenderOptions {
    /** Async function to read a file by absolute path. Required for @include. */
    readFile?: (path: string) => Promise<string>;
    /** Absolute path of the file being rendered — used to resolve relative @include paths. */
    basePath?: string;
    /** Internal: tracks seen file paths for circular include detection. */
    _seenFiles?: Set<string>;
}
export declare function generateHtml(ast: ASTNode[], indentLevel?: number, context?: Record<string, unknown>, opts?: RenderOptions): Promise<string>;
//# sourceMappingURL=renderer.d.ts.map