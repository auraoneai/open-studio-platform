---
id: install
title: Install
---

# Install

Rubric Studio Open has three public entry points. Start with the browser IDE if
you want to evaluate the app immediately, then install the desktop app or CLI
when you want local projects, native file dialogs, and repeatable exports.

## Browser IDE

Open the hosted browser edition:

```text
https://rubric-studio.auraone.ai
```

The browser IDE uses local project state and BYO provider keys. It does not
require an AuraOne account for the sample project.

## Desktop app

The macOS Apple Silicon DMG is published through GitHub Releases:

```text
https://github.com/auraoneai/rubric-studio-open/releases/download/v0.2.0/Rubric.Studio.Open_0.2.0_aarch64.dmg
```

Verify the release fingerprint before opening the app on a new machine:

```text
7dcb7de67835947b421089eab5fc244bcd8f75d503ebc7e763921c229c68f23d
```

Release notes:

```text
https://github.com/auraoneai/rubric-studio-open/releases/tag/v0.2.0
```

## CLI companion

Use the CLI when you want to validate, score, and export from CI or a terminal:

```bash
npm install --global @auraone/rubric-studio@0.2.1
rubric-studio --help
```

If a registry package is not yet visible in your environment, use the public
source repository until package publication finishes:

```bash
git clone https://github.com/auraoneai/rubric-studio-open.git
cd rubric-studio-open
pnpm install
pnpm build
```
