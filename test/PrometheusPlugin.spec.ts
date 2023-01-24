import { PrometheusPlugin, PrometheusPluginConfiguration } from '../lib/PrometheusPlugin';
import { MetricService } from '../lib/services/MetricService';
import { ContextMock } from './mocks/context.mock';
import { expect } from 'chai';
import 'mocha';
import sinon from 'sinon';
import { KuzzleRequest } from 'kuzzle';

describe('PrometheusPlugin', () => {
  let context, plugin, sandbox;

  beforeEach(() => {
    context = new ContextMock();
    plugin = new PrometheusPlugin();
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#init', () => {
    it('should instantiate Prometheus using provided configuration and fill blank settings with defaults', async () => {
      const customConfig : PrometheusPluginConfiguration = {
        default: {
          enabled: false,
          prefix: 'kuzzle_custom_',
          gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        },
        core: {
          prefix: 'kuzzle_custom_',
        },
        labels: {
          environment: 'test',
        },
      };

      await plugin.init(customConfig, context);

      expect(plugin.config).to.be.eql({
        default: {
          enabled: false,
          prefix: 'kuzzle_custom_',
          eventLoopMonitoringPrecision: 10,
          gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        },
        core: {
          monitorRequestDuration: true,
          prefix: 'kuzzle_custom_',
        },
        labels: {
          nodeId: 'kuzzle-node-id',
          environment: 'test',
        },
      });
    });

    it('should instantiate Prometheus and register hook, pipe, route and Metric service properly without additional config', () => {
      plugin.init(undefined, new ContextMock());
      expect(plugin.hooks['request:onSuccess']).to.exist.and.be.an('function');
      expect(plugin.hooks['request:onError']).to.exist.and.be.an('function');
      expect(plugin.pipes['server:afterMetrics']).to.exist.and.be.an('function');

      // This is a trick to test TS class private properties and avoid the private guard on it
      expect(plugin['metricService']).to.exist.and.be.an.instanceOf(MetricService);
    });
  });

  describe('#pipeFormatMetrics', () => {
    it('should format the metrics and send them to the client as Prometheus format', async () => {
      // We need to override global Kuzzle getter to manipulate the request response
      Reflect.defineProperty(global, 'kuzzle', {
        get () {
          return {
            id: 'kuzzle',
          };
        },
      });

      plugin.init(undefined, context);
      const request = new KuzzleRequest({
        controller: 'server',
        action: 'metrics',
        format: 'prometheus',
      }, {protocol: 'http'});

      const getMetricsStub = sandbox.stub(plugin.metricService, 'getMetrics').returns('fake metrics');
      const getPrometheusContentTypeStub = sandbox.stub(plugin.metricService, 'getPrometheusContentType').returns('text/plain');
      const updateCoreMetricsStub = sandbox.stub(plugin.metricService, 'updateCoreMetrics').returns();

      const formattedRequest = await plugin.pipes['server:afterMetrics'](request);

      expect(getMetricsStub.calledOnce).to.be.true;
      expect(getPrometheusContentTypeStub.calledOnce).to.be.true;
      expect(updateCoreMetricsStub.calledOnce).to.be.true;
      expect(formattedRequest.result).to.contains('fake metrics');
      expect(formattedRequest.response.headers['Content-Type']).to.contains('text/plain');
    });

    it('should not format the metrics if the format argument is missing', async () => {
      plugin.init(undefined, context);
      const request = new KuzzleRequest({
        controller: 'server',
        action: 'metrics',
      }, {});

      const getMetricsSpy = sandbox.spy(plugin.metricService, 'getMetrics');
      const getPrometheusContentTypeSpy = sandbox.spy(plugin.metricService, 'getPrometheusContentType');
      const updateCoreMetricsSpy = sandbox.spy(plugin.metricService, 'updateCoreMetrics');

      await plugin.pipeFormatMetrics(request);

      expect(getMetricsSpy.called).to.be.false;
      expect(getPrometheusContentTypeSpy.called).to.be.false;
      expect(updateCoreMetricsSpy.called).to.be.false;
    });

    it('should not format the metrics if protocol is not HTTP', async () => {
      plugin.init(undefined, context);
      const request = new KuzzleRequest({
        controller: 'server',
        action: 'metrics',
      }, {protocol: 'foo'});

      const getMetricsSpy = sandbox.spy(plugin.metricService, 'getMetrics');
      const getPrometheusContentTypeSpy = sandbox.spy(plugin.metricService, 'getPrometheusContentType');
      const updateCoreMetricsSpy = sandbox.spy(plugin.metricService, 'updateCoreMetrics');

      await plugin.pipeFormatMetrics(request);

      expect(getMetricsSpy.called).to.be.false;
      expect(getPrometheusContentTypeSpy.called).to.be.false;
      expect(updateCoreMetricsSpy.called).to.be.false;
    });
  });

  describe('#recordRequest', () => {
    beforeEach(() => {
      plugin.init(undefined, context);
    });
    
    it('should record the request duration in the Prometheus requestDuration histogram', () => {
      const recordResponseTimeSpy = sandbox.spy(plugin.metricService, 'recordResponseTime');
      const request = new KuzzleRequest({
        action: 'info',
        controller: 'server',
      }, { status: 200 });

      request.context.connection.protocol = 'http';
      plugin.recordRequest(request);
      expect(recordResponseTimeSpy.calledOnce).to.be.true;
      expect(recordResponseTimeSpy.firstCall.args[1]).to.be.eql({
        protocol: 'http',
        status: 200,
        action: 'info',
        controller: 'server',
      });
    });
  });
});