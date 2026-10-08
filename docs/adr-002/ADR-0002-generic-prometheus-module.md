# ADR-0002: A generic Prometheus module, and the Kuzzle plugin built on it

**Status:** Accepted
**Date:** 2026-10-06
**Deciders:** Ricky (Kuzzle team)
**Related documents:** [ADR-0001 — maintenance baseline](../adr-001/ADR-0001-maintenance-baseline.md) (prerequisite)

## Decision

### Context

The Kuzzle team runs three kinds of Node.js stacks on its PaaS (Scaleway Kubernetes) and at customers' sites: Kuzzle backends (IoT platform, Hypervision), Node services such as the HTTP/TCP and MQTT ingestion gateways, and Vue.js frontends. Logs already have a shared answer ([`kuzzle-logger`](https://github.com/kuzzleio/kuzzle-logger), pushed to Loki). Metrics do not, so nothing warns us about a degrading application before it becomes critical.

State observed on 2026-10-06:

- **This plugin** binds its collection and exposition logic (`lib/services/MetricService.ts`, `prom-client` registry, default and request metrics) to the Kuzzle plugin API (`lib/PrometheusPlugin.ts`). Nothing in it can be reused by a non-Kuzzle service.
- **No application metric is collected on the PaaS.** In each cluster a Grafana Alloy instance scrapes infrastructure targets (cAdvisor, kube-state-metrics, blackbox probes, Redis) and `remote_write`s them to Scaleway Cockpit, whose ruler evaluates the alert rules. Alloy has no discovery of annotated pods. The `prometheus.io/*` annotations set by the `kuzzle` Helm chart are therefore ignored; their default path (`/_/metrics`) is the plugin's route (corrected in step 03: this line first said `/_/prometheus/metrics`).
- **Adoption**: only the PaaS console's own API loads the plugin (4.2.1). The IoT platform, Hypervision and their project templates do not. The console already injects `kuzzle_plugins__prometheus__labels__{project,environment}` into every customer backend, which has no effect while the plugin is not loaded. Version 5.0.0, released on the same day, has no known user.
- **Other Node services**: the HTTP/TCP gateway exposes its own `prom-client` metrics (`gateway_ingestor_*`) through a Fastify plugin. The MQTT gateway exposes none.
- **`prom-client` 15.1.3 is deprecated on npm** ("replaced by `@prometheus-io/client`"). Its successor (0.16.x) requires Node `^22 || ^24 || >=26`. Every production image already runs Node 22 or 24.

### Options considered

