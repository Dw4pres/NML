/**
 * commands/init.ts
 * Interactive wizard for `nml init`.
 * Prompts for stack, extras, then scaffolds project files.
 * Never overwrites existing files.
 */

import { writeFile, access, mkdir } from "fs/promises";
import { join } from "path";
import * as readline from "readline";

export type Stack = "edge" | "static" | "hybrid" | "bun-server";
export interface InitOptions {
  name: string;
  stack: Stack;
  extras: { htmx: boolean; alpine: boolean; tailwind: boolean };
  cwd: string;
  /** Override readline for testing */
  rl?: readline.Interface;
}

async function fileExists(p: string): Promise<boolean> {
  return access(p).then(() => true).catch(() => false);
}

async function writeIfMissing(p: string, content: string): Promise<void> {
  if (await fileExists(p)) return;
  await mkdir(join(p, ".."), { recursive: true });
  await writeFile(p, content, "utf-8");
}

// ---------------------------------------------------------------------------
// Template generators
// ---------------------------------------------------------------------------

function genPackageJson(name: string, stack: Stack, extras: InitOptions["extras"]): string {
  const deps: Record<string, string> = {
    "@nml/compiler-ts": "^2.2.0",
  };
  if (stack === "edge" || stack === "hybrid") {
    deps["hono"] = "^4.0.0";
  }
  if (stack === "bun-server") {
    deps["@nml/router"] = "^2.2.0";
  }
  if (extras.tailwind) deps["tailwindcss"] = "^3.0.0";

  const devDeps: Record<string, string> = {
    "@nml/cli": "^2.2.0",
    "vite": "^5.0.0",
    "vite-plugin-nml": "^2.2.0",
    "vitest": "^2.0.0",
    "typescript": "^5.5.0",
  };
  if (stack === "edge" || stack === "hybrid") {
    devDeps["wrangler"] = "^3.0.0";
  }
  if (stack === "bun-server") {
    devDeps["@types/bun"] = "latest";
  }

  const scripts: Record<string, string> = {
    dev: "nml dev",
    build: "nml build",
    test: "nml test",
  };
  if (stack === "edge" || stack === "hybrid") {
    scripts["deploy"] = "nml deploy";
  }
  if (stack === "bun-server") {
    scripts["start"] = "bun src/server.ts";
  }

  return JSON.stringify(
    { name, version: "0.1.0", private: true, scripts, dependencies: deps, devDependencies: devDeps },
    null,
    2
  ) + "\n";
}

function genViteConfig(stack: Stack, extras: InitOptions["extras"]): string {
  const plugins: string[] = ["nml()"];
  const imports = [`import { defineConfig } from "vite";`, `import nml from "vite-plugin-nml";`];

  if (extras.tailwind) {
    imports.push(`import tailwindcss from "tailwindcss";`);
  }

  const headScripts: string[] = [];
  if (extras.htmx) headScripts.push('    <script src="https://unpkg.com/htmx.org/dist/htmx.min.js"></script>');
  if (extras.alpine) headScripts.push('    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs/dist/cdn.min.js"></script>');

  const proxyBlock =
    stack === "hybrid"
      ? `\n  server: {\n    proxy: {\n      "/api": "http://localhost:8787",\n    },\n  },`
      : "";

  const cssBlock =
    extras.tailwind
      ? `\n  css: {\n    postcss: {\n      plugins: [tailwindcss()],\n    },\n  },`
      : "";

  return (
    imports.join("\n") +
    "\n\n" +
    `export default defineConfig({\n  plugins: [${plugins.join(", ")}],${proxyBlock}${cssBlock}\n});\n`
  );
}

function genWranglerJsonc(name: string): string {
  return `{
  "name": "${name}",
  "main": "worker/index.ts",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "${name}-db",
      "database_id": "REPLACE_WITH_YOUR_D1_ID"
    }
  ]
}
`;
}

