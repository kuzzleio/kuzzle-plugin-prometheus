# ADR-0001: Maintenance baseline — Node.js 20/22/24, dependencies, release pipeline, documentation

**Status:** Accepted
**Date:** 2026-10-06
**Deciders:** Ricky (Kuzzle team)
**Related documents:** [ADR-0002 — generic Prometheus module](../adr-002/ADR-0002-generic-prometheus-module.md) (the work this baseline prepares)

## Decision

### Context

The plugin (`kuzzle-plugin-prometheus`, npm `latest` 4.2.1, ~450 lines of TypeScript in `lib/`) works, but everything around it has aged:

- **Runtime**: CI runs Node **18.17.1** (EOL since April 2025) on `ubuntu-20.04` runners (retired by GitHub), with `actions/checkout@v3` / `actions/cache@v3`. `package.json` declares no `engines`, so the supported Node versions are stated nowhere.
- **Dependencies**: pinned in early 2024 — `prom-client` 15.1.0, `typescript` 5.3, `@types/node` 20.11, `kuzzle` 2.28.0 as a devDependency only (Kuzzle is at 2.59.0). Kuzzle itself is not declared as a peer dependency, so nothing tells an application which Kuzzle versions the plugin supports.
- **Release**: there is **no semantic-release** in this repo. `push_master.workflow.yml` runs `npm publish` with a long-lived `NPM_TOKEN` secret on every push to `master`; the version is bumped by hand, there is no changelog, no GitHub release, no provenance. `push_dev.workflow.yml` still targets `3-dev`.
- **Documentation**: a single `README.md` (~12 KB) whose compatibility matrix stops at "Kuzzle 4.x", with no reference of the exposed metrics, of every configuration key, nor of how the plugin behaves in a cluster.

ADR-0002 will make this plugin the default monitoring of the IoT platform and extract a framework-agnostic Prometheus module from it. Doing that on top of an unreleasable, undocumented base would multiply the debt.

### Decision

Bring the repository back to a sound, documented, automatically released baseline **before** any functional change:

