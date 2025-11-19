NML Project Vision & Roadmap

Name: Not A Markup Language (NML)
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