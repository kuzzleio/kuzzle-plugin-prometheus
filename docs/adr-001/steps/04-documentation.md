# Step 04 — Documentation overhaul

**Status:** 🟦 In progress
**Dates:** started 2026-10-06
**PR(s):** [#42](https://github.com/kuzzleio/kuzzle-plugin-prometheus/pull/42) (fixes)
**ADR:** [ADR-0001](../ADR-0001-maintenance-baseline.md)

## Goal

Someone who has never seen the plugin can install, configure, deploy and troubleshoot it from the repository's `.md` files alone, and every documented fact matches the code of 5.0.0. The documentation becomes the contract ADR-0002 must keep: metric names, labels and configuration keys.

## Starting point

- One `README.md` (12 KB): about, compatibility matrix, installation, configuration, Prometheus scrape setups (single node, authenticated user, Docker Compose, Kubernetes annotations), dashboards, local development, a 3.x → 4.x migration.
- No reference of the metrics the plugin exposes, nor of the cluster behaviour; the compatibility matrix and the development section predate ADR-0001 (Node 18, mocha, `ergol`).

## Plan

1. **Inventory from the code** (`lib/PrometheusPlugin.ts`, `lib/services/MetricService.ts`, `lib/types/`): every configuration key with its type, default and effect; every metric with its type, labels, unit and source (default Node metrics, Kuzzle core metrics, request metrics); the controller actions and routes; the cluster aggregation.
2. **`README.md`** (≤ 20 KB budget): what the plugin does, compatibility (Node 20.19+/22.12+/24, Kuzzle `>=2.59.0 <3`), installation, a minimal working configuration, the scrape setup, links to the reference.
3. **`docs/` reference**, one file per subject, e.g.:
   - `configuration.md`: every key, defaults, examples;
   - `metrics.md`: every metric, labels, PromQL examples;
   - `deployment.md`: single node, cluster, Docker Compose, Kubernetes, authentication of the scrape;
   - `troubleshooting.md`: symptoms and causes;
   - `development.md`: local stack, tests on Node 20/22/24, commit convention and release channels;
   - `upgrading.md`: 4.x → 5.x (Node floor, Kuzzle peer range, unchanged metrics and configuration), and the existing 3.x → 4.x guide moved there.
4. Check each documented example against a running stack (`docker compose up`, `curl` of the metrics route).

## Inventory (2026-10-06, from the code and a running stack)

Checked on the Compose stack (Kuzzle 2.59.0, Node 24), with one then two nodes.

- **Routes**: `GET /_metrics?format=prometheus` (Kuzzle's `server:metrics`, turned into Prometheus text by the `server:afterMetrics` pipe, HTTP only; without `format` it stays JSON) and `GET /_/metrics` (the plugin's `prometheus:metrics` action, for scrapers that cannot pass query parameters, such as Kubernetes annotations). Both return `text/plain; version=0.0.4`. `/_/metrics` calls `server:metrics` internally through the embedded SDK, which Kuzzle runs without rights check (`funnel.executePluginRequest`): the scraper needs `prometheus:metrics` only; `/_metrics` needs `server:metrics`.
- **Kuzzle metrics** (`core.prefix`, default `kuzzle_`; gauges refreshed at each scrape from `server:metrics`): `api_concurrent_requests`, `api_pending_requests`, `network_connections{protocol}`, `realtime_rooms`, `realtime_subscriptions`.
- **Request histogram** `kuzzle_api_request_duration_ms{controller,action,protocol,status}` (`core.monitorRequestDuration`, default on): milliseconds since the request was created, recorded on `request:onSuccess` / `request:onError`; fixed buckets `[0.1, 5, 15, 50, 100, 200, 300, 400, 500]`. URLs that match no route (404 from the router) are not counted; the scrape requests themselves are.
- **Node.js metrics** (`default.enabled`, default on; `default.prefix`, default empty so community dashboards work): prom-client 15 default metrics, `process_*` and `nodejs_*` (CPU, memory, file descriptors, event loop lag and its percentiles, heap spaces, GC histogram with `default.gcDurationBuckets`, active handles/requests/resources, version info).
- **Labels**: every series carries `nodeId` (Kuzzle's node ID, regenerated at each start: a restart creates new series) plus `labels` from the configuration. The type's JSDoc said `default.prefix` defaults to `kuzzle_`; the code uses `""`.
- **Cluster**: no aggregation. Each node exposes only its own metrics; Prometheus must scrape every node directly, never through a load balancer (each scrape would hit a random node).
- **Configuration** is read from `plugins.prometheus` in `.kuzzlerc` (or `kuzzle_plugins__prometheus__…` environment variables), deep-merged over the defaults.
- **Repository**: `config/` holds the demo Prometheus, Grafana (dashboards `demo.json` and `nodejs.json`, not `kuzzle.json` as the README says) and Kuzzle configurations; the root `.kuzzlerc` is empty and `.kuzzlrc` is a misspelt copy of `config/kuzzlerc`.

## What was done

- **Two fixes found by the inventory** (decided with the user, 2026-10-06), in a dedicated PR before the documentation:
  - `core.monitorRequestDuration: false` logged `TypeError: Cannot read properties of undefined (reading 'labels')` on every request: the request hooks were registered without the histogram. They are now registered only when the option is on; unit test added, checked on the stack (0 errors).
  - The plugin manifest accepted Kuzzle `>=2.16.9 <3`: aligned on the peer range, `>=2.59.0 <3`.
- **A third bug, found while checking the docs on a live stack**: the configuration was deep-merged with lodash `merge`, which merges arrays index by index (`gcDurationBuckets: [0.5, 3]` gave `[0.5, 3, 0.1, 1, 2, 5]`). Arrays now replace the defaults (`mergeWith`); unit test added, fails without the fix.
- **Documentation**: `README.md` rewritten (what, compatibility, installation, minimal configuration, scraping, dashboards, links); reference under `docs/`: `configuration.md`, `metrics.md`, `deployment.md`, `troubleshooting.md`, `development.md`, `upgrading.md` (4.x → 5.x, and the 3.x → 4.x guide moved from the README). The misspelt `.kuzzlrc` is removed; the empty `.kuzzlerc` stays (mount point of `config/kuzzlerc`).
- The unmerged branch `feat/add-request-duration-bucket-config` (configurable request buckets) is left to ADR-0002: a new feature, not maintenance.

## Local decisions / gotchas

- Fixing a bug found while documenting is in scope: documenting a broken option as a "known issue" would contradict this step's goal. New features are not.

## Validation

Checked on the Compose stack (Kuzzle 2.59.0, Node 24), 2026-10-06:

| Documented fact | Result |
| --- | --- |
| both routes return Prometheus text; `/_metrics` without `format` returns JSON | ✅ |
| `anonymous` scrapes work out of the box; after `createFirstAdmin?reset=true`, `401 security.rights.unauthorized` | ✅ |
| role → profile → user → API key commands of `deployment.md` (POST routes, key in `result._source.token`) | ✅ |
| role with both rights: both routes 200; with `prometheus:metrics` only: `/_/metrics` 200, `/_metrics` `403 security.rights.forbidden` | ✅ |
| invalid API key: `401 security.token.invalid` | ✅ |
| environment variables: booleans, `*json:` arrays, labels | ✅ (array merge bug found and fixed) |
| two nodes: each exposes only its own metrics and `nodeId` | ✅ |
| Kuzzle refuses a plugin outside its manifest's `kuzzleVersion` | ✅ (Kuzzle code, `plugin.js`) |
