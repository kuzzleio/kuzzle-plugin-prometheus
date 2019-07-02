const PrometheusPlugin = require('../lib/index.js'),
  ContextMock = require('./mocks/context.mock'),
  RequestMock = require('./mocks/request.mock'),
  ConfigurationMock = require('./mocks/config.mock'),
  Prometheus = require('prom-client'),
  sinon = require('sinon'),
  should = require('should');

describe('PrometheusPlugin', () => {
  let context, plugin, configuration, request, sandbox;

  beforeEach(() => {
    configuration = new ConfigurationMock();
    context = new ContextMock();
    plugin = new PrometheusPlugin({}, context);
    request = new RequestMock();
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    clearInterval(plugin.syncJob);
    clearInterval(plugin.systemMetricsJob);
    plugin.registry.clear(); // Clear registry object which is global
  });

  describe('#init', () => {
    it('should instantiate Prometheus using provided configuration', () => {
      return plugin.init(configuration, context).then(() => {
        should(plugin.kuzzleMetrics.requests).be.instanceOf(
          Prometheus.Histogram
        );
        should(plugin.kuzzleMetrics.rooms).be.instanceOf(Prometheus.Gauge);
        should(Object.keys(plugin.hooks).length).be.equals(4);
        should(plugin.config.syncInterval).be.equals(
          configuration.syncInterval
        );
      });
    });

    it('should instantiate Prometheus using default values', () => {
      configuration = {}; // Empty configuration
      return plugin.init(configuration, context).then(() => {
        should(plugin.config.syncInterval).be.equals(7500);
        should(plugin.config.systemMetricsInterval).be.equals(5000);
      });
    });
  });

  describe('#recordRequests', () => {
    it('should save request metrics to Registry', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.kuzzleMetrics.requests, 'observe');
        request.init({
          input: { controller: 'test', action: 'test' },
          context: { connection: 'http' }
        });
        plugin.recordRequests(request, 'request:onSuccess');
        plugin.kuzzleMetrics.requests.observe.calledWith(
          {
            controller: 'test',
            action: 'test',
            event: 'request:onSuccess',
            protocol: 'http'
          },
          Date.now() - request.timestamp
        );
      });
    });

    it('should not save request metrics Registry if request action is `metrics`', () => {
      return plugin.init(configuration, context).then(() => {
        request.init({
          input: {
            controller: 'plugin-kuzzle-prometheus/prometheus',
            action: 'metrics'
          }
        });
        sandbox.spy(plugin.kuzzleMetrics.requests, 'observe');

        plugin.recordRequests(request, 'request:onSuccess');
        should(plugin.kuzzleMetrics.requests.observe).not.be.called();
      });
    });
  });

  describe('#recordRooms', () => {
    it('should increment active rooms number when `room:new` event triggered', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.kuzzleMetrics.rooms, 'inc');
        sandbox.spy(plugin.kuzzleMetrics.rooms, 'dec');
        plugin.recordRooms('room:new');
        should(plugin.kuzzleMetrics.rooms.inc).be.calledOnce();
        should(plugin.kuzzleMetrics.rooms.dec).not.be.called();
      });
    });

    it('should decrement active rooms number when `room:remove` event triggered', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.kuzzleMetrics.rooms, 'inc');
        sandbox.spy(plugin.kuzzleMetrics.rooms, 'dec');
        plugin.recordRooms('room:remove');
        should(plugin.kuzzleMetrics.rooms.dec).be.calledOnce();
        should(plugin.kuzzleMetrics.rooms.inc).not.be.called();
      });
    });
  });

  describe('#metrics', () => {
    it('should return a Prometheus formatted response', () => {
      return plugin.init(configuration, context).then(() => {
        plugin.syncRegisters = sandbox.stub().resolves(plugin.registry);
        request.init({ response: { setHeader: sinon.stub() } });
        return plugin.metrics(request).then(response => {
          should(request.response.setHeader).be.calledOnce();
          should(response).be.an.instanceOf(String);
        });
      });
    });
  });

  describe('#pushRegistry', () => {
    it('should push the local Prometheus Registry to Redis using node key', () => {
      return plugin.init(configuration, context).then(() => {
        return plugin.pushRegistry().then(() => {
          should(plugin.context.accessors.sdk.ms.set)
            .be.calledWith(
              plugin.key,
              JSON.stringify(plugin.registry.getMetricsAsJSON())
            )
            .and.be.ok();
        });
      });
    });
  });

  describe('#syncRegisters', () => {
    it('should aggregate Prometheus Registers from Redis when there is only one node', () => {
      return plugin.init(configuration, context).then(() => {
        plugin.context.accessors.sdk.ms.scan.resolves({
          cursor: 0,
          values: [plugin.key]
        });
        sandbox.spy(Prometheus.AggregatorRegistry, 'aggregate');
        return plugin.syncRegisters().then(registry => {
          should(plugin.context.accessors.sdk.ms.scan)
            .be.calledWith(0, { match: '{kuzzle_prometheus}-*' })
            .and.be.ok();
          should(
            Prometheus.AggregatorRegistry.aggregate.args[0].length
          ).be.equals(1);
          should(registry).be.instanceOf(Prometheus.Registry);
        });
      });
    });

    it('should aggregate Prometheus Registers from Redis when there is multiple nodes', () => {
      return plugin.init(configuration, context).then(() => {
        plugin.context.accessors.sdk.ms.scan.resolves({
          cursor: 0,
          values: [
            plugin.key,
            'kuzzle_prometheus_fakeHost_MAC_IP',
            'kuzzle_prometheus_fakeHost2_MAC2_IP2'
          ]
        });

        plugin.context.accessors.sdk.ms.mget.resolves([
          JSON.stringify(plugin.registry.getMetricsAsJSON()),
          JSON.stringify(plugin.registry.getMetricsAsJSON())
        ]);
        sandbox.spy(Prometheus.AggregatorRegistry, 'aggregate');
        return plugin.syncRegisters().then(registry => {
          should(plugin.context.accessors.sdk.ms.scan)
            .be.calledWith(0, { match: '{kuzzle_prometheus}-*' })
            .and.be.ok();
          should(plugin.context.accessors.sdk.ms.mget)
            .be.calledWith([
              'kuzzle_prometheus_fakeHost_MAC_IP',
              'kuzzle_prometheus_fakeHost2_MAC2_IP2'
            ])
            .and.be.ok();
          should(registry).be.instanceOf(Prometheus.Registry);
        });
      });
    });
  });
});
