# Upgrading

## From 5.0 to 5.1

The plugin's code moved to [`kuzzle-prometheus`](https://github.com/kuzzleio/kuzzle-prometheus) (its `kuzzle-prometheus/kuzzle` entry point); this package re-exports it. Metric names, routes, configuration keys and their defaults do not change.

### What changes

| | 5.0 | 5.1 |
| --- | --- | --- |
| Node.js | `^20.19.0`, `^22.12.0` or `^24.0.0` | `^22.12.0` or `^24.0.0` |
| Prometheus client | `prom-client` 15.1.3 | `@prometheus-io/client` 0.16 (its successor), through `kuzzle-prometheus` |
| Request duration buckets | fixed | `core.requestDurationBuckets` (same default) |
| Application metrics | not supported | `plugin.metrics.counter()` / `gauge()` / `histogram()`, see [Kuzzle plugin → Application metrics](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/kuzzle.md#application-metrics) |
| Common labels | — | `labels.project` / `environment` / `service`, or the `KUZZLE_PROMETHEUS_*` variables |

New series, which do not affect existing dashboards: `nodejs_eventloop_utilization_summary` and `nodejs_eventloop_utilization_histogram`, and `kuzzle_prometheus_label_sets_rejected_total` once an application metric drops label combinations.

The order of the labels in the text output of the histograms changed (`nodeId` and your labels before `action`, `controller`…). Prometheus identifies a series by its label set: queries, dashboards and alerts are not affected; only a tool comparing raw text lines would be.

### Steps

1. **Node.js**: run Kuzzle on Node.js 22.12+ or 24. To stay on Node.js 20, pin `kuzzle-plugin-prometheus@~5.0`.
2. **Plugin**: `npm install kuzzle-plugin-prometheus@^5.1`. The code registering the plugin and its configuration stay the same.
3. **Check**: `curl "http://<node>:7512/_metrics?format=prometheus"` on each node returns the same metric names as before.

New applications can depend on `kuzzle-prometheus` and import `PrometheusPlugin` from `kuzzle-prometheus/kuzzle`: it is the same class.

## From 4.x to 5.x

Version 5.0.0 is a maintenance release. It is a major version because it raises the runtime requirements; the plugin's behaviour, metrics and configuration do not change.

### What changes

| | 4.x | 5.x |
| --- | --- | --- |
| Node.js | not declared | `^20.19.0`, `^22.12.0` or `^24.0.0` (`engines`) |
| Kuzzle | `>=2.16.9 <3`, checked at load only | `>=2.59.0 <3.0.0`, checked at load and declared as a **peer dependency** |
| `prom-client` | 15.1.0 | 15.1.3 |
| npm publication | manual, with a token | semantic-release with trusted publishing: each version has a provenance attestation and a GitHub release |

### What does not change

- Metric names, types, labels and the request duration buckets: dashboards and alerts keep working.
- Configuration keys and their defaults.
- The routes `/_metrics?format=prometheus` and `/_/metrics`, and the rights they need.

### Fixed

- `core.monitorRequestDuration: false` no longer makes Kuzzle log `Error executing hook on "request:onSuccess"` on every request.
- `default.gcDurationBuckets` replaces the default buckets. In 4.x, it was merged index by index with them: `[0.5, 3]` gave `[0.5, 3, 0.1, 1, 2, 5]`. If you set it, check the buckets you get.

### Steps

1. **Node.js**: run Kuzzle on Node.js 20.19+, 22.12+ or 24. Kuzzle 2.59 itself requires it: on an older 20.x or 22.x it fails at startup with `ERR_REQUIRE_ESM`. With Docker, the `kuzzleio/kuzzle-runner:<major>-trixie-slim` images fit; the bookworm-based ones cannot run Kuzzle 2.59 on Node 20 or 22 (glibc too old for uWebSockets.js).
2. **Kuzzle**: upgrade your application to Kuzzle 2.59.0 or a later 2.x. Your application provides `kuzzle`, as with 4.x; npm 7 and later now refuse to install the plugin (`ERESOLVE`) next to a Kuzzle outside the peer range.
3. **Plugin**:

   ```sh
   npm install kuzzle-plugin-prometheus@^5
   ```

   Nothing else: the code registering the plugin and its configuration stay the same.
4. **Check**: `curl "http://<node>:7512/_metrics?format=prometheus"` on each node returns the same metric names as before.

To stay on 4.x for now, pin `kuzzle-plugin-prometheus@^4`. Future 4.x fixes, if any, will be published under the npm dist-tag `release-4.x`.

## From 3.x to 4.x

Version 4.0.0 changed how metrics are collected and reported:

- The plugin uses Kuzzle's `server:metrics` API action to read Kuzzle's metrics. Calling it with `format=prometheus` returns them in the Prometheus format.
- The configuration gives more control:
  - the event loop sampling precision and the garbage collection buckets of the Node.js metrics are configurable;
  - Kuzzle metrics and Node.js metrics have separate prefixes;
  - the `nodeIP`, `nodeMAC` and `nodeHost` labels are removed in favour of `nodeId`;
  - the request duration recording can be disabled.
- Most metric names changed, to match Kuzzle's `server:metrics`.

### Steps

1. **Allow the scraping user to call `server:metrics`.** For example, for `anonymous`, add to its role:

   ```json
   {
     "controllers": {
       "server": {
         "actions": {
           "metrics": true
         }
       }
     }
   }
   ```

2. **Update the plugin configuration.** The 4.x defaults:

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

3. **Update your dashboards** to the new metric names, or import the ones in [`config/grafana/dashboards/`](../config/grafana/dashboards).
