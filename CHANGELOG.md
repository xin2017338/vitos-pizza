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

- GitHub Actions publishes `@vitos-pizza/vitos-pizza` via **npm Trusted Publishing (OIDC)** — no long-lived `NPM_TOKEN`
- Workflow: `.github/workflows/publish.yml` (triggers on `v*` tags / `workflow_dispatch`)
- `scripts/prepare-publish.mjs` rewrites `file:` workspace deps for the npm tarball
- First package version must be published once manually (or as a stub) before Trusted Publisher can be configured on npmjs.com
