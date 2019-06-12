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

- [x] `request`: Request information for the associated event.
- [ ] `stats`: Statistical information about Kuzzle (active connections, ongoing requests per protocols...).
- [ ] `cluster`: State of Kuzzle nodes.


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
      "monitoring": {
        "request": [
          "request:onSuccess",
          "request:onError"
        ]
      }
    }
  }
```

#### `pushGateway`

| Field | Type | Description |
|---|---|---|
| `host`  | `String`  | Prometheus PushGateway host URL (including port)  |
| `jobName`  | `String`  | Prometheus job name used to group metrics  |

#### `monitoring`

| Field | Type | Description |
|---|---|---|
| `request`  | `Array`  |  [Kuzzle Events](https://next-docs.kuzzle.io/core/1/plugins/guides/events/intro/) to monitor|


### Demonstration

If you want to simply have a look to a sample Grafana dashboard run the demonstration stack:

```
$ docker-compose -f demo/docker-compose.yml up
```

Once started, go to `http://localhost:3000` and log in with default Grafana credentials:
* username: `admin`
* password: `admin`

When successfully logged in you can now import demonstration dashboards from `demo/dashboards` folder.
To do so, hover on `+` icon in left sidebar and click on `Import`.Then click on `Upload .json File` and choose the dashboard of your choice. Set up the targeted Prometheus to `Prometheus` and you're done.
Make several requests using Kuzzle HTTP API, SDKs or by browsering it with the Admin Console.

<p align="center">
  <img src="https://user-images.githubusercontent.com/7868838/59320124-7aec4680-8ccd-11e9-8fb8-3864c9d8d60f.png"/>
</p>

