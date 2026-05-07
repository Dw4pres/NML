/**
 * Phase 11: @each loops, @if conditionals, isTruthy, and filter pipeline tests.
 */

import { describe, it, expect } from "vitest";
import { nmlCompiler } from "../src/index.js";
import { isTruthy, buildAst, postProcessConditionalsPass } from "../src/parser.js";

// ---------------------------------------------------------------------------
// Helper: strip excess whitespace for readable assertions
// ---------------------------------------------------------------------------
function strip(html: string): string {
  return html.replace(/\s+/g, " ").trim();
}

async function render(src: string, ctx: Record<string, unknown> = {}): Promise<string> {
  return nmlCompiler.render(src, ctx);
}

// ---------------------------------------------------------------------------
// isTruthy
// ---------------------------------------------------------------------------

describe("isTruthy", () => {
  it("null → false", () => expect(isTruthy(null)).toBe(false));
  it("undefined → false", () => expect(isTruthy(undefined)).toBe(false));
  it("0 → false", () => expect(isTruthy(0)).toBe(false));
  it("empty string → false", () => expect(isTruthy("")).toBe(false));
  it("empty array → false", () => expect(isTruthy([])).toBe(false));
  it("empty object → false", () => expect(isTruthy({})).toBe(false));
  it("1 → true", () => expect(isTruthy(1)).toBe(true));
  it("non-empty string → true", () => expect(isTruthy("x")).toBe(true));
  it("non-empty array → true", () => expect(isTruthy([1])).toBe(true));
  it("non-empty object → true", () => expect(isTruthy({ a: 1 })).toBe(true));
  it("true → true", () => expect(isTruthy(true)).toBe(true));
  it("false → false", () => expect(isTruthy(false)).toBe(false));
});

// ---------------------------------------------------------------------------
// postProcessConditionalsPass
// ---------------------------------------------------------------------------

