# Configuration reference

The plugin reads its configuration once, when Kuzzle starts. A change only takes effect after a restart of the node.

## Where the configuration lives

The configuration is the `plugins.prometheus` section of Kuzzle's configuration. `prometheus` is the plugin's name, inferred by Kuzzle from the `PrometheusPlugin` class. If you register the plugin under another name (`app.plugin.use(plugin, { name: "metrics" })`), its section is named after it (`plugins.metrics`).

Kuzzle builds its configuration with [`rc`](https://github.com/dominictarr/rc), so the section can come from either source below, the environment taking precedence over the file.

### `.kuzzlerc` file

```json
{
  "plugins": {
    "prometheus": {
      "core": { "prefix": "kuzzle_" },
      "labels": { "environment": "production" }
    }
  }
}
```

### Environment variables

The `kuzzle_` prefix, then the path in the configuration with `__` (two underscores) as the separator:

```sh
kuzzle_plugins__prometheus__core__monitorRequestDuration=false
kuzzle_plugins__prometheus__labels__environment=production
```

Kuzzle converts the values: `true` and `false` become booleans, digits become numbers, and a value starting with `*json:` is parsed as JSON, which is how to pass an array:

```sh
kuzzle_plugins__prometheus__default__gcDurationBuckets='*json:[0.001,0.01,0.1,1,2,5]'
```

A label value made of digits therefore becomes a number; Prometheus shows it as a string anyway.

## How the configuration is merged

What you provide is deep-merged over the defaults: a key you omit keeps its default, and you can set a single nested key without repeating the others. An array (`gcDurationBuckets`) replaces the default array as a whole. Then the plugin adds the `nodeId` label to `labels`.

## Keys

### `default`: Node.js metrics

The process and runtime metrics collected by [`prom-client`](https://github.com/siimon/prom-client#default-metrics). The full list is in [Metrics](metrics.md#nodejs-metrics).

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `default.enabled` | boolean | `true` | `false` disables every Node.js metric. |
| `default.prefix` | string | `""` | Prepended to every Node.js metric name. Empty by default, so that community Node.js dashboards, which use the unprefixed names (`nodejs_eventloop_lag_seconds`), work as is. |
| `default.eventLoopMonitoringPrecision` | number (ms) | `10` | Sampling rate of the event loop lag measure. Must be greater than zero. A lower value is more precise and costs more CPU. |
| `default.gcDurationBuckets` | number[] (seconds) | `[0.001, 0.01, 0.1, 1, 2, 5]` | Buckets of the `nodejs_gc_duration_seconds` histogram, in ascending order. Before 5.0.0, a list shorter than the default kept the default's tail. |

### `core`: Kuzzle metrics and request duration

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `core.prefix` | string | `"kuzzle_"` | Prepended to the Kuzzle metrics and to the request duration histogram (`kuzzle_api_pending_requests`, `kuzzle_api_request_duration_ms`). The shipped Grafana dashboards expect `kuzzle_`. |
| `core.monitorRequestDuration` | boolean | `true` | Records the duration of every API request in the `<prefix>api_request_duration_ms` histogram. `false` removes the histogram and stops listening to request events, which saves a little work per request. Before 5.0.0, `false` made Kuzzle log an error on every request. |

The Kuzzle metrics themselves (`api_*`, `network_*`, `realtime_*`) cannot be disabled: they are what the plugin is for.

The request duration buckets are fixed: `[0.1, 5, 15, 50, 100, 200, 300, 400, 500]` milliseconds. Making them configurable is tracked by [ADR-0002](adr-002/ADR-0002-generic-prometheus-module.md).

### `labels`: labels added to every series

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `labels` | object of strings | `{}` | Each key/value pair becomes a label on every series of the node: Kuzzle metrics, request histogram and Node.js metrics. |

Typical use: tell environments, projects or regions apart when one Prometheus scrapes several Kuzzle stacks.

```json
{ "labels": { "environment": "production", "region": "eu-west-1" } }
```

Rules:

- Label names must be valid Prometheus label names: letters, digits and underscores, not starting with a digit, and not starting with `__` (reserved by Prometheus).
- Do not use `nodeId`: the plugin always sets it to the Kuzzle node ID and overwrites yours.
- Do not use the names the plugin already puts on some metrics: `protocol`, `controller`, `action`, `status`. They would collide with the metric's own labels.
- Keep the values fixed for the life of the process. Each distinct set of label values is a new series in Prometheus.

## Full example

The defaults, plus two labels:

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

## TypeScript

The configuration type is exported as `PrometheusPluginConfiguration`:

```typescript
import { PrometheusPluginConfiguration } from "kuzzle-plugin-prometheus";
```
