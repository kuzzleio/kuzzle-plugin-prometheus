# ADR-0002: A generic Prometheus module, and the Kuzzle plugin built on it

**Status:** Proposed
**Date:** 2026-10-06
**Deciders:** Ricky (Kuzzle team)
**Related documents:** [ADR-0001 — maintenance baseline](../adr-001/ADR-0001-maintenance-baseline.md) (prerequisite)

> **Premises only.** This ADR records the goal so it is not lost while ADR-0001 runs. Context, options and decision are to be written when ADR-0001 closes.

## Decision

### Context (to be completed)

- The plugin's metric collection and exposition logic (`lib/services/MetricService.ts`, `prom-client` registry, default and request metrics) is bound to the Kuzzle plugin API (`lib/PrometheusPlugin.ts`).
- The IoT platform packages do not use this plugin by default today; monitoring is set up per project, if at all.
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

## Cold start

- Premises written on 2026-10-06. Nothing to do until ADR-0001 closes.
- **Next action:** none — waits for ADR-0001.

## Steps

No step defined yet.

## Decision register

- 2026-10-06 — Goal recorded: generic module + plugin built on it + default in the IoT platform; design deferred until ADR-0001 is closed.

## Open points

See "Questions to settle".

## References

- [`prom-client`](https://github.com/siimon/prom-client)
