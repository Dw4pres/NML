# 🗺️ NML Project Roadmap

> **Name:** Neat Markup Language (NML) · **Extension:** `.nml`
>
> 

Our goal: a component-based web framework that abstracts away repetitive HTML/CSS syntax, enabling rapid development of clean, modern web applications — with zero client-side bloat.

---

## 🏛️ Origins — Python Era

### Phase 1 — Static Compiler ✅

- [x] **Core Parser:** Indentation-based tree building (`build_ast`)
- [x] **Line Parser:** `element.attr("...").content("...")` syntax (`parse_line`)
- [x] **HTML Renderer:** AST → HTML string (`generate_html`)
- [x] **CLI Runner:** `main.py` script to compile `.nml` → `.html`

### Phase 2 — Parser Polish ✅

- [x] **Boolean Attributes:** `link.crossorigin`
- [x] **Multiline Content:** Global `style:` blocks
- [x] **Comments:** `//` syntax
- [x] **Doctype:** `doctype.html`
- [x] **Error Handling:** User-friendly errors ("Indentation error on line 5")

### Phase 3 — NML Simple Server ✅

- [x] **Dev Server:** Flask server serving `.nml` files in real-time
- [x] **Template Variables:** `h1("Hello, {{ username }}!")`
- [x] **Content Pipe:** `|` syntax for clean text content

### Phase 4 — Full-Fledged Framework ✅

- [x] **4.1 Component Architecture**
  - `@define.ComponentName` — reusable components in `components.nml`
  - `@slot` — inject child content
  - `@ComponentName` — call components
  - Hybrid attribute merging (append vs. replace)
- [x] **4.2 Component Styling**
  - `@style:` — scoped CSS block
  - Deterministic `nml-c-xxxxxx` scope IDs (hash of name + style)
  - Auto-inject scope ID to root element; emit only when component is used
- [x] **4.3 Templating Enhancements**
  - Named slots: `@slot.name` with fallback content
  - Props: `{{ prop.* }}` inside components
- [x] **4.4 HTML Safety**
  - Default HTML escaping; `{{ var|raw }}` opt-out
  - Extended void elements and boolean attributes
- [x] **4.5 CLI & DX**
  - `--components` flag, `nml.config.json` discovery
  - `--watch` mode with no extra dependencies
- [x] **4.6 CSS Scoping v2**
  - Deterministic scope IDs
  - Inject used styles only
- [x] **4.7 Quality**
  - Tests for escaping, HTML support, CLI, scope IDs, named slots, props
  - GitHub Actions CI (pytest)

### Phase 5 — Python Wrap-Up ✅

- [x] **5.1** File-based routing: `templates/users/[id].nml` → `/users/<id>`
- [x] **5.2** Client events via `on:*` attributes
- [x] **5.3** `pyproject.toml` packaging + `nmlc` console script

---

## ⚡ NML 2.x — TypeScript / Bun Monorepo

### Phase 1 — `@nml-lang/compiler-ts` ✅

*Full TypeScript rewrite of the compiler with source location tracking on every token.*

- [x] `lexer.ts` — tokenizer with `{ line, column }` on every token; newline counting in multiline blocks
- [x] `parser.ts` — `build_ast`, `_expand_components_pass`, `_inject_slot`, `_extract_scoped_style`, `parse_line`
- [x] `renderer.ts` — `generate_html` with context variable rendering
- [x] `index.ts` — `CompilerAdapter` interface + `nmlCompiler` singleton
- [x] **111 tests** (Vitest):
  - `render-variables` (8) · `parse-line` (19) · `build-ast` (14)
  - `components` (23) · `generate-html` (17) · `lexer` (14)
  - `loc-propagation` (9) · `adapter` (7)
- [x] Bun workspace root setup

### Phase 2 — `@nml-lang/cli` ✅

*The `nml` binary — a full project scaffold and dev toolchain.*

