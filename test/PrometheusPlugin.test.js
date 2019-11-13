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
        should(Object.keys(plugin.hooks).length).be.equals(6);
        should(plugin.config.syncInterval).be.equals(
          configuration.syncInterval
        );
      });
    });

    it('should instantiate Prometheus using default values', () => {
      configuration = {}; // Empty configuration

      return plugin.init(configuration, context).then(() => {
        should(plugin.config).eql({
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
        plugin.recordRooms({}, 'room:new');
        should(plugin.kuzzleMetrics.rooms.inc).be.calledOnce();
        should(plugin.kuzzleMetrics.rooms.dec).not.be.called();
      });
    });

    it('should decrement active rooms number when `room:remove` event triggered', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.kuzzleMetrics.rooms, 'inc');
        sandbox.spy(plugin.kuzzleMetrics.rooms, 'dec');
        plugin.recordRooms({}, 'room:remove');
        should(plugin.kuzzleMetrics.rooms.dec).be.calledOnce();
        should(plugin.kuzzleMetrics.rooms.inc).not.be.called();
      });
    });
  });

  describe('#recordConnections', () => {
    it('should increment active connections number when `connection:new` event triggered', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.kuzzleMetrics.connections, 'inc');
        sandbox.spy(plugin.kuzzleMetrics.connections, 'dec');
        plugin.recordConnections({}, 'connection:new');
        should(plugin.kuzzleMetrics.connections.inc).be.calledOnce();
        should(plugin.kuzzleMetrics.connections.dec).not.be.called();
      });
    });

    it('should decrement active connections number when `connection:remove` event triggered', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.kuzzleMetrics.connections, 'inc');
        sandbox.spy(plugin.kuzzleMetrics.connections, 'dec');
        plugin.recordConnections({}, 'connection:remove');
        should(plugin.kuzzleMetrics.connections.dec).be.calledOnce();
        should(plugin.kuzzleMetrics.connections.inc).not.be.called();
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
});
