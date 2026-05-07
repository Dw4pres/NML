import { describe, it, expect, beforeEach } from "vitest";
import { buildAst, findComponentRootNode, NMLParserError, generateHtml, type ComponentMap, type GlobalStyles } from "../src/index.js";
import { generateHtml as _generateHtml } from "../src/renderer.js";

// ---------------------------------------------------------------------------
// Shared fixture builder (mirrors mock_components in test_parse.py)
// ---------------------------------------------------------------------------

function buildMockComponents(): { components: ComponentMap; globalStyles: GlobalStyles } {
  const components: ComponentMap = {};
  const globalStyles: GlobalStyles = {};

  const pixelBoxNml =
    "@define.PixelBox\n" +
    "    div\n" +
    "        @slot\n" +
    "    @style:\n" +
    "        .pixel-box-raised {\n" +
    "            background-color: #1e293b;\n" +
    "        }\n" +
    "        .pixel-box-inset {\n" +
    "            background-color: #0f172a;\n" +
    "        }";

  const pixelButtonNml =
    "@define.PixelButton\n" +
    '    button.type("button")\n' +
    "        @slot\n" +
    "    @style:\n" +
    "        .pixel-button {\n" +
    "            display: block;\n" +
    "        }\n" +
    "        .pixel-button:hover {\n" +
    "            background-color: #475569;\n" +
    "        }";

  buildAst(pixelBoxNml, { components, globalStyles });
  buildAst(pixelButtonNml, { components, globalStyles });

  // Post-process: add base classes (mirrors app.py load_components)
  const pbRoot = findComponentRootNode(components["PixelBox"]);
  if (pbRoot) pbRoot.attributes["class"] = "pixel-box-raised";

  const pbtnRoot = findComponentRootNode(components["PixelButton"]);
  if (pbtnRoot) pbtnRoot.attributes["class"] = "pixel-button";

  return { components, globalStyles };
}

// ---------------------------------------------------------------------------
// Component definition parsing
// ---------------------------------------------------------------------------

describe("component definition parsing", () => {
  it("removes @define from the output AST and populates components map", () => {
    const components: ComponentMap = {};
    const text = '@define.MyButton\n    button.class("btn")\n        @slot';
    const ast = buildAst(text, { components });
    expect(ast).toHaveLength(0);
    expect("MyButton" in components).toBe(true);
    const btnNode = components["MyButton"][0];
    expect(btnNode.element).toBe("button");
    expect(btnNode.attributes["class"]).toBe("btn");
    expect(btnNode.children[0].element).toBe("@slot");
  });
});

// ---------------------------------------------------------------------------
// Component expansion
// ---------------------------------------------------------------------------

describe("component expansion", () => {
  it("expands a simple component call", () => {
    const { components } = buildMockComponents();
    const ast = buildAst("@PixelBox", { components });
    expect(ast).toHaveLength(1);
    expect(ast[0].element).toBe("div");
    expect(ast[0].attributes["class"]).toBe("pixel-box-raised");
  });

  it("injects default slot content", () => {
    const { components } = buildMockComponents();
    const ast = buildAst('@PixelBox\n    h1("Title")', { components });
    expect(ast[0].children).toHaveLength(1);
    expect(ast[0].children[0].element).toBe("h1");
    expect(ast[0].children[0].content).toBe("Title");
  });

  it("merge Rule 1: dot-chain classes appended to base class", () => {
    const { components } = buildMockComponents();
    const ast = buildAst('@PixelButton.type("submit").text-green-500.!text-2xl', { components });
    expect(ast[0].element).toBe("button");
    expect(ast[0].attributes["type"]).toBe("submit");
    // class should be: base + appended
    const cls = ast[0].attributes["class"] as string;
    expect(cls).toContain("pixel-button");
    expect(cls).toContain("text-green-500");
    expect(cls).toContain("!text-2xl");
  });

  it("merge Rule 2: .class('val') replaces base class", () => {
    const { components } = buildMockComponents();
    const ast = buildAst('@PixelButton.class("a-new-style").type("reset")', { components });
    expect(ast[0].attributes["class"]).toBe("a-new-style");
    expect(ast[0].attributes["type"]).toBe("reset");
  });

  it("expands nested components", () => {
    const { components } = buildMockComponents();
    const text =
      "@PixelBox.p-4\n" +
      '    h1("Title")\n' +
      "    @PixelButton.mt-4\n" +
      "        | Click Me";
    const ast = buildAst(text, { components });
    expect(ast).toHaveLength(1);
    const boxNode = ast[0];
    const cls = boxNode.attributes["class"] as string;
    expect(cls).toContain("pixel-box-raised");
    expect(cls).toContain("p-4");
    expect(boxNode.children).toHaveLength(2);
    const btnNode = boxNode.children[1];
    expect(btnNode.element).toBe("button");
    const btnCls = btnNode.attributes["class"] as string;
    expect(btnCls).toContain("pixel-button");
    expect(btnCls).toContain("mt-4");
    expect(btnNode.children[0].content).toBe("Click Me");
  });

  it("throws for undefined component", () => {
    expect(() => buildAst("@NonExistent")).toThrow(NMLParserError);
    expect(() => buildAst("@NonExistent")).toThrow(/Undefined component/);
  });
});

