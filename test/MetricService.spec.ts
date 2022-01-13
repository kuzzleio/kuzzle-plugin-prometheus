import { MetricService } from '../lib/services/MetricService';
import { PrometheusPlugin, PrometheusPluginConfiguration } from '../lib/PrometheusPlugin';
import { expect } from 'chai';
import 'mocha';
import sinon from 'sinon';
import { KuzzleRequest } from 'kuzzle';
import { Registry } from 'prom-client';


describe('MetricService', () => {
  let sandbox, config: PrometheusPluginConfiguration;

  beforeEach(() => {
    config = {
      metrics: {
        default: {
          enabled: true,
          prefix: 'kuzzle_',
          eventLoopMonitoringPrecision: 10,
          gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        },
        core: {
          monitorRequestDuration: true,
          prefix: 'kuzzle_',
        }
      }
    };
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor', () => {
    it('should at least record core metrics if we disable everything', () => {
      config.metrics.default.enabled = false;
      config.metrics.core.monitorRequestDuration = false;

      const metricService = new MetricService(config);

      expect(Object.keys(metricService['registries']).length).to.equal(1);
      expect(metricService['registries']['core']).to.be.an('object');
    });

    it('should create a dedicated Prometheus registry for requests duration when enabled', () => {
      config.metrics.default.enabled = false;

      const metricService = new MetricService(config);

      expect(Object.keys(metricService['registries']).length).to.equal(2);
      expect(metricService['registries']['core']).to.be.an.instanceOf(Registry);
      expect(metricService['registries']['requestDuration']).to.be.an.instanceOf(Registry);
    });

    it('should create a dedicated Prometheus registry for default Node.js metrics when enabled', () => {
      const metricService = new MetricService(config);

      expect(Object.keys(metricService['registries']).length).to.equal(3);
      expect(metricService['registries']['core']).to.be.an.instanceOf(Registry);
      expect(metricService['registries']['requestDuration']).to.be.an.instanceOf(Registry);
      expect(metricService['registries']['default']).to.be.an.instanceOf(Registry);
    });
  });

  describe('#getMetrics', () => {
    it('should return all the enabled metrics Prometheus string formatted', async () => {
      const metricService = new MetricService(config);

      const metricsAsString = await metricService.getMetrics();
      expect(metricsAsString).to.contain('kuzzle_api_concurrent_requests');
      expect(metricsAsString).to.contain('kuzzle_api_request_duration_ms');
      expect(metricsAsString).to.contain('kuzzle_realtime_rooms');
      expect(metricsAsString).to.contain('kuzzle_realtime_subscriptions');
      expect(metricsAsString).to.contain('kuzzle_process_cpu_user_seconds_total');
    });
  });

  describe('#getPrometheusContentType', () => {
    it('should return the content type for the given metrics', () => {
      const metricService = new MetricService(config);
      expect(metricService.getPrometheusContentType()).to.equal('text/plain; version=0.0.4; charset=utf-8');
    });
  });

  describe('#recordResponseTime', () => {
    it('should record the response time for the given request', async () => {
      const metricService = new MetricService(config);
      metricService.recordResponseTime(42, { action: 'foo', controller: 'bar', status: 200, protocol: 'http' });
      expect(await metricService['registries']['requestDuration'].getSingleMetricAsString('kuzzle_api_request_duration_ms')).to.contain('kuzzle_api_request_duration_ms_sum{action="foo",controller="bar",status="200",protocol="http"} 42');
    });
  });

  describe('#updateCoreMetrics', () => {
    it('should update the core metrics', async () => {
      const metricService = new MetricService(config);
      const jsonMetrics = {
        api:{
          concurrentRequests: 10,
          pendingRequests: 5
        },
        network: {
          connections: {
            websocket: 9,
            'http/1.1': 11
          }
        },
        realtime: {
         rooms: 42,
         subscriptions: 122,
         invalidMetric: 666
        },
      };

      metricService.updateCoreMetrics(jsonMetrics);

      expect(await metricService['registries']['core'].getSingleMetricAsString('kuzzle_api_concurrent_requests')).to.contains('10');
      expect(await metricService['registries']['core'].getSingleMetricAsString('kuzzle_api_pending_requests')).to.contain('5');
      expect(await metricService['registries']['core'].getSingleMetricAsString('kuzzle_network_connections')).to.contain('9');
      expect(await metricService['registries']['core'].getSingleMetricAsString('kuzzle_network_connections')).to.contain('11');
      expect(metricService['registries']['core'].getSingleMetric('kuzzle_realtime_invalidMetric')).to.be.undefined;
    });
  });
});
