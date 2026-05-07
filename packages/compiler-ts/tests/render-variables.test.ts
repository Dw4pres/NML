import { describe, it, expect } from "vitest";
import { renderVariables } from "../src/parser.js";

describe("renderVariables", () => {
  it("substitutes a simple variable", () => {
    expect(renderVariables("Hello, {{ name }}!", { name: "Alice" })).toBe("Hello, Alice!");
  });

  it("substitutes multiple variables", () => {
    expect(
      renderVariables("User: {{ name }}, Role: {{ role }}", { name: "Alice", role: "admin" })
    ).toBe("User: Alice, Role: admin");
  });

  it("handles spacing variants (no spaces / extra spaces)", () => {
    expect(renderVariables("Hello, {{name}}!", { name: "Bob" })).toBe("Hello, Bob!");
    expect(renderVariables("Hello, {{ name  }}!", { name: "Bob" })).toBe("Hello, Bob!");
  });

  it("leaves unknown variables unchanged", () => {
    expect(renderVariables("Hello, {{ username }}!", { name: "Alice" })).toBe(
      "Hello, {{ username }}!"
    );
  });

  it("returns template unchanged when context is empty", () => {
    expect(renderVariables("Hello, {{ name }}!", {})).toBe("Hello, {{ name }}!");
  });

  it("escapes HTML by default", () => {
    expect(renderVariables("X {{ v }}", { v: "<b>hi</b>" })).toBe(
      "X &lt;b&gt;hi&lt;/b&gt;"
    );
  });

  it("allows raw HTML with |raw filter", () => {
    expect(renderVariables("X {{ v|raw }}", { v: "<b>hi</b>" })).toBe("X <b>hi</b>");
  });

  it("resolves nested dot-path variables", () => {
    expect(renderVariables("Hello {{ user.name }}", { user: { name: "Alice" } })).toBe(
      "Hello Alice"
    );
  });
});
