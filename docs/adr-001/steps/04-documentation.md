# Step 04 — Documentation overhaul

**Status:** 🟦 In progress
**Dates:** started 2026-10-06
**PR(s):** —
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

## What was done

—

## Local decisions / gotchas

—

## Validation

—
