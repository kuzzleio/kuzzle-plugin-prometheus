# Step 03 — semantic-release + npm OIDC trusted publishing

**Status:** 🟦 In progress
**Dates:** started 2026-10-06
**PR(s):** —
**ADR:** [ADR-0001](../ADR-0001-maintenance-baseline.md)

## Goal

Every merge to a release branch publishes a version to npm, a changelog and a GitHub release, without manual steps. npm authenticates the publish through GitHub's OIDC token (trusted publishing), so the `NPM_TOKEN` secret is no longer used and can be revoked.

Scope: `.releaserc.json`, the release workflow, the removal of the manual `npm publish` job from `push_master.workflow.yml`, and the npm trusted publisher configuration. The first release from `master` is 5.0.0 (the `BREAKING CHANGE` of step 02).

## Starting point

- `push_master.workflow.yml` runs the tests, then `npm publish` with `NODE_AUTH_TOKEN: secrets.NPM_TOKEN`; the version is bumped by hand in `package.json` (4.2.1).
- No `.releaserc*`; no `CHANGELOG.md`.
- Reference: `kuzzleio/kuzzle` extends [`semantic-release-config-kuzzle`](https://github.com/kuzzleio/semantic-release-config-kuzzle) (1.7.2: semantic-release 25, `@semantic-release/npm` 13, which supports trusted publishing) from `.releaserc.json`, with a release workflow granting `id-token: write` and a GitHub App token to push the release commit.

## Plan

1. `.releaserc.json` extending `semantic-release-config-kuzzle`; branches: `master` (latest 5.x), `5-dev` (prerelease).
2. A release workflow on push to the release branches: tests, then semantic-release on Node 24 with `id-token: write`, `contents: write`, `issues: write`, `pull-requests: write`; `SEMANTIC_RELEASE_NPM_PUBLISH=true`; no `NPM_TOKEN`.
3. Remove the `npm-deploy` job from `push_master.workflow.yml`.
4. An npm org admin registers the trusted publisher on npmjs.com (repository `kuzzleio/kuzzle-plugin-prometheus`, the release workflow's file name).
5. Dry run (`semantic-release --dry-run`) to check the computed version before the first real release.

## Decisions (2026-10-06)

- `5-dev` prereleases use the `beta` identifier and npm dist-tag (`5.0.0-beta.1`), as on Kuzzle.
- `4-stable` is a maintenance branch (range `4.x`, dist-tag `release-4.x`): 4.x fixes may still ship. `4-dev` does not release; it feeds `4-stable` through PRs.
- The release commit and tag are pushed with the Kuzzle GitHub App token (`vars.KUZZLE_BOT_APP_ID`, `secrets.KUZZLE_BOT_PRIVATE_KEY`, as on `kuzzleio/kuzzle`); the App is installed on this repository.

## What was done

- **`.releaserc.json`**: extends `semantic-release-config-kuzzle`; branches `4-stable` (maintenance, `4.x`, channel `release-4.x`), `master`, `5-dev` (prerelease `beta`, channel `beta`). The shared config writes one changelog per branch, `changelogs/CHANGELOG_<branch>.md`, and commits it with `package.json` and `package-lock.json`; `chore(deps):` commits release a minor.
- **`.github/workflows/release.workflow.yml`**: on push to `master`, `5-dev`, `4-stable`: the reusable tests, then semantic-release on Node 24 with `id-token: write`, `SEMANTIC_RELEASE_NPM_PUBLISH=true`, the App token as `GITHUB_TOKEN`, the Slack webhook if the secret exists. No `NPM_TOKEN`.
- **`push_master.workflow.yml` removed** (its manual `npm publish` with `NPM_TOKEN` is replaced); **`push_dev.workflow.yml`** now runs on `4-dev` only, `5-dev` being covered by the release workflow.
- **`docs/doc-budgets.json`**: `changelogs/**` is exempt (generated).

## Local decisions / gotchas

- **semantic-release is installed in the release job only** (`npm install --no-save semantic-release-config-kuzzle@1.7.3`), not as a devDependency: semantic-release 25 requires Node `^22.14.0 || >=24.10.0`, and the development install must stay valid on Node 20. Cost: Dependabot does not see it, bump it by hand.
- **No `registry-url` in `setup-node`**: it writes an `.npmrc` bound to `NODE_AUTH_TOKEN`, whose placeholder would be sent instead of the OIDC exchange. Node 24 ships npm ≥ 11.5.1, which trusted publishing requires.
- **`checkout` with `fetch-depth: 0` and `persist-credentials: false`**: semantic-release needs the full history and tags, and must push with the App token, not the persisted `GITHUB_TOKEN`.
- **A 4.x fix cannot ship before 5.0.0**: while `master` and `4-stable` share `v4.2.1` as latest release, semantic-release computes an empty range for `4-stable` and refuses `4.2.2` ("out of range"). Once `master` has published 5.0.0, it accepts it. `4-stable` also needs its own copy of `.releaserc.json` and the release workflow (GitHub runs the workflow file of the pushed branch), and a working CI: a backport PR when the first 4.x fix comes.
- **Simulating releases locally**: `semantic-release --dry-run --no-ci` force-fetches every branch from the remote, so local merges and tags are discarded. Simulate against a local bare clone (`--repository-url file://…`).
- The trusted publisher on npmjs.com is bound to the workflow file name: renaming `release.workflow.yml` breaks publication until the npm setting follows.

## Validation

Dry runs, 2026-10-06 (semantic-release 25.0.3, Node 24, existing tag `v4.2.1`):

| Branch | Simulated state | Computed version |
| --- | --- | --- |
| `5-dev` | as is | `5.0.0-beta.1` |
| `master` | as is | none (no relevant change) |
| `master` | `5-dev` merged | `5.0.0` |
| `4-stable` | a `fix:` commit | refused, out of range |
| `4-stable` | a `fix:` commit, `master` tagged `v5.0.0` | `4.2.2` |

`actionlint`: clean.

Remaining: the trusted publisher registration, then the first real prerelease from `5-dev` after the merge.
