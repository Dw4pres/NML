NML Project Vision & Roadmap

Name: Neat Markup Language (NML)
Extension: .nml
Vision: "Simple and effective when written, but a powerhouse under the hood."

Our goal is to create a component-based web framework that abstracts away repetitive and "gross" HTML/CSS syntax, allowing for rapid development of clean, modern web applications.

Phase 1: Static Compiler (Done)

[x] Core Parser: Indentation-based tree building (build_ast)

[x] Line Parser: Handle element.attr("...").content("...") syntax (parse_line)

[x] HTML Renderer: Convert the AST to an HTML string (generate_html)

[x] CLI Runner: A main.py script to compile .nml to .html

Phase 2: Parser Polish (Done)

[x] Boolean Attributes: Support for link.crossorigin

[x] Multiline Content: Support for global style: blocks

[x] Comments: Support for // comments

[x] Doctype: Support for doctype.html

[x] Error Handling: User-friendly errors (e.g., "Indentation error on line 5")

Phase 3: "NML-Simple-Server" (Done)

[x] Dev Server: A Flask server (app.py) that serves .nml files in real-time.

[x] Template Variables: Pass data from the server to templates (e.g., h1("Hello, {{ username }}!")).

[x] Content Pipe: Support | syntax for clean text content.

Phase 4: Full-Fledged Framework (NML-Core) (Done)

[x] 4.1: Component-Based Architecture

[x] @define.ComponentName: A syntax for defining reusable components in components.nml.

[x] @slot: A tag to inject child content into a component.

[x] @ComponentName: A syntax to call components.

[x] Hybrid Attribute Merging:

[x] Rule 1 (Append): @Comp.class-a appends .class-a to the component's base class.

[x] Rule 2 (Replace): @Comp.class("new-style") replaces the component's base class.

[x] 4.2: Component-Based Styling

[x] @style:: A new multiline block for defining component-scoped styles.

[x] CSS Scoping: Server automatically adds a unique hash (nml-c-12345) to selectors in @style: blocks.

[x] Auto-Injection: Server automatically applies the scope ID to the component's root element and injects the scoped CSS into the page's <head>.

[x] Base Class Injection: Server intelligently finds the first class in the @style: block (e.g., .pixel-button) and automatically adds it to the component's root element.

Recent Additions (Done)

[x] 4.3: Templating Enhancements

[x] Named Slots: Support `@slot.name` with fallback content in components and from call sites.

[x] Props: Call-site attributes available inside components via `{{ prop.* }}` for text and attributes.

[x] 4.4: HTML Safety & Compatibility

[x] Default Escaping: Variables are escaped by default with `{{ var }}`; `{{ var|raw }}` opt-out.

[x] Expanded HTML Support: Added more void elements (area/base/col/embed/param/source/track/wbr) and boolean attributes (async/defer/multiple/autofocus/novalidate/etc.).

[x] 4.5: CLI & Developer Experience

[x] CLI Flags: `--components <path>` and optional config discovery via `nml.config.json`.

[x] Watch Mode: `--watch` to rebuild on changes without extra dependencies.

[x] 4.6: CSS Scoping Improvements

[x] Deterministic Scope IDs: Stable `nml-c-xxxxxx` based on component name and style content.

[x] Inject Used Styles Only: Dev server injects scoped CSS only for components present on the page.

[x] 4.7: Quality & CI

[x] Tests: Added tests for escaping, extended HTML support, CLI with components, deterministic IDs, used-style detection, named slots, and props.

[x] CI: GitHub Actions workflow to run pytest on push/PR.

Phase 5: Current Work & Future Ideas

[x] 5.1: File-Based Routing in Dev Server: Map `templates/about.nml` → `/about`, nested folders, and dynamic segments like `templates/users/[id].nml` → `/users/<id>` with 404 fallback.

[x] 5.2: Minimal Client State: Optional tiny runtime for trivial state. (Events done via `on:*` attributes.)

[x] 5.3: Packaging & CLI: `pyproject.toml` and an `nmlc` console script; README updates.

[ ] Routing: A built-in routing system (e.g., file-based routing where templates/about.nml auto-maps to /about).

[ ] State Management: A simple, built-in way to handle client-side state.

[x] Event Handling: A syntax for client-side events (e.g., `button.on:click("myFunction")`).

Phase 6: Packaging & Release (Upcoming)

[ ] 6.1: Publish to TestPyPI and PyPI (add LICENSE, classifiers, project URLs)

