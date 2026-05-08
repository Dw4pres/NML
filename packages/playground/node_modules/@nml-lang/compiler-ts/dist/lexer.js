/**
 * NML Lexer
 * Tokenizes raw NML source text into a stream of typed tokens,
 * each carrying precise source location (line, column) for error
 * reporting and Vite overlay / MCP diagnostics.
 */
const INDENT_WIDTH = 4;
/**
 * Tokenize NML source into a flat array of line-level tokens.
 * Each "line" of NML produces at most one primary token; multiline
 * blocks consume multiple raw lines and emit MULTILINE_LINE tokens
 * for each.
 */
export function tokenize(source) {
    const tokens = [];
    const rawLines = source.split("\n");
    let lineIdx = 0; // 0-based index into rawLines
    while (lineIdx < rawLines.length) {
        const rawLine = rawLines[lineIdx];
        const currentLine = lineIdx + 1; // 1-based
        const stripped = rawLine.trimEnd();
        // Blank line
        if (stripped.trim() === "") {
            tokens.push({ kind: "BLANK", value: "", loc: { line: currentLine, column: 0 } });
            lineIdx++;
            continue;
        }
        // Comment
        if (stripped.trimStart().startsWith("//")) {
            const col = stripped.length - stripped.trimStart().length;
            tokens.push({ kind: "COMMENT", value: stripped.trimStart(), loc: { line: currentLine, column: col } });
            lineIdx++;
            continue;
        }
        // Validate and measure indentation
        const leadingSpaces = stripped.length - stripped.trimStart().length;
        if (stripped.startsWith("\t")) {
            throw new NMLLexerError(`Indentation error on line ${currentLine}: Please use 4 spaces for indentation, not tabs.`, { line: currentLine, column: 0 });
        }
        if (leadingSpaces % INDENT_WIDTH !== 0) {
            throw new NMLLexerError(`Indentation error on line ${currentLine}: Non-standard indentation. Use 4 spaces per level.`, { line: currentLine, column: 0 });
        }
        const level = leadingSpaces / INDENT_WIDTH;
        const content = stripped.trimStart();
        // Check if this line is a multiline trigger (ends with ':' outside quotes)
        const isMultilineTrigger = isLineMultilineTrigger(content);
        // Emit INDENT + ELEMENT token for this line
        tokens.push({
            kind: "INDENT",
            value: "",
            level,
            loc: { line: currentLine, column: 0 },
        });
        tokens.push({
            kind: isMultilineTrigger ? "MULTILINE_START" : "ELEMENT",
            value: content,
            loc: { line: currentLine, column: leadingSpaces },
        });
        lineIdx++;
        // If multiline, consume subsequent indented lines
        if (isMultilineTrigger) {
            const blockStartLevel = level + 1;
            const blockStartCol = blockStartLevel * INDENT_WIDTH;
            while (lineIdx < rawLines.length) {
                const mlRaw = rawLines[lineIdx];
                const mlLine = lineIdx + 1;
                const mlStripped = mlRaw.trimEnd();
                // Blank lines are part of the block
                if (mlStripped.trim() === "") {
                    tokens.push({ kind: "MULTILINE_LINE", value: "", loc: { line: mlLine, column: 0 } });
                    lineIdx++;
                    continue;
                }
                const mlSpaces = mlStripped.length - mlStripped.trimStart().length;
                // Block ends when indentation returns to block level or less
                if (mlSpaces < blockStartCol) {
                    break;
                }
                // Validate indentation within block
                if (mlSpaces % INDENT_WIDTH !== 0) {
                    throw new NMLLexerError(`Indentation error on line ${mlLine}: Non-standard indentation. Use 4 spaces per level.`, { line: mlLine, column: 0 });
                }
                // Relative indent (strip the block-start indentation)
                const relativeIndent = " ".repeat(mlSpaces - blockStartCol);
                const mlContent = relativeIndent + mlStripped.trimStart();
                tokens.push({
                    kind: "MULTILINE_LINE",
                    value: mlContent,
                    loc: { line: mlLine, column: mlSpaces },
                });
                lineIdx++;
            }
        }
    }
    tokens.push({ kind: "EOF", value: "", loc: { line: rawLines.length + 1, column: 0 } });
    return tokens;
}
/**
 * Returns true if the NML line (already stripped of indent) ends with ':'
 * outside of any quoted string — indicating a multiline content block.
 */
function isLineMultilineTrigger(content) {
    let inQuote = false;
    let quoteChar = "";
    let i = 0;
    // Strip trailing whitespace before checking
    const trimmed = content.trimEnd();
    while (i < trimmed.length) {
        const ch = trimmed[i];
        if (inQuote) {
            if (ch === quoteChar)
                inQuote = false;
        }
        else {
            if (ch === '"' || ch === "'") {
                inQuote = true;
                quoteChar = ch;
            }
        }
        i++;
    }
    return !inQuote && trimmed.endsWith(":");
}
export class NMLLexerError extends Error {
    loc;
    constructor(message, loc) {
        super(message);
        this.name = "NMLLexerError";
        this.loc = loc;
    }
}
//# sourceMappingURL=lexer.js.map