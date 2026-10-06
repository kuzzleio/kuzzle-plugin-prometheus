# Metrics reference

Names below use the default prefixes: `kuzzle_` for Kuzzle metrics and the request histogram (`core.prefix`), none for Node.js metrics (`default.prefix`). See [Configuration](configuration.md).

## Labels on every series

| Label | Value |
| --- | --- |
| `nodeId` | The ID of the Kuzzle node that served the scrape, as returned in the `X-Kuzzle-Node` response header (e.g. `knode-gaudy-puma-96607`). Kuzzle generates a new ID at each start, so a restarted node produces new series. |
| your `labels` | Every pair of the `labels` configuration key. |

## Kuzzle metrics

Gauges set at each scrape from the result of Kuzzle's [`server:metrics`](https://docs.kuzzle.io/core/2/api/controllers/server/metrics/) API action, for the node that serves the scrape. They are reset before each update: a protocol with no connection left disappears instead of staying at its last value.

| Metric | Type | Extra labels | Meaning |
| --- | --- | --- | --- |
| `kuzzle_api_concurrent_requests` | gauge | — | API requests being executed by the node right now. |
| `kuzzle_api_pending_requests` | gauge | — | API requests waiting in the node's queue because the concurrency limit (`limits.concurrentRequests` in Kuzzle's configuration) is reached. A value that stays above 0 means the node is saturated. |
| `kuzzle_network_connections` | gauge | `protocol` | Open client connections, per network protocol as Kuzzle names it (`http/1.1`, `websocket`, `mqtt`…). |
| `kuzzle_realtime_rooms` | gauge | — | Realtime rooms on the node: one room per distinct index, collection and filters combination. |
| `kuzzle_realtime_subscriptions` | gauge | — | Realtime subscriptions on the node. Several subscriptions can share a room. |

The scrape itself is an API request: `kuzzle_api_concurrent_requests` is at least 1 and `kuzzle_network_connections{protocol="http/1.1"}` counts the scraper.

## Request duration

| Metric | Type | Labels | Unit |
| --- | --- | --- | --- |
| `kuzzle_api_request_duration_ms` | histogram | `controller`, `action`, `protocol`, `status` | milliseconds |

Present only when `core.monitorRequestDuration` is `true` (the default).

- **What is measured**: the time between the creation of the request in Kuzzle and its response, success or error, as seen by the `request:onSuccess` and `request:onError` events.
- **Labels**:
  - `controller`, `action`: the API action, e.g. `document` / `search`, or a plugin or application controller (`testing` / `failure`);
  - `protocol`: the protocol of the request (`http`, `websocket`, `mqtt`…). Note it differs from the `protocol` label of `kuzzle_network_connections` (`http` here, `http/1.1` there);
  - `status`: the response status, HTTP style: `200`, `206`, `400`, `403`, `404`, `412`, `500`…
- **What is not counted**: URLs that match no API route (Kuzzle answers 404 before creating a request).
- **Buckets** (fixed): `0.1`, `5`, `15`, `50`, `100`, `200`, `300`, `400`, `500` ms, and `+Inf`. Requests over 500 ms all fall in `+Inf`: a quantile above that value cannot be estimated.
- The histogram exposes `kuzzle_api_request_duration_ms_bucket{le="…"}`, `_sum` and `_count`. `_count` is a request counter: use it for rates.
- **Cardinality**: one series set per controller × action × protocol × status actually used, times 11 (9 buckets, `+Inf`, plus `_sum` and `_count`).

## Node.js metrics

The [default metrics of `prom-client`](https://github.com/siimon/prom-client#default-metrics) 15, for the Kuzzle process. Present only when `default.enabled` is `true` (the default).

| Metric | Type | Extra labels | Meaning |
| --- | --- | --- | --- |
| `process_cpu_user_seconds_total` | counter | — | User CPU time, seconds. |
| `process_cpu_system_seconds_total` | counter | — | System CPU time, seconds. |
| `process_cpu_seconds_total` | counter | — | User + system CPU time, seconds. |
| `process_start_time_seconds` | gauge | — | Process start time, Unix epoch seconds. |
| `process_resident_memory_bytes` | gauge | — | Resident memory (RSS). |
| `process_virtual_memory_bytes` | gauge | — | Virtual memory. |
| `process_heap_bytes` | gauge | — | Process heap size. |
| `process_open_fds` | gauge | — | Open file descriptors. |
| `process_max_fds` | gauge | — | Maximum file descriptors. |
| `nodejs_eventloop_lag_seconds` | gauge | — | Event loop lag, measured at scrape time. |
| `nodejs_eventloop_lag_{min,max,mean,stddev,p50,p90,p99}_seconds` | gauge | — | Statistics of the event loop delay, sampled every `default.eventLoopMonitoringPrecision` ms. |
| `nodejs_active_handles`, `nodejs_active_handles_total` | gauge | `type` (first one) | libuv handles (sockets, timers, servers…). |
| `nodejs_active_requests`, `nodejs_active_requests_total` | gauge | `type` (first one) | libuv requests in progress. |
| `nodejs_active_resources`, `nodejs_active_resources_total` | gauge | `type` (first one) | Resources keeping the event loop alive. |
| `nodejs_heap_size_total_bytes`, `nodejs_heap_size_used_bytes` | gauge | — | V8 heap, total and used. |
| `nodejs_external_memory_bytes` | gauge | — | Memory of C++ objects bound to JavaScript objects. |
| `nodejs_heap_space_size_{total,used,available}_bytes` | gauge | `space` | V8 heap, per space (`new`, `old`, `code`…). |
| `nodejs_gc_duration_seconds` | histogram | `kind` (`major`, `minor`, `incremental`, `weakcb`) | Garbage collection pauses; buckets from `default.gcDurationBuckets`. |
| `nodejs_version_info` | gauge | `version`, `major`, `minor`, `patch` | Always 1; the labels give the Node.js version. |

`process_open_fds`, `process_max_fds`, `process_virtual_memory_bytes` and `process_heap_bytes` are only collected on Linux.

## PromQL examples

Requests per second, per node:

```promql
sum by (nodeId) (rate(kuzzle_api_request_duration_ms_count[5m]))
```

Errors per second (status 500 and above), per action:

```promql
sum by (controller, action) (rate(kuzzle_api_request_duration_ms_count{status=~"5.."}[5m]))
```

95th percentile of the request duration, per action, in ms:

```promql
histogram_quantile(0.95,
  sum by (le, controller, action) (rate(kuzzle_api_request_duration_ms_bucket[5m])))
```

Average request duration, in ms:

```promql
sum(rate(kuzzle_api_request_duration_ms_sum[5m])) / sum(rate(kuzzle_api_request_duration_ms_count[5m]))
```

Saturated nodes (requests queued for 5 minutes):

```promql
min_over_time(kuzzle_api_pending_requests[5m]) > 0
```

Open connections in the whole cluster, per protocol:

```promql
sum by (protocol) (kuzzle_network_connections)
```

Event loop lag, 99th percentile, per node:

```promql
max by (nodeId) (nodejs_eventloop_lag_p99_seconds)
```

Restarts in the last hour, per scrape target (each restart creates a new series, with a new `nodeId`):

```promql
count by (instance) (count_over_time(process_start_time_seconds[1h])) - 1
```

Since `nodeId` changes at each restart, aggregate per job or instance (`sum by (instance)`) rather than per `nodeId` for long-term charts.
