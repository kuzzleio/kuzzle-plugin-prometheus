# Step 01 — TypeScript `strict` on the current code

**Status:** ✅ Done — merged into `5-dev` (#53), frozen
**Dates:** 2026-10-06 → 2026-10-06
**PR(s):** [#53](https://github.com/kuzzleio/kuzzle-plugin-prometheus/pull/53)
**ADR:** [ADR-0002](../ADR-0002-generic-prometheus-module.md)

## Goal

The code compiles with `"strict": true` before it is extracted into `kuzzle-prometheus` (step 03), so that the extraction starts from typed code. No change to the exported metrics or to the configuration.

## What was done

- `tsconfig.json`: `"strict": true`. The compiler reported **11 errors** (ADR-0001 had counted 7), all in `lib/`.
- `PrometheusPlugin`:
  - `metricService` is declared with a definite assignment (`!`): it is created in `init()`, not in the constructor.
  - `nodeId` is added to `config.labels` by building a new object, since `labels` is optional in the configuration type.
  - The request duration labels `action`, `controller` and `protocol` (typed `string | null` by Kuzzle) go through `String()`. prom-client already exported a `null` value as `"null"`, so the output is unchanged.
  - `metrics()` returns `Promise<string | undefined>`, which matches what it already did outside HTTP.
- `MetricService`:
  - `labels` defaults to `{}`.
  - `updateCoreMetrics()` looks up each gauge through an indexable view of the core metrics.
  - `recordResponseTime()` uses `?.` on the request duration histogram, which only exists when `monitorRequestDuration` is on (the hook is not registered otherwise).

## Local decisions / gotchas

- **One behaviour change, deliberate**: a component in the `server:metrics` response that the plugin does not know about is now skipped. Before, `this.metrics.core[component][metric]` threw a `TypeError` on it. Kuzzle 2.59 only returns known components, so this never happened in the tests.
- **Functional tests on macOS**: the Docker Compose stack runs `npm ci` inside a Linux container on the mounted repository, which replaces the host's native bindings (rolldown) in `node_modules`. To run vitest from the host, install the darwin binding with `npm i --no-save @rolldown/binding-darwin-arm64@<rolldown version>` while the stack is up, then run `npm ci` once it is down. CI runs on Linux and is not affected.

## Validation

- `tsc --noEmit` and `npm run build`: OK in `strict`.
- `eslint .`: 0 errors (the 40 `sort-keys` warnings predate this step).
- Unit tests: 17/17. Functional tests (Docker stack, Node 22): 4/4.
