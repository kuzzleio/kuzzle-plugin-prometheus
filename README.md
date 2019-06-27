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

* Event based monitoring using Kuzzle Events.
* System metrics (CPU, RAM, I/O...).
* [Kuzzle cluster mode](https://github.com/kuzzleio/kuzzle-plugin-cluster) compatibility.

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

You can find sample configuration files for this plugin and Prometheus scraping job in `demo` folder.

#### Plugin

This plugin is configurable using the Kuzzle configuration file `kuzzlerc`.

```json
  "plugins": {
    "kuzzle-plugin-prometheus": {
      "syncInterval": 7500,
      "systemMetricsInterval": 5000
    }
  }
```

The two available options are:
* `syncInterval`: Time interval in __milliseconds__ between two synchronization with Redis.
* `systemMetricsInterval`: Time interval in __milliseconds__ between two system metrics polling.

#### Prometheus

```yaml
global:
  scrape_interval:     5s # Set the scrape interval to every 15 seconds. Default is every 1 minute.
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
* A three node Kuzzle cluster behind an Nginx load balancer.
* A Prometheus container configured to scrap metrics.
* A Grafana container.

Once started, go to `http://localhost:3000` and log in with default Grafana credentials:
* username: `admin`
* password: `admin`

When successfully logged in you can now import demonstration dashboards from `dashboards` folder.
To do so, hover on `+` icon in left sidebar and click on `Import`.Then click on `Upload .json File` and choose the dashboard of your choice. Set up the targeted Prometheus to `Prometheus` and you're done.
Make several requests using Kuzzle HTTP API, SDKs or by browsering it with the Admin Console.

<p align="center">
  <img src="https://user-images.githubusercontent.com/7868838/60273315-2d3f2300-98f6-11e9-8829-215d7c079eba.png"/>
</p>

