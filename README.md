# Kuzzle Prometheus plugin

[![npm](https://img.shields.io/npm/v/kuzzle-plugin-prometheus.svg)](https://www.npmjs.com/package/kuzzle-plugin-prometheus)
[![license](https://img.shields.io/github/license/kuzzleio/kuzzle-plugin-prometheus.svg)](LICENSE)

Exposes the metrics of a [Kuzzle](https://github.com/kuzzleio/kuzzle) node in the [Prometheus](https://prometheus.io) text format, so that Prometheus can scrape them and Grafana can chart them.

Since 5.1, this package is the Kuzzle plugin of [**`kuzzle-prometheus`**](https://github.com/kuzzleio/kuzzle-prometheus), under its historical name: the code and the reference documentation live there. This repository keeps the [integration guide](docs/kuzzle-stack.md) for a full Kuzzle stack, the Grafana dashboards and a local demo stack.

| Family | What it measures | Example |
| --- | --- | --- |
| Kuzzle metrics | Kuzzle's `server:metrics`: requests in progress and waiting, connections per protocol, realtime rooms and subscriptions | `kuzzle_api_pending_requests` |
| Request duration | a histogram of every API request, per controller, action, protocol and status | `kuzzle_api_request_duration_ms` |
| Node.js metrics | CPU, memory, event loop, garbage collection, heap | `nodejs_eventloop_lag_seconds` |
| Application metrics | the counters, gauges and histograms your application declares | `iot_payloads_received_total` |

## Quick start

```sh
npm install kuzzle-plugin-prometheus
```

```typescript
import { Backend } from "kuzzle";
import { PrometheusPlugin } from "kuzzle-plugin-prometheus";

const app = new Backend("my-application");

app.plugin.use(new PrometheusPlugin());

app.start();
```

```sh
curl "http://localhost:7512/_metrics?format=prometheus"
```

Then follow the [integration guide](docs/kuzzle-stack.md): scraper rights, Prometheus jobs for one node, a cluster or Kubernetes, and the Grafana dashboards.

## Compatibility

| Plugin | Kuzzle | Node.js |
| --- | --- | --- |
| **5.1+** | `>=2.59.0 <3.0.0` | `^22.12.0`, `^24.0.0` |
| 5.0 | `>=2.59.0 <3.0.0` | `^20.19.0`, `^22.12.0`, `^24.0.0` |
| 4.x | `>=2.16.9 <3.0.0` | the versions supported by that Kuzzle |

Metric names, routes and configuration keys are the same from 4.x to 5.x: see [Upgrading](docs/upgrading.md).

## Documentation

| Document | Content |
| --- | --- |
| [Integration guide](docs/kuzzle-stack.md) | register the plugin, rights, Prometheus, Kubernetes, Grafana dashboards |
| [Kuzzle plugin](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/kuzzle.md) (`kuzzle-prometheus`) | configuration, labels, application metrics |
| [Kuzzle metrics reference](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/kuzzle-metrics.md) (`kuzzle-prometheus`) | every metric, PromQL examples |
| [Troubleshooting](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/troubleshooting.md) (`kuzzle-prometheus`) | symptoms, causes and fixes |
| [Upgrading](docs/upgrading.md) | 5.0 → 5.1, 4.x → 5.x, 3.x → 4.x |
| [Development](docs/development.md) | local stack, tests, releases |

The `kuzzle-prometheus` documentation also ships in `node_modules/kuzzle-prometheus/docs/`, with a guide for AI agents adding metrics to an application (`docs/agents.md`).

Design decisions and their history are recorded as ADRs under [`docs/adr-001/`](docs/adr-001) and onwards.

## License

[Apache-2.0](LICENSE)
