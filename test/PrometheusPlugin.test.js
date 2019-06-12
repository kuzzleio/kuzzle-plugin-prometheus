const PrometheusPlugin = require('../lib/index.js'),
  ContextMock = require('./mocks/context.mock'),
  RequestMock = require('./mocks/request.mock'),
  ConfigurationMock = require('./mocks/config.mock'),
  Prometheus = require('prom-client'),
  sinon = require('sinon');

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
      plugin.jobName.should.match('kuzzle');
      plugin.gateway.push.should.be.an.Function();
      plugin.metrics.request.should.not.be.undefined();
      Object.keys(plugin.hooks).should.have.length(2);
    });
  });
  describe('#requestInfo', () => {
    it('should push request metrics to Prometheus PushGateway', () => {
      request.init({
        input: { controller: 'test', action: 'test' },
        status: 200
      });
      plugin.requestInfo(request, 'request:onSuccess');

      sinon.spy(plugin.metrics.request, 'observe');
      plugin.metrics.request.observe.calledWith(
        {
          controller: 'test',
          action: 'test',
          status: 200,
          event: 'request:onSuccess'
        },
        Date.now() - request.timestamp
      );

      sinon.spy(plugin.gateway, 'push');
      plugin.gateway.push.calledWith({jobName: 'kuzzle'});
    });

    it('should log an error if push to PushGateway fail', () => {
      plugin.config.pushGateway.host = 'http://aBadUrl:9091';
      request.init({
        input: { controller: 'test', action: 'test' },
        status: 200
      });
      plugin.requestInfo(request, 'request:onSuccess');

      sinon.spy(plugin.metrics.request, 'observe');
      plugin.metrics.request.observe.calledWith(
        {
          controller: 'test',
          action: 'test',
          status: 200,
          event: 'request:onSuccess'
        },
        Date.now() - request.timestamp
      );

      sinon.spy(plugin.gateway, 'push');
      plugin.gateway.push.threw();
    });
  });
});
