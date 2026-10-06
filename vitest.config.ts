import { defineConfig } from "vitest/config";

export default defineConfig({
  // The build emits lib/**/*.js next to the sources: resolve the .ts first,
  // or a test would load a stale compiled module alongside its source (two
  // copies of each class, `instanceof` failing across them).
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
