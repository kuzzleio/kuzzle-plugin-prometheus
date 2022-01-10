import { PrometheusPlugin, PrometheusPluginConfiguration } from '../lib/PrometheusPlugin';
import { MetricService } from '../lib/services/MetricService';
import { ContextMock } from './mocks/context.mock';
import { expect } from 'chai';
import 'mocha';
import { KuzzleRequest } from 'kuzzle';



describe('PrometheusPlugin', () => {
  describe('#init', () => {
    it('should instantiate Prometheus using provided configuration and fill blank settings with defaults', () => {
      const customConfig : PrometheusPluginConfiguration = {
        metrics: {
          default: {
            enabled: false,
            prefix: 'kuzzle_custom_',
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
          },
          core: {
            prefix: 'kuzzle_custom_',
          }
        }
      };

      const plugin : PrometheusPlugin = new PrometheusPlugin();
      plugin.init(customConfig, new ContextMock());
      expect(plugin.config).to.be.eql({
        metrics: {
          default: {
            enabled: false,
            prefix: 'kuzzle_custom_',
            eventLoopMonitoringPrecision: 10,
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
          },
          core: {
            monitorRequestDuration: true,
            prefix: 'kuzzle_custom_',
          }
        }
      });
    });

    it('should instantiate Prometheus and register hook, pipe, route and Metric service properly', () => {
      const plugin : PrometheusPlugin = new PrometheusPlugin();
      plugin.init(undefined, new ContextMock());
      expect(plugin.api.prometheus).to.exist.and.be.an('object');
      expect(plugin.hooks['request:on*']).to.exist.and.be.an('function');
      expect(plugin.pipes['server:afterMetrics']).to.exist.and.be.an('function');

      // This is a trick to test TS class private properties and avoid the private guard on it
      expect(plugin['metricService']).to.exist.and.be.an.instanceOf(MetricService);
    });
  });

  describe('#pipeFormatMetrics', () => {
    it('should format the server:metrics response when format=prometheus param is given', async () => {
      const request : KuzzleRequest = new KuzzleRequest({
        controller: 'server',
        action: 'metrics',
        format: 'prometheus'
      }, {})

      const plugin : PrometheusPlugin = new PrometheusPlugin();
      plugin.init(undefined, new ContextMock());
      const response = await plugin.pipeFormatMetrics(request);
      console.log(response)
    });

    it('should not format the server:metrics response when the format=prometheus param is not given', () => {
      const request : KuzzleRequest = new KuzzleRequest({}, {})
    });
  });
});
