# Kuzzle Prometheus plugin

[![npm](https://img.shields.io/npm/v/kuzzle-plugin-prometheus.svg)](https://www.npmjs.com/package/kuzzle-plugin-prometheus)
[![license](https://img.shields.io/github/license/kuzzleio/kuzzle-plugin-prometheus.svg)](LICENSE)

Exposes the metrics of a [Kuzzle](https://github.com/kuzzleio/kuzzle) node in the [Prometheus](https://prometheus.io) text format, so that Prometheus can scrape them and Grafana can chart them.

On each Kuzzle node, the plugin publishes three families of metrics:

| Family | What it measures | Example |
| --- | --- | --- |
| Kuzzle metrics | the values of Kuzzle's `server:metrics` API action: requests in progress and waiting, connections per protocol, realtime rooms and subscriptions | `kuzzle_api_pending_requests` |
| Request duration | a histogram of the duration of every API request, per controller, action, protocol and status | `kuzzle_api_request_duration_ms` |
| Node.js metrics | the process and runtime metrics of [`prom-client`](https://github.com/siimon/prom-client): CPU, memory, event loop lag, garbage collection, heap | `nodejs_eventloop_lag_seconds` |

Every series carries a `nodeId` label, plus the labels you configure.

## Contents

- [Compatibility](#compatibility)
- [Installation](#installation)
- [Minimal configuration](#minimal-configuration)
- [Scraping with Prometheus](#scraping-with-prometheus)
- [Grafana dashboards](#grafana-dashboards)
- [Reference documentation](#reference-documentation)
- [License](#license)

## Compatibility

| Plugin | Kuzzle | Node.js |
| --- | --- | --- |
| **5.x** | `>=2.59.0 <3.0.0` | `^20.19.0`, `^22.12.0`, `^24.0.0` |
| 4.x | `>=2.16.9 <3.0.0` | the versions supported by that Kuzzle |

Version 5.0.0 changes neither the metrics nor the configuration of 4.x: see [the upgrade guide](docs/upgrading.md).

The Node.js floors are not arbitrary: Kuzzle 2.59 loads an ESM-only dependency with `require()`, which Node.js supports from 20.19.0 and 22.12.0 only.

## Installation

The plugin is a [Kuzzle application plugin](https://docs.kuzzle.io/core/2/guides/write-plugins/start-writing-plugins/): install it in your application, then register it **before** `app.start()`.

```sh
npm install kuzzle-plugin-prometheus
```

`kuzzle` is a peer dependency: your application provides it, in a version within `>=2.59.0 <3.0.0`. A Kuzzle outside that range refuses to load the plugin.

```typescript
import { Backend } from "kuzzle";
import { PrometheusPlugin } from "kuzzle-plugin-prometheus";

const app = new Backend("my-application");

app.plugin.use(new PrometheusPlugin());

app
  .start()
  .then(() => app.log.info("Application started"))
  .catch(console.error);
```

Do this on **every** Kuzzle node: each node exposes only its own metrics (see [Deployment](docs/deployment.md)).

Once Kuzzle has started, check that the metrics are served:

```sh
curl "http://localhost:7512/_metrics?format=prometheus"
```

The answer is plain text (`Content-Type: text/plain; version=0.0.4`) starting with `# HELP kuzzle_api_concurrent_requests`. If you get JSON instead, see [Troubleshooting](docs/troubleshooting.md).

## Minimal configuration

The plugin works without configuration. To change it, add a `plugins.prometheus` section to your `.kuzzlerc` file. These are the defaults, plus two custom labels:

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
      },
      "labels": {
        "environment": "production",
        "project": "my-project"
      }
    }
  }
}
```

Every key is optional. Their meaning, their defaults, and how to set them through environment variables are detailed in [the configuration reference](docs/configuration.md).

## Scraping with Prometheus

The metrics are served on two HTTP routes, with the same content:

| Route | When to use it |
| --- | --- |
| `GET /_metrics?format=prometheus` | the default; Kuzzle's `server:metrics` action, converted by the plugin |
| `GET /_/metrics` | when the scraper cannot send query parameters, such as Kubernetes `prometheus.io/*` annotations |

A minimal Prometheus job for one node:

```yaml
scrape_configs:
  - job_name: kuzzle
    metrics_path: /_metrics
    params:
      format: ["prometheus"]
    static_configs:
      - targets: ["kuzzle:7512"]
```

With several nodes, list **each node** as a target: never scrape through a load balancer, which would return a random node at each scrape. Authentication, Docker Compose, Kubernetes and cluster setups are covered in [Deployment](docs/deployment.md).

## Grafana dashboards

Two dashboards ship in [`config/grafana/dashboards/`](config/grafana/dashboards), both with a `nodeId` filter:

- `demo.json` (dashboard "Kuzzle"): active connections per node and per protocol, concurrent and pending requests, realtime subscriptions, requests per node and per API action, response latency per node and per API action, 5xx errors per node and per API action;
- `nodejs.json` (dashboard "NodeJS process"): CPU, event loop lag, Node.js version, restarts, memory, active handles and requests, heap per space.

Import them through the Grafana UI, its API, or its provisioning system, as the [local stack](docs/development.md#local-stack) does. They expect the default prefixes (`kuzzle_` for Kuzzle metrics, none for Node.js metrics).

## Reference documentation

| Document | Content |
| --- | --- |
| [Configuration](docs/configuration.md) | every configuration key, its default, its effect, and environment variables |
| [Metrics](docs/metrics.md) | every metric: type, labels, unit, source, and PromQL examples |
| [Deployment](docs/deployment.md) | routes and permissions, authentication, single node, cluster, Docker Compose, Kubernetes |
| [Troubleshooting](docs/troubleshooting.md) | symptoms, causes and fixes |
| [Development](docs/development.md) | local stack, tests, commit convention and release channels |
| [Upgrading](docs/upgrading.md) | 4.x → 5.x and 3.x → 4.x |

Design decisions and their history are recorded as ADRs under [`docs/adr-001/`](docs/adr-001) and onwards.

## License

[Apache-2.0](LICENSE)
