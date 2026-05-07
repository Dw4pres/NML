# NML Templating Reference

A complete reference for NML's templating features: variable interpolation, loops, conditionals, and the filter pipeline.

---

## Variable Interpolation

Use `{{ variableName }}` to output a value from the render context. Values are **HTML-escaped by default**.

```nml
p("Hello, {{ name }}!")
```

```html
<p>Hello, Alice!</p>
```

Dot-notation accesses nested properties:

```nml
p("Welcome, {{ user.profile.displayName }}")
```

If the variable is **not found** in the context, the placeholder is rendered verbatim (no crash).

### Raw output (bypass HTML escaping)

Use `|raw` to output unescaped HTML — useful for pre-rendered fragments:

```nml
div("{{ body|raw }}")
```

> **Security note:** Never use `|raw` with untrusted user input.

---

## Loops — `@each`

Iterate over an array in the context.

### Syntax

```nml
@each(contextPath as itemName)
    ... children rendered once per item ...
@endeach
```

- `contextPath` — dot-path to the array in the render context (e.g. `items` or `user.posts`)
- `itemName` — the local variable name available to children as `{{ itemName }}`

### Example

```nml
ul
    @each(products as product)
        li("{{ product.name }} — ${{ product.price }}")
    @endeach
```

Context:
```json
{ "products": [{ "name": "Widget", "price": "9.99" }, { "name": "Gadget", "price": "24.99" }] }
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
| `contextPath` resolves to a non-empty array | Renders children N times |
| `contextPath` resolves to an empty array `[]` | Renders nothing (no children) |
| `contextPath` is missing from context | Renders nothing silently |
| `contextPath` resolves to a non-array value | Renders nothing silently |

### Nested loops

Inner loops can access their own item variable AND any outer loop variables via context inheritance:

```nml
@each(categories as category)
    h2("{{ category.name }}")
    ul
        @each(category.items as item)
            li("{{ item }}")
        @endeach
@endeach
```

---

## Conditionals — `@if` / `@else` / `@endif`

Conditionally render a block based on a context value.

### Syntax

```nml
@if(condition)
    ... rendered when condition is truthy ...
@else
    ... rendered when condition is falsy ...
@endif
```

`@else` is optional. `@endif` is **required**.

- `condition` — a dot-path resolved against the current context

### Example

```nml
@if(user.isAdmin)
    div.admin-badge("Admin")
@else
    p("You do not have admin access.")
@endif
```

### Truthiness — `isTruthy`

NML uses **Pythonic / UI-optimised truthiness**, stricter than JavaScript:

| Value | `isTruthy` |
|---|---|
| `null` | `false` |
| `undefined` | `false` |
| `0` | `false` |
| `""` (empty string) | `false` |
| `[]` (empty array) | `false` |
| `{}` (empty object) | `false` |
| `false` | `false` |
| Any non-empty string | `true` |
| Any non-zero number | `true` |
| Any non-empty array | `true` |
| Any non-empty object | `true` |
| `true` | `true` |

This means `@if(items)` renders the then-branch only when `items` is a **non-empty array** — eliminating common "empty list" rendering bugs.

### Multiple sibling conditionals

```nml
@if(plan.isPro)
    span("Pro")
@endif
@if(plan.isEnterprise)
    span("Enterprise")
@endif
```

---

## Filter Pipeline

Apply transformations to interpolated values using `|filterName`.

### Syntax

```nml
{{ value|filterName }}
{{ value|filterName("argument") }}
```

### Built-in Filters

| Filter | Description | Example |
|---|---|---|
| `uppercase` | Converts to uppercase | `{{ name\|uppercase }}` → `"ALICE"` |
| `lowercase` | Converts to lowercase | `{{ name\|lowercase }}` → `"alice"` |
| `trim` | Strips leading/trailing whitespace | `{{ name\|trim }}` |
| `json` | Serialises to JSON string (**raw, not HTML-escaped**) | `{{ state\|json }}` → `{"count":1}` |
| `default("x")` | Returns `"x"` if value is falsy, otherwise returns value | `{{ name\|default("Anonymous") }}` |

### `json` filter — Alpine.js integration

The `json` filter is raw output by design, making it ideal for Alpine.js `x-data` bindings:

```nml
div.x-data("{{ serverState|json }}")
```

Output:
```html
<div x-data='{"user":"Alice","count":42}'></div>
```

> HTML-escaping `{"` to `{&quot;` would break Alpine's JSON parser — `|json` intentionally bypasses it.

### `default` filter

```nml
p("Hello, {{ username|default(\"Guest\") }}!")
```

- If `username` is falsy (`""`, `null`, `undefined`, `0`, `[]`, `{}`), renders `"Guest"`
- Otherwise renders the actual value

### User-defined filters

Pass any function in the render context — it will be called automatically:

```ts
nmlCompiler.render(src, {
  price: 9.99,
  currency: (val: unknown) => `$${Number(val).toFixed(2)}`,
});
```

```nml
span("{{ price|currency }}")
```

Output: `<span>$9.99</span>`

### Filter resolution order

1. **Built-in filters** (`BUILTIN_FILTERS` map) — checked first
2. **User context** — if `context[filterName]` is a function, it is called
3. **Silent fallback** — unknown filter produces `""` (no error, no crash)

### Missing variable with filter

If the variable is not found in context, the placeholder is rendered verbatim — the filter is **not applied**:

```nml
span("{{ missing|uppercase }}")
```

Output: `{{ missing|uppercase }}` (literal, unchanged)

---

## Combining Features

`@each` and `@if` compose naturally:

```nml
ul
    @each(users as user)
        @if(user.active)
            li("{{ user.name }}")
        @else
            li.inactive("{{ user.name }} (inactive)")
        @endif
    @endeach
```

Context:
```json
{ "users": [{ "name": "Alice", "active": true }, { "name": "Bob", "active": false }] }
```

Output:
```html
<ul>
    <li>Alice</li>
    <li class="inactive">Bob (inactive)</li>
</ul>
```
