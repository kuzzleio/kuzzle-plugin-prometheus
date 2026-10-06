import {
  PrometheusPlugin,
  PrometheusPluginConfiguration,
} from "../../lib/PrometheusPlugin";
import { MetricService } from "../../lib/services/MetricService";
import { ContextMock } from "./mocks/context.mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KuzzleRequest } from "kuzzle";

describe("PrometheusPlugin", () => {
  let context, plugin;

  beforeEach(() => {
    context = new ContextMock();
    plugin = new PrometheusPlugin();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("#init", () => {
    it("should instantiate Prometheus using provided configuration and fill blank settings with defaults", async () => {
      const customConfig: PrometheusPluginConfiguration = {
        default: {
          enabled: false,
          prefix: "kuzzle_custom_",
          gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        },
        core: {
          prefix: "kuzzle_custom_",
        },
        labels: {
          environment: "test",
        },
      };

      await plugin.init(customConfig, context);

      expect(plugin.config).toEqual({
        default: {
          enabled: false,
          prefix: "kuzzle_custom_",
          eventLoopMonitoringPrecision: 10,
          gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        },
        core: {
          monitorRequestDuration: true,
          prefix: "kuzzle_custom_",
        },
        labels: {
          nodeId: context.accessors.nodeId,
          environment: "test",
        },
      });
    });

    it("should instantiate Prometheus and register hook, pipe, route and Metric service properly without additional config", () => {
      plugin.init(undefined, new ContextMock());
      expect(plugin.hooks["request:onSuccess"]).toBeTypeOf("function");
      expect(plugin.hooks["request:onError"]).toBeTypeOf("function");
      expect(plugin.pipes["server:afterMetrics"]).toBeTypeOf("function");

      // This is a trick to test TS class private properties and avoid the private guard on it
      expect(plugin["metricService"]).toBeInstanceOf(MetricService);
    });

    it("should not register the request hooks when request duration monitoring is disabled", async () => {
      await plugin.init({ core: { monitorRequestDuration: false } }, context);

      expect(plugin.hooks).toEqual({});
      expect(plugin.pipes["server:afterMetrics"]).toBeTypeOf("function");
    });
  });

  describe("#pipeFormatMetrics", () => {
    it("should format the metrics and send them to the client as Prometheus format", async () => {
      // We need to override global Kuzzle getter to manipulate the request response
      Reflect.defineProperty(global, "kuzzle", {
        get() {
          return {
            id: "kuzzle",
          };
        },
      });

      plugin.init(undefined, context);
      const request = new KuzzleRequest(
        {
          controller: "server",
          action: "metrics",
          format: "prometheus",
        },
        { protocol: "http" },
      );

      const getMetricsStub = vi
        .spyOn(plugin.metricService, "getMetrics")
        .mockReturnValue("fake metrics");
      const getPrometheusContentTypeStub = vi
        .spyOn(plugin.metricService, "getPrometheusContentType")
        .mockReturnValue("text/plain");
      const updateCoreMetricsStub = vi
        .spyOn(plugin.metricService, "updateCoreMetrics")
        .mockReturnValue(undefined);

      const formattedRequest =
        await plugin.pipes["server:afterMetrics"](request);

      expect(getMetricsStub).toHaveBeenCalledOnce();
      expect(getPrometheusContentTypeStub).toHaveBeenCalledOnce();
      expect(updateCoreMetricsStub).toHaveBeenCalledOnce();
      expect(formattedRequest.result).toContain("fake metrics");
      expect(formattedRequest.response.headers["Content-Type"]).toContain(
        "text/plain",
      );
    });

    it("should not format the metrics if the format argument is missing", async () => {
      plugin.init(undefined, context);
      const request = new KuzzleRequest(
        {
          controller: "server",
          action: "metrics",
        },
        {},
      );

      const getMetricsSpy = vi.spyOn(plugin.metricService, "getMetrics");
      const getPrometheusContentTypeSpy = vi.spyOn(
        plugin.metricService,
        "getPrometheusContentType",
      );
      const updateCoreMetricsSpy = vi.spyOn(
        plugin.metricService,
        "updateCoreMetrics",
      );

      await plugin.pipeFormatMetrics(request);

      expect(getMetricsSpy).not.toHaveBeenCalled();
      expect(getPrometheusContentTypeSpy).not.toHaveBeenCalled();
      expect(updateCoreMetricsSpy).not.toHaveBeenCalled();
    });

    it("should not format the metrics if protocol is not HTTP", async () => {
      plugin.init(undefined, context);
      const request = new KuzzleRequest(
        {
          controller: "server",
          action: "metrics",
        },
        { protocol: "foo" },
      );

      const getMetricsSpy = vi.spyOn(plugin.metricService, "getMetrics");
      const getPrometheusContentTypeSpy = vi.spyOn(
        plugin.metricService,
        "getPrometheusContentType",
      );
      const updateCoreMetricsSpy = vi.spyOn(
        plugin.metricService,
        "updateCoreMetrics",
      );

      await plugin.pipeFormatMetrics(request);

      expect(getMetricsSpy).not.toHaveBeenCalled();
      expect(getPrometheusContentTypeSpy).not.toHaveBeenCalled();
      expect(updateCoreMetricsSpy).not.toHaveBeenCalled();
    });
  });

  describe("#recordRequest", () => {
    beforeEach(() => {
      plugin.init(undefined, context);
    });

    it("should record the request duration in the Prometheus requestDuration histogram", () => {
      const recordResponseTimeSpy = vi.spyOn(
        plugin.metricService,
        "recordResponseTime",
      );
      const request = new KuzzleRequest(
        {
          action: "info",
          controller: "server",
        },
        { status: 200 },
      );

      request.context.connection.protocol = "http";
      plugin.recordRequest(request);
      expect(recordResponseTimeSpy).toHaveBeenCalledOnce();
      expect(recordResponseTimeSpy.mock.calls[0][1]).toEqual({
        protocol: "http",
        status: 200,
        action: "info",
        controller: "server",
      });
    });
  });

  describe("#metrics", () => {
    it("should format the metrics and send them to the client as Prometheus format", async () => {
      // We need to override global Kuzzle getter to manipulate the request response
      Reflect.defineProperty(global, "kuzzle", {
        get() {
          return {
            id: "kuzzle",
          };
        },
      });

      plugin.init(undefined, context);
      const request = new KuzzleRequest(
        {
          controller: "prometheus",
          action: "metrics",
        },
        { protocol: "http" },
      );

      const getMetricsStub = vi
        .spyOn(plugin.metricService, "getMetrics")
        .mockReturnValue("fake metrics");
      const getPrometheusContentTypeStub = vi
        .spyOn(plugin.metricService, "getPrometheusContentType")
        .mockReturnValue("text/plain");
      const updateCoreMetricsStub = vi
        .spyOn(plugin.metricService, "updateCoreMetrics")
        .mockReturnValue(undefined);
      plugin.context.accessors.sdk.query.mockReturnValue({
        result: "fake metrics",
      });

      const formattedRequest = await plugin.metrics(request);

      expect(plugin.context.accessors.sdk.query).toHaveBeenCalledOnce();
      expect(getMetricsStub).toHaveBeenCalledOnce();
      expect(getPrometheusContentTypeStub).toHaveBeenCalledOnce();
      expect(updateCoreMetricsStub).toHaveBeenCalledOnce();
      expect(formattedRequest).toContain("fake metrics");
    });

    it("should not format the metrics if protocol is not HTTP", async () => {
      plugin.init(undefined, context);
      const request = new KuzzleRequest(
        {
          controller: "prometheus",
          action: "metrics",
        },
        { protocol: "foo" },
      );

      const getMetricsSpy = vi.spyOn(plugin.metricService, "getMetrics");
      const getPrometheusContentTypeSpy = vi.spyOn(
        plugin.metricService,
        "getPrometheusContentType",
      );
      const updateCoreMetricsSpy = vi.spyOn(
        plugin.metricService,
        "updateCoreMetrics",
      );

      await plugin.pipeFormatMetrics(request);

      expect(getMetricsSpy).not.toHaveBeenCalled();
      expect(getPrometheusContentTypeSpy).not.toHaveBeenCalled();
      expect(updateCoreMetricsSpy).not.toHaveBeenCalled();
    });
  });
});
