# State Counter - NML Example

A full-page counter + todo list built with `@state` — the state runtime
(`@nml-lang/state`) in action. No page reloads, no client framework: the
page is server-rendered with initial state, and the vite-plugin auto-mount
block wires the listeners in the browser.

## What this shows

- `@state` declarations at the top of a full-page `.nml` file
- Auto-mount: the emitted view module calls `mountNmlState` with the SSR
  payload (`<script data-nml-state>`) — see `src/client.ts`, which just
  imports the view module
- Actions: `count++`, `count--`, `count = count + 10`, `count = 0`,
  `done0 = !done0` on change, `show3 = true` to reveal a fourth todo
- State-driven rendering: checkboxes render `checked` via `@if(done0)`

## Run it

```bash
bun install
bun run build
```

Then serve `dist/` (it is a static site: `dist/index.html` + `dist/client.js`):

```bash
bunx wrangler pages dev dist
# or: python3 -m http.server --directory dist
```

`bun run dev` starts the Vite dev server for iterating on the view module
(HMR patches the page); the full demo is the built output above.

## How it fits together

- `views/index.nml` — the page. `@state` at the top, `on:click` /
  `on:change` handlers referencing declared state.
- `src/client.ts` — browser entry. It only imports the view module; the
  import runs the auto-mount block the vite-plugin injected.
- `worker/index.ts` — Hono worker that server-renders the page
  (`renderIndex({})` seeds `@state` and appends the payload script).
- `vite.config.ts` — `src/client.ts` is the build entry (emitted as
  `dist/client.js`); the SSG pass emits `views/index.nml` to
  `dist/index.html`.

## Local packages

This example resolves the NML packages from the monorepo (`file:` deps
plus an `overrides` entry for `@nml-lang/compiler-ts`), so it always
builds against the local source, not the published npm packages. A real
app installs the published versions instead:

```json
{
  "devDependencies": {
    "@nml-lang/vite-plugin": "^2.2.3",
    "@nml-lang/state": "^2.2.0"
  }
}
```

## v1 limits visible here

- **No input binding:** there is no `$value`, so the Add button reveals a
  preset fourth item instead of adding free text. Free-text add needs the
  `$value` follow-up.
- **No conditional classes:** `{{ }}` only resolves simple paths — no
  ternaries — so the struck-through style comes from CSS
  (`.todo-item:has(input:checked)`) and the checkbox from `@if(done0)`.
- **HMR resets state:** editing the view in dev re-mounts with initial
  values.
