import { defineConfig } from "vite";
import nml from "vite-plugin-nml";

export default defineConfig({
  plugins: [nml({ viewsDir: "views" })],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
