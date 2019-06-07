
class ConfigurationMock {
  constructor() {
    this.pushGateway = {
      host: 'http://pushgateway:9091',
      jobName: 'kuzzle'
    };
    this.monitoredEvents = [
      {
        name: 'request:onSuccess',
        metrics: ['requestCount', 'requestLatency']
      },
      {
        name: 'request:onError',
        metrics: ['requestCount']
      }
    ];
  }
}

module.exports = ConfigurationMock;
