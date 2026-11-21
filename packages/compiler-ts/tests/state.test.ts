import { describe, it, expect } from "vitest";
import { nmlCompiler, NMLParserError, buildAstWithState } from "../src/index.js";
import { generateHtml } from "../src/renderer.js";
import { buildAst, type ComponentMap } from "../src/parser.js";

// ---------------------------------------------------------------------------
// In-memory readFileFn builder (mirrors include.test.ts)
// ---------------------------------------------------------------------------

function makeReadFile(files: Record<string, string>) {
  return async (path: string): Promise<string> => {
    const normalized = path.replace(/\\/g, "/");
    const key = Object.keys(files).find((k) => normalized.endsWith(k.replace(/\\/g, "/")));
    if (key === undefined) throw new Error(`File not found: ${path}`);
    return files[key];
  };
}

const STATE_SCRIPT = (json: string) =>
  `<script type="application/json" data-nml-state>${json}</script>`;

// ---------------------------------------------------------------------------
// @state declarations — parsing
// ---------------------------------------------------------------------------

describe("@state — declarations", () => {
  it("parses a number value", () => {
    const { state } = buildAstWithState("@state.count(0)");
    expect(state).toEqual({ count: 0 });
  });

  it("parses every JSON value type", () => {
    const src = [
      "@state.count(42)",
      "@state.label(\"hello\")",
      "@state.open(true)",
      "@state.nothing(null)",
      "@state.tags([\"a\", \"b\"])",
      "@state.user({\"name\": \"Al\", \"age\": 3})",
    ].join("\n");
    const { state } = buildAstWithState(src);
    expect(state).toEqual({
      count: 42,
      label: "hello",
      open: true,
      nothing: null,
      tags: ["a", "b"],
      user: { name: "Al", age: 3 },
    });
  });

  it("strips declaration nodes so they produce no HTML", async () => {
    const html = await nmlCompiler.render("@state.count(0)\np | hi");
    expect(html.startsWith("<p>hi</p>")).toBe(true);
    expect(html).not.toContain("@state");
  });

  it("throws on invalid JSON with a fix hint", () => {
    expect(() => buildAstWithState("@state.count(abc)")).toThrow(NMLParserError);
    expect(() => buildAstWithState("@state.count(abc)")).toThrow(/invalid JSON value/);
    expect(() => buildAstWithState("@state.count(abc)")).toThrow(/number, string, boolean, null, array, or object/);
  });

  it("throws on single-quoted strings (not valid JSON)", () => {
    expect(() => buildAstWithState("@state.label('hi')")).toThrow(/invalid JSON value/);
  });

  it("throws when the value is missing", () => {
    expect(() => buildAstWithState("@state.count")).toThrow(/requires a JSON value/);
    expect(() => buildAstWithState("@state.count()")).toThrow(/invalid JSON value/);
  });

  it("throws when the name is missing", () => {
    expect(() => buildAstWithState("@state(0)")).toThrow(/requires a name and a JSON value/);
  });

  it("throws on duplicate declarations, naming the first line", () => {
    const src = "@state.count(0)\n@state.count(1)";
    expect(() => buildAstWithState(src)).toThrow(NMLParserError);
    expect(() => buildAstWithState(src)).toThrow(/declared twice/);
    expect(() => buildAstWithState(src)).toThrow(/first declared on line 1/);
    try {
      buildAstWithState(src);
    } catch (err) {
      expect((err as NMLParserError).loc.line).toBe(2);
    }
  });

  it("throws on @state inside @define (no component-local state in v1)", () => {
    const src = "@define.Card\n    @state.count(0)\n    div | x";
    expect(() => buildAstWithState(src)).toThrow(/component-local state is not supported in v1/);
    expect(() => buildAstWithState(src)).toThrow(/Declare @state at the top of the file/);
  });

  it("throws on @state nested inside an element", () => {
    const src = "div\n    @state.count(0)";
    expect(() => buildAstWithState(src)).toThrow(/top level of the file/);
  });

  it("throws when state is used before it is declared", () => {
    const src = "p | {{ count }}\n@state.count(0)";
    expect(() => buildAstWithState(src)).toThrow(/used on line 1 but declared on line 2/);
    expect(() => buildAstWithState(src)).toThrow(/above its first use/);
  });

  it("throws when state is used in @if before it is declared", () => {
    const src = "@if(count)\n    p | yes\n@endif\n@state.count(1)";
    expect(() => buildAstWithState(src)).toThrow(/used on line 1 but declared on line 4/);
  });

  it("allows declarations anywhere top-level before first use", async () => {
    const src = "p | intro\n@state.count(7)\np | {{ count }}";
    const html = await nmlCompiler.render(src);
    expect(html).toContain("<p>7</p>");
  });

  it("does not treat a @define template's state reference as an ordered use", () => {
    // Template bodies are definitions, not uses — a reference inside @define
    // is fine even when the @define block precedes the declaration.
    const src = "@define.Card\n    div | {{ count }}\n@state.count(3)";
    expect(() => buildAstWithState(src)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// State values in templates
// ---------------------------------------------------------------------------

describe("@state — rendering", () => {
  it("seeds {{ }} reads with initial values", async () => {
    const html = await nmlCompiler.render("@state.count(0)\np | Count: {{ count }}");
    expect(html).toContain("Count: 0");
  });

  it("renders string, boolean, null and object values", async () => {
    const src = [
      "@state.label(\"hi\")",
      "@state.open(true)",
      "@state.nothing(null)",
      "@state.user({\"name\": \"Al\"})",
      "p | {{ label }}-{{ open }}-{{ nothing }}-{{ user.name }}",
    ].join("\n");
    const html = await nmlCompiler.render(src);
    expect(html).toContain("hi-true-null-Al");
  });

  it("supports @if truthiness on state values", async () => {
    const zero = await nmlCompiler.render(
      "@state.count(0)\n@if(count)\n    p | yes\n@else\n    p | no\n@endif"
    );
    expect(zero).toContain("<p>no</p>");
    const nonZero = await nmlCompiler.render(
      "@state.count(2)\n@if(count)\n    p | yes\n@else\n    p | no\n@endif"
    );
    expect(nonZero).toContain("<p>yes</p>");
  });

  it("supports @each over a state array", async () => {
    const src = [
      "@state.items([\"a\", \"b\"])",
      "ul",
      "    @each(items as item)",
      "        li | {{ item }}",
      "    @endeach",
    ].join("\n");
    const html = await nmlCompiler.render(src);
    expect(html).toContain("<li>a</li>");
    expect(html).toContain("<li>b</li>");
  });

  it("explicit render context wins over @state initial values", async () => {
    const html = await nmlCompiler.render("@state.count(0)\np | {{ count }}", { count: 99 });
    expect(html).toContain("99");
    expect(html).not.toContain("Count: 0");
  });

  it("explicit context does not leak state names it does not define", async () => {
    const html = await nmlCompiler.render("@state.count(0)\np | {{ count }}-{{ other }}", { other: "x" });
    expect(html).toContain("0-x");
  });
});

// ---------------------------------------------------------------------------
// SSR payload
// ---------------------------------------------------------------------------

describe("@state — SSR payload", () => {
  it("includes the initial state as a JSON script block", async () => {
    const html = await nmlCompiler.render("@state.count(0)\n@state.label(\"hi\")\np | x");
    expect(html).toContain(STATE_SCRIPT('{"count":0,"label":"hi"}'));
  });

  it("places the payload immediately before </body> when present", async () => {
    const src = [
      "@state.count(0)",
      "doctype.html",
      "html",
      "    head",
      "        title | T",
      "    body",
      "        p | {{ count }}",
    ].join("\n");
    const html = await nmlCompiler.render(src);
    expect(html).toContain(`${STATE_SCRIPT('{"count":0}')}\n</body>`);
    expect(html.indexOf("data-nml-state")).toBeLessThan(html.indexOf("</body>"));
  });

  it("appends the payload at the end when there is no </body>", async () => {
    const html = await nmlCompiler.render("@state.count(0)\np | {{ count }}");
    expect(html.endsWith(STATE_SCRIPT('{"count":0}'))).toBe(true);
  });

  it("payload reflects context overrides of state values", async () => {
    const html = await nmlCompiler.render("@state.count(0)\np | {{ count }}", { count: 5 });
    expect(html).toContain(STATE_SCRIPT('{"count":5}'));
  });

  it("escapes </script> inside state string values", async () => {
    const html = await nmlCompiler.render('@state.label("</script><script>alert(1)</script>")\np | x');
    expect(html).not.toContain('"</script>');
    expect(html).toContain("\\u003c/script>");
    // The payload is still valid JSON once unescaped
    const match = html.match(/data-nml-state>(.*?)<\/script>/);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1].replace(/\\u003c/g, "<"))).toEqual({
      label: "</script><script>alert(1)</script>",
    });
  });

  it("emits no script tag when no @state is declared (regression)", async () => {
    const src = "doctype.html\nhtml\n    head\n        title | T\n    body\n        p | Hi";
    const html = await nmlCompiler.render(src);
    expect(html).toBe(
      "<!DOCTYPE html>\n<html>\n    <head>\n        <title>T</title>\n    </head>\n    <body>\n        <p>Hi</p>\n    </body>\n</html>"
    );
    expect(html).not.toContain("data-nml-state");
  });

  it("renders stateless fragments byte-identical to before", async () => {
    const html = await nmlCompiler.render('button.on:click("doIt()") | Go');
    expect(html).toBe('<button onclick="doIt()">Go</button>');
  });
});

// ---------------------------------------------------------------------------
// State actions
// ---------------------------------------------------------------------------

describe("@state — actions", () => {
  it("translates count++ to data-nml-action and drops onclick", async () => {
    const html = await nmlCompiler.render('@state.count(0)\nbutton.on:click("count++") | Inc');
    expect(html).toContain('data-nml-action="count++"');
    expect(html).not.toContain("onclick");
  });

  it("translates count--, assignment literals, negation and arithmetic", async () => {
    const cases: Array<[string, string]> = [
      ['button.on:click("count--")', "count--"],
      ['button.on:click("count = 5")', "count = 5"],
      ['button.on:click("label = \'hi\'")', "label = 'hi'"],
      ['button.on:click("open = !open")', "open = !open"],
      ['button.on:click("count = count + 1")', "count = count + 1"],
      ['button.on:click("count = (count + 1) * 2")', "count = (count + 1) * 2"],
      ['button.on:click("count = total % 3")', "count = total % 3"],
    ];
    const src = [
      "@state.count(0)",
      "@state.total(10)",
      "@state.label(\"x\")",
      "@state.open(false)",
    ].join("\n");
    for (const [line, action] of cases) {
      const html = await nmlCompiler.render(`${src}\n${line} | x`);
      expect(html).toContain(`data-nml-action="${action}"`);
      expect(html).not.toContain("onclick");
    }
  });

  it("translates actions via buildAst alone (lint path)", () => {
    const ast = buildAst('@state.count(0)\nbutton.on:click("count++")');
    expect(ast[0].attributes["data-nml-action"]).toBe("count++");
    expect(ast[0].attributes["data-nml-event"]).toBe("click");
    expect(ast[0].attributes["onclick"]).toBeUndefined();
  });

  it("emits data-nml-event for click, change, and submit handlers", async () => {
    const src = "@state.count(0)\n@state.done(false)";
    const click = await nmlCompiler.render(
      `${src}\nbutton.on:click("count++") | Inc`
    );
    expect(click).toContain('data-nml-event="click"');
    const change = await nmlCompiler.render(
      `${src}\ninput.type("checkbox").on:change("done = !done")`
    );
    expect(change).toContain('data-nml-event="change"');
    const submit = await nmlCompiler.render(
      `${src}\nform.on:submit("count = 0")`
    );
    expect(submit).toContain('data-nml-event="submit"');
  });

  it("passes non-state handlers through unchanged", async () => {
    const html = await nmlCompiler.render(
      '@state.count(0)\nbutton.on:click("handleClick()") | Go'
    );
    expect(html).toContain('onclick="handleClick()"');
    expect(html).not.toContain("data-nml-action");
  });

  it("leaves Alpine x-on:click handlers untouched", async () => {
    const html = await nmlCompiler.render(
      '@state.open(false)\nbutton.x:on:click("open = !open") | Toggle'
    );
    expect(html).toContain('x-on:click="open = !open"');
    expect(html).not.toContain("data-nml-action");
  });

  it("translates a call-site handler merged onto a component root", async () => {
    const components: ComponentMap = {};
    buildAst("@define.Btn\n    button | {{ prop.label }}", { components });
    const html = await nmlCompiler.render(
      '@state.count(0)\n@Btn.label("Go").on:click("count++")',
      {},
      { components }
    );
    expect(html).toContain(">Go</button>");
    expect(html).toContain('data-nml-action="count++"');
    expect(html).not.toContain("onclick");
  });

  it("errors on an unsupported action form, listing supported forms", () => {
    expect(() => buildAst('@state.count(0)\nbutton.on:click("count + 1")')).toThrow(
      /Unsupported state action/
    );
    expect(() => buildAst('@state.count(0)\nbutton.on:click("count + 1")')).toThrow(
      /name\+\+, name--, name = <literal>, name = !name/
    );
    expect(() => buildAst('@state.count(0)\nbutton.on:click("showAlert(count)")')).toThrow(
      /Unsupported state action/
    );
    expect(() => buildAst('@state.count(0)\nbutton.on:click("count = foo + 1")')).toThrow(
      /Unsupported state action/
    );
    expect(() => buildAst('@state.count(0)\nbutton.on:click("count += 1")')).toThrow(
      /Unsupported state action/
    );
  });

  it("errors on assignment to an undeclared name with a did-you-mean hint", () => {
    expect(() => buildAst('button.on:click("count++")')).toThrow(
      /@state\.count is not declared/
    );
    expect(() => buildAst('button.on:click("count++")')).toThrow(
      /Did you mean to declare @state\.count/
    );
    expect(() => buildAst('button.on:click("foo = 1")')).toThrow(
      /Did you mean to declare @state\.foo/
    );
  });

  it("does not error on a handler whose string literal merely mentions a state name", () => {
    const ast = buildAst(`@state.count(0)\nbutton.on:click("setLabel('count')")`);
    expect(ast[0].attributes["onclick"]).toBe("setLabel('count')");
    expect(ast[0].attributes["data-nml-action"]).toBeUndefined();
  });

  it("errors on two state actions on one element", () => {
    const src = '@state.count(0)\n@state.open(false)\nbutton.on:click("count++").on:mouseover("open = true") | x';
    expect(() => buildAst(src)).toThrow(/Only one state action per element/);
  });
});

// ---------------------------------------------------------------------------
// @state in partials
// ---------------------------------------------------------------------------

describe("@state — partials", () => {
  it("seeds a partial's own state when rendered via @include", async () => {
    const files = {
      "views/index.nml": 'div\n    @include("partials/counter.nml")',
      "partials/counter.nml": "@state.count(4)\np | {{ count }}",
    };
    const html = await nmlCompiler.render(files["views/index.nml"], {}, {
      basePath: "/views/index.nml",
      readFile: makeReadFile(files),
    });
    expect(html).toContain("<p>4</p>");
    // The partial's state is not re-serialised mid-document
    expect(html).not.toContain("data-nml-state");
  });

  it("inherited parent context wins over a partial's @state defaults", async () => {
    const files = {
      "views/index.nml": 'div\n    @include("partials/counter.nml")',
      "partials/counter.nml": "@state.count(4)\np | {{ count }}",
    };
    const html = await nmlCompiler.render(files["views/index.nml"], { count: 9 }, {
      basePath: "/views/index.nml",
      readFile: makeReadFile(files),
    });
    expect(html).toContain("<p>9</p>");
  });
});
