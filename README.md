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

### Compatibility matrice

| Kuzzle Version | Plugin Version |
| -------------- | -------------- |
| 1.10.x         | 1.x.x          | 
| 2.x.x          | 2.x.x          |
| 3.x.x          | >= 2.11.x      |
| 4.x.x          | >= 2.16.0      |

### Installation

To install this plugin on your Kuzzle stack (for each of your Kuzzle nodes),
you will first need a Kuzzle Application like so. (see [Getting Started](/core/2/guides/getting-started))

```typescript
import { Backend } from 'kuzzle';

const app = new Backend('kuzzle');

app.start()
  .then(() => {
    app.log.info('Application started');
  })
  .catch(console.error);
```

Once you have it, you will need to:
- Import the Prometheus plugin,
- Create a new instance of the plugin
- And then use it in your application.
  
You will end up with something like this:

```typescript
import { Backend } from 'kuzzle';
import { PrometheusPlugin } from 'kuzzle-plugin-prometheus'; // Import the prometheus plugin

const app = new Backend('kuzzle');

const prometheusPlugin = new PrometheusPlugin(); // Create a new instance of the prometheus plugin

app.plugin.use(prometheusPlugin); // Add the plugin to your application

app.start()
  .then(() => {
    app.log.info('Application started');
  })
  .catch(console.error);

```


### Configuration

You can find sample configuration files for this plugin and the Prometheus scraping job in the `demo` folder.

#### Plugin

This plugin is configurable using the `kuzzlerc` Kuzzle configuration file.

```json
 {
 "plugins": {
    "prometheus": {
      "default": {
        "enabled": true,
        "prefix": "kuzzle_",
        "eventLoopMonitoringPrecision": 10,
        "gcDurationBuckets": [0.001, 0.01, 0.1, 1, 2, 5]
      },
      "core": {
        "monitorRequestDuration": true,
        "prefix": "kuzzle_"
      }
    }
  }
}
```

* `default`: Default Node.js metrics retrieved by [the Prom Client library](https://github.com/siimon/prom-client/tree/master/lib/metrics)
  * `enabled`: Enable/Disable the default Node.js metrics (default: `true`)
  * `prefix`: String to use to prefix metrics name (default: `kuzzle_`)
  * `eventLoopMonitoringPrecision`: Node.js Event Loop sampling rate in milliseconds. Must be greater than zero (default: `10`)
  * `gcDurationBuckets`: Custom Prometheus buckets for Node.js GC duration histogram in seconds (default: `[0.001, 0.01, 0.1, 1, 2, 5]`)
* `core`: Kuzzle Core metrics directly extract from the `server:metrics` API action or from plugin inner logic.
  * `monitorRequestDuration`: Enable/Disable request duration sampling (default: `true`)
  * `prefix`: String to use to prefix metrics name (default: `kuzzle_`) 

#### Prometheus

```yaml
global:
  scrape_interval:     10s # Set the scrape interval to every 10 seconds. Default is every 1 minute.
  evaluation_interval: 15s # Evaluate rules every 15 seconds. The default is every 1 minute.

scrape_configs:
  - job_name: 'kuzzle'
    metrics_path: /_metrics
    params:
      format: ['prometheus']
    static_configs:
      - targets: ['kuzzle:7512'] # the address of an application that exposes metrics for prometheus

```


### Local development

You can run a local development stack using Docker Compose

```
$ docker-compose up
```

This will start a demonstration stack composed with:
* A scalable Kuzzle cluster using the Docker Compose option `--scale kuzzle=<number-of-replicas>` proxified by a Traefik router
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

