import { describe, expect, it } from "vitest";

import * as plugin from "../../index";
import * as kuzzlePrometheus from "kuzzle-prometheus/kuzzle";

describe("kuzzle-plugin-prometheus", () => {
  it("re-exports kuzzle-prometheus/kuzzle", () => {
    expect(plugin.PrometheusPlugin).toBe(kuzzlePrometheus.PrometheusPlugin);
    expect(plugin.createMetrics).toBe(kuzzlePrometheus.createMetrics);
  });

  it("keeps the plugin name Kuzzle infers from the class", () => {
    expect(new plugin.PrometheusPlugin().constructor.name).toBe(
      "PrometheusPlugin",
    );
  });
});
