# Step 02 — Dependency refresh

**Status:** 🟦 In progress
**Dates:** started 2026-10-06
**PR(s):** [#38](https://github.com/kuzzleio/kuzzle-plugin-prometheus/pull/38)
**ADR:** [ADR-0001](../ADR-0001-maintenance-baseline.md)

## Goal

Every dependency is current, used, and declared where it belongs: runtime dependencies minimal, Kuzzle as a `peerDependency` with an explicit range, dev tooling aligned with `kuzzleio/kuzzle` where it makes sense.

## What was done

- Inventory on `5-dev` after step 01 (`npm outdated`, imports grep):
  - runtime: `prom-client` 15.1.0 (15.1.3), `lodash` 4.17.21 (4.18.1) — used once, for `_.merge` of the configuration.
  - `kuzzle` is imported at runtime (`Plugin`, `KuzzleRequest`) but declared as a devDependency only.
  - unused devDependencies: `rewire`, `mock-require`, `should`, `should-sinon`, `nyc`, `@jest/globals`, `kuzzle-sdk`, `lodash` (duplicate of the runtime one).
  - lint: ESLint 8 (EOL) and `@typescript-eslint` 5 only reach the repo transitively through `eslint-plugin-kuzzle` 0.0.12 (latest 2.0.0: flat config, ESLint 9/10, TypeScript < 6.1).
  - tests: mocha 10 + chai 4 + sinon 17 (unit), jest 29 + ts-jest + `node-fetch` 2.0.0 + `ws` (functional). Kuzzle moved to vitest 4.
  - TypeScript 5.3.3 (latest 7.0, outside `eslint-plugin-kuzzle`'s range); `@types/node` 20.11.

- **Runtime**: `prom-client` 15.1.0 → 15.1.3, `lodash` 4.17.21 → 4.18.1 (kept: its one `_.merge` deep-merges the configuration, and replacing it is a behaviour change, out of this ADR's scope).
- **`peerDependencies`: `kuzzle >=2.59.0 <3.0.0`** — the only version tested; projects on an older Kuzzle stay on 4.x (`4-stable`).
- **Tests on Vitest 4.1** (`vitest.config.ts`, projects `unit` and `functional`): mocha, chai, sinon, jest, ts-jest, `node-fetch` (native `fetch`) removed; the tests are converted one to one (`expect`, `vi.spyOn`, `vi.fn`), same 15 unit and 4 functional cases.
- **Lint on ESLint 10 + `eslint-plugin-kuzzle` 2.0.0**, flat config (`eslint.config.mjs`) as on Kuzzle; covers the whole repo, not only `lib/`. `.prettierrc` (single quotes) removed for the shared Prettier style: one formatting-only commit. Exceptions: `dot-notation` off in `tests/` (private members read on purpose), `no-console` off in `application/`.
- **TypeScript 6.0.3**, `@types/node` 20.19 (the lowest supported runtime). `tsconfig.json`: `module`/`moduleResolution` `node16` (CommonJS output unchanged), `target` es2022, `baseUrl` and the misplaced `rootDir` removed.
- **`npm run dev` on `tsx watch`** instead of `ergol` + `ts-node` (ergol pulled ESLint 8).
- Removed, unused: `rewire`, `mock-require`, `should`, `should-sinon`, `nyc`, `@jest/globals`, `kuzzle-sdk`, the duplicate `lodash`. `npm ci` installs 550 packages instead of 917.

## Local decisions / gotchas

- **Vitest 4.1, not 5**: Vitest 5 requires Node ≥ 22.12.
- **TypeScript 6, not 7**: `eslint-plugin-kuzzle` 2.0.0 accepts TypeScript < 6.1.
- **TypeScript 6 turns `strict` on by default**: `"strict": false` is set explicitly, the previous behaviour; the code has 7 strict errors. Enabling it is left to ADR-0002, which rewrites this code.
- **`target: es2022` emits class fields as definitions**: the plugin's `config;` field then overwrote, with `undefined`, the value Kuzzle's `Plugin` constructor sets (TS2612). `"useDefineForClassFields": false` keeps the old semantics. Checked: the emitted `index.js` / `lib/**/*.js` / `.d.ts` are identical to `5-dev`'s, source maps aside.
- **Functional tests locally on macOS**: the `kuzzle-installer` service leaves Linux binaries in the mounted `node_modules`, and Vitest's native `rolldown` binding then fails on the host. Run them in the container (`docker compose exec kuzzle npx vitest run --project functional`) or `npm ci` again on the host. CI runs on Linux and is not affected.
- **Vite resolves `.js` before `.ts`**: with a build present, `lib/*.js` sits next to the sources and a test loaded both (two `MetricService` classes, `instanceof` failing). `resolve.extensions` puts `.ts` first, and each Vitest project needs `extends: true` to inherit it.

## Validation

Local, 2026-10-06:

| Check | Node 20.20 | Node 22 | Node 24 |
| --- | --- | --- | --- |
| `npm run build` | ✅ | ✅ | ✅ |
| unit tests (15, Vitest) | ✅ | ✅ | ✅ |
| `npm run test:lint` (0 errors, 40 `sort-keys` warnings) | — | — | ✅ |
| emitted JS identical to `5-dev` | — | — | ✅ |
| functional tests (4, Vitest), Docker stack on that Node, `npm run dev` on tsx | ✅ | ✅ | ✅ |

CI on #38, 2026-10-06: all green — lint, unit and functional tests on 20/22/24, `adr-state`, `doc-budgets`.
