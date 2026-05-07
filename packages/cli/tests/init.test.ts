import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, access, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { rm } from "fs/promises";
import { runInit } from "../src/commands/init.js";

async function fileExists(p: string): Promise<boolean> {
  return access(p).then(() => true).catch(() => false);
}

async function readJson(p: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(p, "utf-8"));
}

describe("nml init — Edge stack", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "nml-init-edge-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("produces package.json, vite.config.ts, wrangler.jsonc, worker/index.ts, views/index.nml, components.nml", async () => {
    await runInit({ name: "test-app", stack: "edge", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    expect(await fileExists(join(cwd, "package.json"))).toBe(true);
    expect(await fileExists(join(cwd, "vite.config.ts"))).toBe(true);
    expect(await fileExists(join(cwd, "wrangler.jsonc"))).toBe(true);
    expect(await fileExists(join(cwd, "worker", "index.ts"))).toBe(true);
    expect(await fileExists(join(cwd, "views", "index.nml"))).toBe(true);
    expect(await fileExists(join(cwd, "components.nml"))).toBe(true);
  });

  it("package.json contains the project name and edge scripts", async () => {
    await runInit({ name: "my-edge-app", stack: "edge", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const pkg = await readJson(join(cwd, "package.json"));
    expect(pkg.name).toBe("my-edge-app");
    expect((pkg.scripts as Record<string, string>).deploy).toBe("nml deploy");
  });

  it("wrangler.jsonc contains the project name", async () => {
    await runInit({ name: "edge-app", stack: "edge", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const content = await readFile(join(cwd, "wrangler.jsonc"), "utf-8");
    expect(content).toContain('"edge-app"');
  });

  it("worker/index.ts imports from hono", async () => {
    await runInit({ name: "app", stack: "edge", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const content = await readFile(join(cwd, "worker", "index.ts"), "utf-8");
    expect(content).toContain("hono");
  });
});

describe("nml init — Static stack", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "nml-init-static-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("produces only package.json, vite.config.ts, views/index.nml, components.nml — no wrangler.jsonc", async () => {
    await runInit({ name: "static-app", stack: "static", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    expect(await fileExists(join(cwd, "package.json"))).toBe(true);
    expect(await fileExists(join(cwd, "vite.config.ts"))).toBe(true);
    expect(await fileExists(join(cwd, "views", "index.nml"))).toBe(true);
    expect(await fileExists(join(cwd, "components.nml"))).toBe(true);

    expect(await fileExists(join(cwd, "wrangler.jsonc"))).toBe(false);
    expect(await fileExists(join(cwd, "worker", "index.ts"))).toBe(false);
  });

  it("package.json has no deploy script for static stack", async () => {
    await runInit({ name: "static-app", stack: "static", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const pkg = await readJson(join(cwd, "package.json"));
    expect((pkg.scripts as Record<string, string>).deploy).toBeUndefined();
  });
});

describe("nml init — Hybrid stack", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "nml-init-hybrid-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("vite.config.ts contains server.proxy block pointing to localhost:8787", async () => {
    await runInit({ name: "hybrid-app", stack: "hybrid", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const config = await readFile(join(cwd, "vite.config.ts"), "utf-8");
    expect(config).toContain("proxy");
    expect(config).toContain("localhost:8787");
  });

  it("worker/index.ts imports cors from hono/cors", async () => {
    await runInit({ name: "hybrid-app", stack: "hybrid", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const content = await readFile(join(cwd, "worker", "index.ts"), "utf-8");
    expect(content).toContain("hono/cors");
    expect(content).toContain("cors(");
    expect(content).toContain("localhost:5173");
  });
});

describe("nml init — extras", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "nml-init-extras-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("HTMX extra adds CDN script tag to views/index.nml", async () => {
    await runInit({ name: "app", stack: "static", extras: { htmx: true, alpine: false, tailwind: false }, cwd });

    const nml = await readFile(join(cwd, "views", "index.nml"), "utf-8");
    expect(nml).toContain("htmx");
  });

  it("Alpine extra adds CDN script tag to views/index.nml", async () => {
    await runInit({ name: "app", stack: "static", extras: { htmx: false, alpine: true, tailwind: false }, cwd });

    const nml = await readFile(join(cwd, "views", "index.nml"), "utf-8");
    expect(nml).toContain("alpinejs");
  });

  it("Tailwind extra adds tailwindcss dependency and vite plugin", async () => {
    await runInit({ name: "app", stack: "static", extras: { htmx: false, alpine: false, tailwind: true }, cwd });

    const pkg = await readJson(join(cwd, "package.json"));
    const deps = { ...(pkg.dependencies as object), ...(pkg.devDependencies as object) };
    expect(Object.keys(deps)).toContain("tailwindcss");

    const config = await readFile(join(cwd, "vite.config.ts"), "utf-8");
    expect(config).toContain("tailwindcss");
  });
});

describe("nml init — overwrite protection", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "nml-init-overwrite-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("never overwrites an existing package.json", async () => {
    const existing = JSON.stringify({ name: "existing-app", version: "99.0.0" });
    await writeFile(join(cwd, "package.json"), existing, "utf-8");

    await runInit({ name: "new-app", stack: "static", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const content = await readFile(join(cwd, "package.json"), "utf-8");
    expect(content).toBe(existing);
  });

  it("never overwrites an existing vite.config.ts", async () => {
    const existing = "// my custom vite config";
    await writeFile(join(cwd, "vite.config.ts"), existing, "utf-8");

    await runInit({ name: "app", stack: "static", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const content = await readFile(join(cwd, "vite.config.ts"), "utf-8");
    expect(content).toBe(existing);
  });
});

describe("nml init — pre-commit hook", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "nml-init-hook-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("installs pre-commit hook when .git directory exists", async () => {
    // Simulate a git repo
    await mkdir(join(cwd, ".git", "hooks"), { recursive: true });

    await runInit({ name: "app", stack: "static", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const hookExists = await fileExists(join(cwd, ".git", "hooks", "pre-commit"));
    expect(hookExists).toBe(true);

    const hook = await readFile(join(cwd, ".git", "hooks", "pre-commit"), "utf-8");
    expect(hook).toContain("nml test");
  });

  it("skips pre-commit hook when .git directory does not exist", async () => {
    // No .git dir
    await runInit({ name: "app", stack: "static", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const hookExists = await fileExists(join(cwd, ".git", "hooks", "pre-commit"));
    expect(hookExists).toBe(false);
  });

  it("never overwrites an existing pre-commit hook", async () => {
    await mkdir(join(cwd, ".git", "hooks"), { recursive: true });
    const existing = "#!/bin/sh\n# custom hook";
    await writeFile(join(cwd, ".git", "hooks", "pre-commit"), existing, "utf-8");

    await runInit({ name: "app", stack: "static", extras: { htmx: false, alpine: false, tailwind: false }, cwd });

    const content = await readFile(join(cwd, ".git", "hooks", "pre-commit"), "utf-8");
    expect(content).toBe(existing);
  });
});
