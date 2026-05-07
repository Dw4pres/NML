/**
 * tools.ts
 * Pure handler functions for each NML MCP tool.
 * No I/O side-effects — accepts injected readFile for testability.
 */

import { buildAst, nmlCompiler, NMLParserError } from "@nml-lang/compiler-ts";

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
// ---------------------------------------------------------------------------
// getSyntaxRules
// Tool: Return the strict markdown rules for writing NML.
// ---------------------------------------------------------------------------

export function getSyntaxRules(): string {
  return `
# NML Syntax Reference

⚠️ **CRITICAL: NML does NOT use HTML angle brackets (\`< >\`). NEVER write \`<div>\`, \`</div>\`, etc.**
NML is a strict, Pythonic, 4-space indentation-based markup language.
Always call \`nml_lint\` after writing NML to verify it is valid before returning it.

---

## 1. Document Structure

\`\`\`nml
doctype.html
html
    head
        title | Page Title
    body
        h1 | Hello World
\`\`\`

- \`doctype.html\` emits \`<!DOCTYPE html>\`
- Indentation is **4 spaces** (no tabs). Child elements are indented under their parent.
- There are **no closing tags**.

---

## 2. Elements, Attributes & Content

\`\`\`nml
div.id("app").class("flex p-4") | Inline text content
\`\`\`

- Attributes are chained with **dot notation**: \`.attrName("value")\`
- Text content follows a **pipe** (\`|\`) after the element (and any attributes).
- Multi-line children: omit the pipe and indent children below.

\`\`\`nml
ul.class("list-disc")
    li | First item
    li | Second item
\`\`\`

- Boolean attributes: \`.disabled()\` or \`.checked()\`
- Shorthand hyphenated attrs (HTMX, Alpine, events): use dot notation directly
  \`\`\`nml
  button.hx-get("/api/users").hx-target("#list").class("btn") | Load
  div.x-data("{ open: false }").x-show("open") | Content
  button.on:click("handleClick()") | Click me
  \`\`\`

---

## 3. Comments

\`\`\`nml
// This is a comment — not rendered to HTML
\`\`\`

---

## 4. Template Variables & Filters

- Interpolate: \`{{ variableName }}\`
- Filter: \`{{ value|uppercase }}\`
- Filter with arg: \`{{ value|default("fallback") }}\`

Built-in filters:
| Filter | Effect |
|---|---|
| \`uppercase\` | ALL CAPS |
| \`lowercase\` | all lowercase |
| \`trim\` | strip whitespace |
| \`json\` | JSON.stringify (safe for Alpine x-data) |
| \`default("x")\` | use "x" if value is falsy |
| \`raw\` | disable HTML escaping |

\`\`\`nml
p | Hello, {{ user.name|default("Guest") }}!
div.x-data("{{ state|json }}")
\`\`\`

---

## 5. Conditionals

\`\`\`nml
@if(users)
    p | Users found!
@else
    p | No users.
@endif
\`\`\`

- Falsy values: \`[]\`, \`{}\`, \`""\`, \`0\`, \`null\`, \`undefined\`, \`false\`
- **Must** be closed with \`@endif\`. Unclosed \`@if\` is a parse error.
- \`@else\` is optional.

---

## 6. Loops

\`\`\`nml
ul
    @each(users as user)
        li | {{ user.name }}
    @endeach
\`\`\`

- **Must** be closed with \`@endeach\`. Unclosed \`@each\` is a parse error.
- The loop variable (\`user\`) is available inside the block.

---

## 7. Components

### Defining a component (\`components.nml\`)

\`\`\`nml
@define.Card
    div.class("card p-4 rounded shadow")
        h2 | {{ title }}
        p | {{ body|default("") }}
        @slot
\`\`\`

- \`@define.ComponentName\` starts a block. Children are the component template.
- \`{{ title }}\` / \`{{ body }}\` are props passed by the caller.
- \`@slot\` marks where caller children are injected.

### Named slots

\`\`\`nml
@define.Modal
    div.class("modal")
        div.class("modal-header")
            @slot.header
        div.class("modal-body")
            @slot
\`\`\`

### Scoped styles

\`\`\`nml
@define.Button
    @style:
        .btn { background: blue; color: white; }
    button.class("btn") | {{ label }}
\`\`\`

### Using a component

\`\`\`nml
@Card.title("Hello").body("World")
    p | This goes into @slot
\`\`\`

- Prefix component usage with \`@\`, then chain props as attributes.
- Children of the call site are injected into \`@slot\`.

---

## 8. Partials (\`@include\`)

\`\`\`nml
@include("partials/header.nml")
@include("partials/footer.nml")
\`\`\`

- Path is relative to the project root.
- The partial file is a normal \`.nml\` file.

---

## 9. Quick Reference — Common Mistakes

| ❌ Wrong | ✅ Correct |
|---|---|
| \`<div class="foo">bar</div>\` | \`div.class("foo") | bar\` |
| \`<img src="x.png" />\` | \`img.src("x.png")\` |
| \`<a href="/about">Link</a>\` | \`a.href("/about") | Link\` |
| \`<br>\` | \`br\` |
| \`<!-- comment -->\` | \`// comment\` |
| \`<input type="text" />\` | \`input.type("text")\` |
| Forgetting \`@endif\` | Always close \`@if\` with \`@endif\` |
| Forgetting \`@endeach\` | Always close \`@each\` with \`@endeach\` |
`.trim();
}