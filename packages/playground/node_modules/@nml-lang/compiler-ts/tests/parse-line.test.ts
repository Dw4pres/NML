import { describe, it, expect } from "vitest";
import { parseLineRaw } from "../src/parser.js";

const loc = { line: 1, column: 0 };

describe("parseLineRaw", () => {
  it("parses a simple element", () => {
    const node = parseLineRaw("body", loc);
    expect(node.element).toBe("body");
    expect(node.attributes).toEqual({});
    expect(node.content).toBe("");
    expect(node.children).toEqual([]);
    expect(node.multiline_trigger).toBe(false);
    expect(node.multiline_content).toEqual([]);
  });

  it("strips leading dot (shorthand for div)", () => {
    const node = parseLineRaw(".div", loc);
    expect(node.element).toBe("div");
  });

  it("parses one attribute", () => {
    const node = parseLineRaw('body.class("text-lg")', loc);
    expect(node.attributes["class"]).toBe("text-lg");
  });

  it("parses multiple attributes", () => {
    const node = parseLineRaw('link.rel("stylesheet").href("https_link_here")', loc);
    expect(node.attributes).toMatchObject({ rel: "stylesheet", href: "https_link_here" });
  });

  it("parses content shorthand (element name as first token)", () => {
    const node = parseLineRaw('h1("Hello World")', loc);
    expect(node.element).toBe("h1");
    expect(node.content).toBe("Hello World");
    expect(node.attributes).toEqual({});
  });

  it("parses attributes AND content in the same chain", () => {
    const node = parseLineRaw('h1.class("title", "Hello World")', loc);
    expect(node.element).toBe("h1");
    expect(node.attributes["class"]).toBe("title");
    expect(node.content).toBe("Hello World");
  });

  it("handles dots inside quoted attribute values", () => {
    const node = parseLineRaw('a.href("...").class("text-blue", "Click for v1.0")', loc);
    expect(node.element).toBe("a");
    expect(node.attributes["class"]).toBe("text-blue");
    expect(node.attributes["href"]).toBe("...");
    expect(node.content).toBe("Click for v1.0");
  });

  it("parses boolean attributes", () => {
    const node = parseLineRaw('link.rel("...").crossorigin', loc);
    expect(node.attributes["rel"]).toBe("...");
    expect(node.attributes["crossorigin"]).toBe(true);
  });

  it("parses multiple boolean attributes", () => {
    const node = parseLineRaw("input.type(\"text\").disabled.readonly", loc);
    expect(node.attributes).toMatchObject({ type: "text", disabled: true, readonly: true });
  });

  it("treats bare shorthand class-like tokens as class array", () => {
    const node = parseLineRaw("html.default.lang(\"en\")", loc);
    expect(node.element).toBe("html");
    expect(node.attributes["lang"]).toBe("en");
    // 'default' is a boolean attr per spec
    expect(node.attributes["default"]).toBe(true);
  });

  it("detects multiline trigger (style:)", () => {
    const node = parseLineRaw("style:", loc);
    expect(node.multiline_trigger).toBe(true);
  });

  it("detects multiline trigger with attributes", () => {
    const node = parseLineRaw('style.class("...") :', loc);
    expect(node.element).toBe("style");
  });

  it("parses content pipe", () => {
    const node = parseLineRaw("| Hello", loc);
    expect(node.element).toBe("__text__");
    expect(node.content).toBe("Hello");
  });

  it("parses @define.ComponentName", () => {
    const node = parseLineRaw("@define.MyComponent", loc);
    expect(node.element).toBe("@define");
    expect(node.attributes["class"]).toBe("MyComponent");
  });

  it("parses @slot", () => {
    const node = parseLineRaw("@slot", loc);
    expect(node.element).toBe("@slot");
  });

  it("parses @ComponentName call", () => {
    const node = parseLineRaw("@MyComponent", loc);
    expect(node.element).toBe("@MyComponent");
  });

  it("parses @ComponentName with attributes", () => {
    const node = parseLineRaw('@MyComponent.type("submit").text-xl', loc);
    expect(node.element).toBe("@MyComponent");
    expect(node.attributes["type"]).toBe("submit");
    // text-xl is stored as a class array (dot-chain)
    expect(node.attributes["class"]).toEqual(["text-xl"]);
  });

  it("parses @style:", () => {
    const node = parseLineRaw("@style:", loc);
    expect(node.element).toBe("@style");
    expect(node.multiline_trigger).toBe(true);
  });

  it("parses on:click as onclick", () => {
    const node = parseLineRaw('button.on:click("doIt()")', loc);
    expect(node.attributes["onclick"]).toBe("doIt()");
  });

  // ---------------------------------------------------------------------------
  // Phase 9: hx:* → hx-* and x:* → x-* colon→dash normalization
  // ---------------------------------------------------------------------------

  it("normalizes hx:get to hx-get", () => {
    const node = parseLineRaw('div.hx:get("/items")', loc);
    expect(node.attributes["hx-get"]).toBe("/items");
    expect(node.attributes["hx:get"]).toBeUndefined();
  });

  it("normalizes hx:post to hx-post", () => {
    const node = parseLineRaw('button.hx:post("/api/submit")', loc);
    expect(node.attributes["hx-post"]).toBe("/api/submit");
  });

  it("normalizes hx:target to hx-target", () => {
    const node = parseLineRaw('div.hx:target("#result")', loc);
    expect(node.attributes["hx-target"]).toBe("#result");
  });

  it("normalizes hx:swap to hx-swap", () => {
    const node = parseLineRaw('div.hx:swap("outerHTML")', loc);
    expect(node.attributes["hx-swap"]).toBe("outerHTML");
  });

  it("normalizes x:data to x-data", () => {
    const node = parseLineRaw('div.x:data("{ open: false }")', loc);
    expect(node.attributes["x-data"]).toBe("{ open: false }");
    expect(node.attributes["x:data"]).toBeUndefined();
  });

  it("normalizes x:show to x-show", () => {
    const node = parseLineRaw('div.x:show("open")', loc);
    expect(node.attributes["x-show"]).toBe("open");
  });

  it("normalizes x:on:click to x-on:click", () => {
    const node = parseLineRaw('button.x:on:click("open = !open")', loc);
    expect(node.attributes["x-on:click"]).toBe("open = !open");
  });

  it("dash form hx-get passes through unchanged", () => {
    const node = parseLineRaw('div.hx-get("/items")', loc);
    expect(node.attributes["hx-get"]).toBe("/items");
  });

  it("dash form x-data passes through unchanged", () => {
    const node = parseLineRaw('div.x-data("{ count: 0 }")', loc);
    expect(node.attributes["x-data"]).toBe("{ count: 0 }");
  });

  it("bare hx:boost normalizes to hx-boost (boolean)", () => {
    const node = parseLineRaw("a.hx:boost", loc);
    expect(node.attributes["hx-boost"]).toBe(true);
    expect(node.attributes["hx:boost"]).toBeUndefined();
  });
});
