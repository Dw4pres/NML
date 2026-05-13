# Components Showcase - NML Example

A comprehensive demonstration of NML's component system using @define, @slot, and scoped CSS.

## What this shows

- **@define** - Creating reusable components
- **@slot** - Default and named slots for content injection
- **Props** - Passing data to components via {{ prop.* }}
- **Scoped CSS** - Component-scoped styling with @style:
- **Component nesting** - Using components inside other components
- **Zero runtime** - All component logic compiles to pure HTML/CSS

## Components demonstrated

### Card
- Container component with optional title
- Accepts title prop and default slot content
- Scoped CSS for consistent styling

### Button
- Multiple variants: default, primary, secondary
- Configurable label and type props
- Hover states and transitions

### Alert
- Four variants: info, success, warning, error
- Optional title and message content
- Color-coded styling

### Badge
- Small status indicators
- Five color variants
- Compact, inline display

## Run locally

```bash
bun install
bun run dev
```

Visit `http://localhost:5173` to see the components.

## Deploy to Cloudflare Pages

```bash
bun run deploy
```

## Component patterns shown

1. **Basic component with props:**
   ```nml
   @Button.kind("primary").label("Click me")
   ```

2. **Component with slots:**
   ```nml
   @Card.title("Title")
     p | Content goes here
   ```

3. **Nested components:**
   ```nml
   @Card
     @Alert.kind("info")
       p | Nested content
   ```

4. **Scoped CSS:** Each component includes its own styles that only affect that component.

## File structure

```
components/
├── views/
│   ├── components.nml     # Component definitions
│   └── index.nml          # Usage examples
├── worker/
│   └── index.ts           # Hono app
├── package.json
├── vite.config.ts
├── wrangler.jsonc
└── README.md
```

## Key takeaways

- Components compile to pure HTML/CSS with zero JavaScript runtime
- Scoped CSS prevents style conflicts
- Props and slots provide flexible composition
- Component nesting works seamlessly
- All styling is encapsulated and automatic