function genWorkerIndexTs(stack: Stack, extras: InitOptions["extras"] = { htmx: false, alpine: false, tailwind: false }): string {
  const corsImport = stack === "hybrid"
    ? `import { cors } from "hono/cors";\n`
    : "";
  const corsUse = stack === "hybrid"
    ? `\napp.use("*", cors({ origin: "http://localhost:5173" }));\n`
    : "";

  const htmxEndpoint = extras.htmx ? `
let _count = 0;
app.post("/api/increment", (c) => {
  _count++;
  return c.html(\`<div id="counter"><p>Count: \${_count}</p><button hx-post="/api/increment" hx-target="#counter" hx-swap="outerHTML">Increment</button></div>\`);
});
` : "";

  return `import { Hono } from "hono";
${corsImport}
const app = new Hono();
${corsUse}
app.get("/", (c) => c.text("Hello from NML Worker!"));
${htmxEndpoint}
export default app;
`;
}

function genIndexNml(extras: InitOptions["extras"]): string {
  const htmxScript = extras.htmx
    ? '\n        script.src("https://unpkg.com/htmx.org/dist/htmx.min.js")'
    : "";
  const alpineScript = extras.alpine
    ? '\n        script.src("https://cdn.jsdelivr.net/npm/alpinejs/dist/cdn.min.js").defer'
    : "";
  const tailwindScript = extras.tailwind
    ? '\n        script.src("https://cdn.tailwindcss.com")'
    : "";

  // HTMX starter: working counter via hx-post + /api/increment
  if (extras.htmx) {
    return `doctype.html
html.lang("en")
    head
        meta.charset("UTF-8")
        meta.name("viewport").content("width=device-width, initial-scale=1.0")
        title("NML + HTMX Counter")${tailwindScript}${htmxScript}
    body
        h1("HTMX Counter")
        p("A server-driven counter using hx:post — no page reload needed.")
        div.id("counter")
            p("Count: 0")
            button.hx:post("/api/increment").hx:target("#counter").hx:swap("outerHTML")("Increment")
`;
  }

  // Alpine starter: toggle/accordion via x:data + x:show
  if (extras.alpine) {
    return `doctype.html
html.lang("en")
    head
        meta.charset("UTF-8")
        meta.name("viewport").content("width=device-width, initial-scale=1.0")
        title("NML + Alpine Toggle")${tailwindScript}${alpineScript}
    body
        h1("Alpine Toggle")
        p("A reactive toggle using x:data and x:show — zero server roundtrips.")
        div.x:data("{ open: false }")
            button.x:on:click("open = !open")("Toggle Details")
            div.x:show("open")
                p("Details are now visible! Toggle again to hide.")
`;
  }

  // Vanilla / default: pure HTML form, zero JS
  return `doctype.html
html.lang("en")
    head
        meta.charset("UTF-8")
        meta.name("viewport").content("width=device-width, initial-scale=1.0")
        title("NML App")${tailwindScript}
    body
        h1("Hello from NML!")
        p("Vanilla Mode — pure static HTML, zero JS downloads.")
        form.method("post").action("/submit")
            label.for("name")("Your name:")
            input.type("text").id("name").name("name").placeholder("Alice")
            button.type("submit")("Submit")
`;
}

function genComponentsNml(): string {
  return `// Define reusable components here
// Example:
// @define.MyComponent
//     div.class("my-component")
//         @slot
//     @style:
//         .my-component {
//             padding: 1rem;
//         }
`;
}

function genBunServerTs(): string {
  return `import { readFile } from "fs/promises";
import { resolve } from "path";
import { nmlCompiler } from "@nml/compiler-ts";
import { scanRoutes, createHandler } from "@nml/router";

const port = parseInt(process.env.PORT ?? "3000", 10);
const viewsDir = resolve("views");

const routeMap = await scanRoutes(viewsDir);

const handler = createHandler(routeMap, nmlCompiler, {
  readFile: (path) => readFile(path, "utf-8"),
});

Bun.serve({ port, fetch: handler });
console.log(\`NML Bun server running at http://localhost:\${port}\`);
`;
}

