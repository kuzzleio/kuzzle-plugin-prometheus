const
  PrometheusPlugin = require('../lib/index.js'),
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
        should(plugin.config).eql({
          syncInterval: 7500,
          collectSystemMetrics: true,
          systemMetricsInterval: 5000,
          labels: {
            common: [
              'nodeHost',
              'nodeMAC',
              'nodeIP'
            ],
            kuzzle: [
              'controller',
              'action',
              'event',
              'protocol',
              'status'
            ]
          }
        });
      });
    });

    it('should throw if common labels is not an array' , () => {
      return should(plugin.init({labels: {common: true}}, context))
        .be.rejectedWith('[prometheus plugin] Configuration error: Expected \'labels.common\' to be an array, boolean received.');
    });

    it('should throw if common labels contains an unknown value', () => {
      return should(plugin.init({
        labels: {
          common: ['foobar']
        }
      }, context))
        .be.rejectedWith('[prometheus plugin] Configuration error: Invalid common label foobar, should be one of [nodeHost, nodeMAC, nodeIP]');
    });

    it('should throw if kuzzle labels is not an array', () => {
      return should(plugin.init({
        labels: {
          kuzzle: true
        }
      }, context))
        .be.rejectedWith('[prometheus plugin] Configuration error: Expected \'labels.kuzzle\' to be an array, boolean received')
    });

    it('should throw if kuzzle labels contains an unknown value', () => {
      return should(plugin.init({
        labels: {
          kuzzle: ['foobar']
        }
      }, context))
        .be.rejectedWith('[prometheus plugin] Configuration error: Invalid kuzzle label foobar, should be one of [controller, action, event, protocol, status]')
    });

    it('should throw if no kuzzle label is provided', () => {
      return should(plugin.init({
        labels: {
          kuzzle: []
        }
      }, context))
        .be.rejectedWith('[prometheus plugin] Configuration error: \'labels.kuzzle\' cannot be empty.');
    });

    it('should not record default metrics if configured not to do so', () => {
      return plugin.init({
        collectSystemMetrics: false
      })
        .then(() => {
          should(plugin.systemMetricsJob).be.undefined();
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
            controller: 'kuzzle-plugin-prometheus/prometheus',
            action: 'metrics'
          }
        });
        sandbox.spy(plugin.kuzzleMetrics.requests, 'observe');

        plugin.recordRequests(request, 'request:onSuccess');
        should(plugin.kuzzleMetrics.requests.observe).not.be.called();
      });
    });

    it('should observe configured labels only', () => {
      return plugin.init({
        labels: {
          kuzzle: ['action']
        }
      }, context)
        .then(() => {
          request.init({
            input: {
              controller: 'controller',
              action: 'action',
              foo: 'bar',
              event: 'event',
              protocol: 'protocol',
              status: 'status'
            }
          });
          const spy = sandbox.spy(plugin.kuzzleMetrics.requests, 'observe');

          plugin.recordRequests(request, 'request:onSuccess');

          should(spy)
            .be.calledOnce()
            .be.calledWith({
              action: 'action'
            });
        });
    })
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
    it('should return a Prometheus formatted response on HTTP call', () => {
      return plugin.init(configuration, context).then(() => {
        plugin.syncRegisters = sandbox.stub().resolves(plugin.registry);
        request.init({
          context: {
            connection: { protocol: 'http' }
          },
          response: { setHeader: sinon.stub() }
        });
        return plugin.metrics(request).then(response => {
          should(request.response.setHeader).be.calledOnce();
          should(response).be.an.instanceOf(String);
        });
      });
    });

    it('should not return a Prometheus formatted response on non-HTTP call', () => {
      return plugin.init(configuration, context).then(() => {
        plugin.syncRegisters = sandbox.stub().resolves(plugin.registry);
        request.init({
          context: {
            connection: { protocol: 'websocket' }
          },
          response: { setHeader: sinon.stub() }
        });
        return plugin.metrics(request).then(response => {
          !should(request.response.setHeader).not.be.called();
          should(response).be.undefined();
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
