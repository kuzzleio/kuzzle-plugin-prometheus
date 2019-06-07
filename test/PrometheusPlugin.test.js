const PrometheusPlugin = require('../lib/index.js'),
  ContextMock = require('./mocks/context.mock'),
  RequestMock = require('./mocks/request.mock'),
  ConfigurationMock = require('./mocks/config.mock'),
  Prometheus = require('prom-client'),
  sinon = require('sinon'),
  should = require('should');

describe('PrometheusPlugin', () => {
  let contextMock, plugin, configuration, request;

  beforeEach(() => {
    configuration = new ConfigurationMock();
    contextMock = new ContextMock();
    plugin = new PrometheusPlugin({}, contextMock);
    request = new RequestMock();
    Prometheus.register.clear(); // Clear registry object which is global
    plugin.init(configuration, contextMock);
    plugin.gateway.pushAdd = sinon.stub();
  });

  describe('#init', () => {
    it('should create a PrometheusPlugin with correctly initialized metrics and hooks', () => {
      plugin.gateway.should.be.an.instanceOf(Prometheus.Pushgateway);
      plugin.prometheusMetrics.should.not.be.empty();

      plugin.prometheusMetrics['request:onError'][
        'requestCount'
      ].should.be.an.instanceOf(Prometheus.Counter);
      plugin.prometheusMetrics['request:onSuccess'][
        'requestCount'
      ].should.be.an.instanceOf(Prometheus.Counter);
      plugin.prometheusMetrics['request:onSuccess'][
        'requestLatency'
      ].should.be.an.instanceOf(Prometheus.Summary);
      should.exist(plugin.hooks['request:onError']);
      should.exist(plugin.hooks['request:onSuccess']);
    });
  });
  describe('#hooks', () => {
    it('should push request count metrics to Prometheus PushGateway', () => {
      let currentMetric =
        plugin.prometheusMetrics['request:onSuccess']['requestCount'];

      plugin.requestCount(request, 'request:onSuccess');

      sinon.spy(currentMetric, 'inc');
      currentMetric.inc.calledWith();
      sinon.spy(plugin, 'pushToGateway');
      plugin.pushToGateway.calledWith('kuzzle');
    });
    it('should push request latency metrics to Prometheus PushGateway', () => {
      let currentMetric =
        plugin.prometheusMetrics['request:onSuccess']['requestLatency'];
      plugin.requestLatency(request, 'request:onSuccess');

      sinon.spy(currentMetric, 'observe');
      currentMetric.observe.calledWith();
      sinon.spy(plugin, 'pushToGateway');
      plugin.pushToGateway.calledWith('kuzzle');
    });
  });
  describe('#pushToGateway', () => {
    it('should return a Promise', () => {
      plugin.pushToGateway('kuzzle').should.be.a.Promise();
    });
  });
});
