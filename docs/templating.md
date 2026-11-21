# 📝 NML Templating Reference

> A complete guide to NML's templating system: variable interpolation, loops, conditionals, the filter pipeline, and partials.

---

## 🔀 Variable Interpolation

Use `{{ variableName }}` to output a value from the render context. Values are **HTML-escaped by default**.

```nml
p | Hello, {{ name }}!
```

```html
<p>Hello, Alice!</p>
```

Dot-notation accesses nested properties:

```nml
p | Welcome, {{ user.profile.displayName }}
```

> If a variable is **not found** in the context, the placeholder is rendered verbatim — no crash, no empty string.

### Raw Output (bypass HTML escaping)

Use `|raw` to output unescaped HTML — useful for pre-rendered HTML fragments:

```nml
div | {{ body|raw }}
```

> ⚠️ **Security:** Never use `|raw` with untrusted user input.

---

## 🗄️ State — `@state` (v1)

File-level client state for stateful apps. Stateless files are unaffected — if a file declares no `@state`, it renders exactly as before, with zero client JavaScript.

> **Design rule:** state is *declared and visible*. NML is written by AI agents and read/audited by humans: every piece of state is declared at the top of the file, and every mutation is visible at the event site. There is no invisible or globally shared state.

### Declaring State

```nml
@state.count(0)
@state.label("hello")
@state.open(false)
@state.tags(["a", "b"])
@state.user({"name": "Al"})
```

- **Values must be valid JSON** — number, string, boolean, null, array, or object.
- **Top level only** — declarations must be direct children of the file, before their first use. A declaration after its first use is a parse error.
- **No duplicates** — declaring the same name twice is a parse error.
- **No component-local state in v1** — `@state` inside `@define` is a parse error; declare it at the top of the file instead.

### Using State

Declared state seeds the render context, so `{{ }}`, `@if`, and `@each` work with state values exactly like context variables:

```nml
@state.count(0)
@state.items(["a", "b"])

p | Count: {{ count }}
@if(count)
    p | Counting!
@endif
ul
    @each(items as item)
        li | {{ item }}
    @endeach
```

**Precedence:** explicit context passed to `render()` wins over a `@state` initial value on name collision. `@state` values are defaults, not overrides.

### SSR Payload

When a file declares `@state`, the rendered HTML includes the effective initial state as a machine-readable payload for the client runtime:

```html
<script type="application/json" data-nml-state>{"count":0}</script>
```

- Placed immediately before `</body>` when present, otherwise appended at the end of the output.
- The payload reflects context overrides (effective initial state, not just declared defaults).
- `<` is escaped (`\u003c`) so a state string value can never break out of the `<script>` block.

### State Actions

`on:*` handlers that reference declared state are translated into `data-nml-action` and `data-nml-event` attributes — the contract the client runtime consumes — and the inline `on*` attribute is removed:

```nml
@state.count(0)
button.on:click("count++") | Increment
```

```html
<button data-nml-action="count++" data-nml-event="click">Increment</button>
```

**Supported forms (v1):**

| Form | Example |
|---|---|
| Increment / decrement | `count++`, `count--` |
| Assign a literal | `count = 5`, `label = 'hi'` |
| Negate a boolean | `open = !open` |
| Arithmetic | `count = count + 1`, `count = (total % 3) * 2` |

- String literals inside actions use **single quotes** (`label = 'hi'`) because the attribute value itself is double-quoted. Other literals are JSON.
- Arithmetic accepts declared state names, numeric literals, `+ - * / %`, parentheses, and unary minus.
- Handlers that do **not** reference declared state pass through unchanged (`button.on:click("handleClick()")` still renders `onclick="handleClick()"`).
- Alpine handlers (`x-on:click`) are untouched.
- Only **one** state action per element is supported in v1.
- Referencing declared state in an unsupported form, or assigning to a name that isn't declared, is a parse error with a fix hint (e.g. `Did you mean to declare @state.count(<initial value>)?`).

### Client Runtime — `@nml-lang/state`

`data-nml-action` attributes are live. The runtime (`@nml-lang/state`,
`dist/index.js` ~13KB) mounts a view's `render` function onto the
server-rendered page: it listens for `click`, `change`, and `submit` on
`document`, finds the closest `[data-nml-action]`, applies the action to
the current state, re-renders, and patches the DOM. No VDOM, no store, no
effects — state is a plain object, and every mutation goes through one
pure function, `applyAction(state, action)`, which returns a new state
object (it never mutates its input). An action that fails (unknown name,
unsupported form, type error such as `++` on a non-number) throws a
`NmlStateError` carrying the action string, a `code`
(`unknown-state` | `unsupported-form` | `type-error`), and a `reason`;
a failing action is logged and the state is left untouched.