| Question | Options | Chosen |
| --- | --- | --- |
| Plugin ↔ module | inheritance (mixin over Kuzzle's `Plugin`) · composition | **composition**: TypeScript has no multiple inheritance, and the plugin already extends `Plugin` |
| Package layout | npm workspace in this repository · one package with subpath exports, in this repository · one package with subpath exports, in a new repository | **one package with subpath exports, in a new repository**: the `kuzzle-logger` pattern; each repository publishes one package |
| Custom metrics API | expose the underlying registry · thin typed wrapper | **typed wrapper**: applications do not depend on the Prometheus library, and the module enforces conventions |
| Library | stay on `prom-client` · `@prometheus-io/client` | **`@prometheus-io/client`**: no production stack runs Node 20 any more |
| Collection | pull only · pull + push (remote_write / OTLP) | **pull only**: it is the PaaS model (Alloy scrapes, then pushes to Cockpit) |
| Common labels | `tenant` on every metric · `project` / `environment` / `service` | **`project` / `environment` / `service`**: aligned with what the console injects; `tenant` multiplies cardinality |
| Frontends | in scope · out of scope | **out of scope**: a browser cannot be scraped; another tool or ADR |

### Decision

1. **A new package, `kuzzle-prometheus`**, in a new repository `kuzzleio/kuzzle-prometheus` (as `kuzzle-logger`), with two entry points:
   - `kuzzle-prometheus`: framework-agnostic. Registry, Node default metrics, `/metrics` HTTP handler, cluster aggregation, common labels, naming conventions. No dependency on Kuzzle.
   - `kuzzle-prometheus/kuzzle`: the Kuzzle plugin (hooks, pipes, controller, Kuzzle metrics). Kuzzle is an optional peer dependency.
2. **The plugin owns a module instance** and exposes it to the application, so that an app and its plugins declare their metrics on the same registry as the plugin.
3. **Custom metrics go through a typed wrapper**: `counter`, `gauge` and `histogram`, typed on their labels. The wrapper applies the prefix and the common labels, and rejects label sets beyond a cardinality limit.
4. **Built on `@prometheus-io/client`**, with Node `^22 || ^24` as the supported runtimes.
5. **Common labels `project`, `environment` and `service`**, read from configuration or from the environment the console already injects. Business metrics may add `tenant` themselves.
6. **Pull only**: services expose `/metrics`, and the PaaS scrapes them.
7. **Generic versus specific**: this repository provides the foundation, plus the Kuzzle and Node metrics. Business metrics (IoT devices, rules, ingestion) are declared by their own product with the module's API.
8. **`kuzzle-plugin-prometheus` stays on its 5.x line** in this repository, as a thin package that depends on `kuzzle-prometheus` and re-exports `kuzzle-prometheus/kuzzle`. The metric names and configuration keys documented by ADR-0001 do not change. Dropping Node 20 ships as a minor, since 5.x has no user yet (the console pins 4.2.1).
9. **Default in the IoT platform**: `registerKIoTP()` loads the plugin unless `plugins.prometheus.enabled` is `false`. Hypervision inherits this.

### Consequences

- Kuzzle backends and Node services share one API, one set of labels and one naming convention, so a dashboard or an alert rule can be written once.
- Alerting on application metrics needs PaaS work outside this repository: Alloy must discover annotated pods, and the chart path must be fixed. Until then, the metrics exist but are not collected.
- The new repository needs the ADR-0001 baseline from day one: Node 22/24 CI, semantic-release, npm OIDC trusted publishing, documentation.
- The plugin's code and its unit and functional tests move to the new repository; a fix to the plugin ships there, then reaches `kuzzle-plugin-prometheus` through a dependency bump.
- This ADR stays in this repository: it tracks the whole effort across repositories.
- Node 20 users must stay on `kuzzle-plugin-prometheus` 5.0.x.
- `@prometheus-io/client` is pre-1.0: its breaking changes are absorbed by the wrapper, not by applications.

## Cold start

- Decision recorded on 2026-10-06. Step 01 done: the plugin compiles in `strict` (#53).
- Step 02 done: `kuzzleio/kuzzle-prometheus` is bootstrapped (kuzzle-prometheus#1) and publishes to npm through OIDC trusted publishing (placeholder `0.0.0-bootstrap.0`; the first `feat` releases 1.0.0).
- Step 03 done: the module and the plugin live in `kuzzle-prometheus` (`1.0.0-beta.1` on npm `beta`); this repository re-exports it (`5.1.0-beta.1`, #56) and keeps only the integration guide. Both betas validated on the demo stack.
- Step 04 open: pilot on the HTTP/TCP gateway, the first real service on the module.
- Gateway migrated in a **draft** PR on its repository (kept as draft until the production versions), on `kuzzle-prometheus@1.0.0-beta.2` (gauge `collect` added for it): `/metrics` unchanged but for the common labels.
- Ingestor and worker both validated end to end on the beta.
- **Next action:** release `kuzzle-prometheus` 1.0.0 (after the plugin's test in a real Kuzzle application), then move the gateway's draft PR to it and close step 04.

## Steps

| # | Step | Status | PR(s) | Detail |
| --- | --- | --- | --- | --- |
| 01 | TypeScript `strict` on the current code | ✅ Done | #53 | [detail](steps/01-typescript-strict.md) |
| 02 | Create `kuzzleio/kuzzle-prometheus` with the ADR-0001 baseline (CI, semantic-release, OIDC publishing), modelled on `kuzzle-logger` | ✅ Done | kuzzle-prometheus#1 | [detail](steps/02-kuzzle-prometheus-repository.md) |
| 03 | Extract the module into it (`.` + `./kuzzle`), move to `@prometheus-io/client`, typed API, common labels, configurable request buckets; `kuzzle-plugin-prometheus` 5.x re-exports it | ✅ Done | kuzzle-prometheus#2, #3, #4, #56 | [detail](steps/03-module-extraction.md) |
| 04 | Pilot: migrate the HTTP/TCP gateway to the module, metric names unchanged | 🟦 In progress | kuzzle-prometheus#5 | [detail](steps/04-gateway-pilot.md) |
| 05 | PaaS: pod discovery in Alloy, first Kuzzle alert rules in Cockpit | ⬜ To do | — | — |
| 06 | IoT platform: plugin loaded by default in `registerKIoTP`, opt-out, templates updated | ⬜ To do | — | — |

Order: 01 → 02 → 03. Then 04 and 05 can run in parallel. 06 comes last, so that the default only ships once the metrics are collected.

## Decision register

- 2026-10-06 — Goal recorded: generic module + plugin built on it + default in the IoT platform; design deferred until ADR-0001 is closed.
- 2026-10-06 — ADR-0001 closed (5.0.0 released): design work unblocked.
- 2026-10-06 — One package `kuzzle-prometheus` with `.` and `./kuzzle` exports, in a new repository `kuzzleio/kuzzle-prometheus` (as `kuzzle-logger`); the plugin composes the module.
- 2026-10-06 — `@prometheus-io/client`, Node 22/24; `kuzzle-plugin-prometheus` stays on 5.x as a re-export (no 6.0: 5.x has no user).
- 2026-10-06 — Typed wrapper for custom metrics; common labels `project` / `environment` / `service`; pull only.
- 2026-10-06 — Business metrics live in their products; frontends out of scope.
- 2026-10-06 — Enabled by default in `registerKIoTP`, opt-out with `plugins.prometheus.enabled: false`.
- 2026-10-06 — `kuzzleio/kuzzle-prometheus` created (public, Apache-2.0, default branch `master`).
- 2026-10-06 — Configurable request buckets are redone in the module; the 4.x branch `feat/add-request-duration-bucket-config` is a reference only.
- 2026-10-08 — `kuzzle-prometheus` publishes through npm OIDC trusted publishing, after a manual placeholder publish (`0.0.0-bootstrap.0`) ([step 02](steps/02-kuzzle-prometheus-repository.md)).
- 2026-10-08 — `kuzzle-prometheus` releases betas from `1-dev`; `master` (1.0.0) after the beta is validated ([step 03](steps/03-module-extraction.md)).
- 2026-10-08 — Documentation first, shipped in the package, with guides for agents: `docs/agents.md` (integrating) and `AGENTS.md` (contributing).
- 2026-10-08 — Common labels from `KUZZLE_PROMETHEUS_{PROJECT,ENVIRONMENT,SERVICE}` (options win), left out when empty.
- 2026-10-08 — Cardinality limit drops new label combinations (warn once, counter), never throws at runtime; declaration errors throw at startup.
- 2026-10-08 — Plugin route is `GET /_/metrics`: the `kuzzle` chart's default path already matches, nothing to fix in step 05.
- 2026-10-08 — Reference documentation lives in `kuzzle-prometheus`; this repository keeps an integration guide for a Kuzzle stack.
- 2026-10-08 — No cluster aggregation in the module until a service needs it.
- 2026-10-08 — Step 03 closed on the demo stack validation; real-application validation through the gateway pilot (module), the plugin's before the `master` release ([step 03](steps/03-module-extraction.md)).

## Open points

- Links from this repository to the `kuzzle-prometheus` docs point to its `1-dev` branch: switch them to `master` when 1.0.0 is released.
- The plugin beta is validated on the demo stack only: test it in a real Kuzzle application before releasing `kuzzle-prometheus` 1.0.0 and `kuzzle-plugin-prometheus` 5.1.0.

## References

- [`@prometheus-io/client`](https://www.npmjs.com/package/@prometheus-io/client) · [`prom-client`](https://github.com/siimon/prom-client)
- [`kuzzle-logger`](https://github.com/kuzzleio/kuzzle-logger): the subpath-exports precedent
