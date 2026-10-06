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

## To settle in this step

- The prerelease identifier of `5-dev` (`beta`, or the branch name) and its npm dist-tag.
- Whether `4-stable` is a semantic-release maintenance branch (range `4.x`) that publishes 4.x patches, or stays without releases.
- The token used to push the release commit (GitHub App as on Kuzzle, or `GITHUB_TOKEN` if branch protection allows it).

## What was done

—

## Local decisions / gotchas

—

## Validation

—
