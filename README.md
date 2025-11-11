# NML (Not A Markup Language)

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

 ## Requirements

 - Python 3.12+ (tested in CI). 3.14 validated locally.
 - `pip install -r requirements.txt`

 ## Quick start

 - Run dev server:

   ```bash
   python app.py
   # open http://127.0.0.1:5173
   ```

 - Compile with CLI:

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

 - Optional config file (`nml.config.json`):

   ```json
   { "components": "components.nml" }
   ```

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