describe("postProcessConditionalsPass", () => {
  it("groups @if/@else/@endif into single @if node with elseBranch", () => {
    const src = `@if(show)
    div("Yes")
@else
    div("No")
@endif`;
    const ast = buildAst(src);
    expect(ast).toHaveLength(1);
    expect(ast[0].element).toBe("@if");
    expect(ast[0].children).toHaveLength(1);
    expect(ast[0].elseBranch).toHaveLength(1);
    expect(ast[0].elseBranch![0].element).toBe("div");
  });

  it("@if without @else has no elseBranch", () => {
    const src = `@if(show)
    div | Yes
@endif`;
    const ast = buildAst(src);
    expect(ast).toHaveLength(1);
    expect(ast[0].element).toBe("@if");
    expect(ast[0].elseBranch).toBeUndefined();
  });

  it("removes @endeach sibling", () => {
    const src = `@each(items as item)
    div | item
@endeach`;
    const ast = buildAst(src);
    expect(ast).toHaveLength(1);
    expect(ast[0].element).toBe("@each");
  });

  it("nested @if inside @each is processed correctly", () => {
    const src = `@each(items as item)
    @if(item)
        div | yes
    @endif
@endeach`;
    const ast = buildAst(src);
    expect(ast).toHaveLength(1);
    expect(ast[0].element).toBe("@each");
    expect(ast[0].children[0].element).toBe("@if");
    expect(ast[0].children).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Error messages — unclosed directives
// ---------------------------------------------------------------------------

describe("error messages", () => {
  it("unclosed @if throws with line number", () => {
    const src = `@if(show)\n    div("Yes")`;
    expect(() => buildAst(src)).toThrow("Missing @endif for @if on line 1");
  });

  it("unclosed @each throws with line number", () => {
    const src = `@each(items as item)\n    li("{{ item }}")`;
    expect(() => buildAst(src)).toThrow("Missing @endeach for @each on line 1");
  });

  it("unclosed @if (with @else) throws with line number", () => {
    const src = `@if(show)\n    div("Yes")\n@else\n    div("No")`;
    expect(() => buildAst(src)).toThrow("Missing @endif for @if on line 1");
  });

  it("throws NMLParserError (not generic Error)", () => {
    const src = `@if(show)\n    div("Yes")`;
    expect(() => buildAst(src)).toThrow(expect.objectContaining({ name: "NMLParserError" }));
  });
});

// ---------------------------------------------------------------------------
// @each loops
// ---------------------------------------------------------------------------

describe("@each", () => {
  it("renders N items with {{ item }} interpolated", async () => {
    const src = `ul\n    @each(names as name)\n        li("{{ name }}")\n    @endeach`;
    const html = await render(src, { names: ["Alice", "Bob", "Carol"] });
    expect(strip(html)).toContain("<li>Alice</li>");
    expect(strip(html)).toContain("<li>Bob</li>");
    expect(strip(html)).toContain("<li>Carol</li>");
  });

  it("renders nothing for an empty array", async () => {
    const src = `ul\n    @each(items as item)\n        li("{{ item }}")\n    @endeach`;
    const html = await render(src, { items: [] });
    expect(strip(html)).not.toContain("<li>");
    expect(strip(html)).toContain("<ul>");
  });

  it("renders nothing for a missing key", async () => {
    const src = `ul\n    @each(missing as item)\n        li("{{ item }}")\n    @endeach`;
    const html = await render(src, {});
    expect(strip(html)).not.toContain("<li>");
    expect(strip(html)).toContain("<ul>");
  });

  it("renders nothing for a non-array value", async () => {
    const src = `ul\n    @each(count as item)\n        li("{{ item }}")\n    @endeach`;
    const html = await render(src, { count: 42 });
    expect(strip(html)).not.toContain("<li>");
    expect(strip(html)).toContain("<ul>");
  });

  it("nested loops: outer var accessible inside inner @each", async () => {
    const src = `ul\n    @each(cats as cat)\n        @each(cat.items as item)\n            li("{{ cat.name }}: {{ item }}")\n        @endeach\n    @endeach`;
    const html = await render(src, {
      cats: [
        { name: "A", items: ["x", "y"] },
        { name: "B", items: ["z"] },
      ],
    });
    const s = strip(html);
    expect(s).toContain("<li>A: x</li>");
    expect(s).toContain("<li>A: y</li>");
    expect(s).toContain("<li>B: z</li>");
  });
});

// ---------------------------------------------------------------------------
// @if / @else conditionals
// ---------------------------------------------------------------------------

describe("@if", () => {
  it("truthy condition renders then-branch", async () => {
    const src = `@if(show)\n    div("Yes")\n@endif`;
    const html = await render(src, { show: true });
    expect(strip(html)).toContain("<div>Yes</div>");
  });

  it("falsy condition renders nothing when no @else", async () => {
    const src = `@if(show)\n    div("Yes")\n@endif`;
    const html = await render(src, { show: false });
    expect(strip(html)).toBe("");
  });

  it("falsy condition renders else-branch", async () => {
    const src = `@if(show)\n    div("Yes")\n@else\n    div("No")\n@endif`;
    const html = await render(src, { show: false });
    expect(strip(html)).toContain("<div>No</div>");
    expect(strip(html)).not.toContain("<div>Yes</div>");
  });

  it("truthy condition does not render else-branch", async () => {
    const src = `@if(show)\n    div("Yes")\n@else\n    div("No")\n@endif`;
    const html = await render(src, { show: true });
    expect(strip(html)).toContain("<div>Yes</div>");
    expect(strip(html)).not.toContain("<div>No</div>");
  });

  it("dot-path condition: @if(user.isAdmin)", async () => {
    const src = `@if(user.isAdmin)\n    div("Admin")\n@endif`;
    const html = await render(src, { user: { isAdmin: true } });
    expect(strip(html)).toContain("<div>Admin</div>");
  });

  it("dot-path condition falsy", async () => {
    const src = `@if(user.isAdmin)\n    div("Admin")\n@endif`;
    const html = await render(src, { user: { isAdmin: false } });
    expect(strip(html)).toBe("");
  });

  it("two sibling @if blocks do not bleed state", async () => {
    const src = `@if(a)\n    div("A")\n@endif\n@if(b)\n    div("B")\n@endif`;
    const html = await render(src, { a: true, b: false });
    expect(strip(html)).toContain("<div>A</div>");
    expect(strip(html)).not.toContain("<div>B</div>");
  });

  it("isTruthy: empty array condition renders else-branch", async () => {
    const src = `@if(items)\n    div("Has items")\n@else\n    div("Empty")\n@endif`;
    const html = await render(src, { items: [] });
    expect(strip(html)).toContain("<div>Empty</div>");
  });
});

// ---------------------------------------------------------------------------
// Filter pipeline
// ---------------------------------------------------------------------------

describe("filters", () => {
  it("uppercase built-in", async () => {
    const src = `p("{{ name|uppercase }}")`;
    const html = await render(src, { name: "alice" });
    expect(html).toContain("ALICE");
  });

  it("lowercase built-in", async () => {
    const src = `p("{{ name|lowercase }}")`;
    const html = await render(src, { name: "ALICE" });
    expect(html).toContain("alice");
  });

  it("trim built-in", async () => {
    const src = `p("{{ name|trim }}")`;
    const html = await render(src, { name: "  hello  " });
    expect(html).toContain("hello");
    expect(html).not.toContain("  hello  ");
  });

  it("json built-in emits raw JSON (not HTML-escaped)", async () => {
    const src = `div.data-x("{{ state|json }}")`;
    const html = await render(src, { state: { count: 1 } });
    expect(html).toContain('{"count":1}');
    expect(html).not.toContain("&quot;");
  });

  it("default built-in returns fallback for falsy value", async () => {
    const src = `p("{{ name|default(\"Anonymous\") }}")`;
    const html = await render(src, { name: "" });
    expect(html).toContain("Anonymous");
  });

  it("default built-in returns value when truthy", async () => {
    const src = `p("{{ name|default(\"Anonymous\") }}")`;
    const html = await render(src, { name: "Alice" });
    expect(html).toContain("Alice");
    expect(html).not.toContain("Anonymous");
  });

  it("user-defined filter function in context", async () => {
    const src = `p("{{ price|currency }}")`;
    const html = await render(src, {
      price: 9.99,
      currency: (v: unknown) => `$${Number(v).toFixed(2)}`,
    });
    expect(html).toContain("$9.99");
  });

  it("unknown filter → empty string (no error)", async () => {
    const src = `p("{{ name|bogusFilter }}")`;
    const html = await render(src, { name: "Alice" });
    expect(html).toContain("<p></p>");
  });

  it("{{ val|raw }} regression still works", async () => {
    const src = `p("{{ html|raw }}")`;
    const html = await render(src, { html: "<b>bold</b>" });
    expect(html).toContain("<b>bold</b>");
  });

  it("missing variable with filter returns empty string", async () => {
    const src = `p("{{ missing|uppercase }}")`;
    const html = await render(src, {});
    expect(html).toContain("<p></p>");
  });
});
