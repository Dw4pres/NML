# NML — Neat Markup Language

> "Simple and effective when written, but a powerhouse under the hood."

A component-first markup language that compiles to clean HTML. Write less boilerplate than plain HTML, get scoped CSS, named slots, template variables, and a full edge-ready toolchain — without a heavy client framework.

---

## What's in the monorepo

| Package | Description |
|---|---|
| [`@nml/compiler-ts`](packages/compiler-ts/) | Core TypeScript compiler — lexer, parser, renderer, `CompilerAdapter` interface |
| [`@nml/cli`](packages/cli/) | `nml` binary — `init`, `dev`, `build`, `deploy`, `test` commands |
| [`vite-plugin-nml`](packages/vite-plugin-nml/) | Vite transform plugin — `*.nml` → ESM, HMR, static HTML emission |
| [`@nml/mcp-server`](packages/mcp-server/) | stdio MCP server — `nml_compile`, `nml_lint`, `nml_list_components` tools for AI assistants |
| [`worker-template`](packages/worker-template/) | Hono + Cloudflare Workers scaffold — ready-to-deploy edge app |

**Runtime:** [Bun](https://bun.sh) · **Tests:** Vitest · **Deploy:** Cloudflare Workers via Wrangler

---

## Quick Start

### New project

```bash
bunx @nml/cli init
```

The wizard asks for a name, stack (`edge` / `static` / `hybrid`), and optional extras (HTMX, Alpine.js, Tailwind). It scaffolds everything and never overwrites existing files.

```bash
cd my-app
bun install
nml dev          # Vite dev server
nml build        # Detect libs → download CDN assets → Vite build
nml deploy       # Build + wrangler deploy
nml test         # NML lint (parse errors with file:line) + bun test
```

### Existing project — add the Vite plugin

```bash
bun add -d vite-plugin-nml
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import nml from "vite-plugin-nml";

export default defineConfig({
  plugins: [nml({ viewsDir: "views" })],
});
```

Import `.nml` files as ES modules:

```ts
import render, { html } from "./views/index.nml";

// html — pre-rendered string with empty context
// render(context) — re-renders with variables
document.body.innerHTML = render({ title: "Hello" });
```

---

## NML Syntax

NML uses **4-space indentation** to express nesting. There is no closing tag.

### Elements & attributes

```nml
div.class("container").id("main")
    h1("Hello, World")
    p("A paragraph.")
```

```html
<div class="container" id="main">
  <h1>Hello, World</h1>
  <p>A paragraph.</p>
</div>
```

### Template variables

```nml
h1("Welcome, {{ name }}!")
```

Variables are **HTML-escaped by default**. Use `{{ var|raw }}` to opt out.

### Components

Define in `components.nml`, use anywhere:

```nml
@define.Card
    div.class("card")
        div.class("card-header")
            @slot.header
        div.class("card-body")
            @slot
    @style:
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; }
```

```nml
@Card
    @slot.header
        h2("My Title")
    p("Card body content.")
```

- **`@slot`** — default slot for child content
- **`@slot.name`** — named slot with optional fallback content
- **`@style:`** — scoped CSS block, stable `nml-c-xxxxxx` attribute auto-injected, styles only emitted if the component is used on the page

### Props

```nml
@define.Button
    button.class("btn btn-{{ prop.kind }}")
        | {{ prop.label }}

@Button.kind("primary").label("Save")
```

### Events

```nml
button.on:click("handleClick()")
    | Click me
```

`on:*` maps directly to the equivalent `on*` HTML attribute.

### Doctype & full document

```nml
doctype.html
html.lang("en")
    head
        meta.charset("UTF-8")
        title("{{ title }}")
    body
        h1("{{ heading }}")
```

### Comments

```nml
// This is a comment — not rendered
div
    // Nested comment
    p("visible")
```

---

## MCP Server (AI Assistant Integration)

The `@nml/mcp-server` exposes three tools to any MCP-compatible AI assistant (Windsurf, Claude, Cursor, Zed):

| Tool | Description |
|---|---|
| `nml_compile` | Compile NML source → HTML with optional context variables |
| `nml_lint` | Validate NML syntax, return errors with `line:column` |
| `nml_list_components` | Parse a `components.nml` file, return `@define` names + slot/style/prop metadata |

### Add to Windsurf

In `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "nml": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/NML/packages/mcp-server/src/index.ts"],
      "disabled": false,
      "env": {}
    }
  }
}
```

Restart Windsurf. The three NML tools will be available to Cascade automatically.

### Add to Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "nml": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/NML/packages/mcp-server/src/index.ts"]
    }
  }
}
```

Restart Claude Desktop. The tools appear automatically in Claude's tool list.

### Add to Cursor

In `~/.cursor/mcp.json` (or via **Cursor Settings → MCP**):

```json
{
  "mcpServers": {
    "nml": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/NML/packages/mcp-server/src/index.ts"]
    }
  }
}
```

### Add to Zed

In your Zed `settings.json` (macOS: `~/.config/zed/settings.json`):

```json
{
  "context_servers": {
    "nml": {
      "command": {
        "path": "bun",
        "args": ["run", "/absolute/path/to/NML/packages/mcp-server/src/index.ts"]
      }
    }
  }
}
```

### Add to any MCP-compatible client

The server communicates over **stdio** (standard input/output) — it works with any client that supports the MCP stdio transport:

```
command: bun
args:    ["run", "/absolute/path/to/NML/packages/mcp-server/src/index.ts"]
```

---

## Compiler API

```ts
import { nmlCompiler } from "@nml/compiler-ts";

