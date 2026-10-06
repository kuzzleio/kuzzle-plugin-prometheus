# ADR-0002: A generic Prometheus module, and the Kuzzle plugin built on it

**Status:** Proposed
**Date:** 2026-10-06
**Deciders:** Ricky (Kuzzle team)
**Related documents:** [ADR-0001 — maintenance baseline](../adr-001/ADR-0001-maintenance-baseline.md) (prerequisite)

> **Premises only.** This ADR records the goal. ADR-0001 closed on 2026-10-06 (5.0.0 released): context, options and decision are now to be written.

## Decision

### Context (to be completed)

- The plugin's metric collection and exposition logic (`lib/services/MetricService.ts`, `prom-client` registry, default and request metrics) is bound to the Kuzzle plugin API (`lib/PrometheusPlugin.ts`).
- The IoT platform packages do not use this plugin by default today; monitoring is set up per project, if at all.
- `prom-client` 15.1.3 is marked deprecated on npm ("replaced by `@prometheus-io/client`", seen 2026-10-06): the generic module should be built on its successor, or justify staying.
- Other Kuzzle-team stacks are not Kuzzle plugins (standalone Node services, workers…) and have no shared way to expose Prometheus metrics.

### Goals

1. **Default monitoring of the IoT platform**: the IoT platform packages load the plugin by default, with a configuration that works without tuning.
2. **A framework-agnostic Prometheus module**: a package usable by any Node.js stack (registry, default metrics, HTTP exposition, cluster aggregation, naming conventions), with no dependency on Kuzzle.
3. **The plugin inherits from the module**: `kuzzle-plugin-prometheus` becomes a thin Kuzzle adapter (hooks, pipes, controller, Kuzzle-specific metrics) over the module, so the logic lives in one place.

### Questions to settle

- Inheritance or composition between the plugin and the module (`class PrometheusPlugin extends …` vs. the plugin owning a module instance)?
- Package layout: a separate repository, or an npm workspace in this one (module + plugin)? Package name and scope?
- What exactly is generic (registry, `/metrics` handler, cluster aggregation, label conventions) and what stays Kuzzle-specific?
- Compatibility: metric names and configuration keys documented by ADR-0001 must stay stable for existing dashboards — or a migration guide ships with a major.
- How the IoT platform enables it by default, and how a project opts out.
- TypeScript `strict` is off (7 errors), handed over by ADR-0001: enable it before or while extracting the module.
- Configurable request duration buckets: the unmerged branch `feat/add-request-duration-bucket-config` (last commit 2025-11-17) implements them on the 4.x code; reuse or redo it.

## Cold start

- Premises written on 2026-10-06. ADR-0001 closed the same day: the base is 5.0.0 (`master` → `latest`, `5-dev` for prereleases), documented in `docs/`, whose metric names and config keys are the contract to preserve.
- **Next action:** write the context, options and decision, settling the "Questions to settle" with the deciders, then define the steps.

## Steps

No step defined yet.

## Decision register

- 2026-10-06 — Goal recorded: generic module + plugin built on it + default in the IoT platform; design deferred until ADR-0001 is closed.
- 2026-10-06 — ADR-0001 closed (5.0.0 released): design work unblocked.

## Open points

See "Questions to settle".

## References

- [`prom-client`](https://github.com/siimon/prom-client)