- [x] `src/index.ts` — command dispatcher (`init` / `dev` / `build` / `deploy` / `test`)
- [x] `src/scaffold.ts` — silent gap-filler (never overwrites)
- [x] `src/detector.ts` — `hx-*` / `x-*` attribute scanner
- [x] `src/localizer.ts` — CDN asset downloader + CDN src rewriter
- [x] `src/commands/init.ts` — interactive wizard: name, stack, extras; scaffolds everything
- [x] `src/commands/dev.ts` — gap-fill → launch Vite
- [x] `src/commands/build.ts` — detect libs → CDN download → Vite build → rewrite CDN srcs
- [x] `src/commands/deploy.ts` — build + `wrangler deploy`
- [x] `src/commands/test.ts` — NML lint (fail-fast) → `bun test`
- [x] **34 tests**: `detector` (7) · `localizer` (8) · `init` (16) · `test-command` (3)

### Phase 3 — `@nml-lang/vite-plugin` + Worker Template ✅

*`.nml` → ESM transform with HMR and static HTML emission.*

- [x] `transform` hook: `*.nml` → ESM (`render(ctx)` + `html` + `default`)
- [x] `resolveId` hook: relative `.nml` imports
- [x] `load` hook: reads `.nml` from disk
- [x] `handleHotUpdate`: HMR invalidation + full-reload
- [x] `generateBundle`: emits compiled HTML for each `views/*.nml` (SSG)
- [x] `NMLParserError` → `this.error()` with `file:line:column`
- [x] **14 tests**: transform (6) · resolveId (2) · load (3) · generateBundle (3)
- [x] `worker-template` — Hono + Cloudflare Workers scaffold

### Phase 4 — `@nml-lang/mcp-server` ✅

*stdio MCP server — makes NML a first-class tool for AI coding assistants.*

- [x] `tools.ts` — pure, injectable handler functions:
  - `compile(source, ctx)` → `{ ok, html }` | `{ ok:false, error, line, column }`
  - `lint(source)` → `{ valid, errors: [{message, line, column}] }`
  - `listComponents(filePath)` → `{ components: [{name, hasSlot, hasStyle, props}] }`
- [x] `index.ts` — stdio MCP server with `ListTools` + `CallTool` handlers
- [x] Compatible with Windsurf, Claude Desktop, Cursor, Zed
- [x] **16 tests**: compile (5) · lint (4) · listComponents (7)

### Phase 5 — README & Docs ✅

- [x] Full monorepo README with syntax reference, MCP setup, API docs, design principles
- [x] `.gitignore` — Bun/TypeScript/Wrangler rules

### Phase 6 — CI & Tooling ✅

- [x] `.github/workflows/ci.yml` — Bun CI, matrix (latest + canary), `--frozen-lockfile`
- [x] `test:all` + `typecheck` root scripts
- [x] Conditional exports + `resolve.conditions` in all Vitest configs

### Phase 7 — `@nml-lang/router` ✅

*Universal file-based routing — pure TS, no framework coupling.*

- [x] `scanner.ts` — `views/users/[id].nml` → `/users/:id` with specificity sort
- [x] `matcher.ts` — pure `matchRoute()` with URI decode + query strip
- [x] `manifest.ts` — `serializeRouteMap` / `deserializeRouteMap` (JSON)
- [x] `hono.ts` — `registerNmlRoutes()` Hono adapter
- [x] **19 tests**: scan (8) · match (7) · manifest (4)
- [x] `cli/commands/build.ts` — writes `dist/routes.json`
- [x] **Total: 194 tests**

### Phase 8 — `@include` Partials + Async Render ✅

*Template composition with pluggable file I/O (fs, R2, D1, in-memory).*

- [x] `CompilerAdapter.render()` → `Promise<string>` (breaking change, all callers updated)
- [x] `@include("path/to/partial.nml")` directive:
  - Context inheritance + override merge
  - Circular include detection
  - Pluggable `readFile` (works on Workers / R2 / D1)