function genPreCommitHook(): string {
  return `#!/bin/sh
bun run nml test
`;
}

// ---------------------------------------------------------------------------
// Prompt helper
// ---------------------------------------------------------------------------

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function promptChoice<T extends string>(
  rl: readline.Interface,
  question: string,
  choices: T[]
): Promise<T> {
  const labels = choices.map((c, i) => `  ${i + 1}) ${c}`).join("\n");
  while (true) {
    const answer = await prompt(rl, `${question}\n${labels}\n> `);
    const idx = parseInt(answer.trim(), 10) - 1;
    if (idx >= 0 && idx < choices.length) return choices[idx];
    console.log("Invalid choice, try again.");
  }
}

async function promptMultiSelect(
  rl: readline.Interface,
  question: string,
  choices: string[]
): Promise<boolean[]> {
  const labels = choices.map((c, i) => `  ${i + 1}) ${c}`).join("\n");
  const answer = await prompt(
    rl,
    `${question}\n${labels}\n  (Enter numbers separated by spaces, or press Enter to skip)\n> `
  );
  const selected = new Set(
    answer.trim().split(/\s+/).map((n) => parseInt(n, 10) - 1).filter((i) => i >= 0 && i < choices.length)
  );
  return choices.map((_, i) => selected.has(i));
}

// ---------------------------------------------------------------------------
// Main init function
// ---------------------------------------------------------------------------

export async function runInit(opts?: Partial<InitOptions>): Promise<void> {
  const cwd = opts?.cwd ?? process.cwd();
  let rl = opts?.rl;
  const ownRl = !rl;

  if (ownRl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  const iface = rl!;

  try {
    const name = opts?.name ?? ((await prompt(iface, "Project name: ")).trim() || "nml-app");

    const stackChoice = opts?.stack ?? (await promptChoice(
      iface,
      "Select stack:",
      ["edge", "static", "hybrid", "bun-server"] as Stack[]
    ));
    const stack = stackChoice as Stack;

    let extras = opts?.extras ?? { htmx: false, alpine: false, tailwind: false };
    if (!opts?.extras) {
      const extraChoices = ["Alpine.js", "HTMX", "Tailwind CSS"];
      const selected = await promptMultiSelect(iface, "Select extras (optional):", extraChoices);
      extras = { alpine: selected[0], htmx: selected[1], tailwind: selected[2] };
    }

    console.log(`\nScaffolding "${name}" (${stack} stack)...`);

    // package.json
    await writeIfMissing(join(cwd, "package.json"), genPackageJson(name, stack, extras));

    // vite.config.ts
    await writeIfMissing(join(cwd, "vite.config.ts"), genViteConfig(stack, extras));

    // wrangler.jsonc + worker/index.ts (Edge & Hybrid only)
    if (stack === "edge" || stack === "hybrid") {
      await writeIfMissing(join(cwd, "wrangler.jsonc"), genWranglerJsonc(name));
      await writeIfMissing(join(cwd, "worker", "index.ts"), genWorkerIndexTs(stack, extras));
    }

    // Bun server entry point
    if (stack === "bun-server") {
      await writeIfMissing(join(cwd, "src", "server.ts"), genBunServerTs());
    }

    // views/index.nml
    await writeIfMissing(join(cwd, "views", "index.nml"), genIndexNml(extras));

    // components.nml
    await writeIfMissing(join(cwd, "components.nml"), genComponentsNml());

    // Pre-commit hook
    const hookPath = join(cwd, ".git", "hooks", "pre-commit");
    const gitExists = await fileExists(join(cwd, ".git"));
    if (gitExists) {
      await writeIfMissing(hookPath, genPreCommitHook());
      // Make executable (no-op on Windows, works on Unix)
      try {
        const { chmod } = await import("fs/promises");
        await chmod(hookPath, 0o755);
      } catch {
        // ignore on platforms where chmod is unavailable
      }
    }

    console.log("\nDone! Next steps:");
    console.log("  bun install");
    console.log("  nml dev");
  } finally {
    if (ownRl) iface.close();
  }
}