**Full pages — auto-mount (vite-plugin).** If a file with `@state` is a
full page (a top-level `html` element or `doctype.html`), the vite-plugin
emits an `import { mountNmlState } from "@nml-lang/state"` and a
browser-only auto-mount block (`typeof document !== "undefined"`) that
reads the `script[data-nml-state]` payload for the initial state and
calls `mountNmlState({ render, initial })`. The page must load the view
module in the browser (for example, a client entry that imports it) for
the auto-mount to run. Apps using `@state` need `@nml-lang/state`
installed. The emitted view module uses top-level await, so a Vite build
target must support it (e.g. `build: { target: "esnext" }`).

**Fragments — manual mount.** A fragment file with `@state` (no top-level
`html`) gets state seeding and the payload, but **no auto-mount** — the
app mounts it explicitly:

```ts
import { mountNmlState } from "@nml-lang/state";
import renderCounter from "./views/counter.nml";

const mount = mountNmlState({
  render: renderCounter,
  initial: { count: 0 },
  root: document.getElementById("counter")!,
});
// mount.getState() — a copy of the current state
// mount.setState({ count: 5 }) — merge + re-render
// mount.destroy() — remove all listeners (safe to call twice)
```

Re-mounting the same root destroys the previous mount first, so HMR
re-imports never double-fire listeners.

**Events.** The runtime handles `click`, `change`, and `submit` only, and
only when the event type matches the element's `data-nml-event` (default
`"click"` when the attribute is absent). `preventDefault()` is called on
handled actions. `input` events are **not** wired in v1, and there is no
`$value` / input-value binding — an action can only compute from current
state and literals.

**DOM patching.** After a handled action, the fresh HTML is parsed with
`DOMParser`. If it contains a `<body>`, the new body's children replace
`document.body`'s children (keeping `<head>` intact); otherwise
`root.innerHTML` is set. Full-page replacement (rather than a targeted
update) is the deliberate v1 strategy: it is simple, it cannot drift out
of sync with `render()`, and it keeps the runtime small. DOM morphing is
the follow-up.

**Focus.** Before patching, the runtime records `document.activeElement`'s
`id` (if any) and restores focus to the element with that id afterwards.
Inputs without an `id` can still lose focus/cursor on re-render — a known
v1 limit; give interactive inputs an `id`, or wait for DOM morphing.

**HMR resets state (v1 limit).** A hot update re-mounts with initial
values; state changed since page load is lost. Listeners never
double-fire (see re-mount above), but the values reset.

### Known v1 Limits

- `@if` conditions are still context paths + truthiness — no comparison expressions (`count > 5` is not supported).
- State is file-level only — no per-instance component state, no shared/global store.
- A partial's own `@state` provides defaults that inherited parent context can override; its state is not re-serialised — the SSR payload is emitted once, for the top-level document.
- No `$value` / input-value binding; `input` events are not wired.
- Focus/cursor can be lost in inputs without an `id` on re-render (see Focus above).
- HMR resets state to initial values (see HMR above).

---

## 🔁 Loops — `@each`

Iterate over an array in the context.

### Syntax

```nml
@each(contextPath as itemName)
    ... children rendered once per item ...
@endeach
```

- **`contextPath`** — dot-path to the array (e.g. `items` or `user.posts`)
- **`itemName`** — local variable available inside the loop as `{{ itemName }}`

### Example

```nml
ul
    @each(products as product)
        li | {{ product.name }} — ${{ product.price }}
    @endeach
```

Context:
```json
{
  "products": [
    { "name": "Widget", "price": "9.99" },
    { "name": "Gadget", "price": "24.99" }
  ]
}
```

Output:
```html
<ul>
  <li>Widget — $9.99</li>
  <li>Gadget — $24.99</li>
</ul>
```

### Behaviour

| Condition | Result |
|---|---|
| Non-empty array | Renders children N times |
| Empty array `[]` | Renders nothing |
| Key missing from context | Renders nothing silently |
| Non-array value | Renders nothing silently |

### Nested Loops

Inner loops can access their own item variable AND any outer loop variables:

```nml
@each(categories as category)
    h2 | {{ category.name }}
    ul
        @each(category.items as item)
            li | {{ item }}
        @endeach
@endeach
```

---

## ❓ Conditionals — `@if` / `@else` / `@endif`

Conditionally render a block based on a context value.

### Syntax

```nml
@if(condition)
    ... rendered when truthy ...
@else
    ... rendered when falsy ...
@endif
```

`@else` is optional. `@endif` is **required**.

### Example

```nml
@if(user.isAdmin)
    div.class("admin-badge") | Admin
@else
    p | You do not have admin access.
@endif
```

### Truthiness — `isTruthy`

NML uses **Pythonic / UI-optimised truthiness**, stricter than JavaScript:

| Value | `isTruthy` |
|---|---|
| `null` | ❌ `false` |
| `undefined` | ❌ `false` |
| `0` | ❌ `false` |
| `""` (empty string) | ❌ `false` |
| `[]` (empty array) | ❌ `false` |
| `{}` (empty object) | ❌ `false` |
| `false` | ❌ `false` |
| Any non-empty string | ✅ `true` |
| Any non-zero number | ✅ `true` |
| Any non-empty array | ✅ `true` |
| Any non-empty object | ✅ `true` |
| `true` | ✅ `true` |

> `@if(items)` renders the then-branch only when `items` is a **non-empty array** — eliminating common "empty list" rendering bugs.

### Multiple Sibling Conditionals

```nml
@if(plan.isPro)
    span | Pro
@endif
@if(plan.isEnterprise)
    span | Enterprise
@endif
```

---

## 🔧 Filter Pipeline

Apply transformations to interpolated values using `|filterName`.

### Syntax

```nml
{{ value|filterName }}
{{ value|filterName("argument") }}
```

### Built-in Filters

| Filter | Description | Example |
|---|---|---|
| `uppercase` | Converts to UPPERCASE | `{{ name\|uppercase }}` → `"ALICE"` |
| `lowercase` | Converts to lowercase | `{{ name\|lowercase }}` → `"alice"` |
| `trim` | Strips leading/trailing whitespace | `{{ input\|trim }}` |
| `json` | Serialises to JSON (**raw, not HTML-escaped**) | `{{ state\|json }}` → `{"count":1}` |
| `default("x")` | Returns `"x"` if value is falsy | `{{ name\|default("Anonymous") }}` |
| `raw` | Bypasses HTML escaping entirely | `{{ html\|raw }}` |

### `json` Filter — Alpine.js Integration

The `json` filter is raw output by design, making it ideal for Alpine.js `x-data` bindings:

```nml
div.x-data("{{ serverState|json }}")
```

Output:
```html
<div x-data='{"user":"Alice","count":42}'></div>
```

> HTML-escaping `{"` to `{&quot;` would break Alpine's JSON parser — `|json` intentionally bypasses escaping.

### `default` Filter

```nml
p | Hello, {{ username|default("Guest") }}!
```

- If `username` is falsy (`""`, `null`, `undefined`, `0`, `[]`, `{}`), renders `"Guest"`
- Otherwise renders the actual value

### User-Defined Filters

Pass any function in the render context and it will be called automatically:

```typescript
await nmlCompiler.render(src, {
  price: 9.99,
  currency: (val: unknown) => `$${Number(val).toFixed(2)}`,
});
```

```nml
span | {{ price|currency }}
```

Output: `<span>$9.99</span>`

### Filter Resolution Order

1. **Built-in filters** — checked first
2. **User context** — if `context[filterName]` is a function, it is called
3. **Silent fallback** — unknown filter name produces `""` (no error, no crash)

### Missing Variable with Filter

If the variable is not in context, the placeholder is rendered **verbatim** — the filter is not applied:

```nml
span | {{ missing|uppercase }}
```

Output: `{{ missing|uppercase }}`

---

## 📂 Partials — `@include`

Split large templates into smaller, reusable files.

### Syntax

```nml
@include("relative/path/to/partial.nml")
```

Paths are resolved relative to the current file's directory.

### Example

```nml
// views/index.nml
doctype.html
html
    head
        @include("partials/head.nml")
    body
        @include("partials/nav.nml")
        main | {{ content }}
        @include("partials/footer.nml")
```

### Behaviour

- **Context inheritance** — the partial receives the full parent context automatically
- **Nesting** — partials can `@include` other partials
- **Circular detection** — circular includes throw an `NMLParserError` immediately
- **Pluggable I/O** — the `readFile` option accepts any async function (filesystem, R2, D1, in-memory)

```typescript
await nmlCompiler.render(source, context, {
  basePath: "/path/to/views",
  readFile: (path) => readFile(path, "utf-8"),
});
```

> ⚠️ Absolute paths in `@include()` are not allowed and will throw a parse error.

---

## 🧩 Combining Features

`@each`, `@if`, and `{{ }}` compose naturally:

```nml
ul
    @each(users as user)
        @if(user.active)
            li | {{ user.name }}
        @else
            li.class("text-gray-400") | {{ user.name }} (inactive)
        @endif
    @endeach
```

Context:
```json
{
  "users": [
    { "name": "Alice", "active": true },
    { "name": "Bob",   "active": false }
  ]
}
```

Output:
```html
<ul>
  <li>Alice</li>
  <li class="text-gray-400">Bob (inactive)</li>
</ul>
```

---

*Part of the [NML monorepo](../README.md) · [`@nml-lang/compiler-ts`](https://www.npmjs.com/package/@nml-lang/compiler-ts)*