- [x] `generateHtml()` → async throughout
- [x] **12 new tests** in `include.test.ts`
- [x] **Total: 206 tests**

### Phase 9 — HTMX / Alpine.js Protocol ✅

*Agent hallucination absorption: colons and dashes compile identically.*

- [x] `hx:get` / `x:data` colon-form → dash-form normalization in parser
- [x] Extensible `_prefixRegistry` for any future library
- [x] `nml init` starters: HTMX counter, Alpine toggle, Vanilla form
- [x] **16 new detector tests** · **Total: 220 tests**

### Phase 10 — Edge Adapter Abstraction ✅

*One `FetchHandler` type, zero framework coupling.*

- [x] `createHandler(routeMap, compiler, opts)` → `(Request) => Promise<Response>`
- [x] `@nml-lang/bun-server` — `startServer()` wrapping `Bun.serve()`
- [x] `worker-template` refactored: Hono owns `/api/*`, NML handler owns everything else
- [x] `nml init` extended with `bun-server` stack
- [x] **Total: 222 tests**

### Phase 11 — Loops, Conditionals, Filters ✅

*Full template logic with Pythonic truthiness.*

- [x] `@each(items as item)` / `@endeach` — loop directive
- [x] `@if(condition)` / `@else` / `@endif` — conditional directive
- [x] `postProcessConditionalsPass` — sibling-based AST restructuring
- [x] `isTruthy()` — `null`, `""`, `[]`, `{}`, `0` → `false`
- [x] Filter pipeline: `{{ val|filter }}` · `{{ val|filter("arg") }}`
  - Built-ins: `uppercase` · `lowercase` · `trim` · `json` · `default("x")`
- [x] **39 new tests** in `each-if-filters.test.ts`
- [x] **Total: 261 tests**


### Phase 12 — Stabilize & Ship 🔄

**12A — Templating Docs** ✅
- [x] `docs/templating.md` — full reference for loops, conditionals, filters
- [x] `isTruthy` table · filter pipeline syntax · Alpine.js `json` filter example

**12B — Better Error Messages** ✅
- [x] Unclosed `@if` → `"Missing @endif for @if on line N"`
- [x] Unclosed `@each` → `"Missing @endeach for @each on line N"`
- [x] Throws `NMLParserError` with `loc` preserved

**12C — npm Publish** ✅
- [x] Created `@nml-lang` org on npmjs.com
- [x] Renamed all packages: `@nml/` → `@nml-lang/`; `vite-plugin-nml` → `@nml-lang/vite-plugin`
- [x] Published `@nml-lang/compiler-ts@2.2.0`
- [x] Published `@nml-lang/router@2.2.0`
- [x] Published `@nml-lang/vite-plugin@2.2.0`
- [x] Published `@nml-lang/cli@2.2.0`
- [x] Published `@nml-lang/mcp-server@2.2.0`

### Phase 13 — Editor Experience ✅

**13A — VS Code / Windsurf Extension** ✅
- [x] `packages/vscode-nml` — standalone VS Code extension package
- [x] `syntaxes/nml.tmLanguage.json` — TextMate grammar:
  - Elements, `.attr()` chains, HTMX `.hx-*`, Alpine `.x-*`, event `.on:*`
  - Directives: `@define`, `@slot`, `@style:`, `@include`, `@each`, `@if`, `@else`, `@endif`
  - Template variables: `{{ var }}`, `{{ var|filter }}`, `{{ var|filter("arg") }}`
  - Pipe content: `element | text`, comments: `// ...`, `doctype.html`
- [x] `snippets/nml.code-snippets` — 14 snippets (`nml-doc`, `neach`, `nif`, `ndefine`, `ninclude`, `nhtmx`, `nalpine`, …)
- [x] `language-configuration.json` — auto-close pairs, folding, indent rules, `//` comments
- [x] `package.json` — VS Code marketplace-ready (`vsce package` / `vsce publish`)

