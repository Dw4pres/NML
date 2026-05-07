<p align="center">
  <img src="./assets/logo.svg" alt="neat. Markup Language" width="500">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nml-lang/compiler-ts"><img src="https://img.shields.io/npm/v/%40nml-lang%2Fcompiler-ts?label=%40nml-lang%2Fcompiler-ts&color=000" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@nml-lang/cli"><img src="https://img.shields.io/npm/v/%40nml-lang%2Fcli?label=%40nml-lang%2Fcli&color=000" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@nml-lang/vite-plugin"><img src="https://img.shields.io/npm/v/%40nml-lang%2Fvite-plugin?label=%40nml-lang%2Fvite-plugin&color=000" alt="npm version"></a>
  <img src="https://img.shields.io/badge/runtime-Bun-f472b6" alt="Bun">
  <img src="https://img.shields.io/badge/deploy-Cloudflare%20Workers-f38020" alt="Cloudflare Workers">
</p>

# ⚡ NML (Neat Markup Language)

**The Zero-Bloat, Agent-Optimized Edge Framework.**

> "Simple and effective when written, but a powerhouse under the hood."

NML is a component-first markup language that compiles to clean HTML. Write less boilerplate than plain HTML, get scoped CSS, named slots, template variables, and a full edge-ready toolchain — without a heavy client framework runtime.

## ✨ The "Aha!" Moment

Write 60% less code. Eliminate closing tags, braces, and client-side JS bloat. NML natively understands HTMX and Alpine.js, absorbing the mental overhead so you (and your AI agents) can move faster.

```nml
// views/dashboard.nml
doctype.html
html
    head
        title | User Dashboard
    
    body.class("p-8 font-sans bg-gray-900 text-white")
        h1.class("text-2xl font-bold mb-4") | System Users
        
        // HTMX seamlessly integrated without JS bloat
        button.hx-get("/api/users").hx-target("#user-list").class("bg-blue-600 p-2") 
            | Refresh Data
        
        div.id("user-list").class("mt-6")
            @if(users)
                table.class("w-full text-left")
                    @each(users as user)
                        tr.class("border-b border-gray-700")
                            td.class("p-2") | {{ user.name }}
                            td.class("p-2 text-gray-400") | {{ user.email }}
            @else
                p.class("text-gray-500 py-4") | No users found in database.
```

## 🚀 Quick Start

### New Project

```bash
bunx @nml-lang/cli init
```

The wizard asks for a name, stack (**Edge**, **Static**, or **Hybrid**), and optional extras (HTMX, Alpine.js, Tailwind). It scaffolds everything and never overwrites existing files.

```bash
cd my-app
bun install
nml dev          # Vite dev server with HMR
nml build        # Detect libs → download CDN assets → Vite build
nml deploy       # Build + wrangler deploy
nml test         # NML lint (parse errors with file:line) + bun test
```

### Existing Project — Add the Vite Plugin

```bash
bun add -d @nml-lang/vite-plugin
```

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import nml from "@nml-lang/vite-plugin";

export default defineConfig({
  plugins: [nml({ viewsDir: "views" })],
});
```

Import `.nml` files directly as ES modules:

```javascript
import render, { html } from "./views/index.nml";

// html — pre-rendered string with empty context
// render(context) — re-renders with variables
document.body.innerHTML = render({ title: "Hello" });
```

## 📖 NML Syntax

NML uses 4-space indentation to express nesting. There is no closing tag.

### Elements & Attributes

```nml
div.class("container").id("main")
    h1 | Hello, World
    p | A paragraph.
```

### Template Variables & Filters

Variables are HTML-escaped by default. You can use filters or opt out entirely.

```nml
h1 | Welcome, {{ user.name }}!
p  | Price: {{ price|default("0.00") }}
script.x-data="{{ alpineState|json }}"
div | {{ dangerousHtml|raw }}
```

### Loops & Conditionals

NML uses Python-like truthiness. Empty arrays `[]` and empty strings `""` evaluate to `false`.

```nml
@if(items)
    ul
        @each(items as item)
            li | {{ item.name }}
@else
    p | No items found.
```

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
        .card { border: 1px solid #ddd; padding: 1rem; }

// Usage:
@Card
    @slot.header
        h2 | My Title
    p | Card body content.
```

* `@slot` — default slot for child content.

* `@slot.name` — named slot.

* `@style:` — scoped CSS block. A stable `nml-c-xxxxxx` attribute is auto-injected.

### Props

```nml
@define.Button
    button.class("btn btn-{{ prop.kind }}")
        | {{ prop.label }}

@Button.kind("primary").label("Save")
```

### Partials (`@include`)

Split large templates into smaller files:

```nml
// views/index.nml
doctype.html
html
    head
        @include("partials/head.nml")
    body
        @include("partials/nav.nml")
        main | {{ content }}
```

Includes inherit the parent context and support nesting. Circular includes throw a parse error.

