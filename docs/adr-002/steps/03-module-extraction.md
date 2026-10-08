# Step 03 — Extract the module into `kuzzle-prometheus`

**Status:** ✅ Done
**Dates:** 2026-10-08 → 2026-10-08
**PR(s):** [kuzzle-prometheus#2](https://github.com/kuzzleio/kuzzle-prometheus/pull/2), [kuzzle-prometheus#3](https://github.com/kuzzleio/kuzzle-prometheus/pull/3), [kuzzle-prometheus#4](https://github.com/kuzzleio/kuzzle-prometheus/pull/4), [#56](https://github.com/kuzzleio/kuzzle-plugin-prometheus/pull/56)
**ADR:** [ADR-0002](../ADR-0002-generic-prometheus-module.md)

## Goal

`kuzzle-prometheus` holds the code, and `kuzzle-plugin-prometheus` 5.x becomes a thin re-export of it:

- `.` (framework-agnostic): registry, Node default metrics, `/metrics` HTTP handler, cluster aggregation, common labels `project` / `environment` / `service`, naming conventions;
- typed wrapper for custom metrics (`counter`, `gauge`, `histogram`) with prefix, common labels and a cardinality limit;
- `./kuzzle`: the plugin (hooks, pipes, controller, Kuzzle metrics) composing a module instance it exposes to the application, with configurable request buckets;
- built on `@prometheus-io/client`, Node `^22 || ^24`;
- unit and functional tests moved along with the code;
- this repository: depends on `kuzzle-prometheus`, re-exports `kuzzle-prometheus/kuzzle`, metric names and configuration keys unchanged (ADR-0001), Node 20 dropped in a minor.

## What was done

- 2026-10-08 — Step opened.
- 2026-10-08 — `kuzzle-prometheus` branch `1-dev` created from `master`: step 03 PRs target it, each merge publishes `1.0.0-beta.N`; `master` (1.0.0) follows the validation of the beta.
- 2026-10-08 — Module `.` (kuzzle-prometheus#2), documentation written first to fix the API:
  - `createMetrics()`, one instance per application; typed `counter` / `gauge` / `histogram` (`const` type parameter on `labelNames`), on `@prometheus-io/client` 0.16.1, none of whose types reach the public API;
  - common labels from the options, else `KUZZLE_PROMETHEUS_{PROJECT,ENVIRONMENT,SERVICE}`, left out when empty (registry default labels);
  - naming rules enforced at declaration: snake_case, counters end with `_total`, no common label or `le` in `labelNames`, no duplicate metric;
  - cardinality guard: past `maxLabelSets` (1000) combinations per metric, new ones are dropped, warned once, counted in `kuzzle_prometheus_label_sets_rejected_total{metric}`;
  - `render()` and an `http` / Express `handler`;
  - docs shipped in the package (`docs/`): getting started, custom metrics, configuration, and `docs/agents.md` for agents integrating the module; `AGENTS.md` (+ `CLAUDE.md`) for agents working on the repository.
- 2026-10-08 — Plugin `./kuzzle` (kuzzle-prometheus#3): `PrometheusPlugin` moved with its routes, metric names, configuration keys and defaults; `plugin.metrics` for application metrics (constructor options `prefix`, `maxLabelSets`); `core.requestDurationBuckets`; warnings through Kuzzle's logger; unit tests on the rendered text; functional tests against a real Kuzzle from `src/` (Docker Compose, CI on Node 22 and 24); docs `kuzzle.md`, `kuzzle-metrics.md`.
- 2026-10-08 — `kuzzle-prometheus@1.0.0-beta.1` published on `beta` (#2 and #3 merged together, see gotchas), with provenance; the bot tagged, released, commented and labelled the PRs.
- 2026-10-08 — Documentation split (kuzzle-prometheus#4 and this repository): the reference (configuration, metrics, troubleshooting) lives in `kuzzle-prometheus`; this repository keeps one [integration guide](../../kuzzle-stack.md) (rights, Prometheus, Kubernetes, Grafana, local stack) linking to it. `docs/configuration.md`, `metrics.md` and `troubleshooting.md` removed here; `deployment.md` became `kuzzle-stack.md`.
- 2026-10-08 — This repository: `lib/` and its unit tests removed; `index.ts` re-exports `kuzzle-prometheus/kuzzle` (dependency `kuzzle-prometheus@1.0.0-beta.1`); `lodash` and `prom-client` dropped; Node `^22.12.0 || ^24.0.0`, CI matrices without Node 20; `upgrading.md` gains 5.0 → 5.1 (#56, published as `kuzzle-plugin-prometheus@5.1.0-beta.1` on `beta`).
- 2026-10-08 — Both betas validated on this repository's Docker Compose stack (see Validation). Step closed; the test in a real application moves to step 04 (module) and stays an open point for the plugin.

## Local decisions / gotchas

- **First release of `kuzzle-prometheus` `master` publishes 1.0.0** as `latest`, replacing the bootstrap placeholder.
- **The plugin route is `GET /_/metrics`**, not `/_/prometheus/metrics` as the hub's context said (a plugin action with `path: "metrics"` is served at `/_/metrics`): it already matches the `kuzzle` chart's default `prometheus.io/path`. Hub corrected, open point closed.
- **Bot App permissions**: the release's `success` step created the `released on @beta` label and commented on the PRs, so labels and issues work; the failure-issue path is still untested.
- **Internal API for the plugin**: it completes the configuration at `init` (the instance exists from the constructor, so that the application declares metrics before `start`) and reaches the registry (Kuzzle metric names predate the naming rules). `completeConfiguration()` / `registryOf()` are `@internal`, stripped from the `.d.ts` (`stripInternal`), not exported.
- **Label order changed in the text output of histograms** (`@prometheus-io/client` puts the registry's default labels first). Series are identified by label set: no impact on queries; tests compare label sets (`sample()` helper), not raw lines. The 4 functional tests of this repository passed unchanged against the beta.
- **No cluster aggregation** (`AggregatorRegistry`): no production stack runs Node's `cluster` module, and Kuzzle nodes are scraped one by one. To add when a service needs it.
- **Functional tests overwrite `node_modules`**: the `kuzzle-runner` container runs `npm ci` in the mounted repository. On macOS, run them in the container and `npm ci` again afterwards (both repositories document it).
- **Stacked PRs, one beta**: merging #3 into #2's branch first, then #2 into `1-dev`, produced a single `1.0.0-beta.1`.
- **npm processing delay**: after the publish, the version stayed 404 on the registry for a few minutes (`Your package is being processed`).
- **Links to `kuzzle-prometheus` docs point to `1-dev`** until 1.0.0 is on `master`; switch them to `master` at the release.
- The 4.x branch `feat/add-request-duration-bucket-config` was a reference only for the request buckets.

## Validation

- `kuzzle-prometheus`: `npm test` (lint, types, 38 unit tests), functional tests 6/6 locally (Node 24) and in CI (Node 22, 24); `npm pack --dry-run` ships `dist/` and `docs/`.
- `kuzzle-plugin-prometheus`: build, lint, unit tests 2/2, functional tests 4/4 against `kuzzle-prometheus@1.0.0-beta.1` (unchanged since 5.0), doc budgets.
- Demo stack (3 Kuzzle 2.59.0 nodes with `kuzzle-plugin-prometheus@5.1.0-beta.1` → `kuzzle-prometheus@1.0.0-beta.1`, Prometheus, Grafana):
  - `/_metrics?format=prometheus` and `/_/metrics` answer `200` in the Prometheus text format;
  - Prometheus scrapes the 3 nodes, each exposing only its own series, with `project`, `environment` and `nodeId`; request counts per node and status match the traffic sent;
  - an application counter declared on `plugin.metrics` (with `prefix`) is exposed with the same labels; with `maxLabelSets: 3`, extra combinations are dropped, counted in `kuzzle_prometheus_label_sets_rejected_total` and warned once per node in Kuzzle's logs;
  - every panel query of both Grafana dashboards returns data.
