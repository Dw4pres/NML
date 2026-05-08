import { describe, it, expect } from "vitest";
import { buildAst, NMLParserError } from "../src/parser.js";

describe("AST node source location propagation", () => {
  it("assigns loc.line = 1 to the first element", () => {
    const ast = buildAst("div");
    expect(ast[0].loc.line).toBe(1);
  });

  it("assigns loc.line = 2 to a second sibling element", () => {
    const ast = buildAst("div\np");
    expect(ast[1].loc.line).toBe(2);
  });

  it("assigns correct loc to a nested child", () => {
    const ast = buildAst("div\n    span");
    expect(ast[0].children[0].loc.line).toBe(2);
    expect(ast[0].children[0].loc.column).toBe(4);
  });

  it("assigns correct loc to element after multiline block", () => {
    // style: is line 1, 3 content lines (2,3,4), div is line 5
    const ast = buildAst("style:\n    body {\n        color: red;\n    }\ndiv");
    const divNode = ast.find((n) => n.element === "div");
    expect(divNode).toBeDefined();
    expect(divNode!.loc.line).toBe(5);
  });

  it("assigns loc to deeply nested element", () => {
    const ast = buildAst("div\n    p\n        span");
    const span = ast[0].children[0].children[0];
    expect(span.loc.line).toBe(3);
    expect(span.loc.column).toBe(8);
  });

  it("assigns loc to text pipe node", () => {
    const ast = buildAst("p\n    | Hello");
    const textNode = ast[0].children[0];
    expect(textNode.element).toBe("__text__");
    expect(textNode.loc.line).toBe(2);
  });
});

describe("NMLParserError carries loc from the offending line", () => {
  it("reports line 2 for tab indentation error", () => {
    try {
      buildAst("div\n\tspan");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NMLParserError);
      expect((e as NMLParserError).loc.line).toBe(2);
    }
  });

  it("reports line 2 for non-standard indentation error", () => {
    try {
      buildAst("div\n  span");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NMLParserError);
      expect((e as NMLParserError).loc.line).toBe(2);
    }
  });

  it("reports correct column for indented errors", () => {
    try {
      buildAst("div\n        span"); // 8 spaces = too deep
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NMLParserError);
      // Column is 8 (the leading space count)
      expect((e as NMLParserError).loc.column).toBe(8);
    }
  });
});
