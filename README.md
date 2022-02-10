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

- [About](#about)
  - [Kuzzle Prometheus Plugin](#kuzzle-prometheus-plugin)
  - [Kuzzle](#kuzzle)
  - [Compatibility matrix](#compatibility-matrix)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Plugin](#plugin)
  - [Prometheus](#prometheus)
    - [With only one Kuzzle node](#with-only-one-kuzzle-node)
    - [With an authentified user](#with-an-authentified-user)
    - [With multiple Kuzzle nodes and using Docker Compose](#with-multiple-kuzzle-nodes-and-using-docker-compose)
    - [Using Kubernetes annotations](#using-kubernetes-annotations)
  - [Dashboards](#dashboards)
    - [Features](#features)
    - [Screenshots](#screenshots)
- [Local development](#local-development)
- [Migrations](#migrations)
  - [From version 3.x to 4.x](#from-version-3x-to-4x)
    - [Migration steps](#migration-steps)

# About

## Kuzzle Prometheus Plugin

This is the official Prometheus monitoring plugin for the free and open-source backend Kuzzle.
It provides you features such as:

* [Kuzzle cluster mode](https://github.com/kuzzleio/kuzzle-plugin-cluster) compatibility.
* Event based monitoring using [Kuzzle Events](https://docs.kuzzle.io/core/1/plugins/guides/events/intro/).
* System metrics (CPU, RAM, I/O...).

## Kuzzle

Kuzzle is an open-source backend that includes a scalable server, a multiprotocol API,
an administration console and a set of plugins that provide advanced functionalities like real-time pub/sub, blazing fast search and geofencing.

* :octocat: __[Github](https://github.com/kuzzleio/kuzzle)__
* :earth_africa: __[Website](https://kuzzle.io)__
* :books: __[Documentation](https://docs.kuzzle.io)__
* :email: __[Gitter](https://gitter.im/kuzzleio/kuzzle)__

## Compatibility matrix

| Kuzzle Version | Plugin Version |
| -------------- | -------------- |
| 1.10.x         | 1.x.x          | 
| 2.x.x          | 2.x.x          |
| >= 2.11.x      | 3.x.x          |
| >= 2.16.0      | 4.x.x          |

# Installation

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

# Configuration

You can find sample configuration files for this plugin and the Prometheus scraping job in the `demo` folder.

## Plugin

This plugin is configurable using the `kuzzlerc` Kuzzle configuration file.

```json
 {
 "plugins": {
    "prometheus": {
      "default": {
        "enabled": true,
        "prefix": "",
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
  * `prefix`: String to use to prefix metrics name (default: an empty string to avoid conflicts when using official Grafana dashboards)
  * `eventLoopMonitoringPrecision`: Node.js Event Loop sampling rate in milliseconds. Must be greater than zero (default: `10`)
  * `gcDurationBuckets`: Custom Prometheus buckets for Node.js GC duration histogram in seconds (default: `[0.001, 0.01, 0.1, 1, 2, 5]`)
* `core`: Kuzzle Core metrics directly extract from the `server:metrics` API action or from plugin inner logic.
  * `monitorRequestDuration`: Enable/Disable request duration sampling (default: `true`)
  * `prefix`: String to use to prefix metrics name (default: `kuzzle_`) 

## Prometheus

### With only one Kuzzle node

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

### With an authentified user
If you use an other user than `anonymous` to expose the `server:metrics` API action, you will need to create a Kuzzle API Key (see [API Keys](https://docs.kuzzle.io/core/2/guides/advanced/api-keys/)) and use it to authentify the Prometheus scaper:

```yaml
global:
  scrape_interval:     10s # Set the scrape interval to every 10 seconds. Default is every 1 minute.
  evaluation_interval: 15s # Evaluate rules every 15 seconds. The default is every 1 minute.

scrape_configs:
  - job_name: 'kuzzle'
    metrics_path: /_metrics
    params:
      format: ['prometheus']
    authorization:
      type: 'Bearer'
      credentials: 'my-api-key'
    static_configs:
      - targets: ['kuzzle:7512'] # the address of an application that exposes metrics for prometheus
```

### With multiple Kuzzle nodes and using Docker Compose
If you use Docker Compose you'll need to provide the IP/Docker DNS name of each Kuzzle node as `targets`:

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
      - targets: 
        - 'kuzzle-plugin-prometheus-kuzzle-1:7512' 
        - 'kuzzle-plugin-prometheus-kuzzle-2:7512'
        - 'kuzzle-plugin-prometheus-kuzzle-3:7512'
```

### Using Kubernetes annotations

If your Prometheus inside a Kubernetes cluster, you must use the helper HTTP route `/_/metrics` since Prometheus `params` configuration is not supported.
Your Pods annotations should look like this:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/path: /_/metrics
    prometheus.io/port: "7512"
spec:
...
```

## Dashboards

### Features

You could find two dashboards in the `config/grafana/dashboards` folder:
- `kuzzle.json`: a dashboard with all the metrics exposed by the `server:metrics` API action with a `nodeId` filter and including:
  - Active connections
  - Active Realtime subscriptions
  - Concurrent requests
  - Pending requests
  - Request per second
  - Request duration
  - Internal Errors

- `nodejs.json`: Node.js metrics dashboard with a `nodeId` filter and including:
  - Process CPU Usage
  - Process Memory Usage
  - Process Restarts
  - Event Loop Latency
  - Heap Usage

You can import them both using the Grafana API, Web UI or the provisionning system (see the `docker-compose.yml` file).

### Screenshots
<p align=center>
<b>Kuzzle dashboard</b>
<img width="1994" alt="image" src="https://user-images.githubusercontent.com/7868838/150335493-413808e8-d65a-4de9-a01f-34634c751e45.png">
</p>
<p align=center>
<b>Node.js dashboard</b>
<img width="1973" alt="image" src="https://user-images.githubusercontent.com/7868838/150334423-5763ac48-f6ea-444f-ab78-2f776a9925a6.png">
</p>


# Local development

You can run a local development stack using Docker Compose

```
$ docker-compose up
```

This will start a demonstration stack composed with:
* A Kuzzle server proxified by a Traefik router
* A Prometheus container configured to scrap metrics.
* A Grafana container.

Once started, go to `http://localhost:3000` and log in with the default Grafana credentials:
* username: `admin`
* password: `admin`

Make several requests using Kuzzle's HTTP API or SDKs, or by using the Admin Console.

> NOTE: You can also increase the number of Kuzzle nodes to test a cluster configuration.
> Use the Docker Compose `--scale` option to increase the number of replicas:
> ```
> docker-compose up -d --scale kuzzle=<number-of-replicas>
> ```
> Notice that you need to update the `config/prometheus.yml` file to reflect the new number of nodes and restart the prometheus container using `docker restart <prometheus-container-id>`

# Migrations

## From version 3.x to 4.x

This new version 4.0.0 introduce numerous changes in the way metrics are collected and reported:
- The plugin now uses the `server:metrics` API action to retrieve metrics from Kuzzle Core. Calling the `server:metrics` API action with the `format` parameter set to `prometheus` will return metrics in the Prometheus format.
- The configuration of the plugin is now more flexible (see [Configuration](#configuration) section for more details):
  - More control on the default Node.js metrics (set the Event Loop sample precision to custom value or adapt the Garbage Collector Prometheus bucket rates to fit your usecase).
  - You can set different prefixes for Kuzzle Core metrics and Node.js metrics.
  - The `nodeIP`, `nodeMAC` and `nodeHost` labels have beem removed in favor of the `nodeId` label.
  - You can now disable the request recording job.
- Most of the metric names have been changed to be more consistent with Kuzzle Core metrics.

### Migration steps

<details>
  <summary>
    Allow the user used by Prometheus to access <code>server:metrics</code> API action
  </summary>
  <p>
    Add the following rule to your user role to allow the user <code>anonymous</code> to access the <code>server:metrics</code> API action:
  </p>
  <pre>
{
  "controllers": {
    // Your others controllers rules
    "server": {
      "actions": {
        "metrics": true,
        // ...
      }
    }
  }
}
  </pre>
</details>

<details>
  <summary>
    Update the plugin configuration
  </summary> 
  <p>
    Here is the new default configuration file:
  </p>
  <pre>
 {
 "plugins": {
    "prometheus": {
      "default": {
        "enabled": true,
        "prefix": "",
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
  </pre>
</details>

<details>
  <summary>
    Update your dashboards
  </summary>
  <p>
    If you have previously imported the example Grafana dashboard, you will have to update it to use the new metrics names or use the new ones located in <code>config/grafana/dashboards</code>.
  </p>
</details>
