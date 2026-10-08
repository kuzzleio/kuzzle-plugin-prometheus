# Integrating the plugin in a Kuzzle stack

From an application to dashboards: register the plugin, give the scraper its rights, point Prometheus at every node, import the dashboards. Each step links to the [`kuzzle-prometheus` documentation](https://github.com/kuzzleio/kuzzle-prometheus/tree/1-dev/docs) for the reference.

## 1. Register the plugin on every node

```sh
npm install kuzzle-plugin-prometheus
```

```typescript
import { Backend } from "kuzzle";
import { PrometheusPlugin } from "kuzzle-plugin-prometheus";

const app = new Backend("my-application");

const prometheus = new PrometheusPlugin();
app.plugin.use(prometheus);

app.start();
```

`kuzzle-plugin-prometheus` is the Kuzzle plugin of [`kuzzle-prometheus`](https://github.com/kuzzleio/kuzzle-prometheus), under its historical name: `import { PrometheusPlugin } from "kuzzle-prometheus/kuzzle"` is the same class.

- **Every node** runs the plugin, in the application all nodes share. A node without it answers `/_metrics?format=prometheus` in JSON and `/_/metrics` with a 404.
- **Each node exposes only its own metrics**: no aggregation across the cluster. Prometheus scrapes every node and aggregates with PromQL (`sum by (…)`).
- The application's own metrics go on `prometheus.metrics`: see [Kuzzle plugin → Application metrics](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/kuzzle.md#application-metrics).
- Configuration (`plugins.prometheus` in `.kuzzlerc` or `kuzzle_plugins__prometheus__*` variables): [Kuzzle plugin → Configuration](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/kuzzle.md#configuration).

Check, once Kuzzle has started:

```sh
curl "http://localhost:7512/_metrics?format=prometheus"
```

The answer is plain text starting with `# HELP`. JSON instead: see [Troubleshooting](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/troubleshooting.md).

## 2. Routes

| Route | Kuzzle action checked | Notes |
| --- | --- | --- |
| `GET /_metrics?format=prometheus` | `server:metrics` | Kuzzle's `server:metrics`, converted by the plugin. Without `format=prometheus`, Kuzzle's JSON. HTTP only. |
| `GET /_/metrics` | `prometheus:metrics` | For scrapers that cannot send query parameters. It calls `server:metrics` internally, through the plugin's embedded SDK: Kuzzle does not check the scraper's rights on that internal call. |

Both answer `200` with `Content-Type: text/plain; version=0.0.4; charset=utf-8`; the `X-Kuzzle-Node` header names the node that answered.

## 3. Give the scraper its rights

Out of the box, Kuzzle's `anonymous` role allows every action: scrapes work without credentials. Once you restrict it (any production deployment should), give the scraper a dedicated role:

```json
{
  "controllers": {
    "server": { "actions": { "metrics": true } },
    "prometheus": { "actions": { "metrics": true } }
  }
}
```

Keep only the line of the route you scrape, if you prefer. Then either:

- **Anonymous scrapes**: add these rights to the `anonymous` role. Anyone who reaches the port can read the metrics: acceptable when the Kuzzle port is not exposed outside a private network.
- **Authenticated scrapes** (recommended): a dedicated user, with an API key used as a bearer token. With an admin token in `$ADMIN`:

  ```sh
  # 1. The role above
  curl -X POST "http://kuzzle:7512/roles/prometheus-scraper/_create" \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d '{"controllers": {"server": {"actions": {"metrics": true}}, "prometheus": {"actions": {"metrics": true}}}}'

  # 2. A profile with that role
  curl -X POST "http://kuzzle:7512/profiles/prometheus-scraper/_create" \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d '{"policies": [{"roleId": "prometheus-scraper"}]}'

  # 3. A user with that profile (no password needed: it authenticates with its API key)
  curl -X POST "http://kuzzle:7512/users/prometheus-scraper/_create" \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d '{"content": {"profileIds": ["prometheus-scraper"]}}'

  # 4. An API key for that user, which never expires
  curl -X POST "http://kuzzle:7512/users/prometheus-scraper/api-keys/_create?expiresIn=-1" \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d '{"description": "Prometheus scraper"}'
  ```

  The key is `result._source.token` in the last response; Kuzzle shows it only once. See Kuzzle's [API keys guide](https://docs.kuzzle.io/core/2/guides/advanced/api-keys/).

Without the right, Kuzzle answers `401` to an anonymous scrape and `403` to an authenticated one.

## 4. Point Prometheus at every node

**Never scrape through a load balancer** or a Kubernetes Service: each scrape would reach a random node, series would jump between nodes and counters would look like resets.

### One node

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: kuzzle
    metrics_path: /_metrics
    params:
      format: ["prometheus"]
    static_configs:
      - targets: ["kuzzle:7512"]
```

For an authenticated scrape, add the API key:

```yaml
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/kuzzle-api-key # or `credentials: <key>`
```

### Several nodes with Docker Compose

List each node by its container name (`<project>-<service>-<index>`), not the service name, which Docker's DNS may resolve to any replica:

```yaml
    static_configs:
      - targets:
          - "kuzzle-plugin-prometheus-kuzzle-1:7512"
          - "kuzzle-plugin-prometheus-kuzzle-2:7512"
          - "kuzzle-plugin-prometheus-kuzzle-3:7512"
```

`dns_sd_configs` with `tasks.<service>` (Docker Swarm) or `docker_sd_configs` discover the replicas automatically.

### Kubernetes

Scrape the **pods**. With pod annotations (honoured by the common Prometheus Helm charts' `kubernetes-pods` job), use `/_/metrics`: annotations cannot carry query parameters.

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/path: /_/metrics
    prometheus.io/port: "7512"
```

Annotations cannot carry credentials either: they need anonymous scrapes. For authenticated scrapes, use a `PodMonitor` of the Prometheus Operator:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: kuzzle
spec:
  selector:
    matchLabels:
      app: kuzzle
  podMetricsEndpoints:
    - port: http # the name of the container port 7512
      path: /_metrics
      params:
        format: ["prometheus"]
      authorization:
        type: Bearer
        credentials:
          name: kuzzle-prometheus-api-key
          key: token
```

Set the `project` and `environment` labels in the deployment, so that one dashboard or alert rule works across stacks:

```yaml
env:
  - name: kuzzle_plugins__prometheus__labels__project
    value: acme
  - name: kuzzle_plugins__prometheus__labels__environment
    value: production
```

### Scrape interval

10 to 30 seconds suits most deployments: each scrape is one cheap `server:metrics` call. Use a `rate()` window of at least 4 times the interval (`[1m]` for 15 s).

### Cardinality

Series per node, with the default configuration:

- Kuzzle metrics: about 6, plus one per connected protocol;
- Node.js metrics: about 100 (with the event loop utilization summary and histogram);
- request histogram: 12 per controller × action × protocol × status combination actually used. It grows with the API surface clients use: 40 actions over 2 protocols with 3 statuses each give about 2,900 series.

Every restart creates a new `nodeId`, hence a new set of series; the old ones go stale after 5 minutes. Frequent restarts (autoscaling, crash loops) multiply the series Prometheus stores over its retention.

## 5. Grafana dashboards

Two dashboards ship in [`config/grafana/dashboards/`](../config/grafana/dashboards), both with a `nodeId` filter:

- `demo.json` ("Kuzzle"): connections per node and protocol, concurrent and pending requests, realtime subscriptions, requests, latency and 5xx errors per node and per API action;
- `nodejs.json` ("NodeJS process"): CPU, event loop lag, Node.js version, restarts, memory, active handles and requests, heap per space.

Import them through the Grafana UI, its API or its provisioning, as the [local stack](development.md#local-stack) does. They expect the default prefixes (`kuzzle_` for Kuzzle metrics, none for Node.js metrics) and a Prometheus datasource named `Prometheus`.

## 6. Try it locally

This repository's Docker Compose stack runs all of the above: Kuzzle with the plugin, Prometheus scraping it, Grafana with the dashboards provisioned. See [Development → Local stack](development.md#local-stack).

## Reference

| Document (`kuzzle-prometheus`) | Content |
| --- | --- |
| [Kuzzle plugin](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/kuzzle.md) | configuration, labels, application metrics |
| [Kuzzle metrics reference](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/kuzzle-metrics.md) | every metric, PromQL examples |
| [Custom metrics](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/custom-metrics.md) | declaring the application's metrics |
| [Troubleshooting](https://github.com/kuzzleio/kuzzle-prometheus/blob/1-dev/docs/troubleshooting.md) | symptoms, causes and fixes |
