import { describe, it, expect } from "vitest";
import { tokenize, NMLLexerError } from "../src/lexer.js";

describe("lexer — token locations", () => {
  it("assigns line 1 and column 0 to the first element", () => {
    const tokens = tokenize("div");
    const elem = tokens.find((t) => t.kind === "ELEMENT");
    expect(elem).toBeDefined();
    expect(elem!.loc.line).toBe(1);
    expect(elem!.loc.column).toBe(0);
  });

  it("assigns correct line to a second top-level element", () => {
    const tokens = tokenize("div\np");
    const elems = tokens.filter((t) => t.kind === "ELEMENT");
    expect(elems[0].loc.line).toBe(1);
    expect(elems[1].loc.line).toBe(2);
  });

  it("reports column = 4 for a one-level-indented element", () => {
    const tokens = tokenize("div\n    span");
    const spanToken = tokens.find((t) => t.kind === "ELEMENT" && t.value === "span");
    expect(spanToken).toBeDefined();
    expect(spanToken!.loc.line).toBe(2);
    expect(spanToken!.loc.column).toBe(4);
  });

  it("resets column to 0 on each new line", () => {
    const tokens = tokenize("div\np\nspan");
    const elems = tokens.filter((t) => t.kind === "ELEMENT");
    for (const t of elems) {
      expect(t.loc.column).toBe(0);
    }
  });

  it("emits MULTILINE_START for lines ending with ':'", () => {
    const tokens = tokenize("style:\n    body { }");
    const mlStart = tokens.find((t) => t.kind === "MULTILINE_START");
    expect(mlStart).toBeDefined();
    expect(mlStart!.loc.line).toBe(1);
  });

  it("emits MULTILINE_LINE tokens for each content line", () => {
    const tokens = tokenize("style:\n    body {\n        color: red;\n    }\ndiv");
    const mlLines = tokens.filter((t) => t.kind === "MULTILINE_LINE");
    expect(mlLines).toHaveLength(3);
    expect(mlLines[0].loc.line).toBe(2);
    expect(mlLines[1].loc.line).toBe(3);
    expect(mlLines[2].loc.line).toBe(4);
  });

  it("line counter resumes correctly after a multiline block", () => {
    const tokens = tokenize("style:\n    body {\n        color: red;\n    }\ndiv");
    const divToken = tokens.find((t) => t.kind === "ELEMENT" && t.value === "div");
    expect(divToken).toBeDefined();
    // style: is line 1, 3 multiline lines (2,3,4), div is line 5
    expect(divToken!.loc.line).toBe(5);
  });

  it("counts \\n correctly inside multiline blocks with empty lines", () => {
    const tokens = tokenize("style:\n    .a\n\n    .b\ndiv");
    const divToken = tokens.find((t) => t.kind === "ELEMENT" && t.value === "div");
    expect(divToken!.loc.line).toBe(5);
  });

  it("emits COMMENT token for // lines", () => {
    const tokens = tokenize("// this is a comment\ndiv");
    const comment = tokens.find((t) => t.kind === "COMMENT");
    expect(comment).toBeDefined();
    expect(comment!.loc.line).toBe(1);
  });

  it("emits BLANK token for empty lines", () => {
    const tokens = tokenize("div\n\np");
    const blank = tokens.find((t) => t.kind === "BLANK");
    expect(blank).toBeDefined();
    expect(blank!.loc.line).toBe(2);
  });

  it("emits EOF as the last token", () => {
    const tokens = tokenize("div");
    expect(tokens[tokens.length - 1].kind).toBe("EOF");
  });
});

describe("lexer — error handling", () => {
  it("throws NMLLexerError for tab indentation with loc.line set", () => {
    try {
      tokenize("div\n\tspan");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NMLLexerError);
      expect((e as NMLLexerError).loc.line).toBe(2);
    }
  });

  it("throws NMLLexerError for 2-space indentation", () => {
    try {
      tokenize("div\n  span");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NMLLexerError);
      expect((e as NMLLexerError).loc.line).toBe(2);
    }
  });

  it("throws NMLLexerError for bad indentation inside multiline block", () => {
    try {
      tokenize("style:\n  body");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NMLLexerError);
      expect((e as NMLLexerError).loc.line).toBe(2);
    }
  });
});
