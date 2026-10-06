# Deployment

## Principles

- **One plugin per node.** Register the plugin in the application that every Kuzzle node runs. A node without the plugin answers `/_metrics?format=prometheus` in JSON and `/_/metrics` with a 404.
- **Each node exposes only its own metrics.** There is no aggregation across the cluster: the request counters, connections and Node.js metrics of a node are only visible on that node. Prometheus must scrape **every node**, and aggregates with PromQL (`sum by (…)`).
- **Never scrape through a load balancer.** Each scrape would reach a random node: the series would jump from one node to another and the counters would look like resets.
- **The scrape is an ordinary Kuzzle API request**, subject to the permissions of the user making it.

## Routes

| Route | Kuzzle action(s) checked | Notes |
| --- | --- | --- |
| `GET /_metrics?format=prometheus` | `server:metrics` | The plugin converts the response of Kuzzle's `server:metrics` action. Without `format=prometheus` (or with any other value) the response stays Kuzzle's JSON. Only over HTTP: the same call over WebSocket or MQTT returns JSON. |
| `GET /_/metrics` | `prometheus:metrics` | The plugin's own action, for scrapers that cannot send query parameters. It calls `server:metrics` internally, through the plugin's embedded SDK: Kuzzle does not check the scraper's rights on that internal call. |

Both answer `200` with `Content-Type: text/plain; version=0.0.4; charset=utf-8`, and the `X-Kuzzle-Node` header names the node that answered.

## Permissions

Out of the box, Kuzzle's `anonymous` role allows every action: scrapes work without credentials. Once you restrict it (which any production deployment should do), give the scraper a dedicated role.

Role allowing both routes (keep only the line of the route you scrape, if you prefer):

```json
{
  "controllers": {
    "server": { "actions": { "metrics": true } },
    "prometheus": { "actions": { "metrics": true } }
  }
}
```

Then either:

- **Anonymous scrapes**: add these rights to the `anonymous` role. Simple, but anyone who reaches the port can read the metrics; acceptable when the Kuzzle port is not exposed outside a private network.
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

Without the right, Kuzzle answers `401` (`security.rights.unauthorized`) to an anonymous scrape and `403` (`security.rights.forbidden`) to an authenticated one.

## Prometheus configurations

### One node

```yaml
global:
  scrape_interval: 10s

scrape_configs:
  - job_name: kuzzle
    metrics_path: /_metrics
    params:
      format: ["prometheus"]
    static_configs:
      - targets: ["kuzzle:7512"]
```

### Authenticated scrape

Add the API key as a bearer token:

```yaml
scrape_configs:
  - job_name: kuzzle
    metrics_path: /_metrics
    params:
      format: ["prometheus"]
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/kuzzle-api-key # or `credentials: <key>`
    static_configs:
      - targets: ["kuzzle:7512"]
```

### Several nodes with Docker Compose

List each node by its container name (Compose names replicas `<project>-<service>-<index>`), not the service name, which Docker's DNS may resolve to any replica:

```yaml
scrape_configs:
  - job_name: kuzzle
    metrics_path: /_metrics
    params:
      format: ["prometheus"]
    static_configs:
      - targets:
          - "kuzzle-plugin-prometheus-kuzzle-1:7512"
          - "kuzzle-plugin-prometheus-kuzzle-2:7512"
          - "kuzzle-plugin-prometheus-kuzzle-3:7512"
```

Alternatively, `dns_sd_configs` with the `tasks.<service>` name in Docker Swarm, or Prometheus' `docker_sd_configs`, discover the replicas automatically.

### Kubernetes

Scrape the **pods**, not the Service (a Service is a load balancer).

With pod annotations, a convention honoured by the common Prometheus Helm charts' `kubernetes-pods` job: annotations cannot carry query parameters, so use `/_/metrics`.

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/path: /_/metrics
    prometheus.io/port: "7512"
```

Annotations cannot carry credentials either: this setup needs anonymous scrapes. For authenticated scrapes, use a `PodMonitor` of the Prometheus Operator, which accepts both parameters and a bearer token from a Secret:

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

## Scrape interval

10 to 30 seconds suits most deployments. Each scrape is one `server:metrics` call, cheap for Kuzzle. Use a `rate()` window of at least 4 times the scrape interval (`[1m]` for 15 s).

## Cardinality

Series per node, with the default configuration:

- Kuzzle metrics: about 6, plus one per connected protocol;
- Node.js metrics: about 50;
- request histogram: 11 per controller × action × protocol × status combination actually used. This one grows with the API surface the clients use; an application calling 40 actions over 2 protocols with 3 distinct statuses each produces about 2,600 series.

Every Kuzzle restart creates a new `nodeId`, hence a new set of series; the old ones go stale after 5 minutes. Frequent restarts (autoscaling, crash loops) multiply the series stored by Prometheus over its retention period.