**13B — True HMR** ✅
- [x] `handleHotUpdate` sends `nml:update` custom WS event with re-rendered HTML (no full-reload)
- [x] Parse error falls back to `full-reload` so Vite error overlay still works
- [x] `nmlToEsm` injects `import.meta.hot` client handler — patches `[data-nml-src]` DOM nodes in place
- [x] `import.meta.hot.accept()` keeps module live without triggering cascade reload
- [x] **6 new tests** (handleHotUpdate × 4, HMR client injection × 2) · **20 vite-plugin tests total**
- [x] `@nml-lang/vite-plugin@2.2.1` built and ready to publish

### Phase 14 — Interactive Playground ✅

*Browser-based live compiler with Monaco editor — dogfoods `index.nml` as the shell.*

- [x] `packages/playground/` — standalone Vite app
- [x] `index.nml` — playground shell written in NML (dogfooding), compiled by inline Vite plugin
- [x] `src/main.ts` — Monaco editor with custom NML Monarch tokenizer + `nml-dark` theme:
  - Syntax highlighting: tags (green), directives (red/orange/purple), attributes (yellow), strings (light blue), variables (blue), pipe content (white), comments (grey)
  - State-machine tokenizer: `content` state after `|` prevents tag rule bleeding into pipe text
- [x] 50ms debounced compile loop — `nmlCompiler.render()` → live `srcdoc` iframe preview
- [x] Compile time + output size metrics in header
- [x] Parse error display in preview pane with line/column
- [x] Demo source: `@define.Card` component, `@each` loop, `@if`/`@else`, HTMX `hx-get`, scoped `@style:`
- [x] **Isomorphic compiler fixes** (unblocked browser usage):
  - Replaced `crypto.createHash` with inline djb2 hash (browser has no Node crypto)
  - Replaced `path.dirname/join/resolve` with inline helpers (browser has no Node path)
- [x] `@nml-lang/compiler-ts@2.2.1` published with isomorphic fixes

### Phase 15 — Ecosystem Adapters 📋

**15A — `@nml-lang/express`**
- [ ] `createExpressHandler(opts)` → `RequestHandler`

**15B — `@nml-lang/react`** *(lower priority)*
- [ ] `renderNml(src, ctx)` → string usable inside Server Components
- [ ] Evaluate zero-bloat tradeoff before implementing

### Phase 16 — Language Improvements � *(user feedback-driven)*

> Based on real-world usage from early adopters and AI agents.

**16A — Syntax Ergonomics**
- [ ] `@else if` directive to reduce nesting indentation
- [ ] Fenced literal blocks for code/raw HTML: ```html ... ```
- [ ] Auto-resolution of component definitions (remove ordering requirement)

**16B — Component System Enhancements**
- [ ] Typed component props with default values (consider zero-bloat impact)
- [ ] Component prop validation at compile time

**16C — Language Sugar *(lower priority)*
- [ ] `@switch` / `@case` directive
- [ ] `@set(varName, expr)` for computed locals  
- [ ] Multi-filter chains: `{{ val|trim|uppercase }}`

---

## 🎯 User Feedback Highlights

**What Works Well:**
- MCP integration with `nml_lint` provides instant validation for AI agents
- Dot-chaining attributes (`.href("/").class("text-white")`) is more readable than HTML
- Component system (`@define`/`@slot`/props) hits the sweet spot of minimal abstraction
- `@each`/`@if` truthiness rules eliminate empty-array rendering bugs
- `|json` filter for Alpine.js shows real-world consideration

**Areas for Improvement:**
- Missing `@else if` creates nested `@if`/`@else` chains
- Code blocks require manual HTML escaping (`&lt;`, `&gt;`)
- Component props are stringly-typed with no compile-time validation
- Component definition ordering is a footgun for newcomers

---

*282 tests passing · All packages published · CI green*
