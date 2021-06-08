class RequestMock {
  constructor() {
    this.context = {};
    this.input = {};
    this.result = {};
    this.response = {};
    this.timestamp = Date.now()
  }
  
  init(args) {
    Object.assign(this, args);
  }
}
  
module.exports = RequestMock;
  