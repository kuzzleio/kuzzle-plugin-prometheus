const PrometheusPlugin = require('../lib/PrometheusPlugin'),
  ContextMock = require('./mocks/context.mock'),
  RequestMock = require('./mocks/request.mock'),
  sinon = require('sinon'),
  should = require('should');

describe('PrometheusPlugin', () => {
  let contextMock, plugin, request;

  beforeEach(() => {
    contextMock = new ContextMock();
    plugin = new PrometheusPlugin({}, contextMock);
    request = new RequestMock({
      response: {
        setHeader: sinon.stub()
      }
    });
  });

  describe('#metrics', () => {
    it('returns a Prometheus formatted response', async () => {
      const response = await plugin.metrics(request);

      should(request.response.setHeader).be.calledOnce();
      should(response).match(response, sinon.match.any);
    });
  });
});
