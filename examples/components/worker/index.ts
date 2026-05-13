import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import renderIndex from "../views/index.nml";

const app = new Hono();

// Serve static assets if any
app.use("/*", serveStatic({ root: "./" }));

// Render NML view
app.get("/", (c) => {
  const html = renderIndex();
  return c.html(html);
});

export default app;