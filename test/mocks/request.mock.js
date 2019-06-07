class RequestMock {
  constructor() {
    this.timestamp = Date.now()
    this.context = {};
    this.context.user = {};
    this.context.connection = {};

    this.input = {};
    this.input.body = {};
    this.input.args = {};

    this.result = {};
    this.response = {};
  }
}

module.exports = RequestMock;
