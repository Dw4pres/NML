import { defineConfig, type Plugin } from "vite";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { nmlCompiler } from "@nml-lang/compiler-ts";

/**
 * Inline plugin: compiles index.nml → serves it as the HTML entry point.
 * Dogfoods the NML compiler for the playground's own shell UI.
 */
function nmlShellPlugin(): Plugin {
  const nmlEntry = resolve(__dirname, "index.nml");

  return {
    name: "nml-shell",
    enforce: "pre",

    // Dev: intercept "/" and serve compiled index.nml
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/" && req.url !== "/index.html") return next();
        try {
          const src = await readFile(nmlEntry, "utf-8");
          const raw = await nmlCompiler.render(src, {});
          // Run through Vite's HTML pipeline so it injects the HMR client
          // and resolves/processes <script type="module"> tags correctly.
          const html = await server.transformIndexHtml(req.url!, raw);
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        } catch (e) {
          res.setHeader("Content-Type", "text/html");
          res.end(`<pre style="color:red;padding:2rem">${e}</pre>`);
        }
      });
    },

    // Build: emit compiled index.nml as index.html
    async generateBundle() {
      const src = await readFile(nmlEntry, "utf-8");
      const html = await nmlCompiler.render(src, {});
      this.emitFile({ type: "asset", fileName: "index.html", source: html });
    },
  };
}

export default defineConfig({
  plugins: [nmlShellPlugin()],
  optimizeDeps: {
    include: ["monaco-editor"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ["monaco-editor"],
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
