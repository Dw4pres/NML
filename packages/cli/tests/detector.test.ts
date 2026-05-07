import { describe, it, expect, beforeEach } from "vitest";
import {
  detectLibraries,
  detectLibrariesInNml,
  registerLibrary,
  getRegistry,
  anyDetected,
} from "../src/detector.js";

// ---------------------------------------------------------------------------
// detectLibraries (HTML string) — Map-based API
// ---------------------------------------------------------------------------

describe("detectLibraries (HTML string)", () => {
  it("detects hx-post → hx- is true", () => {
    const html = `<button hx-post="/api/submit">Submit</button>`;
    const result = detectLibraries(html);
    expect(result.get("hx-")).toBe(true);
    expect(result.get("x-")).toBe(false);
  });

  it("detects x-data → x- is true", () => {
    const html = `<div x-data="{ count: 0 }"><span x-text="count"></span></div>`;
    const result = detectLibraries(html);
    expect(result.get("hx-")).toBe(false);
    expect(result.get("x-")).toBe(true);
  });

  it("detects both htmx and alpine", () => {
    const html = `<div x-data="{}" hx-get="/items"><span hx-swap="outerHTML"></span></div>`;
    const result = detectLibraries(html);
    expect(result.get("hx-")).toBe(true);
    expect(result.get("x-")).toBe(true);
  });

  it("Vanilla Mode — neither prefix detected → anyDetected is false", () => {
    const html = `<div class="container"><p>Hello</p></div>`;
    const result = detectLibraries(html);
    expect(result.get("hx-")).toBe(false);
    expect(result.get("x-")).toBe(false);
    expect(anyDetected(result)).toBe(false);
  });

  it("anyDetected returns true when at least one prefix found", () => {
    const html = `<button hx-get="/items">Load</button>`;
    const result = detectLibraries(html);
    expect(anyDetected(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectLibrariesInNml (NML source) — dash form
// ---------------------------------------------------------------------------

describe("detectLibrariesInNml (NML source) — dash form", () => {
  it("detects .hx-post in NML → hx- is true", () => {
    const nml = `button.hx-post("/api/submit")\n    | Submit`;
    const result = detectLibrariesInNml(nml);
    expect(result.get("hx-")).toBe(true);
    expect(result.get("x-")).toBe(false);
  });

  it("detects .x-data in NML → x- is true", () => {
    const nml = `div.x-data("{ open: false }")`;
    const result = detectLibrariesInNml(nml);
    expect(result.get("hx-")).toBe(false);
    expect(result.get("x-")).toBe(true);
  });

  it("Vanilla Mode — plain NML → anyDetected false", () => {
    const nml = `div.class("container")\n    p("Hello")`;
    const result = detectLibrariesInNml(nml);
    expect(anyDetected(result)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectLibrariesInNml — colon sugar form (Phase 9)
// ---------------------------------------------------------------------------

describe("detectLibrariesInNml (NML source) — colon sugar form", () => {
  it("detects .hx:post in NML (colon form) → hx- is true", () => {
    const nml = `button.hx:post("/api/submit")\n    | Submit`;
    const result = detectLibrariesInNml(nml);
    expect(result.get("hx-")).toBe(true);
  });

  it("detects .x:data in NML (colon form) → x- is true", () => {
    const nml = `div.x:data("{ open: false }")`;
    const result = detectLibrariesInNml(nml);
    expect(result.get("x-")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// registerLibrary — custom prefix
// ---------------------------------------------------------------------------

describe("registerLibrary — custom prefix extension", () => {
  beforeEach(() => {
    // Clean up any test-added prefixes by not resetting (registry is additive)
    // We just ensure test prefix doesn't break existing ones
  });

  it("registerLibrary adds a new prefix to the registry", () => {
    registerLibrary("_", "https://cdn.example.com/hyperscript.js");
    const reg = getRegistry();
    expect(reg.get("_")).toBe("https://cdn.example.com/hyperscript.js");
  });

  it("detectLibraries detects the custom prefix after registration", () => {
    registerLibrary("hs-", "https://cdn.example.com/hyperscript.js");
    const html = `<button hs-on="click: toggle('.menu')">Menu</button>`;
    const result = detectLibraries(html);
    expect(result.get("hs-")).toBe(true);
  });

  it("detectLibrariesInNml detects the custom prefix after registration", () => {
    registerLibrary("hs-", "https://cdn.example.com/hyperscript.js");
    const nml = `button.hs-on("click: toggle('.menu')")\n    | Menu`;
    const result = detectLibrariesInNml(nml);
    expect(result.get("hs-")).toBe(true);
  });

  it("existing prefixes still work after adding custom prefix", () => {
    registerLibrary("custom-", "https://cdn.example.com/custom.js");
    const html = `<div hx-get="/items" x-data="{}"></div>`;
    const result = detectLibraries(html);
    expect(result.get("hx-")).toBe(true);
    expect(result.get("x-")).toBe(true);
    expect(result.get("custom-")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getRegistry
// ---------------------------------------------------------------------------

describe("getRegistry", () => {
  it("returns a copy with at least hx- and x- entries", () => {
    const reg = getRegistry();
    expect(reg.has("hx-")).toBe(true);
    expect(reg.has("x-")).toBe(true);
    expect(reg.get("hx-")).toContain("htmx");
    expect(reg.get("x-")).toContain("alpinejs");
  });

  it("returned map is a copy — mutations do not affect the registry", () => {
    const reg = getRegistry();
    reg.delete("hx-");
    const reg2 = getRegistry();
    expect(reg2.has("hx-")).toBe(true);
  });
});
