const 
  RequestMock = require('./request.mock'),
  KuzzleError = require('kuzzle-common-objects').error,
  sinon = require('sinon');

class ContextMock {
  constructor() {
    this.accessors = {
      sdk: {
        ms: {
          mget: sinon.stub(),
          set: sinon.stub().resolves(),
          scan: sinon.stub(),
          incr: sinon.stub().resolves()
        },
      }
    };

    this.errors = KuzzleError;

    this.constructors = {
      Request: RequestMock
    };

    this.log = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    };
  }
}

module.exports = ContextMock;
