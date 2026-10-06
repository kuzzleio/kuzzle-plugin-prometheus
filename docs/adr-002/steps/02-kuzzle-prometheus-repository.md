# Step 02 — The `kuzzle-prometheus` repository

**Status:** 🟦 In progress
**Dates:** 2026-10-06 → …
**PR(s):** [kuzzle-prometheus#1](https://github.com/kuzzleio/kuzzle-prometheus/pull/1)
**ADR:** [ADR-0002](../ADR-0002-generic-prometheus-module.md)

## Goal

[`kuzzleio/kuzzle-prometheus`](https://github.com/kuzzleio/kuzzle-prometheus) exists with the ADR-0001 baseline before any code moves into it (step 03): TypeScript `strict`, Node 22/24 CI, lint, unit tests, semantic-release with npm OIDC trusted publishing, and the `.` / `./kuzzle` exports skeleton modelled on [`kuzzle-logger`](https://github.com/kuzzleio/kuzzle-logger).

## What was done

- 2026-10-06 — Repository created: public, Apache-2.0 license, default branch `master`.
- 2026-10-06 — Bootstrap PR (kuzzle-prometheus#1):
  - entry points `src/index.ts` (`.`) and `src/kuzzle/index.ts` (`./kuzzle`), exported through `exports` and `typesVersions`; Kuzzle is an optional peer dependency;
  - TypeScript `strict`, ESLint (`eslint-plugin-kuzzle`), Vitest, with the toolchain versions of this repository;
  - CI: lint and types once on Node 24, unit tests on Node 22 and 24;
  - release workflow copied from this repository: semantic-release, `master` → `latest`, `<N>-dev` → `beta`, npm OIDC trusted publishing.

## Local decisions / gotchas

- **Tooling follows this repository, layout follows `kuzzle-logger`.** `kuzzle-logger` still runs Node 20, ESLint 9 and an npm token; the ADR-0001 baseline is the reference.
- **Nothing is released yet**: the bootstrap is a `chore:` commit. The skeleton only exports the common label names.
- **Before the first `feat`/`fix` on `master`**: register the npm trusted publisher for `kuzzle-prometheus` (it needs the package to exist on npm, hence a first manual publish), and check that the Kuzzle bot GitHub App is installed on the repository. The org-level secrets (`KUZZLE_BOT_PRIVATE_KEY`, `SEMANTIC_RELEASE_SLACK_WEBHOOK`) and variable (`KUZZLE_BOT_APP_ID`) are visible to all repositories.
- `vitest.config.ts` stays out of `tsconfig.json`: the package is CommonJS, and `vitest/config` is ESM only.

## Validation

- Local: `eslint .`, `tsc --noEmit`, unit tests 1/1, `npm run build` (`dist/index.js`, `dist/kuzzle/index.js`), `npm pack --dry-run`.
