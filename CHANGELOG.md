# Changelog

All notable changes to vitos-pizza are documented here.

## [0.1.0] - 2026-07-10

### Added

- Rebrand from xin-pi to **vitos-pizza** (维多披萨 / Vito's Pizzeria)
- Pi distribution layout: repo root as single install entry
- `scripts/sync-pi-manifest.mjs` module assembler
- Original logo at `assets/logo.svg`

### Removed

- Nested `packages/xin-pi` aggregator
- `@xin-pi/core`, template scaffold, postinstall symlink hack

### Publishing

- GitHub Actions workflow publishes `@vitos-pizza/vitos-pizza` to npm on `v*` tags (`NPM_TOKEN` secret)
- `scripts/prepare-publish.mjs` rewrites `file:` workspace deps for the npm tarball
