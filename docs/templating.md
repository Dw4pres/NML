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
