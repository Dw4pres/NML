import { describe, it, expect } from "vitest";
import { nmlCompiler, NMLParserError, type CompilerAdapter } from "../src/index.js";

describe("CompilerAdapter interface", () => {
  it("nmlCompiler satisfies the CompilerAdapter interface", () => {
    expect(typeof nmlCompiler.render).toBe("function");
  });

  it("nmlCompiler.render returns a Promise<string> for valid NML", async () => {
    const html = await nmlCompiler.render("div");
    expect(typeof html).toBe("string");
    expect(html).toContain("<div>");
  });

  it("nmlCompiler.render handles context variables", async () => {
    const html = await nmlCompiler.render('p("Hello {{ name }}")', { name: "World" });
    expect(html).toContain("Hello World");
  });

  it("nmlCompiler.render defaults to empty context when not provided", async () => {
    const html = await nmlCompiler.render('p("Hello {{ name }}")');
    expect(html).toContain("{{ name }}"); // unreplaced, not crashed
  });

  it("a custom object implementing CompilerAdapter can be used as a drop-in replacement", async () => {
    const customCompiler: CompilerAdapter = {
      render(_input: string, _ctx?: Record<string, unknown>): Promise<string> {
        return Promise.resolve("<custom />");
      },
    };

    async function useCompiler(compiler: CompilerAdapter, input: string): Promise<string> {
      return compiler.render(input);
    }

    expect(await useCompiler(customCompiler, "anything")).toBe("<custom />");
    expect(await useCompiler(nmlCompiler, "div")).toContain("<div>");
  });

  it("throws NMLParserError (not a crash) for invalid NML", async () => {
    await expect(nmlCompiler.render("div\n  bad-indent")).rejects.toThrow(NMLParserError);
  });

  it("injects scoped styles into output when components with styles are used", async () => {
    const nml =
      "@define.Btn\n    button\n        @slot\n    @style:\n        .btn { color: red; }\n@Btn\n    | Click";
    const html = await nmlCompiler.render(nml);
    expect(html).toContain("data-nml-scoped-styles");
    expect(html).toContain("color: red;");
  });
});
