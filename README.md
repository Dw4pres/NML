# NML (Neat Markup Language)

 A simple, component-first way to author web UIs that compiles to clean HTML. Write less boilerplate than plain HTML/CSS and avoid heavy client frameworks.


 ## Features

 - Component syntax: `@define.Component` and `@Component` calls
 - Slots: default and named (`@slot.header`, `@slot.footer`) with fallback
 - Props: pass attributes at call-site and use them inside components via `{{ prop.* }}`
 - Scoped CSS: `@style:` blocks automatically scoped with stable `nml-c-xxxxxx`
 - Template variables: `{{ var }}` escaped by default; `{{ var|raw }}` for opt-out
 - Dev server: live-serve `.nml` templates with auto style injection
 - CLI: compile `.nml` to `.html`, optional `--watch`, `--components`, config discovery
 - File-based routing (dev server): `/users/123` → `templates/users/[id].nml`
 - Event attributes: `on:click("...")` → `onclick="..."` (and other `on:*`)
 - Strong tests and GitHub Actions CI

## Why NML

- Write less boilerplate than HTML/CSS while staying close to the platform.
- Component-first authoring with named slots and simple props.
- Server-rendered by default; no heavy client framework or bundler required.
- Scoped CSS per component, injected only if used.
- File-based routing in the dev server for natural folder-to-URL mapping.
- Optional, tiny runtime for trivial client state when you need it.

## Why not a heavy JS framework?

- Less moving parts. No bundler, no VDOM, no hydration. You write NML → it becomes HTML.
- Server-first by default. Pages render instantly and work without JavaScript.
- Interactivity stays simple. Use native events (`on:*`) or an optional ~tiny helper for state.
- CSS scoping without CSS-in-JS. Styles are deterministic and only injected when used.
- Adopt incrementally. Works alongside existing Python/Flask projects without a Node toolchain.

## How interactivity works (no framework)

- Native HTML first. Forms, links, `<details>`/`<summary>`, and CSS do a lot without JS.
- One-line events. `on:click("...")` simply maps to `onclick="..."`. No bundler or build step.
- Optional tiny runtime. Include `/static/nml_runtime.js` only when you need state:
  - `nml('set path value')`, `nml('inc path [amount]')`, `nml('toggle path')`
  - Bind text/values with `data-nml-bind` (e.g., `text:counter.count`)
  - This is “JS-like” because it is JS under the hood—just minimal and opt‑in.

## Philosophy & Design Principles

- Prefer server-rendered HTML; enhance progressively.
- Prefer native browser features (links, forms, details/summary) over custom JS.
- Components are simple functions of input → HTML, with named slots for composition.
- Styles are local to components via deterministic scoping.
- Keep runtime optional and tiny; no bundlers or hydration.

## Common tasks by example

- **Navigate** (no JS needed)

  ```
  a.href("/profile").class("link")
    | Go to Profile
  ```

- **Show/hide content** (use native details/summary)

  ```
  details
    summary("More info")
    p("Hidden by default, shown when expanded.")
  ```

- **Submit a form** (server handles POST)

  ```
  form.method("post").action("/signup")
    input.type("text").name("email")
    button.type("submit")
      | Sign Up
  ```

- **Client action without building** (inline event)

  ```
  button.on:click("location.href='/settings'")
    | Settings
  ```

## When to use the tiny runtime

- You need a simple counter, toggle, or input binding without a full framework.
- You want to avoid a build step and keep JS to a few bytes.
- Your features degrade gracefully (page still works if JS fails/disabled).

## Requirements

 - Python 3.12+ (tested in CI). 3.14 validated locally.
 - `pip install -r requirements.txt`

## Getting Started

1. Install dependencies

   ```bash
   pip install -r requirements.txt
   ```

2. Run the dev server

   ```bash
   python app.py
   ```

   Open http://127.0.0.1:5173

3. Explore the starter pages (located in `templates/`)

   - `/` → `templates/index.nml`
   - `/users/123` → `templates/users/[id].nml` (dynamic param available as `{{ id }}`)
   - `/counter` → optional minimal runtime demo (`/static/nml_runtime.js`)

4. Edit and build in NML

   - Author pages in `templates/*.nml`
   - Define components in `components.nml` using `@define.Component` and call them with `@Component`
   - Use slots (`@slot`, `@slot.name`) and props (`{{ prop.* }}`) inside components

5. (Optional) Minimal client state

   - Only if needed: include `/static/nml_runtime.js` and use `data-nml-bind` with simple `nml('set|inc|toggle ...')` commands
   - See the section below for examples

