# NML — VS Code Extension

Syntax highlighting, snippets, and language support for `.nml` (Neat Markup Language) files.

## Features

- **Syntax highlighting** for all NML constructs:
  - HTML elements and attribute chains (`.class()`, `.id()`, `.hx-*`, `.x-*`, `.on:*`)
  - Directives: `@define`, `@slot`, `@style:`, `@include`, `@each`, `@if`, `@else`, `@endif`
  - Template variables: `{{ variable }}`, `{{ variable|filter }}`, `{{ variable|filter("arg") }}`
  - Pipe content: `element | text`
  - Comments: `// ...`
  - Doctype: `doctype.html`

- **Snippets** — type a prefix and press `Tab`:

  | Prefix | Description |
  |---|---|
  | `nml-doc` | Full HTML document scaffold |
  | `nel` | Element with class |
  | `nvar` | Template variable `{{ }}` |
  | `nvarf` | Template variable with filter |
  | `neach` | `@each` loop |
  | `nif` | `@if / @else / @endif` |
  | `nife` | `@if / @endif` (no else) |
  | `neachif` | `@each` with nested `@if` |
  | `ndefine` | Component definition with scoped style |
  | `ndefine-slot` | Component with named + default slots |
  | `ninclude` | `@include` partial |
  | `nhtmx` | Button with HTMX attributes |
  | `nalpine` | Element with Alpine.js `x-data` |
  | `n\|` | Element with pipe content |

- **Auto-close pairs**: `(`, `{`, `[`, `"`, `{{ }}`
- **Folding** via indentation (off-side rule)
- **`//` line comments** (`Ctrl+/` / `Cmd+/`)

## Installation

### From VSIX

```bash
cd packages/vscode-nml
bun install
npx vsce package
# installs locally:
code --install-extension vscode-nml-0.1.0.vsix
```

### From VS Code Marketplace

Search for **"NML Neat Markup Language"** in the Extensions panel.

## Usage

Open any `.nml` file — highlighting activates automatically. Use the snippets panel (`Ctrl+Shift+P` → *Insert Snippet*) or type prefixes directly.

## Links

- [NML monorepo](https://github.com/Dw4pres/NML)
- [`@nml-lang/compiler-ts`](https://www.npmjs.com/package/@nml-lang/compiler-ts)
- [`@nml-lang/cli`](https://www.npmjs.com/package/@nml-lang/cli)
