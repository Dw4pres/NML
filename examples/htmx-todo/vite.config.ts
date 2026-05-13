import { defineConfig } from "vite";
import nml from "@nml-lang/vite-plugin";

export default defineConfig({
  plugins: [nml({ viewsDir: "views" })],
});