[ ] 6.2: Add `nml-dev` console script to run the dev server in the current project

[ ] 6.3: Ensure `static/nml_runtime.js` is packaged and served in installed projects

[ ] 6.4: README install section (pip/uv/pipx) and CLIs (`nmlc`, `nml-dev`)

Phase 7: Enhancements (Optional/Future)

[ ] 7.1: Optional client-side navigation (progressive enhancement via `data-nml-nav`)

[ ] 7.2: CSS scoping improvements for complex selectors; add tests and docs

[ ] 7.3: Partials/includes sugar (e.g., `@include("partials/header.nml")`)

---

NML 2.2 Rewrite (TypeScript/Bun Monorepo)

Phase 1: Pluggable TypeScript Compiler (@nml/compiler-ts) — COMPLETE

[x] packages/compiler-ts/ scaffold (Bun, Vitest, tsconfig)
[x] lexer.ts — tokenizer with { line, column } source tracking on every token, newline counting in multiline blocks
[x] parser.ts — full port of build_ast, _expand_components_pass, _inject_slot, _extract_scoped_style, parse_line
[x] renderer.ts — full port of generate_html with context variable rendering
[x] index.ts — CompilerAdapter interface + TSCompiler default export (nmlCompiler singleton)
[x] 111 tests passing (Vitest):
    [x] render-variables.test.ts (8 tests) — template variable substitution, escaping, |raw, dot-paths
    [x] parse-line.test.ts (19 tests) — element parsing, attrs, content, boolean, multiline, events, @-syntax
    [x] build-ast.test.ts (14 tests) — nesting, dedents, multiline blocks, comments, error handling
    [x] components.test.ts (23 tests) — definition, expansion, slot injection, scoped styles, named slots, props, events
    [x] generate-html.test.ts (17 tests) — rendering, void elements, doctype, variables, multiline, full document
    [x] lexer.test.ts (14 tests) — location tracking, line counter, multiline block line counting, error locs
    [x] loc-propagation.test.ts (9 tests) — AST node loc, NMLParserError loc, column accuracy
    [x] adapter.test.ts (7 tests) — CompilerAdapter interface contract, custom adapter substitutability
[x] Root package.json Bun workspace setup

Phase 2: Magic CLI (@nml/cli — nml binary) — COMPLETE

[x] packages/cli/ scaffold (Bun, Vitest, tsconfig)
[x] src/index.ts — CLI entry point, command dispatcher (init/dev/build/deploy/test)
[x] src/scaffold.ts — silent gap-filler (writes only missing files, never overwrites)
[x] src/detector.ts — hx-* / x-* attribute scanner (HTML string + NML source variants)
[x] src/localizer.ts — CDN asset downloader with skip-if-exists + CDN src rewriter
[x] src/commands/init.ts — interactive wizard: name, stack (edge/static/hybrid), extras (HTMX/Alpine/Tailwind); writes package.json, vite.config.ts, wrangler.jsonc, worker/index.ts, views/index.nml, components.nml, .git/hooks/pre-commit; never overwrites
[x] src/commands/dev.ts — gap-fill then launch Vite dev server
[x] src/commands/build.ts — detect libs → download CDN assets → Vite build → rewrite CDN srcs in dist HTML
[x] src/commands/deploy.ts — build + wrangler deploy
[x] src/commands/test.ts — NML lint (parse all .nml, fail-fast with file:line) → spawn bun test
[x] 34 tests passing (Vitest):
    [x] detector.test.ts (7 tests) — HTML + NML source hx-*/x-* detection
    [x] localizer.test.ts (8 tests) — download with mocked fetch, skip-if-exists, 404 throw, rewriteCdnSrcs
    [x] init.test.ts (16 tests) — edge/static/hybrid scaffolds, extras, overwrite protection, pre-commit hook
    [x] test-command.test.ts (3 tests) — lint parse-error exit, file path in output, valid files pass lint

Phase 3: Vite Plugin + Hono Edge Worker — COMPLETE

