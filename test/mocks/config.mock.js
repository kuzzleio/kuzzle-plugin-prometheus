
class ConfigurationMock {
  constructor() {
    this.pushGateway = {
      host: 'http://pushgateway:9091',
      jobName: 'kuzzle'
    };
    this.monitoring = {
      request: [
        'request:onSuccess',
        'request:onError'
      ] 
    }
  }
}

module.exports = ConfigurationMock;