### Events

`on:*` maps directly to the equivalent `on*` HTML attribute.

```nml
button.on:click("handleClick()")
    | Click me
```

## 🧠 AI-Native (MCP Server)

The `@nml-lang/mcp-server` exposes tools to any MCP-compatible AI assistant (Windsurf, Claude, Cursor, Zed) so it can write and validate NML flawlessly:

* `nml_compile` — Compile NML source to HTML.

* `nml_lint` — Validate NML syntax, returning exact `line:column` errors.

* `nml_list_components` — Parse `components.nml` and return `@define` documentation.

### Add to Windsurf

In `~/.codeium/windsurf/mcp_config.json`:

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

### Add to Cursor

In `~/.cursor/mcp.json` (or via Cursor Settings → MCP):

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

## 📦 Monorepo Packages

| Package | npm | Description |
|---|---|---|
| [`@nml-lang/compiler-ts`](packages/compiler-ts/) | [![npm](https://img.shields.io/npm/v/%40nml-lang%2Fcompiler-ts?color=000)](https://www.npmjs.com/package/@nml-lang/compiler-ts) | Core TS compiler — lexer, parser, renderer, CompilerAdapter |
| [`@nml-lang/cli`](packages/cli/) | [![npm](https://img.shields.io/npm/v/%40nml-lang%2Fcli?color=000)](https://www.npmjs.com/package/@nml-lang/cli) | `nml` binary — init, dev, build, deploy, test commands |
| [`@nml-lang/vite-plugin`](packages/vite-plugin-nml/) | [![npm](https://img.shields.io/npm/v/%40nml-lang%2Fvite-plugin?color=000)](https://www.npmjs.com/package/@nml-lang/vite-plugin) | Vite transform plugin — `*.nml` → ESM, HMR, HTML emission |
| [`@nml-lang/router`](packages/router/) | [![npm](https://img.shields.io/npm/v/%40nml-lang%2Frouter?color=000)](https://www.npmjs.com/package/@nml-lang/router) | Universal routing layer (`views/` → URL mapping) |
| [`@nml-lang/bun-server`](packages/bun-server/) | [![npm](https://img.shields.io/npm/v/%40nml-lang%2Fbun-server?color=000)](https://www.npmjs.com/package/@nml-lang/bun-server) | Zero-config Bun HTTP server with file-based routing |
| [`@nml-lang/mcp-server`](packages/mcp-server/) | [![npm](https://img.shields.io/npm/v/%40nml-lang%2Fmcp-server?color=000)](https://www.npmjs.com/package/@nml-lang/mcp-server) | `stdio` MCP server for AI assistants |
| [`worker-template`](packages/worker-template/) | — | Hono + Cloudflare Workers scaffold | 

## 🔌 Compiler API (Low-Level)

```typescript
import { nmlCompiler, buildAst, generateHtml, NMLParserError } from "@nml-lang/compiler-ts";

// High-level render (async)
const html = await nmlCompiler.render('h1 | Hello {{ name }}', { name: "World" });

// Low-level AST parsing
try {
  const ast = buildAst(source);
  const rawHtml = await generateHtml(ast, 0, context);
} catch (err) {
  if (err instanceof NMLParserError) {
    console.error(`Error at ${err.loc.line}:${err.loc.column} — ${err.message}`);
  }
}
```

## 🖥️ Bun Server

Run NML as a standalone Bun HTTP server — no Hono, no Workers required:

```typescript
import { startServer } from "@nml-lang/bun-server";

await startServer({ port: 3000, viewsDir: "./views" });
```

File-based routing works automatically: `views/users/[id].nml` → `/users/:id`.

## ☁️ Edge Worker (Hono + Cloudflare)

The `worker-template` package is a ready-to-use edge scaffold:

```text
worker-template/
  worker/index.ts       # Hono app — render NML inline, add API routes
  views/index.nml       # Default view
  components.nml        # Component definitions
  vite.config.ts        # Vite + @nml-lang/vite-plugin, proxy to localhost:8787
  wrangler.jsonc        # Cloudflare Workers config
```

## 🛠️ Design Principles

* **Server-rendered by default:** Pages render instantly and work without JavaScript.

* **No VDOM, no hydration:** NML → HTML is a pure function.

* **Components are simple:** Input + slots → HTML. Scoped styles injected only when used.

* **Interactivity is progressive:** Use native HTML, `on:*` events, HTMX, or Alpine.js.

* **Toolchain is thin:** Bun + Vite + Wrangler. No webpack, no Babel, no framework runtime.

* **AI-native:** The MCP server makes NML a first-class tool for autonomous AI coding assistants.

---

## 🗺️ Roadmap

See [`Project Roadmap.md`](Project%20Roadmap.md).

---

<p align="center">Built with ❤️ using <a href="https://bun.sh">Bun</a> · Deployed on <a href="https://workers.cloudflare.com">Cloudflare Workers</a></p>