1. **Node.js 20, 22 and 24** are the supported runtimes — Kuzzle's range, with the floor Kuzzle 2.59 actually needs: `"engines": { "node": "^20.19.0 || ^22.12.0 || ^24.0.0" }`. CI tests the three; build and release run on 24.
2. **Dependencies** are brought to their current versions, Kuzzle is declared as a `peerDependency` with an explicit range, and unused dependencies are removed.
3. **Releases go through semantic-release** with the shared [`semantic-release-config-kuzzle`](https://github.com/kuzzleio/semantic-release-config-kuzzle) config, as on `kuzzleio/kuzzle`, and **publish to npm through OIDC trusted publishing** (GitHub Actions `id-token: write`, no `NPM_TOKEN` secret, provenance attached). Versions and changelogs come from Conventional Commits.
4. **Documentation** becomes exhaustive and explicit: every configuration key (type, default, effect), every exported metric (name, type, labels, meaning), installation per deployment mode, cluster behaviour, troubleshooting, upgrade guides.

No change to the plugin's runtime behaviour or to its metrics is in scope: that belongs to ADR-0002.

### Consequences

- Node 18 users can no longer install a new version once `engines` is declared: the baseline ships as **5.0.0**, with a 4.x → 5.x upgrade guide.
- Every merge to the release branch produces a version, a changelog and a GitHub release without manual steps; the `NPM_TOKEN` secret can be revoked.
- Commits must follow Conventional Commits, or they release nothing.
- The documentation becomes the contract ADR-0002 must preserve (metric names, config keys).

## Cold start

- ADR accepted on 2026-10-06 (5.0.0, `5-dev` → `master`, `4-stable` for 4.x, docs in the repo). Branches `5-dev` and `4-stable` exist.
- Step 01 done (#37): installs, builds and passes every test on Node 20/22/24, CI matrix in place.
- Step 02 done (#38): Vitest, ESLint 10, TypeScript 6, Kuzzle peer `>=2.59.0 <3.0.0`; emitted JS unchanged.
- Step 03 done (#40): semantic-release with npm trusted publishing; `5.0.0-beta.1` published from `5-dev` with provenance, no npm token.
- Step 04 open: documentation overhaul.
- Step 04: inventory done; three bugs it found fixed (#42, #43); README + `docs/` reference written and checked on a live stack, in review.
- **Next action:** merge #43 (step 04 docs) into `5-dev`, freeze step 04, then merge `5-dev` into `master` to release 5.0.0 and close this ADR.

## Steps

| # | Step | Status | PR(s) | Detail |
| --- | --- | --- | --- | --- |
| 01 | Node 20/22/24 toolchain and CI (engines, test matrix, runners, actions) | ✅ Done | #37 | [detail](steps/01-node-toolchain-ci.md) |
| 02 | Dependency refresh (prom-client, Kuzzle peer range, dev tooling, cleanup) | ✅ Done | #38 | [detail](steps/02-dependency-refresh.md) |
| 03 | semantic-release + npm OIDC trusted publishing | ✅ Done | #40 | [detail](steps/03-semantic-release-oidc.md) |
| 04 | Documentation overhaul (README + `docs/` reference) | 🟦 In progress | #42, #43 | [detail](steps/04-documentation.md) |

Order: the CI must be green on the target runtimes before dependencies move (01 → 02); the release pipeline ships the result (03); the documentation describes the final state (04), though it may start earlier in parallel.

## Decision register

- 2026-10-06 — Supported runtimes are Node 20, 22 and 24, aligned on Kuzzle's `engines` range.
- 2026-10-06 — Releases move to semantic-release (`semantic-release-config-kuzzle`) with npm OIDC trusted publishing; no npm token in the repo secrets.
- 2026-10-06 — This ADR changes no runtime behaviour; functional work goes to ADR-0002.
- 2026-10-06 — Node floor is 20.19 / 22.12: Kuzzle 2.59 needs `require(esm)` ([step 01](steps/01-node-toolchain-ci.md)).
- 2026-10-06 — Kuzzle is a peer dependency, `>=2.59.0 <3.0.0`: the only tested version ([step 02](steps/02-dependency-refresh.md)).
- 2026-10-06 — Tests run on Vitest (unit and functional), lint on ESLint 10 + `eslint-plugin-kuzzle` 2 with Kuzzle's Prettier style ([step 02](steps/02-dependency-refresh.md)).
- 2026-10-06 — The baseline ships as **5.0.0** (Node 18 dropped, Kuzzle peer range declared), with an upgrade guide.
- 2026-10-06 — Branch model, one dev/stable pair per major: `5-dev` is the integration branch (PR base, prereleases), `master` releases `latest` (5.x); `4-stable` and `4-dev` (both cut from `master` at 4.2.1) keep the 4.x line for maintenance. Supersedes the `master` + `beta` model first chosen the same day.
- 2026-10-06 — Documentation lives in the repository: `README.md` for getting started, the full reference in `.md` files under `docs/`; no `doc/<major>/` tree on docs.kuzzle.io.
- 2026-10-06 — Release channels: `master` → `latest`; `5-dev` → `5.x.y-beta.N` on dist-tag `beta`; `4-stable` → 4.x fixes on dist-tag `release-4.x` (maintenance range `4.x`). `4-dev` does not release. The release commit is pushed with the Kuzzle GitHub App token ([step 03](steps/03-semantic-release-oidc.md)).
- 2026-10-06 — Exception to "no runtime behaviour change": bugs found while documenting are fixed (request hooks with `monitorRequestDuration: false`, manifest `kuzzleVersion`); new features, such as configurable request buckets, go to ADR-0002 ([step 04](steps/04-documentation.md)).

## Open points

- **Node 20** is EOL since April 2026: kept because Kuzzle still supports it; to drop when Kuzzle does.
- **TypeScript `strict`** is off (7 errors): to enable in ADR-0002.
- **Kuzzle's `engines` is too loose** (`>=20.0.0`, while 2.59 fails on < 20.19): to report on `kuzzleio/kuzzle`.
- **`NPM_TOKEN`** is no longer used by this repository: to revoke (or remove from its scope) once no other repo depends on it.
- **4.x releases need a backport**: `4-stable` releases only once its own copy of `.releaserc.json` and the release workflow exist, and not before `master` has published 5.0.0 (semantic-release refuses 4.2.2 while both branches share 4.2.1 as latest release).

## References

- Kuzzle's release workflow: `kuzzleio/kuzzle` → `.github/workflows/semantic-release.workflow.yaml`, `.releaserc.json`
- npm trusted publishing: <https://docs.npmjs.com/trusted-publishers>
- Node.js release schedule: <https://nodejs.org/en/about/previous-releases>
