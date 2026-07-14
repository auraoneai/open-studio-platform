# AuraOne Open Studio Docs Template

This is the shared Docusaurus 3 starter for Rubric Studio Open, Robotics Studio Open, and Agent Studio Open.

## Included

- Docusaurus `3.10.1` with React `18.3.1`
- AuraGlass token bridge from `aura-glass@3.1.1`
- Standard nav: Install, Quickstart, Concepts, Features, API, Cookbook, Changelog, GitHub
- Algolia DocSearch scaffold with one app and per-flagship indices
- Versioned docs scaffold at `versioned_docs/version-0.1.0`
- Per-flagship config hooks in `src/flagship.config.ts`
- Shared footer links for AuraOne Open, GitHub, security, license

## Commands

```bash
pnpm install
pnpm typecheck
pnpm build
```

Set `DOCUSAURUS_FLAGSHIP` to `rubric-studio`, `robotics-studio`, or `agent-studio` to switch product metadata.
