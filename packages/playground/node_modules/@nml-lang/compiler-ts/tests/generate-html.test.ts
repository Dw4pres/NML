import { describe, it, expect } from "vitest";
import { buildAst } from "../src/parser.js";
import { generateHtml } from "../src/renderer.js";

function minify(html: string): string {
  return html.replace(/>\s+</g, "><").replace(/\n\s*/g, "").replace(/\s+$/, "").trim();
}

describe("generateHtml", () => {
  it("renders a simple element", async () => {
    expect(await generateHtml(buildAst("div"))).toBe("<div></div>");
  });

  it("renders attributes", async () => {
    expect(await generateHtml(buildAst('a.href("#").class("btn")'))).toBe('<a href="#" class="btn"></a>');
  });

  it("renders content", async () => {
    expect(await generateHtml(buildAst('h1("Hello")'))).toBe("<h1>Hello</h1>");
  });

  it("renders nested elements", async () => {
    expect(minify(await generateHtml(buildAst("div\n    p")))).toBe("<div><p></p></div>");
  });

  it("renders void elements without closing tag", async () => {
    expect(minify(await generateHtml(buildAst('meta.charset("UTF-8")')))).toBe('<meta charset="UTF-8">');
  });

  it("renders boolean attributes without value", async () => {
    expect(minify(await generateHtml(buildAst("link.crossorigin")))).toBe("<link crossorigin>");
  });

  it("renders multiline content (style block)", async () => {
    const text = "style:\n    body {\n        color: blue;\n    }";
    const html = await generateHtml(buildAst(text));
    expect(html).toContain("<style>");
    expect(html).toContain("    body {");
    expect(html).toContain("        color: blue;");
    expect(html).toContain("</style>");
  });

  it("renders doctype", async () => {
    expect(await generateHtml(buildAst("doctype.html"))).toBe("<!DOCTYPE html>");
  });

  it("renders template variables in content", async () => {
    const ast = buildAst('h1("Hello, {{ name }}!")');
    expect(await generateHtml(ast, 0, { name: "World" })).toBe("<h1>Hello, World!</h1>");
  });

  it("renders template variables in attributes", async () => {
    const ast = buildAst('a.href("{{ url }}")');
    expect(await generateHtml(ast, 0, { url: "/home" })).toBe('<a href="/home"></a>');
  });

  it("renders template variables in multiline content", async () => {
    const ast = buildAst("style:\n    body { color: {{ color }}; }");
    const html = await generateHtml(ast, 0, { color: "red" });
    expect(html).toContain("color: red;");
  });

  it("renders template variables in content pipe", async () => {
    const ast = buildAst("p\n    | Hello, {{ name }}!");
    const html = await generateHtml(ast, 0, { name: "World" });
    expect(html).toContain("Hello, World!");
  });

  it("escapes HTML in attribute values by default", async () => {
    const ast = buildAst('a.title("Hi {{ v }}")');
    const html = await generateHtml(ast, 0, { v: "<>" });
    expect(html).toBe('<a title="Hi &lt;&gt;"></a>');
  });

  it("renders void element extended set", async () => {
    const cases: [string, string][] = [
      ["wbr", "<wbr>"],
      ['base.href("about:blank")', '<base href="about:blank">'],
      ['source.src("a.mp4")', '<source src="a.mp4">'],
      ['track.kind("captions")', '<track kind="captions">'],
    ];
    for (const [txt, expected] of cases) {
      expect(minify(await generateHtml(buildAst(txt)))).toBe(expected);
    }
  });

  it("renders multiple boolean attributes", async () => {
    expect(minify(await generateHtml(buildAst("script.defer.async")))).toBe(
      "<script defer async></script>"
    );
    expect(minify(await generateHtml(buildAst('input.type("file").multiple')))).toBe(
      '<input type="file" multiple>'
    );
    expect(minify(await generateHtml(buildAst("form.novalidate")))).toBe("<form novalidate></form>");
  });

  it("resolves nested dot-path context variables", async () => {
    const ast = buildAst('p("Hello {{ user.name }}")');
    expect(await generateHtml(ast, 0, { user: { name: "Alice" } })).toBe("<p>Hello Alice</p>");
  });

  it("renders a full complex document correctly", async () => {
    const fullText =
      'doctype.html\n' +
      'html.lang("en").default\n' +
      '    head\n' +
      '        meta.charset("UTF-8")\n' +
      '        meta.name("viewport").content("width=device-width, initial-scale=1.0")\n' +
      '        title("Mythic Gridiron - Login")\n' +
      '        script.src("https://cdn.tailwindcss.com")\n' +
      '        link.rel("preconnect").href("https://fonts.googleapis.com")\n' +
      '        link.rel("preconnect").href("https://fonts.gstatic.com").crossorigin\n' +
      '        link.href("https://fonts.googleapis.com/css2?family=VT323&display=swap").rel("stylesheet")\n' +
      '        style:\n' +
      "            body {\n" +
      "                font-family: 'VT323', monospace;\n" +
      "                background-color: #0c1524;\n" +
      "            }\n" +
      "            .pixel-button {\n" +
      "                display: block;\n" +
      "                width: 100%;\n" +
      "            }\n" +
      '    body.text-lg\n' +
      '        div.class("min-h-screen w-full flex flex-col items-center justify-center p-4")\n' +
      '            div.class("pixel-box-raised w-full max-w-lg p-6")\n' +
      '                div.class("text-center mb-6")\n' +
      '                    h1.class("text-5xl text-yellow-300", "Sample Header!")\n' +
      '                    p.class("text-slate-400 text-2xl", "Sample text.")';

    const ast = buildAst(fullText);
    const html = await generateHtml(ast);
    const expected =
      '<!DOCTYPE html>\n' +
      '<html lang="en" default>\n' +
      '    <head>\n' +
      '        <meta charset="UTF-8">\n' +
      '        <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '        <title>Mythic Gridiron - Login</title>\n' +
      '        <script src="https://cdn.tailwindcss.com"></script>\n' +
      '        <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet">\n' +
      '        <style>\n' +
      "            body {\n" +
      "                font-family: 'VT323', monospace;\n" +
      "                background-color: #0c1524;\n" +
      "            }\n" +
      "            .pixel-button {\n" +
      "                display: block;\n" +
      "                width: 100%;\n" +
      "            }\n" +
      '        </style>\n' +
      '    </head>\n' +
      '    <body class="text-lg">\n' +
      '        <div class="min-h-screen w-full flex flex-col items-center justify-center p-4">\n' +
      '            <div class="pixel-box-raised w-full max-w-lg p-6">\n' +
      '                <div class="text-center mb-6">\n' +
      '                    <h1 class="text-5xl text-yellow-300">Sample Header!</h1>\n' +
      '                    <p class="text-slate-400 text-2xl">Sample text.</p>\n' +
      '                </div>\n' +
      '            </div>\n' +
      '        </div>\n' +
      '    </body>\n' +
      '</html>';

    expect(minify(html)).toBe(minify(expected));
  });
});