const html = nmlCompiler.render('h1("Hello")', { name: "World" });
```

### Custom adapter

```ts
import type { CompilerAdapter } from "@nml/compiler-ts";

class MyCompiler implements CompilerAdapter {
  render(input: string, context = {}) { ... }
}
```

### Low-level

```ts
import { buildAst, generateHtml, NMLParserError } from "@nml/compiler-ts";

try {
  const ast = buildAst(source);
  const html = generateHtml(ast, 0, context);
} catch (err) {
  if (err instanceof NMLParserError) {
    console.error(`${err.loc.line}:${err.loc.column} — ${err.message}`);
  }
}
```

---

## Edge Worker (Hono + Cloudflare Workers)

The `worker-template` package is a ready-to-use scaffold:

```
worker-template/
  worker/index.ts       Hono app — render NML inline, add API routes
  views/index.nml       Default view
  components.nml        Component definitions
  vite.config.ts        Vite + vite-plugin-nml, proxy to localhost:8787
  wrangler.jsonc        Cloudflare Workers config
```

```bash
cd packages/worker-template
bun install
bun run dev             # Wrangler dev + Vite
bun run deploy          # wrangler deploy
```

---

## Development

```bash
# Install all workspace deps
bun install

# Run tests in a specific package
cd packages/compiler-ts && bun run test
cd packages/cli         && bun run test
cd packages/vite-plugin-nml && bun run test
cd packages/mcp-server  && bun run test
```

**Test counts:** compiler-ts (111) · cli (34) · vite-plugin-nml (14) · mcp-server (16) = **175 total**

---

## Design Principles

- **Server-rendered by default.** Pages render instantly and work without JavaScript.
- **No VDOM, no hydration.** NML → HTML is a pure function.
- **Components are simple.** Input + slots → HTML. Scoped styles injected only when used.
- **Interactivity is progressive.** Use native HTML, `on:*` events, HTMX, or Alpine.js — your choice.
- **Toolchain is thin.** Bun + Vite + Wrangler. No webpack, no Babel, no framework runtime.
- **AI-native.** The MCP server makes NML a first-class tool for AI coding assistants.

---

## Roadmap

See [`Project Roadmap.md`](Project%20Roadmap.md).
