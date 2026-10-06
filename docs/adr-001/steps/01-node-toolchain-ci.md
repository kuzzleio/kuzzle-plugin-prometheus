# Step 01 — Node 20/22/24 toolchain and CI

**Status:** 🟦 In progress — local validation done, waiting for the PR's CI
**Dates:** started 2026-10-06
**PR(s):** —
**ADR:** [ADR-0001](../ADR-0001-maintenance-baseline.md)

## Goal

The plugin installs, builds, lints and passes its unit and functional tests on Node 20, 22 and 24, locally and in CI, and declares that range in `package.json`.

Scope: `engines`, the GitHub workflows (runners, action versions, Node matrix, dev branch), the Docker Compose stack used by the functional tests, and the dependency bumps strictly needed to install on these runtimes. The general dependency refresh is step 02.

## What was done

- **Baseline on `master` (4.2.1)**: nothing worked on a target runtime. `npm ci` failed on Node 20 (`kuzzle` 2.28.0 pulls `boost-geospatial-index`, whose `node-gyp` build fails), the unit tests could not start on any version (`.mocharc.json` loaded `ts-node/esm` in a CommonJS project), and CI ran Node 18.17.1 on retired `ubuntu-20.04` runners.
- **`kuzzle` devDependency 2.28.0 → 2.59.0** (exact pin): installs without native build on 20/22/24.
- **`package-lock.json` regenerated with npm 11** (Node 24): the npm 10 lockfile lacked the optional `fsevents` entry, which npm 11's `npm ci` rejects. Resolutions unchanged (`--package-lock-only`).
- **`engines.node`: `^20.19.0 || ^22.12.0 || ^24.0.0`** — see gotchas for why not Kuzzle's `>=20.0.0`. `.nvmrc` pins 24 for local work.
- **Unit tests**: `.mocharc.json` uses `require: ts-node/register`; the obsolete `tests/unit/mocha.opts` (ignored since mocha 8) is removed.
- **Functional stack**: `docker-compose.yml` runs `kuzzleio/kuzzle-runner:${NODE_VERSION:-24}-trixie-slim`; obsolete `version:` key removed.
- **CI**: a reusable `tests.workflow.yml` (lint on 24; unit and functional tests on a 20/22/24 matrix; `ubuntu-24.04`; `actions/checkout@v4`, `setup-node@v4` with its npm cache) called by `pull_request`, `push_dev` (now `5-dev` and `4-dev`) and `push_master`. The manual `npm publish` in `push_master` is kept, on Node 24, until step 03. The functional-tests action passes `NODE_VERSION` to Compose and uses `up --wait`.

## Local decisions / gotchas

- **Node floor is 20.19 / 22.12, not 20.0**: Kuzzle 2.59.0 `require()`s `uuid` 13, which is ESM-only; `require(esm)` exists unflagged only from Node 20.19.0 and 22.12.0. On 20.18, `require('kuzzle')` throws `ERR_REQUIRE_ESM`. Kuzzle's own `engines` (`>=20.0.0`) is too loose — to report upstream.
- **`kuzzle-runner:<major>` (bookworm) cannot run Kuzzle 2.59 on 20/22**: uWebSockets.js 20.56 needs glibc 2.38, bookworm ships 2.36. Use the `-trixie-slim` tags (as `kuzzleio/kuzzle` does).
- The `kuzzle-installer` service runs `npm ci` into the mounted repository: after a local functional run, the host `node_modules` holds Linux binaries — rerun `npm ci` on the host.
- Node 24 prints a `MODULE_TYPELESS_PACKAGE_JSON` warning during the unit tests; harmless, left for step 02.

## Validation

Local, 2026-10-06:

| Check | Node 20.20 | Node 22 | Node 24 |
| --- | --- | --- | --- |
| `npm ci` + `npm run build` | ✅ | ✅ | ✅ |
| `npm run test:lint` | ✅ | — | ✅ |
| unit tests (15) | ✅ | ✅ | ✅ |
| functional tests (4), Docker stack on that Node | ✅ | ✅ | ✅ |

Remaining: CI green on the PR to `5-dev`.
