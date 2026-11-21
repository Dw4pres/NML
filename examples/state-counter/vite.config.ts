import { defineConfig } from "vite";
import nml from "@nml-lang/vite-plugin";

export default defineConfig({
  plugins: [nml({ viewsDir: "views" })],
  build: {
    // The emitted view module uses top-level await
    // (`export const html = await render()`), so the build target must
    // support it. Vite's default target (es2020-era browsers) does not.
    target: "esnext",
    // The client entry bundles the view module (with its auto-mount block)
    // to dist/client.js. The SSG pass (generateBundle) emits
    // views/index.nml -> dist/index.html, which loads /client.js.
    rollupOptions: {
      input: { client: "src/client.ts" },
      output: { entryFileNames: "[name].js" },
    },
  },
});
