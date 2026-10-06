## [5.0.0-beta.3](https://github.com/kuzzleio/kuzzle-plugin-prometheus/compare/v5.0.0-beta.2...v5.0.0-beta.3) (2026-10-06)

### Bug Fixes

* replace the default GC buckets instead of merging them index by index ([7af7ebd](https://github.com/kuzzleio/kuzzle-plugin-prometheus/commit/7af7ebd73686abb797f4fa0103cacfca65dd5207))

## [5.0.0-beta.2](https://github.com/kuzzleio/kuzzle-plugin-prometheus/compare/v5.0.0-beta.1...v5.0.0-beta.2) (2026-10-06)

### Bug Fixes

* require Kuzzle 2.59.0 or later when the plugin loads ([140e37f](https://github.com/kuzzleio/kuzzle-plugin-prometheus/commit/140e37f64ad072a3dae8da8b9c24414b84736f72))
* stop logging an error on every request when request duration monitoring is disabled ([e7474dd](https://github.com/kuzzleio/kuzzle-plugin-prometheus/commit/e7474dd10e78b436b5466bec4d17ba2a67eb3c9b))

## [5.0.0-beta.1](https://github.com/kuzzleio/kuzzle-plugin-prometheus/compare/v4.2.1...v5.0.0-beta.1) (2026-10-06)

### ⚠ BREAKING CHANGES

* **deps:** Kuzzle >= 2.59.0 is required, as a peer dependency.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

### Build System

* **deps:** refresh dependencies, move to Vitest and ESLint 10 ([8a13b8f](https://github.com/kuzzleio/kuzzle-plugin-prometheus/commit/8a13b8f58fee167c204c75d71f7b4e5ae89fff45))
