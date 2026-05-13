# Hello World - NML Example

A minimal NML application running on Hono + Cloudflare Workers.

## What this shows

- Basic NML syntax and structure
- Server-side rendering with no JavaScript
- Hono integration for Cloudflare Workers
- Inline styling in NML

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

## File structure

```
hello-world/
├── views/
│   └── index.nml          # NML template
├── worker/
│   └── index.ts           # Hono app
├── package.json
├── vite.config.ts
├── wrangler.jsonc
└── README.md
```