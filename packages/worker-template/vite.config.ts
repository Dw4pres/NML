import { defineConfig } from "vite";
import nml from "@nml-lang/vite-plugin";

export default defineConfig({
  plugins: [nml({ viewsDir: "views" })],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
