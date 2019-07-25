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

* [Kuzzle cluster mode](https://github.com/kuzzleio/kuzzle-plugin-cluster) compatibility.
* Event based monitoring using [Kuzzle Events](https://docs.kuzzle.io/core/1/plugins/guides/events/intro/).
* System metrics (CPU, RAM, I/O...).

### Kuzzle

Kuzzle is an open-source backend that includes a scalable server, a multiprotocol API,
an administration console and a set of plugins that provide advanced functionalities like real-time pub/sub, blazing fast search and geofencing.

* :octocat: __[Github](https://github.com/kuzzleio/kuzzle)__
* :earth_africa: __[Website](https://kuzzle.io)__
* :books: __[Documentation](https://docs.kuzzle.io)__
* :email: __[Gitter](https://gitter.im/kuzzleio/kuzzle)__

### Architecture

Each Kuzzle node expose a route `/metrics` which expose all nodes metrics. To do so, Redis is used to sync metrics data between nodes.
This mechanism make this plugin cluster compatible.

<p align="center">
  <img src="https://user-images.githubusercontent.com/7868838/60268822-979f9580-98ed-11e9-82b4-298edf8d7893.png"/>
</p>


### Installation

To install this plugin on your Kuzzle stack (for each of your Kuzzle nodes):

```
$ git clone https://github.com/kuzzleio/kuzzle-plugin-prometheus.git /path/to/your/kuzzle/plugins/available/kuzzle-plugin-prometheus
$ cd /path/to/your/kuzzle/plugins/available/kuzzle-plugin-prometheus && npm install
$ ln -sr ./ ../../enabled/kuzzle-plugin-prometheus && cd -
```

### Configuration

You can find sample configuration files for this plugin and the Prometheus scraping job in the `demo` folder.

#### Plugin

This plugin is configurable using the `kuzzlerc` Kuzzle configuration file.

```json
  "plugins": {
    "kuzzle-plugin-prometheus": {
      "syncInterval": 7500,
      "collectSystemMetrics": true,
      "systemMetricsInterval": 5000,
      "labels": {
        "common": [
          "nodeHost",
          "nodeMAC",
          "nodeIP"
        ],
        "kuzzle": [
          "controller",
          "action",
          "event",
          "status",
          "protocol"
        ]
      }
    }
  }
```

* `syncInterval`: Time interval in __milliseconds__ between two synchronizations with Redis.
* `collectSystemMetrics`: If set to true (default), collects system metrics.
* `systemMetricsInterval`: Time interval in __milliseconds__ between two system metrics polling.
* `labels`:
  * `common`: An array of labels added to every metrics, defaults to `['nodeHost', 'nodeMAC', 'nodeIP']`
  * `kuzzle`: 

#### Prometheus

```yaml
global:
  scrape_interval:     10s # Set the scrape interval to every 10 seconds. Default is every 1 minute.
  evaluation_interval: 15s # Evaluate rules every 15 seconds. The default is every 1 minute.

scrape_configs:
  - job_name: 'kuzzle'
    metrics_path: /_plugin/kuzzle-plugin-prometheus/metrics
    static_configs:
      - targets: ['kuzzleEndpoint:7512'] # 
```


### Demonstration

If you want to simply have a look to a sample Grafana dashboard run the demonstration stack:

```
$ docker-compose -f demo/docker-compose.yml up --scale kuzzle=3
```

This will start a demonstration stack composed with:
* A three nodes Kuzzle cluster behind an Nginx load balancer.
* A Prometheus container configured to scrap metrics.
* A Grafana container.

Once started, go to `http://localhost:3000` and log in with the default Grafana credentials:
* username: `admin`
* password: `admin`

When successfully logged in you can import demonstration dashboards from the `dashboards` folder.
To do so, hover on the `+` icon in the left sidebar, and click on `Import`. Then click on `Upload .json File` and choose the dashboard of your choice. Set up the targeted Prometheus to `Prometheus` and you're done.
Make several requests using Kuzzle's HTTP API or SDKs, or by using the Admin Console.

<p align="center">
  <img src="https://user-images.githubusercontent.com/7868838/60284159-2969cb80-990b-11e9-92bd-1e6156df0c2e.png"/>
  <img src="https://user-images.githubusercontent.com/7868838/60284165-2bcc2580-990b-11e9-89fb-3d0307265ea9.png"/>
</p>

