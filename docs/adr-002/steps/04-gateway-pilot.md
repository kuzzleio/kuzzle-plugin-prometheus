# Step 04 — Pilot: the HTTP/TCP gateway on the module

**Status:** 🟦 In progress
**Dates:** 2026-10-08 → …
**PR(s):** —
**ADR:** [ADR-0002](../ADR-0002-generic-prometheus-module.md)

## Goal

The HTTP/TCP ingestion gateway, a Node service outside Kuzzle, exposes its metrics through `kuzzle-prometheus` instead of its own `prom-client` setup:

- one `createMetrics()` instance, served on the gateway's existing `/metrics` route (Fastify);
- its `gateway_ingestor_*` metrics declared through the typed API, **names unchanged**, so that existing dashboards keep working;
- common labels `project` / `environment` / `service` from the `KUZZLE_PROMETHEUS_*` variables;
- first use of the module in a real service: it validates `kuzzle-prometheus@1.0.0-beta` before 1.0.0.

## What was done

- 2026-10-08 — Step opened.

## Local decisions / gotchas

- **Names unchanged versus naming rules**: the module enforces snake_case, `_total` on counters and no common label in `labelNames` at declaration. Inventory the gateway's metrics first; a name the rules reject needs a decision (rename, which breaks dashboards, or a change in the module) before migrating.

## Validation

- To do: the gateway's tests pass; its `/metrics` renders the same metric names and labels as before, plus the common labels and the Node.js metrics.
