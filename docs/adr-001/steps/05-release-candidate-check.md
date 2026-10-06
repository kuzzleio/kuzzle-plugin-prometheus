# Step 05 — Release candidate check in a fresh project

**Status:** ✅ Done — `5.0.0-beta.3` validated, frozen
**Dates:** 2026-10-06 → 2026-10-06
**PR(s):** — (no code change)
**ADR:** [ADR-0001](../ADR-0001-maintenance-baseline.md)

## Goal

Before releasing 5.0.0 as `latest`, check the release candidate as a user gets it: from npm, in a new project built from the official template, following only the documentation.

Asked by the user on 2026-10-06, after step 04.

## Setup

- Project created from [`kuzzleio/template-kuzzle-project`](https://github.com/kuzzleio/template-kuzzle-project), branch `stable` (`500436b`), in a local directory outside this repository. The template is ESM (`"type": "module"`, `NodeNext`) and already ships `kuzzle` 2.56.0 + `kuzzle-plugin-prometheus` 4.2.1: a real upgrade case.
- Docker Compose of the template (Kuzzle on `kuzzle-runner:24-trixie-slim`, Redis 8, Elasticsearch 8), plus a Prometheus service with the scrape jobs of [`docs/deployment.md`](../../deployment.md).
- Dependencies installed inside the container (the template shares `node_modules` with the host; on macOS a host install gives the container darwin binaries).

## Validation

| Check | Result |
| --- | --- |
| Baseline on 4.2.1 + Kuzzle 2.56.0: metric shape (names, types, label names) recorded | 37 metrics |
| `npm install kuzzle-plugin-prometheus@5.0.0-beta.3` with Kuzzle 2.56.0 still installed | ✅ refused, `ERESOLVE` (peer `kuzzle@">=2.59.0 <3.0.0"`), as `upgrading.md` says |
| `npm install --save-exact kuzzle@2.59.0 kuzzle-plugin-prometheus@5.0.0-beta.3`, no code change | ✅ |
| template's `build`, `test:types`, `test`, `lint` (ESM project importing the CommonJS plugin) | ✅ |
| metric shape on 5.0.0-beta.3 vs 4.2.1 | ✅ identical: same 37 metrics, types and label names |
| `/_metrics?format=prometheus` and `/_/metrics` return the same metrics | ✅ |
| production image (template `Dockerfile`: compiled ESM, `node app.js` on `node:24-trixie-slim`) | ✅ plugin loaded, both routes serve the 37 metrics |
| `.kuzzlerc`: labels, `monitorRequestDuration: false`, shorter `gcDurationBuckets` | ✅ labels on every series; no histogram and no hook error; GC buckets exactly `0.005, 0.05` |
| Prometheus jobs of `deployment.md` (one node, `/_/metrics`, authenticated) with `anonymous` open | ✅ all `up` |
| `anonymous` locked (`createFirstAdmin?reset=true`), then the role → profile → user → API key commands of `deployment.md` run verbatim | ✅ the 4 calls return 200; anonymous jobs `down` (401), authenticated job `up` |

## Local decisions / gotchas

- `nodejs_eventloop_lag_seconds` can appear without labels on the very first scrape after a start (prom-client sets it asynchronously); same on 4.2.1, not a regression.
- npm 11 warns that native packages have "install scripts not yet covered by allowScripts": a warning only, the install scripts still run.
- Follow-up outside this repository: once 5.0.0 is out, the template can move to `kuzzle` 2.59.0 and `kuzzle-plugin-prometheus` 5 with the same two-package install.
