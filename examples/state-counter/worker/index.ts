import { Hono } from "hono";
import renderIndex from "../views/index.nml";

const app = new Hono();

// The view is a full page with @state: render() seeds the declared state
// and appends the <script data-nml-state> payload, which the browser-side
// auto-mount block (src/client.ts) reads to wire the listeners.
app.get("/", async (c) => {
  const html = await renderIndex({});
  return c.html(html);
});

export default app;
