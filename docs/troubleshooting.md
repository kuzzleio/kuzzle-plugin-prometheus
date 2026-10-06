# Troubleshooting

Start by calling the route Prometheus scrapes, with the same credentials, from where Prometheus runs:

```sh
curl -i "http://kuzzle:7512/_metrics?format=prometheus"
```

The `X-Kuzzle-Node` response header tells which node answered.

## `/_metrics?format=prometheus` returns JSON

| Cause | Check | Fix |
| --- | --- | --- |
| The plugin is not loaded on this node | Kuzzle's startup logs; `GET /_/metrics` returns 404 | Register the plugin (`app.plugin.use(new PrometheusPlugin())`) before `app.start()`, on every node. |
| `format` is missing or misspelt | The URL | `format=prometheus`, lowercase. In Prometheus, `params: { format: ["prometheus"] }`. |
| The request did not come over HTTP | — | The conversion only applies to HTTP. Over WebSocket or MQTT, `server:metrics` always returns JSON. |

## 401 or 403

`401`: the scrape is anonymous and `anonymous` lacks the right. `403`: the scraper's user lacks the right on `server:metrics` (route `/_metrics`) or `prometheus:metrics` (route `/_/metrics`). An invalid or expired API key also gives `401`. See [Deployment → Permissions](deployment.md#permissions).

## 404 on `/_/metrics`

The plugin is not loaded on this node, or a reverse proxy in front of Kuzzle does not forward the `/_/` path.

## Kuzzle refuses to start: version mismatch

Plugin 5.x requires Kuzzle `>=2.59.0 <3.0.0`; Kuzzle checks it when the plugin loads. Upgrade Kuzzle, or stay on plugin 4.x. npm 7 and later refuse the install beforehand (`ERESOLVE`, unmet peer dependency).

## `ERR_REQUIRE_ESM` at startup

Node.js is too old for Kuzzle 2.59: it needs 20.19.0+ or 22.12.0+ (or 24). Upgrade Node.js; `node --version` inside the container tells which one runs.

## Series disappear and reappear with another `nodeId`

Expected: Kuzzle generates a new node ID at each start. Chart per `instance` or `job` rather than per `nodeId` over long periods. Many `nodeId` values in a short time point to restarting nodes (crash loop, autoscaling).

## Metrics of a node are missing, or counters keep resetting

Prometheus scrapes through a load balancer or a Kubernetes Service, and reaches a different node at each scrape. Scrape every node directly: see [Deployment](deployment.md#principles).

## `kuzzle_api_request_duration_ms` is absent

- `core.monitorRequestDuration` is `false`.
- No API request completed since the node started: the histogram only shows label combinations already seen. Any request, including the scrape itself, creates the first series for the next scrape.

## Quantiles of the request duration stay at 500 ms

The histogram's highest bucket is 500 ms: every slower request lands in `+Inf`, and `histogram_quantile` cannot return more than 500. The requests are slower than that; look at `_sum / _count` for the average. Configurable buckets are tracked by [ADR-0002](adr-002/ADR-0002-generic-prometheus-module.md).

## Node.js metrics are absent

`default.enabled` is `false`, or `default.prefix` changed their names (`<prefix>nodejs_eventloop_lag_seconds`). Dashboards built for the unprefixed names then show nothing.

## Grafana dashboards are empty

- The dashboards expect the default prefixes (`kuzzle_`, and none for Node.js metrics).
- Their `nodeId` variable lists the node IDs Prometheus knows; after restarts, select the current ones.
- They reference a Prometheus datasource named `Prometheus`, as provisioned by [`config/grafana/datasources.yml`](../config/grafana/datasources.yml); with another name, pick yours in each panel or rename it.

## Kuzzle logs `Error executing hook on "request:onSuccess"` on every request

Plugin 4.x with `core.monitorRequestDuration: false`. Fixed in 5.0.0; with 4.x, keep the option to `true`.

## Too many series in Prometheus

The request histogram multiplies with controllers, actions, protocols and statuses, and every restart creates a new `nodeId`. See [Deployment → Cardinality](deployment.md#cardinality). Setting `core.monitorRequestDuration` to `false` removes the histogram entirely.
