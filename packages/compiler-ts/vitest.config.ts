import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["source", "bun", "import", "module", "default"],
  },
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 90,
      },
    },
  },
});
