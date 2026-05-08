/**
 * NML Parser
 * Ports nml_parse.py's build_ast, _expand_components_pass,
 * _inject_slot, and related helpers to TypeScript.
 *
 * Every ASTNode carries loc: { line, column } sourced from the lexer.
 */
import { type SourceLocation } from "./lexer.js";
export interface SourceLocation2 extends SourceLocation {
}
export interface ASTNode {
    element: string;
    attributes: Record<string, string | boolean | string[]>;
    content: string;
    children: ASTNode[];
    multiline_trigger: boolean;
    multiline_content: string[];
    loc: SourceLocation;
    /** Internal: node-level context override (props) */
    __context__?: Record<string, unknown>;
    /** Set by postProcessConditionalsPass on @if nodes: the else-branch children */
    elseBranch?: ASTNode[];
}
export type ComponentMap = Record<string, ASTNode[]>;
export type GlobalStyles = Record<string, string>;
export declare class NMLParserError extends Error {
    loc: SourceLocation;
    constructor(message: string, loc?: SourceLocation);
}
export declare function parseLine(rawContent: string, loc: SourceLocation): ASTNode;
/**
 * The Python parser supports `h1("Hello")` as shorthand for content.
 * In NML the element line is like `h1.class("blue", "Hello")` or `h1("Hello")`.
 * We need to detect when the "attribute name" equals the element name
 * and treat the value as content instead.
 */
export declare function parseLineRaw(rawLine: string, loc: SourceLocation): ASTNode;
export declare function buildAst(source: string, options?: {
    components?: ComponentMap;
    globalStyles?: GlobalStyles;
}): ASTNode[];
export declare function findComponentRootNode(ast: ASTNode[]): ASTNode | null;
export declare function isTruthy(val: unknown): boolean;
export declare function renderVariables(template: string, context: Record<string, unknown>): string;
/**
 * Because NML is indentation-based, @else / @endif appear as SIBLINGS of @if
 * in the parent array (not as children). This pass:
 *   - Finds @if nodes at index i
 *   - Looks ahead for @else at i+1 → moves its children into node.elseBranch
 *   - Removes the @else and @endif siblings
 *   - Removes @endeach siblings (children already captured by indentation)
 *   - Recurses into every node's children array
 */
export declare function postProcessConditionalsPass(nodes: ASTNode[]): ASTNode[];
//# sourceMappingURL=parser.d.ts.map