// ---------------------------------------------------------------------------
// Scoped styles
// ---------------------------------------------------------------------------

describe("scoped styles", () => {
  it("findComponentRootNode returns the first real element", () => {
    const components: ComponentMap = {};
    buildAst("@define.Test\n    // comment\n    div.root\n        p", { components });
    const rootNode = findComponentRootNode(components["Test"]);
    expect(rootNode).not.toBeNull();
    expect(rootNode!.element).toBe("div");
  });

  it("extracts and scopes CSS from @style block", () => {
    const components: ComponentMap = {};
    const globalStyles: GlobalStyles = {};
    buildAst(
      "@define.Test\n" +
        "    div\n" +
        "        @slot\n" +
        "    @style:\n" +
        "        .my-class {\n" +
        "            color: red;\n" +
        "        }\n" +
        "        .my-class:hover {\n" +
        "            color: blue;\n" +
        "        }\n" +
        '    p("Another node")',
      { components, globalStyles }
    );
    expect("Test" in components).toBe(true);
    const componentAst = components["Test"];
    // div and p (style stripped)
    expect(componentAst).toHaveLength(2);
    const scopeId = Object.keys(globalStyles)[0];
    const css = globalStyles[scopeId];
    expect(css).toContain(`[${scopeId}]`);
    expect(css).toContain("color: red;");
    expect(css).toContain("color: blue;");
  });

  it("populates globalStyles with scoped CSS", () => {
    const components: ComponentMap = {};
    const globalStyles: GlobalStyles = {};
    buildAst(
      "@define.Test\n" +
        "    div\n" +
        "    @style:\n" +
        "        .test { color: green; }",
      { components, globalStyles }
    );
    expect("Test" in components).toBe(true);
    expect(Object.keys(globalStyles)).toHaveLength(1);
    const sid = Object.keys(globalStyles)[0];
    expect(globalStyles[sid]).toContain(`[${sid}]`);
  });

  it("injects scope attribute on component root node", () => {
    const components: ComponentMap = {};
    const globalStyles: GlobalStyles = {};
    buildAst(
      "@define.Test\n" +
        '    div.class("base")\n' +
        "        @slot\n" +
        "    @style:\n" +
        "        .test { color: green; }",
      { components, globalStyles }
    );
    const rootNode = findComponentRootNode(components["Test"])!;
    const scopeKeys = Object.keys(rootNode.attributes).filter((k) => k.startsWith("nml-c-"));
    expect(scopeKeys).toHaveLength(1);
    expect(rootNode.attributes[scopeKeys[0]]).toBe(true);
  });

  it("produces deterministic scope IDs for the same content", () => {
    function getScopeId(nml: string): string {
      const gs: GlobalStyles = {};
      buildAst(nml, { components: {}, globalStyles: gs });
      return Object.keys(gs)[0];
    }
    const nml =
      "@define.Comp\n    div\n        @slot\n    @style:\n        .x { color: red; }";
    expect(getScopeId(nml)).toBe(getScopeId(nml));
  });

  it("produces different scope IDs when style changes", () => {
    function getScopeId(nml: string): string {
      const gs: GlobalStyles = {};
      buildAst(nml, { components: {}, globalStyles: gs });
      return Object.keys(gs)[0];
    }
    const red = "@define.Comp\n    div\n        @slot\n    @style:\n        .x { color: red; }";
    const blue = red.replace("red", "blue");
    expect(getScopeId(red)).not.toBe(getScopeId(blue));
  });

  it("only injects styles for used components", () => {
    const components: ComponentMap = {};
    const globalStyles: GlobalStyles = {};
    buildAst("@define.Box\n    div\n        @slot\n    @style:\n        .box { color: red; }", {
      components,
      globalStyles,
    });
    buildAst("@define.Btn\n    button\n        @slot\n    @style:\n        .btn { color: blue; }", {
      components,
      globalStyles,
    });

    const pageAst = buildAst("@Btn", { components });
    const usedIds = new Set<string>();
    function walk(nodes: typeof pageAst) {
      for (const n of nodes) {
        for (const k of Object.keys(n.attributes)) {
          if (k.startsWith("nml-c-")) usedIds.add(k);
        }
        walk(n.children);
      }
    }
    walk(pageAst);
    expect(usedIds.size).toBe(1);
    expect(globalStyles[Array.from(usedIds)[0]]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Named slots and props
// ---------------------------------------------------------------------------

describe("named slots", () => {
  it("injects header and default slots", () => {
    const components: ComponentMap = {};
    const globalStyles: GlobalStyles = {};
    buildAst(
      "@define.Card\n" +
        '    div.class("card")\n' +
        '        div.class("header")\n' +
        "            @slot.header\n" +
        '        div.class("body")\n' +
        "            @slot\n" +
        '        div.class("footer")\n' +
        "            @slot.footer\n" +
        "    @style:\n" +
        "        .card { color: black; }",
      { components, globalStyles }
    );
    const pageAst = buildAst(
      "@Card\n    @slot.header\n        h1(\"Title\")\n    p(\"Body\")",
      { components }
    );
    expect(pageAst).toHaveLength(1);
    const sections = pageAst[0].children;
    expect(sections).toHaveLength(3);
    // header has h1
    expect(sections[0].children[0].element).toBe("h1");
    // body has p("Body")
    expect(sections[1].children[0].element).toBe("p");
    expect(sections[1].children[0].content).toBe("Body");
    // footer is empty (no fallback, no provided)
    expect(sections[2].children).toHaveLength(0);
  });

  it("uses fallback content when named slot is not provided", () => {
    const components: ComponentMap = {};
    buildAst(
      "@define.FooterComp\n    div\n        @slot.footer\n            p(\"Default Footer\")",
      { components }
    );
    const pageAst = buildAst("@FooterComp", { components });
    expect(pageAst[0].children[0].element).toBe("p");
    expect(pageAst[0].children[0].content).toBe("Default Footer");
  });

  it("substitutes props via {{ prop.* }}", async () => {
    const components: ComponentMap = {};
    buildAst(
      '@define.Btn\n    button.type("button").class("btn btn-{{ prop.kind }}")\n        | {{ prop.label }}',
      { components }
    );
    const ast = buildAst('@Btn.kind("primary").label("Click")', { components });
    const html = await _generateHtml(ast, 0, {});
    expect(html).toContain("btn-primary");
    expect(html).toContain("Click");
  });

  it("drops content from unknown named slots", async () => {
    const components: ComponentMap = {};
    buildAst(
      "@define.Card\n    div\n        @slot.header\n        @slot\n",
      { components }
    );
    const pageAst = buildAst(
      '@Card\n    @slot.aside\n        p("Should drop")\n    p("Body")',
      { components }
    );
    const html = await _generateHtml(pageAst, 0, {});
    expect(html).not.toContain("Should drop");
    expect(html).toContain("<p>Body</p>");
  });

  it("preserves order when multiple @slot.item blocks provided", async () => {
    const components: ComponentMap = {};
    buildAst("@define.List\n    ul\n        @slot.item\n", { components });
    const pageNml =
      "@List\n    @slot.item\n        li(\"A\")\n    @slot.item\n        li(\"B\")\n";
    const pageAst = buildAst(pageNml, { components });
    const html = await _generateHtml(pageAst, 0, {});
    expect(html.indexOf("<li>A</li>")).toBeLessThan(html.indexOf("<li>B</li>"));
  });

  it("passes through named slots in nested components", async () => {
    const components: ComponentMap = {};
    buildAst(
      "@define.Inner\n    div\n        header\n            @slot.header\n        main\n            @slot\n",
      { components }
    );
    buildAst(
      "@define.Outer\n    @Inner\n        @slot.header\n            @slot.header\n        @slot\n            @slot\n",
      { components }
    );
    const pageAst = buildAst(
      "@Outer\n    @slot.header\n        h1(\"H\")\n    p(\"B\")\n",
      { components }
    );
    const html = await _generateHtml(pageAst, 0, {});
    expect(html).toContain("<h1>H</h1>");
    expect(html).toContain("<p>B</p>");
  });
});

// ---------------------------------------------------------------------------
// Event attributes
// ---------------------------------------------------------------------------

describe("event attributes", () => {
  it("maps on:click to onclick attribute in rendered HTML", async () => {
    const ast = buildAst('button.on:click("doIt()")');
    const html = await _generateHtml(ast, 0, {});
    expect(html).toContain('onclick="doIt()"');
  });

  it("merges on:click onto a component", async () => {
    const components: ComponentMap = {};
    buildAst("@define.Btn\n    button\n        @slot", { components });
    const ast = buildAst('@Btn.on:click("go()")\n    | Click', { components });
    const html = await _generateHtml(ast, 0, {});
    expect(html).toContain('onclick="go()"');
    expect(html).toContain("Click");
  });

  it("merges multiple event and HTML attributes onto component", async () => {
    const components: ComponentMap = {};
    buildAst("@define.Btn\n    button\n        @slot", { components });
    const ast = buildAst(
      '@Btn.id("x").disabled.data-track("1").aria-label("OK").on:click("go()").on:mouseover("h()")\n    | Hi',
      { components }
    );
    const html = await _generateHtml(ast, 0, {});
    expect(html).toContain('id="x"');
    expect(html).toContain("disabled");
    expect(html).toContain('data-track="1"');
    expect(html).toContain('aria-label="OK"');
    expect(html).toContain('onclick="go()"');
    expect(html).toContain('onmouseover="h()"');
    expect(html).toContain("Hi");
  });
});
