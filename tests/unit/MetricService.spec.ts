import { MetricService } from "../../lib/services/MetricService";
import { PrometheusPluginConfiguration } from "../../lib/PrometheusPlugin";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Registry } from "prom-client";

describe("MetricService", () => {
  let config: PrometheusPluginConfiguration;

  beforeEach(() => {
    config = {
      default: {
        enabled: true,
        prefix: "kuzzle_",
        eventLoopMonitoringPrecision: 10,
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      },
      core: {
        monitorRequestDuration: true,
        prefix: "kuzzle_",
      },
      labels: {
        nodeId: "kuzzle",
        environment: "test",
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("#constructor", () => {
    Reflect.defineProperty(global, "kuzzle", {
      get() {
        return {
          id: "kuzzle",
        };
      },
    });

    it("should at least record core metrics if we disable everything", () => {
      config.default.enabled = false;
      config.core.monitorRequestDuration = false;

      const metricService = new MetricService(config);

      expect(Object.keys(metricService["registries"]).length).toBe(1);
      expect(metricService["registries"]["core"]).toBeTypeOf("object");
      expect(metricService["labels"]).toBeTypeOf("object");
      expect(metricService["labels"]["nodeId"]).toBe("kuzzle");
      expect(metricService["labels"]["environment"]).toBe("test");
    });

    it("should create a dedicated Prometheus registry for requests duration when enabled", () => {
      config.default.enabled = false;

      const metricService = new MetricService(config);

      expect(Object.keys(metricService["registries"]).length).toBe(2);
      expect(metricService["registries"]["core"]).toBeInstanceOf(Registry);
      expect(metricService["registries"]["requestDuration"]).toBeInstanceOf(
        Registry,
      );
    });

    it("should create a dedicated Prometheus registry for default Node.js metrics when enabled", () => {
      const metricService = new MetricService(config);

      expect(Object.keys(metricService["registries"]).length).toBe(3);
      expect(metricService["registries"]["core"]).toBeInstanceOf(Registry);
      expect(metricService["registries"]["requestDuration"]).toBeInstanceOf(
        Registry,
      );
      expect(metricService["registries"]["default"]).toBeInstanceOf(Registry);
    });
  });

  describe("#getMetrics", () => {
    it("should return all the enabled metrics Prometheus string formatted", async () => {
      const metricService = new MetricService(config);

      const metricsAsString = await metricService.getMetrics();
      expect(metricsAsString).toContain("kuzzle_api_concurrent_requests");
      expect(metricsAsString).toContain("kuzzle_api_request_duration_ms");
      expect(metricsAsString).toContain("kuzzle_realtime_rooms");
      expect(metricsAsString).toContain("kuzzle_realtime_subscriptions");
      expect(metricsAsString).toContain(
        "kuzzle_process_cpu_user_seconds_total",
      );
    });
  });

  describe("#getPrometheusContentType", () => {
    it("should return the content type for the given metrics", () => {
      const metricService = new MetricService(config);
      expect(metricService.getPrometheusContentType()).toBe(
        "text/plain; version=0.0.4; charset=utf-8",
      );
    });
  });

  describe("#recordResponseTime", () => {
    it("should record the response time for the given request", async () => {
      const metricService = new MetricService(config);
      metricService.recordResponseTime(42, {
        action: "foo",
        controller: "bar",
        status: 200,
        protocol: "http",
      });
      expect(
        await metricService["registries"][
          "requestDuration"
        ].getSingleMetricAsString("kuzzle_api_request_duration_ms"),
      ).toContain(
        'kuzzle_api_request_duration_ms_sum{action="foo",controller="bar",status="200",protocol="http",nodeId="kuzzle",environment="test"} 42',
      );
    });
  });

  describe("#updateCoreMetrics", () => {
    it("should update the core metrics", async () => {
      const metricService = new MetricService(config);
      const jsonMetrics = {
        api: {
          concurrentRequests: 10,
          pendingRequests: 5,
        },
        network: {
          connections: {
            websocket: 9,
            "http/1.1": 11,
          },
        },
        realtime: {
          rooms: 42,
          subscriptions: 122,
          invalidMetric: 666,
        },
      };

      metricService.updateCoreMetrics(jsonMetrics);

      expect(
        await metricService["registries"]["core"].getSingleMetricAsString(
          "kuzzle_api_concurrent_requests",
        ),
      ).toContain("10");
      expect(
        await metricService["registries"]["core"].getSingleMetricAsString(
          "kuzzle_api_pending_requests",
        ),
      ).toContain("5");
      expect(
        await metricService["registries"]["core"].getSingleMetricAsString(
          "kuzzle_network_connections",
        ),
      ).toContain("9");
      expect(
        await metricService["registries"]["core"].getSingleMetricAsString(
          "kuzzle_network_connections",
        ),
      ).toContain("11");
      expect(
        metricService["registries"]["core"].getSingleMetric(
          "kuzzle_realtime_invalidMetric",
        ),
      ).toBeUndefined();
    });
  });
});
