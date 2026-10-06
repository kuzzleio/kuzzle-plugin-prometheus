# ADR-0001 — journal

Write-once archive of [ADR-0001](ADR-0001-maintenance-baseline.md): the hub's cold start and open points as they stood when the ADR closed (2026-10-06), evicted verbatim. Never fed, never read by a cold start.

## Cold start, last version before closing

- ADR accepted on 2026-10-06 (5.0.0, `5-dev` → `master`, `4-stable` for 4.x, docs in the repo). Branches `5-dev` and `4-stable` exist.
- Step 01 done (#37): installs, builds and passes every test on Node 20/22/24, CI matrix in place.
- Step 02 done (#38): Vitest, ESLint 10, TypeScript 6, Kuzzle peer `>=2.59.0 <3.0.0`; emitted JS unchanged.
- Step 03 done (#40): semantic-release with npm trusted publishing; `5.0.0-beta.1` published from `5-dev` with provenance, no npm token.
- Step 04 done (#42, #43): README + `docs/` reference, checked on a live stack; three bugs found on the way fixed. `5.0.0-beta.3` is the release candidate.
- Step 05 done: `5.0.0-beta.3` checked in a project made from `template-kuzzle-project` (upgrade from 4.2.1, identical metrics, production image, documented configs and permissions).
- **Next action:** merge `5-dev` into `master` (publishes 5.0.0 as `latest`), merge `master` back into `5-dev`, then close this ADR.

## Open points, last version before closing

- **Node 20** is EOL since April 2026: kept because Kuzzle still supports it; to drop when Kuzzle does.
- **TypeScript `strict`** is off (7 errors): to enable in ADR-0002.
- **Kuzzle's `engines` is too loose** (`>=20.0.0`, while 2.59 fails on < 20.19): to report on `kuzzleio/kuzzle`.
- **`NPM_TOKEN`** is no longer used by this repository: to revoke (or remove from its scope) once no other repo depends on it.
- **4.x releases need a backport**: `4-stable` releases only once its own copy of `.releaserc.json` and the release workflow exist, and not before `master` has published 5.0.0 (semantic-release refuses 4.2.2 while both branches share 4.2.1 as latest release).
