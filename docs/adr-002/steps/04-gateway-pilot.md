# Step 04 — Pilot: the HTTP/TCP gateway on the module

**Status:** 🟦 In progress
**Dates:** 2026-10-08 → …
**PR(s):** [kuzzle-prometheus#5](https://github.com/kuzzleio/kuzzle-prometheus/pull/5), the gateway's migration PR (private repository)
**ADR:** [ADR-0002](../ADR-0002-generic-prometheus-module.md)

## Goal

The HTTP/TCP ingestion gateway, a Node service outside Kuzzle, exposes its metrics through `kuzzle-prometheus` instead of its own `prom-client` setup:

- one `createMetrics()` instance, served on the gateway's existing `/metrics` route (Fastify);
- its `gateway_ingestor_*` metrics declared through the typed API, **names unchanged**, so that existing dashboards keep working;
- common labels `project` / `environment` / `service` from the `KUZZLE_PROMETHEUS_*` variables;
- first use of the module in a real service: it validates `kuzzle-prometheus@1.0.0-beta` before 1.0.0.

## What was done

- 2026-10-08 — Step opened.
- 2026-10-08 — Inventory: 18 metrics (ingestor, worker, one shared gauge), all compliant with the naming rules; labels `protocol`, `reason`, `result`, all bounded; `inc` / `dec` / `set` / `startTimer` used as the module offers them; histograms on the default buckets, which the module keeps. One gap: two gauges set at scrape time through `prom-client`'s `collect`.
- 2026-10-08 — Module: gauge `collect` callback (kuzzle-prometheus#5, `1.0.0-beta.2`), sync or async, a failure logged without failing the scrape.
- 2026-10-08 — Gateway migrated: its Fastify plugin creates the instance (`prefix: "gateway_"`, `service` per app) and serves `render()`; metrics declared on it with unchanged names; `prom-client` removed. Draft PR opened on the gateway's repository, on `kuzzle-prometheus@1.0.0-beta.2`: it stays a draft until the production versions (1.0.0, then without the `minimumReleaseAgeExclude` entry).

- 2026-10-08 — Review pass on both repositories before the real-application test: the plugin moves to `kuzzle-prometheus@1.0.0-beta.2` (it was on beta.1, without the gauge `collect`); `docs/upgrading.md` documents the plugin API change and pins Node 20 users to `~5.0`.

## Local decisions / gotchas

- **Names unchanged versus naming rules**: the module enforces snake_case, `_total` on counters and no common label in `labelNames` at declaration. Inventory the gateway's metrics first; a name the rules reject needs a decision (rename, which breaks dashboards, or a change in the module) before migrating. Outcome: every name complies.
- **`prefix: "gateway_"`** rather than full names: the shared `gateway_rabbitmq_connected` rules out a per-app prefix.
- **pnpm `minimumReleaseAge`** (7 days) in the gateway refuses a fresh beta: `kuzzle-prometheus` is listed in `minimumReleaseAgeExclude`.
- **The module is CommonJS, the gateway ESM** (`"type": "module"`, TypeScript `nodenext`): named imports work, nothing to change.

## Validation

- Gateway: types, lint, format, 27 tests.
- Ingestor run against RabbitMQ with HTTP and TCP traffic, `/metrics` compared with `main`: same names, labels, buckets and values; added: `service="ingestor"`, the event loop utilization metrics, and the Prometheus `Content-Type`. Rerun on the published `1.0.0-beta.2`: same result, `collect` gauges set.
- Worker run in Docker (the gateway's `Dockerfile.dev`) against RabbitMQ and this repository's demo Kuzzle 2.59: every worker metric recorded with `service="worker"` (consumed, parse duration, invalid, dead-lettered, Kuzzle query duration and outcome, requeued, backoff, RabbitMQ connection). Outside Docker, `tsx` on Node 24.11 fails on a `kuzzle-sdk` named import, on the gateway's `main` too: unrelated to the migration.
