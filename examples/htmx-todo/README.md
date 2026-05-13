# HTMX Todo App - NML Example

A todo application demonstrating NML + HTMX for server-side interactivity without page reloads.

## What this shows

- HTMX integration with NML for dynamic updates
- Server-side state management
- No client-side JavaScript required
- Real-time UI updates via HTMX attributes

## Features

- Add new todos with Enter key
- Toggle todo completion
- All updates happen without page reloads
- Clean, semantic NML markup

## Run locally

```bash
bun install
bun run dev
```

Visit `http://localhost:5173` to see the app.

## Deploy to Cloudflare Pages

```bash
bun run deploy
```

## How it works

1. **HTMX attributes** in NML handle AJAX requests:
   - `hx-post="/api/todos"` - Add new todo
   - `hx-put="/api/todos/:id"` - Toggle completion
   - `hx-target="#todo-list"` - Update DOM element

2. **Server-side rendering** with NML templates
3. **Hono API endpoints** return HTML fragments for HTMX

## File structure

```
htmx-todo/
├── views/
│   └── index.nml          # NML template with HTMX attributes
├── worker/
│   └── index.ts           # Hono app with API endpoints
├── package.json
├── vite.config.ts
├── wrangler.jsonc
└── README.md
```