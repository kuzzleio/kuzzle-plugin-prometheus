const
  { PrometheusPlugin } = require('../lib/PrometheusPlugin'),
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
    clearInterval(plugin.prometheusController._systemMetricsJob);
    plugin.prometheusController._registry.clear(); // Clear registry object which is global
  });

  describe('#init', () => {
    it('should instantiate Prometheus using provided configuration', () => {
      return plugin.init(configuration, context).then(() => {
        should(plugin.prometheusController._kuzzleMetrics.requests).be.instanceOf(
          Prometheus.Histogram
        );
        should(plugin.prometheusController._kuzzleMetrics.rooms).be.instanceOf(Prometheus.Gauge);
        should(Object.keys(plugin.hooks).length).be.equals(6);
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
          kuzzle: true,
          common: []
        }
      }, context))
        .be.rejectedWith('[prometheus plugin] Configuration error: Expected \'labels.kuzzle\' to be an array, boolean received')
    });

    it('should throw if kuzzle labels contains an unknown value', () => {
      return should(plugin.init({
        labels: {
          kuzzle: ['foobar'],
          common: []
        }
      }, context))
        .be.rejectedWith('[prometheus plugin] Configuration error: Invalid kuzzle label foobar, should be one of [controller, action, event, protocol, status]')
    });

    it('should throw if no kuzzle label is provided', () => {
      return should(plugin.init({
        labels: {
          kuzzle: [],
          common: []
        }
      }, context))
        .be.rejectedWith('[prometheus plugin] Configuration error: \'labels.kuzzle\' cannot be empty.');
    });

    it('should not record default metrics if configured not to do so', () => {
      return plugin.init({
        collectSystemMetrics: false
      })
        .then(() => {
          should(plugin.prometheusController._systemMetricsJob).be.undefined();
        });
    });

  });

  describe('#recordRequests', () => {
    it('should save request metrics to Registry', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.requests, 'observe');
        request.init({
          input: { controller: 'test', action: 'test' },
          context: { connection: 'http' }
        });
        plugin.prometheusController.recordRequests(request, 'request:onSuccess');
        plugin.prometheusController._kuzzleMetrics.requests.observe.calledWith(
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
            controller: 'prometheus',
            action: 'metrics'
          }
        });
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.requests, 'observe');

        plugin.prometheusController.recordRequests(request, 'request:onSuccess');
        should(plugin.prometheusController._kuzzleMetrics.requests.observe).not.be.called();
      });
    });

    it('should observe configured labels only', () => {
      return plugin.init({
        labels: {
          common: [],
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
          const spy = sandbox.spy(plugin.prometheusController._kuzzleMetrics.requests, 'observe');

          plugin.prometheusController.recordRequests(request, 'request:onSuccess');

          should(spy)
            .be.calledOnce()
            .be.calledWith({
              action: 'action'
            });
        });
    })
  });

  describe('#recordRooms', () => {
    it('should increment active rooms number when `core:hotelClerk:addSubscription` event triggered', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.rooms, 'inc');
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.rooms, 'dec');
        plugin.prometheusController.recordRooms({}, 'core:hotelClerk:addSubscription');
        should(plugin.prometheusController._kuzzleMetrics.rooms.inc).be.calledOnce();
        should(plugin.prometheusController._kuzzleMetrics.rooms.dec).not.be.called();
      });
    });

    it('should decrement active rooms number when `core:hotelClerk:removeRoomForCustomer` event triggered', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.rooms, 'inc');
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.rooms, 'dec');
        plugin.prometheusController.recordRooms({}, 'core:hotelClerk:removeRoomForCustomer');
        should(plugin.prometheusController._kuzzleMetrics.rooms.dec).be.calledOnce();
        should(plugin.prometheusController._kuzzleMetrics.rooms.inc).not.be.called();
      });
    });
  });

  describe('#recordConnections', () => {
    it('should increment active connections number when `connection:new` event triggered', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.connections, 'inc');
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.connections, 'dec');
        plugin.prometheusController.recordConnections({}, 'connection:new');
        should(plugin.prometheusController._kuzzleMetrics.connections.inc).be.calledOnce();
        should(plugin.prometheusController._kuzzleMetrics.connections.dec).not.be.called();
      });
    });

    it('should decrement active connections number when `connection:remove` event triggered', () => {
      return plugin.init(configuration, context).then(() => {
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.connections, 'inc');
        sandbox.spy(plugin.prometheusController._kuzzleMetrics.connections, 'dec');
        plugin.prometheusController.recordConnections({}, 'connection:remove');
        should(plugin.prometheusController._kuzzleMetrics.connections.dec).be.calledOnce();
        should(plugin.prometheusController._kuzzleMetrics.connections.inc).not.be.called();
      });
    });
  });

  describe('#metrics', () => {
    it('should return a Prometheus formatted response on HTTP call', () => {
      return plugin.init(configuration, context).then(() => {
        plugin.syncRegisters = sandbox.stub().resolves(plugin.prometheusController._registry);
        request.init({
          context: {
            connection: { protocol: 'http' }
          },
          response: { configure: sinon.stub() }
        });
        return plugin.prometheusController.metrics(request).then(response => {
          should(request.response.configure).be.calledOnce();
          should(response).be.an.instanceOf(String);
        });
      });
    });

    it('should not return a Prometheus formatted response on non-HTTP call', () => {
      return plugin.init(configuration, context).then(() => {
        plugin.syncRegisters = sandbox.stub().resolves(plugin.prometheusController._registry);
        request.init({
          context: {
            connection: { protocol: 'websocket' }
          },
          response: { configure: sinon.stub() }
        });
        return plugin.prometheusController.metrics(request).then(response => {
          !should(request.response.configure).not.be.called();
          should(response).be.undefined();
        });
      });
    });
  });
});
