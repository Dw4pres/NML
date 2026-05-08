/**
 * NML Renderer
 * Ports generate_html from nml_parse.py to TypeScript.
 * Walks the expanded AST and produces a formatted HTML string.
 *
 * generateHtml is async to support @include directives which may
 * read files from the filesystem, Cloudflare R2, D1, or memory.
 */
import { buildAst, renderVariables, isTruthy, NMLParserError } from "./parser.js";
import { dirname, join, resolve } from "path";
const INDENT_WIDTH = 4;
const VOID_ELEMENTS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
]);
export async function generateHtml(ast, indentLevel = 0, context = {}, opts = {}) {
    let html = "";
    const indent = " ".repeat(indentLevel * INDENT_WIDTH);
    for (const node of ast) {
        // Merge node-level context (component props)
        let nodeContext = context;
        if (node.__context__) {
            nodeContext = { ...context, ...node.__context__ };
        }
        // Plain text node
        if (node.element === "__text__") {
            html += `${indent}${renderVariables(node.content, nodeContext)}\n`;
            continue;
        }
        // @include — render-time partial resolution
        if (node.element === "@include") {
            html += await resolveInclude(node, indentLevel, nodeContext, opts);
            continue;
        }
        // @each — loop directive
        if (node.element === "@each") {
            const itemsPath = node.attributes["items"];
            const asName = node.attributes["as"];
            const arr = resolveContextPath(itemsPath, nodeContext);
            if (Array.isArray(arr)) {
                for (const item of arr) {
                    const childCtx = { ...nodeContext, [asName]: item };
                    html += await generateHtml(node.children, indentLevel, childCtx, opts);
                }
            }
            continue;
        }
        // @if — conditional directive
        if (node.element === "@if") {
            const condition = node.attributes["condition"];
            const condVal = resolveContextPath(condition, nodeContext);
            if (isTruthy(condVal)) {
                html += await generateHtml(node.children, indentLevel, nodeContext, opts);
            }
            else if (node.elseBranch && node.elseBranch.length > 0) {
                html += await generateHtml(node.elseBranch, indentLevel, nodeContext, opts);
            }
            continue;
        }
        // Internal structural nodes — skip (defensive: @else/@endif/@endeach removed by pass)
        if (["@define", "@slot", "@style", "__comment__", "__root__", "@else", "@endif", "@endeach"].includes(node.element)) {
            continue;
        }
        const tag = node.element;
        // Doctype
        if (tag === "doctype") {
            const cls = node.attributes["class"];
            const clsStr = Array.isArray(cls) ? cls.join(" ") : cls ?? "";
            if (clsStr === "html") {
                html += `${indent}<!DOCTYPE html>\n`;
            }
            continue;
        }
        // Build attribute string
        let attrString = "";
        for (const [key, value] of Object.entries(node.attributes)) {
            if (key.startsWith("__"))
                continue; // skip internal keys
            if (value === true) {
                attrString += ` ${key}`;
            }
            else if (Array.isArray(value)) {
                const rendered = renderVariables(value.join(" "), nodeContext);
                attrString += ` ${key}="${rendered}"`;
            }
            else {
                const rendered = renderVariables(String(value), nodeContext);
                attrString += ` ${key}="${rendered}"`;
            }
        }
        html += `${indent}<${tag}${attrString}`;
        // Void elements self-close
        if (VOID_ELEMENTS.has(tag)) {
            html += ">\n";
            continue;
        }
        html += ">";
        const content = renderVariables(node.content, nodeContext);
        const children = node.children;
        const multiline = node.multiline_content;
        if (content) {
            html += content;
        }
        else if (children.length > 0) {
            // Inline single text child
            if (children.length === 1 &&
                children[0].element === "__text__") {
                html += renderVariables(children[0].content, nodeContext);
            }
            else {
                html += "\n";
                html += await generateHtml(children, indentLevel + 1, nodeContext, opts);
                html += indent;
            }
        }
        else if (multiline.length > 0) {
            html += "\n";
            for (const line of multiline) {
                html += `${indent}    ${renderVariables(line, nodeContext)}\n`;
            }
            html += indent;
        }
        html += `</${tag}>\n`;
    }
    return indentLevel === 0 ? html.trimEnd() : html;
}
// ---------------------------------------------------------------------------
// @include resolution
// ---------------------------------------------------------------------------
async function resolveInclude(node, indentLevel, parentContext, opts) {
    const relativePath = node.attributes["file"];
    const overridesRaw = node.attributes["overrides"];
    if (!opts.readFile) {
        throw new NMLParserError(`@include("${relativePath}") requires a readFile option — pass it via CompilerAdapter.render() or nmlCompiler.render()`, node.loc);
    }
    // Resolve to absolute path
    const base = opts.basePath ? dirname(opts.basePath) : process.cwd();
    const absolutePath = resolve(join(base, relativePath));
    // Circular include detection
    const seen = opts._seenFiles ?? new Set();
    if (seen.has(absolutePath)) {
        throw new NMLParserError(`Circular @include detected: "${relativePath}" is already in the include stack`, node.loc);
    }
    // Read the partial source
    let src;
    try {
        src = await opts.readFile(absolutePath);
    }
    catch {
        throw new NMLParserError(`@include: cannot read file "${relativePath}" (resolved to "${absolutePath}")`, node.loc);
    }
    // Parse overrides: { ...parentCtx, ...overrides }
    let overrides = {};
    if (overridesRaw) {
        try {
            overrides = JSON.parse(overridesRaw);
        }
        catch {
            // Non-JSON override strings are silently ignored (may be complex expressions)
        }
    }
    const partialContext = { ...parentContext, ...overrides };
    // Parse and render the partial with child seen-set
    const childSeen = new Set(seen);
    childSeen.add(absolutePath);
    const ast = buildAst(src);
    return generateHtml(ast, indentLevel, partialContext, {
        ...opts,
        basePath: absolutePath,
        _seenFiles: childSeen,
    });
}
// ---------------------------------------------------------------------------
// Context path resolver (used by @each and @if)
// ---------------------------------------------------------------------------
function resolveContextPath(path, context) {
    const parts = path.split(".");
    let current = context;
    for (const part of parts) {
        if (current === null || current === undefined)
            return undefined;
        current = current[part];
    }
    return current;
}
//# sourceMappingURL=renderer.js.map