# Development

## Prerequisites

- Node.js 24 (`.nvmrc`; `nvm use`). The plugin supports 22.12+ and 24; CI tests both.
- Docker with Compose v2, for the local stack and the functional tests.

```sh
npm ci
npm run build   # tsc: emits index.js and index.d.ts
```

## Where the code lives

The plugin's code is in [`kuzzle-prometheus`](https://github.com/kuzzleio/kuzzle-prometheus) (`src/kuzzle/`), with its unit and functional tests: a fix or a feature goes there first (see its `AGENTS.md`), then reaches this package through a bump of the `kuzzle-prometheus` dependency. This repository holds the re-export, the integration guide, the Grafana dashboards, the local stack, and the ADRs of the effort.

## Repository layout

| Path | Content |
| --- | --- |
| `index.ts` | Package entry point: re-exports `kuzzle-prometheus/kuzzle`. |
| `application/app.ts` | The Kuzzle application of the local stack: the plugin, plus a `testing:failure` action that always fails (500), to produce errors. |
| `tests/unit/` | Checks the re-export (Vitest). The plugin's unit tests live in `kuzzle-prometheus`. |
| `tests/functional/` | Functional tests (Vitest) against the running stack, over HTTP and WebSocket: they guard the contract (metric names, routes, labels) of the released package. |
| `config/` | Configuration of the local stack: `kuzzlerc` (plugin configuration), `prometheus.yml`, Grafana datasource and dashboards. |
| `docs/` | This documentation, and the ADRs (`docs/adr-<n>/`). |
| `changelogs/` | Changelogs per release channel, written by semantic-release. Do not edit. |

The root `.kuzzlerc` is intentionally empty and tracked: it is where the Kuzzle container mounts `config/kuzzlerc`. Edit `config/kuzzlerc`, not this file.

## Local stack

```sh
docker compose up -d --wait
```

| Service | Role | Address |
| --- | --- | --- |
| `kuzzle-installer` | runs `npm ci` in the mounted repository, then exits | — |
| `kuzzle` | Kuzzle running `application/app.ts` with `tsx watch` | through Traefik |
| `traefik` | load balancer in front of the Kuzzle replicas | <http://localhost:7512> (HTTP, WebSocket), `localhost:1883` (MQTT) |
| `elasticsearch`, `redis` | Kuzzle's storage | `localhost:9200`, `localhost:6379` |
| `prometheus` | scrapes the Kuzzle containers directly (`config/prometheus.yml`) | <http://localhost:9090> |
| `grafana` | dashboards of `config/grafana/dashboards/`, provisioned | <http://localhost:3000> (`admin` / `admin`) |

`config/prometheus.yml` lists three Kuzzle containers. To test a cluster, start three replicas; with one, Prometheus shows two targets down:

```sh
docker compose up -d --wait --scale kuzzle=3
```

Then make requests (`curl http://localhost:7512/_now`, the Admin Console, an SDK) and watch the dashboards. `GET http://localhost:7512/_/testing/failure` produces a 500.

The Kuzzle image follows `NODE_VERSION` (22 or 24; default 24): `NODE_VERSION=22 docker compose up -d --wait`. The images are `kuzzleio/kuzzle-runner:<major>-trixie-slim`: the bookworm-based tags lack the glibc 2.38 that Kuzzle 2.59's uWebSockets.js needs.

Stop with `docker compose down`.

> **macOS and Windows**: `kuzzle-installer` installs Linux binaries in the mounted `node_modules`. After using the stack, run `npm ci` again on the host before running anything locally.

## Tests

| Command | What it runs |
| --- | --- |
| `npm run test:lint` | ESLint 10 with [`eslint-plugin-kuzzle`](https://github.com/kuzzleio/eslint-plugin-kuzzle) and its Prettier style (`npm run test:lint:fix` fixes what it can). |
| `npm run test:types` | TypeScript check of the plugin, the demo application and the tests (`tsconfig.check.json`); the build only covers `index.ts`. |
| `npm run test:unit` | Vitest, project `unit`. No stack needed. |
| `npm run test:functional` | Vitest, project `functional`, against the stack on `localhost:7512`, which must be up. |
| `npm test` | All three. |

On macOS, the host cannot run the functional tests once the stack has installed Linux binaries; run them in the container:

```sh
docker compose exec -T kuzzle npx vitest run --project functional
```

CI (`.github/workflows/tests.workflow.yml`) runs the lint and the TypeScript check on Node 24, and the unit and functional tests on Node 22 and 24, on every pull request and on every push to a development or release branch.

## Branches

| Branch | Role |
| --- | --- |
| `5-dev` | Integration branch of 5.x: open pull requests against it. Each merge publishes a prerelease. |
| `master` | 5.x releases. Receives `5-dev` when a release is ready. |
| `4-dev`, `4-stable` | Maintenance of 4.x: fixes go to `4-dev` by pull request, then to `4-stable`. |

## Commits and releases

Releases are fully automated by [semantic-release](https://semantic-release.gitbook.io) (shared configuration [`semantic-release-config-kuzzle`](https://github.com/kuzzleio/semantic-release-config-kuzzle), `.releaserc.json`). Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org): they decide the next version.

| Commit | Release |
| --- | --- |
| `fix: …`, `perf: …`, `revert: …` | patch |
| `feat: …`, `chore(deps): …` | minor |
| `feat!: …`, or a `BREAKING CHANGE:` footer | major |
| `docs:`, `test:`, `ci:`, `style:`, `refactor:`, `build:`, other `chore:` | none |

Every push to a release branch runs the tests, then the release (`.github/workflows/release.workflow.yml`):

| Branch | Version | npm dist-tag |
| --- | --- | --- |
| `master` | `5.x.y` | `latest` |
| `5-dev` | `5.x.y-beta.N` | `beta` |
| `4-stable` | `4.x.y` | `release-4.x` |

A release bumps `package.json`, writes `changelogs/CHANGELOG_<branch>.md`, pushes a `chore(release): …` commit and a `v<version>` tag, publishes to npm, and creates a GitHub release. Do not bump the version by hand.

npm publication uses [trusted publishing](https://docs.npmjs.com/trusted-publishers): npm accepts the GitHub Actions OIDC token of `release.workflow.yml` and attaches a provenance attestation; there is no npm token. Renaming that workflow file breaks publication until the trusted publisher setting on npmjs.com is updated.

`4-stable` releases only once it has its own copy of `.releaserc.json` and of the release workflow, and only after `master` has published 5.0.0.

To preview the next version locally, without publishing (needs Node ≥ 22.14, from a checkout of a release branch, with push access to the repository):

```sh
npm install --no-save semantic-release-config-kuzzle@1.7.3
npx semantic-release --dry-run --no-ci
```

## Architecture decisions

Significant changes are planned and tracked as ADRs under `docs/adr-<n>/`; `docs/adr-state.json` holds their current state. CI checks that state and the size budgets of the documentation (`docs/doc-budgets.json`).
