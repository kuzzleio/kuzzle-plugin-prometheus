class RequestMock {
  constructor() {
    this.context = {};
    this.input = {};
    this.result = {};
    this.response = {};
    this.timestamp = Date.now()
  }

  init(args) {
    Object.keys(args).forEach((key) => {
      this[key] = args[key];
    });
  }
}

module.exports = RequestMock;