[x] packages/vite-plugin-nml/ scaffold (Bun, Vitest, tsconfig, peerDep vite)
[x] src/index.ts — Vite plugin with:
    [x] transform hook: *.nml → ESM (exports render(context) + html string + default)
    [x] resolveId hook: resolves relative .nml imports
    [x] load hook: reads .nml from disk
    [x] handleHotUpdate hook: HMR invalidation + full-reload on .nml changes
    [x] generateBundle hook: emits compiled HTML asset for each views/*.nml (SSG/static builds)
    [x] configResolved: captures project root for relative error paths
    [x] NMLParserError → vite this.error() with file:line:column
[x] 14 tests passing (Vitest):
    [x] transform (6): null for non-nml, ESM structure, embedded source, parse error throw, error path, globalContext injection
    [x] resolveId (2): resolves relative .nml, null for non-nml
    [x] load (3): reads from disk, null for non-nml, null for missing file
    [x] generateBundle (3): emits HTML asset, empty dir, missing dir
[x] packages/worker-template/ — Hono Edge Worker scaffold template:
    [x] worker/index.ts — Hono app with CORS, nmlCompiler.render() inline templates, /api/health
    [x] views/index.nml — default view with {{ title }} variable
    [x] components.nml — commented component example
    [x] vite.config.ts — uses vite-plugin-nml + proxy to localhost:8787
    [x] wrangler.jsonc — Cloudflare Workers config with D1 example (commented)
    [x] package.json — all workspace deps wired up

Phase 4: stdio MCP Server + Real-Time Diagnostics — COMPLETE

[x] packages/mcp-server/ scaffold (Bun, Vitest, tsconfig, @modelcontextprotocol/sdk)
[x] src/tools.ts — pure, injectable handler functions:
    [x] compile(source, context) → { ok, html } | { ok:false, error, line, column }
    [x] lint(source) → { ok, valid, errors: [{message, line, column}] }
    [x] listComponents(filePath, readFileFn) → { ok, components: [{name, hasSlot, hasStyle, props}] }
        - Uses line-based scanner (not AST) because @define nodes are stripped during expansion
[x] src/index.ts — stdio MCP server:
    [x] nml_compile tool — compile NML with optional context, returns HTML or error+loc
    [x] nml_lint tool — validate syntax, returns "valid" or line:col errors
    [x] nml_list_components tool — parse components.nml, return @define metadata
    [x] ListToolsRequestSchema + CallToolRequestSchema handlers
    [x] StdioServerTransport (compatible with Windsurf, Claude, Cursor, Zed)
[x] 16 tests passing (Vitest):
    [x] compile (5): valid NML, doctype, context vars, parse error with loc, empty source
    [x] lint (4): valid NML, bad indent with error details, empty source, multiline valid
    [x] listComponents (7): no defines, single define, multiple defines, @style detection,
        prop extraction, file-not-found, parse error
[x] .windsurf/mcp.json — Windsurf MCP config pointing to packages/mcp-server/src/index.ts

Phase 5: README & Docs — COMPLETE

[x] README.md — full rewrite for TypeScript/Bun monorepo:
    [x] Monorepo package table (@nml/compiler-ts, @nml/cli, vite-plugin-nml, @nml/mcp-server, worker-template)
    [x] Quick Start — nml init wizard, nml dev/build/deploy/test
    [x] Vite plugin install + vite.config.ts example
    [x] NML syntax reference — elements, variables, components, props, events, doctype, comments
    [x] MCP server — tool table, Windsurf mcp_config.json snippet
    [x] Compiler API — nmlCompiler.render(), CompilerAdapter, buildAst/generateHtml low-level
    [x] worker-template — structure overview + bun run dev/deploy
    [x] Development — per-package test commands, total test count (175)
    [x] Design principles
[x] .gitignore — replaced Python-centric rules with Bun/TypeScript/Wrangler rules
[x] Removed legacy Python files: app.py, main.py, nml_parse.py, test_parse.py, pyproject.toml,
    requirements.txt, out.html, components.nml (root), templates/, static/, __pycache__/, .pytest_cache/, .venv/

Phase 6: CI & Tooling — COMPLETE

[x] .github/workflows/ci.yml — Bun CI (replaces python-tests.yml):
    [x] Triggers on push + PR
    [x] Matrix: bun latest + canary
    [x] Steps: checkout → setup-bun → bun install --frozen-lockfile → test each package
[x] Root package.json scripts:
    [x] test:all — bun run --filter '*' test (runs all workspace packages in parallel)
    [x] typecheck — bun run --filter '*' tsc --noEmit
[x] packages/worker-template test script — replaced nml test with echo no-op (scaffold only)
[x] packages/compiler-ts, vite-plugin-nml — added types + module + conditional exports fields

Phase 7: File-Based Routing (@nml/router) — COMPLETE

[x] packages/router/ — new workspace package, pure TS, no Hono dep
    [x] src/types.ts — RouteEntry, RouteMap, RouteSegment, MatchResult
    [x] src/scanner.ts — scanRoutes(viewsDir, readDirFn?) → RouteMap
        [x] views/index.nml → /
        [x] views/about.nml → /about
        [x] views/users/index.nml → /users
        [x] views/users/[id].nml → /users/:id
        [x] views/404.nml → fallback
        [x] Specificity sort: static=2, param=1, wildcard=0 (highest score first)
    [x] src/matcher.ts — matchRoute(routeMap, pathname) pure function
        [x] Static segments always win over param segments
        [x] URI decoding of dynamic params
        [x] Query string + hash stripped before matching
    [x] src/manifest.ts — serializeRouteMap / deserializeRouteMap (JSON)
    [x] src/hono.ts — registerNmlRoutes(app, routeMap, compiler, opts) adapter
    [x] src/index.ts — public API barrel export
[x] 19 tests passing (Vitest): scan (8), match (7), manifest (4)
[x] packages/worker-template — rewritten to use file-based routing:
    [x] scanRoutes at startup, registerNmlRoutes for all views/*.nml
    [x] views/about.nml and views/404.nml added as examples
    [x] app.notFound() renders 404.nml
[x] packages/cli/commands/build.ts — step 5: writes dist/routes.json manifest
[x] packages/cli/package.json — added @nml/router workspace dependency
[x] .github/workflows/ci.yml — router test step added
[x] Total tests: 194 (111 compiler-ts + 34 cli + 14 vite-plugin-nml + 16 mcp-server + 19 router)

Phase 8: @include Partials + Async Render Infection — COMPLETE

[x] CompilerAdapter.render() → Promise<string> (breaking change, all callers updated)
[x] CompileOptions: added readFile?: (path: string) => Promise<string> and basePath?: string
[x] RenderOptions interface exported from @nml/compiler-ts
[x] generateHtml() → async, accepts RenderOptions; recursive await throughout
[x] @include directive — parser:
    [x] parseLine: candidate === "@include" || candidate.startsWith("@include(")
    [x] parseIncludeDirective() — parses file path arg, stores in node.attributes.file
    [x] expandComponentsPass: @include excluded from component resolution
    [x] Absolute path guard (throws NMLParserError)
[x] @include directive — renderer (resolveInclude):
    [x] resolve() to absolute path relative to basePath
    [x] Circular include detection via _seenFiles Set
    [x] Missing file throws NMLParserError with descriptive message
    [x] Context inheritance: partial receives full parent context
    [x] Override merge: explicit second arg JSON merges on top of parent context
    [x] Nested includes (include inside include) work recursively
    [x] Pluggable readFile — filesystem, R2, D1, in-memory all work identically
[x] All callers updated to await render():
    [x] packages/cli/src/commands/test.ts — await nmlCompiler.render()
    [x] packages/router/src/hono.ts — NmlCompilerLike.render() → Promise<string>, await in handler
    [x] packages/mcp-server/src/tools.ts — compile() → async
    [x] packages/vite-plugin-nml/src/index.ts — generateBundle awaits, nmlToEsm emits async render()
[x] Tests — 12 new in include.test.ts:
    [x] @include parser (3): node creation, absolute path guard, missing arg
    [x] @include rendering (8): inline, context inherit, override, nested, missing file, circular, no readFile, R2-style mock
    [x] nmlCompiler.render() with @include via options (1)
[x] Existing tests updated for async render() — adapter, generate-html, components, mcp-server, vite-plugin
[x] Total tests: 206 (123 compiler-ts + 34 cli + 14 vite-plugin-nml + 16 mcp-server + 19 router)

Phase 9: Prefix Protocol Formalization + HTMX/Alpine Kit — COMPLETE

[x] detector.ts — refactored to extensible Map-based API:
    [x] DetectionResult = Map<prefix, boolean> (replaces { hasHtmx, hasAlpine })
    [x] _prefixRegistry: Map<string, string> — prefix → CDN URL
    [x] registerLibrary(prefix, cdnUrl) — open-ended extension point
    [x] getRegistry() — returns a copy of the current registry
    [x] anyDetected(result) — true when any prefix found (Vanilla Mode = false)
    [x] detectLibraries(html) — scans compiled HTML for registered prefixes
    [x] detectLibrariesInNml(nml) — scans NML source for dash-form AND colon-form
    [x] Legacy compat helper detectLibrariesInNmlLegacy() for old call sites
[x] localizer.ts — extensible CDN registry:
    [x] downloadByPrefix(prefix, opts) — downloads any registered prefix's CDN asset
    [x] FILENAME_MAP: { "hx-": "htmx.js", "x-": "alpine.js" } for canonical names
    [x] downloadLibrary() retained as legacy compat shim
    [x] build.ts updated to use Map-based detection + downloadByPrefix
[x] Parser — colon→dash normalization (parse-line.ts):
    [x] hx:get, hx:post, hx:target, hx:swap etc → hx-get, hx-post, hx-target, hx-swap
    [x] x:data, x:show, x:on:click etc → x-data, x-show, x-on:click
    [x] Bare hx:boost → hx-boost (boolean attribute)
    [x] hx-* and x-* bare attributes no longer misclassified as class shorthands
    [x] Agent hallucination absorption: colons and dashes both compile identically
[x] nml init starter templates:
    [x] HTMX: working counter with hx:post + /api/increment endpoint scaffolded in worker
    [x] Alpine: toggle/accordion with x:data + x:show + x:on:click
    [x] Vanilla: pure HTML form, zero JS — Vanilla Mode proof
[x] Tests:
    [x] detector.test.ts (16): HTML detection, NML dash form, NML colon sugar, registerLibrary, getRegistry, anyDetected, Vanilla Mode
    [x] parse-line.test.ts +11: hx:get/post/target/swap, x:data/show/on:click, dash passthrough, bare hx:boost
    [x] localizer.test.ts (8): htmx/alpine download, skip-if-exists, error on non-ok, rewriteCdnSrcs
[x] Total tests: 220 (133 compiler-ts + 43 cli + 14 vite-plugin-nml + 16 mcp-server + 19 router)

Phase 10: Edge Adapter Abstraction — COMPLETE

[x] packages/router/src/handler.ts — createHandler(routeMap, compiler, opts) → FetchHandler:
    [x] FetchHandler = (Request) => Promise<Response> — standard Web Fetch API, zero framework coupling
    [x] Matches route via matchRoute(), reads file via readFile(), renders via compiler.render()
    [x] Falls through to 404 for unmatched paths or missing files
    [x] Merges baseContext + dynamic params into render context
    [x] Configurable notFoundSrc for custom 404 pages
    [x] Exported from @nml/router barrel (createHandler, FetchHandler, NmlHandlerCompiler, NmlHandlerOptions)
[x] packages/bun-server/ — new package:
    [x] startServer(opts) — wraps createHandler, calls Bun.serve()
    [x] Auto-start guard: only runs when executed directly (typeof Bun check)
    [x] package.json, tsconfig.json (bun-types), vitest.config.ts
    [x] Smoke test (2 tests): export shape, Bun availability guard
[x] worker-template refactored:
    [x] Removed direct registerNmlRoutes / Hono page routing
    [x] createHandler() now owns all page routes; Hono handles /api/* only
    [x] app.all("*") delegates to nmlHandler(c.req.raw) — single line handoff
[x] nml init updated:
    [x] Stack type extended: "edge" | "static" | "hybrid" | "bun-server"
    [x] bun-server: scaffolds src/server.ts with startServer call
    [x] bun-server: @nml/router dep + @types/bun devDep + start script
    [x] Wrangler/Hono devDeps scoped to edge/hybrid only
[x] Tests:
    [x] router.test.ts +7 createHandler: 200 match, Content-Type, 404 unmatched, custom 404, params injected, baseContext merged, readFile throws → 404
    [x] bun-server/tests/server.test.ts (2): export shape + Bun guard
    [x] Windows path fix: normalize backslashes in test fileMap lookups
[x] Total tests: 222 (133 compiler-ts + 43 cli + 14 vite-plugin-nml + 16 mcp-server + 26 router + 2 bun-server)

Phase 11: Language Polish — Loops, Conditionals, Filters — COMPLETE

[x] @each(items as item) / @endeach — loop directive:
    [x] Renders children once per array item; item available as {{ item }} in loop body
    [x] Nested @each safe: outer loop var stays in childContext via spread
    [x] Non-array / missing key → renders nothing silently (no error)
[x] @if(condition) / @else / @endif — conditional directive:
    [x] Condition is a dot-path resolved via resolvePath against current context
    [x] Truthy → then-branch (node.children); falsy → else-branch (node.elseBranch)
    [x] @else is optional; no @else + falsy → empty output
[x] postProcessConditionalsPass — architectural fix for indentation-based AST:
    [x] @else/@endif are SIBLINGS of @if in the parent array (not children)
    [x] Pass walks siblings: moves @else.children → @if.elseBranch, removes @endif
    [x] Removes @endeach sibling closing markers
    [x] Recurses into all children arrays; runs after expandComponentsPass in buildAst
[x] isTruthy(val) — Pythonic UI-optimized truthiness:
    [x] null, undefined, 0, "", [], {} → false; everything else → JS default
    [x] Exported from @nml/compiler-ts barrel
[x] Filter pipeline in renderVariables:
    [x] {{ val|filter }} and {{ val|filter("arg") }} syntax
    [x] Lookup order: BUILTIN_FILTERS → context[filterName] → "" (silent)
    [x] Built-ins: uppercase, lowercase, trim, json (raw, for Alpine x-data), default("x")
    [x] json filter: raw output, not HTML-escaped — critical for Alpine.js DX
    [x] User-defined fn: context.currency(val) called correctly
    [x] Unknown filter → "" silently (no error, no throw)
    [x] {{ val|raw }} regression preserved
[x] Tests: tests/each-if-filters.test.ts (39 tests):
    [x] isTruthy: 12 cases (all falsy/truthy types)
    [x] postProcessConditionalsPass: 4 structural tests
    [x] @each: 5 tests (basic loop, empty array, missing key, non-array, nested)
    [x] @if: 8 tests (truthy/falsy, else-branch, dot-path, sibling isolation, isTruthy array)
    [x] filters: 10 tests (all 5 built-ins + user-defined + unknown + raw regression + missing var)
[x] Total tests: 261 (172 compiler-ts + 43 cli + 14 vite-plugin-nml + 16 mcp-server + 26 router + 2 bun-server)

═══════════════════════════════════════════════════════════════════
NML: The Path to 1.0 — Stabilization & Adoption
═══════════════════════════════════════════════════════════════════

Phase 12: Stabilize & Ship (Priority 1) — IN PROGRESS

12A: Documentation — @each, @if, filters [x]
    [x] docs/templating.md — full language reference for loops, conditionals, filters
    [x] BUILTIN_FILTERS reference table (uppercase, lowercase, trim, json, default)
    [x] isTruthy truthiness table
    [x] Filter pipeline syntax: {{ val|filter }} and {{ val|filter("arg") }}
    [x] Alpine.js json filter integration example
    [x] Combining @each + @if example

12B: Better Error Messages — missing closing tags [x]
    [x] postProcessConditionalsPass: unclosed @if → "Missing @endif for @if on line N"
    [x] postProcessConditionalsPass: unclosed @each → "Missing @endeach for @each on line N"
    [x] @if with @else but no @endif → correctly caught
    [x] Throws NMLParserError (not generic Error) — loc preserved
    [x] 4 new tests in each-if-filters.test.ts (error messages describe block)

12C: NPM Publish Workflow [ ]
    [ ] Decide public package scope (@nml/* or nml-*)
    [ ] Add publishConfig + files fields to each package.json
    [ ] bun publish dry-run script
    [ ] Tag v1.0.0 and publish: @nml/compiler-ts, @nml/cli, vite-plugin-nml, @nml/router

Phase 13: Editor Experience (Priority 2) — PLANNED

13A: VS Code / Windsurf Extension
    [ ] .nml syntax grammar (TextMate) — element names, directives, {{ }}, pipes
    [ ] Squiggly lines via Language Server Protocol (delegate to MCP server nml_lint)
    [ ] Auto-complete for built-in directives and filters

13B: True HMR in vite-plugin-nml
    [ ] Detect .nml file change → invalidate only that module
    [ ] DOM patch via Vite HMR API (no full page reload)

Phase 14: Ecosystem Adapters (Priority 3) — PLANNED

14A: @nml/express — Express middleware adapter
    [ ] createExpressHandler(opts) → RequestHandler
    [ ] Same interface as createHandler from @nml/router

14B: @nml/react — RSC integration (lower priority)
    [ ] renderNml(src, ctx) → string usable inside Server Components
    [ ] Evaluate zero-bloat tradeoff before implementing

Phase 15: Language Sugar (Priority 4) — DEFERRED pending user feedback

    [ ] @switch / @case directive
    [ ] @set(varName, expr) for computed locals
    [ ] Multi-filter chains: {{ val|trim|uppercase }}
    Rationale: achievable today via @if chains + pre-formatted context.
              Defer until feedback confirms strict necessity.