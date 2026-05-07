import { describe, it, expect } from "vitest";
import { nmlCompiler, NMLParserError } from "../src/index.js";
import { generateHtml } from "../src/renderer.js";
import { buildAst } from "../src/parser.js";

// ---------------------------------------------------------------------------
// In-memory readFileFn builder
// ---------------------------------------------------------------------------

function makeReadFile(files: Record<string, string>) {
  return async (path: string): Promise<string> => {
    // Normalize path separators for cross-platform consistency in tests
    const normalized = path.replace(/\\/g, "/");
    const key = Object.keys(files).find((k) => normalized.endsWith(k.replace(/\\/g, "/")));
    if (key === undefined) throw new Error(`File not found: ${path}`);
    return files[key];
  };
}

// ---------------------------------------------------------------------------
// @include parsing
// ---------------------------------------------------------------------------

describe("@include — parser", () => {
  it("parses @include node with file attribute", () => {
    const ast = buildAst('@include("partials/nav.nml")');
    expect(ast).toHaveLength(1);
    expect(ast[0].element).toBe("@include");
    expect(ast[0].attributes["file"]).toBe("partials/nav.nml");
  });

  it("throws on absolute path", () => {
    expect(() => buildAst('@include("/absolute/path.nml")')).toThrow(NMLParserError);
    expect(() => buildAst('@include("/absolute/path.nml")')).toThrow(/relative/);
  });

  it("throws on missing path argument", () => {
    expect(() => buildAst("@include()")).toThrow(NMLParserError);
  });
});

// ---------------------------------------------------------------------------
// @include rendering — simple include
// ---------------------------------------------------------------------------

describe("@include — rendering", () => {
  it("inlines a simple partial at render time", async () => {
    const files = {
      "/base/index.nml": '@include("nav.nml")\ndiv("Content")',
      '/base/nav.nml': 'nav\n    a.href("/")\n        | Home',
    };

    const ast = buildAst(files["/base/index.nml"]);
    const html = await generateHtml(ast, 0, {}, {
      readFile: makeReadFile(files),
      basePath: "/base/index.nml",
    });

    expect(html).toContain('<a href="/">Home</a>');
    expect(html).toContain('<div>Content</div>');
  });

  it("partial inherits parent context implicitly", async () => {
    const files = {
      "/base/page.nml": '@include("greeting.nml")',
      "/base/greeting.nml": 'p("Hello {{ name }}")',
    };

    const ast = buildAst(files["/base/page.nml"]);
    const html = await generateHtml(ast, 0, { name: "World" }, {
      readFile: makeReadFile(files),
      basePath: "/base/page.nml",
    });

    expect(html).toContain("<p>Hello World</p>");
  });

  it("explicit override merges on top of parent context", async () => {
    const files = {
      '/base/page.nml': '@include("card.nml")',
      "/base/card.nml": 'div\n    h2("{{ title }}")\n    p("{{ body }}")',
    };

    const ast = buildAst(files["/base/page.nml"]);
    const html = await generateHtml(ast, 0, { title: "Override Title", body: "Some text" }, {
      readFile: makeReadFile(files),
      basePath: "/base/page.nml",
    });

    expect(html).toContain("<h2>Override Title</h2>");
    expect(html).toContain("<p>Some text</p>");
  });

  it("nested includes work (include inside include)", async () => {
    const files = {
      "/base/page.nml": '@include("layout.nml")',
      "/base/layout.nml": 'main\n    @include("footer.nml")',
      "/base/footer.nml": 'footer\n    p("Footer")',
    };

    const ast = buildAst(files["/base/page.nml"]);
    const html = await generateHtml(ast, 0, {}, {
      readFile: makeReadFile(files),
      basePath: "/base/page.nml",
    });

    expect(html).toContain("<footer>");
    expect(html).toContain("<p>Footer</p>");
  });

  it("throws NMLParserError for missing file", async () => {
    const files = { "/base/page.nml": '@include("missing.nml")' };
    const ast = buildAst(files["/base/page.nml"]);

    await expect(
      generateHtml(ast, 0, {}, {
        readFile: makeReadFile(files),
        basePath: "/base/page.nml",
      })
    ).rejects.toThrow(NMLParserError);

    await expect(
      generateHtml(ast, 0, {}, {
        readFile: makeReadFile(files),
        basePath: "/base/page.nml",
      })
    ).rejects.toThrow(/cannot read file/);
  });

  it("throws NMLParserError for circular include", async () => {
    const files = {
      "/base/a.nml": '@include("b.nml")',
      "/base/b.nml": '@include("a.nml")',
    };

    const ast = buildAst(files["/base/a.nml"]);
    await expect(
      generateHtml(ast, 0, {}, {
        readFile: makeReadFile(files),
        basePath: "/base/a.nml",
      })
    ).rejects.toThrow(/Circular/);
  });

  it("throws if no readFile option is provided", async () => {
    const ast = buildAst('@include("nav.nml")');
    await expect(
      generateHtml(ast, 0, {}, { basePath: "/base/page.nml" })
    ).rejects.toThrow(/readFile option/);
  });

  it("mock R2-style async readFile works identically", async () => {
    const r2Store: Record<string, string> = {
      "nav.nml": 'nav\n    | Nav from R2',
    };

    const r2ReadFile = async (path: string) => {
      const normalized = path.replace(/\\/g, "/");
      const key = Object.keys(r2Store).find((k) => normalized.endsWith(k));
      if (!key) throw new Error("Not in R2: " + path);
      return r2Store[key];
    };

    const ast = buildAst('@include("nav.nml")');
    const html = await generateHtml(ast, 0, {}, {
      readFile: r2ReadFile,
      basePath: "/base/page.nml",
    });

    expect(html).toContain("Nav from R2");
  });
});

// ---------------------------------------------------------------------------
// nmlCompiler.render() with @include via CompileOptions
// ---------------------------------------------------------------------------

describe("nmlCompiler.render() — @include via options", () => {
  it("resolves includes when readFile + basePath passed in options", async () => {
    const files = {
      "/pages/index.nml": '@include("partials/hero.nml")',
      "/pages/partials/hero.nml": 'section\n    h1("Hero Section")',
    };

    const html = await nmlCompiler.render(
      files["/pages/index.nml"],
      {},
      {
        readFile: makeReadFile(files),
        basePath: "/pages/index.nml",
      }
    );

    expect(html).toContain("<h1>Hero Section</h1>");
  });
});
