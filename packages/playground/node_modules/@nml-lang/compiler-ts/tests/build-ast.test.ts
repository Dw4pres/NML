import { describe, it, expect } from "vitest";
import { buildAst, NMLParserError } from "../src/parser.js";

describe("buildAst — nesting", () => {
  it("builds a simple two-level tree", () => {
    const ast = buildAst("body\n    div");
    expect(ast).toHaveLength(1);
    expect(ast[0].element).toBe("body");
    expect(ast[0].children).toHaveLength(1);
    expect(ast[0].children[0].element).toBe("div");
  });

  it("handles complex dedents correctly", () => {
    const text = "div.a\n    p.b\n        span.c\n    p.d";
    const ast = buildAst(text);
    expect(ast).toHaveLength(1);
    expect(ast[0].element).toBe("div");
    expect(ast[0].children).toHaveLength(2);
    expect(ast[0].children[0].element).toBe("p"); // b
    expect(ast[0].children[1].element).toBe("p"); // d
    expect(ast[0].children[0].children[0].element).toBe("span"); // c
  });

  it("captures multiline content blocks", () => {
    const text = "style:\n    body {\n        color: blue;\n    }\ndiv";
    const ast = buildAst(text);
    expect(ast).toHaveLength(2);
    expect(ast[0].element).toBe("style");
    expect(ast[0].multiline_content).toHaveLength(3);
    expect(ast[0].multiline_content[1].trim()).toBe("color: blue;");
    expect(ast[1].element).toBe("div");
  });

  it("preserves empty lines inside multiline blocks", () => {
    const text = "style:\n    .a\n\n    .b\ndiv";
    const ast = buildAst(text);
    expect(ast[0].element).toBe("style");
    expect(ast[0].multiline_content).toHaveLength(3);
    expect(ast[0].multiline_content[1]).toBe("");
    expect(ast[1].element).toBe("div");
  });

  it("ignores comment lines", () => {
    const text =
      "// comment\ndiv.a\n    // inner\n    p.b\n// end";
    const ast = buildAst(text);
    expect(ast).toHaveLength(1);
    expect(ast[0].element).toBe("div");
    expect(ast[0].children).toHaveLength(1);
    expect(ast[0].children[0].element).toBe("p");
  });

  it("parses content pipe as text child", () => {
    const ast = buildAst("p\n    | Hello");
    expect(ast[0].children).toHaveLength(1);
    expect(ast[0].children[0].element).toBe("__text__");
    expect(ast[0].children[0].content).toBe("Hello");
  });

  it("parses mixed content pipes and elements", () => {
    const text = "p\n    | Text part 1\n    strong\n        | Bold\n    | Text part 2";
    const ast = buildAst(text);
    expect(ast[0].children).toHaveLength(3);
    expect(ast[0].children[0].element).toBe("__text__");
    expect(ast[0].children[1].element).toBe("strong");
    expect(ast[0].children[2].element).toBe("__text__");
    expect(ast[0].children[1].children[0].content).toBe("Bold");
  });
});

describe("buildAst — error handling", () => {
  it("throws for tab indentation", () => {
    expect(() => buildAst("div\n\tspan")).toThrow(NMLParserError);
    expect(() => buildAst("div\n\tspan")).toThrow(/line 2.*tabs/i);
  });

  it("throws for 2-space (non-standard) indentation", () => {
    expect(() => buildAst("div\n  span")).toThrow(NMLParserError);
    expect(() => buildAst("div\n  span")).toThrow(/Non-standard indentation/);
  });

  it("throws for too-deep indentation", () => {
    expect(() => buildAst("div\n        span")).toThrow(NMLParserError);
    expect(() => buildAst("div\n        span")).toThrow(/too deep/);
  });

  it("throws for bad indentation inside multiline block", () => {
    expect(() => buildAst("style:\n  body")).toThrow(NMLParserError);
    expect(() => buildAst("style:\n  body")).toThrow(/Non-standard indentation/);
  });

  it("throws for content pipe not indented under parent", () => {
    expect(() => buildAst("p\n| Hello")).toThrow(NMLParserError);
    expect(() => buildAst("p\n| Hello")).toThrow(/Content pipe/);
  });
});

describe("buildAst — full complex example", () => {
  const fullExampleText =
    'doctype.html\n' +
    'html.lang("en").default\n' +
    '    head\n' +
    '        meta.charset("UTF-8")\n' +
    '        meta.name("viewport").content("width=device-width, initial-scale=1.0")\n' +
    '        title("Mythic Gridiron - Login")\n' +
    '        // 1. Tailwind CSS\n' +
    '        script.src("https://cdn.tailwindcss.com")\n' +
    '        // 2. Google Font\n' +
    '        link.rel("preconnect").href("https://fonts.googleapis.com")\n' +
    '        link.rel("preconnect").href("https://fonts.gstatic.com").crossorigin\n' +
    '        link.href("https://fonts.googleapis.com/css2?family=VT323&display=swap").rel("stylesheet")\n' +
    '        // 3. Custom Styles\n' +
    '        style:\n' +
    "            body {\n" +
    "                font-family: 'VT323', monospace;\n" +
    "                background-color: #0c1524;\n" +
    "            }\n" +
    "            .pixel-button {\n" +
    "                display: block;\n" +
    "                width: 100%;\n" +
    "            }\n" +
    '    body.text-lg\n';

  it("builds the correct top-level structure", () => {
    const ast = buildAst(fullExampleText);
    expect(ast).toHaveLength(2);
    expect(ast[0].element).toBe("doctype");
    expect(ast[1].element).toBe("html");
    const htmlChildren = ast[1].children;
    expect(htmlChildren).toHaveLength(2);
    expect(htmlChildren[0].element).toBe("head");
    expect(htmlChildren[1].element).toBe("body");
  });

  it("captures the style multiline block", () => {
    const ast = buildAst(fullExampleText);
    const head = ast[1].children[0];
    // head children: meta, meta, title, script, link, link, link, style (comments stripped)
    const styleNode = head.children.find((c) => c.element === "style");
    expect(styleNode).toBeDefined();
    expect(styleNode!.multiline_content.some((l) => l.includes("font-family"))).toBe(true);
    expect(styleNode!.multiline_content.some((l) => l.includes(".pixel-button"))).toBe(true);
  });
});
