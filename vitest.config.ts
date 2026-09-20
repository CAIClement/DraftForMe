import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Agent worktrees live under `.claude/` and carry their own `node_modules`,
    // so a bare `vitest run` collects a second copy of this suite against a
    // second copy of React and fails it on duplicate hooks. Those failures look
    // exactly like a regression in the working tree, which is the whole problem.
    exclude: [...configDefaults.exclude, "**/.claude/**"]
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
