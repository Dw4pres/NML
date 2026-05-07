/**
 * tools.ts
 * Pure handler functions for each NML MCP tool.
 * No I/O side-effects — accepts injected readFile for testability.
 */

import { buildAst, nmlCompiler, NMLParserError } from "@nml/compiler-ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompileResult {
  ok: true;
  html: string;
}

export interface ErrorResult {
  ok: false;
  error: string;
  line?: number;
  column?: number;
}

export type ToolResult = CompileResult | ErrorResult;

export interface ComponentInfo {
  name: string;
  hasSlot: boolean;
  hasStyle: boolean;
  props: string[];
}

export interface ListComponentsResult {
  ok: true;
  components: ComponentInfo[];
}

export interface LintResult {
  ok: true;
  valid: boolean;
  errors: Array<{ message: string; line: number; column: number }>;
}

// ---------------------------------------------------------------------------
// compile
// Tool: Compile an NML source string to HTML.
// ---------------------------------------------------------------------------

export async function compile(
  source: string,
  context: Record<string, unknown> = {}
): Promise<CompileResult | ErrorResult> {
  try {
    const html = await nmlCompiler.render(source, context);
    return { ok: true, html };
  } catch (err) {
    if (err instanceof NMLParserError) {
      return {
        ok: false,
        error: err.message,
        line: err.loc.line,
        column: err.loc.column,
      };
    }
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// lint
// Tool: Validate NML source without producing HTML.
// Returns a list of parse errors with locations (or empty = valid).
// ---------------------------------------------------------------------------

export function lint(source: string): LintResult {
  const errors: Array<{ message: string; line: number; column: number }> = [];

  try {
    buildAst(source);
  } catch (err) {
    if (err instanceof NMLParserError) {
      errors.push({
        message: err.message,
        line: err.loc.line,
        column: err.loc.column,
      });
    } else {
      errors.push({ message: String(err), line: 1, column: 1 });
    }
  }

  return { ok: true, valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// listComponents
// Tool: Parse a components.nml file and return all @define names + metadata.
// ---------------------------------------------------------------------------

export async function listComponents(
  filePath: string,
  readFileFn: (path: string) => Promise<string>
): Promise<ListComponentsResult | ErrorResult> {
  let source: string;
  try {
    source = await readFileFn(filePath);
  } catch {
    return { ok: false, error: `Cannot read file: ${filePath}` };
  }

  // Validate syntax first (build then discard — catches errors)
  try {
    buildAst(source);
  } catch (err) {
    if (err instanceof NMLParserError) {
      return {
        ok: false,
        error: err.message,
        line: err.loc.line,
        column: err.loc.column,
      };
    }
    return { ok: false, error: String(err) };
  }

  // @define blocks are stripped from the final AST by expandComponentsPass,
  // so we scan the raw source text directly.
  const components = scanDefineBlocks(source);
  return { ok: true, components };
}

// ---------------------------------------------------------------------------
// scanDefineBlocks — lightweight line-based scanner for @define blocks
// ---------------------------------------------------------------------------

function scanDefineBlocks(source: string): ComponentInfo[] {
  const lines = source.split("\n");
  const results: ComponentInfo[] = [];

  const definePattern = /^@define\.(\S+)/;
  const propPattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\|[^}]*)?\}\}/g;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = definePattern.exec(line.trimStart());
    if (!m) { i++; continue; }

    const name = m[1];
    const defineIndent = line.length - line.trimStart().length;

    // Collect all lines that belong to this block (indent > defineIndent)
    const blockLines: string[] = [];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === "") { i++; continue; }
      const indent = l.length - l.trimStart().length;
      if (indent <= defineIndent) break;
      blockLines.push(l);
      i++;
    }

    const blockText = blockLines.join("\n");
    const hasSlot = /@slot(\.|$|\s)/.test(blockText);
    const hasStyle = /@style(\:|$|\s)/.test(blockText);

    // Extract prop names from {{ }} expressions in the block
    const propSet = new Set<string>();
    let pm: RegExpExecArray | null;
    // reset lastIndex since it's a global regex used in a loop
    propPattern.lastIndex = 0;
    while ((pm = propPattern.exec(blockText)) !== null) {
      propSet.add(pm[1]);
    }

    results.push({ name, hasSlot, hasStyle, props: [...propSet] });
  }

  return results;
}
