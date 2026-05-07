import { describe, it, expect } from "vitest";
import { compile, lint, listComponents } from "../src/tools.js";

// ---------------------------------------------------------------------------
// compile
// ---------------------------------------------------------------------------

describe("compile", () => {
  it("returns ok:true and HTML for valid NML", async () => {
    const result = await compile('p("Hello World")');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toContain("<p>Hello World</p>");
    }
  });

  it("renders a full document with doctype", async () => {
    const src = `doctype.html\nhtml\n    body\n        h1("Hi")`;
    const result = await compile(src);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<h1>Hi</h1>");
    }
  });

  it("substitutes context variables", async () => {
    const result = await compile('p("{{ name }}")', { name: "NML" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toContain("<p>NML</p>");
    }
  });

  it("returns ok:false with line/column on parse error", async () => {
    const result = await compile("div\n  bad-indent");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.line).toBeTypeOf("number");
      expect(result.column).toBeTypeOf("number");
      expect(result.error).toBeTypeOf("string");
    }
  });

  it("returns ok:false for empty string producing no output (not an error)", async () => {
    const result = await compile("");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// lint
// ---------------------------------------------------------------------------

describe("lint", () => {
  it("returns valid:true for syntactically correct NML", () => {
    const result = lint('div\n    p("Hello")');
    expect(result.ok).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid:false with error details for bad indent", () => {
    const result = lint("div\n  bad");
    expect(result.ok).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].line).toBeTypeOf("number");
    expect(result.errors[0].column).toBeTypeOf("number");
    expect(result.errors[0].message).toBeTypeOf("string");
  });

  it("returns valid:true for empty source", () => {
    const result = lint("");
    expect(result.ok).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("returns valid:true for multiline valid NML", () => {
    const src = `div.class("container")\n    h1("Title")\n    p("Body text")`;
    const result = lint(src);
    expect(result.ok).toBe(true);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listComponents
// ---------------------------------------------------------------------------

describe("listComponents", () => {
  function mockRead(content: string) {
    return async (_path: string) => content;
  }

  it("returns empty array when no @define blocks exist", async () => {
    const src = `div\n    p("hello")`;
    const result = await listComponents("/fake/components.nml", mockRead(src));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.components).toHaveLength(0);
    }
  });

  it("detects a single @define component", async () => {
    const src = `@define.Card\n    div.class("card")\n        @slot`;
    const result = await listComponents("/fake/components.nml", mockRead(src));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("Card");
      expect(result.components[0].hasSlot).toBe(true);
      expect(result.components[0].hasStyle).toBe(false);
    }
  });

  it("detects multiple @define components", async () => {
    const src = [
      "@define.Button",
      '    button.class("btn")',
      "        @slot",
      "@define.Card",
      '    div.class("card")',
      "        @slot",
    ].join("\n");

    const result = await listComponents("/fake/components.nml", mockRead(src));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.components).toHaveLength(2);
      const names = result.components.map((c) => c.name);
      expect(names).toContain("Button");
      expect(names).toContain("Card");
    }
  });

  it("detects @style presence", async () => {
    const src = [
      "@define.Alert",
      '    div.class("alert")',
      "        @slot",
      "    @style:",
      "        .alert { color: red; }",
    ].join("\n");

    const result = await listComponents("/fake/components.nml", mockRead(src));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.components[0].hasStyle).toBe(true);
    }
  });

  it("extracts prop names from {{ }} template expressions", async () => {
    const src = [
      "@define.UserCard",
      '    div.class("user-card")',
      '        h2("{{ name }}")',
      '        p("{{ bio }}")',
    ].join("\n");

    const result = await listComponents("/fake/components.nml", mockRead(src));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.components[0].props).toContain("name");
      expect(result.components[0].props).toContain("bio");
    }
  });

  it("returns ok:false when file cannot be read", async () => {
    const failRead = async (_path: string): Promise<string> => {
      throw new Error("ENOENT");
    };
    const result = await listComponents("/nonexistent/components.nml", failRead);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Cannot read file");
    }
  });

  it("returns ok:false when file has parse errors", async () => {
    const result = await listComponents(
      "/fake/components.nml",
      mockRead("div\n  bad-indent")
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.line).toBeTypeOf("number");
    }
  });
});
