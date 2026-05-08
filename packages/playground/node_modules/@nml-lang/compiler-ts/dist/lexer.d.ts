/**
 * NML Lexer
 * Tokenizes raw NML source text into a stream of typed tokens,
 * each carrying precise source location (line, column) for error
 * reporting and Vite overlay / MCP diagnostics.
 */
export interface SourceLocation {
    line: number;
    column: number;
}
export type TokenKind = "INDENT" | "ELEMENT" | "ATTR_CHAIN" | "MULTILINE_START" | "MULTILINE_LINE" | "COMMENT" | "BLANK" | "EOF";
export interface Token {
    kind: TokenKind;
    value: string;
    loc: SourceLocation;
    /** For INDENT tokens: indentation level (0-based, each level = 4 spaces) */
    level?: number;
}
/**
 * Tokenize NML source into a flat array of line-level tokens.
 * Each "line" of NML produces at most one primary token; multiline
 * blocks consume multiple raw lines and emit MULTILINE_LINE tokens
 * for each.
 */
export declare function tokenize(source: string): Token[];
export declare class NMLLexerError extends Error {
    loc: SourceLocation;
    constructor(message: string, loc: SourceLocation);
}
//# sourceMappingURL=lexer.d.ts.map