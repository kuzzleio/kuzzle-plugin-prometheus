# Step 03 — Extract the module into `kuzzle-prometheus`

**Status:** 🟦 In progress
**Dates:** 2026-10-08 → …
**PR(s):** —
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

## Local decisions / gotchas

- **First `feat` on `kuzzle-prometheus` `master` publishes 1.0.0** as `latest`, replacing the bootstrap placeholder.
- **Bot App permissions unchecked**: the step 02 failure could not open its issue (`Label "semantic-release" … invalid`). Watch the first failing Release run, or check the App's Issues permission beforehand.
- The 4.x branch `feat/add-request-duration-bucket-config` is a reference only for the request buckets.

## Validation

—
