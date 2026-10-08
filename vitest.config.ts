import { defineConfig } from "vitest/config";

export default defineConfig({
  // The build emits index.js next to index.ts: resolve the .ts first, or a
  // test would load a stale compiled module alongside its source.
  resolve: {
    extensions: [".ts", ".mts", ".mjs", ".js", ".json"],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.spec.ts"],
          environment: "node",
        },
      },
      {
        // Runs against the Docker Compose stack (`docker compose up -d --wait`).
        extends: true,
        test: {
          name: "functional",
          include: ["tests/functional/**/*.spec.ts"],
          environment: "node",
          testTimeout: 10000,
        },
      },
    ],
  },
});