6. Compile with the CLI

   ```bash
   # install locally (editable) with dev extras
   pip install -e .[dev]

   # compile using the console script
   nmlc templates/login-page.nml out.html

   # with explicit components file
   nmlc templates/login-page.nml out.html --components components.nml

   # watch for changes (input/components)
   nmlc templates/login-page.nml out.html --watch
   ```

7. (Optional) Config file (`nml.config.json`)

   ```json
   { "components": "components.nml" }
   ```

## Quick Examples

- **Hello, World (NML vs HTML)**

  ```
  // NML
  h1("Hello, World")
  ```

  ```html
  <!-- HTML -->
  <h1>Hello, World</h1>
  ```

- **Define and use a component with slots and props**

  ```
  // components.nml
  @define.Card
    div.class("card")
      div.class("header")
        @slot.header
      div.class("body")
        @slot
  ```

  ```
  // page.nml
  @Card
    @slot.header
      h1("Title")
    p("Body")
  ```

  Renders to:

  ```html
  <div class="card">
    <div class="header"><h1>Title</h1></div>
    <div class="body"><p>Body</p></div>
  </div>
  ```

- **Routing: dynamic params in one file**

  ```
  // templates/users/[id].nml
  p("User {{ id }}")
  ```

  Visit `/users/42` → `User 42`.

- **Events in one line**

  ```
  button.on:click("alert('hi')")
    | Click
  ```

  Renders to:

  ```html
  <button onclick="alert('hi')">Click</button>
  ```

- **Scoped CSS (automatic, only when used)**

  ```
  @define.Btn
    button
      @slot
    @style:
      .btn { color: blue; }
  ```

  The CSS is automatically scoped with a stable attribute and injected only if `@Btn` is used on the page.

 ## Routing (dev server)

 - Mapping rules (relative to the `templates/` directory):
   - `/` → `templates/index.nml`
   - `/a/b` → `templates/a/b.nml`
   - `/a/b/` → `templates/a/b/index.nml`
   - Dynamic last segment: `/users/123` → `templates/users/[id].nml` with `{ id: "123" }`
   - 404 fallback: if `templates/404.nml` exists, it will render for unknown routes

 ## Event attributes

 - Shorthand for common event handlers:
   - `on:click("...")` → `onclick="..."`
   - `on:mouseover("...")` → `onmouseover="..."`
   - Works on components too

## Optional minimal client state (opt-in)

- Include the tiny runtime only if you need client-side state. The dev server serves `/static/nml_runtime.js` automatically.

  ```
  head
    script.src("/static/nml_runtime.js")
  ```

- Counter example (no initial state needed):

  ```
  button.on:click("nml('inc counter.count 1')")
    | +
  span.data-nml-bind("text:counter.count")
  ```

- Simple input model + greeting:

  ```
  input.data-nml-bind("value:form.name").on:input("nml('set form.name ' + this.value)")
  p
    | Hello 
    span.data-nml-bind("text:form.name")
  ```

- API (string commands):
  - `nml('set path value')`
  - `nml('inc path [amount]')`
  - `nml('toggle path')`
  - Bindings via `data-nml-bind="text:path"` or `value:path`.

 ## Authoring basics

 - Elements and attributes:

   ```
   div.class("box").id("main")
     p("Hello")
   ```

 - Components and slots:

   ```
   @define.Card
     div.card
       div.header
         @slot.header
       div.body
         @slot
       div.footer
         @slot.footer
   ```

   ```
   @Card
     @slot.header
       h1("Title")
     p("Body content")
   ```

 - Props:

   ```
   @define.Button
     button.type("button").class("btn btn-{{ prop.kind }}")
       | {{ prop.label }}

   @Button.kind("primary").label("Click me")
   ```

 - Events:

   ```
   // on:click maps to onclick
   button.on:click("doIt()")

   // Works on components too
   @define.Btn
     button
       @slot

   @Btn.on:click("go()")
     | Click
   ```

 - Scoped CSS:

   ```
   @define.PixelBox
     div
       @slot
     @style:
       .pixel-box { border: 1px solid #000; }
   ```

 ## Security

 - Variables are escaped by default. Use `|raw` only when you fully trust the content.

 ## Testing

 - Run tests: `pytest -q`

 ## CI

 - GitHub Actions workflow runs tests on push/PR.

 ## Notes

 - Indentation: NML uses 4-space indentation.
 - Roadmap: See `Project Roadmap.md` for phases and upcoming work.