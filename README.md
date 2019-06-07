<p align="center">
  <img src="https://user-images.githubusercontent.com/7868838/58807296-115aa100-8618-11e9-910f-8e2e1f3a893d.png"/>
</p>
<p align="center">
  <a href="https://david-dm.org/kuzzleio/kuzzle-plugin-prometheus">
    <img src="https://david-dm.org/kuzzleio/kuzzle-plugin-prometheus.svg" />
  </a>
  <a href="https://travis-ci.com/kuzzleio/kuzzle-plugin-prometheus">
    <img alt="undefined" src="https://travis-ci.com/kuzzleio/kuzzle-plugin-prometheus.svg?branch=master">
  </a>
  <a href="https://codecov.io/gh/kuzzleio/kuzzle-plugin-prometheus">
    <img src="https://codecov.io/gh/kuzzleio/kuzzle-plugin-prometheus/branch/master/graph/badge.svg" />
  </a>
  <a href="https://github.com/kuzzleio/kuzzle-plugin-prometheus/blob/master/LICENSE">
    <img alt="undefined" src="https://img.shields.io/github/license/kuzzleio/kuzzle-plugin-prometheus.svg?style=flat">
  </a>
</p>


## About

### Kuzzle Prometheus Plugin

This is the official Prometheus monitoring plugin for the free and open-source backend Kuzzle.
It provides you features such as:
* Event based monitoring.
* [Kuzzle cluster mode](https://github.com/kuzzleio/kuzzle-plugin-cluster) compatibility.

### Kuzzle

Kuzzle is an open-source backend that includes a scalable server, a multiprotocol API,
an administration console and a set of plugins that provide advanced functionalities like real-time pub/sub, blazing fast search and geofencing.

* :octocat: __[Github](https://github.com/kuzzleio/kuzzle)__
* :earth_africa: __[Website](https://kuzzle.io)__
* :books: __[Documentation](https://docs.kuzzle.io)__
* :email: __[Gitter](https://gitter.im/kuzzleio/kuzzle)__

### Architecture

Metrics are pushed from each node to the Prometheus PushGateway. 
<p align="center">
  <img src="https://user-images.githubusercontent.com/7868838/59284145-0b923a80-8c6c-11e9-8267-56deac4ac78f.png"/>
</p>


### Installation

To install this plugin on your Kuzzle stack (for each of your Kuzzle nodes):

```
$ git clone https://github.com/kuzzleio/kuzzle-plugin-prometheus.git /path/to/your/kuzzle/plugins/available/kuzzle-plugin-prometheus
$ cd /path/to/your/kuzzle/plugins/available/kuzzle-plugin-prometheus && npm install
$ ln -sr ./ ../../enable/kuzzle-plugin-prometheus && cd -
```

### Metrics
#### `requestCount`
Count the number of request for the associated event.

#### `requestLatency`
Monitor the response time for the associated event (only relevant for requests post-processing events such as `request:onSuccess`, `request:onError`, `document:afterCreate`...

> If you have idea for new metrics do not hesitate to open an issue.

### Configuration

This plugin is configurable using the Kuzzle configuration file `kuzzlerc`.
```json
  "plugins": {
    "kuzzle-plugin-prometheus": {
      "pushGateway": {
        "host": "http://pushgateway:9091",
        "jobName": "kuzzle"
      },
      "monitoredEvents": [
        {
          "name": "request:onSuccess",
          "metrics": ["requestCount", "requestLatency"]
        },
        {
          "name": "request:onError",
          "metrics": ["requestCount"]
        }
      ]
    }
  }
```

#### `pushGateway`

| Field | Type | Description |
|---|---|---|
| `host`  | `String`  | Prometheus PushGateway host URL (including port)  |
| `jobName`  | `String`  | Prometheus job name used to group metrics  |

#### `monitoredEvents`

| Field | Type | Description |
|---|---|---|
| `name`  | `String`  |  [Kuzzle Event](https://next-docs.kuzzle.io/core/1/plugins/guides/events/intro/) to monitor   |
| `metrics`  | `Array`  | [Metrics](#metrics) to monitor for the associated event  |


