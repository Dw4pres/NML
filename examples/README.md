# NML Examples

This directory contains example applications demonstrating different aspects of NML.

## Examples

### [hello-world/](./hello-world)
A minimal NML application showing the basics:
- Basic NML syntax and structure
- Hono integration for Cloudflare Workers
- Server-side rendering with no JavaScript

### [htmx-todo/](./htmx-todo)
A todo application demonstrating NML + HTMX:
- Server-side interactivity without page reloads
- HTMX attributes for dynamic updates
- Real-time UI updates via AJAX

### [components/](./components)
Component system showcase:
- @define for reusable components
- @slot for content injection
- Props and scoped CSS
- Component nesting patterns

## Running Examples

Each example is a self-contained project:

```bash
cd examples/[example-name]
bun install
bun run dev
```

Visit `http://localhost:5173` to see the application.

## Deploying to Cloudflare Pages

Each example can be deployed to Cloudflare Pages:

```bash
cd examples/[example-name]
bun run deploy
```

## What These Examples Show

- **Zero JavaScript runtime** - All examples compile to pure HTML/CSS
- **Server-side rendering** - Fast page loads with no hydration
- **Component architecture** - Reusable, scoped components
- **Progressive enhancement** - Optional interactivity with HTMX/Alpine
- **Edge deployment** - Ready for Cloudflare Workers

## Learning Path

1. Start with **hello-world** to understand basic NML syntax
2. Try **htmx-todo** to see server-side interactivity
3. Explore **components** to learn the component system

Each example includes detailed README files explaining the concepts demonstrated.