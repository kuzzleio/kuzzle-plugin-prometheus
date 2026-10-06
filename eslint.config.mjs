import kuzzle from "eslint-plugin-kuzzle";

export default [
  {
    ignores: [
      "node_modules/**",
      // Build output of the .ts sources, never hand-edited.
      "**/*.js",
      "**/*.d.ts",
      "**/*.js.map",
    ],
  },

  ...kuzzle.configs.default,
  ...kuzzle.configs.node,
  ...kuzzle.configs.typescript.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),

  {
    files: ["tests/**"],
    rules: {
      // The tests read private members on purpose (`service["registries"]`):
      // bracket access is what lets them past TypeScript's `private` guard.
      "dot-notation": "off",
    },
  },

  {
    // The development application that boots Kuzzle with the plugin.
    files: ["application/**"],
    rules: { "no-console": "off" },
  },
];
